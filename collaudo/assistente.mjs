// Un assistente solo: la chat della pagina e la posta (20/10) — tutto finto.   node collaudo/assistente.mjs
// Controlla: senza account 401; dalla chat l'assistente segna un impegno nello STESSO filo della posta (lo ritrova per mail);
// chiedendo un documento torna il link; GET /doc lo restituisce solo con la sessione giusta; la richiesta al modello porta lo
// strumento di ricerca sul web. Controprova: la sessione di un altro non scarica il documento.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "ass-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, risposta = "", strumenti = null, visto = "";
const sessioni = { ["a".repeat(64)]: "papa@prova.it", ["b".repeat(64)]: "altro@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { const c = JSON.parse(o.body); const t = /Leggi un documento/.test(c.system || "") ? '{"titolo":"Bolletta luce","scadenza":null}' : risposta; if (c.tools) strumenti = c.tools; visto = (c.messages && c.messages[0] && c.messages[0].content) || "";
    return new Response(JSON.stringify({ content: [{ type: "text", text: t }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    if ((o.headers || {}).Accept === "application/vnd.github.raw") return new Response(Buffer.from(repo[p], "base64"));
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", DOC_CHIAVE: Buffer.alloc(32, 5).toString("base64") };
const chiama = async (via, tok, corpo, metodo = "POST") => { const r = await W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev" + via, { method: metodo,
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, ...(metodo === "POST" ? { body: JSON.stringify(corpo) } : {}) }), env, { waitUntil() {} }); return r; };
let r = await chiama("/assistente", "", { testo: "ciao" }); ok(r.status === 401, "senza account: no");
risposta = '{"risposta":"Segnato: dentista giovedì alle 9.","nuovi":[{"cosa":"dentista","giorno":"2026-10-22","ora":"09:00"}],"tolti":[]}';
r = await chiama("/assistente", "a".repeat(64), { testo: "giovedì alle 9 ho il dentista", nome_assistente: "Ermes" }); const d1 = await r.json();
const A = JSON.parse(Buffer.from(repo["atlas.json"], "base64").toString());
ok(d1.risposta === "Segnato: dentista giovedì alle 9." && A["papa@prova.it"].impegni.some((x) => x.cosa === "dentista" && x.ora === "09:00"), "dalla chat: l'impegno va nello stesso filo della posta", A["papa@prova.it"]);
ok(A["papa@prova.it"].turni.some((x) => x.testo === "[chat] giovedì alle 9 ho il dentista") && A["papa@prova.it"].assistente === "Ermes", "la conversazione è la stessa (per mail lo sa), col suo nome");
ok(Array.isArray(strumenti) && strumenti[0].type === "web_search_20250305", "al modello va lo strumento di ricerca sul web", strumenti);
await W.archiviaAllegati(env, "papa@prova.it", [{ nome: "b.pdf", tipo: "application/pdf", dati: Buffer.from("%PDF bolletta").toString("base64") }], "2026-10-20");
const idDoc = (await W.leggiIndice(env, "papa@prova.it")).elenco[0].id;
risposta = `{"risposta":"Eccola.","manda_documenti":["${idDoc}"]}`;
r = await chiama("/assistente", "a".repeat(64), { testo: "mandami la bolletta" }); const d2 = await r.json();
ok(d2.documenti && d2.documenti[0].id === idDoc && d2.documenti[0].titolo === "Bolletta luce", "chiesto in chat: torna il link del documento", d2);
r = await chiama("/doc?id=" + idDoc, "a".repeat(64), null, "GET");
ok(r.status === 200 && Buffer.from(await r.arrayBuffer()).toString() === "%PDF bolletta" && r.headers.get("content-type") === "application/pdf", "il link scarica il documento, decifrato");
r = await chiama("/doc?id=" + idDoc, "b".repeat(64), null, "GET"); ok(r.status === 404, "controprova: con la sessione di un altro non si scarica", r.status);
r = await chiama("/doc?id=" + idDoc, "", null, "GET"); ok(r.status === 401, "senza sessione: no");
// ── 28/10, la vita nelle chat dopo la prima: come primoCore, «nella vita: in pensione» e non «mestiere:»
console.log("── la vita nelle chat normali");
const CHIV = "cafe0123cafe0123";
risposta = '{"risposta":"Ok."}';
repo[`utenti/${CHIV}.json`] = b64({ chi: CHIV, mail: "papa@prova.it", vita: "pensione", mestiere: "Operaio", tempo: "Bollette e scadenze" });
await chiama("/assistente", "a".repeat(64), { testo: "cosa mi consigli?", chi: CHIV });
ok(visto.includes("nella vita: in pensione") && visto.includes("in cosa vorrebbe essere assistito: Bollette e scadenze") && !visto.includes("mestiere:") && !/Operaio/.test(visto),
  "vita «pensione» (dal file): «nella vita: in pensione», senza mestiere", visto.slice(0, 400));
repo[`utenti/${CHIV}.json`] = b64({ chi: CHIV, mail: "papa@prova.it", vita: "casa" });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHIV });
ok(visto.includes("nella vita: sta a casa"), "vita «casa»: «sta a casa»", visto.slice(0, 300));
repo[`utenti/${CHIV}.json`] = b64({ chi: CHIV, mail: "papa@prova.it", tuo: "Nino" });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHIV, profilo: { vita: "pensione", tempo: "Visite" } });
ok(visto.includes("nella vita: in pensione") && visto.includes("in cosa vorrebbe essere assistito: Visite"), "senza vita nel file: vale quella che manda la pagina", visto.slice(0, 300));
repo[`utenti/${CHIV}.json`] = b64({ chi: CHIV, mail: "papa@prova.it", vita: "pensione" });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHIV, profilo: { vita: "lavoro" } });
ok(visto.includes("nella vita: in pensione"), "se c'è nel file, la vita del file vale più di quella della pagina", visto.slice(0, 300));
repo[`utenti/${CHIV}.json`] = b64({ chi: CHIV, mail: "altro@prova.it", vita: "pensione" });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHIV });
ok(!visto.includes("nella vita"), "il profilo di un altro non si legge", visto.slice(0, 300));
repo[`utenti/${CHIV}.json`] = b64({ chi: CHIV, mail: "papa@prova.it", vita: "lavoro", mestiere: "Artigiano", tempo: "Preventivi" });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHIV, profilo: { vita: "lavoro" } });
ok(!visto.includes("nella vita") && !visto.includes("mestiere:") && !visto.includes("Quello che sai di lei"), "vita «lavoro»: tutto come oggi", visto.slice(0, 300));
await chiama("/assistente", "a".repeat(64), { testo: "ciao" });
ok(!visto.includes("nella vita") && !visto.includes("Quello che sai di lei"), "senza vita (i vecchi): tutto come oggi", visto.slice(0, 300));
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
