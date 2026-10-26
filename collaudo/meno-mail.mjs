// Meno mail, tutte utili (27/10, JJ: «il servizio mail solo per le cose che servono davvero») — tutto finto.   node collaudo/meno-mail.mjs
// Un utente (Gennaro) ha segnato UN impegno e si è cancellato per paura di essere sommerso. Ogni scheda ha `posta`: «essenziale» (chi non
// l'ha scelta), «tutto» (com'era: la scheda di Jessica parte da qui) o «niente» (nessuna mail da sola).
// Controlla: il caso Gennaro (un impegno domani alle 8 + 3 cose da portare, giri orari da adesso a dopodomani sera) manda UNA mail, il
// programma del mattino con l'invito allegato e le cose da portare; con «tutto» le stesse mail di prima; con «niente» zero; la scadenza
// fra 5 giorni una sola mail, il giorno prima (pagata: zero); un giorno con 4 impegni e una scadenza al massimo 2 mail, e dentro c'è tutto;
// l'assistente dice quello che vale per la posta della persona e la cambia quando glielo chiede; la risposta alla chat resta nella chat.
// CONTROPROVA: con la regola vecchia (il programma parte anche solo per le cose da portare: `diOggi.length || porta.length`) la prova
// «niente Prima di uscire nei giorni senza impegni» diventa rossa.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "menomail-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
// la copia con la regola vecchia: il programma del mattino anche per le sole cose da portare
const MARCA = "const programma = h >= 7 && h < 22 && f.riepilogo !== oggi && mattina.length > 0;";
const sorgente = readFileSync(join(qui, "..", "worker.js"), "utf8");
if (!sorgente.includes(MARCA)) { console.log("  ❌ la riga del programma del mattino non è più quella: aggiorna MARCA nella controprova"); process.exit(1); }
writeFileSync(join(dir, "worker-vecchio.mjs"), sorgente.replace(MARCA, MARCA.replace("mattina.length > 0", "(diOggi.length || porta.length)")));
const Vecchio = await import(join(dir, "worker-vecchio.mjs"));

