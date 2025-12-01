import { supabase } from "./supabaseClient";
import { LogOut } from "lucide-react";
import React, { useState, useEffect, useMemo } from 'react';
import { Objective, User } from './types';
import Wizard from './components/Wizard';
import OkrDetail from './components/OkrDetail';
import MonthlyReportModal from './components/MonthlyReport';
import { PlusCircle, Target, Trophy, ChevronRight, FileText, CheckCircle2, XCircle, Layout } from 'lucide-react';

// Utility for ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

type TabView = 'my-okrs';

// Usuario único por defecto (ajusta nombre/rol/color/avatar a tu gusto)
const DEFAULT_USER: User = {
  id: 'current-user',
  name: 'Mi usuario',
  role: 'Owner',
  managerId: null,
  color: 'bg-indigo-600',
  avatar: 'MU',
};

function App() {
  const [view, setView] = useState<'dashboard' | 'create' | 'detail'>('dashboard');
  const [activeTab, setActiveTab] = useState<TabView>('my-okrs');
  const [showReport, setShowReport] = useState(false);

  // User State: un solo usuario
  const [currentUser] = useState<User>(DEFAULT_USER);

  // Data State - solo localStorage; si no hay nada, arranca vacío
  const [allObjectives, setAllObjectives] = useState<Objective[]>(() => {
    const saved = localStorage.getItem('okr-master-db');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const [editingOkrId, setEditingOkrId] = useState<string | null>(null);
  const [draftOkr, setDraftOkr] = useState<Objective | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('okr-master-db', JSON.stringify(allObjectives));
  }, [allObjectives]);

  // Mis OKRs (solo del usuario actual)
  const myOkrs = useMemo(
    () => allObjectives.filter(o => o.ownerId === currentUser.id),
    [allObjectives, currentUser]
  );

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleSaveOkr = (partialOkr: Omit<Objective, 'id' | 'createdAt' | 'lastCoaching'>) => {
    if (editingOkrId) {
      // Update existing
      const existing = allObjectives.find(o => o.id === editingOkrId);
      if (!existing) return;

      const updatedOkr: Objective = {
        ...existing,
        ...partialOkr,
        keyResults: partialOkr.keyResults.map(kr => ({ ...kr, id: kr.id || generateId() })),
      };
      setAllObjectives(prev => prev.map(o => (o.id === editingOkrId ? updatedOkr : o)));
      showToast('OKR actualizado correctamente');
      setEditingOkrId(null);
    } else {
      // Create new
      const newOkr: Objective = {
        ...partialOkr,
        id: generateId(),
        ownerId: currentUser.id,
        createdAt: Date.now(),
        keyResults: partialOkr.keyResults.map(kr => ({ ...kr, id: generateId() })),
      };
      setAllObjectives(prev => [newOkr, ...prev]);
      showToast('OKR creado exitosamente');
    }
    setDraftOkr(undefined);
    setView('dashboard');
  };

  const handleUpdateOkr = (updatedOkr: Objective) => {
    setAllObjectives(prev => prev.map(o => (o.id === updatedOkr.id ? updatedOkr : o)));
  };

  const handleDeleteOkr = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este OKR?')) {
      setAllObjectives(prev => prev.filter(o => o.id !== id));
      setView('dashboard');
      setSelectedOkrId(null);
      showToast('OKR eliminado');
    }
  };

  const handleEditOkr = (okr: Objective) => {
    setEditingOkrId(okr.id);
    setView('create');
  };

  const handleCancelWizard = () => {
    setEditingOkrId(null);
    setDraftOkr(undefined);
    setView(editingOkrId ? 'detail' : 'dashboard');
  };

  const calculateProgress = (objective: Objective) => {
    if (objective.keyResults.length === 0) return 0;
    const total = objective.keyResults.reduce((acc, kr) => {
      const p = Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100));
      return acc + p;
    }, 0);
    return Math.round(total / objective.keyResults.length);
  };

  const selectedOkr = allObjectives.find(o => o.id === selectedOkrId);
  const okrToEdit = editingOkrId ? allObjectives.find(o => o.id === editingOkrId) : draftOkr;

  // Render Helper for OKR Card
  const renderOkrCard = (okr: Objective, onClick?: () => void, readOnly: boolean = false) => {
    const progress = calculateProgress(okr);
    return (
      <div
        key={okr.id}
        onClick={onClick}
        className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all relative overflow-hidden group
          ${onClick ? 'hover:shadow-md hover:border-indigo-300 cursor-pointer' : ''}`}
      >
        {onClick && (
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}

        <div className="flex justify-between items-start mb-4">
          <span
            className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
              okr.category === 'Business'
                ? 'bg-blue-100 text-blue-700'
                : okr.category === 'Personal'
                ? 'bg-purple-100 text-purple-700'
                : okr.category === 'Health'
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            {okr.category === 'Business'
              ? 'Negocios'
              : okr.category === 'Personal'
              ? 'Personal'
              : okr.category === 'Health'
              ? 'Salud'
              : 'Aprendizaje'}
          </span>
          {onClick && <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />}
        </div>

        <h3 className="font-bold text-lg text-slate-800 mb-4 line-clamp-2 h-14 leading-tight">{okr.title}</h3>

        <div className="space-y-3">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Progreso general</span>
            <span
              className={`font-bold ${
                progress >= 70 ? 'text-emerald-600' : progress >= 40 ? 'text-amber-500' : 'text-slate-600'
              }`}
            >
              {progress}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                progress >= 70 ? 'bg-emerald-500' : progress >= 40 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {!readOnly && (
            <div className="text-xs text-slate-400 pt-1 flex justify-between items-center">
              <span>{okr.keyResults.length} Key Results</span>
              {okr.lastCoaching && <span className="text-indigo-600 font-medium">Feedback recibido</span>}
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
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white font-medium text-sm animate-fadeIn ${
              toast.type === 'success' ? 'bg-slate-800' : 'bg-red-500'
            }`}
          >
            {toast.type === 'success' ? (
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
              setView('dashboard');
              setEditingOkrId(null);
              setActiveTab('my-okrs');
            }}
          >
            <Trophy className="w-6 h-6" />
            <span className="hidden sm:inline">OKR Master AI</span>
            <span className="sm:hidden">OKR AI</span>
          </div>
          <div className="flex gap-4 items-center">
            {/* User info simple */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1">
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${currentUser.color}`}
              >
                {currentUser.avatar}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">{currentUser.name}</span>
                <span className="text-[11px] text-slate-500">{currentUser.role}</span>
              </div>
            </div>

            {view === 'dashboard' && myOkrs.length > 0 && activeTab === 'my-okrs' && (
              <button
                onClick={() => setShowReport(true)}
                className="text-slate-600 hover:text-indigo-600 text-sm font-medium py-2 px-3 rounded-lg flex items-center gap-2 transition-colors border border-transparent hover:border-slate-200 hover:bg-slate-50"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Reporte</span>
              </button>
            )}
            {view === 'dashboard' && activeTab === 'my-okrs' && (
              <button
                onClick={() => {
                  setEditingOkrId(null);
                  setDraftOkr(undefined);
                  setView('create');
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo OKR</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs (solo Mis OKRs) */}
        {view === 'dashboard' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-6 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('my-okrs')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'my-okrs'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Layout className="w-4 h-4" /> Mis OKRs ({myOkrs.length})
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* MY OKRS TAB */}
            {activeTab === 'my-okrs' && (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      Hola, {currentUser.name.split(' ')[0]}
                    </h1>
                    <p className="text-slate-500 mt-1">
                      Aquí están tus objetivos para este ciclo.
                    </p>
                  </div>
                </div>

                {myOkrs.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                    <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Target className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">No tienes OKRs aún</h3>
                    <p className="text-slate-500 mt-2 mb-6 max-w-sm mx-auto">
                      Crea tu primer OKR y deja que la IA te ayude a aterrizar tus metas.
                    </p>
                    <button
                      onClick={() => setView('create')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all hover:-translate-y-0.5"
                    >
                      Crear mi primer OKR
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myOkrs.map(okr =>
                      renderOkrCard(okr, () => {
                        setSelectedOkrId(okr.id);
                        setView('detail');
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === 'create' && (
          <Wizard initialData={okrToEdit} onSave={handleSaveOkr} onCancel={handleCancelWizard} />
        )}

        {view === 'detail' && selectedOkr && (
          <OkrDetail
            objective={selectedOkr}
            onBack={() => setView('dashboard')}
            onUpdate={handleUpdateOkr}
            onDelete={handleDeleteOkr}
            onEdit={handleEditOkr}
          />
        )}
      </main>

      {showReport && (
        <MonthlyReportModal objectives={myOkrs} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

export default App;
