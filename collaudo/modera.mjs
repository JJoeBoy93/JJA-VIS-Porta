// Moderare la città da Telegram (10/10) — tutto finto.   node collaudo/modera.mjs
// Controlla: i tasti sotto la segnalazione (cz/cb) vanno al server della città, firmati col token del bot; la risposta dice
// cosa è successo; i tasti spariscono solo se è fatto; se il server dice no, lo si dice («NON fatto»); uno sconosciuto no.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, createHmac } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "modera-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = (await import(join(dir, "worker.mjs"))).default;
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42" };
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);
let tgMsg = [], citta = [], rispostaCitta = { ok: true, azione: "zittisci", n: "Cattivo99", fino: Date.now() + 3600000, dentro: true };
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.telegram.org") { tgMsg.push({ metodo: u.pathname.split("/").pop(), ...JSON.parse(o.body || "{}") }); return j(200, { ok: true, result: {} }); }
  if (u.host === "jjavis-citta.jjavis.workers.dev") { citta.push({ via: u.pathname, corpo: o.body, firma: o.headers["X-Firma"] }); return j(rispostaCitta.ok ? 200 : 400, rispostaCitta); }
  return j(404, { message: "Not Found" });
};
const tasto = (data, da = 42) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: da }, data, message: { message_id: 9, chat: { id: 42 } } } }) }), env, { waitUntil() {} });

console.log("── Zittisci 1 ora");
await tasto("cz:60:g:12345");
const c = citta[0], corpo = c && JSON.parse(c.corpo);
ok(c && c.via === "/modera-tg" && corpo.uid === "g:12345" && corpo.azione === "zittisci" && corpo.minuti === 60, "va al server della città, per l'account (uid), con l'azione e i minuti");
ok(c && c.firma === createHmac("sha256", "bot").update(c.corpo).digest("hex"), "firmato col token del bot (HMAC-SHA256 del corpo), come vuole il server");
const r = tgMsg.find(m => m.metodo === "sendMessage");
ok(r && /🔇 «Cattivo99» zittito fino alle \d\d:\d\d$/.test(r.text) && r.reply_to_message_id === 9, "la risposta, sotto la segnalazione: chi e fino a quando");
ok(tgMsg.some(m => m.metodo === "editMessageReplyMarkup"), "fatto: i tasti spariscono");

console.log("── Blocca, mentre non è in città");
tgMsg = []; citta = []; rispostaCitta = { ok: true, azione: "blocca", n: null, dentro: false };
await tasto("cb:0:g:12345");
ok(JSON.parse(citta[0].corpo).azione === "blocca", "blocca");
ok(/⛔ il segnalato bloccato \(ora non è in città: non potrà rientrare\)/.test(tgMsg.find(m => m.metodo === "sendMessage").text), "dice che vale anche se ora non c'è");

console.log("── il server dice no");
tgMsg = []; citta = []; rispostaCitta = { ok: false, perche: "admin" };
await tasto("cb:0:g:capo");
ok(/^NON fatto — admin/.test(tgMsg.find(m => m.metodo === "sendMessage").text), "«NON fatto», col perché");
ok(!tgMsg.some(m => m.metodo === "editMessageReplyMarkup"), "i tasti restano, si può riprovare");

console.log("── uno sconosciuto");
tgMsg = []; citta = [];
await tasto("cb:0:g:12345", 777);
ok(!citta.length && tgMsg.some(m => m.metodo === "answerCallbackQuery" && m.text === "non sei tu"), "non arriva al server della città");

console.log(errori ? `\n${errori} prove ROSSE` : "\nVERDE");
process.exit(errori ? 1 : 0);
