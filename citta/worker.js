// Il server della città di JJA-VIS: chi è in città vede gli altri e ci scrive.
// JJ, 5/10: «non è una piazza... è la città» (la piazza vera è quella tonda dell'albero).
//
// JJ, 5 ottobre 2026: «bisogna fare in modo che si possa entrare nella città
// insieme ad altri, serve un server».
//
// Un Durable Object solo («citta») tiene i WebSocket di chi è dentro. Passano
// l'aspetto dell'avatar (skin, vestito, colori: parole e numeri da un elenco),
// dove si cammina, il SOPRANNOME (mai il nome vero: JJ, 5/10) e i messaggi
// della chat della città, che è sua e non quella di Twitch (JJ, 5/10).
// Soprannomi e messaggi passano dal filtro (filtro.js): niente parole pesanti,
// niente link, niente numeri di telefono. Niente si scrive su disco: i messaggi
// arrivano a chi c'è in quel momento e basta; quando esci, di te non resta niente.
//
// Account Cloudflare di JJA-VIS, non quello di Hermes e Clio (JJ, 5/10: «se
// mettiamo troppe cose insieme poi usano tutti gli stessi contatori»).
// Piano gratuito di Cloudflare: 100.000 richieste al giorno per i Durable
// Objects, e ogni 20 messaggi in arrivo valgono una richiesta. Il telefono
// manda al massimo 4 posizioni al secondo e solo quando si muove. Se il
// gratuito finisce, Cloudflare rifiuta: la città resta in piedi e dice
// «da solo · il collegamento non risponde».
import { DurableObject } from "cloudflare:workers";
import { soprannome, messaggio } from "./filtro.js";
import { Conti, CORS, risposta } from "./conti.js";
export { Conti };

const ORIGINE = "https://jjoeboy93.github.io";
const MAX_DENTRO = 40;          // oltre, «la città è piena» (codice 4001)
const MAX_AL_SECONDO = 8;       // oltre, i messaggi di quel telefono si buttano
const MAX_MESSAGGIO = 1500;     // caratteri
const PAUSA_CHAT = 1500;        // ms fra due messaggi della stessa persona
const ZITTO_PER = 10 * 60 * 1000; // chi prova tre volte parole pesanti tace per dieci minuti
const STANZA = "citta";
// 9/10, JJ: «quando uno entra per vederlo devo andare da solo e poi ritornare». L'appello: il telefono chiede l'elenco ogni 20 s
// e si corregge da solo; i fantasmi (nessun messaggio e nessun ping da un minuto e mezzo) si chiudono
const ASSENTE_DOPO = 90 * 1000;
// il «segnala» (JJ, 6/10: «fai anche il segnala e arriva a me all'inizio, poi più avanti quando cresciamo ... potrei prendere
// dello staff»). Arriva su Telegram (il bot di JJA-VIS, chat SEGNALAZIONI_CHAT: oggi JJ, domani un gruppo dello staff) e come
// mail alla casella di JJA-VIS (MITTENTE, via Brevo), che resta come archivio.
const MOTIVI = { insulti: "insulti o offese", molestie: "molestie", sessuale: "contenuti sessuali", odio: "odio o discriminazione", spam: "spam o pubblicità", minore: "riguarda un minore", altro: "altro" };
const MAX_SEGNALAZIONI = 3, FINESTRA_SEGNALAZIONI = 10 * 60 * 1000, FRASI_TENUTE = 4;

// moderare da Telegram (piano del 9/10, punto 7): sotto la segnalazione ci sono i tasti; li riceve la porta (è lei il webhook
// del bot) e li gira qui su /modera-tg. Le due parti si riconoscono con una firma HMAC del corpo fatta col token del bot, che
// hanno tutte e due: nessun segreto nuovo da mettere
export async function firma(chiave, testo) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(chiave || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(testo)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
const parola = v => (typeof v === "string" && /^[a-z0-9-]{1,24}$/.test(v)) ? v : null;
const intero = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max) ? v : null;
const numero = (v, lim) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim) ? Math.round(v * 100) / 100 : null;

