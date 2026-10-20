// La posta in arrivo (11/10) — tutto finto.   node collaudo/posta.mjs
// Controlla: senza la chiave giusta no; chi risponde a una nostra lettera riceve risposta da JJA-VIS da solo (a JJ una riga);
// «PER JJ:» (prezzi, date, accordi) va a JJ con la proposta e Invia/Scarta; chi scrive a caso va a JJ senza bozza (non si paga);
// «cancellami» cancella; al massimo 10 risposte da solo in 24 ore; la lettera citata sotto non entra; le nostre mail si ignorano;
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
const J_ = (o) => JSON.stringify(o);
const nuovo = () => { repo = {}; mandate = []; tgMsg = []; claudeChiamate = 0; claudeVisto = ""; claudeModello = "";
  claudeDice = J_({ risposta: "Ciao Jessica, segnato.\nAtlas", nuovi: [{ cosa: "ricordare a Jacopo il parrucchiere", giorno: "2026-10-14", ora: "18:00" }], tolti: [], per_jj: null }); };
let claudeModello = "", claudeCorpo = {};
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.telegram.org") { tgMsg.push(JSON.parse(o.body || "{}")); return j(200, { ok: true, result: { message_id: 1 } }); }
  if (u.host === "api.brevo.com") { mandate.push(JSON.parse(o.body)); return j(201, { messageId: "m" + mandate.length }); }
  if (u.host === "api.anthropic.com") { claudeChiamate++; const b_ = JSON.parse(o.body); claudeVisto = b_.messages[0].content; claudeModello = b_.model; claudeCorpo = b_; return j(200, { model: b_.model, usage: { input_tokens: 4000, output_tokens: 400 }, content: [{ type: "text", text: claudeDice }] }); }
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
ok(r.stato === 200 && r.rispondi === "Ciao Jessica, segnato.\nAtlas", "lo script riceve la risposta da mandare da Gmail", r);
ok(claudeModello === "claude-haiku-5-5" && claudeCorpo.output_config && claudeCorpo.output_config.effort === "medium" && claudeCorpo.max_tokens >= 4000 && !("temperature" in claudeCorpo),
   "Atlas risponde con Haiku 5.5: sforzo medio, spazio per pensare, niente temperature", claudeCorpo);
ok(repo["atlas.json"]["jessica@p.it"].impegni[0].cosa === "ricordare a Jacopo il parrucchiere" && repo["atlas.json"]["jessica@p.it"].impegni[0].ora === "18:00", "l'impegno è segnato in atlas.json", repo["atlas.json"]);
ok(claudeVisto.includes("Le tue scadenze") && claudeVisto.includes("spiegarmi meglio") && !claudeVisto.includes("> Ciao Jessica"), "Claude vede la nostra lettera e la sua risposta, senza la citazione sotto", claudeVisto.slice(0, 300));
ok(tgMsg.length === 1 && /🤖 Jessica Rossi ha risposto e Atlas gli ha risposto da solo/.test(tgMsg[0].text) && /📌 Segnati: 2026-10-14 18:00/.test(tgMsg[0].text) && !tgMsg[0].reply_markup, "a JJ una riga per sapere, con gli impegni segnati, senza tasti", tgMsg);
// la seconda mail: Atlas vede la conversazione e gli impegni già segnati (prima vedeva solo l'ultima mail e richiedeva cose già dette)
claudeDice = J_({ risposta: "Ok.\nAtlas", nuovi: [], tolti: [], per_jj: null });
r = await posta(daJessica("e preferisco le email"));
ok(/LEI: Mi interessa, puoi spiegarmi meglio/.test(claudeVisto) && /TU: Ciao Jessica, segnato/.test(claudeVisto) && /alle 18:00: ricordare a Jacopo il parrucchiere/.test(claudeVisto) && /OGGI è /.test(claudeVisto),
   "la seconda volta Atlas vede tutta la conversazione, gli impegni e la data di oggi", claudeVisto.slice(0, 600));
const b = Object.entries(repo).find(([k]) => k.startsWith("bozze/"));
ok(b && b[1].stato === "inviata" && b[1].via.join() === "gmail" && b[1].a === "jessica@p.it", "resta scritta in bozze/ come inviata da Gmail", b);

