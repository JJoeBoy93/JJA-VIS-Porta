// La vetrina — tutto finto.   node collaudo/vetrina.mjs
// Nato il 1° ottobre 2026 (Athena). JJ: «le canzoni sono diminuite nella
// pagina, e ? nei numeri». Controlla: un numero che lo Space non manda non
// cancella l'ultimo buono; il conto dice perché; con i numeri veri si scrivono quelli.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = resolve(process.argv[2] || join(qui, "..", "worker.js"));
const copia = join(mkdtempSync(join(tmpdir(), "vetrina-")), "worker.mjs");
copyFileSync(sorgente, copia);
for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(dirname(sorgente), f), join(dirname(copia), f));
const W = (await import(copia)).default;
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const repo = new Map(), tg = [];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const leggi = (p) => JSON.parse(Buffer.from(repo.get(p), "base64").toString());
let dalloSpace = {};
globalThis.fetch = async (url, o = {}) => {
  url = String(url); const m = o.method || "GET";
  const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
  if (url.includes("api.github.com")) {
    const p = decodeURIComponent(url.split("/contents/")[1] || "");
    if (m === "GET") { if (repo.has(p)) return J({ content: repo.get(p), sha: "s" });
      const dir = [...repo.keys()].filter((k) => k.startsWith(p + "/")); if (dir.length) return J(dir.map((k) => ({ name: k.split("/").pop() })));
      return J({ message: "Not Found" }, 404); }
    if (m === "PUT") { repo.set(p, JSON.parse(o.body).content); return J({ content: { sha: "x" } }, 201); }
  }
  if (url.includes("api.telegram.org")) { tg.push(JSON.parse(o.body)); return J({ ok: true, result: { message_id: 7, message_thread_id: 3 } }); }
  return J({}, 404);
};
const HERMES = { fetch: async (req) => new Response(JSON.stringify(dalloSpace), { status: 200 }) };
const env = { GH_TOKEN: "t", TG_BOT_TOKEN: "bot", TG_CHAT: "42", HERMES, JJAVIS_SEGRETO: "s" };
const sera = async () => { tg.length = 0; const att = []; await W.scheduled({ cron: "0 18 * * *" }, env, { waitUntil: (p) => att.push(p) }); await Promise.all(att); return tg.map((x) => x.text || "").find((t) => t.includes("vetrina della pagina")) || ""; };

console.log("── i numeri arrivano");
dalloSpace = { ok: true, quando: "2026-09-30T20:00:00", canzoni: 6223, attrezzi: 40 };
let t = await sera();
ok(leggi("vetrina.json").canzoni === 6223 && t.includes("aggiornata (6223 canzoni, 40 attrezzi)") && !t.includes("ultimo numero buono"), "si scrivono i numeri veri");

console.log("── le canzoni non arrivano (la sera del 30/9)");
dalloSpace = { ok: true, quando: "2026-10-01T20:00:00", attrezzi: 40, canzoni_perche: "fonoteca ancora in caricamento" };
t = await sera();
ok(leggi("vetrina.json").canzoni === 6223, "la vetrina tiene 6223: la pagina non torna al numero vecchio scritto a mano");
ok(t.includes("canzoni non arrivati stasera") && t.includes("fonoteca ancora in caricamento") && t.includes("ultimo numero buono"), "il conto dice che mancano, perché, e che tiene l'ultimo buono");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
