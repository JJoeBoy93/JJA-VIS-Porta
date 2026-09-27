// Il calendario: dal preventivo approvato alla prenotazione, tutto finto.
//   node collaudo/calendario.mjs
// 27 settembre 2026 (Athena). Controlla: il link nel preventivo; senza la
// chiave non si vede e non si prenota; la prenotazione segna il calendario e
// avvisa JJ; due persone sullo stesso momento; un lavoro lungo prende tutta la
// giornata; /chiudi e /apri non toccano i lavori prenotati; il sito non vede
// di chi e' un giorno.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "cal-"));
copyFileSync(join(qui, "..", "worker.js"), join(dir, "worker.mjs"));
copyFileSync(join(qui, "..", "preventivo.js"), join(dir, "preventivo.js"));
copyFileSync(join(qui, "..", "google.js"), join(dir, "google.js"));
const W = (await import(join(dir, "worker.mjs"))).default;

let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const ORIGINE = "https://jjoeboy93.github.io";
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", ORS_KEY: "k", PARTENZA: "Limbiate", BREVO_API_KEY: "b", MITTENTE: "j@x.it" };
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);
let archivio = {}, tgMsg = [], mail = [], ore = 2;
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.github.com") {
    const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if ((o.method || "GET") === "GET") return archivio[p] ? j(200, { content: archivio[p], sha: "s" }) : j(404, { message: "Not Found" });
    archivio[p] = JSON.parse(o.body).content; return j(201, {});
  }
  if (u.host === "api.telegram.org") { tgMsg.push(JSON.parse(o.body)); return j(200, { ok: true, result: {} }); }
  if (u.host === "api.brevo.com") { mail.push(JSON.parse(o.body)); return j(201, {}); }
  if (u.pathname.includes("/geocode/")) return j(200, { features: [{ geometry: { coordinates: [9, 45] }, properties: { label: u.searchParams.get("text") } }] });
  return j(200, { routes: [{ summary: { distance: 50000, duration: ore * 3600 }, extras: { tollways: { summary: [] } } }] });
};
const ctx = { waitUntil() {} };
const dec = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));
const post = (p, corpo, origine = ORIGINE) => W.fetch(new Request(`https://porta${p}`, { method: "POST", headers: { Origin: origine, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }), env, ctx);
const get = (p) => W.fetch(new Request(`https://porta${p}`, { headers: { Origin: ORIGINE } }), env, ctx);
const tg = (u) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG }, body: JSON.stringify(u) }), env, ctx);
const tocca = (data) => tg({ callback_query: { id: "q", from: { id: 42 }, data, message: { message_id: 1, chat: { id: 42 } } } });
const scrivi = (text) => tg({ message: { message_id: 5, from: { id: 42 }, chat: { id: 42, type: "private" }, text } });
const domani = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const dopodomani = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

async function preventivoApprovato(oreLavoro = 2) {
  ore = oreLavoro;
  await post("/preventivo", { servizio: "Consegna conto terzi", da: "Monza", a: "Seriate", nome: "Anna", mail: "a@x.it", consenso: true });
  const file = Object.keys(archivio).filter((k) => k.startsWith("preventivi/")).map((k) => dec(archivio[k])).find((r) => r.stato === "attesa");
  await tocca(`pok:${file.id}:sprinter`);
  return dec(archivio[`preventivi/${file.id}.json`]);
}

console.log("── il link nel preventivo");
let r = await preventivoApprovato();
ok(/^[0-9a-f]{16}$/.test(r.chiave), "ogni preventivo ha la sua chiave");
const link = `https://jjoeboy93.github.io/athena-trasporti/prenota.html?p=${r.id}&k=${r.chiave}`;
ok(mail.at(-1).textContent.includes(link), "la mail al cliente ha il link per scegliere il giorno");

console.log("── la pagina");
let x = await get(`/prenota?p=${r.id}&k=${r.chiave}`); let j = await x.json();
ok(x.status === 200 && j.prezzo === r.prezzo_finale && j.giorni[0] === domani && j.giornata === false, "vede prezzo, giorni da domani, mezza giornata");
ok((await get(`/prenota?p=${r.id}&k=0000000000000000`)).status === 404, "chiave sbagliata: non vede niente");
ok(!JSON.stringify(j).includes("a@x.it") && !JSON.stringify(j).includes("Anna"), "la pagina non riceve mail né nome");

