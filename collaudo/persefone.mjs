// Persefone, l'esca (23/10) — tutto finto.   node collaudo/persefone.mjs
// JJ: «serve l'honeypot di Persefone». Controlla: le strade che un attaccante prova (/.env, /.git, /wp-login, /admin,
// config/secret/credentials) ricevono dati verosimili ma FALSI, stato 200 (non 403: bloccare direbbe «qui c'è qualcosa»);
// a JJ un avviso una volta per indirizzo al giorno; la stessa strada dà sempre lo stesso finto; le strade vere della porta NON
// sono esche e passano normali. Controprova: senza il gancio di Persefone, /.env non dà dati finti.
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "perse-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
let telegram = []; const kv = new Map();
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "api.telegram.org") { telegram.push(JSON.parse(o.body || "{}")); return new Response('{"ok":true,"result":{"message_id":1}}'); }
  if (u.host === "api.github.com") return new Response('{"permissions":{"push":true}}');
  return new Response("{}", { status: 404 }); };
const VISTI = { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); } };
const env = { TG_BOT_TOKEN: "t", TG_CHAT: "42", PERSEFONE_VISTI: VISTI, PERSEFONE_SALE: "prova", GH_TOKEN: "g" };
const chiama = (percorso, ip = "1.2.3.4") => W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev" + percorso, { headers: { "CF-Connecting-IP": ip } }), env, { waitUntil: (p) => p });
const t0 = Date.now();
let r = await chiama("/.env"); let corpo = await r.text();
ok(r.status === 200 && /DB_PASSWORD=/.test(corpo) && /SECRET_KEY=/.test(corpo), "/.env: dati finti, stato 200 (non 403)", corpo.slice(0, 60));
ok(Date.now() - t0 >= 1500, "la risposta è lenta di proposito (tiene fermo l'attaccante)");
r = await chiama("/.git/config"); ok(r.status === 200 && (await r.text()).length > 10, "/.git/config: esca");
r = await chiama("/wp-login.php"); corpo = await r.text(); ok(r.status === 200 && /Log In/.test(corpo) && /<form/.test(corpo), "/wp-login.php: una falsa pagina di accesso");
r = await chiama("/config.json"); corpo = await r.text(); ok(r.status === 200 && /aws_secret_access_key/.test(corpo), "/config.json: chiavi finte", corpo.slice(0, 50));
const a = await (await chiama("/.aws/credentials")).text(), b = await (await chiama("/.aws/credentials")).text();
ok(a === b, "la stessa strada dà sempre lo stesso finto (non si capisce che è generato)");
ok(telegram.length >= 1 && /Persefone/.test(telegram[0].text) && /\/\.env/.test(telegram[0].text) && /1\.2\.3\.4/.test(telegram[0].text), "a JJ: 🕸 con la strada e l'indirizzo", telegram[0] && telegram[0].text);
const prima = telegram.length; await chiama("/admin"); await chiama("/phpmyadmin/");
ok(telegram.length === prima, "stesso indirizzo nello stesso giorno: un solo avviso");
await chiama("/.env", "9.9.9.9");
ok(telegram.length === prima + 1, "un indirizzo nuovo: un nuovo avviso");
// le strade vere della porta non sono esche
import("node:assert");
const { ESCHE } = W;
for (const p of ["/parla", "/assistente", "/nato", "/ares", "/posta", "/telegram", "/conoscenza", "/risposte", "/stato"])
  ok(!ESCHE.some((rx) => rx.test(p)), `la strada vera ${p} non è un'esca`);
// controprova: il testo di /.env proviene da Persefone, non da una vera pagina della porta
ok(readFileSync(join(qui, "..", "worker.js"), "utf8").includes("const trappola = persefone("), "Persefone è agganciata all'ingresso della porta");
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
