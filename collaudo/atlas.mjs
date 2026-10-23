// Atlas, gli impegni passati (23/10, JJ) — tutto finto.   node collaudo/atlas.mjs
// Controlla: un impegno passato NON si cancella da solo; la mattina Atlas chiede «l'hai fatto?», UNA volta sola; un impegno
// futuro non viene chiesto; di notte niente. Controprova: prima la cancellazione dopo 2 giorni era silenziosa — ora non più.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "atlas-"));
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
const oggetti = () => posta.map((m) => m.subject);
const imp = () => repo["atlas.json"]["je@prova.it"].impegni;

// impegni: uno PASSATO (ieri), uno di oggi, uno futuro
repo["atlas.json"] = { "je@prova.it": { nome: "Jessica", turni: [], scadenze: [], impegni: [
  { id: "p1", cosa: "Ponte di Legno", giorno: "2026-10-22", ora: null, ics: true },
  { id: "o1", cosa: "cup", giorno: "2026-10-23", ora: "10:00", ics: true, avvisato: true },
  { id: "f1", cosa: "dentista", giorno: "2026-10-28", ora: "15:00", ics: true },
] } };

// mattina del 23: l'impegno passato (22) viene CHIESTO, non cancellato
await W.atlasPromemoria(env, alle("2026-10-23", "07:30"));
ok(oggetti().some((s) => /L'hai fatto|li hai fatti/i.test(s) && /Ponte di Legno/.test(s)), "la mattina chiede «l'hai fatto?» per l'impegno passato", oggetti());
ok(imp().some((x) => x.id === "p1"), "l'impegno passato NON è stato cancellato: è ancora lì, in attesa di risposta", imp().map((x) => x.id));
ok(imp().find((x) => x.id === "p1").da_confermare === true, "l'impegno passato è segnato da_confermare");
ok(!oggetti().some((s) => /dentista/.test(s) && /hai fatto/i.test(s)), "l'impegno futuro (dentista) non viene chiesto", oggetti());

// stessa mattina, altro giro: NON richiede (una volta sola)
posta = []; await W.atlasPromemoria(env, alle("2026-10-23", "11:00"));
ok(!oggetti().some((s) => /Ponte di Legno/.test(s)), "non richiede lo stesso impegno due volte nello stesso giorno", oggetti());

// di notte: niente
posta = []; await W.atlasPromemoria(env, alle("2026-10-24", "05:00"));
ok(!oggetti().some((s) => /hai fatto/i.test(s)), "di notte (alle 5) non chiede niente", oggetti());

// giorni dopo: l'impegno passato resta finché non risponde (non sparisce dopo 2 giorni come prima)
await W.atlasPromemoria(env, alle("2026-10-26", "08:00"));
ok(imp().some((x) => x.id === "p1"), "dopo 3 giorni l'impegno passato è ancora lì (niente più cancellazione silenziosa)", imp().map((x) => x.id));

// quando lei risponde, il modello chiude o sposta (applicaEsito è la meccanica dietro)
let ff = { impegni: [{ id: "p1", cosa: "Ponte di Legno", giorno: "2026-10-20", ora: null, da_confermare: true, chiesto: "2026-10-23" }] };
W.applicaEsito(ff, { tolti: ["p1"] });
ok(!ff.impegni.some((x) => x.id === "p1"), "«sì, fatto» (id in «tolti») → l'impegno confermato sparisce", ff.impegni.map((x) => x.id));
ff = { impegni: [{ id: "p2", cosa: "cup", giorno: "2026-10-22", ora: "10:00", da_confermare: true, chiesto: "2026-10-23" }] };
W.applicaEsito(ff, { tolti: ["p2"], nuovi: [{ cosa: "cup", giorno: "2026-10-31", ora: "10:00" }] });
ok(!ff.impegni.some((x) => x.id === "p2") && ff.impegni.some((x) => x.cosa === "cup" && x.giorno === "2026-10-31" && !x.da_confermare),
  "«no, spostalo» → il vecchio sparisce e il nuovo è in programma, senza da_confermare", ff.impegni);

console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde");
process.exit(errori ? 1 : 0);
