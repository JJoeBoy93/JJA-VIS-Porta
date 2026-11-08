// Detto = fatto (8/11) — tutto finto.   node collaudo/detto-fatto.mjs
// JJ 21/10: «se succede a Dubai porta alla sconfitta immediata». L'assistente non deve dire «segnato» se non ha segnato.
// Controlla, dalla chat della pagina: una data scritta male → il modello riscrive e l'impegno si segna; se la sbaglia ancora →
// niente impegno e la risposta lo dice; un id inesistente in «fatti» → riscrive; «ho segnato» con i campi vuoti → riscrive;
// una risposta giusta → UNA chiamata sola (il controllo non costa niente quando va bene). Controprova sul codice di prima.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "detto-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
let repo = {}, coda = [], chiamate = 0, ultimoMsg = null;
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") return new Response(JSON.stringify({ conto: { mail: "prova@prova.it" } }));
  if (u.host === "api.anthropic.com") { const c = JSON.parse(o.body); chiamate++; ultimoMsg = c.messages; const t = coda.shift() || '{"risposta":"(vuoto)"}';
    return new Response(JSON.stringify({ content: [{ type: "text", text: t }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k" };
const scrivi = async (testo, ...risposte) => { coda = risposte; chiamate = 0;
  const r = await W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/assistente", { method: "POST",
    headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", Authorization: "Bearer " + "a".repeat(64) }, body: JSON.stringify({ testo }) }), env, { waitUntil() {} });
  return r.json(); };
const filo = () => JSON.parse(Buffer.from(repo["atlas.json"] || "e30=", "base64").toString())["prova@prova.it"] || {};

console.log("── una risposta giusta: una chiamata sola");
let d = await scrivi("giovedì 12 novembre alle 9 dentista", '{"risposta":"Segnato: dentista giovedì 12 alle 9.","nuovi":[{"cosa":"dentista","giorno":"2026-11-12","ora":"09:00"}]}');
ok(chiamate === 1 && filo().impegni.some((x) => x.cosa === "dentista"), "segnato, e il modello chiamato una volta", { chiamate });

console.log("── data scritta male, poi giusta");
d = await scrivi("venerdì 13 alle 10 meccanico", '{"risposta":"Segnato: meccanico venerdì alle 10.","nuovi":[{"cosa":"meccanico","giorno":"13/11/2026","ora":"10:00"}]}',
  '{"risposta":"Segnato: meccanico venerdì 13 alle 10.","nuovi":[{"cosa":"meccanico","giorno":"2026-11-13","ora":"10:00"}]}');
ok(chiamate === 2, "il modello riscrive una volta", { chiamate });
ok(String(JSON.stringify(ultimoMsg)).includes("13/11/2026") && String(JSON.stringify(ultimoMsg)).includes("AAAA-MM-GG"), "e gli si dice perché (il giorno sbagliato, la forma giusta)");
ok(filo().impegni.some((x) => x.cosa === "meccanico" && x.giorno === "2026-11-13"), "alla fine l'impegno c'è", filo().impegni);

console.log("── data sbagliata due volte");
d = await scrivi("dopodomani parrucchiere", '{"risposta":"Segnato: parrucchiere.","nuovi":[{"cosa":"parrucchiere","giorno":"dopodomani"}]}',
  '{"risposta":"Segnato: parrucchiere.","nuovi":[{"cosa":"parrucchiere","giorno":"dopo domani"}]}');
ok(!filo().impegni.some((x) => x.cosa === "parrucchiere"), "niente impegno inventato");
ok(/⚠️/.test(d.risposta) && /parrucchiere/.test(d.risposta) && /giorno/.test(d.risposta), "e la risposta dice che non l'ha segnato e chiede il giorno", d.risposta);

console.log("── un id che non esiste");
const id = filo().impegni.find((x) => x.cosa === "dentista").id;
d = await scrivi("il dentista l'ho fatto", '{"risposta":"Segnato come fatto.","fatti":["zzz999"]}', `{"risposta":"Segnato come fatto.","fatti":["${id}"]}`);
ok(chiamate === 2 && filo().impegni.find((x) => x.id === id).fatto, "riscritto con l'id giusto: il dentista è fatto", { chiamate });
d = await scrivi("e anche la palestra", '{"risposta":"Fatto.","fatti":["zzz999"]}', '{"risposta":"Fatto.","fatti":["zzz999"]}');
ok(/⚠️/.test(d.risposta), "id sbagliato due volte: la risposta avvisa", d.risposta);

console.log("── «ho segnato» con i campi vuoti");
d = await scrivi("lunedì 16 alle 8 analisi", '{"risposta":"Ho segnato le analisi per lunedì alle 8."}',
  '{"risposta":"Ho segnato le analisi per lunedì 16 alle 8.","nuovi":[{"cosa":"analisi","giorno":"2026-11-16","ora":"08:00"}]}');
ok(chiamate === 2 && filo().impegni.some((x) => x.cosa === "analisi"), "riscritto: le analisi ci sono davvero", { chiamate });
d = await scrivi("grazie", '{"risposta":"Di niente! Te lo ricordo io domattina."}');
ok(chiamate === 1, "«te lo ricordo» di una cosa già segnata non fa scattare il controllo", { chiamate });

console.log("── controprova: col controllo spento la data sbagliata passava in silenzio");
const finto = { risposta: "Segnato.", nuovi: [{ cosa: "x", giorno: "domani" }] };
ok(W.controllaEsito(finto, {}, {}).length === 1, "controllaEsito la vede");
console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE"); process.exit(errori ? 1 : 0);
