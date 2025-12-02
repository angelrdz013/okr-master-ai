import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { LogOut } from "lucide-react";
import { Objective, User } from "./types";
import Wizard from "./components/Wizard";
import OkrDetail from "./components/OkrDetail";
import MonthlyReportModal from "./components/MonthlyReport";
import {
  PlusCircle,
  Target,
  Trophy,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  Layout,
} from "lucide-react";

// Utility for ID generation (toasts, etc.)
const generateId = () => Math.random().toString(36).substr(2, 9);

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

// Vistas posibles
type TabView = "my-okrs" | "team-okrs" | "owner-okrs" | "all-okrs";

// Helper para obtener ownerId de un Objective, sin depender del tipo exacto
const getOwnerIdFromObjective = (obj: any): string => {
  return obj.owner_id ?? obj.ownerId ?? obj.owner ?? "";
};

// ------------------------------------------------------
// App principal
// ------------------------------------------------------
function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(
    null
  );
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("my-okrs");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(true);

  // -------------------------
  // Manejo de Toasts
  // -------------------------
  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // -------------------------
  // Cargar perfiles desde Supabase
  // -------------------------
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("*");
        if (error) {
          console.error("Error loading profiles:", error);
          addToast("Error cargando perfiles", "error");
          return;
        }
        if (!data) return;

        const mappedProfiles: User[] = data.map((row: any) => ({
          id: row.id,
          name: row.name || "Sin nombre",
          role: row.role || "Employee",
          managerId: row.managerId ?? row.manager_id ?? null,
          color: row.color || "bg-slate-600",
          avatar:
            row.avatar ||
            (row.name ? row.name[0].toUpperCase() : "U"),
        }));

        setProfiles(mappedProfiles);

        // Definir usuario actual por defecto:
        // 1) Owner si existe, si no, el primero
        const ownerProfile =
          mappedProfiles.find((p) => p.role === "Owner") ||
          mappedProfiles[0];

        if (ownerProfile) {
          setCurrentUser(ownerProfile);
          // Owner arranca viendo todo, otros empiezan con "my-okrs"
          if (ownerProfile.role === "Owner") {
            setActiveTab("all-okrs");
          } else {
            setActiveTab("my-okrs");
          }
        }
      } catch (err) {
        console.error(err);
        addToast("Error inesperado cargando perfiles", "error");
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, []);

  // -------------------------
  // Cargar OKRs visibles según usuario y reporting
  // -------------------------
  useEffect(() => {
    const loadObjectivesForUser = async () => {
      if (!currentUser || profiles.length === 0) return;

      try {
        setLoading(true);
        const visibleObjectives = await fetchVisibleObjectives(
          currentUser,
          profiles
        );
        setObjectives(visibleObjectives);
      } catch (err) {
        console.error(err);
        addToast("Error cargando OKRs", "error");
      } finally {
        setLoading(false);
      }
    };

    loadObjectivesForUser();
  }, [currentUser, profiles]);

  // -------------------------
  // Tabs disponibles según rol
  // -------------------------
  const availableTabs = useMemo(() => {
    if (!currentUser) {
      return [{ id: "my-okrs" as TabView, label: "Mis OKRs" }];
    }

    if (currentUser.role === "Owner") {
      return [
        { id: "all-okrs" as TabView, label: "Todos los OKRs" },
        { id: "my-okrs" as TabView, label: "Mis OKRs" },
      ];
    }

    if (currentUser.role === "HR Director") {
      return [
        { id: "my-okrs" as TabView, label: "Mis OKRs" },
        { id: "team-okrs" as TabView, label: "Equipo" },
        { id: "owner-okrs" as TabView, label: "Owner" },
      ];
    }

    // Reporte directo
    return [
      { id: "my-okrs" as TabView, label: "Mis OKRs" },
      { id: "team-okrs" as TabView, label: "Mi jefe" },
      { id: "owner-okrs" as TabView, label: "Owner" },
    ];
  }, [currentUser]);

  // -------------------------
  // Filtrar objetivos según Tab
  // -------------------------
  const visibleObjectivesByTab = useMemo(
    () =>
      filterObjectivesByTab(
        objectives,
        activeTab,
        currentUser,
        profiles
      ),
    [objectives, activeTab, currentUser, profiles]
  );

  // -------------------------
  // Cambiar usuario actual (select arriba)
  // -------------------------
  const handleUserChange = (id: string) => {
    const selected = profiles.find((p) => p.id === id);
    if (selected) {
      setCurrentUser(selected);
      // Ajustar tab por rol
      if (selected.role === "Owner") {
        setActiveTab("all-okrs");
      } else {
        setActiveTab("my-okrs");
      }
    }
  };

  // -------------------------
  // Crear OKR (después de usar Wizard)
  // -------------------------
  const handleObjectiveCreated = (objective: Objective) => {
    setObjectives((prev) => [...prev, objective]);
    addToast("OKR creado correctamente", "success");
  };

  // -------------------------
  // Actualizar OKR después de editar
  // -------------------------
  const handleObjectiveUpdated = (updated: Objective) => {
    setObjectives((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
    addToast("OKR actualizado", "success");
  };

  // -------------------------
  // Lógica de adopción de KR
  // (úsala donde pintas los KRs, enviando krId y owner del KR)
  // -------------------------
  const canCurrentUserAdoptFrom = (sourceOwnerId: string): boolean => {
    if (!currentUser) return false;
    return canUserAdoptFrom(currentUser, sourceOwnerId, profiles);
  };

  const adoptKr = async (krId: string, sourceOwnerId: string) => {
    if (!currentUser) return;

    if (!canCurrentUserAdoptFrom(sourceOwnerId)) {
      addToast(
        "No puedes adoptar este KR (solo los del jefe directo u Owner según tu rol)",
        "error"
      );
      return;
    }

    try {
      // Traer KR original
      const { data: krData, error: krError } = await supabase
        .from("key_results")
        .select("*")
        .eq("id", krId)
        .single();

      if (krError || !krData) {
        addToast("No se encontró el KR a adoptar", "error");
        return;
      }

      // Crear KR nuevo como adoptado para el usuario actual
      const { error: insertError } = await supabase
        .from("key_results")
        .insert({
          // Campos básicos, ajusta según tu modelo real de KR
          title: krData.title,
          description: krData.description,
          target: krData.target,
          current: 0,
          unit: krData.unit,
          objective_id: krData.objective_id, // o crea un nuevo Objective si aplica
          owner_id: currentUser.id,
          parent_kr_id: krId,
          adopted: true,
        });

      if (insertError) {
        console.error(insertError);
        addToast("Error al adoptar KR", "error");
        return;
      }

      addToast("KR adoptado correctamente", "success");
    } catch (err) {
      console.error(err);
      addToast("Error inesperado al adoptar KR", "error");
    }
  };

  // ------------------------------------------------------
  // Render
  // ------------------------------------------------------
  if (loading && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        Cargando...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        No se encontró usuario actual (revisa tabla profiles).
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  OKR Master AI
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                  <Trophy className="w-3 h-3" />
                  Beta
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transparencia por rol · Cascada por adopción de KRs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Selector de usuario (para probar los 4 perfiles) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Actuando como:
              </span>
              <select
                value={currentUser.id}
                onChange={(e) => handleUserChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-2 py-1"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold ${currentUser.color}`}
              >
                {currentUser.avatar}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-medium">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  {currentUser.role}
                </span>
              </div>
              <button className="ml-2 p-1.5 rounded-lg hover:bg-slate-800">
                <LogOut className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs + acciones */}
      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Tabs */}
          <div className="inline-flex rounded-full bg-slate-900/60 border border-slate-800 p-1">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs rounded-full inline-flex items-center gap-1 ${
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
                }`}
              >
                {tab.id === "my-okrs" && <Layout className="w-3 h-3" />}
                {tab.id === "team-okrs" && <UsersIcon />}
                {tab.id === "owner-okrs" && <CrownIcon />}
                {tab.id === "all-okrs" && <GlobeIcon />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMonthlyReportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              <FileText className="w-3.5 h-3.5" />
              Reporte mensual
            </button>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-medium text-white shadow hover:bg-indigo-500"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Nuevo OKR
            </button>
          </div>
        </div>

        {/* Lista de OKRs */}
        <section className="space-y-3">
          {loading && (
            <div className="text-sm text-slate-400">
              Cargando OKRs visibles...
            </div>
          )}

          {!loading && visibleObjectivesByTab.length === 0 && (
            <div className="border border-dashed border-slate-700 rounded-xl p-6 text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
              <Target className="w-5 h-5 text-slate-500" />
              <span>No hay OKRs en esta vista.</span>
              <span className="text-xs text-slate-500">
                Crea uno nuevo o cambia de pestaña.
              </span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {visibleObjectivesByTab.map((obj: any) => {
              const ownerId = getOwnerIdFromObjective(obj);
              const ownerProfile =
                profiles.find((p) => p.id === ownerId) || null;

              return (
                <button
                  key={obj.id}
                  onClick={() => setSelectedObjective(obj)}
                  className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                        <Target className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold line-clamp-1">
                          {obj.title}
                        </span>
                        {ownerProfile && (
                          <span className="text-[11px] text-slate-400">
                            Owner: {ownerProfile.name} ({ownerProfile.role})
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>

                  {obj.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {obj.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{obj.cycle || "Ciclo actual"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">
                        {obj.status || "En progreso"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Wizard para crear OKR */}
      {isWizardOpen && (
        <Wizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          currentUser={currentUser}
          onCreated={handleObjectiveCreated}
        />
      )}

      {/* Detalle de OKR */}
      {selectedObjective && (
        <OkrDetail
          objective={selectedObjective}
          onClose={() => setSelectedObjective(null)}
          // Si en tu OkrDetail pintas KRs, puedes pasar adoptKr vía props
          // y usarla allí para poner el botón "Adoptar KR" en cada uno.
          adoptKr={adoptKr}
          canAdoptFrom={canCurrentUserAdoptFrom}
        />
      )}

      {/* Modal de reporte mensual */}
      {isMonthlyReportOpen && (
        <MonthlyReportModal
          isOpen={isMonthlyReportOpen}
          onClose={() => setIsMonthlyReportOpen(false)}
          objectives={objectives}
          currentUser={currentUser}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-30">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/40 bg-red-500/10 text-red-100"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------
// Funciones auxiliares (visibilidad y adopción)
// ------------------------------------------------------
async function fetchVisibleObjectives(
  currentUser: User,
  profiles: User[]
): Promise<Objective[]> {
  const visibleIds = new Set<string>();

  // Siempre veo mis propios OKRs
  visibleIds.add(currentUser.id);

  // Owner
  const owner = profiles.find((p) => p.role === "Owner");
  if (owner) {
    visibleIds.add(owner.id);
  }

  // OWNER ve todo
  if (currentUser.role === "Owner") {
    profiles.forEach((p) => visibleIds.add(p.id));
  } else if (currentUser.role === "HR Director") {
    // HR Director ve su equipo directo
    const team = profiles.filter((p) => p.managerId === currentUser.id);
    team.forEach((p) => visibleIds.add(p.id));
  } else {
    // Reporte directo ve a su jefe
    const myProfile = profiles.find((p) => p.id === currentUser.id);
    const managerId = myProfile?.managerId ?? currentUser.managerId;
    if (managerId) {
      visibleIds.add(managerId);
    }
  }

  const { data, error } = await supabase
    .from("objectives") // CAMBIA a "okrs" si tu tabla se llama así
    .select("*")
    .in("owner_id", Array.from(visibleIds));

  if (error || !data) {
    console.error("Error fetching objectives:", error);
    return [];
  }

  return data as Objective[];
}

function filterObjectivesByTab(
  objectives: Objective[],
  tab: TabView,
  currentUser: User | null,
  profiles: User[]
): Objective[] {
  if (!currentUser) return [];

  const ownerId = (o: any) => getOwnerIdFromObjective(o);

  if (currentUser.role === "Owner") {
    if (tab === "all-okrs") return objectives;
    if (tab === "my-okrs")
      return objectives.filter((o) => ownerId(o) === currentUser.id);
  }

  switch (tab) {
    case "my-okrs":
      return objectives.filter((o) => ownerId(o) === currentUser.id);

    case "team-okrs":
      if (currentUser.role === "HR Director") {
        const teamIds = profiles
          .filter((p) => p.managerId === currentUser.id)
          .map((p) => p.id);
        return objectives.filter((o) => teamIds.includes(ownerId(o)));
      } else {
        const manager = profiles.find((p) => p.id === currentUser.managerId);
        if (!manager) return [];
        return objectives.filter((o) => ownerId(o) === manager.id);
      }

    case "owner-okrs": {
      const ownerProfile = profiles.find((p) => p.role === "Owner");
      if (!ownerProfile) return [];
      return objectives.filter((o) => ownerId(o) === ownerProfile.id);
    }

    case "all-okrs":
      return objectives;

    default:
      return objectives;
  }
}

// Regla de negocio para adopción de KR
function canUserAdoptFrom(
  currentUser: User,
  sourceOwnerId: string,
  profiles: User[]
): boolean {
  if (currentUser.role === "Owner") return false;

  const sourceOwner = profiles.find((p) => p.id === sourceOwnerId);
  if (!sourceOwner) return false;

  const ownerProfile = profiles.find((p) => p.role === "Owner");

  // HR Director puede adoptar KRs del Owner
  if (currentUser.role === "HR Director") {
    return ownerProfile ? sourceOwnerId === ownerProfile.id : false;
  }

  // Reporte directo solo puede adoptar de su jefe directo
  if (currentUser.role === "Employee") {
    return currentUser.managerId === sourceOwnerId;
  }

  return false;
}

// Iconos simples para tabs
const UsersIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M16 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
    <circle cx="9" cy="7" r="3" />
    <circle cx="17" cy="7" r="3" />
  </svg>
);

const CrownIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 11l4-7 5 4 5-4 4 7" />
    <path d="M4 19h16" />
  </svg>
);

const GlobeIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" />
  </svg>
);

export default App;
