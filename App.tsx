import React, { useState, useEffect, useMemo } from 'react';
import { Objective, KeyResult, User } from './types';
import Wizard from './components/Wizard';
import OkrDetail from './components/OkrDetail';
import MonthlyReportModal from './components/MonthlyReport';
import { USERS, MOCK_OBJECTIVES } from './services/mockData';
import { PlusCircle, Target, Trophy, ChevronRight, FileText, CheckCircle2, XCircle, Users, Layout, Briefcase, ChevronDown, ArrowRightCircle, UserCircle2 } from 'lucide-react';

// Utility for ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

type TabView = 'my-okrs' | 'alignment' | 'team';

function App() {
  const [view, setView] = useState<'dashboard' | 'create' | 'detail'>('dashboard');
  const [activeTab, setActiveTab] = useState<TabView>('my-okrs');
  const [showReport, setShowReport] = useState(false);
  
  // User State
  const [currentUser, setCurrentUser] = useState<User>(USERS[2]); // Default to Ana (Employee)

  // Data State - Initialize with MOCK_OBJECTIVES for demo purposes (simulating DB)
  // In a real app, this would be fetched from API based on User
  const [allObjectives, setAllObjectives] = useState<Objective[]>(() => {
    const saved = localStorage.getItem('okr-master-db');
    return saved ? JSON.parse(saved) : MOCK_OBJECTIVES;
  });

  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const [editingOkrId, setEditingOkrId] = useState<string | null>(null);
  const [draftOkr, setDraftOkr] = useState<Objective | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Persistence (Simulating DB save)
  useEffect(() => {
    localStorage.setItem('okr-master-db', JSON.stringify(allObjectives));
  }, [allObjectives]);

  // Derived Data based on Current User
  const myOkrs = useMemo(() => allObjectives.filter(o => o.ownerId === currentUser.id), [allObjectives, currentUser]);
  
  const alignmentData = useMemo(() => {
    if (!currentUser.managerId) return null; // CEO has no manager
    const manager = USERS.find(u => u.id === currentUser.managerId);
    const managerOkrs = allObjectives.filter(o => o.ownerId === manager?.id);
    
    // Grandparent (CEO) logic if needed, but for now just direct manager context
    let ceoOkrs: Objective[] = [];
    if (manager?.managerId) {
       ceoOkrs = allObjectives.filter(o => o.ownerId === manager.managerId);
    }

    return { manager, managerOkrs, ceoOkrs };
  }, [allObjectives, currentUser]);

  const teamData = useMemo(() => {
    const reports = USERS.filter(u => u.managerId === currentUser.id);
    const reportsWithOkrs = reports.map(r => ({
      user: r,
      okrs: allObjectives.filter(o => o.ownerId === r.id)
    }));
    return reportsWithOkrs;
  }, [allObjectives, currentUser]);

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
      const updatedOkr: Objective = {
          ...allObjectives.find(o => o.id === editingOkrId)!,
          ...partialOkr,
          keyResults: partialOkr.keyResults.map(kr => ({ ...kr, id: kr.id || generateId() })) 
      };
      setAllObjectives(prev => prev.map(o => o.id === editingOkrId ? updatedOkr : o));
      showToast('OKR actualizado correctamente');
      setEditingOkrId(null);
    } else {
      // Create new
      const newOkr: Objective = {
        ...partialOkr,
        id: generateId(),
        ownerId: currentUser.id, // Assign to current user
        createdAt: Date.now(),
        keyResults: partialOkr.keyResults.map(kr => ({ ...kr, id: generateId() }))
      };
      setAllObjectives(prev => [newOkr, ...prev]);
      showToast('OKR creado exitosamente');
    }
    setDraftOkr(undefined);
    setView('dashboard');
  };

  const handleUpdateOkr = (updatedOkr: Objective) => {
    setAllObjectives(prev => prev.map(o => o.id === updatedOkr.id ? updatedOkr : o));
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

  const handleAdoptKr = (krTitle: string) => {
    const draft: Objective = {
        id: '', // Empty ID signals new draft
        ownerId: currentUser.id,
        title: krTitle,
        category: 'Business',
        keyResults: [],
        createdAt: 0
    };
    setDraftOkr(draft);
    setEditingOkrId(null);
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
        {onClick && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
        
        <div className="flex justify-between items-start mb-4">
          <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
            okr.category === 'Business' ? 'bg-blue-100 text-blue-700' :
            okr.category === 'Personal' ? 'bg-purple-100 text-purple-700' :
            okr.category === 'Health' ? 'bg-green-100 text-green-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {okr.category === 'Business' ? 'Negocios' : 
              okr.category === 'Personal' ? 'Personal' :
              okr.category === 'Health' ? 'Salud' : 'Aprendizaje'}
          </span>
          {onClick && <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />}
        </div>
        
        <h3 className="font-bold text-lg text-slate-800 mb-4 line-clamp-2 h-14 leading-tight">{okr.title}</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-slate-500">
              <span>Progreso general</span>
              <span className={`font-bold ${
                progress >= 70 ? 'text-emerald-600' : 
                progress >= 40 ? 'text-amber-500' : 'text-slate-600'
              }`}>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  progress >= 70 ? 'bg-emerald-500' : 
                  progress >= 40 ? 'bg-amber-500' : 'bg-indigo-500'
                }`} 
                style={{ width: `${progress}%` }}
              />
          </div>
          {!readOnly && (
            <div className="text-xs text-slate-400 pt-1 flex justify-between items-center">
              <span>{okr.keyResults.length} Key Results</span>
              {okr.lastCoaching && (
                <span className="text-indigo-600 font-medium">Feedback recibido</span>
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

  // Specific Renderer for Alignment Cards (Manager view)
  const renderAlignmentCard = (okr: Objective, canAdopt: boolean) => {
    return (
      <div key={okr.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider mb-3 ${
            okr.category === 'Business' ? 'bg-blue-100 text-blue-700' :
            okr.category === 'Personal' ? 'bg-purple-100 text-purple-700' :
            'bg-orange-100 text-orange-700'
        }`}>
           {okr.category === 'Business' ? 'Negocios' : okr.category === 'Personal' ? 'Personal' : 'Otros'}
        </span>
        <h3 className="font-bold text-lg text-slate-900 mb-6">{okr.title}</h3>
        
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resultados Clave (KRs)</h4>
          {okr.keyResults.map(kr => (
            <div key={kr.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-2">
               <div className="flex justify-between items-center text-sm">
                 <span className="font-medium text-slate-700">{kr.title}</span>
                 <span className="text-slate-500 text-xs bg-white px-2 py-1 rounded border border-slate-200">{kr.targetValue} {kr.unit}</span>
               </div>
               
               {canAdopt && (
                 <button 
                   onClick={() => handleAdoptKr(kr.title)}
                   className="mt-1 w-full text-xs font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 py-2 px-3 rounded-md border border-indigo-200 hover:border-indigo-600 transition-colors flex items-center justify-center gap-1 group"
                 >
                   <ArrowRightCircle className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
                   Adoptar como Objetivo
                 </button>
               )}
            </div>
          ))}
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
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 font-bold text-xl text-indigo-600 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => { setView('dashboard'); setEditingOkrId(null); setActiveTab('my-okrs'); }}
          >
            <Trophy className="w-6 h-6" />
            <span className="hidden sm:inline">OKR Master AI</span>
            <span className="sm:hidden">OKR AI</span>
          </div>
          <div className="flex gap-4 items-center">
            {/* User Switcher for Demo */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 pr-3">
               <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${currentUser.color}`}>
                  {currentUser.avatar}
               </div>
               <select 
                 value={currentUser.id}
                 onChange={(e) => {
                   const user = USERS.find(u => u.id === e.target.value);
                   if (user) {
                      setCurrentUser(user);
                      setView('dashboard');
                      setActiveTab('my-okrs');
                   }
                 }}
                 className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
               >
                 {USERS.map(u => (
                   <option key={u.id} value={u.id}>{u.name} - {u.role}</option>
                 ))}
               </select>
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
                onClick={() => { setEditingOkrId(null); setDraftOkr(undefined); setView('create'); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo OKR</span><span className="sm:hidden">Nuevo</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Navigation Tabs (Only visible in Dashboard view) */}
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
              <button
                onClick={() => setActiveTab('alignment')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'alignment' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Briefcase className="w-4 h-4" /> Alineación
              </button>
              {/* Only Managers show Team Tab */}
              {teamData.length > 0 && (
                <button
                    onClick={() => setActiveTab('team')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'team' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    <Users className="w-4 h-4" /> Mi Equipo
                </button>
              )}
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
                      <h1 className="text-2xl font-bold text-slate-900">Hola, {currentUser.name.split(' ')[0]}</h1>
                      <p className="text-slate-500 mt-1">Aquí están tus objetivos para este ciclo.</p>
                   </div>
                </div>

                {myOkrs.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                    <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Target className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">No tienes OKRs aún</h3>
                    <p className="text-slate-500 mt-2 mb-6 max-w-sm mx-auto">
                      Revisa la pestaña de "Alineación" para ver qué busca tu líder, o crea tu primer OKR ahora.
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
                    {myOkrs.map(okr => renderOkrCard(okr, () => { setSelectedOkrId(okr.id); setView('detail'); }))}
                  </div>
                )}
              </>
            )}

            {/* ALIGNMENT TAB */}
            {activeTab === 'alignment' && (
              <>
                <div className="mb-6">
                   <h1 className="text-2xl font-bold text-slate-900">Alineación Estratégica</h1>
                   <p className="text-slate-500 mt-1">Conecta tus esfuerzos con las metas de tu líder y la empresa.</p>
                </div>

                {!alignmentData ? (
                   <div className="p-8 bg-white rounded-xl text-center border border-slate-200">
                     <p className="text-slate-500">Eres el CEO (o no tienes manager asignado), tú defines el rumbo. No hay alineación superior.</p>
                   </div>
                ) : (
                  <>
                    {/* CEO Section (Grandparent) */}
                    {alignmentData.ceoOkrs.length > 0 && (
                        <div className="mb-10 opacity-75 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shadow-md border-2 border-white">
                            DG
                            </div>
                            <div>
                            <h2 className="text-lg font-bold text-slate-800">Dirección General</h2>
                            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Visión Global</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-l-2 border-slate-200 pl-4 md:pl-0 md:border-none">
                            {alignmentData.ceoOkrs.map(okr => renderAlignmentCard(okr, false))} 
                        </div>
                        </div>
                    )}

                    {/* Arrow Connector */}
                    {alignmentData.ceoOkrs.length > 0 && (
                        <div className="flex justify-center -mt-6 mb-6">
                        <ChevronDown className="w-8 h-8 text-slate-300" />
                        </div>
                    )}

                    {/* Manager Section */}
                    <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-md border-2 border-white ${alignmentData.manager?.color || 'bg-gray-500'}`}>
                        {alignmentData.manager?.avatar}
                        </div>
                        <div>
                        <h2 className="text-lg font-bold text-slate-800">{alignmentData.manager?.name}</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{alignmentData.manager?.role}</p>
                        </div>
                    </div>
                    
                    {alignmentData.managerOkrs.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-sm">
                            Tu líder aún no ha definido sus OKRs.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-l-2 border-indigo-200 pl-4 md:pl-0 md:border-none">
                            {alignmentData.managerOkrs.map(okr => renderAlignmentCard(okr, true))}
                        </div>
                    )}
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mt-8 flex items-center justify-between">
                    <div className="text-indigo-800 text-sm flex gap-2">
                        <ArrowRightCircle className="w-5 h-5 flex-shrink-0" />
                        <span><strong>Tip:</strong> Haz clic en "Adoptar como Objetivo" para convertir un KR de {alignmentData.manager?.name} en tu propio Objetivo usando IA.</span>
                    </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* TEAM TAB (MANAGER VIEW) */}
            {activeTab === 'team' && (
              <>
                <div className="mb-6 flex justify-between items-center">
                   <div>
                      <h1 className="text-2xl font-bold text-slate-900">Mi Equipo</h1>
                      <p className="text-slate-500 mt-1">Supervisa el progreso de tus reportes directos.</p>
                   </div>
                </div>

                <div className="space-y-8">
                  {teamData.map((data, idx) => (
                    <div key={idx} className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                      <div className="flex items-center gap-3 mb-4 border-b border-slate-200 pb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm ${data.user.color}`}>
                          {data.user.avatar}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">{data.user.name}</h3>
                          <p className="text-xs text-slate-500">{data.user.role}</p>
                        </div>
                      </div>
                      
                      {data.okrs.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No ha definido OKRs todavía.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.okrs.map(okr => renderOkrCard(okr, undefined, true))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

          </div>
        )}

        {view === 'create' && (
          <Wizard 
            initialData={okrToEdit}
            onSave={handleSaveOkr}
            onCancel={handleCancelWizard}
          />
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
        <MonthlyReportModal 
          objectives={myOkrs} // Only show MY okrs in report
          onClose={() => setShowReport(false)} 
        />
      )}
    </div>
  );
}

export default App;