import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { LogOut } from "lucide-react";
import { Objective, User, AppRole } from "./types";
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

// Utility for ID generation (solo para toasts, etc.)
const generateId = () => Math.random().toString(36).substr(2, 9);

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

// 👉 Ahora tenemos más tabs
type TabView = "my-okrs" | "team" | "alignment" | "reports";

// Usuario por defecto mientras cargamos de Supabase
const DEFAULT_USER: User = {
  id: "current-user",
  name: "Mi usuario",
  role: "Owner", // Job title de relleno
  color: "bg-indigo-600",
  avatar: "MU",
  appRole: "owner", // 👈 rol en la app
};

// Tipos para filas de BD
type DBProfile = {
  id: string;
  full_name: string | null;
  role: string | null;          // job title
  app_role: string | null;      // "owner" | "manager" | "employee"
  organization_id: string | null;
  created_at: string;
};

type DBObjectiveRow = {
  id: string;
  owner_id: string;
  organization_id: string | null;
  title: string;
  category: string;
  created_at: string;
};

type DBKeyResultRow = {
  id: string;
  objective_id: string;
  title: string;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
  created_at: string;
};

// Tipo de OKR que se edita/crea en el wizard
// NOTA: aquí excluimos ownerId para no pisarlo al actualizar
type EditableObjective = Omit<
  Objective,
  "id" | "createdAt" | "lastCoaching" | "ownerId" | "organizationId"
>;

// Helper: mapear filas de BD a Objective del front
const mapDbToObjective = (
  obj: DBObjectiveRow,
  keyResults: DBKeyResultRow[]
): Objective => {
  return {
    id: obj.id,
    ownerId: obj.owner_id,
    // si en tu tipo Objective tienes organizationId, lo usamos; si no, TS lo ignorará
    // @ts-ignore
    organizationId: obj.organization_id ?? undefined,
    title: obj.title,
    category: obj.category as Objective["category"],
    createdAt: new Date(obj.created_at).getTime(),
    keyResults: keyResults.map((kr) => ({
      id: kr.id,
      title: kr.title,
      currentValue: Number(kr.current_value ?? 0),
      targetValue: Number(kr.target_value ?? 0),
      unit: kr.unit || "",
    })),
    lastCoaching: undefined,
  };
};

