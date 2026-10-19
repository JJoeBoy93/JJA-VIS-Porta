// Collaudo degli account (JJ, 5/10) contro workerd vero. Biglietti «di Google» firmati con prova-chiave.json:
// il server li accetta solo perché il collaudo lo avvia con --var PROVA_JWK e --var LOCALE:1 (vedi .github/workflows/citta.yml).
//   npx wrangler dev --port 8799 --ip 127.0.0.1 --local --var LOCALE:1 --var "PROVA_JWK:$(node -e 'console.log(JSON.stringify(require("./prova-chiave.json").pubblica))')" --var JJAVIS_ADMIN:capo@prova.it
//   node collaudo-conti.mjs → VERDE
import { readFileSync } from "fs";
const PORTA_ = process.env.CITTA_PORTA || "8799", B = `http://127.0.0.1:${PORTA_}`;
const CH = JSON.parse(readFileSync(new URL("./prova-chiave.json", import.meta.url)));
const ID = "644831505498-sb1lrkalu9maun2f8vcv2e7l3au31akm.apps.googleusercontent.com";
let esiti = [];
const prova = (n, ok, d = "") => { esiti.push(!!ok); console.log((ok ? "  ok  " : "  NO  ") + n + (ok ? "" : " — " + JSON.stringify(d))); };
const b64 = x => Buffer.from(x).toString("base64url");
const priv = await crypto.subtle.importKey("jwk", CH.privata, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
async function biglietto(dati, kid = "prova-1") {
  const t = b64(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })) + "." + b64(JSON.stringify(dati));
  return t + "." + b64(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", priv, new TextEncoder().encode(t))));
}
const ora = () => Math.floor(Date.now() / 1000);
const giusto = (sub, mail, extra = {}) => ({ iss: "https://accounts.google.com", aud: ID, sub, email: mail, email_verified: true, name: "Prova", iat: ora(), exp: ora() + 600, ...extra });
async function chiama(via, corpo, token, metodo = "POST") {
  const r = await fetch(B + via, { method: metodo, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: metodo === "POST" ? JSON.stringify(corpo || {}) : undefined });
  let d = {}; try { d = await r.json(); } catch (_) {}
  return { stato: r.status, ...d };
}
const entra = async (dati, eta14 = true) => chiama("/conto/google", { credential: await biglietto(dati), eta14 });

// il biglietto
for (const [nome, d] of [["di un altro ID client (aud)", giusto("1", "a@prova.it", { aud: "altro.apps.googleusercontent.com" })], ["di un altro emittente (iss)", giusto("1", "a@prova.it", { iss: "https://cattivo.example" })],
  ["scaduto", giusto("1", "a@prova.it", { exp: ora() - 10 })], ["con la mail non verificata", giusto("1", "a@prova.it", { email_verified: false })]]) {
  const r = await entra(d); prova(`un biglietto ${nome} non entra`, r.stato === 401 && !r.token, r);
}
const falso = (await biglietto(giusto("1", "a@prova.it"))).replace(/\.[^.]+$/, "." + b64("firma finta"));
let r = await chiama("/conto/google", { credential: falso, eta14: true }); prova("un biglietto con la firma falsa non entra", r.stato === 401 && r.perche === "firma", r);
r = await chiama("/conto/google", { credential: await biglietto(giusto("1", "a@prova.it"), "chiave-sconosciuta"), eta14: true }); prova("una chiave che Google non ha non entra", r.stato === 401, r);
r = await entra(giusto("1", "a@prova.it"), false); prova("un account nuovo senza «ho almeno 14 anni» non nasce", r.stato === 400 && r.no === "eta", r);

