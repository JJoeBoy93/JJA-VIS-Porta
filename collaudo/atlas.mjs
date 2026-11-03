// Atlas, gli impegni passati — «passato è fatto» (3/11, JJ) — tutto finto.   node collaudo/atlas.mjs
// JJ, 3/11: Atlas ha mandato a Jessica (posta «tutto») il 1, il 2 e il 3/11 alle 07:07 la stessa mail «❓ 7 impegni passati: li hai
// fatti?» (il ramo «tutto» chiedeva ogni giorno). La regola nuova: «io te lo ricordo, ma una volta che è passato dai per scontato che è
// fatto, salvo diversa segnalazione dell'utente» (sostituisce quella del 23/10, «si chiede l'hai fatto?»).
// Controlla: in «tutto» e in «essenziale» nessuna mail né riga sugli impegni passati in 9 giorni di giri; passato il giorno l'impegno si
// segna fatto da solo (fatto + fatto_da «passato») e resta nel calendario; i campi della vecchia domanda spariscono; gli impegni futuri hanno
// i promemoria di prima; uno riaperto da lei non si risegna; «sì, fatto» lo rende suo; «sposta» lo toglie e ne fa uno nuovo; l'assistente lo
// legge «dato per fatto» e il prompt gli dice di non chiedere.
// CONTROPROVA: sul worker di prima (quello del 3/11 mattina) la prova 1 è rossa: il 2/11 parte la seconda mail «❓ 7 impegni passati».
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "atlas-"));
const sorgente = process.env.WORKER || join(qui, "..", "worker.js");   // WORKER=/percorso/worker.js per la controprova sul codice vecchio
for (const [a, b] of [[sorgente, "worker.mjs"], [join(qui, "..", "preventivo.js"), "preventivo.js"], [join(qui, "..", "google.js"), "google.js"]]) copyFileSync(a, join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, posta = [], giroDi = "";
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "api.brevo.com") { posta.push({ ...JSON.parse(o.body), giro: giroDi }); return new Response("{}"); }
  if (u.host === "api.telegram.org") return new Response('{"ok":true}');
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if ((o.method || "GET") === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return new Response("{}"); }
    return repo[p] ? new Response(JSON.stringify({ content: b64(repo[p]), sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", BREVO_API_KEY: "k", MITTENTE: "atlas@jjavis.it", TG_BOT_TOKEN: "t", TG_CHAT: "1" };
const MAIL = "je@prova.it";
const scheda = () => repo["atlas.json"][MAIL];
const domande = () => posta.filter((m) => /hai fatto|li hai fatti|impegni passati/i.test(m.subject + " " + m.textContent));
// un giro ogni ora, giorno per giorno (ora solare di Roma, +1)
const giri = async (dal, al) => { for (let t = Date.parse(`${dal}T00:07:00+01:00`); t <= Date.parse(`${al}T23:07:00+01:00`); t += 3600e3) { giroDi = new Date(t).toISOString(); await W.atlasPromemoria(env, new Date(t)); } };
// i 7 impegni passati di Jessica, com'erano nell'archivio il 3/11 (coi campi della vecchia domanda)
const sette = () => Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, cosa: `impegno ${i}`, giorno: `2026-10-${String(20 + i).padStart(2, "0")}`, ora: null, ics: true, avvisato: true, da_confermare: true, chiesto: "2026-10-31" }));
const nuova = (posta_, impegni) => { posta = []; repo = { "atlas.json": { [MAIL]: { nome: "Jessica", posta: posta_, turni: [], scadenze: [], impegni } } }; };

for (const modo of ["tutto", "essenziale"]) {
  console.log(`── 1. «${modo}»: 7 impegni passati, nessuna risposta, giri dal 1/11 al 9/11`);
  nuova(modo, sette()); await giri("2026-11-01", "2026-11-09");
  ok(domande().length === 0, `nessuna mail o riga «impegni passati» in 9 giorni`, domande().map((m) => [m.giro, m.subject]));
  ok(scheda().impegni.length === 7 && scheda().impegni.every((x) => x.fatto && x.fatto_da === "passato"), "tutti e 7 restano nel calendario, dati per fatti (fatto + fatto_da «passato»)", scheda().impegni);
  ok(scheda().impegni.every((x) => !("da_confermare" in x) && !("chiesto" in x) && !("chieste" in x)), "i campi della vecchia domanda sono spariti", scheda().impegni);
  ok(scheda().impegni.every((x) => x.fatto.slice(0, 10) === "2026-10-31"), "segnati al primo giro (1/11 00:07 di Roma)", scheda().impegni.map((x) => x.fatto));
}

console.log("── 2. prima dell'impegno non cambia niente: i promemoria partono come sempre");
for (const modo of ["tutto", "essenziale"]) {
  nuova(modo, [{ id: "d1", cosa: "dal dentista", giorno: "2026-11-05", ora: "10:00", ics: true }]); await giri("2026-11-04", "2026-11-07");
  ok(posta.some((m) => /dal dentista/.test(m.subject + " " + m.textContent) && m.giro < "2026-11-05T09:00"), `«${modo}»: il dentista del 5 viene ricordato prima`, posta.map((m) => [m.giro, m.subject]));
  ok(!posta.some((m) => m.giro >= "2026-11-06"), `«${modo}»: dal 6 (passato) più nessuna mail`, posta.map((m) => [m.giro, m.subject]));
  ok(scheda().impegni[0].fatto_da === "passato", `«${modo}»: il 6 è dato per fatto`, scheda().impegni);
}

