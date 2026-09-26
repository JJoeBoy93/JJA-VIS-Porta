// Collaudo della porta con GitHub, Telegram, Anthropic e Brevo finti: niente rete.
//   node collaudo/porta.mjs            (prova worker.js accanto)
//   node collaudo/porta.mjs altro.js   (prova un'altra versione)
// Nato il 26 settembre 2026 (Athena): commissioni, contatto a parte, il 📋
// che tagliava la domanda, Clio per le guide.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const sorgente = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "worker.js"));
const copiaPorta = join(mkdtempSync(join(tmpdir(), "porta-")), "worker.mjs");   // worker.js e' ESM ma si chiama .js
copyFileSync(sorgente, copiaPorta);
const W = (await import(copiaPorta)).default;
const repo = new Map(), tgInviati = [], claudeVisti = [], brevo = [];
let conta = 0;
globalThis.fetch = async (url, o = {}) => {
  url = String(url); const m = o.method || "GET";
  const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
  if (url.includes("api.github.com")) {
    const p = decodeURIComponent(url.split("/contents/")[1] || "");
    if (m === "GET") { if (repo.has(p)) return J({ content: repo.get(p), sha: "s" + (++conta) }); 
      const dir=[...repo.keys()].filter(k=>k.startsWith(p+"/")); if(dir.length) return J(dir.map(k=>({name:k.split("/").pop()})));
      return J({ message: "Not Found" }, 404); }
    if (m === "PUT") { repo.set(p, JSON.parse(o.body).content); return J({ content: { sha: "x" } }, 201); }
  }
  if (url.includes("api.telegram.org")) { const b = JSON.parse(o.body); const met = url.split("/").pop();
    tgInviati.push([met, b]); return J({ ok: true, result: { message_id: 7, message_thread_id: 3 } }); }
  if (url.includes("api.anthropic.com")) { claudeVisti.push(JSON.parse(o.body)); return J({ content: [{ type: "text", text: "Si può fare. Ti manda un preventivo." }] }); }
  if (url.includes("api.brevo.com")) { brevo.push(JSON.parse(o.body)); return J({ messageId: "b1" }, 201); }
  return J({}, 404);
};
const env = { GH_TOKEN: "t", TG_BOT_TOKEN: "bot", TG_CHAT: "42", ANTHROPIC_API_KEY: "k", BREVO_API_KEY: "b", MITTENTE: "jjavis@esempio.it" };
const ctx = { waitUntil() {} };
const ORIG = "https://jjoeboy93.github.io";
const post = (path, corpo) => W.fetch(new Request("https://porta" + path, { method: "POST", headers: { Origin: ORIG, "content-type": "application/json" }, body: JSON.stringify(corpo) }), env, ctx);
let err = 0; const ok = (c, msg) => { console.log((c ? "  ✅ " : "  ❌ ") + msg); if (!c) err++; };
const deb = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));

console.log("── commissione senza mail");
let r = await post("/parla", { chi: "a1b2c3d4e5f60718", da_dove: "commissione", testo: "🛠 Sito web — voglio il sito della pizzeria" });
ok(r.status === 400, "rifiutata: serve la mail col consenso");

console.log("── commissione con contatto");
r = await post("/parla", { chi: "a1b2c3d4e5f60718", da_dove: "commissione", nome_assistente: "Nova", tuo: "Luca",
  testo: "🛠 Sito o pagina web — voglio il sito della pizzeria, con il menù", contatto: { nome: "Luca Bianchi", societa: "Pizzeria Da Luca", mail: "luca@pizzeria.it", consenso: true } });
const d = await r.json(); ok(r.status === 201 && d.id, "arrivata, id " + d.id);
const rec = deb(repo.get(`bozze/${d.id}.json`));
ok(rec.a === "luca@pizzeria.it" && rec.da_dove === "commissione", "la bozza salvata ha la mail per la risposta");
ok(!rec.domanda.includes("luca@") && !rec.domanda.includes("Bianchi"), "la domanda non contiene nome né mail");
const msg = tgInviati.find(([m, b]) => m === "sendMessage" && (b.text || "").includes(d.id));
ok(msg && msg[1].text.includes("🛠 COMMISSIONE") && msg[1].text.includes("luca@pizzeria.it") && msg[1].text.includes("✉️ mail"), "Telegram: 🛠 COMMISSIONE, il contatto e «via mail»");
console.log("     " + (msg ? msg[1].text.split("\n").slice(0, 4).join(" | ") : "—"));