// un utente qualsiasi
r = await entra(giusto("1", "Anna@Prova.it")); const A = r.token;
prova("con un biglietto buono nasce l'account: 100 gettoni, non amministratore, mail in minuscolo", r.stato === 200 && /^[0-9a-f]{64}$/.test(A) && r.nuovo && r.conto.gettoni === 100 && !r.conto.admin && r.conto.mail === "anna@prova.it", r);
r = await chiama("/conto", null, A, "GET"); prova("con la sessione si legge l'account", r.conto && r.conto.gettoni === 100, r);
r = await chiama("/conto", null, "0".repeat(64), "GET"); prova("una sessione inventata non legge niente", r.stato === 401, r);
r = await chiama("/conto/porta", { gettoni: 261, skin: ["cavaliere", "<script>", "base", "inventata"] }, A);
// 11/10: le skin a pagamento del telefono non entrano gratis: tornano in gettoni al loro prezzo, sempre dentro il tetto di 1000
prova("la prima volta il telefono porta i gettoni; le skin a pagamento diventano gettoni (tetto 1000), le strane e le inventate si buttano", r.conto.gettoni === 1000 && r.conto.skin.join() === "base" && r.conto.portato, r);
r = await chiama("/conto/porta", { gettoni: 999, skin: ["classica"] }, A); prova("la seconda volta no", r.conto.gettoni === 1000 && !r.conto.skin.includes("classica"), r);
r = await chiama("/conto/spendi", { n: 61 }, A); prova("spendere scala i gettoni", r.conto && r.conto.gettoni === 939, r);
r = await chiama("/conto/spendi", { n: 2000 }, A); prova("più di quelli che hai: no, e dice quanti ne hai", r.stato === 409 && r.no === "pochi" && r.conto.gettoni === 939, r);
r = await chiama("/conto/spendi", { n: -5 }, A); prova("spendere un numero negativo: no", r.stato === 400, r);
r = await chiama("/conto/guadagna", { n: 1000 }, A); prova("vincere più di 100 in un colpo: no", r.stato === 400, r);
let tot = 0; for (let i = 0; i < 12; i++) { r = await chiama("/conto/guadagna", { n: 100 }, A); tot += r.dati; }
prova("vincere: al massimo 1000 al giorno", tot === 1000 && r.conto.gettoni === 1939, [tot, r.conto && r.conto.gettoni]);
// il prezzo lo decide il listino del server (11/10, JJ: «chiudi assolutamente il buco dell'acquisto gratis»)
r = await chiama("/conto/skin", { id: "dio-athena", prezzo: 0 }, A); prova("una skin da 2000 col prezzo «0» detto dal telefono: no, costa 2000 e non bastano", r.stato === 409 && r.no === "pochi" && !r.conto.skin.includes("dio-athena") && r.conto.gettoni === 1939, r);
r = await chiama("/conto/skin", { id: "avventuriera", prezzo: 1 }, A); prova("sbloccare una skin: costa il prezzo del listino (1500, non quello detto dal telefono) e resta tua", r.conto && r.conto.gettoni === 439 && r.conto.skin.includes("avventuriera"), r);
r = await chiama("/conto/skin", { id: "avventuriera", prezzo: 1500 }, A); prova("risbloccarla non costa di nuovo", r.conto.gettoni === 439, r);
r = await chiama("/conto/skin", { id: "neon", prezzo: 0 }, A); prova("una skin che non è nel listino non si compra, nemmeno gratis", r.stato === 400 && r.no === "skin", r);
r = await chiama("/conto/skin", { id: "cavaliere" }, A); prova("una skin che non puoi pagare non arriva", r.stato === 409 && !r.conto.skin.includes("cavaliere"), r);
r = await chiama("/conto/soprannome", { soprannome: "str0nz0" }, A); prova("soprannome col filtro: le parolacce no", r.stato === 400, r);
r = await chiama("/conto/soprannome", { soprannome: "Anna_93" }, A); prova("soprannome buono: resta nell'account", r.conto.soprannome === "Anna_93", r);
// 19/10: il profilo della pagina vive nell'account (JJ: «così poi non ricominci mai da capo»)
r = await chiama("/conto/io", { io: { id: "abc123", nome: "Atlas", mestiere: "Corriere o autista", chat: [{ ruolo: "tu", testo: "ciao" }] } }, A); prova("il profilo della pagina si salva sull'account", r.fatto === true, r);
r = await chiama("/conto", null, A, "GET"); prova("e torna con l'account, da qualsiasi telefono", r.conto && r.conto.io && r.conto.io.nome === "Atlas" && r.conto.io.chat.length === 1, r);
r = await chiama("/conto/io", { io: { x: "a".repeat(70000) } }, A); prova("un profilo enorme no (60 kB)", r.stato === 413, r.stato);
r = await chiama("/conto/io", { io: { nome: "Spia" } }, null); prova("senza sessione il profilo non si scrive", r.stato === 401, r.stato);
r = await entra(giusto("1", "anna@prova.it")); prova("rientrando con Google ritrovi tutto (non è un account nuovo)", !r.nuovo && r.conto.gettoni === 439 && r.conto.soprannome === "Anna_93", r);
const A2 = r.token;

