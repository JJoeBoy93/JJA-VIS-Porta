// La voce nella chat della pagina (26/10) — tutto finto, nessuna chiamata vera.   node collaudo/voce.mjs
// La pagina manda POST /assistente/voce {audio (base64), tipo} col token dell'account; la porta lo passa a Hermes
// (/jjavis/trascrivi) e torna {testo}. Controlla: token buono e Hermes finto → 200 {testo}, e a Hermes arrivano percorso,
// segreto e corpo giusti; senza token (o token sconosciuto) 401; audio oltre 1,5 MB → 400 SENZA chiamare Hermes; tipo
// video/mp4 o audio mancante → 400; Hermes giù o che sbaglia → 502 col motivo; il 61° vocale del giorno → 429 (e il giorno
// dopo si riparte, e un altro account non c'entra); i 400 non consumano il tetto; la voce non compare in nessun log né in
// nessun file scritto sull'archivio; le intestazioni CORS sono quelle di /assistente.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "voce-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
const logOriginale = console.log;   // il vero: console.log viene sostituito dal finto che raccoglie le righe, i risultati escono da qui
let errori = 0; const ok = (c, m, d = "") => { logOriginale((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const titolo = (t) => logOriginale(t);
let repo = {};
const sessioni = { ["a".repeat(64)]: "papa@prova.it", ["b".repeat(64)]: "altro@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    if ((o.headers || {}).Accept === "application/vnd.github.raw") return new Response(Buffer.from(repo[p], "base64"));
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
let hermes = [], daHermes = () => ({ stato: 200, corpo: { testo: "ciao Jarvis" } });
const HERMES = { fetch: async (rq) => { const corpo = await rq.json(); hermes.push({ p: new URL(rq.url).pathname, metodo: rq.method, segreto: rq.headers.get("X-JJAVIS-Segreto"), corpo });
  const r = daHermes(); if (r instanceof Error) throw r; return new Response(JSON.stringify(r.corpo), { status: r.stato }); } };
const env = { GH_TOKEN: "g", HERMES, JJAVIS_SEGRETO: "segreto" };
const chiama = (tok, corpo, e = env) => W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/assistente/voce", { method: "POST",
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }), e, { waitUntil() {} });
const A = "a".repeat(64), B = "b".repeat(64);
const AUDIO = Buffer.from("GkXfo-la-voce-di-una-persona-0123456789-segretissima").toString("base64");
const vocali = (mail) => { const a = repo["atlas.json"] && JSON.parse(Buffer.from(repo["atlas.json"], "base64").toString())[mail]; return a && a.vocali; };

// i log: console.log, warn, error, info finti, controllati alla fine
const righe = [];
for (const m of ["log", "warn", "error", "info"]) console[m] = (...a) => righe.push(a.map((x) => (typeof x === "string" ? x : x instanceof Error ? x.message : JSON.stringify(x))).join(" "));

titolo("── token buono, Hermes finto");
let r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); let j = await r.json();
ok(r.status === 200 && j.testo === "ciao Jarvis" && Object.keys(j).join() === "testo", "200 {testo}", [r.status, j]);
ok(hermes.length === 1 && hermes[0].p === "/jjavis/trascrivi" && hermes[0].metodo === "POST" && hermes[0].segreto === "segreto"
   && hermes[0].corpo.audio === AUDIO && hermes[0].corpo.tipo === "audio/webm", "a Hermes: /jjavis/trascrivi, col segreto, {audio, tipo}", hermes[0]);