console.log("── JJ tocca ✍️ Bozza");
const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.TG_BOT_TOKEN));
const segreto = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
const tocco = (dati) => W.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": segreto, "content-type": "application/json" },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: 42 }, data: dati, message: { message_id: 7, chat: { id: 42 } } } }) }), env, ctx);
await tocco("bozza:" + d.id);
const visto = JSON.stringify(claudeVisti.at(-1) || {});
ok(claudeVisti.length === 1, "Claude chiamato una volta");
ok(!visto.includes("luca@") && !visto.includes("Bianchi") && !visto.includes("Luca"), "Claude non vede nome né mail");
ok(visto.includes("COMMISSIONE") && visto.includes("preventivo"), "Claude sa che è una commissione e che si prende");
await tocco("invia:" + d.id);
ok(brevo.length === 1 && brevo[0].to[0].email === "luca@pizzeria.it", "Invia: la mail parte a Luca");

console.log("── 📋 per un'altra IA");
await tocco("copia:" + d.id);
const copia = tgInviati.filter(([m]) => m === "sendMessage").map(([, b]) => b.text).find((t) => t.includes("-----") && t.includes("pizzeria"));
ok(copia && !copia.includes("luca@") && !copia.includes("Bianchi"), "il testo da incollare non ha nome né mail");

console.log("── investitore");
r = await post("/parla", { chi: "a1b2c3d4e5f60718", da_dove: "investitori", testo: "💼 Investire — vorrei il dossier",
  contatto: { nome: "Anna Rossi", mail: "anna@fondo.it", consenso: true } });
const d2 = await r.json(); ok(r.status === 201, "arrivata");
const m2 = tgInviati.find(([m, b]) => m === "sendMessage" && (b.text || "").includes(d2.id));
ok(m2 && m2[1].text.includes("💼 INVESTITORE"), "Telegram: 💼 INVESTITORE");
await tocco("bozza:" + d2.id);
ok(JSON.stringify(claudeVisti.at(-1)).includes("riservatezza") && !JSON.stringify(claudeVisti.at(-1)).includes("anna@"), "bozza investitori: NDA, senza mail");

console.log("── 📋 a pezzi interi");
const pezzi = tgInviati.filter(([m, b]) => m === "sendMessage" && /📋 #/.test(b.text || "") && b.text.includes(d.id)).map(([, b]) => b.text);
const unito = pezzi.join("\n");
ok(pezzi.length >= 1 && pezzi.every((t) => t.length <= 4096), `${pezzi.length} pezzi, tutti sotto i 4.096 caratteri di Telegram`);
ok(unito.includes("pizzeria") && unito.includes("NESSUNA RISPOSTA") && unito.includes("istruzioni per te"), "dentro ci sono la domanda E le regole in fondo");

console.log("── una guida chiede Clio");
r = await post("/parla", { chi: "a1b2c3d4e5f60718", da_dove: "clio", testo: "🏛 Clio — lingue: italiano, inglese" });
ok(r.status === 400, "senza contatto: rifiutata");
r = await post("/parla", { chi: "a1b2c3d4e5f60718", da_dove: "clio", testo: "🏛 Clio — lingue: italiano, inglese · dove: Roma",
  contatto: { nome: "Giulia Verdi", mail: "giulia@guide.it", consenso: true } });
const d4 = await r.json(); ok(r.status === 201, "con contatto: arrivata");
const m4 = tgInviati.find(([m, b]) => m === "sendMessage" && (b.text || "").includes(d4.id));
ok(m4 && m4[1].text.includes("🏛 CLIO") && m4[1].text.includes("giulia@guide.it"), "Telegram: 🏛 CLIO col contatto");
await tocco("bozza:" + d4.id);
const v4 = JSON.stringify(claudeVisti.at(-1));
ok(v4.includes("invito personale") && v4.includes("Clio") && !v4.includes("giulia@") && !v4.includes("Verdi"), "la bozza sa di Clio e dell'invito, non vede nome né mail");

console.log("── la chat di sempre non cambia");
r = await post("/parla", { chi: "a1b2c3d4e5f60718", testo: "in cosa mi aiuteresti?", tuo: "Marco", profilo: { mestiere: "Ufficio" } });
const d3 = await r.json(); const rec3 = deb(repo.get(`bozze/${d3.id}.json`));
ok(r.status === 201 && !rec3.a && rec3.contesto === "dalla chat · Ufficio", "chat: niente mail, contesto «dalla chat · Ufficio»");
r = await post("/parla", { chi: "a1b2c3d4e5f60718", testo: "ciao", da_dove: "boh" });
ok(r.status === 201, "un da_dove sconosciuto diventa chat");
await tocco("bozza:" + d3.id);
ok(!JSON.stringify(claudeVisti.at(-1)).includes("Marco"), "neanche il nome della chat arriva a Claude");
console.log(err ? `\nROSSO: ${err}` : "\nVERDE");
process.exit(err ? 1 : 0);
