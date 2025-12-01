import { createClient } from "@supabase/supabase-js";

// Estas variables deben existir en Vercel (Settings → Environment Variables)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL o ANON KEY no están configuradas correctamente");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
