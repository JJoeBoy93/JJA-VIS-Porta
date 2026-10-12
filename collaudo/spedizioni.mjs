// Il tracciamento di Athena Trasporti (12/10) — tutto finto.   node collaudo/spedizioni.mjs
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "sped-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = (await import(join(dir, "worker.mjs"))).default;
let errori = 0;
const ok = (c, m, d) => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c || d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 500))); if (!c) errori++; };
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, mandate = [], tgMsg = [];
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.telegram.org") { tgMsg.push({ metodo: u.pathname.split("/").pop(), ...JSON.parse(o.body || "{}") }); return j(200, { ok: true, result: { message_id: 1 } }); }
  if (u.host === "api.brevo.com") { mandate.push(JSON.parse(o.body)); return j(201, { messageId: "m" }); }
  if (u.host === "api.github.com") {
    const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""); const m = o.method || "GET";
    if (m === "GET") return repo[p] ? j(200, { content: b64(repo[p]), sha: "s" }) : j(404, { message: "Not Found" });
    if (m === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return j(200, {}); }
  }
  return j(404, {});
};
const tok = createHash("sha256").update("bot").digest("hex").slice(0, 32);
const tg = (corpo) => W.fetch(new Request("https://x/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": tok, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }), env, { waitUntil() {} });
const scrive = (text) => tg({ message: { message_id: 9, from: { id: 42 }, chat: { id: 42, type: "private" }, text } });
const tocca = (data) => tg({ callback_query: { id: "q", from: { id: 42 }, data, message: { message_id: 5, chat: { id: 42 } } } });
const traccia = async (c) => { const r = await W.fetch(new Request(`https://x/traccia?c=${c}`, { headers: { Origin: "https://jjoeboy93.github.io" } }), env, { waitUntil() {} }); return { stato: r.status, cors: r.headers.get("Access-Control-Allow-Origin"), ...(await r.json()) }; };

console.log("── una spedizione nuova, con la mail del cliente");
await scrive("/sped Mario Rossi | via Roma 1, Limbiate | mario@prova.it");
const codice = Object.keys(repo).map((k) => k.match(/^spedizioni\/(AT-[A-Z0-9]{5})\.json$/)).find(Boolean)?.[1];
ok(codice, "il codice è AT- e cinque lettere o numeri", Object.keys(repo));
const msg = tgMsg.find((t) => t.metodo === "sendMessage") || {};
ok(new RegExp(`📦 ${codice} — Mario Rossi`).test(msg.text) && /📥 .* Presa in carico ✉️/.test(msg.text) && msg.text.includes(`traccia.html?c=${codice}`), "a JJ: codice, presa in carico (mail mandata), il link per il cliente", msg.text);
ok(JSON.stringify(msg.reply_markup).includes(`sp:consegna:${codice}`) && JSON.stringify(msg.reply_markup).includes(`sp:consegnata:${codice}`), "i tasti degli stati", msg.reply_markup);
ok(mandate.length === 1 && mandate[0].to[0].email === "mario@prova.it" && /Presa in carico — spedizione AT-/.test(mandate[0].subject) && mandate[0].textContent.includes(`traccia.html?c=${codice}`) && mandate[0].sender.name === "Athena Trasporti",
   "al cliente la mail «presa in carico», col link, da Athena Trasporti", mandate);

console.log("── gli stati con un tocco");
tgMsg = []; await tocca(`sp:consegna:${codice}`);
ok(repo[`spedizioni/${codice}.json`].stati.map((s) => s.s).join() === "presa,consegna" && mandate.length === 2 && /In consegna/.test(mandate[1].subject), "«In consegna»: segnato e mail al cliente", repo[`spedizioni/${codice}.json`].stati);
ok(tgMsg.some((t) => t.metodo === "editMessageText" && /🚚 .* In consegna ✉️/.test(t.text)), "il messaggio di JJ si aggiorna con la storia", tgMsg.map((t) => t.metodo));
await tocca(`sp:consegna:${codice}`);
ok(repo[`spedizioni/${codice}.json`].stati.length === 2 && mandate.length === 2, "toccato due volte: niente doppioni, niente seconda mail", repo[`spedizioni/${codice}.json`].stati.length);
await tocca(`sp:consegnata:${codice}`);
ok(mandate.length === 3 && /Consegnata/.test(mandate[2].subject), "«Consegnata»: mail al cliente", mandate.map((m) => m.subject));
tgMsg = []; await tg({ callback_query: { id: "q", from: { id: 7 }, data: `sp:magazzino:${codice}`, message: { message_id: 5, chat: { id: 7 } } } });
ok(repo[`spedizioni/${codice}.json`].stati.length === 3, "uno che non è JJ non cambia gli stati", repo[`spedizioni/${codice}.json`].stati.length);

console.log("── la pagina pubblica");
let r = await traccia(codice);
ok(r.stato === 200 && r.stati.map((s) => s.stato).join(",") === "Presa in carico,In consegna,Consegnata" && r.comune === "Limbiate" && r.cors === "https://jjoeboy93.github.io", "stati, ore e comune", r);
ok(!JSON.stringify(r).includes("Mario") && !JSON.stringify(r).includes("Roma") && !JSON.stringify(r).includes("mario@"), "mai nome, via o contatto: chi indovina un codice non scopre chi è il cliente", r);
r = await traccia("AT-ZZZZZ"); ok(r.stato === 404 && r.no === "non trovata", "un codice che non c'è: 404", r);
r = await traccia("ciao"); ok(r.stato === 400, "un codice storto: 400", r);

console.log("── col telefono invece della mail");
mandate = []; tgMsg = []; await scrive("/sped Anna | Saronno | 333 123 4567");
const m2 = tgMsg.find((t) => t.metodo === "sendMessage") || {};
ok(mandate.length === 0 && /https:\/\/wa\.me\/393331234567\?text=/.test(m2.text), "nessuna mail; a JJ il link WhatsApp già scritto, col prefisso 39", m2.text);
tgMsg = []; await scrive("/sped");
ok(/\/sped Nome \| indirizzo \| mail o telefono/.test((tgMsg[0] || {}).text || ""), "/sped da solo spiega come si usa", tgMsg[0]);

console.log(errori ? `\n${errori} prove rosse` : "\nVERDE"); process.exit(errori ? 1 : 0);
