// La posta che parte da sola (11/10) — tutto finto.   node collaudo/uscita.mjs
// Controlla: una lettera in uscita/ parte senza aspettare JJ, ma solo con la fonte col consenso per quella mail; non a chi ha
// chiesto di essere cancellato; non due volte in 3 giorni; partita va in inviate/ e JJ lo sa; se Brevo non va, resta e si riprova.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "uscita-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = (await import(join(dir, "worker.mjs"))).default;
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const env = { GH_TOKEN: "g", TG_BOT_TOKEN: "bot", TG_CHAT: "42", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo, mandate, tgMsg, brevoRotto;
const nuovo = () => { repo = {}; mandate = []; tgMsg = []; brevoRotto = false; };
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (u.host === "api.telegram.org") { tgMsg.push(JSON.parse(o.body || "{}")); return j(200, { ok: true, result: {} }); }
  if (u.host === "api.brevo.com") { if (brevoRotto) return j(500, { message: "giù" }); mandate.push(JSON.parse(o.body)); return j(201, { messageId: "m" + mandate.length }); }
  if (u.host === "api.github.com") {
    const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""); const m = o.method || "GET";
    if (m === "GET") { if (repo[p]) return j(200, { content: b64(repo[p]), sha: "s" + p });
      const figli = Object.keys(repo).filter((k) => k.startsWith(p + "/")).map((k) => ({ name: k.slice(p.length + 1) }));
      return figli.length ? j(200, figli) : j(404, { message: "Not Found" }); }
    if (m === "PUT") { repo[p] = JSON.parse(Buffer.from(JSON.parse(o.body).content, "base64").toString()); return j(200, {}); }
    if (m === "DELETE") { delete repo[p]; return j(200, {}); }
  }
  return j(404, {});
};
const cron = () => W.scheduled({ cron: "7 * * * *" }, env, { waitUntil: (p) => attese.push(p) });
let attese = [];
const gira = async () => { attese = []; await cron(); await Promise.all(attese); };
const fonte = (mail, consenso = true) => ({ mail, consenso, nome: "Jessica" });
const lettera = (a, extra = {}) => ({ a, nome: "Jessica", oggetto: "Le tue scadenze", testo: "Ciao Jessica…", fonte: "risposte/x.json", scritta_da: "athena", ...extra });

console.log("── con il consenso: parte da sola");
nuovo(); repo["risposte/x.json"] = fonte("j@p.it"); repo["uscita/1.json"] = lettera("j@p.it"); await gira();
ok(mandate.length === 1 && mandate[0].to[0].email === "j@p.it" && /cancellami/.test(mandate[0].textContent), "è partita, col piede per cancellarsi");
ok(!repo["uscita/1.json"] && repo["inviate/1.json"] && repo["inviate/1.json"].inviata, "da uscita a inviate, con l'ora");
ok(tgMsg.some((m) => /📤 Partita a Jessica/.test(m.text)), "JJ lo sa da Telegram (non deve approvare)");

console.log("── senza consenso, o mail diversa: non parte");
nuovo(); repo["risposte/x.json"] = fonte("j@p.it", false); repo["uscita/1.json"] = lettera("j@p.it"); await gira();
ok(!mandate.length && repo["uscita/1.json"].errore_detto && tgMsg.some((m) => /NON è partita/.test(m.text)), "ferma, e lo dice una volta");
await gira(); ok(tgMsg.filter((m) => /NON è partita/.test(m.text)).length === 1, "al giro dopo non lo ripete");
nuovo(); repo["risposte/x.json"] = fonte("altra@p.it"); repo["uscita/1.json"] = lettera("j@p.it"); await gira();
ok(!mandate.length, "la mail della lettera deve essere quella della fonte");

console.log("── chi si è cancellato, e chi ha appena ricevuto");
nuovo(); repo["risposte/x.json"] = fonte("j@p.it"); repo["cancellati.json"] = ["J@p.it"]; repo["uscita/1.json"] = lettera("j@p.it"); await gira();
ok(!mandate.length && /non ricevere/.test(repo["uscita/1.json"].errore), "cancellato: non parte");
nuovo(); repo["risposte/x.json"] = fonte("j@p.it"); repo["inviate/0.json"] = lettera("j@p.it", { inviata: new Date(Date.now() - 864e5).toISOString() }); repo["uscita/1.json"] = lettera("j@p.it"); await gira();
ok(!mandate.length && /già scritto/.test(repo["uscita/1.json"].errore), "un giorno fa: aspetta (3 giorni)");

console.log("── Brevo giù: resta, e si riprova");
nuovo(); brevoRotto = true; repo["risposte/x.json"] = fonte("j@p.it"); repo["uscita/1.json"] = lettera("j@p.it"); await gira();
ok(repo["uscita/1.json"] && !repo["uscita/1.json"].errore_detto, "resta in uscita, senza fermarla");
brevoRotto = false; await gira(); ok(mandate.length === 1 && !repo["uscita/1.json"], "all'ora dopo parte");

console.log(errori ? `\n${errori} prove ROSSE` : "\nVERDE");
process.exit(errori ? 1 : 0);
