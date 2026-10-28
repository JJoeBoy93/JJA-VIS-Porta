// Le scadenze da pagare di Atlas (20/10) — tutto finto.   node collaudo/scadenze.mjs
// Controlla: 3 giorni prima arriva «Tra 3 giorni», una volta sola; la mattina della scadenza «Scade oggi»; di notte niente;
// fatta (o pagata di prima) non avvisa più; la ricorrente fatta resta fatta e ne nasce una al mese dopo (anche dal 31 a febbraio). Controprova: un impegno non è una scadenza.
// 28/10: «Fatto» segna e non cancella (collaudo/agenda.mjs): la voce resta con `fatto`, e gli avvisi la saltano.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "scad-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, posta = [];
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "api.brevo.com") { posta.push(JSON.parse(o.body)); return new Response("{}"); }
  if (u.host === "api.telegram.org") return new Response('{"ok":true}');
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if ((o.method || "GET") === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return new Response("{}"); }
    return repo[p] ? new Response(JSON.stringify({ content: b64(repo[p]), sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", BREVO_API_KEY: "k", MITTENTE: "atlas@jjavis.it", TG_BOT_TOKEN: "t", TG_CHAT: "1" };
const alle = (g, h) => new Date(`${g}T${h}:00+02:00`);
// 27/10: posta: "tutto" perché qui si prova il servizio com'era (3 giorni prima + la mattina stessa); chi non ha scelto è «essenziale»:
// una mail sola, il giorno prima (collaudo/meno-mail.mjs)
repo["atlas.json"] = { "papa@prova.it": { nome: "Franco", posta: "tutto", turni: [], impegni: [{ id: "i1", cosa: "dal medico", giorno: "2026-10-25", ora: null, avvisato: false, ics: true }],
  scadenze: [{ id: "s1", cosa: "bolletta della luce", importo: "85,40 €", giorno: "2026-10-25", ogni_mese: false, pagata: false, avvisi: {} },
             { id: "s2", cosa: "affitto", importo: "650 €", giorno: "2026-10-31", ogni_mese: true, pagata: false, avvisi: {} }] } };
const oggetti = () => posta.map((m) => m.subject);
await W.atlasPromemoria(env, alle("2026-10-22", "09:00"));
ok(oggetti().some((s) => /Tra 3 giorni: bolletta della luce · 85,40 €/.test(s)), "3 giorni prima: «Tra 3 giorni», con l'importo", oggetti());
ok(!oggetti().some((s) => /affitto/.test(s)), "l'affitto (fra 9 giorni) ancora no", oggetti());
posta = []; await W.atlasPromemoria(env, alle("2026-10-22", "15:00"));
ok(!oggetti().some((s) => /bolletta/.test(s)), "lo stesso avviso non arriva due volte", oggetti());
posta = []; await W.atlasPromemoria(env, alle("2026-10-25", "06:00"));
ok(!oggetti().some((s) => /bolletta/.test(s)), "di notte (alle 6) niente", oggetti());
// (il 25/10 finisce l'ora legale: le 9:30 a +02:00 sono le 8:30 a Roma)
await W.atlasPromemoria(env, alle("2026-10-25", "09:30"));
ok(oggetti().some((s) => /Scade oggi: bolletta della luce/.test(s)), "la mattina della scadenza: «Scade oggi»", oggetti());
ok(!oggetti().some((s) => /dal medico/.test(s) && /Scade/.test(s)), "controprova: l'impegno dal medico non diventa una scadenza", oggetti());
const f2 = { scadenze: [{ ...repo["atlas.json"]["papa@prova.it"].scadenze[1] }] }, quando = new Date("2026-10-31T10:00:00Z");
const s2 = W.scadenzaFatta(f2, f2.scadenze[0], quando);
ok(s2.fatto === "2026-10-31T10:00:00.000Z" && s2.giorno === "2026-10-31" && f2.scadenze.length === 2, "l'affitto ricorrente fatto resta (con la data in cui l'ha segnato) e non si sposta", f2);
const n2 = f2.scadenze[1];
ok(s2.successiva === n2.id && n2.giorno === "2026-11-30" && !n2.fatto && n2.pagata === false && JSON.stringify(n2.avvisi) === "{}" && n2.importo === "650 €" && n2.ogni_mese === true, "…e ne nasce una aperta al mese dopo, avvisi da rifare", f2);
const f3 = { scadenze: [{ id: "x", cosa: "bollo", giorno: "2027-01-31", ogni_mese: true }] };
W.scadenzaFatta(f3, f3.scadenze[0]);
ok(f3.scadenze[1].giorno === "2027-02-28", "dal 31 gennaio si passa al 28 febbraio", f3);
const f4 = { scadenze: [{ id: "y", cosa: "bollo auto", giorno: "2027-01-31", ogni_mese: false }] };
W.scadenzaFatta(f4, f4.scadenze[0]);
ok(f4.scadenze.length === 1 && f4.scadenze[0].fatto && !f4.scadenze[0].successiva, "una singola fatta: resta, senza una nuova");
repo["atlas.json"]["papa@prova.it"].scadenze[0].pagata = true; repo["atlas.json"]["papa@prova.it"].scadenze[0].avvisi = {};
posta = []; await W.atlasPromemoria(env, alle("2026-10-25", "10:00"));
ok(!oggetti().some((s) => /bolletta/.test(s)), "pagata (il segno di prima): non avvisa più", oggetti());
repo["atlas.json"]["papa@prova.it"].scadenze[0].pagata = false; repo["atlas.json"]["papa@prova.it"].scadenze[0].fatto = new Date().toISOString();
posta = []; await W.atlasPromemoria(env, alle("2026-10-25", "10:00"));
ok(!oggetti().some((s) => /bolletta/.test(s)), "fatta (il segno di adesso): non avvisa più", oggetti());
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
