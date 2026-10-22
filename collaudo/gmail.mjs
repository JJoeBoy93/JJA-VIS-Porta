// Le mail partono dalla Gmail di JJA-VIS (22/10) — tutto finto.   node collaudo/gmail.mjs
// Vi: le mail finiscono nello spam (Brevo sostituisce il mittente @gmail.com con un indirizzo suo). Controlla: con GMAIL_URL la mail
// va allo script della Gmail con la chiave, destinatario, nome, oggetto, testo e allegati, e Brevo NON viene chiamato; se lo script
// dice no (quota finita) o non risponde, parte da Brevo (niente si perde); senza GMAIL_URL, Brevo come prima. E lo script vero
// (strumenti/posta.gs, doPost) rifiuta la chiave sbagliata e manda con quella giusta (Google finto).
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "gmail-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
let gmail = [], brevo = [], script = "ok";
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "script.google.com") { gmail.push(JSON.parse(o.body)); if (script === "giu") throw new Error("rete");
    return new Response(JSON.stringify(script === "ok" ? { ok: true, restano: 97 } : { ok: false, errore: "quota del giorno finita" })); }
  if (u.host === "api.brevo.com") { brevo.push(JSON.parse(o.body)); return new Response('{"messageId":"b"}', { status: 201 }); }
  return new Response("{}", { status: 404 }); };
const corpo = { sender: { name: "Arya · JJA-VIS", email: "jjavis@gmail.com" }, to: [{ email: "giada@prova.it", name: "Giada" }], subject: "Arya: cosa faccio per te da oggi",
  textContent: "Ciao Giada", attachment: [{ name: "atlas-2026-10-23-x.ics", content: "QkVHSU4=" }] };
const env = { TG_BOT_TOKEN: "t", GMAIL_URL: "https://script.google.com/macros/s/X/exec" };
let r = await W.postaFuori(env, { method: "POST", body: JSON.stringify(corpo) });
const g = gmail[0] || {};
ok(r.ok && gmail.length === 1 && !brevo.length, "con GMAIL_URL parte dalla Gmail, Brevo non viene chiamato", { gmail, brevo });
ok(g.chiave && g.chiave.length === 40 && g.a[0] === "giada@prova.it" && g.nome === "Arya · JJA-VIS" && g.oggetto === corpo.subject && g.testo === "Ciao Giada" && g.allegati[0].nome.endsWith(".ics"),
  "allo script: chiave, destinatario, nome, oggetto, testo, allegati", g);
script = "no"; gmail = []; brevo = [];
r = await W.postaFuori(env, { method: "POST", body: JSON.stringify(corpo) });
ok(r.ok && gmail.length === 1 && brevo.length === 1, "quota finita: parte da Brevo, niente si perde", { gmail, brevo });
script = "giu"; brevo = [];
r = await W.postaFuori(env, { method: "POST", body: JSON.stringify(corpo) }); ok(r.ok && brevo.length === 1, "script che non risponde: parte da Brevo");
brevo = []; gmail = [];
r = await W.postaFuori({ TG_BOT_TOKEN: "t" }, { method: "POST", body: JSON.stringify(corpo) }); ok(r.ok && brevo.length === 1 && !gmail.length, "senza GMAIL_URL: Brevo come prima");
// lo script vero, con Google finto
const mandate = []; let quota = 5;
const G = { MailApp: { getRemainingDailyQuota: () => quota }, GmailApp: { sendEmail: (a, o, t, op) => mandate.push({ a, o, t, op }) },
  Utilities: { base64Decode: (x) => [...Buffer.from(x, "base64")], newBlob: (b, tipo, nome) => ({ b, tipo, nome }) },
  ContentService: { createTextOutput: (t) => ({ t, setMimeType() { return JSON.parse(t); } }), MimeType: { JSON: "json" } } };
const gs = readFileSync(join(qui, "..", "strumenti", "posta.gs"), "utf8").replace('const CHIAVE = "METTI-QUI-LA-CHIAVE";', 'const CHIAVE = "k".repeat(40);');
const doPost = new Function(...Object.keys(G), gs + "\nreturn doPost;")(...Object.values(G));
const chiama = (d) => doPost({ postData: { contents: JSON.stringify(d) } });
let e = chiama({ chiave: "sbagliata", a: ["x@y.it"], oggetto: "o", testo: "t" });
ok(!e.ok && e.errore === "chiave" && !mandate.length, "lo script: chiave sbagliata → non manda niente", e);
e = chiama({ chiave: "k".repeat(40), a: ["giada@prova.it"], nome: "Arya · JJA-VIS", oggetto: "o", testo: "t", allegati: [{ nome: "a.ics", dati: "QkVHSU4=" }] });
ok(e.ok && mandate[0].a === "giada@prova.it" && mandate[0].op.name === "Arya · JJA-VIS" && mandate[0].op.attachments[0].tipo === "text/calendar", "lo script: chiave giusta → manda dalla Gmail, col nome e l'invito del calendario", { e, mandate });
quota = 0; e = chiama({ chiave: "k".repeat(40), a: ["giada@prova.it"], oggetto: "o", testo: "t" });
ok(!e.ok && /quota/.test(e.errore), "lo script: quota finita → lo dice, la porta passa a Brevo", e);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
