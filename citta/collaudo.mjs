// Collaudo del server della città contro workerd vero, il motore di Cloudflare in locale (5/10/2026, Athena).
//   cd citta && npx wrangler@4 dev --port 8799 --ip 127.0.0.1 --local     (in un altro terminale)
//   npm i ws@8 && node collaudo.mjs                                           → VERDE
// Telefoni finti: origine estranea, soprannome, aspetto filtrato, posizioni, freno, chat (filtro, pausa, zitto), chi esce, ping, città piena.
// Il filtro delle parole si prova anche da solo, su frasi vere (in fondo). Il «segnala» (6/10) con Telegram e Brevo finti su 127.0.0.1:8790:
//   wrangler dev ... --var TG_API:http://127.0.0.1:8790 --var BREVO_API:http://127.0.0.1:8790 --var TG_BOT_TOKEN:finto --var SEGNALAZIONI_CHAT:4242 --var BREVO_API_KEY:brevo-finta --var MITTENTE:jjavis@prova.it
// Controprova del 5/10: senza freno e senza controllo d'origine → ROSSO (3 prove).
import WebSocket from "ws";
import { readFileSync } from "fs";
import { pesante, soprannome, messaggio } from "./filtro.js";
const PORTA_ = process.env.CITTA_PORTA || "8799";
const URL_ = `ws://127.0.0.1:${PORTA_}/entra`, O = "https://jjoeboy93.github.io";
let esiti = [];
const prova = (n, ok, d = "") => { esiti.push(ok); console.log((ok ? "  ok  " : "  NO  ") + n + (ok ? "" : " — " + JSON.stringify(d))); };
const dorme = ms => new Promise(r => setTimeout(r, ms));
// 6/10, JJ: «niente account, niente altri». Ogni telefono finto ha il suo account, fatto con un biglietto «di Google» di prova
// (prova-chiave.json: il server lo accetta solo col --var LOCALE:1 del collaudo); il token va da solo nel «ciao»
const CH = JSON.parse(readFileSync(new URL("./prova-chiave.json", import.meta.url)));
const PRIV = await crypto.subtle.importKey("jwk", CH.privata, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
const b64u = x => Buffer.from(x).toString("base64url");
let numeroConto = 0;
async function nuovoConto(mail) {
  const ora = Math.floor(Date.now() / 1000), sub = "t" + (++numeroConto) + "-" + Date.now();
  const dati = { iss: "https://accounts.google.com", aud: "644831505498-sb1lrkalu9maun2f8vcv2e7l3au31akm.apps.googleusercontent.com", sub, email: mail || sub + "@prova.it", email_verified: true, name: "T", iat: ora, exp: ora + 600 };
  const t = b64u(JSON.stringify({ alg: "RS256", kid: "prova-1", typ: "JWT" })) + "." + b64u(JSON.stringify(dati));
  const cred = t + "." + b64u(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", PRIV, new TextEncoder().encode(t))));
  const r = await (await fetch(`http://127.0.0.1:${PORTA_}/conto/google`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: cred, eta14: true }) })).json();
  return r.token;
}
function telefono(origin = O, { conto = true, mail } = {}) {
  return new Promise(async ok => { const tok = conto ? await nuovoConto(mail) : null;
    const ws = new WebSocket(URL_, { origin }); const msg = [];
    const manda = ws.send.bind(ws);
    ws.send = d => { if (tok && typeof d === "string" && d.startsWith('{"t":"ciao"')) { const m = JSON.parse(d); if (!("tok" in m)) m.tok = tok; d = JSON.stringify(m); } manda(d); };
    ws.on("message", d => { const s = String(d); if (s !== "pong") msg.push(JSON.parse(s)); });
    ws.on("open", () => ok({ ws, msg, aperto: true, tok }));
    ws.on("unexpected-response", (_, r) => ok({ ws, msg, aperto: false, stato: r.statusCode }));
    ws.on("error", () => {}); });
}
const A = { skin: "base", vestito: "corriere", corpo: "donna", pelle: 2, capelli: "coda", capelliColore: 3, colore: 0x00B4D8, pantaloni: 0x111111 };

const estraneo = await telefono("https://altro.sito");
prova("da un'origine estranea non si entra (403)", !estraneo.aperto && estraneo.stato === 403, estraneo.stato);

