// Le foto dalla chat della pagina (20/10) — tutto finto.   node collaudo/foto.mjs
// Controlla: senza account 401; una bolletta si archivia cifrata e diventa scadenza, con la risposta in chat; una foto qualsiasi
// riceve una risposta e NON si archivia. Controprova: un tipo di file diverso da foto/PDF non passa.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "foto-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, claudeDice = "";
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") return ((o.headers || {}).Authorization || "").endsWith("a".repeat(64)) ? new Response(JSON.stringify({ conto: { mail: "papa@prova.it" } })) : new Response("{}", { status: 401 });
  if (u.host === "api.anthropic.com") { const s = JSON.parse(o.body).system || ""; const t = /Leggi un documento/.test(s) ? '{"titolo":"Bolletta gas","scadenza":"2026-11-10","importo":"40 €","cosa":"bolletta del gas"}' : claudeDice;
    return new Response(JSON.stringify({ content: [{ type: "text", text: t }], usage: { input_tokens: 1, output_tokens: 1 } })); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    return repo[p] ? new Response(JSON.stringify({ content: repo[p], sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", DOC_CHIAVE: Buffer.alloc(32, 3).toString("base64") };
const foto = Buffer.alloc(400, 7).toString("base64");
const manda = async (tok, corpo) => { const r = await W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/foto", { method: "POST",
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(corpo) }), env, { waitUntil() {} }); return { s: r.status, d: await r.json().catch(() => ({})) }; };
let r = await manda("", { tipo: "image/jpeg", dati: foto }); ok(r.s === 401, "senza account: no", r);
claudeDice = '{"documento": true}';
r = await manda("a".repeat(64), { tipo: "image/jpeg", dati: foto, nome_assistente: "Ermes" });
const A = JSON.parse(Buffer.from(repo["atlas.json"] || b64({}), "base64").toString());
ok(r.s === 200 && /Ho archiviato «Bolletta gas»/.test(r.d.risposta) && /10\/11\/2026/.test(r.d.risposta), "la bolletta: archiviata, scadenza detta in chat", r.d);
ok(A["papa@prova.it"] && A["papa@prova.it"].scadenze.length === 1 && A["papa@prova.it"].assistente === "Ermes", "la scadenza è segnata, l'assistente ha il suo nome", A);
ok(Object.keys(repo).some((k) => k.startsWith("documenti/") && k.endsWith(".b64")), "il documento è nell'archivio cifrato");
const prima = Object.keys(repo).length; claudeDice = '{"documento": false, "risposta": "È un gatto rosso."}';
r = await manda("a".repeat(64), { tipo: "image/png", dati: foto, testo: "cos'è?" });
ok(r.d.risposta === "È un gatto rosso." && Object.keys(repo).length === prima, "una foto qualsiasi: risposta, e niente archivio", r.d);
r = await manda("a".repeat(64), { tipo: "text/html", dati: foto }); ok(r.s === 400, "controprova: un file che non è foto o PDF non passa", r);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
