// types.ts

export interface KeyResult {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string; // e.g., "%", "users", "USD"
}

export interface Objective {
  id: string;
  ownerId: string; // ID of the user who owns this OKR
  title: string;
  description?: string;
  keyResults: KeyResult[];
  createdAt: number;
  lastCoaching?: string;
  category: "Business";
}

// 👇 NUEVO: tipo para el rol dentro de la app
export type AppRole = "owner" | "manager" | "employee";

export interface User {
  id: string;
  name: string;
  role: string;      // Job title (lo que ya usas: "HR Director", "CEO", etc.)
  avatar: string;    // Initials
  color: string;     // Tailwind color class
  managerId: string | null; // ID of the user's manager

  // 👇 NUEVO: rol en la herramienta (permisos/pestañas)
  appRole: AppRole;
}

export interface AISuggestion {
  objectiveTitle: string;
  keyResults: {
    title: string;
    targetValue: number;
    unit: string;
  }[];
}

export interface AICoaching {
  status: "On Track" | "At Risk" | "Off Track";
  summary: string;
  tips: string[];
}

export interface MonthlyReport {
  executiveSummary: string;
  nextMonthActions: string[];
  adjustments: {
    objectiveId: string | null; // null if general advice
    suggestion: string;
    reason: string;
  }[];
}