const t1 = await telefono(), t2 = await telefono();
prova("due telefoni entrano", t1.aperto && t2.aperto);
t1.ws.send(JSON.stringify({ t: "ciao", a: A, p: { x: 0, z: 18 } })); await dorme(300);
prova("senza soprannome non si entra: il server dice perché", t1.msg.some(m => m.t === "no" && m.perche === "soprannome") && !t1.msg.some(m => m.t === "tu"), t1.msg);
t1.ws.send(JSON.stringify({ t: "ciao", n: "str0nz0", a: A, p: { x: 0, z: 18 } })); await dorme(300);
prova("un soprannome con parole pesanti non entra", !t1.msg.some(m => m.t === "tu"), t1.msg);
t1.ws.send(JSON.stringify({ t: "ciao", n: "Ada", a: A, p: { x: 0, z: 18, r: 3.14, y: 0, s: 0, l: "" } })); await dorme(300);
t2.ws.send(JSON.stringify({ t: "ciao", n: "  Bruno_93 ", a: { ...A, skin: "<script>", nome: "Mario Rossi", colore: "rosso" }, p: { x: 2, z: 16 } })); await dorme(300);
const tu2 = t2.msg.find(m => m.t === "tu");
prova("chi arriva riceve chi c'è già, col soprannome, l'aspetto e dov'è", tu2 && tu2.altri.length === 1 && tu2.altri[0].n === "Ada" && tu2.altri[0].a.vestito === "corriere" && tu2.altri[0].p.z === 18, tu2);
const arr = t1.msg.find(m => m.t === "arriva");
prova("chi c'era vede arrivare l'altro, col soprannome ripulito", arr && arr.n === "Bruno_93", arr);
prova("l'aspetto passa solo coi campi e i valori ammessi (skin strana → classica, niente nome, colore non numero → null)",
  arr && arr.a.skin === "classica" && !("nome" in arr.a) && arr.a.colore === null, arr && arr.a);
