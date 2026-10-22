// Il primo incontro (22/10) — tutto finto.   node collaudo/primo.mjs
// JJ: «quando viene usato per la prima volta è proprio quando deve colpire per la sua utilità… non ha neanche proposto niente».
// Controlla: con l'account, quello che ha scritto nel sondaggio va SUBITO al suo assistente ([PRIMA VOLTA] + le sue parole), la
// risposta torna alla chat, entra nel filo (f.primo), la domanda in attesa di JJ si chiude, a JJ arriva la riga 🤝; una volta
// sola (la seconda: gia). Le cose da portare: entrano nel filo e la mattina parte la mail anche senza impegni, una volta al giorno.
// Controprove: il sondaggio di un'altra persona non si legge; il modello che cade non segna f.primo e lo dice a JJ;
// da_portare null non cancella l'elenco.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "primo-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
let repo = {}, risposta = "", richieste = [], telegram = [], mail = [], rotto = false;
const sessioni = { ["a".repeat(64)]: "giada@prova.it", ["b".repeat(64)]: "altro@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { if (rotto) return new Response('{"error":{"message":"finto guasto"}}', { status: 500 });
    richieste.push(JSON.parse(o.body)); return new Response(JSON.stringify({ content: [{ type: "text", text: risposta }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.telegram.org") { telegram.push(JSON.parse(o.body || "{}")); return new Response('{"ok":true,"result":{"message_id":1}}'); }
  if (u.host === "api.brevo.com") { mail.push(JSON.parse(o.body)); return new Response('{"messageId":"x"}', { status: 201 }); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", TG_CHAT: "1", TG_BOT_TOKEN: "t", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it" };
const chiama = async (tok, corpo) => (await W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/assistente", { method: "POST",
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(corpo) }), env, { waitUntil() {} })).json();

const CHI = "4b675b9f2df739ec";
const BISOGNO = "Che mi ricordi gli impegni della giornata e cosa portarmi dietro quando esco da casa.";
repo[`utenti/${CHI}.json`] = b64({ chi: CHI, mail: "giada@prova.it", tuo: "Giada", nome_assistente: "Arya", mestiere: "Negozio o commercio", tempo: "Ricordarmi dei clienti abituali", proposta: BISOGNO });
repo["bozze/af144945.json"] = b64({ id: "af144945", chi: CHI, da_dove: "sondaggio", stato: "arrivata", domanda: BISOGNO });
repo["attesa.json"] = b64({ ids: ["11111111", "af144945"] });
repo["bozze/11111111.json"] = b64({ id: "11111111", chi: "ffffffffffffffff", da_dove: "chat", stato: "arrivata" });
repo["atlas.json"] = b64({ "giada@prova.it": { nome: "Giada", turni: [], impegni: [], riepilogo: "", assistente: "Arya" } });

// controprova: un'altra persona col codice di Giada non legge il suo sondaggio e non chiude la sua domanda
risposta = '{"risposta":"Ciao, ecco cosa faccio.","nuovi":[]}';
let d = await chiama("b".repeat(64), { primo: true, chi: CHI });
ok(d.primo && !richieste[0].messages[0].content.includes("portarmi dietro"), "controprova: il sondaggio di un'altra persona non si legge", richieste[0] && richieste[0].messages[0].content);
ok(leggi("bozze/af144945.json").stato === "arrivata", "controprova: la domanda di Giada resta in attesa");

// il modello cade: niente f.primo, JJ lo sa, si potrà riprovare
rotto = true; telegram = [];
d = await chiama("a".repeat(64), { primo: true, chi: CHI });
ok(d.errore === "non ci sono riuscito" && !leggi("atlas.json")["giada@prova.it"].primo, "il modello che cade: «non ci sono riuscito», niente segnato", d);
ok(telegram.some((t) => /NON partita/.test(t.text)), "e a JJ arriva ⚠️ col motivo", telegram);
rotto = false; richieste = []; telegram = [];

// la prima volta vera
risposta = '{"risposta":"Ciao Giada, sono Arya. Da oggi ti ricordo gli impegni: la mattina alle 7 il programma, un\'ora prima di quelli con l\'ora. E ogni mattina ti scrivo cosa portarti dietro. Cosa devi portarti sempre? E cosa hai oggi e domani?","nuovi":[],"da_portare":null}';
d = await chiama("a".repeat(64), { primo: true, chi: CHI, nome_assistente: "Arya", tuo: "Giada" });
const q = richieste[0].messages[0].content;
ok(d.primo && /Da oggi ti ricordo/.test(d.risposta), "la prima volta: risposta subito, alla chat", d);
ok(q.includes("[PRIMA VOLTA]") && q.includes(BISOGNO) && q.includes("Ricordarmi dei clienti abituali"), "al modello: [PRIMA VOLTA] e le sue parole del sondaggio", q.slice(0, 400));
ok(/La PRIMA VOLTA/.test(richieste[0].system) && /da_portare/.test(richieste[0].system), "le regole: la prima volta e le cose da portare", "");
let A = leggi("atlas.json")["giada@prova.it"];
ok(A.primo && A.turni[0].testo === "[dal sondaggio] " + BISOGNO && A.turni[1].chi === "noi", "nel filo: f.primo, quello che ha scritto e la risposta (per mail lo sa)", A);
ok(leggi("bozze/af144945.json").stato === "inviata" && !leggi("attesa.json").ids.includes("af144945") && leggi("attesa.json").ids.includes("11111111"),
  "la sua domanda in attesa si chiude, quella di un altro resta", leggi("attesa.json"));
ok(telegram.some((t) => /🤝 Arya ha fatto la prima proposta a Giada \(chat \+ mail\)/.test(t.text) && /#af144945 è chiusa/.test(t.text)), "a JJ: la proposta (chat + mail) e la domanda chiusa", telegram.map((t) => t.text));
const pm = mail.find((x) => x.to[0].email === "giada@prova.it" && /cosa faccio per te da oggi/.test(x.subject));
ok(pm && pm.textContent.startsWith("Ciao Giada, sono Arya.") && pm.sender.name === "Arya · JJA-VIS", "la proposta arriva ANCHE per mail (JJ: se no non sa che le ha risposto)", mail);
richieste = [];
d = await chiama("a".repeat(64), { primo: true, chi: CHI });
ok(d.gia === true && richieste.length === 0, "una volta sola: la seconda non chiama il modello", d);

// le cose da portare
risposta = '{"risposta":"Segnato: chiavi, occhiali, badge.","nuovi":[],"da_portare":["chiavi","occhiali","badge"]}';
await chiama("a".repeat(64), { testo: "devo portarmi sempre chiavi, occhiali e badge" });
ok(JSON.stringify(leggi("atlas.json")["giada@prova.it"].da_portare) === '["chiavi","occhiali","badge"]', "da_portare entra nel filo", leggi("atlas.json")["giada@prova.it"]);
risposta = '{"risposta":"Va bene.","nuovi":[],"da_portare":null}';
await chiama("a".repeat(64), { testo: "grazie" });
ok((leggi("atlas.json")["giada@prova.it"].da_portare || []).length === 3, "controprova: da_portare null non cancella l'elenco");
ok(richieste[richieste.length - 1].messages[0].content.includes("chiavi, occhiali, badge"), "il modello vede cosa si porta dietro");
mail = [];
await W.atlasPromemoria(env, new Date("2026-10-23T05:10:00Z"));   // 7:10 a Roma, nessun impegno
const m = mail.find((x) => x.to[0].email === "giada@prova.it");
ok(m && /Prima di uscire/.test(m.subject) && /- chiavi\n- occhiali\n- badge/.test(m.textContent), "la mattina: la mail con le cose da portare, anche senza impegni", mail);
mail = [];
await W.atlasPromemoria(env, new Date("2026-10-23T06:10:00Z"));
ok(!mail.some((x) => x.to[0].email === "giada@prova.it"), "una volta al giorno", mail);
mail = [];
await W.atlasPromemoria(env, new Date("2026-10-23T22:10:00Z"));   // mezzanotte e dieci del 24: di notte non si scrive
ok(!mail.some((x) => x.to[0].email === "giada@prova.it"), "di notte niente mail", mail);
// ✍️ Bozza di JJ su una domanda dal sondaggio di chi ha già l'assistente (il caso di Giada, già passato): parte la proposta, chat + mail
const CHI2 = "aaaabbbbccccdddd", SEG = await (async () => { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("t")); return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32); })();
repo[`utenti/${CHI2}.json`] = b64({ chi: CHI2, mail: "sara@prova.it", tuo: "Sara", nome_assistente: "Mira", proposta: "ricordami le bollette" });
repo["bozze/bbbb2222.json"] = b64({ id: "bbbb2222", chi: CHI2, da_dove: "sondaggio", stato: "arrivata", a: "sara@prova.it", domanda: "ricordami le bollette" });
const At = leggi("atlas.json"); At["sara@prova.it"] = { nome: "Sara", turni: [], impegni: [], riepilogo: "", assistente: "Mira" }; repo["atlas.json"] = b64(At);
repo["attesa.json"] = b64({ ids: ["bbbb2222"] });
risposta = '{"risposta":"Ciao Sara, sono Mira. Le bollette te le ricordo io.","nuovi":[]}'; mail = []; telegram = []; richieste = [];
const tocca = (data) => W.default.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: 1 }, data, message: { message_id: 1, chat: { id: 1 } } } }) }), env, { waitUntil() {} });
let rt = await tocca("bozza:bbbb2222");
ok(rt.status === 200 && richieste.length === 1 && richieste[0].messages[0].content.includes("[PRIMA VOLTA]"), "✍️ Bozza: fa la prima proposta del suo assistente", richieste.length);
ok(mail.some((x) => x.to[0].email === "sara@prova.it" && /cosa faccio per te/.test(x.subject)) && repo[`per-pagina/${CHI2}/bbbb2222.json`], "…per mail e nella chat della pagina", mail);
ok(leggi("bozze/bbbb2222.json").stato === "inviata" && !leggi("attesa.json").ids.length, "…e la domanda si chiude");
richieste = []; rt = await tocca("bozza:bbbb2222");
ok(richieste.length === 0, "toccato due volte: niente seconda proposta", richieste.length);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
