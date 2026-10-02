// Nova risponde subito — tutto finto.   node collaudo/nova.mjs
// Nato il 2 ottobre 2026 (Athena). JJ: «non deve usare né questi limiti né
// quelli di Jarvis… bisogna farla bene per tante varianti, e che portano al
// secondo fine del servizio bottega». Controlla: la chiamata va all'account
// di JJA-VIS col suo token; schema e niente ragionamento; la risposta torna
// alla pagina con l'azione per la Bottega e resta per quando torna; JJ la
// vede su Telegram; quello che Nova passa resta in attesa; spenta, senza
// chiavi o con Workers AI giù si torna a prima, e JJ sa perché; /nova.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = resolve(process.argv[2] || join(qui, "..", "worker.js"));
const copia = join(mkdtempSync(join(tmpdir(), "nova-")), "worker.mjs");
copyFileSync(sorgente, copia);
for (const f of ["preventivo.js", "google.js"]) copyFileSync(join(dirname(sorgente), f), join(dirname(copia), f));
const W = await import(copia);
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const repo = new Map(), tg = [], ai = [];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const de = (s) => JSON.parse(Buffer.from(s, "base64").toString());
let aiRisposta = { risposta: "Posso prepararti uno strumento web che ti fa le domande per le interrogazioni.", servizio: "commissione", tipo: "Strumento web", bozza: "Uno strumento per preparare le interrogazioni", passa_a_jj: false };
let aiStato = 200;
globalThis.fetch = async (url, o = {}) => {
  url = String(url); const m = o.method || "GET";
  const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://api.cloudflare.com/client/v4/accounts/")) {
    ai.push({ url, auth: (o.headers || {}).Authorization, corpo: JSON.parse(o.body) });
    if (aiStato !== 200) return J({ success: false, errors: [{ message: "limite giornaliero" }] }, aiStato);
    return J({ success: true, result: { choices: [{ message: { content: JSON.stringify(aiRisposta) } }] } });
  }
  if (url.includes("api.github.com")) {
    const p = decodeURIComponent((url.split("/contents/")[1] || "").split("?")[0]);
    if (m === "GET") { if (repo.has(p)) return J({ content: repo.get(p), sha: "s" });
      const dir = [...repo.keys()].filter((k) => k.startsWith(p + "/")); if (dir.length) return J(dir.map((k) => ({ name: k.split("/").pop() })));
      return J({ message: "Not Found" }, 404); }
    if (m === "PUT") { repo.set(p, JSON.parse(o.body).content); return J({ content: { sha: "x" } }, 201); }
  }
  if (url.includes("api.telegram.org")) { tg.push(JSON.parse(o.body || "{}")); return J({ ok: true, result: { message_id: 7, message_thread_id: 3 } }); }
  return J({}, 404);
};
const env = { GH_TOKEN: "t", TG_BOT_TOKEN: "bot", TG_CHAT: "42", CF_AI_ACCOUNT: "acc-jjavis", CF_AI_TOKEN: "tok-jjavis" };
const ORIGINE = "https://jjoeboy93.github.io";
const parla = async (testo, extra = {}) => {
  const r = await W.default.fetch(new Request("https://porta/parla", { method: "POST", headers: { Origin: ORIGINE },
    body: JSON.stringify({ chi: "abcdef0123456789", testo, da_dove: "chat", tuo: "Giovanni", nome_assistente: "Nova", profilo: { mestiere: "Insegnante", tempo: "Altro lavoro ripetitivo" }, ...extra }) }), env, { waitUntil() {} });
  return { stato: r.status, d: await r.json() };
};
const ultimoTg = () => tg.map((x) => x.text || "").filter(Boolean).pop() || "";

console.log("── spenta: come prima");
let r = await parla("Sono un insegnante e perdo tempo con le interrogazioni");
ok(r.stato === 201 && !r.d.subito && ai.length === 0, "senza /nova acceso non chiama nessun modello");

