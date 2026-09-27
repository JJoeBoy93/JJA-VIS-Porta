// Il calendario Google di JJ, finto: chiave vera generata qui, Google finto.
//   node collaudo/google.mjs
// 27 settembre 2026 (Athena). Controlla: il gettone firmato RS256; gli
// appuntamenti di JJ occupano le fasce giuste (ora di Roma, ora legale); i
// compleanni di tutto il giorno non bloccano; un calendario non condiviso NON
// vale libero; la prenotazione finisce in «Athena Trasporti»; /chiudi e /apri
// mettono e tolgono l'evento; Google giu' alla prenotazione = JJ avvisato.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync, createVerify } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "goo-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = (await import(join(dir, "worker.mjs"))).default;
const G = await import(join(dir, "google.js"));

let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const SA = JSON.stringify({ client_email: "robot@progetto.iam.gserviceaccount.com", private_key: privateKey });
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", ORS_KEY: "k", PARTENZA: "Limbiate", BREVO_API_KEY: "b", MITTENTE: "j@x.it",
              GOOGLE_SA: SA, CAL_JJ: "jj@gmail.com", CAL_ATHENA: "athena@group.calendar.google.com" };
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);
const domani = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const dopo = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const roma = (g, h) => new Date(G.istanteRoma(g, h)).toISOString();

let archivio = {}, tgMsg = [], eventi = [], cancellati = [], occupatoJJ = [], errPersonale = null, googleGiu = false, firmaBuona = null;
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "oauth2.googleapis.com") {
    const jwt = new URLSearchParams(o.body).get("assertion").split(".");
    const v = createVerify("RSA-SHA256"); v.update(jwt[0] + "." + jwt[1]);
    firmaBuona = v.verify(publicKey, Buffer.from(jwt[2], "base64url"));
    return j(200, { access_token: "tok", expires_in: 3600 });
  }
  if (u.host === "www.googleapis.com") {
    if (googleGiu) return j(503, { error: { message: "giù" } });
    if (u.pathname.endsWith("/freeBusy")) {
      const cal = { [env.CAL_ATHENA]: { busy: eventi.map((e) => ({ start: roma(e.giorno, e.da), end: roma(e.giorno, e.fino) })) } };
      cal[env.CAL_JJ] = errPersonale ? { errors: [{ reason: errPersonale }] } : { busy: occupatoJJ };
      return j(200, { calendars: cal });
    }
    if ((o.method || "GET") === "DELETE") { cancellati.push(decodeURIComponent(u.pathname.split("/").pop())); return new Response(null, { status: 204 }); }
    const e = JSON.parse(o.body); const id = "ev" + (eventi.length + 1);
    eventi.push({ id, cal: decodeURIComponent(u.pathname.split("/")[4]), titolo: e.summary, giorno: e.start.dateTime.slice(0, 10), da: +e.start.dateTime.slice(11, 13), fino: +e.end.dateTime.slice(11, 13), fuso: e.start.timeZone });
    return j(200, { id });
  }
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
const dec = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));
const post = (p, c) => W.fetch(new Request(`https://porta${p}`, { method: "POST", headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json" }, body: JSON.stringify(c) }), env, ctx);
const get = (p) => W.fetch(new Request(`https://porta${p}`, { headers: { Origin: "https://jjoeboy93.github.io" } }), env, ctx);
const tg = (u) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG }, body: JSON.stringify(u) }), env, ctx);
const scrivi = (text) => tg({ message: { message_id: 5, from: { id: 42 }, chat: { id: 42, type: "private" }, text } });
async function approvato() {
  await post("/preventivo", { servizio: "Consegna conto terzi", da: "Monza", a: "Seriate", nome: "Anna", mail: "a@x.it", consenso: true });
  const r = Object.keys(archivio).filter((k) => k.startsWith("preventivi/")).map((k) => dec(archivio[k])).find((x) => x.stato === "attesa");
  await tg({ callback_query: { id: "q", from: { id: 42 }, data: `pok:${r.id}:sprinter`, message: { message_id: 1, chat: { id: 42 } } } });
  return dec(archivio[`preventivi/${r.id}.json`]);
}

