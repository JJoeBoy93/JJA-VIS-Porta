// Il lavoro di una vita e le passioni (28/10) — tutto finto.   node collaudo/passioni.mjs
// JJ: «anche se in pensione ha fatto la sua vita dedicandosi a un lavoro e a delle passioni, bisogna imparare anche quelle».
// Controlla: le due voci del ritorno («passioni», «mestiere_di_una_vita») arrivano all'assistente con parole chiare
// («le sue passioni: …», «ha fatto nella vita: …») in bozza, nella chat e alla prima volta; il limite è 120 caratteri
// (le altre voci restano a 60); le istruzioni dell'assistente dicono di usarle senza ripeterle.
// Controprove: una voce qualunque resta a 60; senza le due voci il testo per l'assistente non cambia.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "passioni-"));
const sorgente = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(qui, "..", "worker.js");
copyFileSync(sorgente, join(dir, "worker.mjs")); for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(qui, "..", f), join(dir, f));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
let repo = {}, risposta = "", richieste = [];
const sessioni = { ["a".repeat(64)]: "rosa@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body));
    return new Response(JSON.stringify({ content: [{ type: "text", text: risposta }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.telegram.org") return new Response('{"ok":true,"result":{"message_id":1}}');
  if (u.host === "api.brevo.com") return new Response('{"messageId":"x"}', { status: 201 });
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", TG_CHAT: "42", TG_BOT_TOKEN: "t", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it" };
const ORIG = "https://jjoeboy93.github.io";
const chiama = async (via, tok, corpo) => (await W.default.fetch(new Request("https://porta" + via, { method: "POST",
  headers: { Origin: ORIG, "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(corpo) }), env, { waitUntil() {} }));
const contenuto = () => String(((richieste.at(-1) || {}).messages || [{}])[0].content);

const CHI = "4b675b9f2df739ec";
const PASSIONI = "Orto e giardino, Cucina", MESTIERE = "Artigiano o tecnico";
const LUNGA = "x".repeat(200);

console.log("── la bozza (JJ tocca ✍️ Bozza)");
const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.TG_BOT_TOKEN));
const segreto = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
const tocco = (dati) => W.default.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": segreto, "content-type": "application/json" },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: 42 }, data: dati, message: { message_id: 7, chat: { id: 42 } } } }) }), env, { waitUntil() {} });
risposta = "Bella l'idea dell'orto.";
let r = await chiama("/parla", "", { chi: CHI, da_dove: "chat", testo: "Cosa potresti fare per me?", tuo: "Rosa", nome_assistente: "Iris",
  profilo: { vita: "pensione", tempo: "Bollette e scadenze", conosciute: { passioni: PASSIONI, mestiere_di_una_vita: MESTIERE, inizio: "Dopo le 8" } } });
const d = await r.json(); ok(r.status === 201 && d.id, "/parla: arrivata", d);
await tocco("bozza:" + d.id);
let v = contenuto();
ok(v.includes(`le sue passioni: ${PASSIONI}`) && v.includes(`ha fatto nella vita: ${MESTIERE}`), "alla bozza arrivano «le sue passioni: …» e «ha fatto nella vita: …»", v.slice(0, 500));
ok(String(richieste.at(-1).system).includes("Se sai le sue passioni o il lavoro che ha fatto, usale per proporre cose dedicate a lui"), "e le istruzioni della bozza (CHI_SONO) dicono di usarle", String(richieste.at(-1).system).length);
ok(!v.includes("mestiere_di_una_vita") && !/ti ha detto:[^\n]*passioni/.test(v), "e non come «mestiere_di_una_vita: …» / «passioni: …»", v.slice(0, 500));
ok(v.includes("inizio: Dopo le 8"), "le altre voci restano come prima («ti ha detto: inizio: …»)", v.slice(0, 500));

console.log("── il limite: 120 per le due voci, 60 per le altre");
r = await chiama("/parla", "", { chi: CHI, da_dove: "chat", testo: "ciao", profilo: { vita: "casa", conosciute: { passioni: LUNGA, mestiere_di_una_vita: LUNGA, parlare: LUNGA } } });
const rec = leggi(`bozze/${(await r.json()).id}.json`), c = rec.profilo.conosciute;
ok(c.passioni === "x".repeat(120), "una passione di 200 caratteri arriva tagliata a 120", c.passioni.length);
ok(c.mestiere_di_una_vita === "x".repeat(120), "il mestiere di una vita di 200 caratteri: 120", c.mestiere_di_una_vita.length);
ok(c.parlare === "x".repeat(60), "controprova: un'altra voce resta a 60", c.parlare.length);
const ut = leggi(`utenti/${CHI}.json`).conosciute;
ok(ut.passioni.length === 120 && ut.parlare.length === 60, "e così è salvata nel profilo di chi", ut);
const CHI2 = "0123456789abcdef";
r = await chiama("/conoscenza", "", { chi: CHI2, chiave: "passioni", domanda: "Cosa ti appassiona?", risposta: LUNGA });
await new Promise((x) => setTimeout(x, 100));   // il profilo si scrive in waitUntil: si aspetta che finisca
ok(r.status === 201 && leggi(`utenti/${CHI2}.json`).conosciute.passioni.length === 120, "anche dalla domanda del ritorno (/conoscenza) restano 120", leggi(`utenti/${CHI2}.json`).conosciute.passioni.length);

console.log("── la chat dopo la prima");
risposta = '{"risposta":"Ecco.","nuovi":[]}';
repo[`utenti/${CHI}.json`] = b64({ chi: CHI, mail: "rosa@prova.it", vita: "pensione", conosciute: { passioni: PASSIONI, mestiere_di_una_vita: MESTIERE } });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHI });
v = contenuto();
ok(v.includes(`- le sue passioni: ${PASSIONI}`) && v.includes(`- ha fatto nella vita: ${MESTIERE}`), "assistenteDallaChat: le due righe con parole chiare", v.slice(0, 500));
ok(!v.includes("mestiere_di_una_vita"), "e non il nome della chiave");
ok(/COME SUGGERISCI/.test(String(richieste.at(-1).system)) && /il PROFILO[^\n]*\n?[^\n]*le passioni/.test(String(richieste.at(-1).system)), "le istruzioni dell'assistente dicono di usarle (28/10: come fonte del suggerimento, collaudo/chat-cancellata.mjs)", String(richieste.at(-1).system).length);
repo[`utenti/${CHI}.json`] = b64({ chi: CHI, mail: "rosa@prova.it", vita: "lavoro", mestiere: "Artigiano", conosciute: { passioni: LUNGA } });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHI });
v = contenuto();
ok(v.includes("- le sue passioni: " + "x".repeat(120) + "\n") && !v.includes("x".repeat(121)), "una passione di 200 caratteri arriva tagliata a 120", v.slice(0, 500));
ok(!v.includes("ha fatto nella vita"), "senza «mestiere_di_una_vita» non c'è la riga del mestiere", v.slice(0, 500));
repo[`utenti/${CHI}.json`] = b64({ chi: CHI, mail: "rosa@prova.it", vita: "lavoro", conosciute: { inizio: "Dopo le 8" } });
await chiama("/assistente", "a".repeat(64), { testo: "ciao", chi: CHI });
v = contenuto();
ok(!v.includes("passioni") && !v.includes("Quello che sai di lei"), "controprova: senza le due voci il testo è quello di sempre", v.slice(0, 300));

console.log("── la prima volta");
repo = {}; repo["attesa.json"] = b64({ ids: [] }); repo[`utenti/${CHI}.json`] = b64({ chi: CHI, mail: "rosa@prova.it", vita: "pensione", tempo: "Bollette e scadenze", conosciute: { passioni: PASSIONI, mestiere_di_una_vita: MESTIERE } });
repo["atlas.json"] = b64({ "rosa@prova.it": { nome: "Rosa", posta: "tutto", turni: [], impegni: [], riepilogo: "", assistente: "Iris" } });
await chiama("/assistente", "a".repeat(64), { primo: true, chi: CHI, nome_assistente: "Iris", tuo: "Rosa" });
v = contenuto();
ok(v.includes(`- le sue passioni: ${PASSIONI}`) && v.includes(`- ha fatto nella vita: ${MESTIERE}`) && !v.includes("mestiere_di_una_vita"), "primoCore: la lista «sa» ha le due righe", v.slice(0, 700));

console.log(errori ? `\n${errori} ROSSE` : "\nVERDE"); process.exit(errori ? 1 : 0);
