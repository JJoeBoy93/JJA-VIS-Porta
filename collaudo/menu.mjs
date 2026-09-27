// Il menu dei comandi — tutto finto.   node collaudo/menu.mjs
// 27 settembre 2026 (Athena). Controlla: il tasto «Menu» di Telegram si
// imposta solo nelle chat di JJ; /menu manda il riepilogo e i tasti; ogni
// voce del menu è un comando che la porta capisce davvero (un menu che
// promette un comando che non c'è sarebbe peggio di nessun menu); i tasti
// eseguono il comando; uno sconosciuto non li usa.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "menu-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const M = await import(join(dir, "worker.mjs")); const W = M.default;
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", TG_GRUPPO: "-1001234567890", ORS_KEY: "k", PARTENZA: "Limbiate" };
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);
let tgMsg = [];
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.telegram.org") { tgMsg.push({ metodo: u.pathname.split("/").pop(), ...JSON.parse(o.body || "{}") }); return j(200, { ok: true, result: {} }); }
  return j(404, { message: "Not Found" });
};
const tg = (u) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG }, body: JSON.stringify(u) }), env, { waitUntil() {} });
const scrivi = (text, da = 42) => tg({ message: { message_id: 5, from: { id: da }, chat: { id: 42, type: "private" }, text } });
const FALLBACK = "Per rispondere a qualcuno";

console.log("── il tasto Menu di Telegram");
await scrivi("/menu");
const set = tgMsg.filter((m) => m.metodo === "setMyCommands");
ok(set.length === 2 && set.map((s) => String(s.scope.chat_id)).sort().join() === "-1001234567890,42" && set.every((s) => s.scope.type === "chat"), "impostato solo per la chat di JJ e il suo gruppo");
ok(set[0].commands.every((c) => /^[a-z0-9_]{1,32}$/.test(c.command) && c.description.length >= 3 && c.description.length <= 256), "nomi e descrizioni nei limiti di Telegram");
const menu = tgMsg.find((m) => m.metodo === "sendMessage" && m.text.startsWith("📋"));
ok(menu && menu.reply_markup.inline_keyboard.flat().length >= 4, "/menu: il riepilogo coi tasti");
tgMsg = []; await scrivi("/calendario");
ok(!tgMsg.some((m) => m.metodo === "setMyCommands"), "il Menu si imposta una volta, non a ogni messaggio");

console.log("── ogni voce del menu è un comando vero");
for (const [c] of M.COMANDI) {
  tgMsg = []; await scrivi(`/${c}`);
  const r = tgMsg.filter((m) => m.metodo === "sendMessage");
  ok(r.length && !r.some((m) => m.text.startsWith(FALLBACK)), `/${c} risponde`);
  ok(menu.text.includes(`/${c}`), `/${c} sta anche nel riepilogo`);
}

console.log("── i tasti");
for (const b of menu.reply_markup.inline_keyboard.flat()) {
  tgMsg = [];
  await tg({ callback_query: { id: "q", from: { id: 42 }, data: b.callback_data, message: { message_id: 9, chat: { id: 42, type: "private" } } } });
  const r = tgMsg.filter((m) => m.metodo === "sendMessage");
  ok(r.length && !r.some((m) => m.text.startsWith(FALLBACK)), `«${b.text}» esegue ${b.callback_data.slice(5)}`);
}
tgMsg = [];
await tg({ callback_query: { id: "q", from: { id: 666 }, data: "menu:calendario", message: { message_id: 9, chat: { id: 42, type: "private" } } } });
ok(!tgMsg.some((m) => m.metodo === "sendMessage") && tgMsg.some((m) => m.text === "non sei tu"), "uno sconosciuto non usa i tasti");
tgMsg = []; await scrivi("/menu", 666);
ok(!tgMsg.length, "uno sconosciuto che scrive /menu non riceve niente");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
