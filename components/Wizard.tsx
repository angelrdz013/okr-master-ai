import React, { useState, useEffect } from 'react';
import { generateOkrSuggestion, transformKrToObjective } from '../services/geminiService';
import { AISuggestion, KeyResult, Objective } from '../types';
import { Sparkles, Plus, Trash2, Save, Loader2, HelpCircle, X, ChevronLeft, ChevronRight, Target, Flag, TrendingUp, ArrowRightCircle } from 'lucide-react';

interface WizardProps {
  onSave: (objective: Omit<Objective, 'id' | 'createdAt' | 'lastCoaching'>) => void;
  onCancel: () => void;
  initialData?: Objective;
}

const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      title: "¿Qué es un OKR?",
      desc: "OKR significa Objetivos y Resultados Clave. Es una fórmula simple para establecer metas ambiciosas y saber exactamente si las estás logrando.",
      visual: (
        <div className="flex flex-col items-center justify-center h-40 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-4 rounded-xl text-center w-24">
              <span className="block text-2xl font-bold text-indigo-700">O</span>
              <span className="text-xs text-indigo-600 font-medium">Objetivo</span>
            </div>
            <span className="text-2xl font-bold text-slate-300">+</span>
            <div className="bg-emerald-100 p-4 rounded-xl text-center w-24">
              <span className="block text-2xl font-bold text-emerald-700">KR</span>
              <span className="text-xs text-emerald-600 font-medium">Resultados</span>
            </div>
          </div>
          <div className="text-sm text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            La metodología de Google, Intel y LinkedIn.
          </div>
        </div>
      )
    },
    {
      title: "El Objetivo (El QUÉ)",
      desc: "Es el sueño. Debe ser cualitativo, inspirador y ambicioso. No contiene números. Nos dice hacia dónde vamos. Tip: Mantén entre 3 y 5 objetivos por trimestre para asegurar el foco.",
      visual: (
        <div className="flex flex-col items-center justify-center h-40">
           <Flag className="w-16 h-16 text-red-500 mb-2" />
           <div className="bg-red-50 text-red-800 px-4 py-2 rounded-lg text-sm font-medium">
             "Convertirnos en la marca #1 de café"
           </div>
        </div>
      )
    },
    {
      title: "Resultados Clave (El CÓMO)",
      desc: "Son las métricas de éxito. Deben ser cuantitativos y medibles. Si no tiene un número, no es un Resultado Clave. Tip: Define de 3 a 5 resultados clave por cada objetivo.",
      visual: (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
           <div className="w-full max-w-[200px] space-y-2">
             <div className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 p-2 rounded shadow-sm">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Vender $50k / mes</span>
             </div>
             <div className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 p-2 rounded shadow-sm">
                <Target className="w-4 h-4 text-indigo-500" />
                <span>Abrir 3 sucursales</span>
             </div>
           </div>
        </div>
      )
    },
    {
      title: "Así se ve un OKR completo",
      desc: "La magia ocurre cuando unes el sueño con los números. Tienes una dirección clara y pasos concretos para llegar ahí.",
      visual: (
        <div className="flex items-center justify-center h-40 w-full">
            <div className="w-full max-w-[280px] bg-white border border-slate-200 rounded-xl shadow-md p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <div className="flex items-start gap-2 border-b border-slate-100 pb-3">
                    <Flag className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Objetivo</span>
                        <p className="text-sm font-bold text-slate-800 leading-tight">Ser la marca de ropa favorita de la Gen Z</p>
                    </div>
                </div>
                <div className="space-y-2 pl-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></div>
                        <span className="font-medium">KR1:</span>
                        <span>50k seguidores en TikTok</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></div>
                         <span className="font-medium">KR2:</span>
                        <span>Lanzar colección 'Eco'</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></div>
                         <span className="font-medium">KR3:</span>
                        <span>$100k ventas online</span>
                    </div>
                </div>
            </div>
        </div>
      )
    },
    {
      title: "Cómo bajan en cascada",
      desc: "Los OKRs alinean a toda la organización. El Resultado Clave de la empresa se convierte en el Objetivo del equipo.",
      visual: (
        <div className="flex flex-col items-center justify-center h-40 relative">
           {/* Diagrama de cascada */}
           <div className="border border-indigo-200 bg-indigo-50 p-2 rounded text-xs font-bold text-indigo-800 w-32 text-center mb-1">
             Empresa: Crecer 20%
           </div>
           <div className="h-6 w-0.5 bg-slate-300"></div>
           <div className="flex gap-4 relative">
              {/* Conectores */}
              <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-20 h-4 border-t-2 border-slate-300"></div>
              
              <div className="flex flex-col items-center">
                 <div className="h-2 w-0.5 bg-slate-300"></div>
                 <div className="border border-slate-200 bg-white p-1.5 rounded text-[10px] font-medium text-slate-600 w-24 text-center">
                   Mkt: 5k Leads
                 </div>
              </div>
              <div className="flex flex-col items-center">
                 <div className="h-2 w-0.5 bg-slate-300"></div>
                 <div className="border border-slate-200 bg-white p-1.5 rounded text-[10px] font-medium text-slate-600 w-24 text-center">
                   Ventas: Cerrar 100
                 </div>
              </div>
           </div>
        </div>
      )
    },
    {
      title: "Agilidad vs. Metas Tradicionales",
      desc: "A diferencia de las metas anuales fijas (SMART) que se revisan una vez al año, los OKRs son ágiles. Se revisan semanalmente para adaptarse y ganar.",
      visual: (
        <div className="flex gap-2 items-center justify-center h-40 w-full px-2">
           <div className="flex-1 flex flex-col items-center opacity-60 scale-90">
              <div className="w-16 h-16 border-2 border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 mb-2">
                 <div className="h-0.5 w-10 bg-slate-400 rotate-[-10deg]"></div>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase">Metas Fijas</span>
              <span className="text-[10px] text-slate-400 text-center leading-tight mt-1">"Cumplir o fallar"<br/>Revisión Anual</span>
           </div>
           
           <div className="text-indigo-200">
             <ChevronRight className="w-8 h-8" />
           </div>

           <div className="flex-1 flex flex-col items-center">
              <div className="w-20 h-20 border-2 border-indigo-500 rounded-xl flex items-center justify-center bg-indigo-50 mb-2 shadow-sm relative overflow-hidden group">
                 <TrendingUp className="w-8 h-8 text-indigo-600 z-10 group-hover:scale-110 transition-transform" />
                 <div className="absolute bottom-0 w-full h-1/2 bg-indigo-100/50"></div>
              </div>
              <span className="text-xs font-bold text-indigo-700 uppercase">OKRs</span>
              <span className="text-[10px] text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full mt-1 font-medium">Revisión Semanal</span>
           </div>
        </div>
      )
    }
  ];

  const nextSlide = () => {
    if (slide < slides.length - 1) setSlide(slide + 1);
    else onClose();
  };

  const prevSlide = () => {
    if (slide > 0) setSlide(slide - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-bold text-slate-800">Cómo funcionan los OKRs</h3>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
             <X className="w-5 h-5" />
           </button>
        </div>
        
        <div className="p-6 flex-1 flex flex-col items-center text-center">
          <div className="mb-6 w-full bg-slate-50 rounded-xl p-4 border border-slate-100 min-h-[180px] flex items-center justify-center">
             {slides[slide].visual}
          </div>
          
          <h4 className="text-xl font-bold text-slate-900 mb-2">{slides[slide].title}</h4>
          <p className="text-slate-600 text-sm leading-relaxed">{slides[slide].desc}</p>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
           <div className="flex gap-1">
             {slides.map((_, i) => (
               <div key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-300'}`} />
             ))}
           </div>
           
           <div className="flex gap-2">
             {slide > 0 && (
               <button onClick={prevSlide} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
                 <ChevronLeft className="w-5 h-5" />
               </button>
             )}
             <button 
                onClick={nextSlide} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-1 transition-colors"
             >
               {slide === slides.length - 1 ? "Entendido" : "Siguiente"}
               {slide < slides.length - 1 && <ChevronRight className="w-4 h-4" />}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const Wizard: React.FC<WizardProps> = ({ onSave, onCancel, initialData }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [adoptionMode, setAdoptionMode] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [category, setCategory] = useState<Objective['category']>('Business');
  
  // Form State
  const [title, setTitle] = useState('');
  const [krs, setKrs] = useState<Omit<KeyResult, 'id'>[]>([]);

  // Is editing an existing one?
  const isEditing = initialData && initialData.id !== '';

  // Load initial data
  useEffect(() => {
    if (initialData) {
      if (initialData.id === '') {
        // Mode: Adopting a Draft
        setAdoptionMode(true);
        setTitle(initialData.title); // Store the raw KR here
        setCategory(initialData.category);
      } else {
        // Mode: Editing Existing
        setTitle(initialData.title);
        // We keep the IDs if we are editing, but for the form state we treat them as part of the list
        setKrs(initialData.keyResults); 
        setCategory(initialData.category);
        setStep(2);
      }
    }
  }, [initialData]);

  const handleAiGenerate = async () => {
    if (!userInput.trim()) return;
    setLoading(true);
    try {
      const suggestion: AISuggestion = await generateOkrSuggestion(userInput);
      setTitle(suggestion.objectiveTitle);
      setKrs(suggestion.keyResults.map(kr => ({ ...kr, currentValue: 0 })));
      setStep(2);
    } catch (err) {
      alert("Hubo un error conectando con la IA. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleAiTransform = async () => {
    setLoading(true);
    try {
      // title currently holds the raw KR text from the adoption flow
      const suggestion: AISuggestion = await transformKrToObjective(title);
      setTitle(suggestion.objectiveTitle);
      setKrs(suggestion.keyResults.map(kr => ({ ...kr, currentValue: 0 })));
      setAdoptionMode(false);
      setStep(2);
    } catch (err) {
      alert("Hubo un error conectando con la IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdoption = () => {
    // Keep the title as is (the KR text becomes the Objective text)
    setKrs([{ title: '', targetValue: 100, unit: '%', currentValue: 0 }]);
    setAdoptionMode(false);
    setStep(2);
  };

  const handleManualStart = () => {
    setTitle(userInput);
    setKrs([{ title: '', targetValue: 100, unit: '%', currentValue: 0 }]);
    setStep(2);
  };

  const addKr = () => {
    setKrs([...krs, { title: '', targetValue: 100, unit: '%', currentValue: 0 }]);
  };

  const removeKr = (index: number) => {
    setKrs(krs.filter((_, i) => i !== index));
  };

  const updateKr = (index: number, field: keyof Omit<KeyResult, 'id'>, value: string | number) => {
    const newKrs = [...krs];
    // We preserve the ID if it exists (for editing)
    newKrs[index] = { ...newKrs[index], [field]: value };
    setKrs(newKrs);
  };

  const handleSave = () => {
    if (!title || krs.length === 0) return;
    onSave({
      title,
      keyResults: krs as KeyResult[], 
      category,
      ownerId: '' // The parent app will assign the real owner ID
    });
  };

  if (adoptionMode) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-indigo-600 p-6 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightCircle className="w-6 h-6" />
            Adoptar Resultado Clave
          </h2>
          <p className="opacity-90 mt-1">Convierte el KR de tu líder en tu nuevo Objetivo.</p>
        </div>
        <div className="p-8 space-y-8">
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">KR Original a Adoptar:</span>
              <p className="text-lg font-bold text-slate-900 mt-1">{title}</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={handleAiTransform}
                disabled={loading}
                className="flex flex-col items-center justify-center p-6 border-2 border-indigo-100 hover:border-indigo-500 rounded-xl bg-indigo-50/30 hover:bg-indigo-50 transition-all text-center group"
              >
                 <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                   {loading ? <Loader2 className="w-6 h-6 animate-spin"/> : <Sparkles className="w-6 h-6"/>}
                 </div>
                 <h3 className="font-bold text-indigo-700 mb-1">Mejorar con IA</h3>
                 <p className="text-sm text-slate-600">Transformar en un Objetivo Ambicioso y sugerir nuevos KRs.</p>
              </button>

              <button 
                onClick={handleManualAdoption}
                className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 hover:border-slate-400 rounded-xl bg-white hover:bg-slate-50 transition-all text-center group"
              >
                 <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                   <Target className="w-6 h-6"/>
                 </div>
                 <h3 className="font-bold text-slate-800 mb-1">Usar texto literal</h3>
                 <p className="text-sm text-slate-500">Copiar el texto tal cual y definir mis KRs manualmente.</p>
              </button>
           </div>

           <div className="flex justify-start">
             <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 font-medium text-sm">Cancelar</button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              {isEditing ? 'Editar OKR' : 'Creador de OKRs'}
            </h2>
            <p className="opacity-90 mt-1">{isEditing ? 'Refina tu estrategia.' : 'Define tus metas ambiciosas.'}</p>
          </div>
          <button 
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 text-xs font-medium bg-indigo-500/50 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg border border-indigo-400 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            ¿Cómo funcionan?
          </button>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ¿Qué quieres lograr? (Describe tu idea)
                </label>
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Ej: Quiero aumentar las ventas de mi tienda online o Quiero ponerme en forma para el verano..."
                  className="w-full h-32 p-4 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900"
                    >
                      <option value="Business">Negocios</option>
                      <option value="Personal">Personal</option>
                      <option value="Learning">Aprendizaje</option>
                      <option value="Health">Salud</option>
                    </select>
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleAiGenerate}
                  disabled={loading || !userInput.trim()}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {loading ? "Generando ideas..." : "Generar con IA"}
                </button>
                <button
                  onClick={handleManualStart}
                  disabled={loading}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-50 font-medium rounded-xl border border-slate-200 transition-colors"
                >
                  Hacerlo Manual
                </button>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm mt-4">
                <strong>Tip:</strong> Un OKR consta de un <em>Objetivo</em> (El QUÉ: cualitativo y ambicioso) y <em>Resultados Clave</em> (El CÓMO: cuantitativos y medibles).
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Objetivo
                </label>
                {/* Changed from Input to Textarea */}
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xl font-bold text-slate-900 border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white resize-y shadow-sm"
                  placeholder="Escribe un objetivo inspirador..."
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Resultados Clave (Métricas)
                  </label>
                </div>
                
                {krs.map((kr, idx) => (
                  <div key={idx} className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-indigo-200 transition-colors">
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={kr.title}
                        onChange={(e) => updateKr(idx, 'title', e.target.value)}
                        placeholder="Ej: Alcanzar $50k en ingresos..."
                        className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 resize-y min-h-[60px]"
                        rows={2}
                      />
                      <div className="flex gap-2 items-center text-xs text-slate-500">
                        <span>Meta:</span>
                        <input
                          type="number"
                          value={kr.targetValue}
                          onChange={(e) => updateKr(idx, 'targetValue', Number(e.target.value))}
                          className="w-20 bg-white text-slate-900 border border-slate-200 rounded px-2 py-1 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          value={kr.unit}
                          onChange={(e) => updateKr(idx, 'unit', e.target.value)}
                          className="w-16 bg-white text-slate-900 border border-slate-200 rounded px-2 py-1 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder="Unidad"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => removeKr(idx)}
                      className="text-slate-400 hover:text-red-500 p-2 mt-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={addKr}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Plus className="w-4 h-4" /> Agregar Resultado Clave
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  onClick={onCancel}
                  className="px-6 py-2 text-slate-600 hover:bg-slate-50 font-medium rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Save className="w-4 h-4" /> {isEditing ? 'Actualizar OKR' : 'Guardar OKR'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </>
  );
};

export default Wizard;