// l'aspetto: solo campi conosciuti, solo valori di forma conosciuta
export function aspetto(a) {
  if (!a || typeof a !== "object") return null;
  return {
    skin: parola(a.skin) || "classica",
    vestito: parola(a.vestito) || "altro",
    corpo: a.corpo === "donna" ? "donna" : "uomo",
    pelle: intero(a.pelle, 0, 9) ?? 1,
    capelli: parola(a.capelli) || "corti",
    capelliColore: intero(a.capelliColore, 0, 19) ?? 0,
    colore: intero(a.colore, 0, 0xffffff),
    pantaloni: intero(a.pantaloni, 0, 0xffffff),
  };
}
// dove sei: x, z, giro (r), altezza (y: panchina, terrazza), seduto (s=2), stanza (l: "" = in città)
export function posto(p) {
  if (!p || typeof p !== "object") return null;
  const x = numero(p.x, 500), z = numero(p.z, 500);
  if (x === null || z === null) return null;
  return { x, z, r: numero(p.r, 10) ?? 0, y: numero(p.y, 200) ?? 0, s: p.s === 2 ? 2 : 0, l: (p.l === "" || p.l == null) ? "" : (parola(p.l) || "") };
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const stanza = () => env.CITTA.get(env.CITTA.idFromName(STANZA));
    // gli account (JJ, 5/10): accedi con Google, gettoni e skin nel server. Un Durable Object solo, «conti», col suo database
    if (u.pathname === "/conto" || u.pathname.startsWith("/conto/")) {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      try { return await env.CONTI.get(env.CONTI.idFromName("conti")).fetch(req); }
      catch (e) { return risposta({ no: "server", errore: String(e && e.message || e) }, 503); }
    }
    if (u.pathname === "/modera-tg" && req.method === "POST") {
      const corpo = await req.text();
      if (!env.TG_BOT_TOKEN || req.headers.get("X-Firma") !== await firma(env.TG_BOT_TOKEN, corpo)) return new Response("firma", { status: 403 });
      try { return await stanza().fetch(new Request("https://citta/modera-tg", { method: "POST", body: corpo })); }
      catch (e) { return Response.json({ ok: false, perche: "server", errore: String(e && e.message || e) }, { status: 503 }); }
    }
    if (u.pathname === "/entra") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("qui si entra solo con un WebSocket", { status: 426 });
      if (req.headers.get("Origin") !== ORIGINE) return new Response("origine non ammessa", { status: 403 });
      return stanza().fetch(req);
    }
    if (u.pathname === "/") {
      // si apre da un browser: dice se il server risponde e quanti sono in città
      try {
        const d = await (await stanza().fetch("https://citta/conta")).json();
        return Response.json({ citta: "JJA-VIS", risponde: true, dentro: d.dentro, max: MAX_DENTRO, chi: d.chi },
          { headers: { "Access-Control-Allow-Origin": ORIGINE, "Cache-Control": "no-store" } });
      } catch (e) {
        return Response.json({ citta: "JJA-VIS", risponde: false, errore: String(e && e.message || e) }, { status: 503 });
      }
    }
    return new Response("niente qui", { status: 404 });
  },
};

