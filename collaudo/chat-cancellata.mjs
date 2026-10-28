// «Cancella la conversazione» vale anche per l'assistente (JJ, 28/10) — tutto finto.   node collaudo/chat-cancellata.mjs
// JJ ha cancellato la conversazione e ha scritto «Come ti chiami?»: Atlas ha risposto e poi ha aggiunto «Una correzione alla mia risposta di prima…».
// Il tasto della pagina svuotava solo il telefono; la porta passava al modello f.turni, comprese le battute cancellate.
// Controlla: (1) turni prima e dopo chat_da → al modello arrivano solo quelli dopo, quelli vecchi restano nell'archivio;
// (2) POST /assistente/cancella scrive chat_da (con l'account; senza, 401 e niente di scritto; con l'archivio giù, 502);
// (3) il prompt ha le regole a–e, e in chat non c'è la firma (nelle mail sì); (4) una scadenza NON fatta di domani è uno spunto, una fatta no;
// (5) le passioni del profilo arrivano nel testo; (6) di punta a punta: chat, cancella, chat → il secondo giro non vede il primo.
// CONTROPROVA: senza il filtro su chat_da la prova «solo quelli dopo» diventa rossa.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "chat-cancellata-"));
const sorgente = readFileSync(join(qui, "..", "worker.js"), "utf8");
writeFileSync(join(dir, "worker.mjs"), sorgente); for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(qui, "..", f), join(dir, f));
const W = await import(join(dir, "worker.mjs"));
// la controprova: la stessa porta, ma senza il filtro su chat_da
const FILTRO = "return Number.isNaN(da) ? turni : turni.filter((t) => Date.parse(t && t.quando) >= da);";
if (sorgente.split(FILTRO).length !== 2) { console.log("  ❌ il filtro di turniPerIlModello non è più quello: aggiorna FILTRO nella controprova"); process.exit(1); }
const dirSenza = mkdtempSync(join(tmpdir(), "chat-senza-filtro-")); writeFileSync(join(dirSenza, "worker.mjs"), sorgente.replace(FILTRO, "return turni;"));
for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(qui, "..", f), join(dirSenza, f));
const SenzaFiltro = await import(join(dirSenza, "worker.mjs"));

