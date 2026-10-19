// I reel della città dalla porta (19/10) — tutto finto.   node collaudo/reel.mjs
// Controlla: un reel nuovo nella release, fra le 8 e le 16 di Roma, va a Hermes con la chat di JJ e il link della
// release; lo stesso reel non ci va due volte; fuori orario niente; un reel vecchio non si propone; alle 18 si chiede
// a Hermes di farlo uscire, una volta sola; se non era automatico alle 18 non si chiede niente; se Hermes fallisce
// JJ lo legge su Telegram. Controprova: senza TG_CHAT non parte niente.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "reel-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const { giroReel } = await import(join(dir, "worker.mjs"));
let errori = 0;
const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : "  " + JSON.stringify(d))); if (!c) errori++; };
let repo = {}, hermes = [], tgMsg = [], rispostaHermes = {}, reelJson = { data: "2026-10-20", tema: "cafe", descrizione: "giro al Café" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (String(url) === "https://github.com/JJoeBoy93/JJA-VIS/releases/download/reel/reel.json") return reelJson ? j(200, reelJson) : j(404, {});
  if (u.host === "api.telegram.org") { tgMsg.push(JSON.parse(o.body || "{}")); return j(200, { ok: true, result: {} }); }
  if (u.host === "api.github.com") {
    const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""); const m = o.method || "GET";
    if (m === "GET") return repo[p] ? j(200, { content: b64(repo[p]), sha: "s" }) : j(404, { message: "Not Found" });
    if (m === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return j(200, {}); }
  }
  return j(404, {});
};
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", JJAVIS_SEGRETO: "s",
  HERMES: { fetch: async (req) => { const c = JSON.parse(await req.text()); hermes.push({ p: new URL(req.url).pathname, c, segreto: req.headers.get("X-JJAVIS-Segreto") });
    const r = rispostaHermes[new URL(req.url).pathname] || {}; return new Response(JSON.stringify(r), { status: 200 }); } } };
const alle = (giorno, hhmm) => new Date(`${giorno}T${hhmm}:00+02:00`);   // ottobre: Roma è UTC+2 fino al 25

console.log("── la mattina: il reel nuovo va a Hermes");
rispostaHermes = { "/jjavis/reel": { ok: true, message_id: 77, auto: true, perche: [] } };
let e = await giroReel(env, alle("2026-10-20", "09:07"));
ok(e === "bozza" && hermes.length === 1 && hermes[0].p === "/jjavis/reel", "va a Hermes", { e, hermes });
ok(hermes[0].c.chat_id === "42" && hermes[0].c.video === "https://github.com/JJoeBoy93/JJA-VIS/releases/download/reel/reel.mp4" && hermes[0].segreto === "s", "con la chat di JJ, il link della release e il segreto", hermes[0]);
ok(repo["reel/stato.json"].message_id === 77 && repo["reel/stato.json"].auto === true, "lo stato si ricorda il messaggio", repo);
e = await giroReel(env, alle("2026-10-20", "10:07"));
ok(e === "già passato" && hermes.length === 1, "un'ora dopo non lo rimanda", e);
e = await giroReel(env, alle("2026-10-20", "17:07"));
ok(hermes.length === 1, "alle 17 non esce ancora", e);

console.log("── alle 18");
rispostaHermes["/jjavis/reel/esce"] = { ok: true, uscito: true, link: "https://www.instagram.com/reel/X/" };
e = await giroReel(env, alle("2026-10-20", "18:07"));
ok(e === "uscito" && hermes[1].p === "/jjavis/reel/esce" && hermes[1].c.message_id === 77 && hermes[1].c.chat_id === "42", "chiede a Hermes di farlo uscire, quel messaggio", { e, h: hermes[1] });
e = await giroReel(env, alle("2026-10-20", "19:07"));
ok(hermes.length === 2, "alle 19 non lo chiede di nuovo", e);

console.log("── non automatico: alle 18 niente");
repo = {}; hermes = []; reelJson = { data: "2026-10-22", tema: "torre", descrizione: "torre" };
rispostaHermes = { "/jjavis/reel": { ok: true, message_id: 80, auto: false, perche: ["niente musica"] } };
await giroReel(env, alle("2026-10-22", "09:07")); e = await giroReel(env, alle("2026-10-22", "18:07"));
ok(hermes.length === 1 && repo["reel/stato.json"].perche[0] === "niente musica", "la bozza c'è, ma alle 18 non si chiede di uscire", hermes);

console.log("── stesso giorno, tema nuovo: è un altro reel");
repo = {}; hermes = []; reelJson = { data: "2026-10-22", tema: "torre", descrizione: "torre" };
rispostaHermes = { "/jjavis/reel": { ok: true, message_id: 81, auto: true, perche: [] } };
await giroReel(env, alle("2026-10-22", "09:07"));
reelJson = { data: "2026-10-22", tema: "jjavis", descrizione: "cos'è" };
e = await giroReel(env, alle("2026-10-22", "10:07"));
ok(e === "bozza" && hermes.length === 2 && repo["reel/stato.json"].tema === "jjavis", "il reel rigirato con un altro tema va a Hermes", { e, n: hermes.length });

console.log("── fuori orario, reel vecchio, Hermes che cade");
repo = {}; hermes = [];
e = await giroReel(env, alle("2026-10-22", "06:07"));
ok(e === "fuori orario" && !hermes.length, "alle 6 niente", e);
e = await giroReel(env, alle("2026-10-26", "09:07"));
ok(/vecchio/.test(e) && !hermes.length, "un reel di quattro giorni fa non si propone", e);
rispostaHermes = { "/jjavis/reel": { ok: false, errore: "il video non si scarica: HTTP 404" } }; tgMsg = [];
e = await giroReel(env, alle("2026-10-22", "09:07"));
ok(e === "errore" && tgMsg.some((m) => /non è arrivato a Hermes/.test(m.text) && /404/.test(m.text)), "Hermes non ce la fa: JJ lo legge", { e, tgMsg });

console.log("── controprova: senza la chat di JJ non parte niente");
repo = {}; hermes = []; const senza = { ...env }; delete senza.TG_CHAT;
e = await giroReel(senza, alle("2026-10-22", "09:07"));
ok(!hermes.length && /TG_CHAT/.test(e), "senza TG_CHAT niente, e lo dice", e);

console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde");
process.exit(errori ? 1 : 0);
