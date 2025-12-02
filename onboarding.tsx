import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader, Check, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("Owner");
  const [orgOption, setOrgOption] = useState<"new" | "existing">("new");
  const [orgName, setOrgName] = useState("");
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");

  const [userId, setUserId] = useState<string | null>(null);

  // Load logged user + profile
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, organization_id")
        .eq("id", user.id)
        .single();

      // If user already onboarded → go to dashboard
      if (profile?.full_name && profile?.organization_id) {
        navigate("/");
        return;
      }

      if (profile?.full_name) setFullName(profile.full_name);

      setLoading(false);
    };

    loadUser();
  }, []);

  // Load organizations
  useEffect(() => {
    const loadOrganizations = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");

      setOrganizations(data || []);
    };
    loadOrganizations();
  }, []);

  const handleNextStep = async () => {
    if (step === 1) {
      // Update name
      await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", userId);
    }

    if (step === 2) {
      // Update role
      await supabase.from("profiles").update({ role }).eq("id", userId);
    }

    if (step === 3) {
      let orgId = selectedOrg;

      if (orgOption === "new") {
        // Create org
        const { data: newOrg } = await supabase
          .from("organizations")
          .insert({ name: orgName })
          .select("id")
          .single();

        orgId = newOrg.id;
      }

      await supabase
        .from("profiles")
        .update({ organization_id: orgId })
        .eq("id", userId);
    }

    if (step === 4) {
      navigate("/");
      return;
    }

    setStep(step + 1);
  };

  if (loading)
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md w-full">
        
        {/* Steps indicator */}
        <div className="flex justify-center mb-6 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full ${
                step === i ? "bg-indigo-600" : "bg-slate-300"
              }`}
            ></div>
          ))}
        </div>

        {/* STEP 1: Name */}
        {step === 1 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              ¿Cuál es tu nombre?
            </h2>
            <p className="text-slate-500 mb-4">
              Esto se mostrará en tu perfil y en tus OKRs.
            </p>

            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded-lg p-3 mb-6"
              placeholder="Ej. Ángel Rodríguez"
            />

            <button
              onClick={handleNextStep}
              disabled={!fullName}
              className="w-full bg-indigo-600 text-white py-3 font-semibold rounded-xl hover:bg-indigo-700 transition"
            >
              Continuar <ArrowRight className="inline w-4 h-4 ml-1" />
            </button>
          </>
        )}

        {/* STEP 2: Role */}
        {step === 2 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              ¿Cuál es tu rol?
            </h2>
            <p className="text-slate-500 mb-4">
              Ayuda a personalizar tus vistas y permisos.
            </p>

            <div className="space-y-3 mb-6">
              {["Owner", "Manager", "Member"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`w-full border rounded-lg p-3 flex items-center justify-between ${
                    role === r
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-300"
                  }`}
                >
                  <span>{r}</span>
                  {role === r && <Check className="text-indigo-600" />}
                </button>
              ))}
            </div>

            <button
              onClick={handleNextStep}
              className="w-full bg-indigo-600 text-white py-3 font-semibold rounded-xl hover:bg-indigo-700 transition"
            >
              Continuar <ArrowRight className="inline w-4 h-4 ml-1" />
            </button>
          </>
        )}

        {/* STEP 3: Organization */}
        {step === 3 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              ¿A qué organización perteneces?
            </h2>
            <p className="text-slate-500 mb-4">
              Puedes crear una nueva o unirte a una existente.
            </p>

            <div className="space-y-4 mb-6">

              {/* Option selector */}
              <div className="flex gap-3">
                <button
                  onClick={() => setOrgOption("new")}
                  className={`flex-1 p-3 border rounded-xl ${
                    orgOption === "new"
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-300"
                  }`}
                >
                  Crear nueva
                </button>

                <button
                  onClick={() => setOrgOption("existing")}
                  className={`flex-1 p-3 border rounded-xl ${
                    orgOption === "existing"
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-300"
                  }`}
                >
                  Unirme
                </button>
              </div>

              {/* New organization */}
              {orgOption === "new" && (
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Nombre de la organización"
                  className="w-full border rounded-lg p-3"
                />
              )}

              {/* Existing organizations */}
              {orgOption === "existing" && (
                <select
                  className="w-full border rounded-lg p-3"
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                >
                  <option value="">Seleccionar organización…</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={handleNextStep}
              disabled={
                (orgOption === "new" && !orgName) ||
                (orgOption === "existing" && !selectedOrg)
              }
              className="w-full bg-indigo-600 text-white py-3 font-semibold rounded-xl hover:bg-indigo-700 transition"
            >
              Continuar <ArrowRight className="inline w-4 h-4 ml-1" />
            </button>
          </>
        )}

        {/* STEP 4: Finished */}
        {step === 4 && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-3">
              ¡Listo para comenzar! 🎉
            </h2>
            <p className="text-slate-500 mb-6">
              Ya puedes crear tus primeros OKRs y explorar OKR Master AI.
            </p>

            <button
              onClick={handleNextStep}
              className="w-full bg-indigo-600 text-white py-3 font-semibold rounded-xl hover:bg-indigo-700 transition"
            >
              Ir al Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