// l'amministratore (JJ): può tutto senza gettoni
r = await entra(giusto("99", "Capo@Prova.it")); const J = r.token;
prova("la mail dell'amministratore entra come amministratore", r.conto.admin === true, r);
r = await chiama("/conto/spendi", { n: 5000 }, J); prova("l'amministratore spende 5000 e i gettoni restano 100", r.stato === 200 && r.conto.gettoni === 100, r);
r = await chiama("/conto/skin", { id: "dio-zeus", prezzo: 5000 }, J); prova("all'amministratore le skin non costano", r.conto.skin.includes("dio-zeus") && r.conto.gettoni === 100, r);
r = await chiama("/conto", null, A2, "GET"); prova("e un utente qualsiasi resta un utente qualsiasi", r.conto.admin === false, r);

// la classifica (6/10)
r = await chiama("/conto/partita", { punti: 42 }, A2); prova("a fine partita il record resta, e torna la classifica", r.record === 42 && r.nuovoRecord && r.classifica[0].n === "Anna_93" && r.classifica[0].punti === 42, r);
r = await chiama("/conto/partita", { punti: 30 }, A2); prova("una partita peggiore non abbassa il record", r.record === 42 && !r.nuovoRecord, r);
r = await chiama("/conto/partita", { punti: 5000 }, A2); prova("punti impossibili: no", r.stato === 400, r);
await chiama("/conto/soprannome", { soprannome: "Capo" }, J); await chiama("/conto/partita", { punti: 50 }, J);
r = await chiama("/conto/classifica?gioco=acchiappa", null, null, "GET"); prova("la classifica la legge chiunque, in ordine, solo soprannome e punti", r.classifica.length === 2 && r.classifica[0].n === "Capo" && r.classifica[1].n === "Anna_93" && !("uid" in r.classifica[0]) && !("mail" in r.classifica[0]), r);

