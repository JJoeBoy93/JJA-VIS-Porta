// L'Olimpo (24/10) — tutto finto.   node collaudo/olimpo.mjs
// JJ: «un super gruppo … dove tutti gli agenti hanno un proprio topic». Controlla: con TG_OLIMPO Ares scrive nell'argomento
// «🛡 Ares» del supergruppo, creato una volta sola e ricordato in olimpo.json; Persefone nel suo; il conto della sera in
// «📊 Numeri» dell'Olimpo e non più nei Profili; il generale senza thread; nell'Olimpo il bot non risponde a JJ (solo /start)
// e NON gli dice di mettere il numero in TG_GRUPPO. Controprove: Olimpo che fallisce → il messaggio arriva a JJ in privato
// col ⚠️ (non sparisce); senza TG_OLIMPO tutto come prima (Ares a JJ in privato).
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "olimpo-"));
for (const [a, b] of [["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
writeFileSync(join(dir, "worker.mjs"), readFileSync(join(qui, "..", "worker.js"), "utf8")
  .replace(/const IMPRONTA_ARES = "[0-9a-f]{64}";/, `const IMPRONTA_ARES = "${createHash("sha256").update("chiave-di-prova").digest("hex")}";`)
  .replace(/const IMPRONTA_OLIMPO = "[0-9a-f]{64}";/, `const IMPRONTA_OLIMPO = "${createHash("sha256").update("olimpo-di-prova").digest("hex")}";`));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
let repo = {}, tgm = [], rotto = false, prossimo = 100, conflitto = null;
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "api.telegram.org") { const c = { metodo: u.pathname.split("/").pop(), ...JSON.parse(o.body || "{}") }; tgm.push(c);
    if (rotto && String(c.chat_id) === "-1004388748905") return new Response('{"ok":false,"description":"Bad Request: chat not found"}');
    return new Response(JSON.stringify({ ok: true, result: c.metodo === "createForumTopic" ? { message_thread_id: prossimo++ } : { message_id: 1 } })); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (p === "utenti") return new Response("[]");
    if (m === "PUT" && conflitto && p === "olimpo.json") { const c = conflitto; conflitto = null; repo[p] = c; return new Response('{"message":"sha non combacia"}', { status: 409 }); }
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 }); return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const base = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", TG_GRUPPO: "-1001111111111" };
const env = { ...base, TG_OLIMPO: "4388748905" };   // scritto senza -100: va normalizzato
const ares = (e, testo) => W.default.fetch(new Request("https://porta/ares", { method: "POST", headers: { "content-type": "application/json", "X-Chiave": "chiave-di-prova" }, body: JSON.stringify({ testo }) }), e, { waitUntil() {} });
const inviati = () => tgm.filter((m) => m.metodo === "sendMessage");

console.log("── Ares nel suo argomento");
let r = await ares(env, "🛡 ARES — prova");
let s = inviati();
ok(r.status === 200 && s.length === 1 && s[0].chat_id === "-1004388748905" && s[0].message_thread_id === 100, "nell'Olimpo (numero normalizzato), argomento suo", s);
ok(tgm.find((m) => m.metodo === "createForumTopic").name === "🛡 Ares", "l'argomento si chiama «🛡 Ares»");
ok(leggi("olimpo.json").argomenti.ares === 100, "ricordato in olimpo.json");
tgm = []; await ares(env, "🛡 ARES — di nuovo");
ok(!tgm.some((m) => m.metodo === "createForumTopic") && inviati()[0].message_thread_id === 100, "la seconda volta non ne crea un altro");

console.log("── gli altri dei");
tgm = []; await W.olimpo(W.default && env.TG_OLIMPO ? { ...env, TG_OLIMPO: "-1004388748905" } : env, "persefone", "🕸 prova");
ok(inviati()[0].message_thread_id === 101 && tgm.find((m) => m.metodo === "createForumTopic").name === "🕸 Persefone", "Persefone nel suo");
tgm = []; await W.olimpo({ ...env, TG_OLIMPO: "-1004388748905" }, "generale", "🏛 prova");
ok(!tgm.some((m) => m.metodo === "createForumTopic") && !("message_thread_id" in inviati()[0]), "il generale: niente argomento");
tgm = []; await W.default.scheduled({ cron: "0 18 * * *" }, env, { waitUntil: (p) => p });
await new Promise((x) => setTimeout(x, 50));
const sera = inviati().find((m) => /Numeri|Ancora nessuno/.test(m.text));
ok(sera && sera.chat_id === "-1004388748905" && tgm.find((m) => m.metodo === "createForumTopic" && m.name === "📊 Numeri"), "il conto della sera nell'Olimpo, in «📊 Numeri»", inviati());
ok(!inviati().some((m) => m.chat_id === "-1001111111111"), "e non più nei Profili");
let errato = false; try { await W.olimpo(env, "poseidone", "x"); } catch { errato = true; } ok(errato, "un dio che non esiste non scrive da nessuna parte a caso");

console.log("── JJ che scrive nell'Olimpo");
const SEG = createHash("sha256").update("bot").digest("hex").slice(0, 32);
const scrivi = (text) => W.default.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ message: { message_id: 5, from: { id: 42 }, chat: { id: -1004388748905, type: "supergroup" }, text } }) }), env, { waitUntil() {} });
tgm = []; await scrivi("/start");
ok(inviati().length === 1 && /Olimpo collegato/.test(inviati()[0].text) && !/TG_GRUPPO/.test(inviati()[0].text), "/start: «Olimpo collegato», niente invito a TG_GRUPPO");
tgm = []; await scrivi("ciao");
ok(!inviati().length, "un messaggio qualsiasi: il bot tace");

