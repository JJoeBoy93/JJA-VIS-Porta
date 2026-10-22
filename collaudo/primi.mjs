// Chi non ha ricevuto niente (22/10) — tutto finto.   node collaudo/primi.mjs
// JJ: «e per chi non ha ricevuto nulla? Questa è mia madre, la persona per la quale è stata creata Clio». Controlla: fuori dalle
// 9–20 niente; il giro chiede a JJ UNA persona per volta (account, nessun messaggio, nessuna proposta), una volta sola, nel suo
// argomento, con «🤝 Proponi» / «🗑 No»; il tocco manda la prima proposta (chat + mail) e alla guida propone Clio con i voti, e a
// JJ arriva «👉 Per te». Controprove: chi ha già parlato non viene chiesto; «🗑 No» non chiama il modello e non scrive.
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url"; import { createHash } from "node:crypto";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "primi-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64"); const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
let repo = {}, risposta = "", richieste = [], telegram = [], mail = [];
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "api.anthropic.com") { richieste.push(JSON.parse(o.body)); return new Response(JSON.stringify({ content: [{ type: "text", text: risposta }], model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 10 } })); }
  if (u.host === "api.telegram.org") { telegram.push(JSON.parse(o.body || "{}")); return new Response('{"ok":true,"result":{"message_id":1}}'); }
  if (u.host === "api.brevo.com") { mail.push(JSON.parse(o.body)); return new Response('{"messageId":"x"}', { status: 201 }); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (p === "utenti") return new Response(JSON.stringify(Object.keys(repo).filter((k) => k.startsWith("utenti/")).map((k) => ({ name: k.slice(7) }))));
    if (!repo[p]) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", ANTHROPIC_API_KEY: "k", TG_CHAT: "1", TG_GRUPPO: "-100", TG_BOT_TOKEN: "t", BREVO_API_KEY: "b", MITTENTE: "jjavis@prova.it" };
const SEG = createHash("sha256").update("t").digest("hex").slice(0, 32);
const tocca = (data) => W.default.fetch(new Request("https://porta/telegram", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": SEG },
  body: JSON.stringify({ callback_query: { id: "q", from: { id: 1 }, data, message: { message_id: 1, chat: { id: -100 }, message_thread_id: 268 } } }) }), env, { waitUntil() {} });
const MIRNA = "7bc5bb18e42c34bf";
repo["atlas.json"] = b64({ "jessica@prova.it": { nome: "Jessica", turni: [{ chi: "lei", testo: "ciao" }], impegni: [] }, "papa@prova.it": { nome: "Paolo", turni: [], impegni: [], assistente: "Popo" },
  "mirna@prova.it": { nome: "Mirna", turni: [], impegni: [], chi: MIRNA, assistente: "Gordi" } });
repo[`utenti/${MIRNA}.json`] = b64({ chi: MIRNA, mail: "mirna@prova.it", tuo: "Mirna", nome_assistente: "Gordi", thread: 268, ha_risposto: true, mestiere: "Guida turistica",
  tempo: "Ripetere lo stesso tour in più lingue", voti: ["Una pagina per farti trovare dalle agenzie"] });
ok(await W.giroPrimi(env, new Date("2026-10-22T20:30:00Z")) === null && !telegram.length, "fuori dalle 9–20 niente");
let chi1 = await W.giroPrimi(env, new Date("2026-10-22T08:30:00Z"));
ok(chi1 === "mirna@prova.it" && telegram.length === 1 && telegram[0].message_thread_id === 268 && /Non ha ancora ricevuto niente: Mirna/.test(telegram[0].text) && /Guida turistica/.test(telegram[0].text),
  "il giro chiede a JJ una persona, nel suo argomento, con quello che si sa", telegram);
const k = telegram[0].reply_markup.inline_keyboard[0][0].callback_data.split(":")[1];
ok(!JSON.stringify(telegram).includes("jessica@"), "controprova: chi ha già parlato non viene chiesto");
let chi2 = await W.giroPrimi(env, new Date("2026-10-22T09:30:00Z"));
ok(chi2 === "papa@prova.it", "un giro, una persona: al giro dopo la successiva", chi2);
ok(await W.giroPrimi(env, new Date("2026-10-22T10:30:00Z")) === null, "una volta sola: poi non chiede più");
risposta = '{"risposta":"Ciao Mirna, sono Gordi. Per i tuoi tour c\'è Clio: parli una volta e ognuno legge nella sua lingua. La pagina per le agenzie l\'ho passata a chi mi costruisce.","nuovi":[],"per_jj":"invito a Clio"}';
telegram = []; mail = [];
await tocca(`primo:${k}`);
const q = richieste[0] && richieste[0].messages[0].content;
ok(q && q.includes("[PRIMA VOLTA]") && q.includes("Clio") && q.includes("Una pagina per farti trovare dalle agenzie"), "al modello: la prima volta, Clio per la guida, i suoi voti", q && q.slice(0, 300));
ok(mail.some((x) => x.to[0].email === "mirna@prova.it" && /cosa faccio per te da oggi/.test(x.subject)) && repo[`per-pagina/${MIRNA}/primo-${k}.json`], "🤝 Proponi: la proposta va per mail e nella chat della pagina", mail);
ok(telegram.some((t) => /👉 Per te: invito a Clio/.test(t.text || "")) && telegram.some((t) => /^prima proposta mandata \(chat \+ mail\)/.test(t.text || "")), "a JJ: la proposta, «👉 Per te: invito a Clio» e l'esito", telegram.map((t) => t.text));
ok(leggi("atlas.json")["mirna@prova.it"].primo && leggi("atlas.json")["mirna@prova.it"].turni.length === 1, "nel filo: f.primo e la sua risposta");
const k2 = createHash("sha256").update("papa@prova.it").digest("hex").slice(0, 10); richieste = []; mail = [];
await tocca(`primono:${k2}`);
ok(!richieste.length && !mail.length && leggi("atlas.json")["papa@prova.it"].primo === "no", "controprova: «🗑 No» non chiama il modello e non scrive", leggi("atlas.json")["papa@prova.it"]);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
