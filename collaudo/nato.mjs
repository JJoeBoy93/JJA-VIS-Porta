// Nasce un assistente (22/10) — tutto finto.   node collaudo/nato.mjs
// JJ: «dopo che uno entra ha già fatto la registrazione, ha scelto nome e tema, qui deve arrivare a telegram che c'è un nuovo
// assistente e un nuovo user». Controlla: senza account 401; con l'account nasce utenti/<chi>.json con la mail, il suo argomento
// nel gruppo e 🆕 a JJ; l'assistente per mail sa nome e chi; una volta sola. Controprove: il codice di un'altra persona → 403;
// Telegram che cade → nato non segnato (riprova la volta dopo).
import { copyFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "nato-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
let repo = {}, telegram = [], tgGiu = false;
const leggi = (p) => JSON.parse(Buffer.from(repo[p], "base64").toString());
const sessioni = { ["a".repeat(64)]: "giada@prova.it", ["b".repeat(64)]: "altro@prova.it" };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "jjavis-citta.jjavis.workers.dev") { const m = sessioni[((o.headers || {}).Authorization || "").slice(7)]; return m ? new Response(JSON.stringify({ conto: { mail: m } })) : new Response("{}", { status: 401 }); }
  if (u.host === "api.telegram.org") { const c = JSON.parse(o.body || "{}"); if (u.pathname.endsWith("/createForumTopic")) return new Response('{"ok":true,"result":{"message_thread_id":279}}');
    if (tgGiu) return new Response('{"ok":false,"description":"giù"}'); telegram.push(c); return new Response('{"ok":true,"result":{"message_id":1}}'); }
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""), m = o.method || "GET";
    if (m === "PUT") { repo[p] = JSON.parse(o.body).content; return new Response("{}"); }
    if (!repo[p]) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(JSON.stringify({ content: repo[p], sha: "s" })); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", TG_CHAT: "1", TG_GRUPPO: "-100", TG_BOT_TOKEN: "t" };
const chiama = async (tok, corpo) => W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/nato", { method: "POST",
  headers: { Origin: "https://jjoeboy93.github.io", "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(corpo) }), env, { waitUntil() {} });
const CHI = "4b675b9f2df739ec", IO = { chi: CHI, nome_assistente: "Arya", tema: "calmo", tuo: "Giada" };
let r = await chiama("", IO); ok(r.status === 401, "senza account: no", r.status);
tgGiu = true; r = await chiama("a".repeat(64), IO);
ok(r.status === 201 && repo[`utenti/${CHI}.json`] && !leggi(`utenti/${CHI}.json`).nato, "Telegram giù: l'utente nasce lo stesso, ma nato non è segnato", repo[`utenti/${CHI}.json`] && leggi(`utenti/${CHI}.json`));
tgGiu = false; telegram = [];
r = await chiama("a".repeat(64), IO);
const u = leggi(`utenti/${CHI}.json`);
ok(r.status === 201 && u.mail === "giada@prova.it" && u.thread === 279 && u.nome_assistente === "Arya" && u.nato, "nasce utenti/<chi>.json con la mail, l'argomento e nato", u);
ok(telegram.length === 1 && telegram[0].message_thread_id === 279 && /🆕 Nuovo assistente, nuova persona\nArya · Giada · tema calmo/.test(telegram[0].text), "a JJ, nel suo argomento: 🆕 nuovo assistente e nuova persona", telegram);
const A = leggi("atlas.json")["giada@prova.it"];
ok(A && A.assistente === "Arya" && A.nome === "Giada" && A.chi === CHI, "l'assistente per mail sa nome, nome suo e chi", A);
telegram = []; r = await chiama("a".repeat(64), IO);
ok(r.status === 200 && telegram.length === 0, "una volta sola", telegram);
r = await chiama("b".repeat(64), IO);
ok(r.status === 403 && leggi(`utenti/${CHI}.json`).mail === "giada@prova.it", "controprova: il codice di un'altra persona non si prende", r.status);
// chi esisteva già (argomento nato col sondaggio, prima del 22/10): niente 🆕, si segna e basta
repo["utenti/1111222233334444.json"] = b64({ chi: "1111222233334444", mail: "jessica@prova.it", thread: 12, nome_assistente: "Atlas" });
sessioni["c".repeat(64)] = "jessica@prova.it"; telegram = [];
r = await chiama("c".repeat(64), { chi: "1111222233334444", nome_assistente: "Atlas", tema: "tech", tuo: "Jessica" });
ok(r.status === 200 && !telegram.some((t) => /🆕/.test(t.text || "")) && leggi("utenti/1111222233334444.json").nato, "chi esisteva già: niente 🆕, nato segnato", telegram);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
