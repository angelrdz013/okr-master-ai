import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { Trophy } from "lucide-react";

type Mode = "login" | "signup";

const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage(
          "Cuenta creada. Revisa tu correo para confirmar (si aplica) y luego inicia sesión."
        );
      }
    } catch (err: any) {
      setError(err.message || "Hubo un error. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-slate-900">
              OKR Master AI
            </h1>
            <p className="text-xs text-slate-500">
              Accede con tu correo para empezar a usar tus OKRs con IA.
            </p>
          </div>
        </div>

        <div className="flex mb-6 text-sm font-medium border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 ${
              mode === "login"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 text-slate-600"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 ${
              mode === "signup"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 text-slate-600"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <label className="block mb-3 text-sm">
          <span className="text-slate-600">Correo electrónico</span>
          <input
            type="email"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="tu@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block mb-4 text-sm">
          <span className="text-slate-600">Contraseña</span>
          <input
            type="password"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>

        {error && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
            {message}
          </div>
        )}

        <button
          onClick={handleAuth}
          disabled={loading || !email || !password}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <span>Procesando...</span>
          ) : mode === "login" ? (
            <span>Entrar</span>
          ) : (
            <span>Crear cuenta</span>
          )}
        </button>

        <p className="mt-4 text-[11px] text-slate-400 leading-snug">
          *Este es un entorno de prueba. Más adelante podrás conectar tu dominio
          y configurar políticas de acceso para tu organización.
        </p>
      </div>
    </div>
  );
};

export default Login;