console.log("── prezzi, date, accordi: a JJ, con la proposta");
nuovo(); repo["inviate/1.json"] = lettera; claudeDice = J_({ risposta: "Ciao Jessica, il prezzo te lo dice chi mi costruisce entro domani.", nuovi: [], tolti: [], per_jj: "chiede un prezzo" });
r = await posta(daJessica("Quanto costa?"));
ok(r.stato === 200 && r.attesa && !r.rispondi, "lo script non risponde: la mail aspetta JJ", r);
const t = tgMsg[0] || {};
ok(/🙋 Serve te: chiede un prezzo/.test(t.text) && /Proposta di Atlas:\nCiao Jessica/.test(t.text) && !/PER JJ/.test(t.text.split("Proposta")[1]) && t.reply_markup.inline_keyboard[0][0].callback_data === `invia:${r.attesa}`, "a JJ: il motivo, la proposta pulita e Invia", t);
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
nuovo(); repo["inviate/1.json"] = lettera; repo["posta-auto.json"] = { "jessica@p.it": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => new Date(Date.now() - h * 36e5).toISOString()) };
r = await posta(daJessica("ancora una domanda")); ok(r.attesa && /già 10 risposte da solo in 24 ore/.test(tgMsg[0].text), "dopo 10 risposte da solo in 24 ore, l'undicesima va a JJ", tgMsg[0]);
nuovo(); r = await posta({ da: "non-una-mail", testo: "x" }); ok(r.stato === 400, "una mail che non è una mail: 400", r);

console.log("── nell'argomento della persona (12/10: «non dovrebbe metterlo nel thread di Jessica?»)");
{ const envG = { ...env, TG_GRUPPO: "-1009" };
  nuovo(); repo["inviate/1.json"] = { ...lettera, fonte: "risposte/x.json" }; repo["risposte/x.json"] = { chi: "7b0479", mail: "jessica@p.it" }; repo["utenti/7b0479.json"] = { chi: "7b0479", thread: 26 };
  r = await W.fetch(new Request("https://x/posta", { method: "POST", headers: { "X-Posta": CHIAVE, "Content-Type": "application/json" }, body: JSON.stringify(daJessica("segna anche la spesa giovedì")) }), envG, { waitUntil() {} });
  ok(tgMsg.length === 1 && String(tgMsg[0].chat_id).endsWith("1009") && tgMsg[0].message_thread_id === 26, "la risposta di Jessica arriva nel suo argomento del gruppo, non nella chat del bot", tgMsg);
  ok(repo["atlas.json"]["jessica@p.it"].chi === "7b0479", "il codice del profilo resta in atlas.json, per i promemoria", repo["atlas.json"]);
  const { atlasPromemoria: ap } = await import(join(dir, "worker.mjs")); tgMsg = [];
  repo["atlas.json"]["jessica@p.it"].impegni = [{ id: "z", cosa: "spesa", giorno: "2026-10-15", ora: null, avvisato: false, ics: true }];
  await ap(envG, new Date("2026-10-15T05:07:00Z"));
  ok(tgMsg.length === 1 && tgMsg[0].message_thread_id === 26 && /Atlas ha mandato/.test(tgMsg[0].text), "anche «Atlas ha mandato» va nel suo argomento", tgMsg); }

console.log("── quanto costa (12/10: «ogni risposta che manda in autonomia pago 15 centesimi?»)");
nuovo(); repo["inviate/1.json"] = lettera; r = await posta(daJessica("segna la spesa giovedì"));
ok(/💶 questa risposta ≈ 0\.06 cent di \$/.test(tgMsg[0].text) && Math.abs(Object.values(repo["spesa-ia.json"].giorni)[0] - 0.0006) < 1e-9, "Haiku 5.5, 4.000 token in entrata e 400 in uscita: 0,06 cent, detto a JJ e contato", [tgMsg[0].text.slice(-120), repo["spesa-ia.json"]]);
const oggi_ = new Date().toISOString().slice(0, 10);
nuovo(); repo["inviate/1.json"] = lettera; repo["spesa-ia.json"] = { giorni: { [oggi_]: 0.5 }, mesi: { [oggi_.slice(0, 7)]: 0.5 } };
r = await posta(daJessica("e la torta?"));
ok(r.attesa && claudeChiamate === 0 && /tetto di spesa di Atlas raggiunto/.test(tgMsg[0].text), "oltre 0,50 $ al giorno niente Claude: la mail va a JJ", [claudeChiamate, tgMsg[0] && tgMsg[0].text.slice(0, 200)]);
nuovo(); repo["inviate/1.json"] = lettera; repo["spesa-ia.json"] = { giorni: {}, mesi: { [oggi_.slice(0, 7)]: 3 } };
r = await posta(daJessica("e la torta?")); ok(r.attesa && claudeChiamate === 0, "oltre 3 $ al mese, idem", claudeChiamate);