console.log("── accesa");
repo.set("nova.json", b64({ acceso: true }));
r = await parla("Sono un insegnante e perdo tempo con le interrogazioni");
ok(ai.length === 1 && ai[0].url.includes("/accounts/acc-jjavis/ai/run/@cf/google/gemma-4-26b-a4b-it") && ai[0].auth === "Bearer tok-jjavis", "la chiamata va all'account di JJA-VIS, col suo token");
const c = ai[0].corpo;
ok(c.response_format.type === "json_schema" && c.chat_template_kwargs.enable_thinking === false && c.max_completion_tokens <= 600, "schema, niente ragionamento, risposta corta (neuroni)");
ok(c.messages[0].content.includes("BOTTEGA") && c.messages[0].content.includes("insegnante") && c.messages[1].content.includes("Lavoro: Insegnante"), "sa della Bottega e del lavoro di chi scrive");
ok(!JSON.stringify(c).includes("Giovanni"), "il nome di chi scrive non va al modello");
ok(r.d.subito && r.d.subito.testo.includes("interrogazioni") && r.d.subito.azione.servizio === "commissione" && r.d.subito.azione.tipo === "Strumento web", "la pagina riceve subito la risposta e l'azione per la Bottega");
const salvata = [...repo.keys()].find((k) => k.startsWith("per-pagina/abcdef0123456789/") && k.endsWith("-n.json"));
ok(salvata && de(repo.get(salvata)).auto === true, "la risposta resta per quando torna (per-pagina, «-n»)");
ok(ultimoTg().includes("🤖 Nova ha già risposto") && ultimoTg().includes("Bottega: commissione"), "JJ su Telegram vede cosa ha risposto Nova");

console.log("── Nova passa a JJ");
aiRisposta = { risposta: "Per il prezzo ti risponde chi mi costruisce, qui.", servizio: "commissione", tipo: "Sito o pagina web", bozza: "Un sito", passa_a_jj: true };
r = await parla("Quanto costa un sito?");
ok(r.d.subito && r.d.subito.passa === true && ultimoTg().includes("e lo passa a te"), "risponde, e dice a JJ che tocca a lui");

console.log("── Workers AI giù o senza chiavi");
aiStato = 429; tg.length = 0;
r = await parla("Ciao");
ok(r.stato === 201 && !r.d.subito && ultimoTg().includes("Nova non ha risposto") && ultimoTg().includes("limite giornaliero"), "niente risposta finta: la domanda va a JJ, e JJ sa perché");
aiStato = 200;
const senza = { ...env }; delete senza.CF_AI_TOKEN;
const r2 = await W.default.fetch(new Request("https://porta/parla", { method: "POST", headers: { Origin: ORIGINE },
  body: JSON.stringify({ chi: "abcdef0123456789", testo: "ciao", da_dove: "chat" }) }), senza, { waitUntil() {} });
ok(r2.status === 201 && !(await r2.json()).subito, "senza le chiavi di JJA-VIS: come prima, nessuna chiamata");

console.log("── solo la chat");
ai.length = 0;
await parla("una proposta", { da_dove: "sondaggio" });
ok(ai.length === 0, "le proposte del sondaggio restano a JJ");

console.log("── risposte strane del modello");
aiRisposta = { risposta: "NESSUNA RISPOSTA: spam", servizio: "nessuno", tipo: "", bozza: "", passa_a_jj: false };
r = await parla("compra crypto qui");
ok(!r.d.subito, "«NESSUNA RISPOSTA»: niente bolla sulla pagina");
aiRisposta = { risposta: "Ok", servizio: "inventato", tipo: "boh", bozza: "", passa_a_jj: false };
r = await parla("ciao");
ok(r.d.subito && r.d.subito.azione === null, "servizio inventato dal modello: niente pulsante sbagliato");

console.log("── la pagina chiede se è accesa");
repo.set("nova.json", b64({ acceso: true }));
let st = await (await W.default.fetch(new Request("https://porta/nova", { headers: { Origin: ORIGINE } }), env, { waitUntil() {} })).json();
ok(st.acceso === true, "GET /nova: accesa");
st = await (await W.default.fetch(new Request("https://porta/nova", { headers: { Origin: ORIGINE } }), senza, { waitUntil() {} })).json();
ok(st.acceso === false, "senza le chiavi: spenta, anche se il file dice acceso");

console.log("── /nova dal bot");
const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.TG_BOT_TOKEN));
const segreto = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
const bot = (text) => W.default.fetch(new Request("https://porta/telegram", { method: "POST",
  headers: { "X-Telegram-Bot-Api-Secret-Token": segreto, "content-type": "application/json" }, body: JSON.stringify({ message: { chat: { id: 42 }, from: { id: 42 }, text } }) }), env, { waitUntil() {} });
tg.length = 0; ai.length = 0;
aiRisposta = { risposta: "Risposta di prova", servizio: "nessuno", tipo: "", bozza: "", passa_a_jj: false };
await bot("/nova prova");
ok(ai.length === 12 && tg.filter((x) => (x.text || "").includes("❓")).length >= 4, "/nova prova: 12 domande di prova, i risultati a JJ");
await bot("/nova spento");
ok(de(repo.get("nova.json")).acceso === false, "/nova spento la spegne");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
