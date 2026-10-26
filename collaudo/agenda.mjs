// L'agenda nella pagina (26/10, JJ: «puoi andare tu diretto sull'attività e premere fatta») — tutto finto.   node collaudo/agenda.mjs
// GET /assistente/calendario, POST /assistente/fatto e /assistente/annulla, col token dell'account come /assistente.
// Controlla: il GET dà impegni e scadenze aperti in ordine di giorno e ora; «fatto» su un impegno lo toglie dagli aperti, lo mette in
// `fatti` con quando_fatto, con UNA scrittura su atlas.json, e il giro dei promemoria non chiede più «l'hai fatto?» (né per mail, nel servizio
// «essenziale» e in quello «tutto», né in chat); «fatto» su una scadenza ricorrente la porta allo stesso giorno del mese dopo (e resta aperta),
// su una singola la chiude; «annulla» li rimette; id di un altro account 404, già fatto 409, senza token 401 (e gli errori non scrivono nulla);
// oltre 30 giorni i fatti spariscono; il CORS è quello di /assistente; archivio giù → il GET dice 502, non «non hai niente».
// CONTROPROVA: con «fatto» che NON toglie l'impegno dagli aperti la prova «non lo chiede più» diventa rossa.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "agenda-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
// la copia che sbaglia: «fatto» lascia l'impegno fra gli aperti
const MARCA = "const [x] = f.impegni.splice(j, 1);";
const sorgente = readFileSync(join(qui, "..", "worker.js"), "utf8");
if (!sorgente.includes(MARCA)) { console.log("  ❌ la riga di «fatto» non è più quella: aggiorna MARCA nella controprova"); process.exit(1); }
writeFileSync(join(dir, "worker-rotto.mjs"), sorgente.replace(MARCA, "const x = f.impegni[j];"));
const Rotto = await import(join(dir, "worker-rotto.mjs"));

