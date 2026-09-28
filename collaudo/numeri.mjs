// I Numeri della sera — tutto finto.   node collaudo/numeri.mjs
// Nato il 28 settembre 2026 (Athena). JJ: «la domanda di quanto varrebbe è
// in funzione di quello che serve a chi chiede… messa così sembra che quanto
// vale è JJAVIS». Controlla: il prezzo si legge accanto alla cosa che fa
// perdere tempo; il 15 del cursore è detto; senza risposte non c'è la riga.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = resolve(process.argv[2] || join(qui, "..", "worker.js"));
const copia = join(mkdtempSync(join(tmpdir(), "numeri-")), "worker.mjs");
copyFileSync(sorgente, copia);
for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(dirname(sorgente), f), join(dirname(copia), f));
const W = (await import(copia)).default;
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const repo = new Map(), tg = [];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
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
const env = { GH_TOKEN: "t", TG_BOT_TOKEN: "bot", TG_CHAT: "42" };
const sera = async () => { tg.length = 0; const att = []; await W.scheduled({ cron: "0 18 * * *" }, env, { waitUntil: (p) => att.push(p) }); await Promise.all(att); return tg.map((x) => x.text || "").find((t) => t.includes("📊 Numeri")) || ""; };

repo.set("utenti/a.json", b64({ ha_risposto: true, mestiere: "Corriere o autista", tempo: "Preventivi, conti, fatture", prezzo_al_mese: 15, primo: "2026-09-26", ultimo: "2026-09-26" }));
repo.set("utenti/b.json", b64({ ha_risposto: true, mestiere: "Altro", tempo: "Organizzare la giornata", prezzo_al_mese: 15, primo: "2026-09-26", ultimo: "2026-09-27" }));
repo.set("utenti/c.json", b64({ ha_risposto: true, mestiere: "Corriere o autista", tempo: "Organizzare la giornata", prezzo_al_mese: 40, primo: "2026-09-27", ultimo: "2026-09-27" }));
repo.set("utenti/d.json", b64({ ha_risposto: false, primo: "2026-09-27", ultimo: "2026-09-27" }));

console.log("── il prezzo accanto alla cosa");
const t = await sera();
ok(t.includes("farsi togliere il tempo perso"), "la riga dice DI COSA è il prezzo, non «quanto vale JJA-VIS»");
ok(t.includes("· Organizzare la giornata: 27.5 € (2)") && t.includes("· Preventivi, conti, fatture: 15 € (1)"), "ogni cosa col suo prezzo e quanti l'hanno detto");
ok(t.includes("15 € è dove parte il cursore: 2 risposte su 3"), "il 15 di partenza del cursore è detto, con quante risposte ci stanno sopra");
ok(!t.includes("undefined"), "niente «undefined»");

console.log("── senza nessun 15, niente avviso");
repo.set("utenti/a.json", b64({ ha_risposto: true, tempo: "Preventivi, conti, fatture", prezzo_al_mese: 20, primo: "x", ultimo: "x" }));
repo.set("utenti/b.json", b64({ ha_risposto: true, tempo: "Organizzare la giornata", prezzo_al_mese: 30, primo: "x", ultimo: "x" }));
ok(!(await sera()).includes("dove parte il cursore"), "nessun 15: nessun avviso");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