console.log("── il gettone");
let r = await approvato();
let j = await (await get(`/prenota?p=${r.id}&k=${r.chiave}`)).json();
ok(firmaBuona === true, "il gettone per Google è firmato davvero con la chiave dell'account di servizio");

console.log("── i tuoi appuntamenti contano");
occupatoJJ = [{ start: roma(domani, 10), end: roma(domani, 11) }];
j = await (await get(`/prenota?p=${r.id}&k=${r.chiave}`)).json();
ok(j.occupati[domani].join() === "mattina", "un appuntamento di JJ alle 10 occupa la mattina, non il pomeriggio");
occupatoJJ = [{ start: roma(domani, 12), end: roma(domani, 14) }];
j = await (await get(`/prenota?p=${r.id}&k=${r.chiave}`)).json();
ok(j.occupati[domani].sort().join() === "mattina,pomeriggio", "uno dalle 12 alle 14 le occupa tutte e due");
occupatoJJ = [{ start: roma(domani, 0), end: roma(dopo, 0) }];
j = await (await get(`/prenota?p=${r.id}&k=${r.chiave}`)).json();
ok(!j.occupati[domani], "un compleanno (tutto il giorno) non blocca");
occupatoJJ = [];

console.log("── un calendario che non si legge non vale libero");
errPersonale = "notFound";
let x = await get(`/prenota?p=${r.id}&k=${r.chiave}`);
ok(x.status === 503, "calendario personale non condiviso: la pagina dice che non si legge (503), non «tutto libero»");
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: domani, fascia: "mattina" })).status === 503, "e non si prenota");
errPersonale = null;

console.log("── la prenotazione nel tuo calendario");
occupatoJJ = [{ start: roma(domani, 9), end: roma(domani, 10) }];
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: domani, fascia: "mattina" })).status === 409, "domani mattina hai un appuntamento: il cliente non la prende");
tgMsg = [];
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: domani, fascia: "pomeriggio" })).status === 200, "domani pomeriggio sì");
const ev = eventi.at(-1);
ok(ev.cal === env.CAL_ATHENA && ev.giorno === domani && ev.da === 13 && ev.fino === 19 && ev.fuso === "Europe/Rome", "evento in «Athena Trasporti», 13-19 ora di Roma");
ok(ev.titolo.includes("Monza → Seriate") && ev.titolo.includes("Anna"), "col titolo leggibile nel briefing");
ok(dec(archivio[`preventivi/${r.id}.json`]).evento_google === ev.id, "l'id dell'evento resta nel preventivo");
ok(tgMsg.some((m) => m.text.includes("Già nel tuo calendario Google")), "JJ sa che è già sul telefono");
occupatoJJ = [];

console.log("── Google giù al momento sbagliato");
const r2 = await approvato();
await get(`/prenota?p=${r2.id}&k=${r2.chiave}`);
let chiamate = 0; const vero = globalThis.fetch;
globalThis.fetch = async (url, o) => { if (String(url).includes("/events")) return new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 }); return vero(url, o); };
tgMsg = [];
ok((await post("/prenota", { p: r2.id, k: r2.chiave, giorno: dopo, fascia: "mattina" })).status === 200, "il cliente prenota lo stesso (il posto era libero)");
ok(tgMsg.some((m) => m.text.includes("NON segnato nel calendario Google") && m.text.includes("403")), "JJ è avvisato che su Google non c'è, e perché");
globalThis.fetch = vero;

console.log("── /chiudi e /apri");
const g3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const g = (iso) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
await scrivi(`/chiudi ${g(g3)}`);
const ch = eventi.at(-1);
ok(ch.titolo.includes("chiuso") && ch.giorno === g3 && ch.da === 8 && ch.fino === 19, "/chiudi mette «chiuso» nel calendario Athena, tutto il giorno lavorativo");
await scrivi(`/apri ${g(g3)}`);
ok(cancellati.includes(ch.id), "/apri toglie l'evento da Google");
tgMsg = []; await scrivi("/calendario");
ok(tgMsg.at(-1).text.includes("Google collegato"), "/calendario dice se Google è collegato");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
