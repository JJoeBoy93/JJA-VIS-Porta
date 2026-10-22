// L'invito a Clio parte da solo (22/10) — tutto finto.   node collaudo/clio.mjs
// JJ: «per usare Clio serve l'invito, puoi fare in modo che si crea in automatico un invito monouso per chi vuole usare Clio?»
// e «Clio … per tutte le altre nuove guide sia un servizio a pagamento in abbonamento mensile». Controlla: «Voglio provare Clio»
// dalla pagina → Clio crea l'invito con la chiave, la mail parte col link precompilato e la riga dell'abbonamento (senza prezzo
// inventato; col prezzo se c'è CLIO_PREZZO), la risposta arriva in chat, a JJ 🎟 e niente tasti da toccare. Chi è già guida:
// la mail per entrare. Controprova: Clio che non risponde → la domanda va a JJ come prima (✍️ Bozza). E nella prima proposta a una
// guida nuova il modello riceve il link dell'invito, niente per_jj.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url"; import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "clio-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64"); const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
let repo = {}, telegram = [], mail = [], clio = "nuova", richieste = [], risposta = '{"risposta":"Ciao.","nuovi":[]}';
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "clio.19-jjardito93.workers.dev") { if (clio === "giu") throw new Error("rete"); if ((o.headers || {})["X-Chiave"] !== "kc") return new Response("{}", { status: 403 });
    if (u.pathname === "/api/porta/guida") return Response.json({ guida: clio === "gia" });
    return Response.json(clio === "gia" ? { gia: true } : { chiave: "abc123def456" }); }
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body)); return new Response(JSON.stringify({ content: [{ type: "text", text: risposta }], model: "m", usage: { input_tokens: 1, output_tokens: 1 } })); }
  if (u.host === "api.telegram.org") { telegram.push(JSON.parse(o.body || "{}")); return new Response('{"ok":true,"result":{"message_id":1,"message_thread_id":5}}'); }
  if (u.host === "api.brevo.com") { mail.push(JSON.parse(o.body)); return new Response('{"messageId":"x"}', { status: 201 }); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response('{"message":"Not Found"}', { status: 404 }); return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", TG_CHAT: "1", TG_GRUPPO: "-100", TG_BOT_TOKEN: "t", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it", CLIO_CHIAVE: "kc" };
const CHI = "c1c1c1c1c1c1c1c1";
const vuole = (m, e = env) => W.default.fetch(new Request("https://porta/parla", { method: "POST", headers: { Origin: "https://jjoeboy93.github.io", "content-type": "application/json" },
  body: JSON.stringify({ chi: CHI, da_dove: "clio", testo: "🏛 Clio — lingue: italiano, inglese", contatto: { nome: "Rita Bianchi", mail: m, consenso: true } }) }), e, { waitUntil() {} });
let r = await vuole("Rita@Prova.it"); let d = await r.json();
const m1 = mail[0] || {};
ok(d.clio === "invito" && m1.to && m1.to[0].email === "rita@prova.it" && /Clio · il tuo invito personale/.test(m1.subject), "«Voglio provare Clio»: parte la mail dell'invito, da sola", { d, mail });
ok(/accedi\.html\?invito=abc123def456&email=rita%40prova\.it/.test(m1.textContent) && /abc123def456/.test(m1.textContent), "nella mail: il link col codice e la mail già scritti", m1.textContent);
ok(/abbonamento mensile/.test(m1.textContent) && /le condizioni te le scrive Jacopo/.test(m1.textContent) && !/€/.test(m1.textContent), "senza CLIO_PREZZO: abbonamento mensile, nessuna cifra inventata", m1.textContent);
const bz = Object.keys(repo).find((k) => k.startsWith("bozze/")); const B = bz && leggi(bz);
ok(B && B.stato === "inviata" && !Object.keys(repo).includes("attesa.json") && repo[`per-pagina/${CHI}/${B.id}.json`], "la domanda è già chiusa, e la risposta arriva in chat", B);
ok(telegram.some((t) => /🎟 Invito monouso creato e mandato/.test(t.text || "") && !t.reply_markup) && telegram.some((t) => /manca CLIO_PREZZO/.test(t.text || "")), "a JJ: 🎟, niente tasti, e che manca il prezzo", telegram.map((t) => t.text));
mail = []; telegram = [];
await vuole("rita@prova.it", { ...env, CLIO_PREZZO: "19 € al mese" });
ok(/abbonamento mensile: 19 € al mese/.test((mail[0] || {}).textContent || ""), "con CLIO_PREZZO: il prezzo di JJ nella mail", mail[0]);
clio = "gia"; mail = []; telegram = [];
r = await vuole("mirna@prova.it"); d = await r.json();
ok(d.clio === "gia" && /Clio · entri da qui/.test((mail[0] || {}).subject || "") && !/invito=/.test(mail[0].textContent), "chi è già guida: la mail per entrare, nessun invito", mail[0]);
clio = "giu"; mail = []; telegram = [];
r = await vuole("rosa@prova.it"); d = await r.json();
ok(!d.clio && !mail.length && telegram.some((t) => t.reply_markup && JSON.stringify(t.reply_markup).includes("bozza:")), "controprova: Clio che non risponde → la domanda va a JJ come prima", { d, telegram });
// la prima proposta a una guida nuova: il link dell'invito al modello
clio = "nuova"; richieste = [];
repo["atlas.json"] = b64({ "nina@prova.it": { nome: "Nina", turni: [], impegni: [], chi: "d2d2d2d2d2d2d2d2", assistente: "Ada", primo_chiesto: "nn11" } });
repo["utenti/d2d2d2d2d2d2d2d2.json"] = b64({ chi: "d2d2d2d2d2d2d2d2", mail: "nina@prova.it", tuo: "Nina", mestiere: "Guida turistica", thread: 5 });
const SEG = createHash("sha256").update("t").digest("hex").slice(0, 32);
await W.default.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: 1 }, data: "primo:nn11", message: { message_id: 1, chat: { id: -100 } } } }) }), env, { waitUntil() {} });
const q = richieste[0] ? richieste[0].messages[0].content : "";
ok(/accedi\.html\?invito=abc123def456&email=nina%40prova\.it/.test(q) && /niente per_jj per Clio/.test(q) && !/metti in per_jj «invito a Clio»/.test(q) && /abbonamento mensile/.test(q),
  "prima proposta a una guida nuova: il link dell'invito già pronto, l'abbonamento, niente per_jj", q.slice(-700));
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
