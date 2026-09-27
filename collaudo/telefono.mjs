// L'agenda del telefono di JJ, vista dalla porta — Hermes finto.
//   node collaudo/telefono.mjs
// 27 settembre 2026 (Athena). Controlla: le mezze giornate occupate sul
// telefono non si prenotano; agenda mai arrivata o vecchia = niente
// prenotazioni (non «tutto libero»); il lavoro confermato va al telefono con
// id, giorno, fasce e servizio e NIENT'ALTRO; un lavoro che il telefono non ha
// si rimanda; /calendario dice quanto è fresca l'agenda.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "tel-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = (await import(join(dir, "worker.mjs"))).default;

let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const domani = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const dopo = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
let agenda = { aggiornato: "2026-09-27T12:00:00", minuti_fa: 3, occupati: { [domani]: ["mattina"] }, athena: [], in_coda: [] };
let aHermes = [], hermesGiu = false;
const HERMES = { fetch: async (req) => {
  const u = new URL(req.url); const segreto = req.headers.get("X-JJAVIS-Segreto");
  if (segreto !== "s") return new Response("no", { status: 403 });
  if (hermesGiu) return new Response(JSON.stringify({ errore: "Space non raggiungibile" }), { status: 502 });
  if (u.pathname === "/jjavis/agenda") return new Response(JSON.stringify(agenda));
  const corpo = await req.json(); aHermes.push(corpo); agenda.in_coda.push(corpo.id);
  return new Response(JSON.stringify({ ok: true, in_coda: true }));
} };
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", ORS_KEY: "k", PARTENZA: "Limbiate", BREVO_API_KEY: "b", MITTENTE: "j@x.it", HERMES, JJAVIS_SEGRETO: "s" };
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);
let archivio = {}, tgMsg = [];
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.github.com") {
    const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if ((o.method || "GET") === "GET") return archivio[p] ? j(200, { content: archivio[p], sha: "s" }) : j(404, { message: "Not Found" });
    archivio[p] = JSON.parse(o.body).content; return j(201, {});
  }
  if (u.host === "api.telegram.org") { tgMsg.push(JSON.parse(o.body)); return j(200, { ok: true, result: {} }); }
  if (u.host === "api.brevo.com") return j(201, {});
  if (u.pathname.includes("/geocode/")) return j(200, { features: [{ geometry: { coordinates: [9, 45] }, properties: { label: u.searchParams.get("text") } }] });
  return j(200, { routes: [{ summary: { distance: 50000, duration: 7200 }, extras: { tollways: { summary: [] } } }] });
};
const ctx = { waitUntil() {} };
const caparra = (id) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": createHash("sha256").update("bot").digest("hex").slice(0, 32) }, body: JSON.stringify({ callback_query: { id: "q", from: { id: 42 }, data: `cap:${id}`, message: { message_id: 1, chat: { id: 42 } } } }) }), env, ctx);
const dec = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));
const post = (p, c) => W.fetch(new Request(`https://porta${p}`, { method: "POST", headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json" }, body: JSON.stringify(c) }), env, ctx);
const get = (p) => W.fetch(new Request(`https://porta${p}`, { headers: { Origin: "https://jjoeboy93.github.io" } }), env, ctx);
const tg = (u) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG }, body: JSON.stringify(u) }), env, ctx);
async function approvato() {
  await post("/preventivo", { servizio: "Sgombero", da: "Via Roma 3, Limbiate", nome: "Mario Rossi", telefono: "3331234567", consenso: true, note: "tre armadi" });
  const r = Object.keys(archivio).filter((k) => k.startsWith("preventivi/")).map((k) => dec(archivio[k])).find((x) => x.stato === "attesa");
  await tg({ callback_query: { id: "q", from: { id: 42 }, data: `pok:${r.id}:sprinter`, message: { message_id: 1, chat: { id: 42 } } } });
  return dec(archivio[`preventivi/${r.id}.json`]);
}

console.log("── il telefono dice quando sei occupato");
const r = await approvato();
let x; let j = await (await get(`/prenota?p=${r.id}&k=${r.chiave}`)).json();
ok(j.occupati[domani] && j.occupati[domani].includes("mattina"), "domani mattina occupata sul telefono: la pagina la vede grigia");

console.log("── agenda che manca o vecchia");
agenda.aggiornato = null; const salvati = agenda.occupati; agenda.occupati = {};
x = await get(`/prenota?p=${r.id}&k=${r.chiave}`);
ok(x.status === 200, "il telefono non ha ancora mandato l'agenda (APK vecchio): si prenota sul registro della porta, come prima");
tgMsg = []; await tg({ message: { message_id: 5, from: { id: 42 }, chat: { id: 42, type: "private" }, text: "/calendario" } });
ok(tgMsg.at(-1).text.includes("non ha ancora mandato l'agenda"), "e /calendario lo dice a JJ");
agenda.occupati = salvati;
agenda.aggiornato = "2026-09-26T08:00:00"; agenda.minuti_fa = 800;
ok((await get(`/prenota?p=${r.id}&k=${r.chiave}`)).status === 503, "agenda vecchia di 13 ore: 503");
agenda.minuti_fa = 3; hermesGiu = true;
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: dopo })).status === 503, "Hermes o lo Space giù: non si prenota");
hermesGiu = false;

console.log("── la prenotazione va al telefono, e basta quella");
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: domani })).status === 409, "lo sgombero (giornata intera) non entra in un giorno con la mattina presa");
tgMsg = []; aHermes = [];
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: dopo })).status === 200, "dopodomani sì");
await get(`/prenota?p=${r.id}&k=${r.chiave}`);
ok(!aHermes.length, "bloccato in attesa della caparra: al telefono non va ancora");
await caparra(r.id);
const mandato = aHermes.at(-1);
ok(mandato && mandato.id === r.id && mandato.giorno === dopo && mandato.fasce.sort().join() === "mattina,pomeriggio" && mandato.servizio === "Sgombero", "al telefono: id, giorno, fasce, servizio");
ok(Object.keys(mandato).sort().join() === "fasce,giorno,id,servizio" && !JSON.stringify(mandato).match(/Mario|Roma|armadi|333/), "niente nome, indirizzo, note o telefono del cliente verso JARVIS");
ok(tgMsg.some((m) => m.text.includes("calendario del telefono")), "JJ sa che entro 15 minuti è sul telefono");

console.log("── il lavoro che il telefono ha perso si rimanda");
agenda.in_coda = []; agenda.athena = []; aHermes = [];
await get(`/prenota?p=${r.id}&k=${r.chiave}`);
ok(aHermes.length === 1 && aHermes[0].id === r.id, "lo Space è ripartito e l'ha perso: la porta lo rimanda");
agenda.athena = [r.id]; aHermes = [];
await get(`/prenota?p=${r.id}&k=${r.chiave}`);
ok(aHermes.length === 0, "quando il telefono lo mostra, non si rimanda più");

console.log("── /calendario");
tgMsg = []; await tg({ message: { message_id: 5, from: { id: 42 }, chat: { id: 42, type: "private" }, text: "/calendario" } });
ok(tgMsg.at(-1).text.includes("calendario del telefono: aggiornato 3 min fa"), "dice quanto è fresca l'agenda del telefono");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
