// I Numeri della sera — tutto finto.   node collaudo/numeri.mjs
// Nato il 28 settembre 2026 (Athena). JJ: «la domanda di quanto varrebbe è
// in funzione di quello che serve a chi chiede… messa così sembra che quanto
// vale è JJAVIS». Controlla: il prezzo si legge accanto alla cosa che fa
// perdere tempo; il 15 del cursore è detto; senza risposte non c'è la riga.
// 27/10 (Efesto) — «📊 La settimana», dove si perdono le persone: ogni lunedì (ora di Roma) nel turno delle 18 UTC, e con /numeri. Controlla:
// con un atlas.json finto di 6 persone (più due account di JJ, un cancellato, uno senza account) i cinque numeri e le percentuali sono
// quelli scritti a mano qui; un turno «[dal sondaggio]» non è una risposta; di martedì non parte; con atlas.json in errore il messaggio
// dice «non letto» e non mostra zeri. CONTROPROVA: contando anche i turni «[dal sondaggio]» la prova delle risposte diventa rossa.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = resolve(process.argv[2] || join(qui, "..", "worker.js"));
const copia = join(mkdtempSync(join(tmpdir(), "numeri-")), "worker.mjs");
copyFileSync(sorgente, copia);
for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(dirname(sorgente), f), join(dirname(copia), f));
const W = (await import(copia)).default;
// la copia della controprova: il turno «[dal sondaggio]» conta come risposta
const MARCA = "const NON_E_UNA_RISPOSTA = /^\\[(dal sondaggio\\]|Atlas aperto da JJ)/;";
const testoSorgente = readFileSync(sorgente, "utf8");
if (!testoSorgente.includes(MARCA)) { console.log("  ❌ la regola delle risposte non è più quella: aggiorna MARCA nella controprova"); process.exit(1); }
const dirVecchio = mkdtempSync(join(tmpdir(), "numeri-vecchio-"));
for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(dirname(sorgente), f), join(dirVecchio, f));
writeFileSync(join(dirVecchio, "worker.mjs"), testoSorgente.replace(MARCA, "const NON_E_UNA_RISPOSTA = /^\\[(Atlas aperto da JJ)/;"));
const Vecchio = (await import(join(dirVecchio, "worker.mjs"))).default;
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const repo = new Map(), tg = []; let guastoAtlas = false;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
globalThis.fetch = async (url, o = {}) => {
  url = String(url); const m = o.method || "GET";
  const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
  if (url.includes("api.github.com")) {
    const p = decodeURIComponent(url.split("/contents/")[1] || "");
    if (m === "GET" && p === "atlas.json" && guastoAtlas) return J({ message: "Server Error" }, 500);
    if (m === "GET") { if (repo.has(p)) return J({ content: repo.get(p), sha: "s" });
      const dir = [...repo.keys()].filter((k) => k.startsWith(p + "/")); if (dir.length) return J(dir.map((k) => ({ name: k.split("/").pop() })));
      return J({ message: "Not Found" }, 404); }
    if (m === "PUT") { repo.set(p, JSON.parse(o.body).content); return J({ content: { sha: "x" } }, 201); }
  }
  if (url.includes("api.telegram.org")) { tg.push(JSON.parse(o.body)); return J({ ok: true, result: { message_id: 7, message_thread_id: 3 } }); }
  return J({}, 404);
};
const env = { GH_TOKEN: "t", TG_BOT_TOKEN: "bot", TG_CHAT: "42" };
const sera = async () => { tg.length = 0; const att = []; await W.scheduled({ cron: "0 18 * * *" }, env, { waitUntil: (p) => att.push(p) }); await Promise.all(att); return tg.map((x) => x.text || "").find((t) => t.includes("📊 Numeri")) || ""; };