t2.ws.send(JSON.stringify({ t: "qui", p: { x: 5.123, z: 10, r: 1, y: 0, s: 0, l: "" } })); await dorme(300);
const q = t1.msg.filter(m => m.t === "qui").pop();
prova("la posizione arriva agli altri, arrotondata", q && q.p.x === 5.12 && q.id === arr.id, q);
t2.ws.send(JSON.stringify({ t: "qui", p: { x: 1e9, z: 0 } })); t2.ws.send("non json"); t2.ws.send(JSON.stringify({ t: "qui", p: { x: 1, z: 2, l: "../../etc" } })); await dorme(300);
const ql = t1.msg.filter(m => m.t === "qui");
prova("posizioni assurde si buttano; una stanza strana diventa «in città»", ql.length === 2 && ql[1].p.l === "", ql);
const n0 = t1.msg.length;
for (let i = 0; i < 30; i++) t2.ws.send(JSON.stringify({ t: "qui", p: { x: i, z: 0 } }));
await dorme(500);
const passati = t1.msg.length - n0;
prova("il freno: 30 messaggi in un colpo, ne passano al massimo 8", passati <= 8 && passati > 0, passati);
// la chat della città
await dorme(1100);
const c0 = t1.msg.length, c2 = t2.msg.length;
t1.ws.send(JSON.stringify({ t: "di", x: "Ciao a tutti, ci vediamo al Café" })); await dorme(300);
const di1 = t2.msg.slice(c2).find(m => m.t === "di"), eco = t1.msg.slice(c0).find(m => m.t === "di");
prova("un messaggio arriva agli altri col soprannome, e torna a chi l'ha scritto", di1 && di1.n === "Ada" && di1.x === "Ciao a tutti, ci vediamo al Café" && eco, [di1, eco]);
t1.ws.send(JSON.stringify({ t: "di", x: "subito un altro" })); await dorme(200);
prova("due messaggi troppo vicini: il secondo aspetta («piano»)", t1.msg.slice(-1)[0].perche === "piano", t1.msg.slice(-1));
const prima = t2.msg.filter(m => m.t === "di").length;
for (const [x, perche] of [["guarda su www.sito.it", "link"], ["chiamami 333 123 4567", "numero"], ["sei uno str0nz0", "parole"], ["x".repeat(201), "lungo"]]) {
  await dorme(1600); t1.ws.send(JSON.stringify({ t: "di", x })); await dorme(250);
  prova(`«${x.slice(0, 22)}» non passa (${perche})`, t1.msg.slice(-1)[0].t === "no" && t1.msg.slice(-1)[0].perche === perche, t1.msg.slice(-1));
}
prova("e agli altri non è arrivato niente di quei quattro", t2.msg.filter(m => m.t === "di").length === prima);
for (let i = 0; i < 2; i++) { await dorme(1600); t1.ws.send(JSON.stringify({ t: "di", x: "che cazzo vuoi" })); await dorme(250); }
await dorme(1600); t1.ws.send(JSON.stringify({ t: "di", x: "scusate" })); await dorme(250);
prova("tre volte parole pesanti: zitto per dieci minuti, anche coi messaggi buoni", t1.msg.slice(-1)[0].perche === "zitto" && t1.msg.slice(-1)[0].fino > Date.now() + 9 * 60 * 1000, t1.msg.slice(-1));
const t3 = await telefono(); t3.ws.send(JSON.stringify({ t: "qui", p: { x: 1, z: 1 } })); await dorme(300);
prova("chi non ha salutato non muove niente", !t1.msg.slice(n0 + passati).some(m => m.t === "qui"), t1.msg.slice(-3));
const r = await (await fetch(`http://127.0.0.1:${PORTA_}/`)).json();
prova("GET / dice quanti sono dentro", r.risponde === true && r.dentro === 3, r);
t2.ws.close(); await dorme(500);
prova("chi esce sparisce dagli altri", t1.msg.some(m => m.t === "va" && m.id === arr.id), t1.msg.slice(-2));
// il ping lo risponde Cloudflare da solo
const pong = new Promise(ok => { t1.ws.once("message", d => ok(String(d))); setTimeout(() => ok(null), 1500); });
t1.ws.send("ping");
prova("«ping» → «pong»", (await pong) === "pong");
// la città piena: 40 dentro, il 41° esce con 4001
const tanti = []; for (let i = 0; i < 38; i++) tanti.push(await telefono());
const ultimo = await telefono(); const chiuso = await new Promise(ok => { ultimo.ws.on("close", c => ok(c)); setTimeout(() => ok(null), 3000); });
prova("al 41° la città è piena: chiude con 4001", chiuso === 4001, chiuso);
tanti.forEach(t => t.ws.close()); t1.ws.close(); t3.ws.close(); await dorme(300);
// il «segnala» (6/10): Telegram e Brevo finti su 127.0.0.1:8790 (wrangler dev --var TG_API / BREVO_API): niente parte davvero
const { createServer } = await import("http");
const arrivati = [];
const finto = createServer((q, r) => { let b = ""; q.on("data", c => b += c); q.on("end", () => { arrivati.push({ via: q.url, corpo: JSON.parse(b || "{}"), chiave: q.headers["api-key"] });
  r.setHeader("content-type", "application/json"); r.end(q.url.includes("sendMessage") ? '{"ok":true,"result":{}}' : '{"messageId":"x"}'); }); });
