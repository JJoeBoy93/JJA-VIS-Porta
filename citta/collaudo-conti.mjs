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
r = await chiama("/conto/porta", { gettoni: 261, skin: ["cavaliere", "<script>", "base"] }, A);
prova("la prima volta il telefono porta i suoi gettoni e le sue skin (le strane si buttano)", r.conto.gettoni === 261 && r.conto.skin.join() === "cavaliere,base" && r.conto.portato, r);
r = await chiama("/conto/porta", { gettoni: 999, skin: ["altra"] }, A); prova("la seconda volta no", r.conto.gettoni === 261 && !r.conto.skin.includes("altra"), r);
r = await chiama("/conto/spendi", { n: 61 }, A); prova("spendere scala i gettoni", r.conto && r.conto.gettoni === 200, r);
r = await chiama("/conto/spendi", { n: 500 }, A); prova("più di quelli che hai: no, e dice quanti ne hai", r.stato === 409 && r.no === "pochi" && r.conto.gettoni === 200, r);
r = await chiama("/conto/spendi", { n: -5 }, A); prova("spendere un numero negativo: no", r.stato === 400, r);
r = await chiama("/conto/guadagna", { n: 1000 }, A); prova("vincere più di 100 in un colpo: no", r.stato === 400, r);
let tot = 0; for (let i = 0; i < 12; i++) { r = await chiama("/conto/guadagna", { n: 100 }, A); tot += r.dati; }
prova("vincere: al massimo 1000 al giorno", tot === 1000 && r.conto.gettoni === 1200, [tot, r.conto && r.conto.gettoni]);
r = await chiama("/conto/skin", { id: "neon", prezzo: 300 }, A); prova("sbloccare una skin: costa e resta tua", r.conto.gettoni === 900 && r.conto.skin.includes("neon"), r);
r = await chiama("/conto/skin", { id: "neon", prezzo: 300 }, A); prova("risbloccarla non costa di nuovo", r.conto.gettoni === 900, r);
r = await chiama("/conto/skin", { id: "oro", prezzo: 5000 }, A); prova("una skin che non puoi pagare non arriva", r.stato === 409 && !r.conto.skin.includes("oro"), r);
r = await chiama("/conto/soprannome", { soprannome: "str0nz0" }, A); prova("soprannome col filtro: le parolacce no", r.stato === 400, r);
r = await chiama("/conto/soprannome", { soprannome: "Anna_93" }, A); prova("soprannome buono: resta nell'account", r.conto.soprannome === "Anna_93", r);
r = await entra(giusto("1", "anna@prova.it")); prova("rientrando con Google ritrovi tutto (non è un account nuovo)", !r.nuovo && r.conto.gettoni === 900 && r.conto.soprannome === "Anna_93", r);
const A2 = r.token;

// l'amministratore (JJ): può tutto senza gettoni
r = await entra(giusto("99", "Capo@Prova.it")); const J = r.token;
prova("la mail dell'amministratore entra come amministratore", r.conto.admin === true, r);
r = await chiama("/conto/spendi", { n: 5000 }, J); prova("l'amministratore spende 5000 e i gettoni restano 100", r.stato === 200 && r.conto.gettoni === 100, r);
r = await chiama("/conto/skin", { id: "oro", prezzo: 5000 }, J); prova("all'amministratore le skin non costano", r.conto.skin.includes("oro") && r.conto.gettoni === 100, r);
r = await chiama("/conto", null, A2, "GET"); prova("e un utente qualsiasi resta un utente qualsiasi", r.conto.admin === false, r);

// uscire, cancellarsi
r = await chiama("/conto/esci", {}, A2); r = await chiama("/conto", null, A2, "GET"); prova("uscendo, quella sessione non vale più", r.stato === 401, r);
r = await chiama("/conto/elimina", {}, A); r = await chiama("/conto", null, A, "GET"); prova("cancellando l'account, sparisce e la sessione non vale più", r.stato === 401, r);
r = await entra(giusto("1", "anna@prova.it"), false); prova("e rientrando è davvero un account nuovo (chiede di nuovo l'età)", r.no === "eta", r);
const pre = await fetch(B + "/conto/spendi", { method: "OPTIONS" }); prova("le chiamate dal browser della pagina sono ammesse (CORS)", pre.status === 204 && pre.headers.get("access-control-allow-origin") === "https://jjoeboy93.github.io", pre.status);

console.log(`\n${esiti.filter(Boolean).length}/${esiti.length} prove`); console.log(esiti.every(Boolean) ? "VERDE" : "ROSSO");
