// L'archivio cifrato dei documenti (20/10) — tutto finto.   node collaudo/documenti.mjs
// Controlla: un allegato si legge (finto modello), si archivia CIFRATO (nell'archivio non c'è né il titolo né il contenuto in
// chiaro), la bolletta diventa una scadenza; a richiesta torna identico; si cancella davvero. Controprova: con un'altra chiave
// non si apre.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "doc-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const repo = {};
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url)), h = o.headers || {};
  if (u.host === "api.anthropic.com") return new Response(JSON.stringify({ content: [{ type: "text", text: '{"titolo":"Bolletta luce Enel ottobre 2026","data":"2026-10-12","scadenza":"2026-11-05","importo":"85,40 €","cosa":"bolletta della luce"}' }], usage: { input_tokens: 10, output_tokens: 10 } }));
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (m === "DELETE") { delete repo[p]; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    if (h.Accept === "application/vnd.github.raw") return new Response(Buffer.from(repo[p], "base64"));
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const chiave = Buffer.alloc(32, 7).toString("base64");
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "a", DOC_CHIAVE: chiave };
const pdf = Buffer.from("%PDF-1.4 bolletta Enel 85,40 euro scadenza 05/11/2026").toString("base64");
const fatto = await W.archiviaAllegati(env, "papa@prova.it", [{ nome: "bolletta.pdf", tipo: "application/pdf", dati: pdf }], "2026-10-20");
ok(fatto.archiviati.length === 1 && fatto.archiviati[0].titolo === "Bolletta luce Enel ottobre 2026", "la bolletta si legge e si archivia", fatto);
ok(fatto.scadenze.length === 1 && fatto.scadenze[0].giorno === "2026-11-05" && fatto.scadenze[0].importo === "85,40 €", "e diventa una scadenza, con l'importo", fatto.scadenze);
const tutto = Object.values(repo).map((x) => Buffer.from(x, "base64").toString("latin1")).join(" ");
ok(Object.keys(repo).every((k) => k.startsWith("documenti/") && !k.includes("papa")), "nell'archivio: solo documenti/<impronta>/, nemmeno la mail nel percorso", Object.keys(repo));
ok(!/Enel|bolletta|85,40|PDF/.test(tutto), "nell'archivio niente in chiaro: né il titolo, né il contenuto", tutto.slice(0, 120));
const I = await W.leggiIndice(env, "papa@prova.it");
const indietro = await W.documentiDaMandare(env, "papa@prova.it", [I.elenco[0].id]);
ok(indietro.length === 1 && indietro[0].content === pdf && /\.pdf$/.test(indietro[0].name), "a richiesta torna identico, col suo nome", indietro.map((x) => x.name));
const altra = { ...env, DOC_CHIAVE: Buffer.alloc(32, 9).toString("base64") };
ok((await W.leggiIndice(altra, "papa@prova.it")).elenco.length === 0 && (await W.documentiDaMandare(altra, "papa@prova.it", [I.elenco[0].id])).length === 0, "controprova: con un'altra chiave non si apre niente");
await W.documentiVia(env, "papa@prova.it", [I.elenco[0].id]);
ok((await W.leggiIndice(env, "papa@prova.it")).elenco.length === 0 && Object.keys(repo).filter((k) => k.endsWith(".bin") && !k.endsWith("indice.bin")).length === 0, "si cancella davvero: file e voce nell'elenco");
const dopoCambio = await W.archiviaAllegati(altra, "papa@prova.it", [{ nome: "b2.pdf", tipo: "application/pdf", dati: pdf }], "2026-10-20");
ok(dopoCambio.archiviati.length === 1 && (await W.leggiIndice(altra, "papa@prova.it")).elenco.length === 1, "chiave cambiata: l'elenco vecchio non si apre, ma i documenti nuovi si archiviano lo stesso", dopoCambio);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
