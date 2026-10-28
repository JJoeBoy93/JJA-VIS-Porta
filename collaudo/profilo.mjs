// Quello che si cambia nel Profilo arriva all'assistente (28/10) — tutto finto.   node collaudo/profilo.mjs  [percorso/di/un/altro/worker.js]
// JJ: «quello che si cambia nel Profilo arriva davvero all'assistente». POST /profilo { chi, voce, valore } cambia (o toglie, se il valore è vuoto)
// UNA voce in utenti/<chi>.json: vita, mestiere, tempo, dettaglio, oppure una chiave di «conosciute».
// Controlla: vita «pensione» → l'assistente scrive «nella vita: in pensione» (chat e prima volta); «Togli» una conosciuta la cancella davvero
// (non resta vuota), un altro campo si svuota; la mail del token deve essere quella del file (token di un altro, file senza mail, nessun
// token → rifiutato, e il file non si tocca); vita «astronauta» rifiutata; i limiti di oggi (60, 120 per le due voci di vita, 800 il dettaglio);
// una sola scrittura su GitHub per chiamata (e nessun file in conoscenza/).
// Controprove (si lancia con un worker sbagliato a bella posta, vedi in fondo): se «Togli» facesse ancora il merge, «non c'è più» diventa rossa.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "profilo-"));
const sorgente = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(qui, "..", "worker.js");
copyFileSync(sorgente, join(dir, "worker.mjs")); for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(qui, "..", f), join(dir, f));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
let repo = {}, risposta = "", richieste = [], scritture = [], telegram = 0, conflitti = 0;
const ROSA = "a".repeat(64), ALTRO = "b".repeat(64);
const sessioni = { [ROSA]: "rosa@prova.it", [ALTRO]: "altro@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body));
    return new Response(JSON.stringify({ content: [{ type: "text", text: risposta }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.telegram.org") { telegram++; return new Response('{"ok":true,"result":{"message_id":1}}'); }
  if (u.host === "api.brevo.com") return new Response('{"messageId":"x"}', { status: 201 });
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { if (conflitti > 0) { conflitti--; return new Response('{"message":"conflict"}', { status: 409 }); }
      scritture.push({ p, sha: JSON.parse(o.body).sha }); repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", TG_CHAT: "42", TG_BOT_TOKEN: "t", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it" };
const ORIG = "https://jjoeboy93.github.io";
const chiama = (via, tok, corpo, origine = ORIG) => W.default.fetch(new Request("https://porta" + via, { method: "POST",
  headers: { Origin: origine, "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }), env, { waitUntil() {} });
const profilo = (voce, valore, tok = ROSA, chi = CHI) => chiama("/profilo", tok, { chi, voce, ...(valore === undefined ? {} : { valore }) });
const contenuto = () => String(((richieste.at(-1) || {}).messages || [{}])[0].content);

const CHI = "4b675b9f2df739ec", PERCORSO = `utenti/${CHI}.json`;
const PASSIONI = "Orto e giardino, Cucina", MESTIERE = "Artigiano o tecnico";
const partenza = () => { repo = {}; scritture = []; telegram = 0; conflitti = 0;
  repo[PERCORSO] = b64({ chi: CHI, mail: "rosa@prova.it", nome_assistente: "Iris", vita: "lavoro", mestiere: "Ufficio", tempo: "Preventivi e fatture", dettaglio: "Perdo un'ora ogni mattina",
    conosciute: { passioni: PASSIONI, mestiere_di_una_vita: MESTIERE, inizio: "Dopo le 8" }, ha_risposto: true }); };
const invariato = (prima) => repo[PERCORSO] === prima;

console.log("── la vita: da «lavoro» a «pensione» arriva all'assistente");
partenza(); risposta = '{"risposta":"Ecco.","nuovi":[]}';
// il guasto di prima: la pagina dice «pensione», ma nell'archivio c'è ancora «lavoro» → vince l'archivio e non c'è la riga
await chiama("/assistente", ROSA, { testo: "ciao", chi: CHI, profilo: { vita: "pensione" } });
ok(!contenuto().includes("- nella vita:"), "prima: nell'archivio c'è «lavoro» (vince la vita salvata) e l'assistente la tratta da lavoratrice", contenuto().slice(0, 300));
scritture = []; let r = await profilo("vita", "pensione"); let d = await r.json(); const scrittureProfilo = [...scritture];
ok(r.status === 200 && d.ok, "/profilo vita «pensione»: ok", [r.status, d]);
ok(leggi(PERCORSO).vita === "pensione", "utenti/<chi>.json ha vita «pensione»", leggi(PERCORSO).vita);
await chiama("/assistente", ROSA, { testo: "ciao", chi: CHI, profilo: { vita: "pensione" } });
ok(contenuto().includes("- nella vita: in pensione"), "assistenteDallaChat scrive «nella vita: in pensione»", contenuto().slice(0, 300));
await chiama("/assistente", ROSA, { testo: "ciao", chi: CHI });
ok(contenuto().includes("- nella vita: in pensione"), "anche se la pagina non manda la vita: vince quella salvata", contenuto().slice(0, 300));
ok(scrittureProfilo.length === 1 && scrittureProfilo[0].p === PERCORSO && scrittureProfilo[0].sha === "s", "una sola scrittura su GitHub, sul file della persona, con lo sha letto", scrittureProfilo);
ok(telegram === 0 && !Object.keys(repo).some((k) => k.startsWith("conoscenza/")), "e niente in conoscenza/ né su Telegram");
r = await profilo("vita", "casa"); ok(r.status === 200 && leggi(PERCORSO).vita === "casa", "«casa» si accetta", leggi(PERCORSO).vita);
await chiama("/assistente", ROSA, { testo: "ciao", chi: CHI });
ok(contenuto().includes("- nella vita: sta a casa"), "e l'assistente scrive «sta a casa»", contenuto().slice(0, 300));
r = await profilo("vita", "lavoro"); ok(r.status === 200 && leggi(PERCORSO).vita === "lavoro", "e tornare a «lavoro» si può");
await chiama("/assistente", ROSA, { testo: "ciao", chi: CHI });
ok(!contenuto().includes("- nella vita:"), "(e la riga sparisce)", contenuto().slice(0, 300));

console.log("── la vita sbagliata si rifiuta");
partenza(); let prima = repo[PERCORSO];
r = await profilo("vita", "astronauta"); ok(r.status === 400, "vita «astronauta»: rifiutata (400)", r.status);
ok(invariato(prima) && scritture.length === 0, "e il file non si tocca", scritture);
r = await profilo("vita", "Pensione"); ok(r.status === 400 && invariato(prima), "«Pensione» con la maiuscola non è una vita (le etichette della pagina si traducono prima)", r.status);

console.log("── «Togli»: una conosciuta si cancella davvero");
partenza();
r = await profilo("passioni", ""); d = await r.json();
ok(r.status === 200 && d.ok, "/profilo passioni vuoto: ok", [r.status, d]);
const c = leggi(PERCORSO).conosciute;
ok(!("passioni" in c), "togliere «passioni»: la chiave non c'è più in conosciute", c);
ok(c.inizio === "Dopo le 8" && c.mestiere_di_una_vita === MESTIERE, "le altre voci restano", c);
ok(scritture.length === 1, "una sola scrittura", scritture.length);
risposta = '{"risposta":"Ecco.","nuovi":[]}'; repo[PERCORSO] = b64({ ...leggi(PERCORSO), vita: "pensione" });
await chiama("/assistente", ROSA, { testo: "ciao", chi: CHI, profilo: { vita: "pensione", conosciute: {} } });
ok(!contenuto().includes("le sue passioni") && contenuto().includes("ha fatto nella vita: " + MESTIERE), "l'assistente non sa più le passioni, sa il resto", contenuto().slice(0, 400));
partenza(); r = await profilo("sera", ""); ok(r.status === 200 && !("sera" in leggi(PERCORSO).conosciute) && Object.keys(leggi(PERCORSO).conosciute).length === 3, "togliere una voce che non c'è: niente da fare, niente si rompe");
partenza(); repo[PERCORSO] = b64({ chi: CHI, mail: "rosa@prova.it", conosciute: { passioni: "x" } });
r = await profilo("passioni", ""); ok(r.status === 200 && JSON.stringify(leggi(PERCORSO).conosciute) === "{}", "tolta l'ultima, conosciute resta un oggetto vuoto", leggi(PERCORSO));

console.log("── «Cambia»: una conosciuta si riscrive, le altre voci pure");
partenza();
r = await profilo("passioni", "Lettura, Musica e ballo"); ok(r.status === 200 && leggi(PERCORSO).conosciute.passioni === "Lettura, Musica e ballo", "passioni cambiate (non unite alle vecchie)", leggi(PERCORSO).conosciute);
r = await profilo("sera", "I conti del giorno"); ok(leggi(PERCORSO).conosciute.sera === "I conti del giorno", "una voce nuova si aggiunge");
r = await profilo("mestiere", "Corriere o autista"); ok(leggi(PERCORSO).mestiere === "Corriere o autista", "mestiere cambiato", leggi(PERCORSO).mestiere);
r = await profilo("tempo", "Consegne e giri"); ok(leggi(PERCORSO).tempo === "Consegne e giri", "tempo cambiato", leggi(PERCORSO).tempo);
r = await profilo("dettaglio", "Ogni mattina perdo un'ora a mettere in ordine le bolle"); ok(leggi(PERCORSO).dettaglio.startsWith("Ogni mattina perdo"), "dettaglio cambiato", leggi(PERCORSO).dettaglio);
ok(leggi(PERCORSO).vita === "lavoro" && leggi(PERCORSO).nome_assistente === "Iris" && leggi(PERCORSO).ha_risposto === true, "il resto del file non si tocca", leggi(PERCORSO));

console.log("── «Togli»: gli altri campi si svuotano");
for (const voce of ["vita", "mestiere", "tempo", "dettaglio"]) {
  partenza(); r = await profilo(voce, "");
  ok(r.status === 200 && leggi(PERCORSO)[voce] === "", `togliere «${voce}»: il campo si svuota`, leggi(PERCORSO)[voce]);
}
partenza(); r = await profilo("vita", "   "); ok(r.status === 200 && leggi(PERCORSO).vita === "", "uno spazio è vuoto: toglie");
partenza(); await profilo("vita", ""); risposta = '{"risposta":"Ecco.","nuovi":[]}';
await chiama("/assistente", ROSA, { testo: "ciao", chi: CHI });
ok(!contenuto().includes("- nella vita:"), "senza vita l'assistente non scrive «nella vita»", contenuto().slice(0, 300));
partenza(); prima = repo[PERCORSO]; r = await profilo("tempo");
ok(r.status === 400 && invariato(prima), "senza «valore» non si toglie niente (400)", r.status);
r = await chiama("/profilo", ROSA, { chi: CHI, voce: "tempo", valore: null }); ok(r.status === 400 && invariato(prima), "valore null: neanche");

console.log("── i limiti di oggi: 60, 120 per le due voci di vita, 800 il dettaglio");
const LUNGA = "x".repeat(900);
partenza();
await profilo("passioni", LUNGA); await profilo("mestiere_di_una_vita", LUNGA); await profilo("parlare", LUNGA); await profilo("mestiere", LUNGA); await profilo("tempo", LUNGA); await profilo("dettaglio", LUNGA);
let u = leggi(PERCORSO);
ok(u.conosciute.passioni.length === 120, "passioni: 120", u.conosciute.passioni.length);
ok(u.conosciute.mestiere_di_una_vita.length === 120, "mestiere di una vita: 120", u.conosciute.mestiere_di_una_vita.length);
ok(u.conosciute.parlare.length === 60, "controprova: un'altra voce resta a 60", u.conosciute.parlare.length);
ok(u.mestiere.length === 60 && u.tempo.length === 60, "mestiere e tempo: 60", [u.mestiere.length, u.tempo.length]);
ok(u.dettaglio.length === 800, "il dettaglio: 800 come nel sondaggio", u.dettaglio.length);
r = await chiama("/profilo", ROSA, JSON.stringify({ chi: CHI, voce: "dettaglio", valore: "y".repeat(2100) })); ok(r.status === 413, "un corpo oltre 2000 caratteri: 413 (come /conoscenza)", r.status);

console.log("── la mail del token deve essere quella del file");
partenza(); prima = repo[PERCORSO];
r = await profilo("vita", "pensione", ALTRO); ok(r.status === 403, "token di un'altra persona: rifiutato (403)", r.status);
ok(invariato(prima) && scritture.length === 0, "e il file non si tocca", scritture);
r = await profilo("passioni", "", ALTRO); ok(r.status === 403 && invariato(prima), "nemmeno «Togli»", r.status);
r = await profilo("vita", "pensione", ""); ok(r.status === 401 && invariato(prima), "senza token (nessun account): 401, e il «chi» da solo non basta", r.status);
r = await profilo("vita", "pensione", "c".repeat(64)); ok(r.status === 401 && invariato(prima), "token che il server dei conti non riconosce: 401", r.status);
r = await profilo("vita", "pensione", "zzz"); ok(r.status === 401 && invariato(prima), "token malformato: 401", r.status);
repo[PERCORSO] = b64({ chi: CHI, vita: "lavoro", conosciute: { passioni: "x" } }); prima = repo[PERCORSO];
r = await profilo("vita", "pensione"); ok(r.status === 403, "file senza mail: rifiutato (403), anche col token giusto", r.status);
ok(invariato(prima) && scritture.length === 0, "e il file non si tocca", scritture);
repo[PERCORSO] = b64({ chi: CHI, mail: "", vita: "lavoro" }); prima = repo[PERCORSO];
r = await profilo("vita", "pensione"); ok(r.status === 403 && invariato(prima), "mail vuota nel file: lo stesso");
partenza(); repo[PERCORSO] = b64({ ...leggi(PERCORSO), mail: "  Rosa@Prova.it " });
r = await profilo("vita", "pensione"); ok(r.status === 200 && leggi(PERCORSO).vita === "pensione", "maiuscole e spazi nella mail del file non contano");
partenza(); r = await profilo("vita", "pensione", ROSA, "0123456789abcdef"); ok(r.status === 404 && !repo["utenti/0123456789abcdef.json"], "un codice senza file: 404, e il file non nasce", r.status);
const ALTRO_CHI = "fedcba9876543210"; repo[`utenti/${ALTRO_CHI}.json`] = b64({ chi: ALTRO_CHI, mail: "altro@prova.it", vita: "lavoro" });
r = await profilo("vita", "pensione", ROSA, ALTRO_CHI); ok(r.status === 403 && leggi(`utenti/${ALTRO_CHI}.json`).vita === "lavoro", "il file di un'altra persona, col mio token: rifiutato");

console.log("── gli altri controlli (gli stessi di /conoscenza)");
partenza(); prima = repo[PERCORSO];
r = await chiama("/profilo", ROSA, { chi: CHI, voce: "vita", valore: "pensione" }, "https://sito.cattivo"); ok(r.status === 403 && invariato(prima), "origine non ammessa: 403", r.status);
r = await chiama("/profilo", ROSA, "non json"); ok(r.status === 400, "non è JSON: 400", r.status);
r = await profilo("vita", "pensione", ROSA, "xyz"); ok(r.status === 400, "codice non valido: 400", r.status);
r = await profilo("../mail", "x"); ok(r.status === 400 && invariato(prima), "voce con caratteri strani: 400", r.status);
r = await profilo("a".repeat(31), "x"); ok(r.status === 400, "voce troppo lunga: 400", r.status);
r = await chiama("/profilo", ROSA, { chi: CHI, voce: 5, valore: "x" }); ok(r.status === 400, "voce non testo: 400", r.status);
r = await chiama("/profilo", ROSA, { chi: CHI, voce: "tempo", valore: 5 }); ok(r.status === 400 && invariato(prima), "valore non testo: 400", r.status);
r = await W.default.fetch(new Request("https://porta/profilo", { method: "GET", headers: { Origin: ORIG } }), env, { waitUntil() {} }); ok(r.status === 404, "solo POST");
r = await W.default.fetch(new Request("https://porta/profilo", { method: "POST", headers: { Origin: ORIG, Authorization: "Bearer " + ROSA }, body: JSON.stringify({ chi: CHI, voce: "tempo", valore: "x" }) }), { ...env, GH_TOKEN: "" }, { waitUntil() {} });
ok(r.status === 503, "archivio non collegato: 503", r.status);
ok(invariato(prima), "in tutto questo il file non è mai cambiato", scritture);

console.log("── due scritture insieme: una sola riesce per volta");
partenza(); conflitti = 1;
r = await profilo("vita", "pensione"); ok(r.status === 200 && leggi(PERCORSO).vita === "pensione", "il file è cambiato nel frattempo (409): si rilegge, si rifà", r.status);
ok(scritture.length === 1, "le scritture riuscite sono una", scritture.length);
partenza(); conflitti = 5; prima = repo[PERCORSO];
r = await profilo("vita", "pensione"); ok(r.status === 502 && invariato(prima), "se non ce la fa mai: 502 (la pagina riprova), e niente a metà", r.status);

console.log("── la prima volta (primoCore) legge i campi aggiornati");
partenza(); repo["attesa.json"] = b64({ ids: [] });
repo["atlas.json"] = b64({ "rosa@prova.it": { nome: "Rosa", posta: "tutto", turni: [], impegni: [], riepilogo: "", assistente: "Iris" } });
await profilo("vita", "pensione"); await profilo("tempo", "Bollette e scadenze"); await profilo("passioni", "Orto e giardino");
risposta = '{"risposta":"Eccomi.","nuovi":[]}';
await chiama("/assistente", ROSA, { primo: true, chi: CHI, nome_assistente: "Iris", tuo: "Rosa", vita: "lavoro", mestiere: "Ufficio", tempo: "Preventivi e fatture" });
let v = contenuto();
ok(v.includes("- nella vita: in pensione") && v.includes("in cosa vorrebbe essere assistito: Bollette e scadenze"), "primoCore: la vita e il tempo salvati vincono su quelli (vecchi) della pagina", v.slice(0, 700));
ok(v.includes("le sue passioni: Orto e giardino") && !v.includes("Cucina"), "e le passioni nuove, non le vecchie", v.slice(0, 700));
ok(!v.includes("lavoro: Ufficio"), "e non tratta da lavoratrice", v.slice(0, 700));

console.log(errori ? `\n${errori} ROSSE` : "\nVERDE"); process.exit(errori ? 1 : 0);
