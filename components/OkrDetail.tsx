import React, { useState } from 'react';
import { Objective, AICoaching } from '../types';
import { getOkrCoaching } from '../services/geminiService';
import { ArrowLeft, Target, TrendingUp, Brain, CheckCircle2, AlertTriangle, Loader2, Pencil } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface OkrDetailProps {
  objective: Objective;
  onBack: () => void;
  onUpdate: (updatedObjective: Objective) => void;
  onDelete: (id: string) => void;
  onEdit: (objective: Objective) => void;
}

const OkrDetail: React.FC<OkrDetailProps> = ({ objective, onBack, onUpdate, onDelete, onEdit }) => {
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingData, setCoachingData] = useState<AICoaching | null>(null);
  const [localObjective, setLocalObjective] = useState<Objective>(objective);

  const calculateProgress = (curr: number, target: number) => {
    return Math.min(100, Math.max(0, (curr / target) * 100));
  };

  const overallProgress = localObjective.keyResults.reduce((acc, kr) => 
    acc + calculateProgress(kr.currentValue, kr.targetValue), 0
  ) / (localObjective.keyResults.length || 1);

  const handleKrChange = (krId: string, newValue: number) => {
    const updatedKrs = localObjective.keyResults.map(kr => 
      kr.id === krId ? { ...kr, currentValue: newValue } : kr
    );
    const newObj = { ...localObjective, keyResults: updatedKrs };
    setLocalObjective(newObj);
    onUpdate(newObj);
  };

  const fetchCoaching = async () => {
    setCoachingLoading(true);
    try {
      const advice = await getOkrCoaching(localObjective);
      setCoachingData(advice);
      const newObj = { ...localObjective, lastCoaching: new Date().toISOString() };
      setLocalObjective(newObj);
      onUpdate(newObj);
    } catch (e) {
      alert("Error al obtener coaching. Intenta de nuevo.");
    } finally {
      setCoachingLoading(false);
    }
  };

  const chartData = localObjective.keyResults.map(kr => ({
    name: kr.title.length > 15 ? kr.title.substring(0, 15) + '...' : kr.title,
    progress: calculateProgress(kr.currentValue, kr.targetValue)
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button 
          onClick={onBack}
          className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Dashboard
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 relative">
        {/* Edit Button */}
        <button 
           onClick={() => onEdit(localObjective)}
           className="absolute top-6 right-6 p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
           title="Editar OKR"
        >
           <Pencil className="w-5 h-5" />
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="pr-12">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
              localObjective.category === 'Business' ? 'bg-blue-100 text-blue-700' :
              localObjective.category === 'Personal' ? 'bg-purple-100 text-purple-700' :
              localObjective.category === 'Health' ? 'bg-green-100 text-green-700' :
              'bg-orange-100 text-orange-700'
            }`}>
              {localObjective.category === 'Business' ? 'Negocios' :
               localObjective.category === 'Personal' ? 'Personal' :
               localObjective.category === 'Health' ? 'Salud' : 'Aprendizaje'}
            </span>
            <h1 className="text-3xl font-bold text-slate-900 leading-tight">{localObjective.title}</h1>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm text-slate-500 mb-1">Progreso Total</div>
            <div className={`text-3xl font-bold ${
              overallProgress >= 70 ? 'text-emerald-600' : overallProgress >= 40 ? 'text-amber-500' : 'text-slate-600'
            }`}>
              {Math.round(overallProgress)}%
            </div>
          </div>
        </div>

        {/* Interactive KRs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" /> Resultados Clave
            </h3>
            {localObjective.keyResults.map((kr) => {
              const p = calculateProgress(kr.currentValue, kr.targetValue);
              return (
                <div key={kr.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-slate-700 text-sm">{kr.title}</span>
                    <span className="text-xs font-bold text-slate-500">
                      {kr.currentValue} / {kr.targetValue} {kr.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={kr.targetValue}
                    step={kr.targetValue / 100} // finer grain
                    value={kr.currentValue}
                    onChange={(e) => handleKrChange(kr.id, Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                   <div className="mt-2 flex justify-end">
                      <input 
                        type="number"
                        value={kr.currentValue}
                        onChange={(e) => handleKrChange(kr.id, Number(e.target.value))}
                        className="w-20 text-right text-sm border border-slate-300 rounded p-1 bg-white text-slate-900"
                      />
                   </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <TrendingUp className="w-5 h-5 text-indigo-500" /> Visualización
            </h3>
            <div className="h-64 bg-slate-50 rounded-xl p-4 border border-slate-100">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.progress > 70 ? '#10b981' : entry.progress > 30 ? '#f59e0b' : '#64748b'} />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <button 
             onClick={() => onDelete(localObjective.id)}
             className="text-red-500 hover:text-red-700 text-sm font-medium px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
           >
             Eliminar OKR
           </button>
           
           <button
             onClick={fetchCoaching}
             disabled={coachingLoading}
             className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
           >
             {coachingLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <Brain className="w-5 h-5" />}
             {coachingLoading ? "Analizando..." : "Obtener Feedback de IA"}
           </button>
        </div>
      </div>

      {/* AI Coaching Section */}
      {coachingData && (
        <div className="bg-white rounded-2xl shadow-xl border-l-4 border-emerald-500 p-6 md:p-8 animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
               <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Análisis del Coach IA</h3>
              <p className="text-slate-500 text-sm">Estado actual: <span className="font-semibold text-slate-900">{coachingData.status}</span></p>
            </div>
          </div>
          
          <div className="prose prose-slate max-w-none">
             <p className="text-slate-700 text-lg mb-4">{coachingData.summary}</p>
             
             <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide mb-3">Recomendaciones:</h4>
             <ul className="space-y-3">
               {coachingData.tips.map((tip, i) => (
                 <li key={i} className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                    {coachingData.status === 'On Track' ? 
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /> : 
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    }
                    <span className="text-slate-700">{tip}</span>
                 </li>
               ))}
             </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default OkrDetail;