// entrare con la mail (6/10: «serve il metodo per chi non ha Google»): Brevo finto su 127.0.0.1:8790, il codice si legge dalla mail
const { createServer } = await import("http");
const posta = [];
const brevo = createServer((q, rr) => { let b = ""; q.on("data", c => b += c); q.on("end", () => { posta.push(JSON.parse(b || "{}")); rr.setHeader("content-type", "application/json"); rr.end('{"messageId":"x"}'); }); });
await new Promise(ok => brevo.listen(8790, "127.0.0.1", ok));
const codiceDi = m => { const x = posta.filter(p => p.to && p.to[0].email === m).pop(); return x && (/(\d{6})/.exec(x.subject) || [])[1]; };
r = await chiama("/conto/mail/codice", { mail: "non è una mail" }); prova("una mail che non è una mail: no", r.stato === 400, r);
r = await chiama("/conto/mail/codice", { mail: "Gino@Prova.it" }); const c1 = codiceDi("gino@prova.it");
prova("il codice parte per mail (6 cifre), dalla casella di JJA-VIS", r.fatto && /^\d{6}$/.test(c1 || "") && posta.slice(-1)[0].sender.email === "jjavis@prova.it", [r, posta.slice(-1)]);
r = await chiama("/conto/mail/codice", { mail: "gino@prova.it" }); prova("un altro codice subito dopo: no, fra un minuto", r.stato === 429 && r.no === "presto", r);
r = await chiama("/conto/mail/entra", { mail: "gino@prova.it", codice: c1 === "000000" ? "111111" : "000000", eta14: true }); prova("un codice sbagliato non entra, e dice quanti tentativi restano", r.stato === 401 && r.no === "codice" && r.restano === 4, r);
r = await chiama("/conto/mail/entra", { mail: "gino@prova.it", codice: c1, eta14: false }); prova("account nuovo senza «ho almeno 14 anni»: no, e il codice resta buono", r.stato === 400 && r.no === "eta", r);
r = await chiama("/conto/mail/entra", { mail: "gino@prova.it", codice: c1, eta14: true }); const G = r.token;
prova("col codice giusto si entra: nasce l'account, coi suoi 100 gettoni", /^[0-9a-f]{64}$/.test(G || "") && r.nuovo && r.conto.gettoni === 100 && r.conto.mail === "gino@prova.it", r);
r = await chiama("/conto/mail/entra", { mail: "gino@prova.it", codice: c1, eta14: true }); prova("lo stesso codice non vale due volte", r.stato === 401, r);
await chiama("/conto/spendi", { n: 30 }, G);
r = await entra(giusto("777", "gino@prova.it")); prova("una mail, un account: entrando con Google con la stessa mail ritrovi lo stesso account", !r.nuovo && r.conto.gettoni === 70, r);
r = await chiama("/conto/mail/codice", { mail: "capo@prova.it" }); await new Promise(ok => setTimeout(ok, 50));
r = await chiama("/conto/mail/entra", { mail: "capo@prova.it", codice: codiceDi("capo@prova.it"), eta14: true }); prova("l'amministratore è amministratore anche entrando con la mail", r.conto && r.conto.admin === true, r);
for (let i = 0; i < 5; i++) await chiama("/conto/mail/entra", { mail: "zoe@prova.it", codice: "123456", eta14: true });
r = await chiama("/conto/mail/codice", { mail: "zoe@prova.it" }); const cz = codiceDi("zoe@prova.it");
for (let i = 0; i < 5; i++) await chiama("/conto/mail/entra", { mail: "zoe@prova.it", codice: cz === "123456" ? "654321" : "123456", eta14: true });
r = await chiama("/conto/mail/entra", { mail: "zoe@prova.it", codice: cz, eta14: true }); prova("dopo 5 codici sbagliati anche quello giusto non vale più (niente tentativi a caso)", r.stato === 401 && r.no === "scaduto", r);
// 19/10, accedi o registrati (JJ: «username, mail e password»; chi è già registrato non deve farsi mandare il codice ogni volta)
await chiama("/conto/mail/codice", { mail: "rita@prova.it" }); const cr = codiceDi("rita@prova.it");
r = await chiama("/conto/registra", { mail: "rita@prova.it", codice: cr, username: "Rita_88", password: "corta", eta14: true }); prova("password sotto gli 8 caratteri: no", r.stato === 400 && r.no === "password", r);
r = await chiama("/conto/registra", { mail: "rita@prova.it", codice: "000000", username: "Rita_88", password: "lunga-abbastanza", eta14: true }); prova("registrazione col codice sbagliato: no", r.stato === 401, r);
r = await chiama("/conto/registra", { mail: "rita@prova.it", codice: cr, username: "Rita_88", password: "lunga-abbastanza", eta14: true });
prova("ci si registra con nome utente, mail e password (la mail confermata col codice)", !!r.token && r.conto.soprannome === "Rita_88", r);
r = await chiama("/conto/accedi", { chi: "rita@prova.it", password: "lunga-abbastanza" }); prova("poi si accede con mail e password, senza codice", !!r.token, r);
r = await chiama("/conto/accedi", { chi: "rita_88", password: "lunga-abbastanza" }); prova("o col nome utente (maiuscole indifferenti)", !!r.token, r);
r = await chiama("/conto/accedi", { chi: "rita@prova.it", password: "sbagliata!!" }); const r2 = await chiama("/conto/accedi", { chi: "nessuno@prova.it", password: "sbagliata!!" });
prova("password sbagliata e utente che non esiste danno la stessa risposta", r.stato === 401 && r2.stato === 401 && r.no === r2.no, [r, r2]);
for (let i = 0; i < 4; i++) await chiama("/conto/accedi", { chi: "rita@prova.it", password: "sbagliata!!" });
r = await chiama("/conto/accedi", { chi: "rita@prova.it", password: "lunga-abbastanza" }); prova("dopo 5 errori la porta resta chiusa 15 minuti, anche con quella giusta", r.stato === 429, r);
await chiama("/conto/mail/codice", { mail: "pino@prova.it" }); const cp = codiceDi("pino@prova.it");
r = await chiama("/conto/registra", { mail: "pino@prova.it", codice: cp, username: "RITA_88", password: "lunga-abbastanza", eta14: true }); prova("il nome utente di un altro: no", r.stato === 409 && r.no === "preso", r);
brevo.close();

// uscire, cancellarsi
r = await chiama("/conto/esci", {}, A2); r = await chiama("/conto", null, A2, "GET"); prova("uscendo, quella sessione non vale più", r.stato === 401, r);
r = await chiama("/conto/elimina", {}, A); r = await chiama("/conto", null, A, "GET"); prova("cancellando l'account, sparisce e la sessione non vale più", r.stato === 401, r);
r = await chiama("/conto/classifica?gioco=acchiappa", null, null, "GET"); prova("e sparisce anche dalla classifica", !r.classifica.some(x => x.n === "Anna_93"), r);
r = await entra(giusto("1", "anna@prova.it"), false); prova("e rientrando è davvero un account nuovo (chiede di nuovo l'età)", r.no === "eta", r);
const pre = await fetch(B + "/conto/spendi", { method: "OPTIONS" }); prova("le chiamate dal browser della pagina sono ammesse (CORS)", pre.status === 204 && pre.headers.get("access-control-allow-origin") === "https://jjoeboy93.github.io", pre.status);

console.log(`\n${esiti.filter(Boolean).length}/${esiti.length} prove`); console.log(esiti.every(Boolean) ? "VERDE" : "ROSSO");