console.log("── un guasto si dice: il pensiero ha mangiato tutto, nessun testo");
{ const vero = globalThis.fetch; nuovo(); repo["inviate/1.json"] = lettera;
  globalThis.fetch = async (url, o) => new URL(String(url)).host === "api.anthropic.com"
    ? new Response(JSON.stringify({ model: "claude-haiku-5-5", stop_reason: "max_tokens", usage: { input_tokens: 4000, output_tokens: 8000 }, content: [{ type: "thinking", thinking: "" }] }), { status: 200 })
    : vero(url, o);
  r = await posta(daJessica("la torta sabato"));
  globalThis.fetch = vero;
  ok(r.attesa && /Atlas non è riuscito \(nessun testo \(stop: max_tokens\)\)/.test(tgMsg[0].text), "senza testo la mail va a JJ col motivo, non parte una risposta vuota", tgMsg[0] && tgMsg[0].text.slice(0, 300)); }

console.log("── i promemoria di Atlas");
const { atlasPromemoria } = await import(join(dir, "worker.mjs"));
nuovo(); repo["atlas.json"] = { "jessica@p.it": { nome: "Jessica Crippa", turni: [], riepilogo: "", impegni: [
  { id: "a1", cosa: "ricordare a Jacopo il parrucchiere", giorno: "2026-10-14", ora: "18:00", avvisato: false, ics: true },
  { id: "a2", cosa: "comprare il giubbotto per Athena", giorno: "2026-10-14", ora: null, avvisato: false, ics: true },
  { id: "a3", cosa: "vecchio", giorno: "2026-10-01", ora: null, avvisato: false } ] } };
await atlasPromemoria(env, new Date("2026-10-14T04:07:00Z"));   // 06:07 a Roma (ora legale, +2): ancora niente
ok(mandate.length === 0, "alle 6 di Roma non parte niente", mandate);
await atlasPromemoria(env, new Date("2026-10-14T05:07:00Z"));   // 07:07 a Roma
ok(mandate.length === 1 && /programma di oggi, mercoledì 14\/10/.test(mandate[0].subject) && /18:00 ricordare a Jacopo/.test(mandate[0].textContent) && /giubbotto/.test(mandate[0].textContent) && mandate[0].sender.name === "Atlas · JJA-VIS",
   "alle 7 di Roma il programma del giorno, con e senza ora", mandate);
ok(!repo["atlas.json"]["jessica@p.it"].impegni.some((x) => x.id === "a3"), "gli impegni vecchi di giorni si tolgono", repo["atlas.json"]);
await atlasPromemoria(env, new Date("2026-10-14T06:07:00Z")); ok(mandate.length === 1, "il programma parte una volta sola al giorno", mandate.length);
await atlasPromemoria(env, new Date("2026-10-14T15:07:00Z"));   // 17:07 a Roma: un'ora prima delle 18
ok(mandate.length === 2 && /⏰ Alle 18:00: ricordare a Jacopo il parrucchiere/.test(mandate[1].subject), "alle 17:07 di Roma il promemoria delle 18", mandate[1]);
await atlasPromemoria(env, new Date("2026-10-14T15:30:00Z")); ok(mandate.length === 2, "il promemoria parte una volta sola", mandate.length);
ok(tgMsg.some((t) => /Atlas ha mandato/.test(t.text)), "JJ sa cosa ha mandato Atlas", tgMsg);
nuovo(); repo["atlas.json"] = { "x@p.it": { nome: "", turni: [], riepilogo: "", impegni: [{ id: "b", cosa: "y", giorno: "2026-12-10", ora: "09:00", avvisato: false, ics: true }] } };
await atlasPromemoria(env, new Date("2026-12-10T07:07:00Z"));   // 08:07 a Roma d'inverno (+1): un'ora prima delle 9
ok(mandate.some((m) => /Alle 09:00/.test(m.subject)), "d'inverno (ora solare) il promemoria parte all'ora giusta", mandate.map((m) => m.subject));

