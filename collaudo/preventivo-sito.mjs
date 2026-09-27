// Il preventivo dal sito, dal modulo al cliente — tutto finto, niente rete.
//   node collaudo/preventivo-sito.mjs
// 27 settembre 2026 (Athena). Controlla: il modulo arriva a JJ con la stima
// e i tasti; niente parte al cliente senza il tocco di JJ; Approva manda la
// mail e prepara WhatsApp; il prezzo di JJ vince; Rifiuta non manda niente;
// il doppio tocco non manda due volte; stima rotta = richiesta comunque a JJ;
// consenso, contatto, origine e robot.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "prev-"));
copyFileSync(join(qui, "..", "worker.js"), join(dir, "worker.mjs"));
copyFileSync(join(qui, "..", "preventivo.js"), join(dir, "preventivo.js"));
const W = (await import(join(dir, "worker.mjs"))).default;

let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const ORIGINE = "https://jjoeboy93.github.io";
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", ORS_KEY: "k", PARTENZA: "Limbiate", BREVO_API_KEY: "b", MITTENTE: "jjavis@x.it" };
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);

let archivio, tgMsg, mail, orsRotto;
function azzera() { archivio = {}; tgMsg = []; mail = []; orsRotto = false; }
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.github.com") {
    const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if ((o.method || "GET") === "GET") return archivio[p] ? j(200, { content: archivio[p], sha: "s" }) : j(404, { message: "Not Found" });
    archivio[p] = JSON.parse(o.body).content; return j(201, {});
  }
  if (u.host === "api.telegram.org") { tgMsg.push({ metodo: u.pathname.split("/").pop(), ...JSON.parse(o.body) }); return j(200, { ok: true, result: { message_id: tgMsg.length } }); }
  if (u.host === "api.brevo.com") { mail.push(JSON.parse(o.body)); return j(201, { messageId: "m" }); }
  if (u.pathname.includes("/geocode/")) return j(200, { features: [{ geometry: { coordinates: [9.1, 45.6] }, properties: { label: u.searchParams.get("text") } }] });
  if (u.pathname.includes("/directions/")) return orsRotto ? j(500, { error: "giù" }) : j(200, { routes: [{ summary: { distance: 120000, duration: 7200 }, extras: { tollways: { summary: [{ value: 1, distance: 50000 }] } } }] });
  throw new Error("rete inattesa: " + url);
};
const ctx = { waitUntil() {} };
const manda = (corpo, origine = ORIGINE) => W.fetch(new Request("https://porta/preventivo", { method: "POST", headers: { Origin: origine, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }), env, ctx);
const tocca = (data) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: 42 }, data, message: { message_id: 1, chat: { id: 42 } } } }) }), env, ctx);
const rispondi = (sopra, testo) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ message: { message_id: 9, from: { id: 42 }, chat: { id: 42, type: "private" }, text: testo, reply_to_message: { text: sopra } } }) }), env, ctx);
const dec = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));
const BUONA = { servizio: "Consegna urgente", da: "Monza", a: "Seriate", quando: "domani", note: "un pallet", nome: "Anna", telefono: "333 123 4567", mail: "anna@esempio.it", consenso: true };

console.log("── il modulo arriva a JJ");
azzera(); let r = await manda(BUONA);
ok(r.status === 201, "il sito riceve 201");
const corpoSito = await r.json();
ok(!JSON.stringify(corpoSito).match(/€|\d{2,} ?€|prezzo/), "al sito non torna nessun prezzo");
const file = Object.keys(archivio).find((k) => k.startsWith("preventivi/"));
const rec = dec(archivio[file]); const id = rec.id;
ok(rec.stato === "attesa" && rec.stima && rec.telefono === "393331234567", "salvato in preventivi/, in attesa, con la stima");
const avviso = tgMsg.find((m) => m.text && m.text.includes(`#p${id}`));
ok(avviso && avviso.text.includes("URGENTE") && avviso.text.includes("Al cliente partirà"), "Telegram: stima urgente e il testo che partirà");
const [tS, tP] = avviso.reply_markup.inline_keyboard[0];
ok(tS.callback_data === `pok:${id}:sprinter` && tS.text.includes(`${rec.stima.prezzi.sprinter} €`), "tasto Sprinter col suo prezzo");
ok(tP.callback_data === `pok:${id}:panda` && rec.stima.prezzi.panda < rec.stima.prezzi.sprinter, "tasto Panda, più economico");
ok(avviso.text.includes("🚗 con la Panda"), "la stima dice anche il prezzo con la Panda");
ok(mail.length === 0, "niente mail al cliente prima del tocco di JJ");