repo.set("utenti/a.json", b64({ ha_risposto: true, mestiere: "Corriere o autista", tempo: "Preventivi, conti, fatture", prezzo_al_mese: 15, primo: "2026-09-26", ultimo: "2026-09-26" }));
repo.set("utenti/b.json", b64({ ha_risposto: true, mestiere: "Altro", tempo: "Organizzare la giornata", prezzo_al_mese: 15, primo: "2026-09-26", ultimo: "2026-09-27" }));
repo.set("utenti/c.json", b64({ ha_risposto: true, mestiere: "Corriere o autista", tempo: "Organizzare la giornata", prezzo_al_mese: 40, primo: "2026-09-27", ultimo: "2026-09-27" }));
repo.set("utenti/d.json", b64({ ha_risposto: false, primo: "2026-09-27", ultimo: "2026-09-27" }));

console.log("── il prezzo accanto alla cosa");
const t = await sera();
ok(t.includes("farsi togliere il tempo perso"), "la riga dice DI COSA è il prezzo, non «quanto vale JJA-VIS»");
ok(t.includes("· Organizzare la giornata: 27.5 € (2)") && t.includes("· Preventivi, conti, fatture: 15 € (1)"), "ogni cosa col suo prezzo e quanti l'hanno detto");
ok(t.includes("15 € è dove parte il cursore: 2 risposte su 3"), "il 15 di partenza del cursore è detto, con quante risposte ci stanno sopra");
ok(!t.includes("undefined"), "niente «undefined»");

console.log("── senza nessun 15, niente avviso");
repo.set("utenti/a.json", b64({ ha_risposto: true, tempo: "Preventivi, conti, fatture", prezzo_al_mese: 20, primo: "x", ultimo: "x" }));
repo.set("utenti/b.json", b64({ ha_risposto: true, tempo: "Organizzare la giornata", prezzo_al_mese: 30, primo: "x", ultimo: "x" }));
ok(!(await sera()).includes("dove parte il cursore"), "nessun 15: nessun avviso");

