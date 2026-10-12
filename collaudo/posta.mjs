// La posta in arrivo (11/10) — tutto finto.   node collaudo/posta.mjs
// Controlla: senza la chiave giusta no; chi risponde a una nostra lettera riceve risposta da JJA-VIS da solo (a JJ una riga);
// «PER JJ:» (prezzi, date, accordi) va a JJ con la proposta e Invia/Scarta; chi scrive a caso va a JJ senza bozza (non si paga);
// «cancellami» cancella; al massimo 3 risposte da solo in 24 ore; la lettera citata sotto non entra; le nostre mail si ignorano;
// l'Invia di JJ parte da Brevo con «Re: <oggetto>».
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "posta-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = (await import(join(dir, "worker.mjs"))).default;
let errori = 0;
const ok = (c, m, d) => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c || d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 400))); if (!c) errori++; };
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it", ANTHROPIC_API_KEY: "a" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo, mandate, tgMsg, claudeDice, claudeChiamate, claudeVisto;
const nuovo = () => { repo = {}; mandate = []; tgMsg = []; claudeChiamate = 0; claudeVisto = ""; claudeDice = "Ciao Jessica, certo: ti spiego meglio.\nJJA-VIS"; };
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.telegram.org") { tgMsg.push(JSON.parse(o.body || "{}")); return j(200, { ok: true, result: { message_id: 1 } }); }
  if (u.host === "api.brevo.com") { mandate.push(JSON.parse(o.body)); return j(201, { messageId: "m" + mandate.length }); }
  if (u.host === "api.anthropic.com") { claudeChiamate++; claudeVisto = JSON.parse(o.body).messages[0].content; return j(200, { content: [{ type: "text", text: claudeDice }] }); }
  if (u.host === "api.github.com") {
    const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""); const m = o.method || "GET";
    if (m === "GET") { if (repo[p]) return j(200, { content: b64(repo[p]), sha: "s" + p });
      const figli = Object.keys(repo).filter((k) => k.startsWith(p + "/")).map((k) => ({ name: k.slice(p.length + 1) }));
      return figli.length ? j(200, figli) : j(404, { message: "Not Found" }); }
    if (m === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return j(200, {}); }
    if (m === "DELETE") { delete repo[p]; return j(200, {}); }
  }
  return j(404, {});
};
// la chiave come la calcola la porta (HMAC del token del bot)
const { createHmac } = await import("node:crypto");
const CHIAVE = createHmac("sha256", "bot").update("posta in arrivo di JJA-VIS").digest("hex").slice(0, 40);
const posta = async (corpo, chiave = CHIAVE) => { const r = await W.fetch(new Request("https://x/posta", { method: "POST", headers: { "X-Posta": chiave, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }), env, { waitUntil() {} });
  return { stato: r.status, ...(await r.json().catch(() => ({}))) }; };
const lettera = { a: "jessica@p.it", nome: "Jessica", oggetto: "Le tue scadenze", testo: "Ciao Jessica, ti scrivo per le scadenze del tuo studio…", inviata: "2026-10-11T01:07:00Z" };
const daJessica = (testo, extra = {}) => ({ da: "Jessica@p.it", nome: "Jessica Rossi", oggetto: "Re: Le tue scadenze", testo, ...extra });

console.log("── la chiave");
nuovo(); let r = await posta(daJessica("ciao"), "sbagliata"); ok(r.stato === 403, "senza la chiave giusta: 403", r);

console.log("── risponde a una nostra lettera: JJA-VIS risponde da solo");
nuovo(); repo["inviate/1.json"] = lettera;
r = await posta(daJessica("Mi interessa, puoi spiegarmi meglio come funziona?\n\nIl giorno sab 11 ott 2026 JJA-VIS <jjavis@prova.it> ha scritto:\n> Ciao Jessica, ti scrivo per le scadenze\n> del tuo studio"));
ok(r.stato === 200 && r.rispondi === claudeDice, "lo script riceve la risposta da mandare da Gmail", r);
ok(claudeVisto.includes("Le tue scadenze") && claudeVisto.includes("spiegarmi meglio") && !claudeVisto.includes("> Ciao Jessica"), "Claude vede la nostra lettera e la sua risposta, senza la citazione sotto", claudeVisto.slice(0, 300));
ok(tgMsg.length === 1 && /🤖 Jessica Rossi ha risposto e JJA-VIS gli ha risposto da solo/.test(tgMsg[0].text) && !tgMsg[0].reply_markup, "a JJ una riga per sapere, senza tasti", tgMsg);
const b = Object.entries(repo).find(([k]) => k.startsWith("bozze/"));
ok(b && b[1].stato === "inviata" && b[1].via.join() === "gmail" && b[1].a === "jessica@p.it", "resta scritta in bozze/ come inviata da Gmail", b);

console.log("── prezzi, date, accordi: a JJ, con la proposta");
nuovo(); repo["inviate/1.json"] = lettera; claudeDice = "PER JJ: chiede un prezzo\nCiao Jessica, il prezzo te lo dice chi mi costruisce entro domani.";
r = await posta(daJessica("Quanto costa?"));
ok(r.stato === 200 && r.attesa && !r.rispondi, "lo script non risponde: la mail aspetta JJ", r);
const t = tgMsg[0] || {};
ok(/🙋 Serve te: chiede un prezzo/.test(t.text) && /Proposta di JJA-VIS:\nCiao Jessica/.test(t.text) && !/PER JJ/.test(t.text.split("Proposta")[1]) && t.reply_markup.inline_keyboard[0][0].callback_data === `invia:${r.attesa}`, "a JJ: il motivo, la proposta pulita e Invia", t);
// JJ tocca Invia: parte da Brevo con Re: <oggetto>
const segreto = createHmac("sha256", "x").digest("hex");   // non serve: si chiama invia dal tasto
const { createHash } = await import("node:crypto");
const tok = createHash("sha256").update("bot").digest("hex").slice(0, 32);
await W.fetch(new Request("https://x/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": tok, "Content-Type": "application/json" },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: 42 }, data: `invia:${r.attesa}`, message: { message_id: 5, chat: { id: 42 } } } }) }), env, { waitUntil() {} });
ok(mandate.length === 1 && mandate[0].to[0].email === "jessica@p.it" && mandate[0].subject === "Re: Le tue scadenze" && /il prezzo te lo dice/.test(mandate[0].textContent), "col tocco di JJ parte da Brevo, «Re: Le tue scadenze»", mandate);

