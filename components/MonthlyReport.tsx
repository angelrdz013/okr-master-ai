import React, { useState } from 'react';
import { Objective } from '../types';
import { X, Printer, Copy, Send, FileText, CheckCircle2, AlertTriangle, Search, TrendingUp, Check } from 'lucide-react';

interface MonthlyReportModalProps {
  objectives: Objective[];
  onClose: () => void;
}

type OkrStatus = 'Adecuado' | 'Difícil' | 'Revisar';

const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({ objectives, onClose }) => {
  const [actionsText, setActionsText] = useState('');
  const [okrStatuses, setOkrStatuses] = useState<Record<string, OkrStatus>>({});
  const [sent, setSent] = useState(false);

  const calculateProgress = (obj: Objective) => {
    if (!obj.keyResults.length) return 0;
    const total = obj.keyResults.reduce((acc, kr) => {
       const p = Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100));
       return acc + p;
    }, 0);
    return Math.round(total / obj.keyResults.length);
  };

  const handleStatusChange = (id: string, status: OkrStatus) => {
    setOkrStatuses(prev => ({ ...prev, [id]: status }));
  };

  const getReportText = () => {
    const lines = [
      "REPORTE MENSUAL DE OKRs",
      `Periodo: ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
      "",
      "RESUMEN Y ACCIONES:",
      actionsText || "(Sin comentarios)",
      "",
      "ESTADO DE OBJETIVOS:"
    ];

    objectives.forEach(obj => {
      const progress = calculateProgress(obj);
      const status = okrStatuses[obj.id] || 'Sin calificar';
      lines.push(`- [${progress}%] ${obj.title} | Estatus: ${status}`);
      obj.keyResults.forEach(kr => {
         lines.push(`    * ${kr.title}: ${kr.currentValue} / ${kr.targetValue} ${kr.unit}`);
      });
    });

    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getReportText());
    alert('Reporte copiado al portapapeles');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSend = () => {
    // Simulate sending
    setTimeout(() => {
      setSent(true);
    }, 600);
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center flex flex-col items-center">
           <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <Check className="w-10 h-10 text-emerald-600" />
           </div>
           <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Reporte Enviado!</h2>
           <p className="text-slate-500 mb-6">Tu reporte mensual ha sido generado y procesado exitosamente.</p>
           <button 
             onClick={onClose}
             className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all w-full"
           >
             Cerrar
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden print:shadow-none print:max-w-none print:w-full flex flex-col max-h-[90vh] print:max-h-none">
        
        {/* Header - No Print */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center print:hidden flex-shrink-0">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Reporte Mensual
          </h2>
          <div className="flex gap-2">
             <button onClick={handleCopy} className="p-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all" title="Copiar texto">
               <Copy className="w-5 h-5" />
             </button>
             <button onClick={handlePrint} className="p-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all" title="Imprimir / PDF">
               <Printer className="w-5 h-5" />
             </button>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-10 print:p-8 print:overflow-visible">
            {/* Header del Reporte */}
            <div className="border-b-2 border-slate-800 pb-4 mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Reporte de Progreso</h1>
                <p className="text-slate-500 mt-1 capitalize">
                  {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="text-right hidden sm:block">
                 <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    <span>Resumen Ejecutivo</span>
                 </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Sección de Objetivos */}
              <section>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  1. Estado de los OKRs
                </h3>
                
                <div className="grid gap-6">
                  {objectives.map(obj => {
                     const progress = calculateProgress(obj);
                     const currentStatus = okrStatuses[obj.id];

                     return (
                       <div key={obj.id} className="bg-slate-50 rounded-xl p-5 border border-slate-200 print:bg-transparent print:border-b print:border-x-0 print:border-t-0 print:rounded-none">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="font-bold text-slate-900 text-lg">{obj.title}</h4>
                                  <span className={`text-lg font-bold ml-4 ${progress >= 70 ? 'text-emerald-600' : progress >= 40 ? 'text-amber-500' : 'text-slate-600'}`}>
                                    {progress}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden print:border print:border-slate-300">
                                  <div 
                                    className={`h-full rounded-full transition-all ${progress >= 70 ? 'bg-emerald-500' : progress >= 40 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                            </div>
                            
                            <div className="w-full sm:w-48 print:hidden">
                               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                 Evaluación
                               </label>
                               <select 
                                 value={currentStatus || ''}
                                 onChange={(e) => handleStatusChange(obj.id, e.target.value as OkrStatus)}
                                 className={`w-full p-2 rounded-lg border text-sm font-medium outline-none focus:ring-2 ring-offset-1 transition-colors appearance-none cursor-pointer
                                   ${currentStatus === 'Adecuado' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 focus:ring-emerald-400' : 
                                     currentStatus === 'Difícil' ? 'bg-orange-100 border-orange-300 text-orange-800 focus:ring-orange-400' : 
                                     currentStatus === 'Revisar' ? 'bg-red-100 border-red-300 text-red-800 focus:ring-red-400' : 
                                     'bg-white border-slate-300 text-slate-600 focus:ring-indigo-400 hover:border-indigo-300'}
                                 `}
                               >
                                 <option value="" disabled>Seleccionar...</option>
                                 <option value="Adecuado">✅ Adecuado</option>
                                 <option value="Difícil">⚠️ Difícil</option>
                                 <option value="Revisar">🚨 Revisar</option>
                               </select>
                            </div>
                            
                            {/* Print view for status */}
                            <div className="hidden print:block text-right">
                               <span className="text-xs font-bold text-slate-500 uppercase">Evaluación:</span>
                               <div className="font-bold text-slate-800">{currentStatus || 'No evaluado'}</div>
                            </div>
                          </div>

                          {/* Key Results Compact List */}
                          <div className="mt-3 pl-4 border-l-2 border-slate-200 space-y-1">
                             {obj.keyResults.map(kr => (
                               <div key={kr.id} className="flex justify-between text-sm">
                                  <span className="text-slate-600">{kr.title}</span>
                                  <span className="font-mono font-medium text-slate-800">{kr.currentValue} / {kr.targetValue} {kr.unit}</span>
                               </div>
                             ))}
                          </div>
                       </div>
                     );
                  })}
                </div>
              </section>

              {/* Sección de Texto Manual */}
              <section className="break-inside-avoid">
                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                   2. Acciones y Comentarios
                 </h3>
                 <div className="bg-slate-50 p-1 rounded-xl border border-slate-200 print:border-none print:p-0">
                    <textarea
                      value={actionsText}
                      onChange={(e) => setActionsText(e.target.value)}
                      placeholder="Escribe aquí las acciones clave para el próximo mes, bloqueos encontrados o comentarios generales para tu reporte..."
                      className="w-full min-h-[150px] p-4 bg-white text-slate-900 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y text-base leading-relaxed print:border print:border-slate-300"
                    />
                 </div>
              </section>
            </div>
        </div>

        {/* Footer Actions - No Print */}
        <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 flex-shrink-0 print:hidden">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSend}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-1px]"
            >
              <Send className="w-4 h-4" />
              Enviar Reporte
            </button>
        </div>

      </div>
    </div>
  );
};

export default MonthlyReportModal;