console.log("── 📊 La settimana: dove si perdono le persone");
const ADESSO = Date.parse("2026-10-26T18:00:00Z");   // un lunedì
const lei = (testo, quando) => ({ chi: "lei", testo, quando }), noi = (quando) => ({ chi: "noi", testo: "Ecco cosa faccio per te.", quando });
const imp = [{ id: "i1", cosa: "dal medico", giorno: "2026-10-30", ora: "10:00" }];
repo.clear();
const persona = (chi, mail, nascita, extra = {}) => repo.set(`utenti/${chi}.json`, b64({ chi, mail, ...(nascita ? { nascita } : {}), ha_risposto: true, primo: "2026-10-01", ultimo: "2026-10-25", ...extra }));
// Anna: tutti i passi; torna ESATTAMENTE 7 giorni dopo il suo primo turno (19/10 09:00, il primo era il 12/10 09:00)
persona("anna", "anna@x.it", "2026-10-12T08:00:00Z");
// Bruno: account NUOVO questa settimana, prima risposta questa settimana, impegno; l'ultimo turno è 5 giorni dopo il primo: non è tornato
persona("bruno", "bruno@x.it", "2026-10-20T08:00:00Z");
// Gina: ha risposto ma non ha segnato impegni; Carla: ha solo il turno «[dal sondaggio]»; Elena: solo «[Atlas aperto da JJ»; Dino: account, e JJ ha detto «no»
persona("gina", "gina@x.it", "2026-10-15T08:00:00Z"); persona("carla", "carla@x.it", "2026-10-14T08:00:00Z");
persona("elena", "elena@x.it", "2026-10-10T08:00:00Z"); persona("dino", "dino@x.it", "2026-10-23T08:00:00Z");
// fuori dai conti, anche se hanno fatto tutto: i due account di JJ (una mail scritta con le maiuscole), un cancellato; e due che un account non ce l'hanno
persona("jj1", "19.JJardito93@Gmail.com", "2026-10-11T08:00:00Z"); persona("jj2", "19.jja.vis.93@gmail.com", "2026-10-12T08:00:00Z");
persona("fabio", "fabio@x.it", "2026-10-11T08:00:00Z"); persona("contatto", "contatto@x.it", null);   // contatto: ha scritto in chat, mai fatto l'account
const tutto = (primo) => ({ primo, turni: [lei("[dal sondaggio] preventivi", primo), noi(primo), lei("[chat] ciao", "2026-10-13T10:00:00Z"), lei("[chat] ancora", "2026-10-19T10:00:00Z")], impegni: imp });
const atlasFinto = {
  "anna@x.it": { primo: "2026-10-12T09:00:00.000Z", impegni: imp, turni: [lei("[dal sondaggio] preventivi", "2026-10-12T09:00:00.000Z"), noi("2026-10-12T09:00:01.000Z"),
    lei("[chat] ciao", "2026-10-13T10:00:00.000Z"), lei("[chat] ancora", "2026-10-19T09:00:00.000Z")] },
  "bruno@x.it": { primo: "2026-10-20T09:00:00.000Z", impegni: imp, turni: [lei("[dal sondaggio] orari", "2026-10-20T09:00:00.000Z"), noi("2026-10-20T09:00:01.000Z"),
    lei("[chat] ok", "2026-10-22T10:00:00.000Z"), lei("[chat] ok2", "2026-10-25T10:00:00.000Z")] },
  "gina@x.it": { primo: "2026-10-15T09:00:00.000Z", impegni: [], turni: [lei("[dal sondaggio] fatture", "2026-10-15T09:00:00.000Z"), noi("2026-10-15T09:00:01.000Z"), lei("[chat] ciao", "2026-10-17T10:00:00.000Z")] },
  "carla@x.it": { primo: "2026-10-14T09:00:00.000Z", impegni: [], turni: [lei("[dal sondaggio] clienti", "2026-10-14T09:00:00.000Z"), noi("2026-10-14T09:00:01.000Z")] },
  "elena@x.it": { primo: "2026-10-10T09:00:00.000Z", impegni: [], turni: [lei("[Atlas aperto da JJ: questa persona può scrivere ad Atlas]", "2026-10-10T09:00:00.000Z"), noi("2026-10-10T09:00:01.000Z")] },
  "dino@x.it": { primo: "no", impegni: [], turni: [] },
  "19.jjardito93@gmail.com": tutto("2026-10-11T09:00:00.000Z"), "19.jja.vis.93@gmail.com": tutto("2026-10-12T09:00:00.000Z"),
  "fabio@x.it": tutto("2026-10-11T09:00:00.000Z"), "contatto@x.it": tutto("2026-10-11T09:00:00.000Z"), "solo-atlas@x.it": tutto("2026-10-11T09:00:00.000Z"),
};
repo.set("atlas.json", b64(atlasFinto)); repo.set("cancellati.json", b64(["Fabio@x.it"]));
const turno = async (modulo, quando) => { tg.length = 0; const att = []; await modulo.scheduled({ cron: "0 18 * * *", scheduledTime: Date.parse(quando) }, env, { waitUntil: (p) => att.push(p) }); await Promise.all(att);
  return tg.map((x) => x.text || ""); };