console.log("── chi scrive a caso: a JJ senza bozza (non si paga)");
nuovo(); r = await posta({ da: "sconosciuto@p.it", nome: "", oggetto: "Offerta SEO", testo: "Vuoi più clienti?" });
ok(r.attesa && claudeChiamate === 0 && /non risponde a una nostra lettera/.test(tgMsg[0].text) && tgMsg[0].reply_markup.inline_keyboard[0][0].callback_data.startsWith("bozza:"), "nessuna chiamata a Claude; a JJ coi tasti Bozza e Ignora", [claudeChiamate, tgMsg]);

console.log("── cancellami, le nostre, il tetto");
nuovo(); r = await posta(daJessica("cancellami per favore"));
ok(r.rispondi && /non ti scriveremo più/.test(r.rispondi) && repo["cancellati.json"].includes("jessica@p.it") && /cancellato/.test(tgMsg[0].text) && claudeChiamate === 0, "«cancellami»: cancellata, risposta di conferma, JJ lo sa", [r, repo["cancellati.json"]]);
nuovo(); r = await posta({ da: "JJAVIS@prova.it", oggetto: "x", testo: "y" }); ok(r.ignora && !tgMsg.length, "le mail della nostra casella si ignorano", r);
nuovo(); r = await posta({ da: "jjavis.93=gmail.com@ab12.brevosend.com", nome: "JJA-VIS · segnalazioni", oggetto: "⚑ Segnalazione dalla città", testo: "Segnalato: «JJA»" });
ok(r.ignora && !tgMsg.length, "le nostre passate da Brevo (mittente riscritto) si ignorano: la segnalazione della città non è una risposta", r);
nuovo(); r = await posta({ da: "chiunque@p.it", nome: "JJA-VIS", oggetto: "Il tuo codice JJA-VIS: 123456", testo: "123456" });
ok(r.ignora && !tgMsg.length, "anche col nome «JJA-VIS» (i codici d'accesso)", r);
nuovo(); repo["inviate/1.json"] = lettera; repo["posta-auto.json"] = { "jessica@p.it": [1, 2, 3].map((h) => new Date(Date.now() - h * 36e5).toISOString()) };
r = await posta(daJessica("ancora una domanda")); ok(r.attesa && /già 3 risposte da solo in 24 ore/.test(tgMsg[0].text), "dopo 3 risposte da solo in 24 ore, la quarta va a JJ", tgMsg[0]);
nuovo(); r = await posta({ da: "non-una-mail", testo: "x" }); ok(r.stato === 400, "una mail che non è una mail: 400", r);

console.log(errori ? `\n${errori} prove rosse` : "\nVERDE"); process.exit(errori ? 1 : 0);