console.log("── prenotare");
ok((await post("/prenota", { p: r.id, k: "0000000000000000", giorno: domani, fascia: "mattina" })).status === 404, "chiave sbagliata: non prenota");
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: "2020-01-01", fascia: "mattina" })).status === 400, "un giorno passato: no");
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: domani, fascia: "notte" })).status === 400, "una fascia che non esiste: no");
tgMsg = [];
x = await post("/prenota", { p: r.id, k: r.chiave, giorno: domani, fascia: "mattina" });
ok(x.status === 200, "prenota domani mattina");
const cal = dec(archivio["calendario.json"]);
ok(cal[domani].mattina.preventivo === r.id && !cal[domani].pomeriggio, "segnato nel calendario, solo la mattina");
ok(dec(archivio[`preventivi/${r.id}.json`]).stato === "caparra", "il preventivo è bloccato in attesa della caparra");
const bloc = tgMsg.find((m) => m.text.includes("📅 BLOCCATO") && m.text.includes("mattina"));
ok(bloc && bloc.reply_markup.inline_keyboard[0][0].callback_data === `cap:${r.id}`, "JJ lo sa su Telegram, col tasto «Caparra arrivata»");
ok(x.status === 200 && (await x.json()).caparra === (r.prezzo_finale < 100 ? r.prezzo_finale : Math.ceil(r.prezzo_finale * 0.3 / 5) * 5), "alla pagina torna quanto pagare");
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: dopodomani, fascia: "mattina" })).status === 409, "bloccato: non si prenota un secondo giorno");
tgMsg = []; await tocca(`cap:${r.id}`);
ok(dec(archivio[`preventivi/${r.id}.json`]).stato === "confermato" && !dec(archivio["calendario.json"])[domani].mattina.caparra, "«Caparra arrivata»: confermato");
ok(tgMsg.some((m) => m.text.includes("confermato")), "e JJ lo legge");
ok((await post("/prenota", { p: r.id, k: r.chiave, giorno: dopodomani, fascia: "mattina" })).status === 409, "lo stesso preventivo non prenota due volte");
j = await (await get(`/prenota?p=${r.id}&k=${r.chiave}`)).json();
ok(j.occupati[domani].join() === "mattina" && !JSON.stringify(j.occupati).includes(r.id), "il sito vede domani mattina occupato, non di chi");

console.log("── un altro cliente, lo stesso momento");
const r2 = await preventivoApprovato();
ok((await post("/prenota", { p: r2.id, k: r2.chiave, giorno: domani, fascia: "mattina" })).status === 409, "domani mattina è preso: rifiutato");
ok((await post("/prenota", { p: r2.id, k: r2.chiave, giorno: domani, fascia: "pomeriggio" })).status === 200, "domani pomeriggio va");

console.log("── un lavoro lungo");
const r3 = await preventivoApprovato(6);
j = await (await get(`/prenota?p=${r3.id}&k=${r3.chiave}`)).json();
ok(j.giornata === true, "oltre 4 ore: la pagina sa che serve la giornata");
ok((await post("/prenota", { p: r3.id, k: r3.chiave, giorno: domani })).status === 409, "domani è mezzo occupato: la giornata intera non ci sta");
ok((await post("/prenota", { p: r3.id, k: r3.chiave, giorno: dopodomani })).status === 200, "dopodomani sì");
const c3 = dec(archivio["calendario.json"])[dopodomani];
ok(c3.mattina.preventivo === r3.id && c3.pomeriggio.preventivo === r3.id, "prende mattina e pomeriggio");

console.log("── JJ chiude e apre");
const g = (iso) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
const fra3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
tgMsg = []; await scrivi(`/chiudi ${g(fra3)} pomeriggio`);
ok(dec(archivio["calendario.json"])[fra3].pomeriggio.chiuso === true && tgMsg.at(-1).text.includes("chiuso"), "/chiudi 30/9 pomeriggio");
const r4 = await preventivoApprovato();
ok((await post("/prenota", { p: r4.id, k: r4.chiave, giorno: fra3, fascia: "pomeriggio" })).status === 409, "un cliente non prende un pomeriggio chiuso");
tgMsg = []; await scrivi(`/apri ${g(domani)}`);
const c1 = dec(archivio["calendario.json"])[domani];
ok(c1 && c1.mattina.preventivo === r.id && tgMsg.at(-1).text.includes("non l'ho toccato"), "/apri su un giorno prenotato non cancella i lavori, e lo dice");
tgMsg = []; await scrivi("/calendario");
ok(tgMsg.at(-1).text.includes(`#p${r.id}`) && tgMsg.at(-1).text.includes("chiuso"), "/calendario elenca lavori e giorni chiusi");
tgMsg = []; await scrivi("/chiudi domani");
ok(tgMsg.at(-1).text.startsWith("Scrivi così"), "una data che non capisce: spiega come si scrive");

console.log("── la caparra");
const P = await import(join(dir, "preventivo.js"));
ok(P.caparraDi(90).tutto && P.caparraDi(90).importo === 90, "sotto i 100 €: tutto anticipato");
ok(!P.caparraDi(120).tutto && P.caparraDi(120).importo === 40 && P.caparraDi(845).importo === 255, "sopra: 30% arrotondato a 5 € in su (120 → 40, 845 → 255)");
ok(P.caparraDi(100).importo === 30, "a 100 € esatti: caparra");
ok(mail.some((m) => m.textContent.includes("caparra di") || m.textContent.includes("pagamento anticipato")), "il preventivo al cliente dice già della caparra");
const r5 = await preventivoApprovato();
const fra5 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
await post("/prenota", { p: r5.id, k: r5.chiave, giorno: fra5, fascia: "mattina" });
tgMsg = []; await tocca(`lib:${r5.id}`);
ok(!(dec(archivio["calendario.json"])[fra5] || {}).mattina && dec(archivio[`preventivi/${r5.id}.json`]).stato === "approvato", "«Libera il giorno»: il posto torna libero, il preventivo si può riprenotare");
ok(tgMsg.some((m) => m.text.includes("liberato")), "e JJ lo legge");
ok((await post("/prenota", { p: r5.id, k: r5.chiave, giorno: fra5, fascia: "mattina" })).status === 200, "il cliente può riscegliere");
mail = []; await tocca(`cap:${r5.id}`);
ok(mail.some((m) => m.subject.startsWith("Confermato") && m.to[0].email === "a@x.it"), "confermato: al cliente arriva la mail di conferma");
await tocca(`cap:${r5.id}`);
ok(mail.filter((m) => m.subject.startsWith("Confermato")).length === 1, "il doppio tocco non manda due conferme");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