await new Promise(ok => finto.listen(8790, "127.0.0.1", ok));
const cattivo = await telefono(), buono = await telefono();
cattivo.ws.send(JSON.stringify({ t: "ciao", n: "Cattivo99", a: A, p: { x: 1, z: 1 } }));
buono.ws.send(JSON.stringify({ t: "ciao", n: "Buona", a: A, p: { x: 2, z: 2 } })); await dorme(400);
const idC = buono.msg.find(m => m.t === "tu").altri.find(x => x.n === "Cattivo99").id;
for (const x of ["ciao", "dammi il tuo indirizzo", "dove abiti?"]) { cattivo.ws.send(JSON.stringify({ t: "di", x })); await dorme(1600); }
buono.ws.send(JSON.stringify({ t: "segnala", id: idC, motivo: "boh" })); await dorme(300);
prova("un motivo che non esiste: la segnalazione non parte", buono.msg.slice(-1)[0].t === "segnalato" && buono.msg.slice(-1)[0].ok === false && !arrivati.length, buono.msg.slice(-1));
buono.ws.send(JSON.stringify({ t: "segnala", id: idC, motivo: "molestie", nota: "mi chiede dove abito", visti: ["dove abiti?"] })); await dorme(800);
const esito = buono.msg.filter(m => m.t === "segnalato").pop(), tg = arrivati.find(x => x.via.includes("/sendMessage")), ml = arrivati.find(x => x.via.includes("/v3/smtp/email"));
prova("segnalare: chi segnala sa che è arrivata (Telegram e mail)", esito && esito.ok && esito.fatto.join() === "telegram,mail", esito);
prova("su Telegram arriva a JJ: motivo, chi, da chi, la nota", tg && tg.corpo.chat_id === "4242" && /molestie/.test(tg.corpo.text) && /«Cattivo99»/.test(tg.corpo.text) && /«Buona»/.test(tg.corpo.text) && /mi chiede dove abito/.test(tg.corpo.text), tg && tg.corpo);
prova("…con le sue ultime frasi prese dal SERVER, non solo quelle riferite", tg && /prese dal server:\n.*ciao\n.*dammi il tuo indirizzo\n.*dove abiti\?/.test(tg.corpo.text), tg && tg.corpo.text);
prova("la mail va alla casella di JJA-VIS, con la chiave di Brevo", ml && ml.corpo.to[0].email === "jjavis@prova.it" && ml.chiave === "brevo-finta" && /Segnalazione: molestie/.test(ml.corpo.subject), ml && ml.corpo);
prova("al segnalato non arriva niente", !cattivo.msg.some(m => m.t === "segnalato"));
for (let i = 0; i < 3; i++) { buono.ws.send(JSON.stringify({ t: "segnala", id: idC, motivo: "spam" })); await dorme(300); }
prova("più di 3 segnalazioni in dieci minuti: «troppe»", buono.msg.filter(m => m.t === "segnalato").pop().perche === "troppe", buono.msg.filter(m => m.t === "segnalato").slice(-2));
buono.ws.send(JSON.stringify({ t: "segnala", id: "nessuno", motivo: "spam" })); await dorme(300);
cattivo.ws.close(); buono.ws.close(); finto.close();