const settimana = (testi) => testi.find((t) => t.startsWith("📊 La settimana")) || "";
const lunedi = await turno(W, "2026-10-26T18:00:00Z"), L = settimana(lunedi);
ok(L.startsWith("📊 La settimana —"), "di lunedì il turno delle 18 manda «📊 La settimana —», come messaggio separato", lunedi);
ok(lunedi.findIndex((t) => t.includes("📊 Numeri")) !== -1 && lunedi.findIndex((t) => t.includes("📊 Numeri")) < lunedi.indexOf(L), "e dopo il conto della sera, non prima");
ok(/^Account fatti: 6$/m.test(L), "account fatti: 6 (non contano i due di JJ, il cancellato, chi ha scritto in chat senza account, la scheda Atlas senza account)", L);
ok(/^Prima proposta ricevuta: 5 \(83%\)$/m.test(L), "prima proposta: 5 su 6 = 83% (Dino ha «no»)", L);
ok(/^Hanno risposto almeno una volta: 3 \(60%\)$/m.test(L), "hanno risposto: 3 su 5 = 60% (Anna, Bruno, Gina)", L);
ok(/^Hanno almeno un impegno segnato: 2 \(67%\)$/m.test(L), "un impegno: 2 su 3 = 67% (Anna, Bruno)", L);
ok(/^Tornati dopo 7 giorni: 1 \(50%\)$/m.test(L), "tornati dopo 7 giorni: 1 su 2 = 50% (Anna, esattamente a 7 giorni; Bruno a 5 no)", L);
ok(/^questa settimana: 2 account nuovi, 1 prime risposte$/m.test(L), "questa settimana: 2 account nuovi (Bruno, Dino), 1 prima risposta (Bruno)", L);
ok(L.includes("(esclusi: 2 di JJ, 1 cancellati)"), "dice quanti ne ha lasciati fuori", L);
ok(!L.includes("undefined") && !L.includes("NaN"), "niente «undefined» né «NaN»");

console.log("── un turno «[dal sondaggio]» non è una risposta");
const prova3 = (t) => /^Hanno risposto almeno una volta: 3 \(60%\)$/m.test(t);
ok(prova3(L) && !/Hanno risposto almeno una volta: [4-6]/.test(L), "Carla ha solo «[dal sondaggio]» e Elena solo «[Atlas aperto da JJ»: nessuna delle due ha risposto", L);

console.log("── di martedì non parte");
const martedi = await turno(W, "2026-10-27T18:00:00Z");
ok(martedi.some((t) => t.includes("📊 Numeri")) && !martedi.some((t) => t.includes("La settimana")), "di martedì parte il conto della sera e basta", martedi);

console.log("── /numeri da Telegram lo manda sempre, sotto i numeri");
const tok = createHash("sha256").update("bot").digest("hex").slice(0, 32);
tg.length = 0;
await W.fetch(new Request("https://x/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": tok, "Content-Type": "application/json" },
  body: JSON.stringify({ message: { message_id: 9, from: { id: 42 }, chat: { id: 42, type: "private" }, text: "/numeri" } }) }), env, { waitUntil() {} });
const dopo = tg.map((x) => x.text || ""), iNumeri = dopo.findIndex((t) => t.includes("📊 Numeri")), iSett = dopo.findIndex((t) => t.startsWith("📊 La settimana —"));
ok(iNumeri !== -1 && iSett > iNumeri, "/numeri manda «📊 La settimana —» sotto i numeri (qualunque giorno sia)", dopo);

console.log("── se atlas.json non si legge, si dice");
guastoAtlas = true;
const guasto = settimana(await turno(W, "2026-10-26T18:00:00Z"));
ok(/^📊 La settimana: atlas\.json non letto \(.*500.*\)$/.test(guasto) && !/Account fatti|: 0/.test(guasto), "il messaggio dice «atlas.json non letto (motivo)», non un imbuto di zeri", guasto);
guastoAtlas = false; repo.delete("atlas.json");
ok(/^📊 La settimana: atlas\.json non letto/.test(settimana(await turno(W, "2026-10-26T18:00:00Z"))), "anche se atlas.json non c'è affatto: non è «nessuno ha fatto niente»");
repo.set("atlas.json", b64(atlasFinto));

console.log("── CONTROPROVA: contando anche i turni «[dal sondaggio]» la prova delle risposte diventa rossa");
const V = settimana(await turno(Vecchio, "2026-10-26T18:00:00Z"));
ok(prova3(L), "la regola vera: 3 hanno risposto");
ok(!prova3(V), "contando anche «[dal sondaggio]» (Carla risulta «risposta»): la prova è rossa", V);

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
