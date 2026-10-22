// Ares parla a JJ (23/10) — tutto finto.   node collaudo/ares.mjs
// Controlla: con la chiave giusta il messaggio arriva nella chat di JJ; senza chiave, o sbagliata, 403 e niente Telegram;
// messaggio vuoto 400; Telegram giù → 502 (Ares lo scrive nel suo registro: un avviso perso non sembra un avviso mandato).
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url"; import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "ares-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
let telegram = [], giu = false;
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "api.telegram.org") { if (giu) return new Response('{"ok":false,"description":"giù"}'); telegram.push(JSON.parse(o.body)); return new Response('{"ok":true,"result":{"message_id":1}}'); }
  return new Response("{}", { status: 404 }); };
// la chiave vera non sta nel repository: il collaudo sostituisce l'impronta con quella di una chiave di prova
const src = readFileSync(join(dir, "worker.mjs"), "utf8").replace(/const IMPRONTA_ARES = "[0-9a-f]{64}";/, `const IMPRONTA_ARES = "${createHash("sha256").update("chiave-di-prova").digest("hex")}";`);
import("node:fs").then(() => {});
const { writeFileSync } = await import("node:fs"); writeFileSync(join(dir, "w2.mjs"), src); const W2 = await import(join(dir, "w2.mjs"));
const env = { TG_BOT_TOKEN: "t", TG_CHAT: "42" };
const manda = (k, corpo) => W2.default.fetch(new Request("https://porta/ares", { method: "POST", headers: { "content-type": "application/json", ...(k ? { "X-Chiave": k } : {}) }, body: JSON.stringify(corpo) }), env, { waitUntil() {} });
let r = await manda("", { testo: "🛡 ARES — prova" }); ok(r.status === 403 && !telegram.length, "senza chiave: 403, niente Telegram");
r = await manda("sbagliata", { testo: "🛡 ARES — prova" }); ok(r.status === 403 && !telegram.length, "chiave sbagliata: 403, niente Telegram");
r = await manda("chiave-di-prova", { testo: "🛡 ARES — 23/10: tutto in ordine" });
ok(r.status === 200 && telegram.length === 1 && telegram[0].chat_id === "42" && /tutto in ordine/.test(telegram[0].text), "chiave giusta: il messaggio va nella chat di JJ", telegram);
r = await manda("chiave-di-prova", { testo: "" }); ok(r.status === 400, "messaggio vuoto: 400");
giu = true; r = await manda("chiave-di-prova", { testo: "🛡 ARES — rosso" }); ok(r.status === 502, "Telegram giù: 502, Ares lo sa");
ok(/const IMPRONTA_ARES = "[0-9a-f]{64}";/.test(readFileSync(join(qui, "..", "worker.js"), "utf8")) && !readFileSync(join(qui, "..", "worker.js"), "utf8").includes("ARES_CHIAVE ="), "nel codice solo l'impronta, mai la chiave");
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