ok(r.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io" && /Authorization/.test(r.headers.get("Access-Control-Allow-Headers")), "intestazioni CORS come /assistente");
for (const tipo of ["audio/mp4", "audio/ogg"]) { hermes = []; r = await chiama(A, { audio: AUDIO, tipo }); ok(r.status === 200 && hermes[0].corpo.tipo === tipo, `${tipo}: ammesso`); }
hermes = []; r = await chiama(A, { audio: AUDIO, tipo: "audio/webm;codecs=opus" });
ok(r.status === 200 && hermes[0].corpo.tipo === "audio/webm", "«audio/webm;codecs=opus» (come lo dà il registratore) è webm");
const pre = await W.default.fetch(new Request("https://p/assistente/voce", { method: "OPTIONS", headers: { Origin: "https://jjoeboy93.github.io" } }), env, {});
ok(pre.status === 204, "la richiesta di controllo del browser (OPTIONS) passa");

titolo("── senza token, o token sconosciuto");
hermes = [];
r = await chiama("", { audio: AUDIO, tipo: "audio/webm" }); j = await r.json(); ok(r.status === 401 && j.errore, "senza token: 401 {errore}", [r.status, j]);
r = await chiama("c".repeat(64), { audio: AUDIO, tipo: "audio/webm" }); ok(r.status === 401, "token sconosciuto: 401");
r = await chiama("non-un-token", { audio: AUDIO, tipo: "audio/webm" }); ok(r.status === 401, "token che non ha nemmeno la forma giusta: 401");
ok(hermes.length === 0, "Hermes non è stato chiamato");

titolo("── richieste sbagliate: 400, senza chiamare Hermes");
const grande = Buffer.alloc(1.5 * 1024 * 1024 + 3000, 1).toString("base64");
r = await chiama(A, { audio: grande, tipo: "audio/webm" }); j = await r.json(); ok(r.status === 400 && /1,5 MB/.test(j.errore), "oltre 1,5 MB: 400", [r.status, j]);
const quasi = Buffer.alloc(1.5 * 1024 * 1024, 1).toString("base64");
r = await chiama(A, { audio: quasi, tipo: "audio/webm" }); ok(r.status === 200, "esattamente 1,5 MB: passa");
hermes = [];
r = await chiama(A, { audio: AUDIO, tipo: "video/mp4" }); j = await r.json(); ok(r.status === 400 && /tipo/.test(j.errore), "video/mp4: 400", [r.status, j]);
r = await chiama(A, { audio: AUDIO }); ok(r.status === 400, "senza tipo: 400");
r = await chiama(A, { tipo: "audio/webm" }); j = await r.json(); ok(r.status === 400 && /audio/.test(j.errore), "senza audio: 400");
r = await chiama(A, { audio: "", tipo: "audio/webm" }); ok(r.status === 400, "audio vuoto: 400");
r = await chiama(A, { audio: "questo non è base64!", tipo: "audio/webm" }); ok(r.status === 400, "base64 rotto: 400");
r = await chiama(A, "{non json"); ok(r.status === 400, "JSON rotto: 400");
ok(hermes.length === 0, "Hermes non è stato chiamato per nessuna di queste");
ok(r.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io", "anche gli errori portano il CORS (la pagina li può leggere)");

titolo("── Hermes giù, o Groq che sbaglia: 502 col motivo");
daHermes = () => new Error("Hermes non risponde"); r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); j = await r.json();
ok(r.status === 502 && /Hermes non risponde/.test(j.errore), "Hermes giù: 502 col motivo", [r.status, j]);
daHermes = () => ({ stato: 502, corpo: { errore: "Whisper 429: Rate limit reached for model whisper-large-v3-turbo" } }); r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); j = await r.json();
ok(r.status === 502 && /Whisper 429: Rate limit reached/.test(j.errore), "Groq che sbaglia: 502 col motivo vero di Groq, passato da Hermes", [r.status, j]);
daHermes = () => ({ stato: 403, corpo: {} }); r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); j = await r.json();
ok(r.status === 502 && /403/.test(j.errore), "Hermes che rifiuta il segreto: 502 e si vede il 403", [r.status, j]);
daHermes = () => ({ stato: 200, corpo: {} }); r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); ok(r.status === 502, "Hermes che risponde senza testo: 502");
const { HERMES: _h, ...senzaHermes } = env; r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }, senzaHermes); j = await r.json();
ok(r.status === 502 && j.errore, "Hermes non collegato: 502 col motivo", [r.status, j]);
daHermes = () => ({ stato: 200, corpo: { testo: "ciao Jarvis" } });

titolo("── il tetto: 60 al giorno per account");
repo = {}; hermes = [];
for (let i = 0; i < 400; i++) await chiama(A, { audio: AUDIO, tipo: "video/mp4" });   // i 400 non consumano
r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" });
ok(r.status === 200 && vocali("papa@prova.it").n === 1, "i vocali rifiutati (400) non si contano: il primo buono è il numero 1", vocali("papa@prova.it"));
for (let i = 2; i <= 60; i++) { r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); if (r.status !== 200) { ok(false, `il vocale ${i} doveva passare`, r.status); break; } }
ok(hermes.length === 60 && vocali("papa@prova.it").n === 60, "i primi 60 passano, tutti a Hermes", hermes.length);
r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); j = await r.json();
ok(r.status === 429 && j.errore === "per oggi i vocali sono finiti: scrivimi", "il 61°: 429 con la frase giusta", [r.status, j]);
ok(hermes.length === 60, "e Hermes non è stato disturbato");
ok(r.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io", "il 429 porta il CORS");
r = await chiama(B, { audio: AUDIO, tipo: "audio/webm" }); ok(r.status === 200 && vocali("altro@prova.it").n === 1, "un altro account ha il suo conto: passa");
const atlas = JSON.parse(Buffer.from(repo["atlas.json"], "base64").toString()); atlas["papa@prova.it"].vocali.giorno = "2020-01-01";
repo["atlas.json"] = Buffer.from(JSON.stringify(atlas)).toString("base64");
r = await chiama(A, { audio: AUDIO, tipo: "audio/webm" }); ok(r.status === 200 && vocali("papa@prova.it").n === 1, "il giorno dopo si riparte da capo", vocali("papa@prova.it"));
const fetchGiu = globalThis.fetch;
globalThis.fetch = async (url, o = {}) => String(url).includes("api.github.com") && o.method === "PUT" ? new Response("{}", { status: 500 }) : fetchGiu(url, o);
hermes = []; r = await chiama(B, { audio: AUDIO, tipo: "audio/webm" }); j = await r.json();
ok(r.status === 502 && hermes.length === 0, "se il conto non si riesce a scrivere: 502 e niente trascrizione (il tetto non si salta)", [r.status, j]);
globalThis.fetch = fetchGiu;

titolo("── la voce non si salva e non si scrive nei log");
const intero = JSON.stringify(Object.values(repo).map((v) => Buffer.from(v, "base64").toString()));
ok(!intero.includes(AUDIO) && !intero.includes(grande.slice(0, 200)), "nessun file scritto sull'archivio contiene l'audio");
for (const m of ["log", "warn", "error", "info"]) console[m] = logOriginale;
ok(!righe.some((x) => x.includes(AUDIO.slice(0, 24)) || x.includes(grande.slice(0, 24))), "l'audio non compare in nessun console.log/warn/error", righe.slice(0, 3));

logOriginale(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
