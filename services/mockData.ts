import { Objective, User } from '../types';

// Users Definition
export const USERS: User[] = [
  {
    id: 'u-ceo',
    name: 'Elena (CEO)',
    role: 'Director General',
    avatar: 'EG',
    color: 'bg-slate-800 text-white',
    managerId: null
  },
  {
    id: 'u-manager',
    name: 'Carlos (Manager)',
    role: 'Head of Product',
    avatar: 'CR',
    color: 'bg-indigo-600 text-white',
    managerId: 'u-ceo'
  },
  {
    id: 'u-user',
    name: 'Ana (Tú)',
    role: 'Product Designer',
    avatar: 'AG',
    color: 'bg-pink-600 text-white',
    managerId: 'u-manager'
  }
];

// OKRs Database
export const MOCK_OBJECTIVES: Objective[] = [
  // CEO OKRs
  {
    id: 'ceo-1',
    ownerId: 'u-ceo',
    title: 'Dominar el mercado Latinoamericano en 2024',
    category: 'Business',
    createdAt: Date.now(),
    keyResults: [
      { id: 'kr-ceo-1', title: 'Alcanzar $10M en Ingresos Recurrentes (ARR)', targetValue: 10, currentValue: 6.5, unit: 'M' },
      { id: 'kr-ceo-2', title: 'Abrir operaciones en 3 nuevos países', targetValue: 3, currentValue: 1, unit: 'Países' }
    ]
  },
  {
    id: 'ceo-2',
    ownerId: 'u-ceo',
    title: 'Construir una cultura organizacional de clase mundial',
    category: 'Business',
    createdAt: Date.now(),
    keyResults: [
      { id: 'kr-ceo-3', title: 'Employee Net Promoter Score > 50', targetValue: 50, currentValue: 42, unit: 'NPS' }
    ]
  },

  // Manager OKRs
  {
    id: 'mgr-1',
    ownerId: 'u-manager',
    title: 'Escalar la plataforma de producto para soportar expansión regional',
    category: 'Business',
    createdAt: Date.now(),
    keyResults: [
      { id: 'kr-mgr-1', title: 'Reducir latencia del sistema en 50%', targetValue: 50, currentValue: 20, unit: '%' },
      { id: 'kr-mgr-2', title: 'Lanzar localización para 3 nuevos países', targetValue: 3, currentValue: 1, unit: 'Países' }
    ]
  },
  {
    id: 'mgr-2',
    ownerId: 'u-manager',
    title: 'Desarrollar un equipo de producto de alto rendimiento',
    category: 'Learning',
    createdAt: Date.now(),
    keyResults: [
      { id: 'kr-mgr-3', title: '100% del equipo completando curso de OKRs', targetValue: 100, currentValue: 60, unit: '%' }
    ]
  },

  // User OKRs (Ana) - Initial Mock
  {
    id: 'ana-1',
    ownerId: 'u-user',
    title: 'Rediseñar la experiencia de onboarding para nuevos mercados',
    category: 'Business',
    createdAt: Date.now(),
    keyResults: [
      { id: 'kr-ana-1', title: 'Aumentar conversión de registro a activo', targetValue: 25, currentValue: 12, unit: '%' }
    ]
  }
];

// Helper to get data based on context
export const getObjectivesByOwner = (ownerId: string) => MOCK_OBJECTIVES.filter(o => o.ownerId === ownerId);
export const getUserById = (id: string) => USERS.find(u => u.id === id);
