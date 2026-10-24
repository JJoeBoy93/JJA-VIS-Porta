// /insospeso (24/10) — tutto finto.   node collaudo/insospeso.mjs
// JJ, 23/10: un comando che dica chi aspetta ancora una risposta, per i giorni in cui non segue gli utenti.
// Controlla: un messaggio per persona, col #id (si risponde lì) e i tre tasti; la bozza pronta si vede; le voci che non
// aspettano più nessuno (id senza bozza, bozza già inviata o scartata) escono da attesa.json e lo si dice; uno sconosciuto
// non vede niente; la lista vuota si dice. Controprova: un errore di lettura che non è 404 NON toglie la voce, la mostra.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "sospeso-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
let repo = {}, telegram = [], guasto = "", chiamate = 0;
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url)); chiamate++;
  if (u.host === "api.telegram.org") { telegram.push({ metodo: u.pathname.split("/").pop(), ...JSON.parse(o.body || "{}") }); return new Response('{"ok":true,"result":{"message_id":1}}'); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (p === guasto) return new Response('{"message":"finto guasto"}', { status: 500 });
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", TG_CHAT: "42", TG_BOT_TOKEN: "bot" };
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);
const scrivi = (text, da = 42) => W.default.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ message: { message_id: 5, from: { id: da }, chat: { id: 42, type: "private" }, text } }) }), env, { waitUntil() {} });
const ieri = new Date(Date.now() - 3 * 864e5).toISOString();
const prepara = () => { repo = {
  "attesa.json": b64({ ids: ["aaaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd", "eeeeeeee"] }),
  "bozze/aaaaaaaa.json": b64({ id: "aaaaaaaa", nome: "Giada", nome_assistente: "Arya", chi: "x", stato: "arrivata", domanda: "Che mi ricordi gli impegni", creata: ieri }),
  "bozze/bbbbbbbb.json": b64({ id: "bbbbbbbb", nome: "Jessica", da_dove: "posta", a: "j@prova.it", stato: "bozza", domanda: "Si preferisco quando esco", bozza: "Va bene, glielo ricordo all'uscita.", quando: ieri }),
  "bozze/cccccccc.json": b64({ id: "cccccccc", nome: "Vecchio", stato: "inviata", domanda: "già fatta" }),
  "bozze/eeeeeeee.json": b64({ id: "eeeeeeee", nome: "Scartato", stato: "scartata", domanda: "no" }),
  // dddddddd: senza bozza (profilo tolto)
}; telegram = []; guasto = ""; };

console.log("── la lista");
prepara(); await scrivi("/insospeso");
const msg = telegram.filter((m) => m.metodo === "sendMessage");
ok(msg.length === 3, "una testa + un messaggio per ognuna delle due persone che aspettano", msg.map((m) => m.text.slice(0, 40)));
ok(/2 persone aspettano/.test(msg[0].text), "la testa dice quante");
const giada = msg.find((m) => m.text.includes("#aaaaaaaa")), jess = msg.find((m) => m.text.includes("#bbbbbbbb"));
ok(giada && /Giada/.test(giada.text) && /Arya/.test(giada.text) && /da 3 giorni/.test(giada.text), "chi è, il suo assistente, da quanto aspetta", giada && giada.text);
ok(giada && giada.reply_markup.inline_keyboard.flat().map((b) => b.callback_data).join() === "bozza:aaaaaaaa,copia:aaaaaaaa,scarta:aaaaaaaa", "i tre tasti di sempre sull'id giusto");
ok(jess && /Bozza pronta/.test(jess.text) && /all'uscita/.test(jess.text) && /mail/.test(jess.text), "la bozza pronta si vede, e da dove arriva");
ok(!msg.some((m) => /#cccccccc|#eeeeeeee|#dddddddd/.test(m.text) && m.reply_markup), "inviate, scartate e senza bozza non sono voci");
ok(JSON.stringify(leggi("attesa.json").ids) === JSON.stringify(["aaaaaaaa", "bbbbbbbb"]), "attesa.json ripulita: restano solo le due vere", leggi("attesa.json"));
ok(/Tolte.*dddddddd \(senza bozza\).*cccccccc|Tolte.*cccccccc.*dddddddd/.test(msg[0].text) && /già scartata/.test(msg[0].text), "e la pulizia si dice", msg[0].text);

console.log("── controprova: un guasto di lettura non toglie niente");
prepara(); guasto = "bozze/aaaaaaaa.json"; await scrivi("/insospeso");
const t2 = telegram.filter((m) => m.metodo === "sendMessage");
ok(leggi("attesa.json").ids.includes("aaaaaaaa"), "la voce illeggibile resta in attesa.json");
ok(/Non lette.*aaaaaaaa.*500/.test(t2[0].text), "e la testa la nomina col guasto", t2[0].text);

console.log("── vuoto, e sconosciuti");
repo = {}; telegram = []; await scrivi("/insospeso");
ok(telegram.filter((m) => m.metodo === "sendMessage").length === 1 && /Nessuno aspetta/.test(telegram[0].text), "senza attesa.json: «nessuno aspetta», non un errore");
prepara(); await scrivi("/insospeso", 666);
ok(!telegram.length && leggi("attesa.json").ids.length === 5, "uno sconosciuto non riceve niente e non tocca la lista");

console.log("── il tetto delle richieste (Cloudflare gratis: 50 a giro)");
prepara(); const tanti = Array.from({ length: 30 }, (_, i) => String(i).padStart(8, "1"));
for (const id of tanti) repo[`bozze/${id}.json`] = b64({ id, nome: "P" + id, stato: "arrivata", domanda: "?" });
repo["attesa.json"] = b64({ ids: [...tanti.slice(0, 25), "dddddddd", ...tanti.slice(25)] }); chiamate = 0;
await scrivi("/insospeso");
ok(chiamate <= 50, `30 in attesa: ${chiamate} richieste esterne, dentro le 50`, chiamate);
ok(/conto parziale/.test(telegram.find((m) => m.metodo === "sendMessage").text), "e dice che il conto è parziale");

console.log(errori ? `\n❌ ${errori} rossi` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
