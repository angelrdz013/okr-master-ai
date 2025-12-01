import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Objective, AISuggestion, AICoaching, MonthlyReport } from "../types";

const apiKey = process.env.API_KEY;

// Initialize blindly as per instructions (assuming env var exists)
const ai = new GoogleGenAI({ apiKey: apiKey });

const suggestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    objectiveTitle: {
      type: Type.STRING,
      description: "A refined, ambitious, and qualitative objective title.",
    },
    keyResults: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Specific, measurable result." },
          targetValue: { type: Type.NUMBER, description: "Numeric target." },
          unit: { type: Type.STRING, description: "Unit of measurement (%, $, #, etc)." },
        },
        required: ["title", "targetValue", "unit"],
      },
    },
  },
  required: ["objectiveTitle", "keyResults"],
};

const coachingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ["On Track", "At Risk", "Off Track"],
      description: "Current status based on progress.",
    },
    summary: { type: Type.STRING, description: "Brief analysis of the situation." },
    tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Actionable advice to improve.",
    },
  },
  required: ["status", "summary", "tips"],
};

const reportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description: "A professional executive summary of the overall progress for the month.",
    },
    nextMonthActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 specific, high-impact actions planned for next month.",
    },
    adjustments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          objectiveId: { type: Type.STRING, description: "The ID of the objective relating to the suggestion, or null if general." },
          suggestion: { type: Type.STRING, description: "Recommendation to adjust target up or down." },
          reason: { type: Type.STRING, description: "Why this adjustment is needed (e.g., too easy, unrealistic)." },
        },
        required: ["suggestion", "reason"],
      },
      description: "Suggestions to adjust OKRs if they are too easy or too hard.",
    },
  },
  required: ["executiveSummary", "nextMonthActions", "adjustments"],
};

export const generateOkrSuggestion = async (userInput: string): Promise<AISuggestion> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    Actúa como un experto mundial en OKRs (Objetivos y Resultados Clave).
    El usuario quiere crear un OKR basado en esta idea: "${userInput}".
    
    1. Refina el objetivo para que sea inspirador y cualitativo.
    2. Sugiere 3 resultados clave (Key Results) que sean cuantitativos, medibles y difíciles pero alcanzables.
    Responde en Español.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestionSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as AISuggestion;
  } catch (error) {
    console.error("Error generating OKR:", error);
    throw error;
  }
};

export const transformKrToObjective = async (krText: string): Promise<AISuggestion> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    Actúa como un experto en estrategia organizacional.
    Tengo este Resultado Clave (KR) de mi líder: "${krText}".
    
    Necesito "adoptarlo" y convertirlo en mi propio OBJETIVO.
    
    1. Transforma este KR numérico en un Objetivo inspirador y cualitativo para mi nivel.
       Ejemplo: Si el KR del líder es "Vender $1M", mi Objetivo podría ser "Construir la máquina de ventas más eficiente del sector".
       
    2. Sugiere 3 Resultados Clave (KRs) nuevos y específicos que yo podría ejecutar para lograr ese objetivo.
    
    Responde en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestionSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as AISuggestion;
  } catch (error) {
    console.error("Error transforming KR:", error);
    throw error;
  }
};

export const getOkrCoaching = async (objective: Objective): Promise<AICoaching> => {
  const model = "gemini-2.5-flash";
  
  // Calculate aggregate progress for context
  let totalProgress = 0;
  objective.keyResults.forEach(kr => {
    const p = Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100));
    totalProgress += p;
  });
  const avgProgress = totalProgress / (objective.keyResults.length || 1);

  const prompt = `
    Actúa como un coach de productividad y estrategia.
    Analiza el siguiente OKR y su progreso actual:
    
    Objetivo: ${objective.title}
    Resultados Clave:
    ${objective.keyResults.map(kr => `- ${kr.title}: ${kr.currentValue} / ${kr.targetValue} ${kr.unit}`).join('\n')}
    
    Progreso promedio: ${avgProgress.toFixed(1)}%
    
    Proporciona feedback constructivo. Si van mal, da tips para recuperar el rumbo. Si van bien, tips para mantener el momentum o ser más ambiciosos.
    Responde en Español.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: coachingSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as AICoaching;
  } catch (error) {
    console.error("Error generating coaching:", error);
    throw error;
  }
};

export const generateMonthlyReport = async (objectives: Objective[]): Promise<MonthlyReport> => {
  const model = "gemini-2.5-flash";

  const objectivesContext = objectives.map(obj => {
    const krs = obj.keyResults.map(kr => 
      `   - ${kr.title}: ${kr.currentValue} / ${kr.targetValue} ${kr.unit}`
    ).join('\n');
    return `ID: ${obj.id}\nObjetivo: ${obj.title}\nResultados Clave:\n${krs}`;
  }).join('\n\n');

  const prompt = `
    Actúa como un Consultor Estratégico Senior. Necesito generar un "Reporte Mensual de OKRs" (One Pager) para enviar a mi jefe.
    
    Aquí están mis OKRs y su estado actual:
    ${objectivesContext}

    Genera un reporte JSON con lo siguiente:
    1. executiveSummary: Un resumen ejecutivo profesional (max 3 líneas) sobre mi desempeño general este mes. Tono: Profesional, orientado a resultados, honesto.
    2. nextMonthActions: Sugiere 3-5 acciones estratégicas de alto impacto para el próximo mes basadas en los puntos débiles detectados.
    3. adjustments: Analiza si algún objetivo parece demasiado fácil (sandbagging) o imposible. Sugiere al jefe si deberíamos ajustar algún número hacia arriba o hacia abajo y por qué. Si todo se ve bien, puedes dejar esto vacío o dar una recomendación general.
    
    Responde en Español.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: reportSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as MonthlyReport;
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
};