console.log("── la sera prima e gli inviti del calendario (la lettera: «il giorno prima e la mattina stessa»; Jessica: «nel calendario»)");
nuovo(); repo["atlas.json"] = { "jessica@p.it": { nome: "Jessica Crippa", turni: [], riepilogo: "", impegni: [
  { id: "c1", cosa: "ricordare a Jacopo il parrucchiere; e la torta", giorno: "2026-10-14", ora: "18:00", avvisato: false },
  { id: "c2", cosa: "giubbotto per Athena", giorno: "2026-10-14", ora: null, avvisato: false } ] } };
await atlasPromemoria(env, new Date("2026-10-13T00:07:00Z"));   // 02:07 a Roma: di notte niente inviti
ok(mandate.length === 0, "di notte non si mandano gli inviti", mandate.map((m) => m.subject));
await atlasPromemoria(env, new Date("2026-10-13T05:07:00Z"));   // 07:07 a Roma del 13
const inv = mandate.find((m) => /da mettere nel tuo calendario/.test(m.subject));
ok(inv && inv.attachment.length === 2 && inv.attachment.every((a) => /^atlas-2026-10-14-c\d\.ics$/.test(a.name)), "alle 7 una mail con un invito .ics per impegno", inv && inv.attachment.map((a) => a.name));
const ics1 = inv ? Buffer.from(inv.attachment[0].content, "base64").toString() : "", ics2 = inv ? Buffer.from(inv.attachment[1].content, "base64").toString() : "";
ok(/DTSTART:20261014T160000Z\r\n/.test(ics1) && /DTEND:20261014T163000Z/.test(ics1) && /TRIGGER:-PT60M/.test(ics1) && /SUMMARY:ricordare a Jacopo il parrucchiere\\; e la torta/.test(ics1) && /^BEGIN:VCALENDAR\r\n/.test(ics1),
   "l'invito con l'ora: le 18 di Roma sono le 16 UTC, 30 minuti, avviso un'ora prima, il «;» scritto come vuole il calendario", ics1);
ok(/DTSTART;VALUE=DATE:20261014\r\nDTEND;VALUE=DATE:20261015/.test(ics2) && /TRIGGER:-PT4H/.test(ics2), "senza ora: tutto il giorno, avviso alle 20 della sera prima", ics2);
const n_ = mandate.length; await atlasPromemoria(env, new Date("2026-10-13T06:07:00Z")); ok(!mandate.slice(n_).some((m) => /calendario/.test(m.subject)), "gli inviti partono una volta sola", mandate.slice(n_).map((m) => m.subject));
await atlasPromemoria(env, new Date("2026-10-13T18:07:00Z"));   // 20:07 a Roma del 13: quelli del 14
const sera = mandate.find((m) => /🌙 Domani, mercoledì 14\/10/.test(m.subject));
ok(sera && /18:00 ricordare a Jacopo/.test(sera.textContent) && /giubbotto/.test(sera.textContent), "alle 20 della sera prima: quelli di domani", mandate.map((m) => m.subject));
const n2 = mandate.length; await atlasPromemoria(env, new Date("2026-10-13T19:07:00Z")); ok(mandate.length === n2, "la sera prima una volta sola", mandate.length - n2);

console.log("── /invito, la prova di JJ");
nuovo();
await W.fetch(new Request("https://x/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": tok, "Content-Type": "application/json" },
  body: JSON.stringify({ message: { message_id: 9, from: { id: 42 }, chat: { id: 42, type: "private" }, text: "/invito jj@prova.it" } }) }), env, { waitUntil() {} });
ok(mandate.length === 1 && mandate[0].to[0].email === "jj@prova.it" && mandate[0].attachment.length === 2 && /Mandata a jj@prova\.it/.test((tgMsg.at(-1) || {}).text || ""), "/invito manda due inviti alla mail scritta, e lo dice", [mandate, tgMsg.at(-1)]);
nuovo();
await W.fetch(new Request("https://x/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": tok, "Content-Type": "application/json" },
  body: JSON.stringify({ message: { message_id: 9, from: { id: 42 }, chat: { id: 42, type: "private" }, text: "/invito" } }) }), env, { waitUntil() {} });
ok(mandate.length === 1 && mandate[0].to[0].email === "jjavis@prova.it", "senza mail, alla Gmail di JJA-VIS", mandate.map((m) => m.to));

console.log(errori ? `\n${errori} prove rosse` : "\nVERDE"); process.exit(errori ? 1 : 0);
