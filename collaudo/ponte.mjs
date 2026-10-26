// La mail fa da ponte (19/10) — tutto finto.   node collaudo/ponte.mjs
// Controlla: con la sessione del server dei conti, la porta trova chi conosce già con quella mail (Atlas) e rimanda il
// suo profilo; dal 26/10 non le scrive nessuna mail all'accesso; senza sessione buona
// niente; una mail sconosciuta: nessun profilo. Controprova: la mail la dice il server dei conti, non chi chiama.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "ponte-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const repo = { "atlas.json": { "jessica@prova.it": { nome: "Jessica", chi: "jess123abc" } },
  "utenti/jess123abc.json": { chi: "jess123abc", nome_assistente: "Atlas", tuo: "Jessica", mestiere: "Estetista", tempo: "Gli appuntamenti", conosciute: { sera: "La giornata di domani pronta" }, ha_risposto: true } };
let posta = [], sessioni = { ["a".repeat(64)]: "jessica@prova.it", ["b".repeat(64)]: "sconosciuto@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const t = ((o.headers || {}).Authorization || "").slice(7); return sessioni[t] ? new Response(JSON.stringify({ conto: { mail: sessioni[t] } })) : new Response('{"no":"sessione"}', { status: 401 }); }
  if (u.host === "api.brevo.com") { posta.push(JSON.parse(o.body)); return new Response("{}"); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if ((o.method || "GET") === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return new Response("{}"); }
    if (p === "utenti") return new Response(JSON.stringify(Object.keys(repo).filter(k => k.startsWith("utenti/")).map(k => ({ name: k.slice(7) }))));
    return repo[p] ? new Response(JSON.stringify({ content: b64(repo[p]), sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", BREVO_API_KEY: "k", MITTENTE: "atlas@jjavis.it" };
const chiedi = async (tok, corpo = {}) => { const r = await W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/io/dal-conto", { method: "POST",
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(corpo) }), env, { waitUntil() {} }); return { s: r.status, d: await r.json().catch(() => ({})) }; };
let r = await chiedi("a".repeat(64));
ok(r.s === 200 && r.d.io && r.d.io.nome === "Atlas" && r.d.io.tuo === "Jessica" && r.d.io.mestiere === "Estetista" && r.d.io.inviato === true && r.d.io.conosciute.sera, "Jessica entra: torna il suo Atlas, con quello che gli aveva detto", r);
// 26/10, JJ: «apro la pagina e mi arriva la mail… è inutile» → nessuna mail «Bentornata» all'accesso (prima ce n'era una al giorno)
ok(posta.length === 0, "entrare NON manda mail (niente più «Bentornata»)", posta);
r = await chiedi("a".repeat(64)); ok(r.d.io && posta.length === 0, "la seconda volta: il profilo sì, mail ancora nessuna", posta.length);
r = await chiedi("c".repeat(64)); ok(r.s === 401, "sessione che il server dei conti non conosce: niente", r.s);
r = await chiedi(""); ok(r.s === 401, "senza sessione: niente", r.s);
r = await chiedi("b".repeat(64)); ok(r.s === 200 && r.d.io === null, "una mail che non conosco: nessun profilo", r);
r = await chiedi("b".repeat(64), { mail: "jessica@prova.it" }); ok(r.d.io === null, "controprova: dire «sono jessica@…» nel corpo non serve, la mail la dà il server dei conti", r);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