let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, posta = [], telegram = [], richieste = [], risposta = "", giroDi = "";
const sessioni = { ["a".repeat(64)]: "gennaro@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body)); return new Response(JSON.stringify({ content: [{ type: "text", text: risposta }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.brevo.com") { posta.push({ ...JSON.parse(o.body), giro: giroDi }); return new Response("{}"); }
  if (u.host === "api.telegram.org") { telegram.push(JSON.parse(o.body || "{}")); return new Response('{"ok":true}'); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || "");
    if ((o.method || "GET") === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return new Response("{}"); }
    return repo[p] ? new Response(JSON.stringify({ content: b64(repo[p]), sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", BREVO_API_KEY: "k", MITTENTE: "atlas@jjavis.it", TG_BOT_TOKEN: "t", TG_CHAT: "1", ANTHROPIC_API_KEY: "k" };
const MAIL = "gennaro@prova.it";
// gennaio: a Roma è sempre +01:00. I giri sono quelli veri: ogni ora, al minuto 7
const giro = (g, h) => new Date(`${g}T${h}:07:00+01:00`);
const giri = async (Mod, da, a) => { for (let t = da; t <= a; t = new Date(t.getTime() + 3600e3)) { giroDi = t.toISOString(); await Mod.atlasPromemoria(env, t); } };
const nuova = (scheda) => { repo = { "atlas.json": { [MAIL]: { nome: "Gennaro Esposito", turni: [], impegni: [], riepilogo: "", ...scheda } } }; posta = []; telegram = []; };
const oggetti = () => posta.map((m) => m.subject);
const testi = () => posta.map((m) => m.textContent).join("\n");
const giorni = () => [...new Set(posta.map((m) => m.giro.slice(0, 10)))];
const scheda = () => repo["atlas.json"][MAIL];
const impDomani = () => ({ id: "d1", cosa: "dal dentista", giorno: "2027-01-12", ora: "08:00", avvisato: false });
const PORTA = ["chiavi", "occhiali", "badge"];
// il caso Gennaro: un impegno domani alle 8 (12/1) + 3 cose da portare, giri orari da adesso (11/1, le 10) a dopodomani sera (13/1)
const gennaro = async (Mod, extra = {}, altriImpegni = []) => { nuova({ impegni: [impDomani(), ...altriImpegni], da_portare: PORTA, ...extra }); await giri(Mod, giro("2027-01-11", "10"), giro("2027-01-13", "23")); return posta; };

console.log("── il caso Gennaro, «essenziale» (è il valore di chi non ha scelto)");
{ const m = await gennaro(W);
  ok(W.modoPosta(scheda()) === "essenziale", "senza il campo posta una persona qualunque è «essenziale»", scheda());
  ok(m.length <= 2, "al massimo 2 mail in tutto (giri dall'11 alle 10 al 13 alle 23)", oggetti());
  ok(m.length === 1 && /📋 Il tuo programma di oggi, martedì 12\/1/.test(m[0].subject), "una sola: il programma del mattino del giorno dell'impegno", oggetti());
  ok(m[0].attachment && m[0].attachment.length === 1 && m[0].attachment[0].name === "atlas-2027-01-12-d1.ics", "l'invito del calendario viaggia allegato al programma", m[0].attachment);
  ok(/08:00 dal dentista/.test(m[0].textContent) && PORTA.every((x) => m[0].textContent.includes("- " + x)), "dentro: l'impegno e le 3 cose da portare", m[0].textContent);
  ok(!oggetti().some((s) => /Prima di uscire/.test(s)), "NESSUNA mail «Prima di uscire» nei giorni senza impegni (11 e 13)", oggetti());
  ok(!oggetti().some((s) => /🌙|Domani/.test(s)), "niente mail della sera prima", oggetti());
  ok(!oggetti().some((s) => /calendario/.test(s)), "niente mail a parte con gli inviti", oggetti());
  ok(!oggetti().some((s) => /⏰|Alle 08:00/.test(s)), "niente «un'ora prima» a parte: l'impegno delle 8 sta già nel programma", oggetti());
  ok(!oggetti().some((s) => /hai fatto/i.test(s)), "«l'hai fatto?» non è una mail a sé", oggetti());
  ok(giorni().join() === "2027-01-12", "nei giorni senza impegni (11 e 13) nessuna mail", giorni());
  ok(scheda().mail_oggi && scheda().mail_oggi.data === "2027-01-12" && scheda().mail_oggi.quante === 1, "mail_oggi sulla scheda: data e quante", scheda().mail_oggi); }

console.log("── …con un altro impegno il giorno dopo: «l'hai fatto?» è una riga del programma");
{ const m = await gennaro(W, {}, [{ id: "d2", cosa: "dal meccanico", giorno: "2027-01-13", ora: "09:30", avvisato: false }]);
  ok(m.length === 2 && giorni().join() === "2027-01-12,2027-01-13", "due mail in tutto: il programma del 12 e quello del 13", oggetti());
  const p13 = m[1] || {};
  ok(/09:30 dal meccanico/.test(p13.textContent) && /Impegni passati: li hai fatti\?/.test(p13.textContent) && /08:00: dal dentista/.test(p13.textContent), "il programma del 13 ha la riga «l'hai fatto?» dell'impegno del 12", p13.textContent);
  ok(PORTA.every((x) => (p13.textContent || "").includes("- " + x)) && p13.attachment && p13.attachment.length === 1, "…e le cose da portare, e l'invito del nuovo impegno", p13.attachment);
  ok(!oggetti().some((s) => /^❓/.test(s)), "nessuna mail «l'hai fatto?» a sé", oggetti());
  const n = posta.length; await giri(W, giro("2027-01-14", "07"), giro("2027-01-14", "21"));
  ok(posta.length === n, "il giorno dopo, già chiesto: non lo richiede", oggetti().slice(n)); }

console.log("── senza programma: una mail sola alla settimana con tutti quelli da confermare");
{ nuova({ impegni: [{ id: "v1", cosa: "dal dentista", giorno: "2027-01-05", ora: "10:00", avvisato: true, ics: true }, { id: "v2", cosa: "la revisione", giorno: "2027-01-08", ora: null, avvisato: true, ics: true }], da_portare: PORTA });
  await giri(W, giro("2027-01-09", "07"), giro("2027-01-18", "21"));
  ok(posta.length === 1 && /^❓ 2 impegni passati/.test(posta[0].subject) && posta[0].giro.startsWith("2027-01-12"), "una mail sola, il 12 (7 giorni dopo il primo), con tutti e due", oggetti());
  ok(/dal dentista/.test(posta[0].textContent) && /la revisione/.test(posta[0].textContent), "dentro ci sono tutti quelli da confermare", posta[0].textContent);
  ok(!oggetti().some((s) => /Prima di uscire/.test(s)), "e le cose da portare non partono da sole", oggetti()); }

console.log("── lo stesso caso con posta: «tutto»: le mail di oggi");
{ const m = await gennaro(W, { posta: "tutto" }); const o = oggetti();
  ok(o.some((s) => /🌙 Domani, martedì 12\/1/.test(s)), "la sera prima", o);
  ok(o.some((s) => /📋 Il tuo programma di oggi, martedì 12\/1/.test(s)), "il programma del mattino", o);
  ok(o.some((s) => /⏰ Alle 08:00: dal dentista/.test(s)), "un'ora prima", o);
  ok(o.some((s) => /📅 .*calendario/.test(s)) && m.find((x) => /calendario/.test(x.subject)).attachment.length === 1, "l'invito, in una mail a parte", o);
  ok(o.some((s) => /❓ L'hai fatto\? dal dentista/.test(s)), "l'hai fatto", o);
  ok(o.some((s) => /🎒 Prima di uscire/.test(s)), "e «Prima di uscire» ogni mattina, come prima", o);
  ok(m.length > 2, "senza tetto: più di 2 mail", m.length); }

console.log("── posta: «niente»: zero mail");
{ nuova({ posta: "niente", impegni: [impDomani()], da_portare: PORTA, scadenze: [{ id: "s1", cosa: "la luce", importo: "85 €", giorno: "2027-01-12", ogni_mese: false, pagata: false, avvisi: {} }] });
  await giri(W, giro("2027-01-09", "10"), giro("2027-01-14", "23"));
  ok(posta.length === 0, "nessuna mail: né programma, né promemoria, né scadenze", oggetti());
  ok(telegram.length === 0, "e JJ non riceve nessuna riga", telegram.length); }

console.log("── una scadenza fra 5 giorni, «essenziale»");
{ const luce = (extra = {}) => ({ scadenze: [{ id: "s1", cosa: "bolletta della luce", importo: "85,40 €", giorno: "2027-01-16", ogni_mese: false, pagata: false, avvisi: {}, ...extra }] });
  nuova(luce()); await giri(W, giro("2027-01-11", "00"), giro("2027-01-17", "23"));
  ok(posta.length === 1 && /💶 Scade domani: bolletta della luce · 85,40 €/.test(posta[0].subject) && posta[0].giro.startsWith("2027-01-15"), "una sola mail, il giorno prima (non 3 giorni prima e il giorno stesso)", posta.map((m) => [m.giro, m.subject]));
  nuova(luce({ pagata: true })); await giri(W, giro("2027-01-11", "00"), giro("2027-01-17", "23"));
  ok(posta.length === 0, "segnata pagata: zero", oggetti()); }

console.log("── un giorno con impegni e una scadenza: al massimo 2 mail, e dentro c'è tutto");
{ const imp = (...ore) => ore.map((ora, i) => ({ id: "q" + i, cosa: `impegno ${ora}`, giorno: "2027-01-14", ora, avvisato: false }));
  const scad = { id: "s1", cosa: "bolletta del gas", importo: "40 €", giorno: "2027-01-15", ogni_mese: false, pagata: false, avvisi: {} };
  for (const [nome, ore] of [["4 impegni sparsi nella giornata", ["09:00", "11:00", "15:00", "17:00"]], ["4 impegni, tutti nel pomeriggio", ["14:00", "16:00", "18:00", "20:00"]], ["4 impegni, tutti la mattina", ["08:30", "09:30", "10:30", "12:00"]]]) {
    nuova({ impegni: imp(...ore), scadenze: [{ ...scad }], da_portare: PORTA }); await giri(W, giro("2027-01-14", "00"), giro("2027-01-14", "23"));
    ok(posta.length >= 1 && posta.length <= 2, `${nome} + una scadenza: al massimo 2 mail`, oggetti());
    ok(ore.every((ora) => testi().includes(`impegno ${ora}`)), "…e ogni impegno è in una mail", testi());
    ok(oggetti().some((s) => /💶 Scade domani: bolletta del gas/.test(s)), "…e la scadenza di domani c'è", oggetti());
    ok(scheda().mail_oggi.quante === posta.length, "…e mail_oggi dice quante", scheda().mail_oggi); }
  // le scadenze di domani hanno la precedenza: con una mail già partita oggi, il posto che resta è loro e il resto si accorpa
  nuova({ impegni: imp("15:00"), scadenze: [{ ...scad }], mail_oggi: { data: "2027-01-14", quante: 1 } }); await giri(W, giro("2027-01-14", "08"), giro("2027-01-14", "23"));
  ok(posta.length === 1 && /💶/.test(posta[0].subject) && /impegno 15:00/.test(posta[0].textContent), "con un posto solo: la scadenza e il resto insieme, nella stessa mail", posta.map((m) => [m.giro, m.subject]));
  nuova({ impegni: imp("09:00"), mail_oggi: { data: "2027-01-14", quante: 2 } }); await giri(W, giro("2027-01-14", "07"), giro("2027-01-14", "23"));
  ok(posta.length === 0, "già 2 mail oggi: niente più, in ogni caso", oggetti()); }

console.log("── Jessica: il suo servizio non cambia");
{ ok(W.modoPosta({ nome: "Jessica Crippa", turni: [] }) === "tutto", "la scheda di «Jessica Crippa» senza campo posta vale «tutto»");
  ok(W.modoPosta({ nome: "Jessica Crippa", posta: "essenziale" }) === "essenziale", "…se sceglie lei, vale quello che sceglie");
  ok(W.modoPosta({ nome: "Gennaro" }) === "essenziale" && W.modoPosta({ nome: "Jessica Crippa", posta: "boh" }) === "tutto" && W.modoPosta(undefined) === "essenziale", "gli altri e i valori strani: «essenziale» (Jessica: «tutto»)");
  nuova({ nome: "Jessica Crippa", impegni: [impDomani()], da_portare: PORTA }); await giri(W, giro("2027-01-11", "10"), giro("2027-01-13", "23"));
  ok(oggetti().some((s) => /🌙/.test(s)) && oggetti().some((s) => /⏰/.test(s)) && oggetti().some((s) => /calendario/.test(s)) && oggetti().some((s) => /🎒 Prima di uscire/.test(s)), "sera prima, un'ora prima, invito e «Prima di uscire»: tutto come prima", oggetti()); }

console.log("── quanteMail (pura) e la riga per JJ");
{ const s = { mail_oggi: { data: "2027-01-11", quante: 2 } }, copia = JSON.stringify(s);
  ok(W.quanteMail(s, "2027-01-11") === 2 && W.quanteMail(s, "2027-01-12") === 0 && W.quanteMail({}, "2027-01-11") === 0 && W.quanteMail(undefined, "2027-01-11") === 0, "oggi 2, un altro giorno 0, nessun conto 0");
  ok(JSON.stringify(s) === copia, "non cambia la scheda");
  await gennaro(W);
  const riga = telegram.map((t) => t.text).find((t) => /Atlas ha mandato/.test(t)) || "";
  ok(/Totale del giro: 1 \(oggi 1\)/.test(riga), "nella riga per JJ il totale del giro", riga); }

console.log("── l'assistente: quello che promette dipende dalla posta; la sceglie parlando; la chat resta chat");
{ const chiama = async (corpo) => (await W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/assistente", { method: "POST",
    headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", Authorization: "Bearer " + "a".repeat(64) }, body: JSON.stringify(corpo) }), env, { waitUntil() {} })).json();
  const promesse = /la sera prima, alle 20|ogni mattina alle 7|3 giorni prima/;
  const sistema = async (posta) => { nuova({ ...(posta ? { posta } : {}), turni: [{ chi: "noi", testo: "ciao", quando: "x" }] }); richieste = []; risposta = '{"risposta":"Va bene.","nuovi":[],"posta":null}';
    await chiama({ testo: "ciao" }); return richieste[0].system; };
  const S = await sistema(null);
  ok(!promesse.test(S) && /Ti scrivo per mail solo quando serve: se ne vuoi di più o di meno, dimmelo/.test(S) && /al massimo 2 mail al giorno/.test(S), "«essenziale»: niente promesse fisse, la riga della prima volta, il tetto", S.match(promesse));
  ok(/"posta": null oppure "essenziale"/.test(S) && /«mandami meno mail»/.test(S) && /«non mandarmi mail»/.test(S), "il JSON ha il campo posta e il prompt dice come si cambia");
  const T = await sistema("tutto"); ok(/la sera prima, alle 20/.test(T) && /3 giorni prima e la mattina/.test(T), "«tutto»: le promesse di una volta, ma solo qui");
  const N = await sistema("niente"); ok(!promesse.test(N) && /NON le mandi mail da solo/.test(N), "«niente»: dice che per mail non scrive");
  // si sceglie parlando
  nuova({ turni: [{ chi: "noi", testo: "ciao", quando: "x" }] }); risposta = '{"risposta":"Va bene, solo l\'essenziale.","nuovi":[],"posta":"niente"}';
  const d = await chiama({ testo: "non mandarmi mail" });
  ok(scheda().posta === "niente" && d.risposta === "Va bene, solo l'essenziale.", "«non mandarmi mail» → posta: niente nella scheda", scheda());
  risposta = '{"risposta":"Ok.","nuovi":[],"posta":null}'; await chiama({ testo: "grazie" });
  ok(scheda().posta === "niente", "posta null: non cambia", scheda());
  risposta = '{"risposta":"Ok.","nuovi":[],"posta":"sempre"}'; await chiama({ testo: "boh" });
  ok(scheda().posta === "niente", "un valore che non esiste: non cambia", scheda());
  risposta = '{"risposta":"Eccomi.","nuovi":[],"posta":"tutto"}'; await chiama({ testo: "voglio tutto per mail" });
  ok(scheda().posta === "tutto", "«voglio tutto per mail» → tutto", scheda());
  ok(posta.length === 0, "le risposte a chi scrive nella chat restano nella chat: nessuna mail", oggetti());
  // la prima volta dalla pagina: resta nella chat (tranne con «tutto»)
  for (const [p, attese] of [["essenziale", 0], ["niente", 0], ["tutto", 1]]) {
    repo = { "attesa.json": { ids: [] } }; posta = []; richieste = []; risposta = '{"risposta":"Ciao, sono Atlas.","nuovi":[]}';
    if (p !== "essenziale") repo["atlas.json"] = { [MAIL]: { nome: "Gennaro Esposito", posta: p, turni: [], impegni: [], riepilogo: "" } };
    const e = await chiama({ primo: true, nome_assistente: "Atlas", tuo: "Gennaro Esposito" });
    ok(e.primo === true && posta.length === attese, `la prima proposta dalla pagina con «${p}»: ${attese ? "anche per mail" : "solo nella chat"}`, oggetti()); } }

console.log("── CONTROPROVA: con la regola vecchia la prova «niente Prima di uscire senza impegni» diventa rossa");
{ const buona = !(await gennaro(W)).some((m) => /Prima di uscire/.test(m.subject));
  const vecchia = !(await gennaro(Vecchio)).some((m) => /Prima di uscire/.test(m.subject));
  ok(buona, "la regola nuova: nessun «Prima di uscire» nei giorni senza impegni");
  ok(!vecchia, "la regola vecchia (diOggi.length || porta.length): «Prima di uscire» parte, la prova è rossa", oggetti()); }

console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde");
process.exit(errori ? 1 : 0);