console.log("── 3. un impegno di oggi non si tocca fino a domani");
nuova("tutto", [{ id: "o1", cosa: "cup", giorno: "2026-11-03", ora: "08:00", ics: true }]); await giri("2026-11-03", "2026-11-03");
ok(!scheda().impegni[0].fatto, "il 3 sera l'impegno del 3 è ancora aperto", scheda().impegni);

console.log("── 4. riaperto da lei («Non ancora fatto»): non si risegna e non si chiede");
nuova("tutto", [{ id: "r1", cosa: "la revisione", giorno: "2026-10-25", ora: null, ics: true, riaperto: true }]); await giri("2026-11-01", "2026-11-03");
ok(!scheda().impegni[0].fatto && domande().length === 0, "resta aperto, nessuna mail", { imp: scheda().impegni, mail: posta.map((m) => m.subject) });

console.log("── 5. «modo niente»: anche lì passato è fatto (senza mail)");
nuova("niente", sette()); await giri("2026-11-01", "2026-11-01");
ok(posta.length === 0 && scheda().impegni.every((x) => x.fatto_da === "passato"), "niente mail, tutti dati per fatti", scheda().impegni);

console.log("── 6. lei risponde (applicaEsito è la meccanica dietro)");
let ff = { impegni: [{ id: "p1", cosa: "Ponte di Legno", giorno: "2026-10-20", ora: null, fatto: "2026-10-21T06:07:00.000Z", fatto_da: "passato" }] };
W.applicaEsito(ff, { fatti: ["p1"] });
ok(ff.impegni[0].fatto === "2026-10-21T06:07:00.000Z" && !("fatto_da" in ff.impegni[0]), "«sì, l'ho fatto» su uno dato per fatto: resta, la data non cambia, ora è suo (via fatto_da)", ff.impegni);
ff = { impegni: [{ id: "p2", cosa: "cup", giorno: "2026-10-22", ora: "10:00", fatto: "2026-10-23T06:07:00.000Z", fatto_da: "passato" }] };
W.applicaEsito(ff, { tolti: ["p2"], nuovi: [{ cosa: "cup", giorno: "2026-11-12", ora: "10:00" }] });
ok(!ff.impegni.some((x) => x.id === "p2") && ff.impegni.some((x) => x.cosa === "cup" && x.giorno === "2026-11-12" && !x.fatto), "«non ci sono andata, spostalo al 12» → il vecchio sparisce, il nuovo è aperto", ff.impegni);
ff = { impegni: [{ id: "p3", cosa: "x", giorno: "2026-10-20", ora: null }] };
W.applicaEsito(ff, { fatti: ["p3"], tolti: ["p3"] });
ok(ff.impegni.length === 0, "lo stesso id in tutte e due: vince «tolti» (l'ha chiesto lei)", ff.impegni);
ff = { impegni: [], scadenze: [{ id: "s1", cosa: "luce", giorno: "2026-10-22", ogni_mese: false, pagata: false, avvisi: {} }, { id: "s2", cosa: "affitto", giorno: "2026-10-31", ogni_mese: true, pagata: false, avvisi: {} }] };
W.applicaEsito(ff, { fatti: ["s1", "s2"] });
ok(ff.scadenze.length === 3 && ff.scadenze.find((x) => x.id === "s1").fatto && ff.scadenze.find((x) => x.id === "s2").fatto && ff.scadenze.some((x) => x.id !== "s1" && x.id !== "s2" && x.giorno === "2026-11-30" && !x.fatto),
  "le scadenze come prima: un id in «fatti» la segna fatta (la ricorrente ne fa nascere una al mese dopo)", ff.scadenze);

console.log("── 7. le scadenze passate NON si danno per fatte (non c'entrano)");
nuova("tutto", []); scheda().scadenze = [{ id: "s9", cosa: "il bollo", giorno: "2026-10-25", ogni_mese: false, pagata: false, avvisi: {} }];
await giri("2026-11-01", "2026-11-01"); ok(!scheda().scadenze[0].fatto, "la scadenza del 25/10 resta aperta", scheda().scadenze);

console.log("── 8. orari giusti (3/11, JJ: «se ti chiedo le 7 perché parte alle 7.07?»): giro ogni 5 minuti");
// CONTROPROVA: col worker di prima (finestra di 65 minuti) il promemoria delle 10:15 parte alle 9:10, non alle 9:15
const giri5 = async (g) => { for (let t = Date.parse(`${g}T00:00:00+01:00`); t <= Date.parse(`${g}T23:55:00+01:00`); t += 300e3) { giroDi = new Date(t).toISOString(); await W.atlasPromemoria(env, new Date(t)); } };
const aRoma = (iso) => new Date(iso).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
for (const modo of ["tutto", "essenziale"]) {
  nuova(modo, [{ id: "a1", cosa: "dal dentista", giorno: "2026-11-05", ora: "08:30", ics: true }, { id: "a2", cosa: "dal meccanico", giorno: "2026-11-05", ora: "15:15", ics: true }]);
  await giri5("2026-11-05");
  const prog = posta.find((m) => /programma di oggi/.test(m.subject)), mecc = posta.find((m) => /⏰ Alle 15:15/.test(m.subject));
  ok(prog && aRoma(prog.giro) === "07:00", `«${modo}»: il programma del mattino parte alle 7:00`, posta.map((m) => [aRoma(m.giro), m.subject]));
  ok(mecc && aRoma(mecc.giro) === "14:15", `«${modo}»: il promemoria delle 15:15 parte alle 14:15, un'ora prima esatta`, posta.map((m) => [aRoma(m.giro), m.subject]));
}

console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde");
process.exit(errori ? 1 : 0);
