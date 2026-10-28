// L'agenda nella pagina (26/10, JJ: «puoi andare tu diretto sull'attività e premere fatta») — tutto finto.   node collaudo/agenda.mjs
// GET /assistente/calendario, POST /assistente/fatto e /assistente/annulla, col token dell'account come /assistente.
// 28/10, JJ: «se ho premuto fatto, lui dovrebbe già saperlo… e non deve sparire dal calendario, deve restare come fatto»: «Fatto» SEGNA, non cancella.
// Controlla: il GET dà impegni e scadenze in ordine di giorno e ora, le aperte com'erano e le fatte con `fatto: <ISO>` (niente più `fatti` a parte);
// «fatto» su un impegno o una scadenza lascia la voce dov'è con `fatto`, con UNA scrittura su atlas.json; una ricorrente resta fatta e ne nasce una aperta
// al mese dopo (e «annulla» toglie il segno e quella nuova); «annulla» toglie il segno, «elimina» (Togli) cancella davvero, anche una fatta;
// il testo per l'assistente (tre strade: chat, mail, primo incontro passano tutte da atlasRisponde) mette la fatta SEPARATA («- fatto: bolletta della luce
// 87,40 € (scadeva il 22/10), segnata fatta il 28/10») e non fra le cose da fare, e le fatte di oltre 60 giorni restano nell'archivio ma non nel testo;
// il programma del mattino, i promemoria, le scadenze e «l'hai fatto?» (servizi «essenziale» e «tutto») non nominano le voci fatte; id di un altro account 404,
// già fatto 409, senza token 401 (e gli errori non scrivono nulla); le voci cancellate dal «Fatto» di prima (pagata, f.fatti) non tornano da sole;
// il CORS è quello di /assistente; archivio giù → il GET dice 502, non «non hai niente».
// CONTROPROVE: se «Fatto» cancellasse ancora la voce, le prove «resta» diventano rosse; se gli avvisi e il testo non saltassero le voci fatte, le prove
// «non la nomina» e «non è fra le cose da fare» diventano rosse.
// 26/10, il calendario vero (JJ: «poter aggiungere in quel calendario l'appuntamento manualmente»): POST /assistente/aggiungi, POST /assistente/elimina,
// GET /assistente/ics. «Aggiungi» mette un impegno (o una scadenza) con la forma di quelli dell'assistente (stesso id, `avvisato: false`) e il giro
// dei promemoria lo tratta come gli altri; i dati sbagliati danno 400 col motivo e non scrivono; «elimina» lo toglie, 404 se non è suo; «ics» dà
// l'invito della mail (text/calendar, VEVENT, SUMMARY); senza token 401; la `nota` si conserva e torna nel GET.
// CONTROPROVA: se «aggiungi» non mette l'`id`, la prova «il giro dei promemoria lo vede» diventa rossa.
// 27/10, l'invito subito (JJ: «quando premo salva per inserire l'impegno mi manda l'invito per mail»): «aggiungi» di un IMPEGNO manda UNA mail
// all'account («📅 cosa — giorno, alle ora», testo di due righe, .ics allegato `atlas-<giorno>-<id>.ics`), segna `ics: true` (il giro orario non
// lo rimanda) e risponde `invito: "mandato" | "niente mail" | "errore: …"`; con posta «niente» nessuna mail; una scadenza nessun invito; Brevo giù →
// l'impegno è salvato e l'errore vero; POST /assistente/invito lo rimanda (anche con «niente»), al massimo 5 al giorno (6° → 429), id di un altro → 404;
// la mail non conta nel tetto delle 2 al giorno dei promemoria (si conta a parte in mail_oggi.inviti).
// CONTROPROVA: senza `x.ics = true` il giro orario rimanda l'invito e la prova «nessun altro invito» diventa rossa.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "agenda-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
// la copia che sbaglia (1): «Fatto» CANCELLA ancora (com'era prima del 28/10): l'impegno esce da f.impegni, la scadenza dalla lista
const MARCA = "if (impegno) x.fatto = adesso.toISOString(); else scadenzaFatta(f, x, adesso);";
const MARCA_S = "  x.fatto = adesso.toISOString();\n  if (x.ogni_mese) {";
const sorgente = readFileSync(join(qui, "..", "worker.js"), "utf8");
for (const [m, nome] of [[MARCA, "MARCA"], [MARCA_S, "MARCA_S"]]) if (sorgente.split(m).length !== 2) { console.log(`  ❌ la riga di «fatto» non è più quella: aggiorna ${nome} nella controprova`); process.exit(1); }
writeFileSync(join(dir, "worker-rotto.mjs"), sorgente.replace(MARCA, "if (impegno) f.impegni.splice(f.impegni.indexOf(x), 1); else scadenzaFatta(f, x, adesso);")
  .replace(MARCA_S, "  f.scadenze.splice(f.scadenze.indexOf(x), 1); return x;\n  if (x.ogni_mese) {"));
const Rotto = await import(join(dir, "worker-rotto.mjs"));
// la copia che sbaglia (2): le voci fatte contano come aperte (gli avvisi e il testo per l'assistente non le saltano)
const MARCA_A = "const impegnoAperto = (x) => !x.fatto;", MARCA_B = "const scadenzaAperta = (x) => !x.fatto && !x.pagata;";
for (const [m, nome] of [[MARCA_A, "MARCA_A"], [MARCA_B, "MARCA_B"]]) if (sorgente.split(m).length !== 2) { console.log(`  ❌ la riga di impegnoAperto/scadenzaAperta non è più quella: aggiorna ${nome} nella controprova`); process.exit(1); }
writeFileSync(join(dir, "worker-senza-salto.mjs"), sorgente.replace(MARCA_A, "const impegnoAperto = (x) => true;").replace(MARCA_B, "const scadenzaAperta = (x) => !x.pagata;"));
const SenzaSalto = await import(join(dir, "worker-senza-salto.mjs"));

// la copia che sbaglia: «aggiungi» non mette l'id all'impegno
const MARCA2 = "riga = { id: nuovoId().slice(0, 6), cosa, giorno: d.giorno, ora, avvisato: false";
if (sorgente.split(MARCA2).length !== 2) { console.log("  ❌ la riga di «aggiungi» non è più quella: aggiorna MARCA2 nella controprova"); process.exit(1); }
writeFileSync(join(dir, "worker-senza-id.mjs"), sorgente.replace(MARCA2, "riga = { cosa, giorno: d.giorno, ora, avvisato: false"));
const SenzaId = await import(join(dir, "worker-senza-id.mjs"));

// la copia che sbaglia: dopo la mail dell'invito l'impegno NON è segnato `ics`
const MARCA3 = "if (x) x.ics = true;";
if (sorgente.split(MARCA3).length !== 2) { console.log("  ❌ la riga di segnaInvito non è più quella: aggiorna MARCA3 nella controprova"); process.exit(1); }
writeFileSync(join(dir, "worker-senza-ics.mjs"), sorgente.replace(MARCA3, "if (x) x.ics = x.ics;"));
const SenzaIcs = await import(join(dir, "worker-senza-ics.mjs"));

