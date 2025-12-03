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

// 👉 Tabs
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
  role: string | null; // job title
  app_role: string | null; // "owner" | "manager" | "employee" | "hrdirector"
  organization_id: string | null;
  manager_id: string | null; // <-- CAMBIO/ADICIÓN CLAVE: ID del jefe
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

// Helper para normalizar app_role
const normalizeAppRole = (
  value: string | null | undefined
): AppRole | null => {
  if (!value) return null;
  const v = value.toString().toLowerCase();
  // Incluimos 'hrdirector' en la lista de roles válidos
  if (v === "owner" || v === "manager" || v === "employee" || v === "hrdirector") {
    return v as AppRole;
  }
  return null;
};

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

// Helper: mapear filas de DBProfile a User del front
const mapDbToUser = (profile: DBProfile): User => {
  const fullName = profile.full_name || profile.id.split("-")[0];
  const initials = fullName
    .trim()
    .split(" ")
    .filter((p) => p.length > 0)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const appRole = normalizeAppRole(profile.app_role) || "employee";

  return {
    id: profile.id,
    name: fullName,
    role: profile.role || (appRole.charAt(0).toUpperCase() + appRole.slice(1)),
    avatar: initials,
    // Deberías asignar colores reales basados en el perfil si los tienes
    color: "bg-indigo-600",
    appRole: appRole,
    // Asumimos que User tiene este campo, si no lo tiene, ignorar:
    // @ts-ignore
    managerId: profile.manager_id ?? undefined,
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
  const [allUsers, setAllUsers] = useState<User[]>([]); // <-- NUEVO: Todos los usuarios
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Data State
  const [allObjectives, setAllObjectives] = useState<Objective[]>([]);
  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const [editingOkrId, setEditingOkrId] = useState<string | null>(null);
  const [draftOkr, setDraftOkr] = useState<Objective | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoadingOkrs, setIsLoadingOkrs] = useState(false);

  // ---- CARGAR USUARIO + TODOS LOS PROFILES DESDE SUPABASE ----
  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          console.warn("No hay usuario autenticado o error:", error?.message);
          return;
        }

        let orgId: string | null = null;
        let currentProfile: DBProfile | null = null;

        // 1. Cargar el profile del usuario actual
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, role, app_role, organization_id, manager_id, created_at"
          ) // <-- IMPORTANTE: Incluir manager_id
          .eq("id", user.id)
          .maybeSingle<DBProfile>();

        if (profileError) {
          console.warn("Error cargando profile:", profileError.message);
        } else if (profileData) {
          currentProfile = profileData;
          orgId = profileData.organization_id;
        }

        // 2. Si se encontró la organización, cargar TODOS los perfiles de la organización
        let loadedUsers: User[] = [];
        if (orgId) {
          const { data: allProfiles, error: allProfilesError } = await supabase
            .from("profiles")
            .select(
              "id, full_name, role, app_role, organization_id, manager_id, created_at"
            )
            .eq("organization_id", orgId);

          if (allProfilesError) {
            console.warn("Error cargando todos los profiles:", allProfilesError.message);
          } else {
            loadedUsers = (allProfiles || []).map(mapDbToUser);
            setAllUsers(loadedUsers);
          }
        }
        
        // 3. Establecer el currentUser final (usando profile o metadata de fallback)
        if (currentProfile) {
          setCurrentUser(mapDbToUser(currentProfile));
        } else {
          // Fallback usando metadata si no hay perfil de DB
          const metadata = (user.user_metadata || {}) as any;
          const fullName = metadata.full_name || user.email?.split("@")[0] || "Mi usuario";
          const initials = fullName
            .trim()
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          setCurrentUser({
            id: user.id,
            name: fullName,
            role: metadata.role || "Employee",
            avatar: initials,
            color: "bg-indigo-600",
            appRole: normalizeAppRole(metadata.app_role) || "employee",
            // @ts-ignore
            managerId: undefined, 
          });
        }
        
        setOrganizationId(orgId);

      } catch (err) {
        console.error("Error inesperado cargando usuario:", err);
      }
    };

    loadData();
  }, []);

  // ---- CARGAR OKRs DESDE SUPABASE (todos los de la organización) ----
  useEffect(() => {
    const loadOkrs = async () => {
      if (!currentUser.id || currentUser.id === DEFAULT_USER.id) return;

      setIsLoadingOkrs(true);
      try {
        let query = supabase
          .from("objectives")
          .select(
            "id, owner_id, organization_id, title, category, created_at"
          ) as any;

        // Si tenemos organization_id, filtramos por ahí (todos los OKRs de la org)
        if (organizationId) {
          query = query.eq("organization_id", organizationId);
        } else {
            // Si no hay organizationId (ej: solo 1 usuario), filtramos solo por el propio
            query = query.eq("owner_id", currentUser.id);
        }

        const { data: dbObjectives, error: objError } = await query.order(
          "created_at",
          { ascending: false }
        );

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

  // Mis OKRs (solo del usuario actual)
  const myOkrs = useMemo(
    () => allObjectives.filter((o) => o.ownerId === currentUser.id),
    [allObjectives, currentUser]
  );
  
  // IDs de los Owners (asumiendo que solo hay 1 Owner de App en este modelo simple)
  const ownerId = useMemo(() => {
    return allUsers.find(u => u.appRole === 'owner')?.id;
  }, [allUsers]);

  // IDs de los reportes directos del usuario actual
  const directReportsIds = useMemo(() => {
    // Si el usuario no es manager/hrdirector/owner, no tiene reportes directos que ver
    if (currentUser.appRole === "employee") {
      return [];
    }

    // Filtra la lista de todos los usuarios para encontrar a quienes reportan al currentUser
    return allUsers
      // @ts-ignore - asumimos que managerId existe en User
      .filter(u => u.managerId === currentUser.id)
      .map(u => u.id);
  }, [allUsers, currentUser.id, currentUser.appRole]);
  
  // IDs del jefe directo del usuario actual
  const directManagerId = useMemo(() => {
    // @ts-ignore - asumimos que managerId existe en User
    return currentUser.managerId;
  }, [currentUser.managerId]);


  // 👉 Tabs visibles según rol en la app
  const tabsForUser = useMemo(() => {
    // Todos ven Mis OKRs + Mi equipo (transparencia básica)
    const tabs: TabView[] = ["my-okrs", "team"];

    // Solo el owner/hrdirector ve Alignment y Reports
    if (currentUser.appRole === "owner" || currentUser.appRole === "hrdirector") {
      tabs.push("alignment", "reports");
    }

    return tabs;
  }, [currentUser.appRole]);

  // 👉 OKRs visibles en la pestaña 'team' / 'alignment' (LÓGICA CRÍTICA DE VISIBILIDAD)
  const okrsForActiveTab = useMemo(() => {
    
    // Si no hay datos, retorna vacío
    if (!allObjectives || allObjectives.length === 0) return [];
    
    // Si es 'my-okrs', usamos el filtro simple ya hecho
    if (activeTab === "my-okrs") {
      return myOkrs;
    }

    // Lista de Owner IDs cuyos OKRs son visibles para el currentUser
    const visibleOwnerIds = new Set<string>();
    
    // 1. Lógica General para Reportes Directos (🟠) y HR Director (🟣)
    if (currentUser.appRole === "employee" || currentUser.appRole === "hrdirector") {
        
        // a. Todos ven los OKRs del Owner (transparencia)
        if (ownerId) {
            visibleOwnerIds.add(ownerId);
        }
        
        // b. Reporte Directo (🟠) / Employee: Ve los OKRs de su jefe directo
        if (currentUser.appRole === "employee" && directManagerId) {
            visibleOwnerIds.add(directManagerId);
        }
        
        // c. HR Director (🟣): Ve los OKRs de su equipo directo
        if (currentUser.appRole === "hrdirector") {
            directReportsIds.forEach(id => visibleOwnerIds.add(id));
        }
    }
    
    // 2. Lógica para OWNER (🔵)
    if (currentUser.appRole === "owner") {
        // En la pestaña 'team', el Owner ve OKRs de todos los demás.
        return allObjectives.filter(o => o.ownerId !== currentUser.id);
    }
    
    // 3. Aplica los filtros de visibilidad
    const finalVisibleIds = Array.from(visibleOwnerIds);
    
    // Filtra los OKRs: deben pertenecer a un owner visible Y NO ser los propios
    return allObjectives.filter(o => 
        finalVisibleIds.includes(o.ownerId) && o.ownerId !== currentUser.id
    );
    
  }, [activeTab, allObjectives, currentUser.id, currentUser.appRole, ownerId, directManagerId, directReportsIds, myOkrs]);


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
            showToast(
              "OKR actualizado, pero hubo un problema con los KRs",
              "error"
            );
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
          showToast(
            "OKR actualizado, pero no se pudo refrescar la vista",
            "error"
          );
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
    
    // Encuentra el dueño del OKR para mostrar su nombre/avatar si no es el usuario actual
    const owner = allUsers.find(u => u.id === okr.ownerId);

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
          {owner && owner.id !== currentUser.id && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${owner.color}`}
                >
                    {owner.avatar}
                </div>
                <span>{owner.name}</span>
            </div>
          )}
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
          <div className="text-xs text-slate-400 pt-1 flex justify-between items-center">
             <span>{okr.keyResults.length} Key Results</span>
             {okr.lastCoaching && (
                <span className="text-indigo-600 font-medium">
                  Feedback recibido
                </span>
              )}
          </div>
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

        {/* Tabs: dinámicos según appRole */}
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
                    {tab.id === "team" && ` (${okrsForActiveTab.length})`} {/* <-- Actualizado el contador */}
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

            {/* TEAM TAB */}
            {activeTab === "team" && (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Objetivos de mi equipo y alineación
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Aquí ves los OKRs de las personas relevantes en tu organización
                    (jefes directos, Owner, y tus reportes si eres Manager/HR).
                  </p>
                </div>

                {isLoadingOkrs ? (
                  <div className="text-slate-500 text-sm">
                    Cargando OKRs del equipo...
                  </div>
                ) : okrsForActiveTab.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm p-6 text-sm text-slate-500">
                    No hay OKRs adicionales visibles por ahora según tu rol.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {okrsForActiveTab.map((okr) =>
                      renderOkrCard(
                        okr,
                        () => {
                          setSelectedOkrId(okr.id);
                          setView("detail");
                        },
                        true // readOnly
                      )
                    )}
                  </div>
                )}
              </>
            )}

            {/* ALIGNMENT TAB (placeholder) */}
            {activeTab === "alignment" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Alineación
                </h2>
                <p className="text-slate-500 text-sm">
                  Esta vista mostraría un árbol de OKRs de la organización.
                  Viendo **{okrsForActiveTab.length}** OKRs totales cargados.
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
                  Aquí el Owner o HR Director podría ver estadísticas y reportes de progreso.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Wizard View */}
        {(view === "create" || view === "detail") && (
          <div className="animate-fadeIn">
            {view === "create" && (
              <Wizard
                initialOkr={okrToEdit}
                onSave={handleSaveOkr}
                onCancel={handleCancelWizard}
                mode={editingOkrId ? "edit" : "create"}
              />
            )}

            {view === "detail" && selectedOkr && (
              <OkrDetail
                okr={selectedOkr}
                onBack={() => setView("dashboard")}
                onUpdate={handleUpdateOkr}
                onEdit={() => handleEditOkr(selectedOkr)}
                onDelete={() => handleDeleteOkr(selectedOkr.id)}
                // Pasa los datos necesarios para la lógica de permisos en el detalle
                currentUser={currentUser}
                ownerIsOwner={ownerId === selectedOkr.ownerId}
                isMyManager={directManagerId === selectedOkr.ownerId}
              />
            )}
          </div>
        )}
      </main>

      {/* Monthly Report Modal */}
      {showReport && (
        <MonthlyReportModal
          okrs={myOkrs}
          user={currentUser}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

export default App;