export class Citta extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // il telefono dice «ping» ogni 30 s per tenere viva la linea: risponde Cloudflare, il server non si sveglia
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.freno = new Map();   // ws → [secondo, quanti]; si perde in letargo, e va bene così
  }

  dentro() { return this.ctx.getWebSockets().filter(w => w.readyState === 1); }

  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/conta") {   // la pagina di controllo: chi risulta collegato, e da quanto non si fa sentire (solo soprannomi)
      const ora = Date.now();
      return Response.json({ dentro: this.dentro().length, chi: this.dentro().map(w => { const a = w.deserializeAttachment() || {};
        return { n: a.n || "(senza saluto)", silenzio_s: Math.round((ora - this.ultimo(w, a)) / 1000) }; }) });
    }
    if (u.pathname === "/modera-tg") {
      let m = {}; try { m = await req.json(); } catch (_) {}
      return Response.json(await this.moderaConto(m));
    }
    const [client, server] = Object.values(new WebSocketPair());
    if (this.dentro().length >= MAX_DENTRO) {
      server.accept(); server.close(4001, "piena");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), a: null, p: null, visto: Date.now() });
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 60000);   // il giro dei fantasmi
    return new Response(null, { status: 101, webSocket: client });
  }

  ultimo(w, a) {   // l'ultima volta che quel telefono si è fatto sentire: un messaggio, o il «ping» (risposto da Cloudflare anche nel sonno)
    let t = (a && a.visto) || 0;
    try { const p = this.ctx.getWebSocketAutoResponseTimestamp(w); if (p) t = Math.max(t, +p); } catch (_) {}
    return t;
  }
  pulisci() {
    const ora = Date.now(), limite = (+this.env.ASSENTE_SECONDI || 0) * 1000 || ASSENTE_DOPO;
    for (const w of this.dentro()) { const a = w.deserializeAttachment() || {};
      if (ora - this.ultimo(w, a) > limite) { try { w.close(4000, "assente"); } catch (_) {} if (a.a) this.a_tutti(w, { t: "va", id: a.id }); } }
  }
  async alarm() { this.pulisci(); if (this.dentro().length) await this.ctx.storage.setAlarm(Date.now() + 60000); }
  elenco(ws) {
    const altri = [];
    for (const w of this.dentro()) { if (w === ws) continue; const x = w.deserializeAttachment(); if (x && x.a) altri.push({ id: x.id, n: x.n, a: x.a, p: x.p, re: !!x.admin }); }
    return altri;
  }
  a_tutti(da, msg) {
    const s = JSON.stringify(msg);
    for (const w of this.dentro()) if (w !== da) { try { w.send(s); } catch (_) {} }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGGIO) return;
    const ora = Math.floor(Date.now() / 1000), f = this.freno.get(ws);
    if (f && f[0] === ora) { if (++f[1] > MAX_AL_SECONDO) return; } else this.freno.set(ws, [ora, 1]);
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    if (!m || typeof m !== "object") return;
    const io = ws.deserializeAttachment() || {};
    io.visto = Date.now();
    if (m.t === "elenco") {   // l'appello
      if (!io.a) return; ws.serializeAttachment(io); this.pulisci();
      ws.send(JSON.stringify({ t: "elenco", altri: this.elenco(ws) })); return;
    }
    if (m.t === "ciao") {
      const a = aspetto(m.a); if (!a) return;
      // JJ, 6/10: «niente account, niente altri». Il token dell'account dice chi c'è dietro il soprannome
      const chi = await this.chi(m.tok);
      if (!chi) { ws.send(JSON.stringify({ t: "no", perche: "account" })); return; }
      if (chi.bloccato) { ws.send(JSON.stringify({ t: "no", perche: "bloccato" })); try { ws.close(4003, "bloccato"); } catch (_) {} return; }
      // il soprannome: quello che il telefono propone, se è buono, diventa quello dell'account; se no vale quello dell'account
      let n = soprannome(m.n);
      if (n && n !== chi.soprannome) await this.contiInterno("/interno/soprannome", { uid: chi.uid, soprannome: n });
      if (!n) n = soprannome(chi.soprannome || "");
      if (!n) { ws.send(JSON.stringify({ t: "no", perche: "soprannome" })); return; }   // senza un soprannome buono non si entra
      const primaVolta = !io.a;
      io.a = a; io.n = n; io.p = posto(m.p); io.uid = chi.uid; io.admin = !!chi.admin;
      if (chi.zitto_fino > Date.now()) io.zitto = chi.zitto_fino;   // zittito resta zittito anche se rientra
      ws.serializeAttachment(io);
      this.pulisci();
      ws.send(JSON.stringify({ t: "tu", id: io.id, n, altri: this.elenco(ws), max: MAX_DENTRO, re: io.admin }));
      this.a_tutti(ws, primaVolta ? { t: "arriva", id: io.id, n, a, p: io.p, re: io.admin } : { t: "aspetto", id: io.id, n, a, re: io.admin });
      return;
    }
    if (!io.a) return;   // prima si saluta
    if (m.t === "qui") {
      const p = posto(m.p); if (!p) return;
      io.p = p; ws.serializeAttachment(io);
      this.a_tutti(ws, { t: "qui", id: io.id, p });
    } else if (m.t === "aspetto") {
      const a = aspetto(m.a); if (!a) return;
      const n = m.n === undefined ? io.n : soprannome(m.n);
      if (!n) { ws.send(JSON.stringify({ t: "no", perche: "soprannome" })); return; }
      if (n !== io.n && io.uid) await this.contiInterno("/interno/soprannome", { uid: io.uid, soprannome: n });
      io.a = a; io.n = n; ws.serializeAttachment(io);
      this.a_tutti(ws, { t: "aspetto", id: io.id, n, a });
    } else if (m.t === "moderati") {   // l'elenco di chi è bloccato o zittito: solo per l'amministratore
      if (!io.admin) { ws.send(JSON.stringify({ t: "moderati", ok: false, perche: "admin" })); return; }
      const r = await this.contiInterno("/interno/moderati", {});
      ws.send(JSON.stringify({ t: "moderati", ok: !!r.elenco, elenco: r.elenco || [] }));
    } else if (m.t === "modera") {
      await this.modera(ws, io, m);
    } else if (m.t === "segnala") {
      await this.segnala(ws, io, m);
    } else if (m.t === "di") {
      // la chat della città: va a tutti, anche a chi l'ha scritto (così vede che è passato), e non si salva da nessuna parte
      const ora = Date.now();
      if (io.zitto && ora < io.zitto) { ws.send(JSON.stringify({ t: "no", perche: "zitto", fino: io.zitto })); return; }
      if (io.ultimoDi && ora - io.ultimoDi < PAUSA_CHAT) { ws.send(JSON.stringify({ t: "no", perche: "piano" })); return; }
      const r = messaggio(m.x);
      if (r.no) {
        if (r.no === "parole") { io.brutte = (io.brutte || 0) + 1; if (io.brutte >= 3) { io.zitto = ora + ZITTO_PER; io.brutte = 0; } ws.serializeAttachment(io); }
        ws.send(JSON.stringify({ t: "no", perche: r.no, fino: io.zitto || undefined })); return;
      }
      io.ultimoDi = ora; io.frasi = [...(io.frasi || []), { x: r.testo, ora }].slice(-FRASI_TENUTE); ws.serializeAttachment(io);
      const d = JSON.stringify({ t: "di", id: io.id, n: io.n, x: r.testo, ora });
      for (const w of this.dentro()) { try { w.send(d); } catch (_) {} }
    }
  }

  async contiInterno(via, corpo) {
    try { const r = await this.env.CONTI.get(this.env.CONTI.idFromName("conti")).fetch("https://interno" + via, { method: "POST", body: JSON.stringify(corpo) }); return { stato: r.status, ...(await r.json()) }; }
    catch (e) { return { stato: 503, no: "conti", errore: String(e && e.message || e) }; }
  }
  async chi(tok) {
    if (typeof tok !== "string" || !/^[0-9a-f]{64}$/.test(tok)) return null;
    const r = await this.contiInterno("/interno/chi", { token: tok });
    return r.uid ? r : null;
  }
  // l'amministratore (JJ) dalla città: zittisci, blocca, sblocca. Resta sull'account, non sul collegamento
  async modera(ws, io, m) {
    const rispondi = d => { try { ws.send(JSON.stringify({ t: "moderato", ...d })); } catch (_) {} };
    if (!io.admin) return rispondi({ ok: false, perche: "admin" });
    if (!["zittisci", "blocca", "sblocca"].includes(m.azione)) return rispondi({ ok: false, perche: "azione" });
    // sbloccare: chi è bloccato non è in città, quindi si sblocca per account (uid, dall'elenco), non per collegamento
    if (m.azione === "sblocca") {
      if (typeof m.uid !== "string") return rispondi({ ok: false, perche: "chi" });
      const r = await this.contiInterno("/interno/modera", { uid: m.uid, azione: "sblocca" });
      if (r.fatto) for (const x of this.dentro()) { const a = x.deserializeAttachment(); if (a && a.uid === m.uid && a.zitto) { a.zitto = 0; x.serializeAttachment(a); } }
      return rispondi(r.fatto ? { ok: true, azione: "sblocca", n: m.n || "" } : { ok: false, perche: r.no || "conti" });
    }
    if (typeof m.id !== "string") return rispondi({ ok: false, perche: "azione" });
    let w = null, lui = null;
    for (const x of this.dentro()) { const a = x.deserializeAttachment(); if (a && a.id === m.id) { w = x; lui = a; break; } }
    if (!lui || !lui.uid) return rispondi({ ok: false, perche: "chi" });
    const r = await this.contiInterno("/interno/modera", { uid: lui.uid, azione: m.azione, minuti: m.minuti });
    if (!r.fatto) return rispondi({ ok: false, perche: r.no || "conti" });
    if (m.azione === "zittisci") { lui.zitto = r.fino; w.serializeAttachment(lui); try { w.send(JSON.stringify({ t: "no", perche: "zitto", fino: r.fino })); } catch (_) {} }
    if (m.azione === "blocca") { try { w.send(JSON.stringify({ t: "no", perche: "bloccato" })); w.close(4003, "bloccato"); } catch (_) {} this.a_tutti(w, { t: "va", id: lui.id }); }
    rispondi({ ok: true, azione: m.azione, n: lui.n, fino: r.fino });
  }

  // da Telegram: zittisci o blocca per account (uid), anche se in quel momento non è in città
  async moderaConto(m) {
    if (!m || typeof m.uid !== "string" || !["zittisci", "blocca"].includes(m.azione)) return { ok: false, perche: "azione" };
    const r = await this.contiInterno("/interno/modera", { uid: m.uid, azione: m.azione, minuti: m.minuti });
    if (!r.fatto) return { ok: false, perche: r.no || "conti" };
    let n = null, dentro = 0;
    for (const w of this.dentro()) { const a = w.deserializeAttachment(); if (!a || a.uid !== m.uid) continue; n = a.n; dentro++;
      if (m.azione === "zittisci") { a.zitto = r.fino; w.serializeAttachment(a); try { w.send(JSON.stringify({ t: "no", perche: "zitto", fino: r.fino })); } catch (_) {} }
      if (m.azione === "blocca") { try { w.send(JSON.stringify({ t: "no", perche: "bloccato" })); w.close(4003, "bloccato"); } catch (_) {} this.a_tutti(w, { t: "va", id: a.id }); } }
    return { ok: true, azione: m.azione, n, fino: r.fino, dentro: dentro > 0 };
  }

  async segnala(ws, io, m) {
    const rispondi = d => { try { ws.send(JSON.stringify({ t: "segnalato", ...d })); } catch (_) {} };
    const ora = Date.now();
    const motivo = typeof m.motivo === "string" && MOTIVI[m.motivo] ? m.motivo : null;
    if (!motivo || typeof m.id !== "string" || m.id === io.id) return rispondi({ ok: false, perche: "motivo" });
    io.segnalate = (io.segnalate || []).filter(t => ora - t < FINESTRA_SEGNALAZIONI);
    if (io.segnalate.length >= MAX_SEGNALAZIONI) return rispondi({ ok: false, perche: "troppe" });
    let lui = null;
    for (const w of this.dentro()) { const x = w.deserializeAttachment(); if (x && x.id === m.id) { lui = x; break; } }
    const pulisci = t => String(t).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    const nota = typeof m.nota === "string" ? pulisci(m.nota) : "";
    const viste = Array.isArray(m.visti) ? m.visti.slice(-5).filter(v => typeof v === "string").map(v => pulisci(v).slice(0, 200)) : [];
    const quando = t => new Date(t).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
    const righe = [
      `⚑ Segnalazione dalla città di JJA-VIS — ${MOTIVI[motivo]}`, "",
      `Segnalato: «${lui ? lui.n : "(non è più in città)"}» (id ${m.id})${lui && lui.a ? ", skin " + lui.a.skin : ""}`,
      `Da: «${io.n}» (id ${io.id})`,
      nota ? `Nota di chi segnala: ${nota}` : "Nessuna nota.", "",
      lui && lui.frasi && lui.frasi.length ? "Le sue ultime frasi, prese dal server:\n" + lui.frasi.map(f => `  ${quando(f.ora)}  ${f.x}`).join("\n") : "Il server non ha sue frasi recenti.",
      viste.length ? "\nQuelle che chi segnala dice di aver visto:\n" + viste.map(v => "  " + v).join("\n") : "",
      "", `${new Date(ora).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · in città ${this.dentro().length} persone`,
    ].join("\n").trim();
    const fatto = [], errori = [];
    try {
      if (!this.env.TG_BOT_TOKEN || !this.env.SEGNALAZIONI_CHAT) throw new Error("Telegram non configurato");
      const r = await fetch(`${this.env.TG_API || "https://api.telegram.org"}/bot${this.env.TG_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: this.env.SEGNALAZIONI_CHAT, text: righe.slice(0, 4000),
          ...(lui && lui.uid ? { reply_markup: { inline_keyboard: [   // si modera da qui (la porta riceve i tasti): per account, non per collegamento
            [{ text: "🔇 Zittisci 1 ora", callback_data: `cz:60:${lui.uid}`.slice(0, 64) }, { text: "🔇 1 giorno", callback_data: `cz:1440:${lui.uid}`.slice(0, 64) }],
            [{ text: "⛔ Blocca", callback_data: `cb:0:${lui.uid}`.slice(0, 64) }]] } } : {}) }) });
      const d = await r.json().catch(() => ({})); if (!d.ok) throw new Error("Telegram: " + (d.description || r.status));
      fatto.push("telegram");
    } catch (e) { errori.push(String(e.message || e)); }
    try {
      if (!this.env.BREVO_API_KEY || !this.env.MITTENTE) throw new Error("Brevo non configurato");
      const r = await fetch(`${this.env.BREVO_API || "https://api.brevo.com"}/v3/smtp/email`, {
        method: "POST", headers: { "api-key": this.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: "JJA-VIS · segnalazioni", email: this.env.MITTENTE }, to: [{ email: this.env.MITTENTE, name: "JJA-VIS" }],
          subject: `Segnalazione: ${MOTIVI[motivo]} — «${lui ? lui.n : m.id}»`, textContent: righe }) });
      if (!r.ok) throw new Error("Brevo " + r.status);
      fatto.push("mail");
    } catch (e) { errori.push(String(e.message || e)); }
    if (!fatto.length) return rispondi({ ok: false, perche: "invio", errori });   // un guasto si dice: chi segnala sa che non è arrivata
    io.segnalate.push(ora); ws.serializeAttachment(io);
    rispondi({ ok: true, fatto });
  }

  saluta(ws) {
    this.freno.delete(ws);
    const io = ws.deserializeAttachment();
    if (io && io.a) this.a_tutti(ws, { t: "va", id: io.id });
  }
  async webSocketClose(ws, code, reason) { this.saluta(ws); try { ws.close(code, reason); } catch (_) {} }
  async webSocketError(ws) { this.saluta(ws); }
}