console.log("── /olimpo: chi non vive nella porta (Hera dalle Actions, Athena dal vault)");
const porta = (k, corpo, e = env) => W.default.fetch(new Request("https://porta/olimpo", { method: "POST", headers: { "content-type": "application/json", ...(k ? { "X-Chiave": k } : {}) }, body: JSON.stringify(corpo) }), e, { waitUntil() {} });
tgm = []; r = await porta("olimpo-di-prova", { dio: "hera", testo: "✅ consegna verde" });
ok(r.status === 200 && inviati().length === 1 && inviati()[0].chat_id === "-1004388748905" && tgm.find((m) => m.metodo === "createForumTopic" && m.name === "✅ Hera"), "Hera nel suo argomento");
tgm = []; r = await porta("olimpo-di-prova", { dio: "generale", testo: "📚 handoff" });
ok(r.status === 200 && !("message_thread_id" in inviati()[0]), "Athena nel Generale");
tgm = []; r = await porta("", { dio: "hera", testo: "x" }); ok(r.status === 403 && !tgm.length, "senza chiave: 403, niente Telegram");
r = await porta("chiave-di-prova", { dio: "hera", testo: "x" }); ok(r.status === 403 && !tgm.length, "la chiave di Ares non apre l'Olimpo");
r = await porta("olimpo-di-prova", { dio: "poseidone", testo: "x" }); ok(r.status === 400 && !tgm.length, "un dio che non c'è: 400, nessun argomento nuovo");
tgm = []; r = await porta("olimpo-di-prova", { dio: "zeus", solo_argomento: true }); const dz = await r.json();
ok(r.status === 200 && dz.gruppo === "-1004388748905" && dz.thread && !inviati().length && tgm.some((m) => m.metodo === "createForumTopic" && m.name === "⚡ Zeus"), "Zeus chiede solo dove: l'argomento nasce, nessun messaggio dal bot della porta", dz);
r = await porta("", { dio: "zeus", solo_argomento: true }); ok(r.status === 403, "anche «dove» vuole la chiave");
tgm = []; r = await porta("olimpo-di-prova", { dio: "hera", testo: "  " }); ok(r.status === 400 && !tgm.length, "testo vuoto: 400");

console.log("── Persefone ENTRATO: solo nell'Olimpo (JJ, 24/10)");
const chiamaP = (path, init = {}) => W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev" + path, init), env, { waitUntil: (p) => p });
const envTxt = await (await chiamaP("/.env", { headers: { "CF-Connecting-IP": "5.90.203.21" } })).text();
const U = (envTxt.match(/WP_ADMIN_USER=(.*)/) || [])[1], PW = (envTxt.match(/WP_ADMIN_PASSWORD=(.*)/) || [])[1];
await new Promise((x) => setTimeout(x, 30)); tgm = [];
const rl = await chiamaP("/wp-login.php", { method: "POST", headers: { "CF-Connecting-IP": "5.90.203.21", "content-type": "application/x-www-form-urlencoded" }, body: `log=${encodeURIComponent(U)}&pwd=${encodeURIComponent(PW)}` });
await new Promise((x) => setTimeout(x, 50));
ok(rl.status === 303 && inviati().some((m) => /ENTRATO/.test(m.text) && m.chat_id === "-1004388748905"), "ENTRATO arriva nell'Olimpo", inviati());
const entr = inviati().filter((m) => /ENTRATO/.test(m.text));
ok(entr.length === 0 || entr.every((m) => m.chat_id === "-1004388748905"), "ENTRATO non arriva in privato", entr);
console.log("── due dèi che nascono insieme");
const e2 = { ...env, TG_OLIMPO: "-1004388748905" };
// mentre Clio crea il suo, un altro ha appena scritto olimpo.json con Dioniso: il conflitto non deve perdere Dioniso
conflitto = Buffer.from(JSON.stringify({ gruppo: "-1004388748905", argomenti: { ...leggi("olimpo.json").argomenti, dioniso: 777 } })).toString("base64");
tgm = []; await W.olimpo(e2, "clio", "📜 prova");
ok(leggi("olimpo.json").argomenti.dioniso === 777 && leggi("olimpo.json").argomenti.clio, "409: rilegge, tiene l'argomento dell'altro e aggiunge il suo", leggi("olimpo.json"));
// mentre Afrodite crea il suo, un'altra Afrodite l'ha già creato: si tiene quello, il doppione si cancella
conflitto = Buffer.from(JSON.stringify({ gruppo: "-1004388748905", argomenti: { ...leggi("olimpo.json").argomenti, afrodite: 888 } })).toString("base64");
tgm = []; await W.olimpo(e2, "afrodite", "🎬 prova");
ok(inviati()[0].message_thread_id === 888 && tgm.some((m) => m.metodo === "deleteForumTopic"), "lo stesso dio creato due volte: si scrive nel primo, il doppione si cancella", tgm);
ok(!("atlas" in W.DEI) && !("nova" in W.DEI), "Atlas e Nova non sono dèi (nomi di prova di JJ)");

console.log("── controprove");
repo = {}; rotto = true; tgm = []; r = await ares(env, "🛡 ARES — Olimpo rotto");
s = inviati().filter((m) => m.chat_id === "42");
ok(s.length === 1 && /Olimpo non raggiungibile/.test(s[0].text) && /ARES — Olimpo rotto/.test(s[0].text), "Olimpo che cade: arriva a JJ in privato col motivo", inviati());
rotto = false; repo = {}; tgm = []; await ares(base, "🛡 ARES — senza Olimpo");
ok(inviati().length === 1 && inviati()[0].chat_id === "42" && !/⚠️/.test(inviati()[0].text), "senza TG_OLIMPO: a JJ in privato come prima");

console.log(errori ? `\n❌ ${errori} rossi` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