console.log("── approva");
tgMsg = []; await tocca(`pok:${id}:panda`);
ok(mail.length === 1 && mail[0].to[0].email === "anna@esempio.it" && mail[0].replyTo.email === "jja.athenatrasporti@gmail.com", "mail al cliente, le risposte vanno ad Athena");
ok(mail[0].textContent.includes(`${rec.stima.prezzi.panda} €`) && mail[0].sender.name === "Athena Trasporti", "col prezzo della Panda scelta, firmata Athena Trasporti");
const wa = tgMsg.find((m) => m.reply_markup && m.reply_markup.inline_keyboard[0][0].url);
ok(wa && wa.reply_markup.inline_keyboard[0][0].url.startsWith("https://wa.me/393331234567?text="), "tasto WhatsApp verso il numero del cliente");
ok(dec(archivio[file]).stato === "approvato" && dec(archivio[file]).prezzo_finale === rec.stima.prezzi.panda && dec(archivio[file]).mezzo === "panda", "segnato approvato, col prezzo e il mezzo");
await tocca(`pok:${id}:sprinter`);
ok(mail.length === 1 && tgMsg.some((m) => m.text && m.text.includes("già approvato")), "il doppio tocco non manda due volte");

console.log("── il prezzo di JJ");
azzera(); await manda(BUONA); let id2 = dec(archivio[Object.keys(archivio)[0]]).id;
await rispondi(`📦 PREVENTIVO  #p${id2}`, "ciao");
ok(mail.length === 0 && tgMsg.some((m) => m.text && m.text.includes("solo col prezzo")), "un testo che non è una cifra non manda niente");
await rispondi(`📦 PREVENTIVO  #p${id2}`, "150 €");
ok(mail.length === 1 && mail[0].textContent.includes("150 €"), "«150 €» in risposta: parte a 150");
ok(dec(archivio[`preventivi/${id2}.json`]).cambiato_da_jj === true, "si segna che JJ l'ha cambiato (per imparare)");

console.log("── rifiuta");
azzera(); await manda(BUONA); id2 = dec(archivio[Object.keys(archivio)[0]]).id;
await tocca(`pno:${id2}`);
ok(mail.length === 0 && dec(archivio[`preventivi/${id2}.json`]).stato === "rifiutato", "rifiutato: al cliente non parte niente");

console.log("── la stima si rompe");
azzera(); orsRotto = true; r = await manda(BUONA);
const avv2 = tgMsg.find((m) => m.text && m.text.includes("PREVENTIVO"));
ok(r.status === 201 && avv2 && avv2.text.includes("Stima non fatta"), "la richiesta arriva a JJ lo stesso, col motivo");
ok(!avv2.reply_markup.inline_keyboard.flat().some((b) => b.callback_data && b.callback_data.startsWith("pok")), "senza stima niente «Approva»: JJ risponde col prezzo");

console.log("── cosa si rifiuta");
azzera();
ok((await manda({ ...BUONA, consenso: false })).status === 400, "senza consenso");
ok((await manda({ ...BUONA, telefono: "", mail: "" })).status === 400, "senza telefono né mail");
ok((await manda(BUONA, "https://altro.sito")).status === 403, "da un altro sito");
ok((await manda({ ...BUONA, servizio: "Rapina" })).status === 400, "un servizio che non esiste");
r = await manda({ ...BUONA, sito: "http://spam" });
ok(r.status === 200 && !Object.keys(archivio).length && !tgMsg.length, "il robot: ok finto, niente salvato, niente a JJ");
tgMsg = []; ok((await manda({ servizio: "Sgombero", da: "Limbiate", nome: "Bea", mail: "b@x.it", consenso: true })).status === 201, "sgombero senza «a dove»: va bene");
ok(!tgMsg.find((m) => m.text && m.text.includes("PREVENTIVO")).reply_markup.inline_keyboard.flat().some((b) => String(b.callback_data).endsWith(":panda")), "lo sgombero: solo Sprinter");

console.log("── multitappa dal sito");
azzera(); r = await manda({ ...BUONA, tappe: "Bergamo\n\nBrescia\n" });
const recT = dec(archivio[Object.keys(archivio).find((k) => k.startsWith("preventivi/"))]);
ok(r.status === 201 && recT.tappe.join("|") === "Bergamo|Brescia", "le tappe, una per riga, righe vuote tolte");
ok(tgMsg.some((m) => m.text && m.text.includes("Monza → Bergamo → Brescia → Seriate") && m.text.includes("con tappe a Bergamo, Brescia")), "JJ vede il giro, e il cliente leggerà le tappe");
ok((await manda({ ...BUONA, tappe: Array(9).fill("X").join("\n") })).status === 400, "oltre 8 tappe: rifiutato con un motivo");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