let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, richieste = [], archivioGiu = false, scritture = 0;
const MAIL = "rosa@prova.it", TOK = "a".repeat(64), sessioni = { [TOK]: MAIL };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body));
    return new Response(JSON.stringify({ content: [{ type: "text", text: '{"risposta":"Mi chiamo Iris.","nuovi":[]}' }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.telegram.org") return new Response('{"ok":true,"result":{"message_id":1}}');
  if (u.host === "api.brevo.com") return new Response("{}");
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if (archivioGiu) return new Response('{"message":"giù"}', { status: 500 });
    if ((o.method || "GET") === "PUT") { if (p === "atlas.json") scritture++; repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return new Response("{}"); }
    return repo[p] ? new Response(JSON.stringify({ content: b64(repo[p]), sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", TG_CHAT: "42", TG_BOT_TOKEN: "t", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it" };
const chiama = (Mod, via, tok, corpo) => Mod.default.fetch(new Request("https://porta" + via, { method: "POST",
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(corpo || {}) }), env, { waitUntil() {} });
const contenuto = () => String(richieste.at(-1).messages[0].content), sistema = () => String(richieste.at(-1).system);
const dopoConversazione = (t) => t.split("La conversazione fin qui")[1].split("Il suo NUOVO messaggio")[0];
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const roma = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(Date.now() + n * 864e5));
const scheda = (extra = {}) => ({ nome: "Rosa", assistente: "Iris", posta: "niente", impegni: [], scadenze: [], riepilogo: "", turni: [], ...extra });

const VECCHIO = "Ho pagato la bolletta della luce?", NUOVO = "Come ti chiami?";
const turniMisti = () => [
  { chi: "lei", testo: `[chat] ${VECCHIO}`, quando: "2026-10-28T08:00:00.000Z" },
  { chi: "noi", testo: "Non so se l'hai pagata: l'hai segnata tu?", quando: "2026-10-28T08:00:05.000Z" },
  { chi: "lei", testo: "[chat] giusto sul limite", quando: "2026-10-28T08:30:00.000Z" },     // quando == chat_da: entra
  { chi: "noi", testo: "risposta dopo", quando: "2026-10-28T09:00:00.000Z" },
  { chi: "noi", testo: "turno senza data", quando: undefined }];                             // dopo la cancellazione non si può dire nuovo: non entra
const CHAT_DA = "2026-10-28T08:30:00.000Z";

// «solo quelli dopo», con una porta qualunque: ritorna vero se al modello arrivano i turni nuovi e NON i vecchi
async function soloQuelliDopo(Mod) {
  repo = { "atlas.json": { [MAIL]: scheda({ chat_da: CHAT_DA, turni: turniMisti() }) } }; richieste = [];
  await chiama(Mod, "/assistente", TOK, { testo: NUOVO });
  const c = dopoConversazione(contenuto());
  return { c, vero: richieste.length === 1 && c.includes("giusto sul limite") && c.includes("risposta dopo") && !c.includes(VECCHIO) && !c.includes("l'hai segnata tu") && !c.includes("turno senza data") };
}

console.log("── 1. turni prima e dopo chat_da: al modello solo quelli dopo");
{ const r = await soloQuelliDopo(W);
  ok(r.vero, "nel testo per il modello («La conversazione fin qui») ci sono solo i turni con quando >= chat_da (quello sul limite compreso)", r.c);
  ok(repo["atlas.json"][MAIL].turni.some((t) => t.testo.includes(VECCHIO)) && repo["atlas.json"][MAIL].chat_da === CHAT_DA, "i turni vecchi restano nell'archivio (servono a JJ e alla bozza) e chat_da non si muove");
  const t = W.turniPerIlModello({ turni: turniMisti(), chat_da: CHAT_DA }).map((x) => x.testo);
  ok(t.join("|") === "[chat] giusto sul limite|risposta dopo", "turniPerIlModello: solo i due dopo, nell'ordine", t);
  ok(W.turniPerIlModello({ turni: turniMisti() }).length === 5 && W.turniPerIlModello({ turni: turniMisti(), chat_da: "boh" }).length === 5 && W.turniPerIlModello(undefined).length === 0, "senza chat_da (o illeggibile) i turni arrivano tutti, come prima");
  repo = { "atlas.json": { [MAIL]: scheda({ chat_da: "2999-01-01T00:00:00.000Z", turni: turniMisti() }) } }; richieste = [];
  await chiama(W, "/assistente", TOK, { testo: NUOVO });
  ok(/\(niente\)/.test(dopoConversazione(contenuto())) && !contenuto().includes(VECCHIO), "cancellata e nessun turno nuovo: «(niente)», il passato non c'è", dopoConversazione(contenuto())); }

console.log("── 2. la rotta: POST /assistente/cancella scrive chat_da");
{ repo = { "atlas.json": { [MAIL]: scheda({ turni: turniMisti() }), "altro@prova.it": scheda({ nome: "Altro" }) } }; scritture = 0;
  const prima = Date.now(); const r = await chiama(W, "/assistente/cancella", TOK, {}); const j = await r.json(); const f = repo["atlas.json"][MAIL];
  ok(r.status === 200 && j.ok === true && j.chat_da === f.chat_da, "con l'account: 200 e chat_da nella risposta", [r.status, j]);
  ok(Date.parse(f.chat_da) >= prima && Date.parse(f.chat_da) <= Date.now(), "chat_da è l'ISO di adesso", f.chat_da);
  ok(f.turni.length === 5 && !("chat_da" in repo["atlas.json"]["altro@prova.it"]), "i turni non si toccano e la scheda di un altro non cambia");
  ok(r.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io", "CORS come le altre rotte /assistente");
  const pre = await W.default.fetch(new Request("https://porta/assistente/cancella", { method: "OPTIONS", headers: { Origin: "https://jjoeboy93.github.io", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" } }), env, { waitUntil() {} });
  ok(pre.status === 204, "il preflight del browser passa", pre.status);
  await attendi(5); const primaDi = f.chat_da; await chiama(W, "/assistente/cancella", TOK, {});
  ok(repo["atlas.json"][MAIL].chat_da > primaDi, "una seconda cancellazione sposta chat_da in avanti");
  scritture = 0; const s = await chiama(W, "/assistente/cancella", "", {}); const s2 = await chiama(W, "/assistente/cancella", "b".repeat(64), {});
  ok(s.status === 401 && s2.status === 401 && scritture === 0, "senza account (o con un token sconosciuto): 401 e niente di scritto", [s.status, s2.status, scritture]);
  sessioni["c".repeat(64)] = "nuova@prova.it"; scritture = 0; const n = await chiama(W, "/assistente/cancella", "c".repeat(64), {});
  ok(n.status === 200 && scritture === 0 && !repo["atlas.json"]["nuova@prova.it"], "chi non ha ancora una scheda: 200, e non gliene si crea una (non diventa «da incontrare»)", [n.status, scritture]);
  archivioGiu = true; const g = await chiama(W, "/assistente/cancella", TOK, {}); archivioGiu = false;
  ok(g.status === 502 && /riprova/.test((await g.json()).errore || ""), "archivio giù: 502 col motivo (la pagina riprova)"); }

console.log("── 3. le regole a–e nel prompt, la firma solo nelle mail");
{ repo = { "atlas.json": { [MAIL]: scheda() } }; richieste = []; await chiama(W, "/assistente", TOK, { testo: NUOVO });
  const s = sistema();
  ok(/^a\) Prima rispondi per intero a quello che la persona chiede in QUESTO messaggio/m.test(s), "a) prima rispondi per intero");
  ok(/^b\) Poi, se serve davvero, AL MASSIMO UN suggerimento, una o due righe in fondo/m.test(s) && /il PROFILO[\s\S]*le passioni[\s\S]*in cosa vuole essere aiutata\/o/.test(s)
    && /quello che state costruendo nella conversazione di adesso[\s\S]*passo successivo o un lavoro simile/.test(s) && /una scadenza o un impegno NON fatto che cade oggi o domani[\s\S]*una volta sola per conversazione/.test(s),
    "b) al massimo UN suggerimento, dalle tre fonti (profilo, quello che si costruisce, scadenza non fatta di oggi/domani)");
  ok(/^c\) MAI: tornare su cose della conversazione cancellata/m.test(s) && /correggere\s+tue risposte precedenti/.test(s) && /chiedere se una cosa segnata fatta è stata fatta/.test(s)
    && /ripetere lo stesso suggerimento due volte di seguito/.test(s) && /suggerire a ogni messaggio[\s\S]*questa no/.test(s), "c) mai: cancellata, correzioni, «l'hai fatto?» sulle fatte, ripetere, suggerire a ogni messaggio");
  ok(/^d\) La presentazione/m.test(s) && /solo se la persona lo chiede[\s\S]*primissima conversazione/.test(s) && /non a ogni conversazione nuova/.test(s), "d) la presentazione solo se richiesta o alla primissima conversazione");
  ok(/^e\) Nella chat della pagina NON firmi/m.test(s) && !s.includes("Firmi «Iris»") && !/firmi «Iris»/.test(s), "e) in chat niente firma col nome");
  ok(!/Se sai le sue passioni o il lavoro che ha fatto, usale per proporre/.test(s) && !/correggiti con/.test(s), "le vecchie regole (passioni a ogni risposta, «correggiti») non ci sono più");
  const mail = W.ATLAS_CHI("Iris", "essenziale", false), chat = W.ATLAS_CHI("Iris", "essenziale", true);
  ok(/^e\) Nelle mail firmi «Iris» in fondo\./m.test(mail) && !/NON firmi/.test(mail), "nelle mail la firma resta");
  ok(["a)", "b)", "c)", "d)"].every((r) => mail.includes("\n" + r) && chat.includes("\n" + r)), "le stesse regole a–d in mail e in chat");
  // la prima volta (primoCore) compare nella chat: niente firma nemmeno lì
  repo = { "attesa.json": { ids: [] }, "atlas.json": { [MAIL]: scheda({ posta: "tutto", assistente: "Iris" }) } }; richieste = [];
  await chiama(W, "/assistente", TOK, { primo: true, nome_assistente: "Iris", tuo: "Rosa" });
  ok(richieste.length === 1 && /^e\) Nella chat della pagina NON firmi/m.test(sistema()), "la prima volta: anche lì niente firma (se parte la mail, la chiusura col nome la mette atlasMail)", sistema().slice(-300)); }

console.log("── 4. una scadenza NON fatta di domani è uno spunto, una fatta no");
{ const domani = roma(1), oggi = roma(0), SPUNTI = "Non ancora fatte, per oggi o domani";
  const sc = (extra) => ({ id: "sL", cosa: "bolletta della luce", importo: "87,40 €", giorno: domani, ogni_mese: false, pagata: false, avvisi: {}, ...extra });
  repo = { "atlas.json": { [MAIL]: scheda({ scadenze: [sc(), sc({ id: "sT", cosa: "bollo tra una settimana", giorno: roma(7) })], impegni: [{ id: "i1", cosa: "dentista", giorno: oggi, ora: "17:00" }] }) } }; richieste = [];
  await chiama(W, "/assistente", TOK, { testo: "ciao" }); let c = contenuto(), spunti = c.includes(SPUNTI) ? c.split(SPUNTI)[1].split("\n\n")[0] : "";
  ok(spunti.includes("bolletta della luce 87,40 € (da pagare)") && spunti.includes("dentista"), "non fatta, domani (e un impegno di oggi): compare fra gli spunti", c.slice(0, 900));
  ok(!spunti.includes("bollo tra una settimana"), "una fra una settimana non è uno spunto", spunti);
  ok(/una volta sola per conversazione/.test(c) && /^   - una scadenza o un impegno NON fatto che cade oggi o domani/m.test(sistema()), "e il testo e il prompt dicono: UNA, una volta sola per conversazione");
  repo["atlas.json"][MAIL].scadenze[0].fatto = new Date().toISOString(); repo["atlas.json"][MAIL].impegni[0].fatto = new Date().toISOString(); richieste = [];
  await chiama(W, "/assistente", TOK, { testo: "ciao" }); c = contenuto();
  ok(!c.includes(SPUNTI) && c.includes("Le cose che ha già FATTE") && c.includes("- fatto: bolletta della luce"), "fatta (fatto: <ISO>): non è più uno spunto, sta separata fra le già FATTE", c.slice(0, 900));
  ok(/non chiederle se le ha fatte o pagate/.test(sistema()), "e il prompt dice sempre di non chiedere se le ha fatte"); }

console.log("── 5. le passioni del profilo arrivano come fonte di suggerimenti");
{ const CHI = "4b675b9f2df739ec";
  repo = { "atlas.json": { [MAIL]: scheda() }, [`utenti/${CHI}.json`]: { chi: CHI, mail: MAIL, vita: "pensione", tempo: "Bollette e scadenze", conosciute: { passioni: "orto", mestiere_di_una_vita: "Falegname" } } }; richieste = [];
  await chiama(W, "/assistente", TOK, { testo: "ciao", chi: CHI });
  const c = contenuto();
  ok(c.includes("Quello che sai di lei:") && c.includes("- le sue passioni: orto") && c.includes("- ha fatto nella vita: Falegname") && c.includes("- in cosa vorrebbe essere assistito: Bollette e scadenze"), "passioni, mestiere di una vita e «in cosa vuole essere aiutata» stanno sotto «Quello che sai di lei»", c.slice(0, 600));
  ok(/il PROFILO \(«Quello che sai di lei»/.test(sistema()), "e il prompt dice che quella è la fonte del suggerimento"); }

console.log("── 6. di punta a punta: chat, cancella, chat");
{ repo = { "atlas.json": { [MAIL]: scheda() } }; richieste = [];
  await chiama(W, "/assistente", TOK, { testo: VECCHIO }); await chiama(W, "/assistente", TOK, { testo: "e la bolletta del gas?" });
  ok(contenuto().includes(VECCHIO), "prima di cancellare l'assistente ricorda la conversazione", dopoConversazione(contenuto()));
  await attendi(5); await chiama(W, "/assistente/cancella", TOK, {}); await attendi(5);
  await chiama(W, "/assistente", TOK, { testo: NUOVO });
  const c = contenuto(), dopo = dopoConversazione(c);
  ok(!c.includes(VECCHIO) && !c.includes("bolletta del gas") && /\(niente\)/.test(dopo) && c.includes(NUOVO), "dopo «Cancella» il modello vede solo il messaggio nuovo: niente del passato", dopo);
  ok(repo["atlas.json"][MAIL].turni.filter((t) => t.testo.includes(VECCHIO)).length === 1, "e l'archivio ha ancora tutto");
  await chiama(W, "/assistente", TOK, { testo: "grazie" });
  ok(dopoConversazione(contenuto()).includes(NUOVO) && !dopoConversazione(contenuto()).includes(VECCHIO), "il giro dopo vede la conversazione nuova (e solo quella)", dopoConversazione(contenuto())); }

console.log("── CONTROPROVA: senza il filtro su chat_da, «solo quelli dopo» diventa rossa");
{ const r = await soloQuelliDopo(SenzaFiltro);
  ok(!r.vero && r.c.includes(VECCHIO), "senza il filtro il modello rivede le battute cancellate (la prova 1 sarebbe rossa)", r.c.slice(0, 300)); }

console.log(errori ? `\n${errori} ROSSE` : "\nVERDE"); process.exit(errori ? 1 : 0);
