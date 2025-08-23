import { useEffect, useMemo, useState } from "react";


export default function DynamicForm() {
    const [schema, setSchema] = useState([]);
    const [values, setValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [options, setOptions] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const BASE_URL = "https://test.superhero.hu";

    const isValid = useMemo(() => {
        if (!schema.length) return false;
        for (const f of schema) {
            const v = values[f.id];
            //üres?
            if (v === "" || v === null || v === undefined) return false;
            // int?
            if (f.widget === "integer" && !/^-?\d+$/.test(String(v))) return false;
        }
        return true;
    }, [schema, values]);

    useEffect(() => {
        async function loadForm() {
            setLoading(true);
            setError("");
            try {
                const res = await fetch("https://test.superhero.hu/form");
                if (!res.ok) throw new Error("Failed to load form", this.error);
                const data = await res.json();
                const fields = Array.isArray(data) ? data : (data?.fields ?? []);
                setSchema(fields);

                const init = {};
                fields.forEach(f => {
                    init[f.id] = "";
                });
                setValues(init);

            } catch (error) {
                setError(error.message ?? "Ismeretlen hiba");
            } finally {
                setLoading(false);
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
                    const r = await fetch(`https://test.superhero.hu/choice/${encodeURIComponent(f.id)}`);
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
                } catch (e) {
                    console.warn("Choice opciók lekérése sikertelen", f.id, e);
                    all[f.id] = [];
                }
            }
    
            setOptions(all);
        }
    
        loadChoices();
    }, [schema]);


    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setResult(null);

        const payload = {};
        schema.forEach(f => {
            let v = values[f.id];
            if (f.widget === "integer" && /^-?\d+$/.test(String(v))) { 
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

            const body = await res.json().catch(() => ({}));
            setResult({ status: res.status, ok: res.ok, body, sent: payload });
        } catch (err) {
            setResult({ error: err.message });
        } finally {
            setSubmitting(false);
        }
        
    }


    return (
        <div className="space-y-2">
            <form className="space-y-3" onSubmit={handleSubmit}>
                {/* mezők */}
                {schema.map((field) => (
                    <div key={field.id} className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-slate-700">
                            {field.label}
                        </label>

                        {/* 2/a: ha text mező */}
                        {field.widget === "text" && (
                            <input
                                type="text"
                                value={values[field.id]}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setValues((prev) => ({ ...prev, [field.id]: v }));
                                    console.log("values:", { ...values, [field.id]: v }); // csak hogy lásd, frissül
                                }}
                                className="border rounded-lg px-3 py-2"
                                placeholder={field.label}
                            />
                        )}

                        {/* 2/b: ha integer mező */}
                        {field.widget === "integer" && (
                            <input
                                type="number"
                                inputMode="numeric"
                                value={values[field.id]}
                                onChange={(e) => {
                                    const v = e.target.value; // itt még szöveg, később számmá alakítjuk
                                    setValues((prev) => ({ ...prev, [field.id]: v }));
                                    console.log("values:", { ...values, [field.id]: v });
                                }}
                                className="border rounded-lg px-3 py-2"
                                placeholder={field.label}
                            />
                        )}
                        {field.widget === "integer" && values[field.id] !== "" && !/^-?\d+$/.test(String(values[field.id])) && (
                        <p className="text-xs text-red-600">Egész számot adj meg.</p>
                        )}

                        {field.widget === "choice" && (
                            <select
                                className="border rounded-lg px-3 py-2"
                                value={values[field.id] ?? ""}
                                onChange={(e) =>
                                    setValues(prev => ({ ...prev, [field.id]: e.target.value }))
                                }
                                >
                                {!(options[field.id]?.length) && (
                                    <option value="" disabled>Nincs elérhető opció</option>
                                )}

                                {(options[field.id] ?? []).map((o, i) => (
                                    <option key={i} value={o.value}>{o.label}</option>
                                ))}
                                </select>
                        )}


                        {/* A choice típust most kihagyjuk, később jön. */}
                    </div>
                ))}

                <button
                type="submit"
                disabled={!isValid || submitting}
                className={`w-full py-2 rounded-lg font-semibold
              ${isValid || submitting? "bg-indigo-600 text-white" : "bg-slate-300 text-slate-600 cursor-not-allowed"}`}
>
                {submitting ? "Beküldés" : "Beküldöm"}
            </button>

            </form>
            {result && (
            <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Szerver válasza</h3>
                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto">
                {JSON.stringify(result, null, 2)}
                </pre>
            </div>
            )}




            <div>loading: {String(loading)}</div>
            {error && <div className="text-red-600">{error}</div>}
            <pre className="text-xs bg-slate-100 p-2 rounded">{JSON.stringify(schema, null, 2)}</pre>
            <pre>{JSON.stringify(values, null, 2)}</pre>
            <div className="text-xs">valid: {String(isValid)}</div>

            
        </div>
    )
}