let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, posta = [], richieste = [], scritture = 0, archivioGiu = false, giroDi = "";
const sessioni = { ["a".repeat(64)]: "papa@prova.it", ["b".repeat(64)]: "altro@prova.it" };
const A = "a".repeat(64), B = "b".repeat(64), MAIL = "papa@prova.it";
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body)); return new Response(JSON.stringify({ content: [{ type: "text", text: '{"risposta":"Va bene.","nuovi":[]}' }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.brevo.com") { posta.push({ ...JSON.parse(o.body), giro: giroDi }); return new Response("{}"); }
  if (u.host === "api.telegram.org") return new Response('{"ok":true}');
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if (archivioGiu) return new Response('{"message":"giù"}', { status: 500 });
    if ((o.method || "GET") === "PUT") { if (p === "atlas.json") scritture++; repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return new Response("{}"); }
    return repo[p] ? new Response(JSON.stringify({ content: b64(repo[p]), sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", BREVO_API_KEY: "k", MITTENTE: "atlas@jjavis.it", TG_BOT_TOKEN: "t", TG_CHAT: "1", ANTHROPIC_API_KEY: "k" };
const chiama = (Mod, metodo, percorso, tok, corpo) => Mod.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev" + percorso, { method: metodo,
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, ...(corpo ? { body: JSON.stringify(corpo) } : {}) }), env, { waitUntil() {} });
const cal = async (tok = A, Mod = W) => (await chiama(Mod, "GET", "/assistente/calendario", tok)).json();
const fatto = (id, tok = A, Mod = W) => chiama(Mod, "POST", "/assistente/fatto", tok, { id });
const annulla = (id, tok = A, Mod = W) => chiama(Mod, "POST", "/assistente/annulla", tok, { id });
const scheda = (m = MAIL) => repo["atlas.json"][m];
const IERI = "2026-10-20";   // «oggi» per la chat è la data vera della prova: il passato è passato
const nuova = (extra = {}) => { scritture = 0; posta = []; richieste = []; archivioGiu = false;
  repo = { "atlas.json": { [MAIL]: { nome: "Papà", turni: [{ chi: "noi", testo: "ciao", quando: "x" }], riepilogo: "", impegni: [
    { id: "i3", cosa: "il dentista", giorno: "2027-03-02", ora: "16:00", avvisato: false },
    { id: "i1", cosa: "la revisione", giorno: "2027-03-01", ora: null, avvisato: false },
    { id: "i2", cosa: "il meccanico", giorno: "2027-03-01", ora: "09:30", avvisato: false }],
    scadenze: [{ id: "s2", cosa: "affitto", importo: "€ 500", giorno: "2027-03-31", ogni_mese: true, pagata: false, avvisi: { prima: true } },
               { id: "s1", cosa: "bollo auto", importo: "€ 180", giorno: "2027-03-10", ogni_mese: false, pagata: false, avvisi: {} },
               { id: "s9", cosa: "già pagata", giorno: "2027-03-05", pagata: true }], ...extra },
    "altro@prova.it": { nome: "Altro", turni: [], impegni: [{ id: "x1", cosa: "cosa dell'altro", giorno: "2027-03-01", ora: "10:00" }], scadenze: [] } } }; };

console.log("── il GET: gli aperti, in ordine");
nuova();
{ const r = await chiama(W, "GET", "/assistente/calendario", A); const j = await r.json();
  ok(r.status === 200 && j.impegni.map((x) => x.id).join() === "i1,i2,i3", "impegni per giorno e ora (senza ora prima di quelli con l'ora)", j.impegni);
  ok(Object.keys(j.impegni[1]).sort().join() === "cosa,giorno,id,ora", "ogni impegno: {id, cosa, giorno, ora}", j.impegni[1]);
  ok(j.scadenze.map((x) => x.id).join() === "s1,s2" && Object.keys(j.scadenze[1]).sort().join() === "cosa,giorno,id,importo,ogni_mese", "scadenze aperte in ordine (la pagata non c'è): {id, cosa, giorno, importo, ogni_mese}", j.scadenze);
  ok(Array.isArray(j.fatti) && j.fatti.length === 0, "fatti: vuoto", j.fatti);
  ok(!JSON.stringify(j).includes("dell'altro"), "non si vede niente di un altro account");
  ok(r.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io" && /Authorization/.test(r.headers.get("Access-Control-Allow-Headers")), "CORS come /assistente"); }
{ const r = await chiama(W, "GET", "/assistente/calendario", "c".repeat(64)); ok(r.status === 401, "token sconosciuto: 401", r.status);
  const r2 = await chiama(W, "GET", "/assistente/calendario", ""); ok(r2.status === 401, "senza token: 401", r2.status);
  const r3 = await chiama(W, "POST", "/assistente/fatto", "", { id: "i1" }); const r4 = await chiama(W, "POST", "/assistente/annulla", "", { id: "i1" });
  ok(r3.status === 401 && r4.status === 401 && scritture === 0 && scheda().impegni.length === 3, "fatto e annulla senza token: 401 e niente di scritto"); }

console.log("── «fatto» su un impegno");
{ const r = await fatto("i2"); const j = await r.json();
  ok(r.status === 200 && j.ok === true, "200 ok", [r.status, j]);
  ok(scritture === 1, "UNA scrittura su atlas.json per tocco", scritture);
  const c = await cal();
  ok(c.impegni.map((x) => x.id).join() === "i1,i3", "esce dagli aperti", c.impegni);
  ok(c.fatti.length === 1 && c.fatti[0].id === "i2" && c.fatti[0].cosa === "il meccanico" && Date.now() - Date.parse(c.fatti[0].quando_fatto) < 60000, "entra in fatti, con quando_fatto", c.fatti);
  ok(scheda("altro@prova.it").impegni.length === 1, "l'altro account non è toccato"); }

console.log("── errori: 404, 409, e non scrivono");
{ scritture = 0;
  const r1 = await fatto("x1"); ok(r1.status === 404, "id di un altro account: 404", r1.status);
  const r2 = await fatto("x1", B), r2b = await fatto("i1", B); ok(r2.status === 200 && r2b.status === 404, "…e all'altro account il suo va, il nostro no", [r2.status, r2b.status]);
  scritture = 0;
  const r3 = await fatto("i2"); ok(r3.status === 409, "già fatto: 409", r3.status);
  const r4 = await fatto("zzz"); ok(r4.status === 404, "id che non esiste: 404", r4.status);
  const r5 = await chiama(W, "POST", "/assistente/fatto", A, {}); ok(r5.status === 400, "senza id: 400", r5.status);
  const r6 = await annulla("i1"); ok(r6.status === 409, "annulla di uno che è ancora aperto: 409", r6.status);
  const r7 = await annulla("zzz"); ok(r7.status === 404, "annulla di un id che non c'è: 404", r7.status);
  ok(scritture === 0, "nessuno di questi errori ha scritto sull'archivio", scritture);
  ok(JSON.stringify(r1.headers.get("Access-Control-Allow-Origin")) === '"https://jjoeboy93.github.io"', "gli errori hanno il CORS"); }

console.log("── annulla");
{ const r = await annulla("i2"); const j = await r.json(); scritture = 0;
  const c = await cal();
  ok(r.status === 200 && c.impegni.map((x) => x.id).join() === "i1,i2,i3" && c.fatti.length === 0, "il tocco sbagliato: l'impegno torna fra gli aperti, fuori dai fatti", c);
  ok(scheda().impegni.find((x) => x.id === "i2").ora === "09:30" && !("quando_fatto" in scheda().impegni.find((x) => x.id === "i2")), "com'era (stessa ora, senza quando_fatto)", scheda().impegni);
  const r2 = await annulla("i2"); ok(r2.status === 409, "annullare due volte: 409", r2.status); }

console.log("── una scadenza ricorrente: «pagata» la porta al mese dopo, e resta aperta");
{ scritture = 0; const r = await fatto("s2"); const j = await r.json(); const c = await cal();
  ok(r.status === 200 && scritture === 1, "200, una scrittura", [r.status, scritture]);
  const s = c.scadenze.find((x) => x.id === "s2");
  ok(s && s.giorno === "2027-04-30", "31 marzo → 30 aprile (il mese dopo, senza sforare)", c.scadenze);
  ok(scheda().scadenze.find((x) => x.id === "s2").avvisi && !scheda().scadenze.find((x) => x.id === "s2").avvisi.prima, "gli avvisi si rifanno", scheda().scadenze);
  ok(c.fatti.some((x) => x.tipo === "scadenza" && x.cosa === "affitto" && x.importo === "€ 500"), "e compare fra i fatti", c.fatti);
  const a = await annulla(j.id); const c2 = await cal();
  ok(a.status === 200 && c2.scadenze.find((x) => x.id === "s2").giorno === "2027-03-31" && c2.fatti.length === 0, "annulla: torna al 31 marzo", c2.scadenze);
  // una singola
  await fatto("s1"); const c3 = await cal();
  ok(!c3.scadenze.some((x) => x.id === "s1") && c3.fatti.some((x) => x.cosa === "bollo auto"), "una scadenza singola: chiusa, non più aperta", c3);
  const r4 = await fatto("s1"); ok(r4.status === 409, "pagata due volte: 409", r4.status);
  const r5 = await fatto("s9"); ok(r5.status === 409, "una già pagata di prima: 409", r5.status); }

console.log("── i fatti di oltre 30 giorni spariscono (e non si annullano)");
{ nuova(); const vecchio = new Date(Date.now() - 31 * 864e5).toISOString(), recente = new Date(Date.now() - 29 * 864e5).toISOString();
  scheda().fatti = [{ id: "o1", tipo: "impegno", cosa: "vecchio", giorno: IERI, ora: null, quando_fatto: vecchio }, { id: "o2", tipo: "impegno", cosa: "recente", giorno: IERI, ora: null, quando_fatto: recente }];
  const c = await cal(); ok(c.fatti.map((x) => x.id).join() === "o2", "solo gli ultimi 30 giorni", c.fatti);
  const r = await annulla("o1"); ok(r.status === 404, "annullare un fatto di 31 giorni fa: 404", r.status);
  ok((await annulla("o2")).status === 200, "uno di 29: si può"); }

console.log("── archivio giù: il GET lo dice, non finge «niente»");
{ nuova(); archivioGiu = true; const r = await chiama(W, "GET", "/assistente/calendario", A); const j = await r.json();
  ok(r.status === 502 && /riprova/.test(j.errore || "") && !("impegni" in j), "502 con il motivo", [r.status, j]);
  const f = await fatto("i1"); ok(f.status === 502 && scritture === 0, "anche «fatto»: 502", f.status); archivioGiu = false; }

// il giro dei promemoria: un impegno di 6 giorni fa, giri orari da oggi a due settimane
const giri = async (Mod) => { for (let t = Date.parse("2026-10-27T05:07:00Z"); t <= Date.parse("2026-11-10T20:07:00Z"); t += 3600e3) { giroDi = new Date(t).toISOString(); await Mod.atlasPromemoria(env, new Date(t)); } };
const chiedeFatto = () => posta.filter((m) => /hai fatto|li hai fatti|Impegni passati/i.test(m.subject + " " + m.textContent));
const prova = async (Mod, posta_) => { nuova({ posta: posta_, impegni: [{ id: "v1", cosa: "il dentista", giorno: IERI, ora: "10:00", avvisato: true, ics: true }], scadenze: [] });
  const base = scritture; await fatto("v1", A, Mod); await giri(Mod); return chiedeFatto().length; };
console.log("── dopo «fatto» non si chiede più «l'hai fatto?»");
{ // controllo: senza il tocco, la mail partirebbe davvero (altrimenti la prova sotto non dimostra niente)
  for (const modo of ["essenziale", "tutto"]) { nuova({ posta: modo, impegni: [{ id: "v1", cosa: "il dentista", giorno: IERI, ora: "10:00", avvisato: true, ics: true }], scadenze: [] });
    await giri(W); ok(chiedeFatto().length > 0, `controllo («${modo}»): senza il tocco la mail «l'hai fatto?» parte`, posta.map((m) => m.subject)); }
  for (const modo of ["essenziale", "tutto"]) { const n = await prova(W, modo); ok(n === 0, `«${modo}»: toccato «fatto», in due settimane di giri nessuna mail «l'hai fatto?»`, posta.map((m) => m.subject)); }
  nuova({ impegni: [{ id: "v1", cosa: "il dentista", giorno: IERI, ora: "10:00", avvisato: true }], scadenze: [] });
  const pre = await chiama(W, "POST", "/assistente", A, { testo: "ciao" }); const c1 = JSON.stringify(richieste);
  ok(/il dentista/.test(c1) && /← PASSATO/.test(c1), "controllo: in chat, senza il tocco, l'assistente vede l'impegno passato (da chiedere)");
  await fatto("v1"); richieste = []; await chiama(W, "POST", "/assistente", A, { testo: "ciao" }); const c2 = JSON.stringify(richieste);
  ok(richieste.length > 0 && !/il dentista/.test(c2) && !/← PASSATO/.test(c2), "in chat, dopo il tocco, l'assistente non ha più l'impegno passato da chiedere"); }

console.log("── CONTROPROVA: se «fatto» non toglie l'impegno dagli aperti, «non lo chiede più» diventa rossa");
{ const n = await prova(Rotto, "essenziale");
  ok(n > 0, "con «fatto» rotto la mail «l'hai fatto?» parte ancora: la prova è rossa", posta.map((m) => m.subject)); }

console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde");
process.exit(errori ? 1 : 0);
