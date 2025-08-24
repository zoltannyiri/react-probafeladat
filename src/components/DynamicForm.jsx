import { useEffect, useMemo, useState } from "react";

export default function DynamicForm() {
  const [schema, setSchema] = useState([]);
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [options, setOptions] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const BASE_URL = "https://test.superhero.hu";

  const isValid = useMemo(() => {
    if (!schema.length) return false;
    for (const f of schema) {
      const v = values[f.id];
      if (v === "" || v === null || v === undefined) return false;
      if (f.widget === "integer" && !/^-?\d+$/.test(String(v))) return false;
    }
    return true;
  }, [schema, values]);

  useEffect(() => {
    async function loadForm() {
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`${BASE_URL}/form`);
        if (!res.ok) throw new Error(`Hiba történt: ${res.status}`);
        const data = await res.json();

        console.log("form response:", data);

        const fields = Array.isArray(data) ? data : (data?.fields ?? []);
        setSchema(fields);

        const init = {};
        fields.forEach(f => { init[f.id] = ""; });
        setValues(init);
      } catch (error) {
        setError(error.message ?? "Ismeretlen hiba");
      }
    }
    loadForm();
  }, []);

  useEffect(() => {
    if (!schema.length) return;

    async function loadChoices() {
      const choiceFields = schema.filter(f => f.widget === "choice");
      if (!choiceFields.length) return;

      const all = {};
      for (const f of choiceFields) {
        try {
          const r = await fetch(`${BASE_URL}/choice/${encodeURIComponent(f.id)}`);
          if (!r.ok) throw new Error("Choice hiba");
          const arr = await r.json();
          const normalized = (Array.isArray(arr) ? arr : []).map((opt, i) =>
            typeof opt === "string"
              ? { label: opt, value: opt }
              : {
                  label: opt?.label ?? String(opt?.value ?? opt?.id ?? i),
                  value: opt?.value ?? opt?.id ?? opt
                }
          );
          all[f.id] = normalized;
        } catch (error) {
          console.warn("Choice opciók lekérése sikertelen", f.id, error);
          all[f.id] = [];
        }
      }

      setOptions(all);
      setValues(prev => {
        const next = { ...prev };
        for (const f of choiceFields) {
          if (!next[f.id] && (all[f.id]?.length ?? 0) > 0) {
            next[f.id] = all[f.id][0].value;
          }
        }
        return next;
      });
    }

    loadChoices();
  }, [schema]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {};
    schema.forEach(f => {
      let v = values[f.id];
      if (f.widget === "integer" && v !== "") {
        v = Number(v);
      }
      payload[f.id] = v;
    });

    try {
      const res = await fetch(`${BASE_URL}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(`Hiba történt: ${res.status}`);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err.message ?? "Beküldési hiba");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md md:max-w-lg px-4 py-4">
      <div className="space-y-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow">
          <form className="space-y-3" onSubmit={handleSubmit}>
            {schema.map((field) => (
              <div key={field.id} className="flex flex-col gap-1">
                <label
                  htmlFor={field.id}
                  className="text-sm font-medium text-slate-700"
                >
                  {field.label}
                </label>

                {/* szöveg */}
                {field.widget === "text" && (
                  <input
                    id={field.id}
                    type="text"
                    value={values[field.id]}
                    onChange={(e) => {
                      const v = e.target.value;
                      setValues((prev) => ({ ...prev, [field.id]: v }));
                      // console.log("values:", { ...values, [field.id]: v });
                    }}
                    className="border rounded-lg px-3 py-2"
                    placeholder={field.label}
                  />
                )}

                {/* int */}
                {field.widget === "integer" && (
                  <>
                    <input
                      id={field.id}
                      type="text"
                      inputMode="numeric"
                      value={values[field.id] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setValues((prev) => ({ ...prev, [field.id]: v }));
                        // console.log("values:", { ...values, [field.id]: v });
                      }}
                      className={`border rounded-lg px-3 py-2 ${
                        values[field.id] !== "" &&
                        !/^-?\d+$/.test(String(values[field.id]))
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-slate-300"
                      }`}
                      placeholder={field.label}
                    />
                    {values[field.id] !== "" &&
                      !/^-?\d+$/.test(String(values[field.id])) && (
                        <p className="text-xs text-red-600">
                          Csak egész számot adhatsz meg (az első karakter lehet
                          mínusz).
                        </p>
                      )}
                  </>
                )}

                {/* choice */}
                {field.widget === "choice" && (
                  <select
                    id={field.id}
                    className="border rounded-lg px-3 py-2"
                    value={values[field.id] ?? ""}
                    onChange={(e) => {
                      setValues((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }));
                      // console.log("values:", {
                      //   ...values,
                      //   [field.id]: e.target.value,
                      // });
                    }}
                  >
                    {!(options[field.id]?.length) && (
                      <option value="" disabled>
                        Nincs elérhető opció
                      </option>
                    )}
                    {(options[field.id] ?? []).map((o, i) => (
                      <option key={i} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={!isValid || submitting || sent}
              className={`w-full py-2 rounded-lg font-semibold ${
                sent
                  ? "bg-green-600 text-white cursor-not-allowed"
                  : (!isValid || submitting)
                  ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                  : "bg-indigo-600 text-white"
              }`}
            >
              {submitting
                ? "Beküldés…"
                : sent
                ? "Sikeresen elküldve 🎉"
                : "Beküldöm"}
            </button>

          </form>


          {success && (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
