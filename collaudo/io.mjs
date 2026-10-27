// Ritrovarsi da qualsiasi telefono (19/10) — tutto finto.   node collaudo/io.mjs
// Controlla: col link firmato /io restituisce nome dell'assistente, mestiere, tema e nome; con la firma sbagliata 403,
// e il chi da solo non apre niente; chi non esiste 404. Controprova: la firma di un altro chi non vale per questo.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url)); const dir = mkdtempSync(join(tmpdir(), "io-"));
for (const [a, b] of [["worker.js", "worker.mjs"], ["preventivo.js", "preventivo.js"], ["google.js", "google.js"]]) copyFileSync(join(qui, "..", a), join(dir, b));
const W = await import(join(dir, "worker.mjs"));
let errori = 0; const ok = (c, m, d = "") => { console.log((c ? "  ✅ " : "  ❌ ") + m + (c ? "" : " " + JSON.stringify(d))); if (!c) errori++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const repo = { "utenti/jess123abc.json": { chi: "jess123abc", nome_assistente: "Atlas", mestiere: "Estetista", tema: "calm", tuo: "Jessica", vita: "lavoro" },
  "utenti/nonna123.json": { chi: "nonna123", nome_assistente: "Iris", vita: "pensione", tuo: "Rosa" },
  "utenti/strano123.json": { chi: "strano123", vita: "astronauta" } };
globalThis.fetch = async (url, o = {}) => { const u = new URL(String(url));
  if (u.host === "api.github.com") { const p = decodeURIComponent(u.pathname.split("/contents/")[1] || ""); return repo[p] ? new Response(JSON.stringify({ content: b64(repo[p]), sha: "s" })) : new Response("{}", { status: 404 }); }
  return new Response("{}", { status: 404 }); };
const env = { GH_TOKEN: "g", JJAVIS_SEGRETO: "segreto" };
const chiedi = async (q) => { const r = await W.default.fetch(new Request("https://jjavis-porta.19-jjardito93.workers.dev/io?" + q, { headers: { Origin: "https://jjoeboy93.github.io" } }), env, { waitUntil() {} }); return { s: r.status, d: await r.json().catch(() => ({})) }; };
const link = await W.linkPersonale(env, "jess123abc"); const k = new URL(link).searchParams.get("k");
ok(link.startsWith("https://jjoeboy93.github.io/JJA-VIS/?chi=jess123abc&k="), "il link porta alla pagina col chi e la firma", link);
let r = await chiedi(`chi=jess123abc&k=${k}`);
ok(r.s === 200 && r.d.io.nome === "Atlas" && r.d.io.mestiere === "Estetista" && r.d.io.tuo === "Jessica" && r.d.io.id === "jess123abc", "col link giusto: chi sei, il nome dell'assistente, il mestiere", r);
ok(r.d.io.vita === "lavoro", "e la vita (lavoro / pensione / studio / casa)", r);
r = await chiedi(`chi=nonna123&k=${await W.firmaChi(env, "nonna123")}`); ok(r.s === 200 && r.d.io.vita === "pensione" && r.d.io.mestiere === "", "chi è in pensione: la vita c'è, il mestiere è vuoto", r);
r = await chiedi(`chi=strano123&k=${await W.firmaChi(env, "strano123")}`); ok(r.s === 200 && r.d.io.vita === "", "una vita che non esiste non esce", r);
r = await chiedi(`chi=jess123abc&k=sbagliata`); ok(r.s === 403, "firma sbagliata: 403", r.s);
r = await chiedi(`chi=jess123abc`); ok(r.s === 403, "il chi da solo non apre niente", r.s);
const k2 = await W.firmaChi(env, "altro99999"); r = await chiedi(`chi=jess123abc&k=${k2}`); ok(r.s === 403, "controprova: la firma di un altro non vale", r.s);
r = await chiedi(`chi=nessuno999&k=${await W.firmaChi(env, "nessuno999")}`); ok(r.s === 404, "chi non esiste: 404", r.s);
console.log(errori ? `\n❌ ${errori} prove rosse` : "\n✅ tutto verde"); process.exit(errori ? 1 : 0);