function App() {
  const [view, setView] = useState<"dashboard" | "create" | "detail">(
    "dashboard"
  );
  const [activeTab, setActiveTab] = useState<TabView>("my-okrs");
  const [showReport, setShowReport] = useState(false);

  // User State
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Data State (ya no usamos localStorage como fuente principal)
  const [allObjectives, setAllObjectives] = useState<Objective[]>([]);
  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const [editingOkrId, setEditingOkrId] = useState<string | null>(null);
  const [draftOkr, setDraftOkr] = useState<Objective | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoadingOkrs, setIsLoadingOkrs] = useState(false);

  // ---- CARGAR USUARIO + PROFILE DESDE SUPABASE ----
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Error obteniendo usuario de Supabase:", error.message);
          return;
        }
        if (!user) {
          console.warn("No hay usuario autenticado, usando DEFAULT_USER");
          return;
        }

        const metadata = (user.user_metadata || {}) as any;

        let fullName =
          (metadata.full_name as string) ||
          (metadata.name as string) ||
          user.email?.split("@")[0] ||
          "Mi usuario";

        // role = Job Title
        let role = (metadata.role as string) || "Owner";
        let orgId: string | null = null;
        let appRole: AppRole = "employee";

        // Intentar leer profile real
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, app_role, organization_id, created_at")
          .eq("id", user.id)
          .maybeSingle<DBProfile>();

        if (profileError) {
          console.warn("Error cargando profile:", profileError.message);
        } else if (profile) {
          if (profile.full_name) fullName = profile.full_name;
          if (profile.role) role = profile.role;
          if (profile.organization_id) orgId = profile.organization_id;
          if (profile.app_role) {
            appRole = profile.app_role as AppRole;
          }
        }

        // Si no viene de profile, intentamos metadata
        if (!profile?.app_role && metadata.app_role) {
          appRole = metadata.app_role as AppRole;
        }

        const initials = fullName
          .trim()
          .split(" ")
          .filter((p) => p.length > 0)
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        setCurrentUser({
          id: user.id,
          name: fullName,
          role, // Job title
          avatar: initials,
          color: "bg-indigo-600",
          appRole,
        });
        setOrganizationId(orgId);
      } catch (err) {
        console.error("Error inesperado cargando usuario:", err);
      }
    };

    loadCurrentUser();
  }, []);

  // ---- CARGAR OKRs DESDE SUPABASE ----
  useEffect(() => {
    const loadOkrs = async () => {
      if (!currentUser.id || currentUser.id === DEFAULT_USER.id) return;

      setIsLoadingOkrs(true);
      try {
        let query = supabase
          .from("objectives")
          .select(
            "id, owner_id, organization_id, title, category, created_at"
          )
          .eq("owner_id", currentUser.id) as any;

        if (organizationId) {
          query = query.eq("organization_id", organizationId);
        }

        const { data: dbObjectives, error: objError } =
          await query.order("created_at", { ascending: false });

        if (objError) {
          console.error("Error cargando objectives:", objError.message);
          setAllObjectives([]);
          return;
        }

        const objectives = (dbObjectives || []) as DBObjectiveRow[];

        if (objectives.length === 0) {
          setAllObjectives([]);
          return;
        }

        const objectiveIds = objectives.map((o) => o.id);

        const { data: dbKeyResults, error: krError } = await supabase
          .from("key_results")
          .select(
            "id, objective_id, title, current_value, target_value, unit, created_at"
          )
          .in("objective_id", objectiveIds);

        if (krError) {
          console.error("Error cargando key_results:", krError.message);
        }

        const keyResults = (dbKeyResults || []) as DBKeyResultRow[];

        const byObjective = new Map<string, DBKeyResultRow[]>();
        keyResults.forEach((kr) => {
          const arr = byObjective.get(kr.objective_id) || [];
          arr.push(kr);
          byObjective.set(kr.objective_id, arr);
        });

        const mapped: Objective[] = objectives.map((o) =>
          mapDbToObjective(o, byObjective.get(o.id) || [])
        );

        setAllObjectives(mapped);
      } catch (err) {
        console.error("Error inesperado cargando OKRs:", err);
      } finally {
        setIsLoadingOkrs(false);
      }
    };

    loadOkrs();
  }, [currentUser.id, organizationId]);

  // Persistencia en localStorage solo como backup/caché (opcional)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("okr-master-db", JSON.stringify(allObjectives));
    }
  }, [allObjectives]);

  // Mis OKRs (solo del usuario actual)
  const myOkrs = useMemo(
    () => allObjectives.filter((o) => o.ownerId === currentUser.id),
    [allObjectives, currentUser]
  );

  // 👉 Tabs disponibles
  const availableTabs: { id: TabView; label: string }[] = [
    { id: "my-okrs", label: "Mis OKRs" },
    { id: "team", label: "Mi equipo" },
    { id: "alignment", label: "Alineación" },
    { id: "reports", label: "Reportes" },
  ];

  // 👉 Tabs visibles según rol en la app
  const tabsForUser = useMemo(() => {
    const tabs: TabView[] = ["my-okrs"];

    if (currentUser.appRole === "manager" || currentUser.appRole === "owner") {
      tabs.push("team");
    }

    if (currentUser.appRole === "owner") {
      tabs.push("alignment", "reports");
    }

    return tabs;
  }, [currentUser.appRole]);

  // Toast helper
  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Logout
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error al cerrar sesión:", error.message);
        showToast("Hubo un problema al cerrar sesión", "error");
      }
    } catch (err: any) {
      console.error("Error inesperado al cerrar sesión:", err);
      showToast("Error inesperado al cerrar sesión", "error");
    }
  };

  // ---- CREAR / ACTUALIZAR OKR (OBJECTIVES + KEY_RESULTS) ----
  const handleSaveOkr = async (partialOkr: EditableObjective) => {
    try {
      if (editingOkrId) {
        // UPDATE EXISTING OBJECTIVE
        const { error: updError } = await supabase
          .from("objectives")
          .update({
            title: partialOkr.title,
            category: partialOkr.category,
          })
          .eq("id", editingOkrId);

        if (updError) {
          console.error("Error actualizando objective:", updError.message);
          showToast("No se pudo actualizar el OKR", "error");
          return;
        }

        // Borramos todos los KRs y los reinsertamos
        const { error: delError } = await supabase
          .from("key_results")
          .delete()
          .eq("objective_id", editingOkrId);

        if (delError) {
          console.error("Error borrando key_results:", delError.message);
        }

        const krPayload = partialOkr.keyResults.map((kr) => ({
          objective_id: editingOkrId,
          title: kr.title,
          current_value: kr.currentValue,
          target_value: kr.targetValue,
          unit: kr.unit,
        }));

        let insertedKrs: DBKeyResultRow[] = [];
        if (krPayload.length > 0) {
          const { data: krData, error: insKrError } = await supabase
            .from("key_results")
            .insert(krPayload)
            .select(
              "id, objective_id, title, current_value, target_value, unit, created_at"
            );

          if (insKrError) {
            console.error("Error insertando key_results:", insKrError.message);
            showToast("OKR actualizado, pero hubo un problema con los KRs", "error");
          } else {
            insertedKrs = (krData || []) as DBKeyResultRow[];
          }
        }

        // Volvemos a leer el objective actualizado
        const { data: objData, error: objError } = await supabase
          .from("objectives")
          .select(
            "id, owner_id, organization_id, title, category, created_at"
          )
          .eq("id", editingOkrId)
          .single<DBObjectiveRow>();

        if (objError || !objData) {
          console.error("Error recargando objective:", objError?.message);
          showToast("OKR actualizado, pero no se pudo refrescar la vista", "error");
        } else {
          const updated = mapDbToObjective(objData, insertedKrs);
          setAllObjectives((prev) =>
            prev.map((o) => (o.id === editingOkrId ? updated : o))
          );
          showToast("OKR actualizado correctamente");
        }

        setEditingOkrId(null);
      } else {
        // CREATE NEW OBJECTIVE
        const { data: objData, error: objError } = await supabase
          .from("objectives")
          .insert({
            owner_id: currentUser.id,
            organization_id: organizationId,
            title: partialOkr.title,
            category: partialOkr.category,
          })
          .select(
            "id, owner_id, organization_id, title, category, created_at"
          )
          .single<DBObjectiveRow>();

        if (objError || !objData) {
          console.error("Error creando objective:", objError?.message);
          showToast("No se pudo crear el OKR", "error");
          return;
        }

        const krPayload = partialOkr.keyResults.map((kr) => ({
          objective_id: objData.id,
          title: kr.title,
          current_value: kr.currentValue,
          target_value: kr.targetValue,
          unit: kr.unit,
        }));

        let insertedKrs: DBKeyResultRow[] = [];
        if (krPayload.length > 0) {
          const { data: krData, error: krError } = await supabase
            .from("key_results")
            .insert(krPayload)
            .select(
              "id, objective_id, title, current_value, target_value, unit, created_at"
            );

          if (krError) {
            console.error("Error creando key_results:", krError.message);
            showToast(
              "Objetivo creado, pero hubo un problema guardando los KRs",
              "error"
            );
          } else {
            insertedKrs = (krData || []) as DBKeyResultRow[];
          }
        }

        const newOkr = mapDbToObjective(objData, insertedKrs);
        setAllObjectives((prev) => [newOkr, ...prev]);
        showToast("OKR creado exitosamente");
      }
    } catch (err) {
      console.error("Error inesperado al guardar OKR:", err);
      showToast("Error inesperado al guardar", "error");
    }

    setDraftOkr(undefined);
    setView("dashboard");
  };

  // ---- ACTUALIZAR PROGRESO / DETALLE DESDE OKR DETAIL ----
  const handleUpdateOkr = async (updatedOkr: Objective) => {
    // Optimista en UI
    setAllObjectives((prev) =>
      prev.map((o) => (o.id === updatedOkr.id ? updatedOkr : o))
    );

    try {
      const { error: updError } = await supabase
        .from("objectives")
        .update({
          title: updatedOkr.title,
          category: updatedOkr.category,
        })
        .eq("id", updatedOkr.id);

      if (updError) {
        console.error("Error actualizando objective:", updError.message);
      }

      // Simplificación: borramos KRs y los reinsertamos
      const { error: delError } = await supabase
        .from("key_results")
        .delete()
        .eq("objective_id", updatedOkr.id);

      if (delError) {
        console.error("Error borrando key_results:", delError.message);
      }

      const krPayload = updatedOkr.keyResults.map((kr) => ({
        objective_id: updatedOkr.id,
        title: kr.title,
        current_value: kr.currentValue,
        target_value: kr.targetValue,
        unit: kr.unit,
      }));

      if (krPayload.length > 0) {
        const { error: insError } = await supabase
          .from("key_results")
          .insert(krPayload);

        if (insError) {
          console.error("Error reinsertando key_results:", insError.message);
          showToast("Cambios guardados parcialmente (KRs con error)", "error");
          return;
        }
      }

      showToast("Cambios guardados");
    } catch (err) {
      console.error("Error inesperado al actualizar OKR:", err);
      showToast("Error inesperado al actualizar", "error");
    }
  };

  const handleDeleteOkr = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este OKR?")) return;

    try {
      // Borrar KRs primero
      const { error: krError } = await supabase
        .from("key_results")
        .delete()
        .eq("objective_id", id);

      if (krError) {
        console.error("Error borrando key_results:", krError.message);
      }

      const { error: objError } = await supabase
        .from("objectives")
        .delete()
        .eq("id", id);

      if (objError) {
        console.error("Error borrando objective:", objError.message);
        showToast("No se pudo eliminar el OKR", "error");
        return;
      }

      setAllObjectives((prev) => prev.filter((o) => o.id !== id));
      setView("dashboard");
      setSelectedOkrId(null);
      showToast("OKR eliminado");
    } catch (err) {
      console.error("Error inesperado al eliminar OKR:", err);
      showToast("Error inesperado al eliminar", "error");
    }
  };

  const handleEditOkr = (okr: Objective) => {
    setEditingOkrId(okr.id);
    setView("create");
  };

  const handleCancelWizard = () => {
    setEditingOkrId(null);
    setDraftOkr(undefined);
    setView(editingOkrId ? "detail" : "dashboard");
  };

  const calculateProgress = (objective: Objective) => {
    if (objective.keyResults.length === 0) return 0;
    const total = objective.keyResults.reduce((acc, kr) => {
      const p = Math.min(
        100,
        Math.max(0, (kr.currentValue / kr.targetValue) * 100)
      );
      return acc + p;
    }, 0);
    return Math.round(total / objective.keyResults.length);
  };

  const selectedOkr = allObjectives.find((o) => o.id === selectedOkrId);
  const okrToEdit = editingOkrId
    ? allObjectives.find((o) => o.id === editingOkrId)
    : draftOkr;

  // Render Helper para card de OKR
  const renderOkrCard = (
    okr: Objective,
    onClick?: () => void,
    readOnly: boolean = false
  ) => {
    const progress = calculateProgress(okr);
    return (
      <div
        key={okr.id}
        onClick={onClick}
        className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all relative overflow-hidden group
          ${
            onClick
              ? "hover:shadow-md hover:border-indigo-300 cursor-pointer"
              : ""
          }`}
      >
        {onClick && (
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}

        <div className="flex justify-between items-start mb-4">
          <span
            className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
              okr.category === "Business"
                ? "bg-blue-100 text-blue-700"
                : okr.category === "Personal"
                ? "bg-purple-100 text-purple-700"
                : okr.category === "Health"
                ? "bg-green-100 text-green-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {okr.category === "Business"
              ? "Negocios"
              : okr.category === "Personal"
              ? "Personal"
              : okr.category === "Health"
              ? "Salud"
              : "Aprendizaje"}
          </span>
          {onClick && (
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
          )}
        </div>

        <h3 className="font-bold text-lg text-slate-800 mb-4 line-clamp-2 h-14 leading-tight">
          {okr.title}
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Progreso general</span>
            <span
              className={`font-bold ${
                progress >= 70
                  ? "text-emerald-600"
                  : progress >= 40
                  ? "text-amber-500"
                  : "text-slate-600"
              }`}
            >
              {progress}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                progress >= 70
                  ? "bg-emerald-500"
                  : progress >= 40
                  ? "bg-amber-500"
                  : "bg-indigo-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {!readOnly && (
            <div className="text-xs text-slate-400 pt-1 flex justify-between items-center">
              <span>{okr.keyResults.length} Key Results</span>
              {okr.lastCoaching && (
                <span className="text-indigo-600 font-medium">
                  Feedback recibido
                </span>
              )}
            </div>
          )}
          {readOnly && (
            <div className="text-xs text-slate-400 pt-1">
              {okr.keyResults.length} KRs definidos
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white font-medium text-sm animate-fadeIn ${
              toast.type === "success" ? "bg-slate-800" : "bg-red-500"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 font-bold text-xl text-indigo-600 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setView("dashboard");
              setEditingOkrId(null);
              setActiveTab("my-okrs");
            }}
          >
            <Trophy className="w-6 h-6" />
            <span className="hidden sm:inline">OKR Master AI</span>
            <span className="sm:hidden">OKR AI</span>
          </div>

          <div className="flex gap-4 items-center">
            {/* Info de usuario simple */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1">
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${currentUser.color}`}
              >
                {currentUser.avatar}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">
                  {currentUser.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {currentUser.role}
                </span>
              </div>
            </div>

            {/* Botón Salir */}
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-600 text-xs sm:text-sm flex items-center gap-1 border border-slate-200 hover:border-red-200 rounded-lg px-2 py-1"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Salir</span>
            </button>

            {/* Botón Reporte */}
            {view === "dashboard" &&
              myOkrs.length > 0 &&
              activeTab === "my-okrs" && (
                <button
                  onClick={() => setShowReport(true)}
                  className="text-slate-600 hover:text-indigo-600 text-sm font-medium py-2 px-3 rounded-lg flex items-center gap-2 transition-colors border border-transparent hover:border-slate-200 hover:bg-slate-50"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Reporte</span>
                </button>
              )}

            {/* Botón Nuevo OKR */}
            {view === "dashboard" && activeTab === "my-okrs" && (
              <button
                onClick={() => {
                  setEditingOkrId(null);
                  setDraftOkr(undefined);
                  setView("create");
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo OKR</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs: ahora dinámicos según appRole */}
        {view === "dashboard" && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-6 overflow-x-auto no-scrollbar">
              {availableTabs
                .filter((t) => tabsForUser.includes(t.id))
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {/* Iconito según el tab */}
                    {tab.id === "my-okrs" && <Layout className="w-4 h-4" />}
                    {tab.id === "team" && <Target className="w-4 h-4" />}
                    {tab.id === "alignment" && <Layout className="w-4 h-4" />}
                    {tab.id === "reports" && <FileText className="w-4 h-4" />}

                    {tab.label}
                    {tab.id === "my-okrs" && ` (${myOkrs.length})`}
                  </button>
                ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === "dashboard" && (
          <div className="space-y-6 animate-fadeIn">
            {/* MY OKRS TAB */}
            {activeTab === "my-okrs" && (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      Hola, {currentUser.name.split(" ")[0]}
                    </h1>
                    <p className="text-slate-500 mt-1">
                      Aquí están tus objetivos para este ciclo.
                    </p>
                  </div>
                </div>

                {isLoadingOkrs ? (
                  <div className="text-slate-500 text-sm">
                    Cargando tus OKRs...
                  </div>
                ) : myOkrs.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                    <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Target className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">
                      No tienes OKRs aún
                    </h3>
                    <p className="text-slate-500 mt-2 mb-6 max-w-sm mx-auto">
                      Crea tu primer OKR y deja que la IA te ayude a aterrizar
                      tus metas.
                    </p>
                    <button
                      onClick={() => setView("create")}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all hover:-translate-y-0.5"
                    >
                      Crear mi primer OKR
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myOkrs.map((okr) =>
                      renderOkrCard(okr, () => {
                        setSelectedOkrId(okr.id);
                        setView("detail");
                      })
                    )}
                  </div>
                )}
              </>
            )}

            {/* TEAM TAB (placeholder por ahora) */}
            {activeTab === "team" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Mi equipo
                </h2>
                <p className="text-slate-500 text-sm">
                  Aquí podrás ver los OKRs de tu equipo cuando conectemos la
                  lógica de manager/colaboradores. Por ahora, esta sección es
                  solo visible para <strong>Managers</strong> y{" "}
                  <strong>Owners</strong>.
                </p>
              </div>
            )}

            {/* ALIGNMENT TAB (placeholder) */}
            {activeTab === "alignment" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Alineación
                </h2>
                <p className="text-slate-500 text-sm">
                  Vista de alineación de objetivos a nivel organización. Solo
                  Owners pueden ver esta pestaña. Más adelante aquí puedes
                  mostrar cómo los OKRs se conectan entre sí.
                </p>
              </div>
            )}

            {/* REPORTS TAB (placeholder) */}
            {activeTab === "reports" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Reportes
                </h2>
                <p className="text-slate-500 text-sm">
                  Espacio para reportes ejecutivos, resúmenes mensuales y
                  exportables. Por ahora está como placeholder, pero solo es
                  visible para Owners.
                </p>
              </div>
            )}
          </div>
        )}

        {view === "create" && (
          <Wizard
            initialData={okrToEdit}
            onSave={handleSaveOkr}
            onCancel={handleCancelWizard}
          />
        )}

        {view === "detail" && selectedOkr && (
          <OkrDetail
            objective={selectedOkr}
            onBack={() => setView("dashboard")}
            onUpdate={handleUpdateOkr}
            onDelete={handleDeleteOkr}
            onEdit={handleEditOkr}
          />
        )}
      </main>

      {showReport && (
        <MonthlyReportModal
          objectives={myOkrs}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

export default App;