// niente account, niente altri; e l'amministratore che modera (6/10)
const senza = await telefono(O, { conto: false });
senza.ws.send(JSON.stringify({ t: "ciao", n: "Anonimo", a: A, p: { x: 0, z: 0 } })); await dorme(400);
prova("senza account non si entra con gli altri: «account»", senza.msg.some(m => m.t === "no" && m.perche === "account") && !senza.msg.some(m => m.t === "tu"), senza.msg);
const falso = await telefono(O, { conto: false });
falso.ws.send(JSON.stringify({ t: "ciao", n: "Furbo", a: A, p: { x: 0, z: 0 }, tok: "a".repeat(64) })); await dorme(400);
prova("con un token inventato nemmeno", falso.msg.some(m => m.perche === "account") && !falso.msg.some(m => m.t === "tu"), falso.msg);
senza.ws.close(); falso.ws.close();
const re = await telefono(O, { mail: "capo@prova.it" }), uno = await telefono(), due = await telefono();
re.ws.send(JSON.stringify({ t: "ciao", n: "JJoe", a: A, p: { x: 0, z: 0 } })); await dorme(300);
uno.ws.send(JSON.stringify({ t: "ciao", n: "Molesto", a: A, p: { x: 1, z: 0 } })); await dorme(300);
due.ws.send(JSON.stringify({ t: "ciao", n: "Tranquillo", a: A, p: { x: 2, z: 0 } })); await dorme(300);
const visto = due.msg.find(m => m.t === "tu").altri;
prova("gli altri vedono chi è l'amministratore (la corona), e solo lui", visto.find(x => x.n === "JJoe").re === true && visto.find(x => x.n === "Molesto").re === false, visto);
const idM = visto.find(x => x.n === "Molesto").id;
const r0 = await (await fetch(`http://127.0.0.1:${PORTA_}/conto`, { headers: { Authorization: "Bearer " + uno.tok } })).json();
prova("il soprannome scelto in città finisce nell'account", r0.conto && r0.conto.soprannome === "Molesto", r0);
due.ws.send(JSON.stringify({ t: "modera", id: idM, azione: "blocca" })); await dorme(300);
prova("chi non è amministratore non può moderare", due.msg.filter(m => m.t === "moderato").pop().perche === "admin" && uno.ws.readyState === 1, due.msg.slice(-1));
re.ws.send(JSON.stringify({ t: "modera", id: idM, azione: "zittisci", minuti: 60 })); await dorme(400);
prova("l'amministratore lo zittisce: lui lo sa", re.msg.filter(m => m.t === "moderato").pop().ok && uno.msg.some(m => m.t === "no" && m.perche === "zitto" && m.fino > Date.now() + 59 * 60000), [re.msg.slice(-1), uno.msg.slice(-1)]);
uno.ws.send(JSON.stringify({ t: "di", x: "ciao a tutti" })); await dorme(300);
prova("zittito non scrive", uno.msg.slice(-1)[0].perche === "zitto" && !due.msg.some(m => m.t === "di" && m.x === "ciao a tutti"));
uno.ws.close(); await dorme(300);
const uno2 = await new Promise(ok => { const ws = new WebSocket(URL_, { origin: O }); const msg = []; ws.on("message", d => { const x = String(d); if (x !== "pong") msg.push(JSON.parse(x)); }); ws.on("open", () => ok({ ws, msg })); ws.on("close", c => msg.push({ chiuso: c })); });
uno2.ws.send(JSON.stringify({ t: "ciao", n: "Molesto", a: A, p: { x: 1, z: 0 }, tok: uno.tok })); await dorme(400);
uno2.ws.send(JSON.stringify({ t: "di", x: "sono tornato" })); await dorme(300);
prova("e rientrando resta zittito: è sull'account, non sul collegamento", uno2.msg.some(m => m.t === "tu") && uno2.msg.slice(-1)[0].perche === "zitto", uno2.msg.slice(-2));
const idM2 = re.msg.filter(m => m.t === "arriva" && m.n === "Molesto").pop().id;
re.ws.send(JSON.stringify({ t: "modera", id: idM2, azione: "blocca" })); await dorme(500);
prova("l'amministratore lo blocca: fuori dalla città (4003)", uno2.msg.some(m => m.chiuso === 4003) && due.msg.some(m => m.t === "va" && m.id === idM2), uno2.msg.slice(-2));
const r1 = await (await fetch(`http://127.0.0.1:${PORTA_}/conto`, { headers: { Authorization: "Bearer " + uno.tok } })).json();
prova("bloccato: la sua sessione non vale più", !r1.conto, r1);
const uno3 = await telefono(O, { conto: false });
uno3.ws.send(JSON.stringify({ t: "ciao", n: "Molesto", a: A, p: { x: 1, z: 0 }, tok: uno.tok })); await dorme(400);
prova("e con la vecchia sessione non rientra", !uno3.msg.some(m => m.t === "tu"), uno3.msg);
re.ws.send(JSON.stringify({ t: "modera", id: re.msg.find(m => m.t === "tu").id, azione: "blocca" })); await dorme(300);
prova("l'amministratore non si blocca da solo", re.ws.readyState === 1 && re.msg.filter(m => m.t === "moderato").pop().ok === false);
re.ws.close(); due.ws.close(); uno3.ws.close(); await dorme(300);

// il filtro da solo: le parole pesanti si vedono anche travestite, e le parole buone che le contengono passano
const frasi = [["che c4zz0 dici", true], ["s t r o n z o", true], ["porco dio", true], ["ciao frocio", true], ["negro", true], ["il terrone", true],
  ["Scazzottata in piazza", false], ["Dickens è bello", false], ["un negroni sbagliato", false], ["Cassazione", false], ["analisi del sangue", false], ["Mi piace la Torre", false]];
const sbagliate = frasi.filter(([t, atteso]) => pesante(t) !== atteso);
prova("il filtro: dodici frasi, travestite e no, giudicate giuste", !sbagliate.length, sbagliate);
prova("i soprannomi: sì «JJoe_Boy93» e «Ada Lovelace»; no troppo corto, numero di telefono, segni strani",
  soprannome("JJoe_Boy93") === "JJoe_Boy93" && soprannome("  Ada  Lovelace ") === "Ada Lovelace" && !soprannome("ab") && !soprannome("Mario 3331234567") && !soprannome("x<script>"));
prova("un messaggio con un link travestito non passa", messaggio("vai su sito . com").no === "link" && messaggio("discord.gg/abc").no === "link");
console.log(`\n${esiti.filter(Boolean).length}/${esiti.length} prove`); console.log(esiti.every(Boolean) ? "VERDE" : "ROSSO");
process.exit(0);