let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, posta = [], richieste = [], scritture = 0, archivioGiu = false, brevoGiu = false, giroDi = "";
const sessioni = { ["a".repeat(64)]: "papa@prova.it", ["b".repeat(64)]: "altro@prova.it" };
const A = "a".repeat(64), B = "b".repeat(64), MAIL = "papa@prova.it";
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body)); return new Response(JSON.stringify({ content: [{ type: "text", text: '{"risposta":"Va bene.","nuovi":[]}' }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.brevo.com") { if (brevoGiu) return new Response('{"message":"giù"}', { status: 503 }); posta.push({ ...JSON.parse(o.body), giro: giroDi }); return new Response("{}"); }
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
const nuova = (extra = {}) => { scritture = 0; posta = []; richieste = []; archivioGiu = false; brevoGiu = false;
  repo = { "atlas.json": { [MAIL]: { nome: "Papà", turni: [{ chi: "noi", testo: "ciao", quando: "x" }], riepilogo: "", impegni: [
    { id: "i3", cosa: "il dentista", giorno: "2027-03-02", ora: "16:00", avvisato: false },
    { id: "i1", cosa: "la revisione", giorno: "2027-03-01", ora: null, avvisato: false },
    { id: "i2", cosa: "il meccanico", giorno: "2027-03-01", ora: "09:30", avvisato: false }],
    scadenze: [{ id: "s2", cosa: "affitto", importo: "€ 500", giorno: "2027-03-31", ogni_mese: true, pagata: false, avvisi: { prima: true } },
               { id: "s1", cosa: "bollo auto", importo: "€ 180", giorno: "2027-03-10", ogni_mese: false, pagata: false, avvisi: {} },
               { id: "s9", cosa: "già pagata", giorno: "2027-03-05", pagata: true }], ...extra },
    "altro@prova.it": { nome: "Altro", turni: [], impegni: [{ id: "x1", cosa: "cosa dell'altro", giorno: "2027-03-01", ora: "10:00" }], scadenze: [] } } }; };

console.log("── il GET: tutte le voci in ordine, le aperte come prima");
nuova();
{ const r = await chiama(W, "GET", "/assistente/calendario", A); const j = await r.json();
  ok(r.status === 200 && j.impegni.map((x) => x.id).join() === "i1,i2,i3", "impegni per giorno e ora (senza ora prima di quelli con l'ora)", j.impegni);
  ok(Object.keys(j.impegni[1]).sort().join() === "cosa,giorno,id,ora", "ogni impegno aperto: {id, cosa, giorno, ora}, senza `fatto`", j.impegni[1]);
  ok(j.scadenze.map((x) => x.id).join() === "s1,s2" && Object.keys(j.scadenze[1]).sort().join() === "cosa,giorno,id,importo,ogni_mese", "scadenze in ordine (la «pagata» di prima non c'è): {id, cosa, giorno, importo, ogni_mese}", j.scadenze);
  ok(!("fatti" in j), "niente più «fatti» a parte: una voce fatta resta fra le sue", Object.keys(j));
  ok(!JSON.stringify(j).includes("dell'altro"), "non si vede niente di un altro account");
  ok(r.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io" && /Authorization/.test(r.headers.get("Access-Control-Allow-Headers")), "CORS come /assistente"); }
{ const r = await chiama(W, "GET", "/assistente/calendario", "c".repeat(64)); ok(r.status === 401, "token sconosciuto: 401", r.status);
  const r2 = await chiama(W, "GET", "/assistente/calendario", ""); ok(r2.status === 401, "senza token: 401", r2.status);
  const r3 = await chiama(W, "POST", "/assistente/fatto", "", { id: "i1" }); const r4 = await chiama(W, "POST", "/assistente/annulla", "", { id: "i1" });
  ok(r3.status === 401 && r4.status === 401 && scritture === 0 && scheda().impegni.length === 3, "fatto e annulla senza token: 401 e niente di scritto"); }

console.log("── «fatto» su un impegno: la voce RESTA, con fatto: <data>");
{ const prima = JSON.stringify(scheda().impegni.find((x) => x.id === "i2"));
  const r = await fatto("i2"); const j = await r.json();
  ok(r.status === 200 && j.ok === true && j.id === "i2" && Date.now() - Date.parse(j.fatto) < 60000, "200 ok, con la data in cui l'ha toccato", [r.status, j]);
  ok(scritture === 1, "UNA scrittura su atlas.json per tocco", scritture);
  const c = await cal(); const x = c.impegni.find((y) => y.id === "i2");
  ok(c.impegni.map((y) => y.id).join() === "i1,i2,i3", "RESTA nel calendario, al suo posto", c.impegni);
  ok(x && x.cosa === "il meccanico" && Date.now() - Date.parse(x.fatto) < 60000 && Object.keys(x).sort().join() === "cosa,fatto,giorno,id,ora", "…con fatto: <ISO>", x);
  ok(c.impegni.filter((y) => y.fatto).length === 1, "e solo quello");
  const nelFilo = scheda().impegni.find((y) => y.id === "i2");
  ok(scheda().impegni.length === 3 && nelFilo.fatto === x.fatto && !("fatti" in scheda()), "nell'archivio è ancora in f.impegni (niente f.fatti)", scheda());
  ok(JSON.stringify({ ...nelFilo, fatto: undefined }) === prima, "e non è cambiato altro", nelFilo);
  ok(scheda("altro@prova.it").impegni.length === 1 && !scheda("altro@prova.it").impegni[0].fatto, "l'altro account non è toccato"); }

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
  const r8 = await fatto("s9"), r9 = await annulla("s9"); ok(r8.status === 409 && r9.status === 409, "una `pagata` di prima del 28/10: fatto e annulla 409 (non la ripesca)", [r8.status, r9.status]);
  ok(scritture === 0, "nessuno di questi errori ha scritto sull'archivio", scritture);
  ok(JSON.stringify(r1.headers.get("Access-Control-Allow-Origin")) === '"https://jjoeboy93.github.io"', "gli errori hanno il CORS"); }

console.log("── «Annulla» (Non ancora fatto): toglie il segno, la voce torna fra le cose da fare");
{ const r = await annulla("i2"); scritture = 0;
  const c = await cal();
  ok(r.status === 200 && c.impegni.map((x) => x.id).join() === "i1,i2,i3" && !c.impegni.some((x) => x.fatto), "il tocco sbagliato: l'impegno è di nuovo senza segno", c);
  ok(scheda().impegni.find((x) => x.id === "i2").ora === "09:30" && !("fatto" in scheda().impegni.find((x) => x.id === "i2")), "com'era (stessa ora, senza fatto)", scheda().impegni);
  const r2 = await annulla("i2"); ok(r2.status === 409, "annullare due volte: 409", r2.status); }

console.log("── una scadenza: «Fatto» la segna, resta; «Annulla» la rimette");
{ scritture = 0; const r = await fatto("s1"); const j = await r.json(); const c = await cal();
  ok(r.status === 200 && scritture === 1 && j.id === "s1", "200, una scrittura", [r.status, scritture, j]);
  const s = c.scadenze.find((x) => x.id === "s1");
  ok(s && Date.now() - Date.parse(s.fatto) < 60000 && s.giorno === "2027-03-10" && s.importo === "€ 180", "RESTA nel calendario, con fatto, stesso giorno e importo", c.scadenze);
  ok(scheda().scadenze.length === 3 && scheda().scadenze.find((x) => x.id === "s1").pagata === false, "nell'archivio è ancora lì (nessuna cancellata, `pagata` non è il segno nuovo)", scheda().scadenze);
  const r2 = await fatto("s1"); ok(r2.status === 409, "segnata due volte: 409", r2.status);
  const a = await annulla("s1"); const c2 = await cal();
  ok(a.status === 200 && !c2.scadenze.find((x) => x.id === "s1").fatto && !("fatto" in scheda().scadenze.find((x) => x.id === "s1")), "annulla: senza segno", c2.scadenze); }

console.log("── una scadenza ricorrente: resta fatta, e nasce quella del mese dopo (aperta)");
{ scritture = 0; const r = await fatto("s2"); const j = await r.json(); const c = await cal();
  ok(r.status === 200 && scritture === 1, "200, una scrittura", [r.status, scritture]);
  const vecchia = c.scadenze.find((x) => x.id === "s2"), nuovaS = c.scadenze.find((x) => x.id !== "s1" && x.id !== "s2");
  ok(vecchia && vecchia.fatto && vecchia.giorno === "2027-03-31", "quella di marzo resta, fatta, al 31 marzo", c.scadenze);
  ok(nuovaS && !nuovaS.fatto && nuovaS.giorno === "2027-04-30" && nuovaS.cosa === "affitto" && nuovaS.importo === "€ 500" && nuovaS.ogni_mese === true, "ne nasce una aperta al 30 aprile (31 marzo → mese dopo, senza sforare), stessa cosa e importo", c.scadenze);
  ok(/^s[0-9a-f]{5}$/.test(nuovaS.id) && JSON.stringify(scheda().scadenze.find((x) => x.id === nuovaS.id).avvisi) === "{}", "con un id suo e gli avvisi da rifare", scheda().scadenze);
  const a = await annulla("s2"); const c2 = await cal();
  ok(a.status === 200 && c2.scadenze.map((x) => x.id).join() === "s1,s2" && !c2.scadenze.find((x) => x.id === "s2").fatto, "annulla: toglie il segno E quella di aprile (nata da «fatto»)", c2.scadenze);
  ok(!("successiva" in scheda().scadenze.find((x) => x.id === "s2")), "e non resta il legame");
  // quella del mese dopo già fatta: prima si annulla lei
  await fatto("s2"); const dopo = (await cal()).scadenze.find((x) => x.id !== "s1" && x.id !== "s2"); await fatto(dopo.id);
  scritture = 0; const bloccato = await annulla("s2");
  ok(bloccato.status === 409 && scritture === 0 && scheda().scadenze.find((x) => x.id === "s2").fatto, "se quella del mese dopo è già fatta, annullare la prima è 409 e non scrive", bloccato.status); }

console.log("── le voci cancellate dal «Fatto» di prima NON tornano da sole");
{ nuova({ fatti: [{ id: "i7", tipo: "impegno", cosa: "cancellato dal vecchio fatto", giorno: IERI, ora: null, quando_fatto: new Date().toISOString() }] });
  const j = await cal(); const t = JSON.stringify(j);
  ok(!t.includes("già pagata") && !t.includes("cancellato dal vecchio fatto"), "né la `pagata: true` di prima né il vecchio f.fatti compaiono nel calendario", j);
  ok(scheda().fatti.length === 1 && scheda().scadenze.some((x) => x.id === "s9" && x.pagata === true), "…e nell'archivio non sono stati toccati né convertiti", scheda()); }

console.log("── archivio giù: il GET lo dice, non finge «niente»");
{ nuova(); archivioGiu = true; const r = await chiama(W, "GET", "/assistente/calendario", A); const j = await r.json();
  ok(r.status === 502 && /riprova/.test(j.errore || "") && !("impegni" in j), "502 con il motivo", [r.status, j]);
  const f = await fatto("i1"); ok(f.status === 502 && scritture === 0, "anche «fatto»: 502", f.status); archivioGiu = false; }

// ── cosa legge l'assistente (JJ, 28/10: Atlas gli ha chiesto «l'hai già pagata?» dopo il «Fatto»)
const ANNO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric" }).format(new Date());
const OGGI_IT = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit" }).format(new Date());
const chiediAdAtlas = async (Mod = W, testo = "ciao") => { richieste = []; await chiama(Mod, "POST", "/assistente", A, { testo }); return richieste.length ? richieste.at(-1).messages[0].content : ""; };
const SEZIONE_FATTE = "Le cose che ha già FATTE";
const metà = (t) => { const i = t.indexOf(SEZIONE_FATTE); const fine = (x) => x.split("La conversazione fin qui")[0]; return i < 0 ? { fare: fine(t), fatte: "" } : { fare: t.slice(0, i), fatte: fine(t.slice(i)) }; };
const luce = (extra = {}) => ({ id: "sL", cosa: "bolletta della luce", importo: "87,40 €", giorno: `${ANNO}-10-22`, ogni_mese: false, pagata: false, avvisi: { prima: true, oggi: true }, ...extra });
console.log("── cosa sa l'assistente: la bolletta fatta è «fatto: …», non una cosa da fare");
{ nuova({ impegni: [], scadenze: [luce()] });
  const pre = metà(await chiediAdAtlas());
  ok(/Le scadenze da pagare già segnate:\n- \[sL\] .*bolletta della luce/.test(pre.fare) && pre.fatte === "", "controllo: prima tocco la bolletta è fra le scadenze da pagare", pre.fare);
  await fatto("sL"); const t = metà(await chiediAdAtlas());
  ok(richieste.length > 0, "l'assistente è stato interpellato");
  ok(t.fatte.includes(`- fatto: bolletta della luce 87,40 € (scadeva il 22/10), segnata fatta il ${OGGI_IT}`), `compare «- fatto: bolletta della luce 87,40 € (scadeva il 22/10), segnata fatta il ${OGGI_IT}»`, t.fatte);
  ok(!/bolletta/.test(t.fare) && /Le scadenze da pagare già segnate:\n\(nessuna\)/.test(t.fare), "e NON è fra le cose da fare", t.fare);
  ok(/già FATTE/.test(t.fatte) && /non chiederle se le ha fatte o pagate/.test(richieste.at(-1).system), "il prompt dice di non chiedere «l'hai pagata?» per le già fatte"); }
{ nuova({ impegni: [{ id: "v1", cosa: "il dentista", giorno: IERI, ora: "10:00", avvisato: true }], scadenze: [] });
  const pre = await chiediAdAtlas(); ok(/il dentista/.test(pre) && /← PASSATO/.test(pre), "controllo: senza il tocco l'impegno passato è da chiedere («← PASSATO»)");
  await fatto("v1"); const t = metà(await chiediAdAtlas());
  ok(!/il dentista/.test(t.fare) && !/← PASSATO/.test(t.fare) && /Gli impegni già segnati:\n\(nessuno\)/.test(t.fare), "dopo il tocco: non è più fra gli impegni, e niente «← PASSATO»", t.fare);
  ok(t.fatte.includes(`- fatto: il dentista (era il 20/10 alle 10:00), segnato fatto il ${OGGI_IT}`), "è fra le fatte", t.fatte); }
console.log("── le fatte di oltre 60 giorni restano nell'archivio ma non entrano nel testo");
{ const giorniFa = (n) => new Date(Date.now() - n * 864e5).toISOString();
  nuova({ impegni: [{ id: "o1", cosa: "vecchio impegno", giorno: IERI, ora: null, avvisato: true, fatto: giorniFa(61) }, { id: "o2", cosa: "impegno recente", giorno: IERI, ora: null, avvisato: true, fatto: giorniFa(59) }],
    scadenze: [luce({ id: "o3", cosa: "vecchia bolletta", fatto: giorniFa(61) }), luce({ id: "o4", cosa: "bolletta recente", fatto: giorniFa(2) })] });
  const t = metà(await chiediAdAtlas());
  ok(t.fatte.includes("impegno recente") && t.fatte.includes("bolletta recente"), "59 e 2 giorni fa: nel testo", t.fatte);
  ok(!/vecchio impegno|vecchia bolletta/.test(t.fatte + t.fare), "61 giorni fa: non nel testo (né fra le fatte né fra le cose da fare)", t);
  ok(t.fatte.indexOf("bolletta recente") < t.fatte.indexOf("impegno recente"), "la più recente prima", t.fatte);
  const c = await cal();
  ok(scheda().impegni.some((x) => x.id === "o1") && scheda().scadenze.some((x) => x.id === "o3") && c.impegni.some((x) => x.id === "o1") && c.scadenze.some((x) => x.id === "o3"),
    "…ma nell'archivio e nel calendario ci sono ancora", c); }
// ── gli avvisi: il giro dei promemoria (programma del mattino, promemoria, scadenze, «l'hai fatto?»)
const giri = async (Mod) => { for (let t = Date.parse("2026-10-27T05:07:00Z"); t <= Date.parse("2026-11-10T20:07:00Z"); t += 3600e3) { giroDi = new Date(t).toISOString(); await Mod.atlasPromemoria(env, new Date(t)); } };
const chiedeFatto = () => posta.filter((m) => /hai fatto|li hai fatti|Impegni passati/i.test(m.subject + " " + m.textContent));
const nomina = (re) => posta.filter((m) => re.test(m.subject + " " + m.textContent));
const prova = async (Mod, posta_) => { nuova({ posta: posta_, impegni: [{ id: "v1", cosa: "il dentista", giorno: IERI, ora: "10:00", avvisato: true, ics: true }], scadenze: [] });
  await fatto("v1", A, Mod); await giri(Mod); return chiedeFatto().length; };
console.log("── dopo «fatto» non si chiede più «l'hai fatto?»");
{ // controllo: senza il tocco, la mail partirebbe davvero (altrimenti la prova sotto non dimostra niente)
  for (const modo of ["essenziale", "tutto"]) { nuova({ posta: modo, impegni: [{ id: "v1", cosa: "il dentista", giorno: IERI, ora: "10:00", avvisato: true, ics: true }], scadenze: [] });
    await giri(W); ok(chiedeFatto().length > 0, `controllo («${modo}»): senza il tocco la mail «l'hai fatto?» parte`, posta.map((m) => m.subject)); }
  for (const modo of ["essenziale", "tutto"]) { const n = await prova(W, modo); ok(n === 0, `«${modo}»: toccato «fatto», in due settimane di giri nessuna mail «l'hai fatto?»`, posta.map((m) => m.subject)); } }

// oggi (28/10 a Roma) un impegno aperto la mattina e uno «fatto»; fra 2 giorni una scadenza (aperta o fatta): il programma e i promemoria devono nominare solo le aperte
const giornata = (fattoAdesso) => ({ impegni: [{ id: "m1", cosa: "la revisione", giorno: "2026-10-28", ora: "09:30", avvisato: false, ics: true },
    { id: "m2", cosa: "il dentista", giorno: "2026-10-28", ora: "10:00", avvisato: false, ics: true, ...(fattoAdesso ? { fatto: new Date().toISOString() } : {}) },
    { id: "m3", cosa: "il notaio", giorno: "2026-10-28", ora: "15:00", avvisato: false, ics: true, ...(fattoAdesso ? { fatto: new Date().toISOString() } : {}) }],
  scadenze: [{ id: "sB", cosa: "bolletta della luce", importo: "87,40 €", giorno: "2026-10-30", ogni_mese: false, pagata: false, avvisi: {}, ...(fattoAdesso ? { fatto: new Date().toISOString() } : {}) },
             { id: "sC", cosa: "assicurazione", giorno: "2026-10-30", ogni_mese: false, pagata: false, avvisi: {} }] });
console.log("── il programma del mattino, i promemoria e le scadenze non nominano le voci fatte");
for (const modo of ["essenziale", "tutto"]) {
  nuova({ posta: modo, ...giornata(false) }); await giri(W);
  ok(nomina(/il dentista/).length > 0 && nomina(/il notaio/).length > 0 && nomina(/bolletta della luce/).length > 0, `controllo («${modo}»): senza il tocco il programma/promemoria/scadenza nominano dentista, notaio e bolletta`, posta.map((m) => m.subject));
  nuova({ posta: modo, ...giornata(true) }); await giri(W);
  ok(nomina(/Il tuo programma di oggi/).length > 0 && nomina(/la revisione/).length > 0, `«${modo}»: il programma del mattino c'è e nomina quella aperta (la revisione)`, posta.map((m) => m.subject));
  ok(nomina(/il dentista/).length === 0 && nomina(/il notaio/).length === 0, `«${modo}»: il programma e i promemoria NON nominano gli impegni fatti (dentista, notaio)`, posta.map((m) => m.subject));
  ok(nomina(/assicurazione/).length > 0 && nomina(/bolletta/).length === 0, `«${modo}»: la scadenza fatta (la bolletta) non ha avvisi, quella aperta (l'assicurazione) sì`, posta.map((m) => m.subject));
  ok(!posta.some((m) => (m.attachment || []).some((a) => /m[23]\.ics/.test(a.name))), `«${modo}»: nessun invito .ics per le fatte`); }
{ // un impegno futuro fatto non manda nemmeno l'invito del giro orario
  nuova({ posta: "tutto", impegni: [{ id: "m5", cosa: "il commercialista", giorno: "2026-11-03", ora: "11:00", avvisato: false, fatto: new Date().toISOString() }], scadenze: [] }); await giri(W);
  ok(posta.length === 0, "«tutto»: un impegno futuro già segnato fatto non fa partire né invito né promemoria", posta.map((m) => m.subject)); }
{ // una ricorrente: senza il tocco gli avvisi di ottobre partono; con «fatto» non parte nessun avviso per quella di ottobre (la nuova è del 30/11, oltre il giro)
  const avvisiAffitto = () => posta.filter((m) => /affitto/.test(m.subject));
  nuova({ posta: "tutto", impegni: [], scadenze: [{ id: "sR", cosa: "affitto", importo: "650 €", giorno: "2026-10-30", ogni_mese: true, pagata: false, avvisi: {} }] }); await giri(W);
  ok(avvisiAffitto().length > 0, "controllo: senza il tocco gli avvisi dell'affitto di ottobre partono", posta.map((m) => m.subject));
  nuova({ posta: "tutto", impegni: [], scadenze: [{ id: "sR", cosa: "affitto", importo: "650 €", giorno: "2026-10-30", ogni_mese: true, pagata: false, avvisi: {} }] });
  await fatto("sR"); await giri(W);
  ok(avvisiAffitto().length === 0, "ricorrente fatta: nessun avviso per quella di ottobre (e quella nuova, del 30/11, è fuori dal giro)", posta.map((m) => [m.giro, m.subject])); }

console.log("── «Togli» (elimina) cancella davvero, anche una voce fatta");
{ nuova(); await fatto("i2"); await fatto("s1"); scritture = 0;
  const r = await chiama(W, "POST", "/assistente/elimina", A, { id: "i2" }); const r2 = await chiama(W, "POST", "/assistente/elimina", A, { id: "s1" });
  ok(r.status === 200 && r2.status === 200 && scritture === 2, "200 su una fatta e su una scadenza fatta", [r.status, r2.status, scritture]);
  ok(!scheda().impegni.some((x) => x.id === "i2") && !scheda().scadenze.some((x) => x.id === "s1"), "non ci sono più nell'archivio (cancellate, non nascoste)", scheda());
  const c = await cal(); ok(!c.impegni.some((x) => x.id === "i2") && !c.scadenze.some((x) => x.id === "s1"), "e non sono nel calendario", c);
  const t = metà(await chiediAdAtlas()); ok(!/meccanico|bollo/.test(t.fatte), "né fra le cose fatte dell'assistente", t.fatte);
  const r3 = await fatto("i2"); ok(r3.status === 404, "e «fatto» su una togliata: 404", r3.status); }

console.log("── CONTROPROVA: se «Fatto» cancellasse ancora, le prove «resta» diventano rosse");
{ nuova({ impegni: [{ id: "i1", cosa: "la revisione", giorno: "2027-03-01", ora: null, avvisato: false }], scadenze: [luce({ id: "s1" })] });
  await fatto("i1", A, Rotto); await fatto("s1", A, Rotto); const c = await cal(A, Rotto);
  ok(!c.impegni.some((x) => x.id === "i1") && !c.scadenze.some((x) => x.id === "s1"), "con «Fatto» che cancella, né l'impegno né la scadenza restano nel calendario: la prova «resta» è rossa", c);
  ok(scheda().impegni.length === 0 && scheda().scadenze.length === 0, "…e non ci sono più nell'archivio", scheda()); }

console.log("── CONTROPROVA: se gli avvisi e il testo non saltassero le fatte, «non la nomina» e «non è fra le cose da fare» diventano rosse");
{ nuova({ posta: "tutto", ...giornata(true) }); await giri(SenzaSalto);
  ok(nomina(/il dentista/).length > 0 && nomina(/bolletta della luce/).length > 0, "senza il salto la mail nomina dentista e bolletta: la prova «non la nomina» è rossa", posta.map((m) => m.subject));
  nuova({ impegni: [], scadenze: [luce()] }); await fatto("sL", A, SenzaSalto); const t = metà(await chiediAdAtlas(SenzaSalto));
  ok(/bolletta della luce/.test(t.fare), "senza il salto la bolletta fatta resta fra le scadenze da pagare: la prova «non è fra le cose da fare» è rossa", t.fare); }

// ══ AGGIUNGERE, ELIMINARE, L'INVITO — 26/10 ═════════════════════════════════════════════════════════════════════════════
const aggiungi = (corpo, tok = A, Mod = W) => chiama(Mod, "POST", "/assistente/aggiungi", tok, corpo);
const elimina = (id, tok = A, Mod = W) => chiama(Mod, "POST", "/assistente/elimina", tok, { id });
const ics = (id, tok = A, Mod = W) => chiama(Mod, "GET", "/assistente/ics?id=" + encodeURIComponent(id), tok);
console.log("── aggiungi un impegno: stessa forma di quelli dell'assistente");
nuova();
{ const r = await aggiungi({ tipo: "impegno", cosa: "  la dentista  ", giorno: "2027-03-05", ora: "9:30" }); const j = await r.json();
  ok(r.status === 201 && j.ok === true && /^[0-9a-f]{6}$/.test(j.id) && j.cosa === "la dentista" && j.giorno === "2027-03-05" && j.ora === "09:30", "201 con la riga creata (id di 6 caratteri, cosa pulita, ora 09:30)", [r.status, j]);
  ok(scritture === 2, "due scritture su atlas.json: l'impegno, poi il segno dell'invito mandato (ics)", scritture);
  const c = await cal(); const x = c.impegni.find((y) => y.id === j.id);
  ok(x && Object.keys(x).sort().join() === "cosa,giorno,id,ora", "nel GET ha la stessa forma degli impegni dell'assistente: {id, cosa, giorno, ora}", x);
  const chiavi = c.impegni.map((y) => y.giorno + (y.ora || ""));
  ok(chiavi.join() === [...chiavi].sort().join(), "e sta al suo posto nell'ordine", c.impegni.map((y) => y.id));
  const nelFilo = scheda().impegni.find((y) => y.id === j.id);
  ok(nelFilo && nelFilo.avvisato === false && nelFilo.ics === true && Object.keys(nelFilo).sort().join() === "avvisato,cosa,giorno,ics,id,ora", "nella scheda: {id, cosa, giorno, ora, avvisato:false} come applicaEsito, più ics:true (l'invito è già partito)", nelFilo);
  const senzaOra = await (await aggiungi({ tipo: "impegno", cosa: "la revisione", giorno: "2027-03-06", ora: null })).json();
  ok(senzaOra.ora === null && scheda().impegni.find((y) => y.id === senzaOra.id).ora === null, "senza ora: ora null (evento di tutto il giorno)", senzaOra);
  const f = await fatto(j.id); ok(f.status === 200, "e si chiude con «fatto» come gli altri", f.status); }

console.log("── aggiungi: la nota si conserva e torna nel GET");
nuova();
{ const j = await (await aggiungi({ tipo: "impegno", cosa: "il notaio", giorno: "2027-03-05", ora: "11:00", nota: "porta la carta d'identità\ne il codice fiscale" })).json();
  const c = await cal(); const x = c.impegni.find((y) => y.id === j.id);
  ok(j.nota === "porta la carta d'identità\ne il codice fiscale" && x && x.nota === j.nota, "la nota c'è nella risposta e nel GET", [j, x]);
  await fatto(j.id); const c2 = await cal(); ok(c2.impegni.find((y) => y.id === j.id)?.nota === j.nota && c2.impegni.find((y) => y.id === j.id)?.fatto, "…e anche quando è fatto (la voce resta, con la nota)", c2.impegni);
  await annulla(j.id); ok(scheda().impegni.find((y) => y.id === j.id)?.nota === j.nota, "…e dopo «annulla» è ancora lì"); }

console.log("── aggiungi una scadenza");
nuova();
{ const r = await aggiungi({ tipo: "scadenza", cosa: "la luce", giorno: "2027-03-20", importo: "€ 64,10", ogni_mese: true }); const j = await r.json();
  ok(r.status === 201 && /^s[0-9a-f]{5}$/.test(j.id) && j.importo === "€ 64,10" && j.ogni_mese === true, "201 con la riga (id «s…», importo, ogni mese)", [r.status, j]);
  const c = await cal(); const x = c.scadenze.find((y) => y.id === j.id);
  ok(x && Object.keys(x).sort().join() === "cosa,giorno,id,importo,ogni_mese", "nel GET: {id, cosa, giorno, importo, ogni_mese}", x);
  const s = scheda().scadenze.find((y) => y.id === j.id); ok(s && s.pagata === false && JSON.stringify(s.avvisi) === "{}", "nella scheda: come quelle dell'assistente (pagata:false, avvisi:{})", s);
  const j2 = await (await aggiungi({ tipo: "scadenza", cosa: "il bollo", giorno: "2027-03-21" })).json();
  ok(j2.importo === null && j2.ogni_mese === false, "senza importo né «ogni mese»: null e false", j2);
  const p = await fatto(j.id); const cc = await cal();
  ok(p.status === 200 && cc.scadenze.find((y) => y.id === j.id).fatto && cc.scadenze.some((y) => y.id !== j.id && y.cosa === "la luce" && !y.fatto && y.giorno === "2027-04-20"), "«fatto» la segna e ne nasce una al mese dopo, come le altre"); }

console.log("── il giro dei promemoria lo vede come gli altri");
const aggiuntoPartono = async (Mod) => { nuova({ scadenze: [], impegni: [] });
  const j = await (await aggiungi({ tipo: "impegno", cosa: "il dentista", giorno: "2026-10-28", ora: "15:00" }, A, Mod)).json();
  await giri(Mod); return { j, mail: posta.filter((m) => /Alle 15:00: il dentista/.test(m.subject)), inv: posta.filter((m) => (m.attachment || []).some((a) => /\.ics$/.test(a.name))) }; };
{ const { j, mail } = await aggiuntoPartono(W);
  ok(/^[0-9a-f]{6}$/.test(j.id), "ha un id", j);
  ok(mail.length === 1, "il promemoria «un'ora prima» parte, una volta sola", posta.map((m) => m.subject));
  ok(!(mail[0]?.attachment || []).length, "senza un secondo invito: quello è già partito con «Salva»", mail[0]?.attachment);
  const inv = posta.filter((m) => (m.attachment || []).some((a) => /\.ics$/.test(a.name))), nomi = (inv[0]?.attachment || []).map((a) => a.name);
  ok(inv.length === 1 && nomi.length === 1 && new RegExp(`^atlas-2026-10-28-${j.id}\\.ics$`).test(nomi[0]), "l'invito .ics col suo id è quello di «Salva»", nomi);
  ok(scheda().impegni.find((y) => y.id === j.id)?.avvisato === true, "e dopo, l'impegno è segnato «avvisato» (si trova per id)", scheda().impegni); }

console.log("── dati sbagliati: 400 col motivo, e non scrivono");
nuova();
{ const prove = [["data «32/13»", { tipo: "impegno", cosa: "x", giorno: "32/13" }, /data/i],
    ["data che non esiste (30 febbraio)", { tipo: "impegno", cosa: "x", giorno: "2027-02-30" }, /data/i],
    ["data mancante", { tipo: "impegno", cosa: "x" }, /data/i],
    ["cosa vuota", { tipo: "impegno", cosa: "   ", giorno: "2027-03-05" }, /cosa/i],
    ["cosa mancante", { tipo: "scadenza", giorno: "2027-03-05" }, /cosa/i],
    ["cosa di 201 caratteri", { tipo: "impegno", cosa: "a".repeat(201), giorno: "2027-03-05" }, /200/],
    ["ora «25:00»", { tipo: "impegno", cosa: "x", giorno: "2027-03-05", ora: "25:00" }, /ora/i],
    ["ora «10:75»", { tipo: "impegno", cosa: "x", giorno: "2027-03-05", ora: "10:75" }, /ora/i],
    ["ora «mattina»", { tipo: "impegno", cosa: "x", giorno: "2027-03-05", ora: "mattina" }, /ora/i],
    ["tipo sbagliato", { tipo: "promemoria", cosa: "x", giorno: "2027-03-05" }, /tipo/i],
    ["importo di 31 caratteri", { tipo: "scadenza", cosa: "x", giorno: "2027-03-05", importo: "1".repeat(31) }, /importo/i],
    ["nota di 501 caratteri", { tipo: "impegno", cosa: "x", giorno: "2027-03-05", nota: "n".repeat(501) }, /nota/i]];
  for (const [nome, corpo, motivo] of prove) { const r = await aggiungi(corpo); const j = await r.json();
    ok(r.status === 400 && motivo.test(j.errore || ""), `${nome}: 400 col motivo`, [r.status, j]); }
  const r0 = await chiama(W, "POST", "/assistente/aggiungi", A); ok(r0.status === 400, "corpo vuoto: 400", r0.status);
  ok(scritture === 0 && scheda().impegni.length === 3, "nessuno di questi errori ha scritto sull'archivio", [scritture, scheda().impegni.length]);
  const l = await aggiungi({ tipo: "impegno", cosa: "a".repeat(200), giorno: "2027-03-05" }); ok(l.status === 201, "200 caratteri: va (il limite è 200)", l.status);
  const ge = await aggiungi({ tipo: "impegno", cosa: "x", giorno: "2028-02-29", ora: "00:00" }); ok(ge.status === 201, "29 febbraio di un anno bisestile e ora 00:00: vanno", ge.status);
  ok(r0.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io", "gli errori hanno il CORS"); }

console.log("── senza token: 401, e non scrive");
nuova();
{ const a = await aggiungi({ tipo: "impegno", cosa: "x", giorno: "2027-03-05" }, ""), e = await elimina("i1", ""), c = await ics("i1", ""), a2 = await aggiungi({ tipo: "impegno", cosa: "x", giorno: "2027-03-05" }, "c".repeat(64));
  ok([a, e, c, a2].every((r) => r.status === 401) && scritture === 0 && scheda().impegni.length === 3, "aggiungi, elimina, ics senza token (o con uno sconosciuto): 401", [a.status, e.status, c.status, a2.status]); }

console.log("── elimina");
nuova();
{ scritture = 0; const r = await elimina("i2"); const j = await r.json();
  ok(r.status === 200 && j.ok === true && scritture === 1, "un impegno: 200, UNA scrittura", [r.status, scritture]);
  ok(!(await cal()).impegni.some((x) => x.id === "i2") && !("fatti" in scheda()), "sparisce dal calendario (e non finisce in nessun archivio dei fatti)");
  const r2 = await elimina("s1"); ok(r2.status === 200 && !(await cal()).scadenze.some((x) => x.id === "s1"), "una scadenza: sparisce");
  const m = await (await aggiungi({ tipo: "impegno", cosa: "da togliere", giorno: "2027-03-05" })).json(); const r3 = await elimina(m.id);
  ok(r3.status === 200 && !(await cal()).impegni.some((x) => x.id === m.id), "uno aggiunto a mano: sparisce"); scritture = 0;
  const r4 = await elimina("x1"); ok(r4.status === 404, "id di un altro account: 404", r4.status);
  ok(scheda("altro@prova.it").impegni.length === 1, "…e il suo non è stato toccato");
  const r5 = await elimina("zzz"); ok(r5.status === 404, "id che non esiste: 404", r5.status);
  const r6 = await elimina("i2"); ok(r6.status === 404, "già eliminato: 404", r6.status);
  const r7 = await elimina("s9"); ok(r7.status === 404, "una scadenza già pagata: 404 (non è più aperta)", r7.status);
  const r8 = await chiama(W, "POST", "/assistente/elimina", A, {}); ok(r8.status === 400, "senza id: 400", r8.status);
  ok(scritture === 0, "nessuno di questi errori ha scritto sull'archivio", scritture);
  archivioGiu = true; const r9 = await elimina("i1"); ok(r9.status === 502, "archivio giù: 502, non «non è tuo»", r9.status); archivioGiu = false; }

console.log("── ics: l'invito della mail");
nuova();
{ const r = await ics("i2"); const t = await r.text();
  ok(r.status === 200 && /^text\/calendar/.test(r.headers.get("Content-Type")) && r.headers.get("Content-Disposition") === 'attachment; filename="impegno.ics"', "200, text/calendar, allegato «impegno.ics»", [r.status, r.headers.get("Content-Type"), r.headers.get("Content-Disposition")]);
  ok(t.includes("BEGIN:VCALENDAR") && t.includes("BEGIN:VEVENT") && t.includes("SUMMARY:il meccanico") && t.includes("DTSTART:20270301T083000Z"), "BEGIN:VEVENT, SUMMARY giusto, 09:30 di Roma = 08:30 UTC", t);
  ok(t.includes("UID:i2-20270301@atlas.jja-vis") && t.includes("BEGIN:VALARM"), "lo stesso invito della mail (UID dall'id, con l'avviso)");
  const tg = await (await ics("i1")).text(); ok(tg.includes("DTSTART;VALUE=DATE:20270301") && tg.includes("DTEND;VALUE=DATE:20270302"), "senza ora: evento di tutto il giorno", tg);
  const m = await (await aggiungi({ tipo: "impegno", cosa: "il notaio, piano 2", giorno: "2027-03-05", ora: "11:00", nota: "carta d'identità\r\nBEGIN:VEVENT" })).json(); const tn = await (await ics(m.id)).text();
  ok(tn.includes("SUMMARY:il notaio\\, piano 2") && tn.includes("DESCRIPTION:carta d'identità\\nBEGIN:VEVENT") && (tn.match(/^BEGIN:VEVENT/gm) || []).length === 1, "la nota va nella descrizione, e un a-capo nella nota non apre un altro evento", tn);
  const ts = await (await ics("s1")).text(); ok(ts.includes("SUMMARY:💶 bollo auto € 180") && ts.includes("DTSTART;VALUE=DATE:20270310"), "una scadenza: evento di tutto il giorno con l'importo", ts);
  const r4 = await ics("x1"); ok(r4.status === 404, "impegno di un altro account: 404", r4.status);
  ok((await ics("zzz")).status === 404 && (await chiama(W, "GET", "/assistente/ics", A)).status === 400, "id che non esiste: 404; senza id: 400");
  ok(r.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io", "CORS come le altre");
  archivioGiu = true; const r5 = await ics("i1"); ok(r5.status === 502, "archivio giù: 502", r5.status); archivioGiu = false; }

console.log("── «Salva» di un impegno: l'invito parte SUBITO, una mail sola");
const invitiDi = (id) => posta.filter((m) => (m.attachment || []).some((a) => a.name.includes(`-${id}.ics`)));
const adesso = new Date().toISOString().slice(0, 10);
{ nuova({ impegni: [], scadenze: [] });
  const r = await aggiungi({ tipo: "impegno", cosa: "il dentista", giorno: "2026-10-28", ora: "15:00" }); const j = await r.json();
  ok(r.status === 201 && j.invito === "mandato", "essenziale: risposta invito:\"mandato\"", [r.status, j]);
  ok(posta.length === 1 && posta[0].to[0].email === MAIL, "UNA mail, all'account", posta.map((m) => m.to));
  ok(posta[0].subject === "il dentista — mercoledì 28 ottobre, alle 15:00", "oggetto: «cosa — giorno per esteso, alle ora» (senza 📅: arrivava come «??????»)", posta[0].subject);
  ok(/Tocca «Aggiungi al calendario» qui sopra, o apri l'invito qui sotto, e finisce nel tuo calendario\./.test(posta[0].textContent), "il testo dice cosa toccare", posta[0].textContent);
  const al = posta[0].attachment || [], ics = al[0] ? Buffer.from(al[0].content, "base64").toString() : "";
  ok(al.length === 1 && al[0].name === `atlas-2026-10-28-${j.id}.ics` && ics.includes("BEGIN:VEVENT") && ics.includes("SUMMARY:il dentista"), "allegato atlas-<giorno>-<id>.ics con BEGIN:VEVENT e il SUMMARY giusto", [al.map((a) => a.name), ics]);
  ok(scheda().impegni.find((y) => y.id === j.id).ics === true, "nell'impegno: ics:true", scheda().impegni);
  const m = scheda().mail_oggi;
  ok(m && m.inviti === 1 && !(m.quante > 0) && W.quanteMail(scheda(), m.data) === 0, "si conta a parte in mail_oggi.inviti, e non nel tetto delle 2 mail dei promemoria", m);
  await giri(W);
  ok(invitiDi(j.id).length === 1, "dopo due settimane di giri orari: NESSUN altro invito per quell'impegno (né promemoria né programma con .ics)", posta.map((x) => [x.giro, x.subject, (x.attachment || []).length]));
  ok(posta.some((x) => /Alle 15:00: il dentista/.test(x.subject)), "…e il promemoria «un'ora prima» parte lo stesso", posta.map((x) => x.subject)); }
{ nuova({ impegni: [], scadenze: [] });
  const j = await (await aggiungi({ tipo: "impegno", cosa: "la revisione", giorno: "2026-10-30" })).json();
  ok(posta.length === 1 && posta[0].subject === "la revisione — venerdì 30 ottobre", "senza ora: «cosa — giorno» e basta", posta.map((m) => m.subject)); }
{ nuova({ posta: "tutto", impegni: [], scadenze: [] });
  const j = await (await aggiungi({ tipo: "impegno", cosa: "il notaio", giorno: "2026-10-28", ora: "11:00" })).json(); await giri(W);
  ok(j.invito === "mandato" && invitiDi(j.id).length === 1 && !posta.some((m) => /da mettere nel tuo calendario/.test(m.subject)), "«tutto»: l'invito di Salva, e il giro orario non manda «da mettere nel tuo calendario»", posta.map((m) => m.subject)); }
{ nuova({ posta: "niente", impegni: [], scadenze: [] });
  const r = await aggiungi({ tipo: "impegno", cosa: "il notaio", giorno: "2026-10-28", ora: "11:00" }); const j = await r.json();
  ok(r.status === 201 && j.invito === "niente mail" && posta.length === 0 && scritture === 1, "«niente»: nessuna mail, invito:\"niente mail\", una sola scrittura", [j, posta.length, scritture]);
  ok(!scheda().impegni.find((y) => y.id === j.id).ics, "…e l'impegno resta senza ics"); }
{ nuova({ impegni: [], scadenze: [] });
  const j = await (await aggiungi({ tipo: "scadenza", cosa: "la luce", giorno: "2026-10-30", importo: "€ 64" })).json();
  ok(posta.length === 0 && !("invito" in j), "una scadenza: nessuna mail d'invito", [posta.length, j]); }
{ nuova({ impegni: [], scadenze: [] }); brevoGiu = true;
  const r = await aggiungi({ tipo: "impegno", cosa: "il dentista", giorno: "2026-10-28", ora: "15:00" }); const j = await r.json();
  ok(r.status === 201 && /^errore: .*503/.test(j.invito), "Brevo giù: 201 e invito:\"errore: <motivo vero>\"", [r.status, j]);
  ok(scheda().impegni.some((y) => y.id === j.id) && !scheda().impegni.find((y) => y.id === j.id).ics, "l'impegno è salvato, senza ics (l'invito è ancora da mandare)", scheda().impegni);
  brevoGiu = false; const ri = await chiama(W, "POST", "/assistente/invito", A, { id: j.id });
  ok(ri.status === 200 && posta.length === 1 && scheda().impegni.find((y) => y.id === j.id).ics === true, "«Riprova» (invito) lo manda e lo segna", [ri.status, posta.length]); }

console.log("── POST /assistente/invito: lo rimanda");
const invito = (id, tok = A, Mod = W) => chiama(Mod, "POST", "/assistente/invito", tok, { id });
{ nuova({ posta: "niente" });
  const r = await invito("i2"); const j = await r.json();
  ok(r.status === 200 && j.invito === "mandato" && posta.length === 1, "anche con posta «niente» (lo chiede lei): 200 e UNA mail", [r.status, j, posta.length]);
  ok(posta[0].subject === "il meccanico — lunedì 1 marzo, alle 09:30" && posta[0].attachment[0].name === "atlas-2027-03-01-i2.ics", "stessa mail di «Salva»: oggetto e allegato", [posta[0].subject, posta[0].attachment.map((a) => a.name)]);
  ok(scheda().impegni.find((y) => y.id === "i2").ics === true && scheda().mail_oggi.inviti === 1 && scheda().mail_oggi.reinvii === 1, "segnato ics, contato a parte", scheda());
  await invito("i2"); await invito("i1"); await invito("i3"); await invito("i1");
  const sesto = await invito("i2"); const js = await sesto.json();
  ok(sesto.status === 429 && /5/.test(js.errore) && posta.length === 5, "il 6° del giorno: 429, e non parte la mail", [sesto.status, js, posta.length]);
  scheda().posta = "essenziale";
  ok((await aggiungi({ tipo: "impegno", cosa: "nuovo", giorno: "2027-03-05" })).status === 201 && posta.length === 6, "…ma «Salva» manda l'invito lo stesso (il tetto è dei reinvii)", posta.length); }
{ nuova(); posta = [];
  const a = await invito("x1"), b = await invito("zzz"), c = await invito("s1"), d = await chiama(W, "POST", "/assistente/invito", A, {}), e = await invito("i1", ""), f = await invito("i1", "c".repeat(64));
  ok([a, b, c].every((r) => r.status === 404) && d.status === 400 && e.status === 401 && f.status === 401 && posta.length === 0 && scritture === 0,
    "id di un altro / che non esiste / una scadenza: 404; senza id 400; senza token 401: nessuna mail, nessuna scrittura", [a.status, b.status, c.status, d.status, e.status, f.status, posta.length, scritture]);
  brevoGiu = true; const g = await invito("i1"); const jg = await g.json(); brevoGiu = false;
  ok(g.status === 502 && /503/.test(jg.errore) && !scheda().impegni.find((y) => y.id === "i1").ics, "Brevo giù: 502 col motivo, nessun segno ics", [g.status, jg]);
  archivioGiu = true; const h = await invito("i1"); archivioGiu = false; ok(h.status === 502, "archivio giù: 502, non «non è tuo»", h.status);
  ok(g.headers.get("Access-Control-Allow-Origin") === "https://jjoeboy93.github.io", "CORS come le altre"); }

console.log("── CONTROPROVA: senza `x.ics = true` il giro orario rimanda l'invito, e la prova «nessun altro invito» diventa rossa");
{ nuova({ impegni: [], scadenze: [] });
  const j = await (await aggiungi({ tipo: "impegno", cosa: "il dentista", giorno: "2026-10-28", ora: "15:00" }, A, SenzaIcs)).json(); await giri(SenzaIcs);
  ok(invitiDi(j.id).length > 1, "senza ics:true l'invito esce più di una volta (Salva + giro orario): la prova è rossa", invitiDi(j.id).map((m) => m.subject)); }

console.log("── CONTROPROVA: se «aggiungi» non mette l'id, «il giro dei promemoria lo vede» diventa rossa");
{ const { j, inv } = await aggiuntoPartono(SenzaId);
  const nomi = (inv[0]?.attachment || []).map((a) => a.name);
  ok(!(/^[0-9a-f]{6}$/.test(j.id) && nomi.length === 1 && new RegExp(`^atlas-2026-10-28-${j.id}\\.ics$`).test(nomi[0])), "senza id l'impegno non ha un id e l'invito esce «undefined»: la prova è rossa", [j, nomi]); }

console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde");
process.exit(errori ? 1 : 0);
