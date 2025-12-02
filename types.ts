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
  category: 'Business';
}

export interface User {
  id: string;
  name: string;
  role: string;
  avatar: string; // Initials
  color: string; // Tailwind color class
  managerId: string | null; // ID of the user's manager
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
  status: 'On Track' | 'At Risk' | 'Off Track';
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
