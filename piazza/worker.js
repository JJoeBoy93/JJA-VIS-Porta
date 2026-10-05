// La piazza di JJA-VIS: chi è in città vede gli altri.
//
// JJ, 5 ottobre 2026: «bisogna fare in modo che si possa entrare nella città
// insieme ad altri, serve un server».
//
// Un Durable Object solo («citta») tiene i WebSocket di chi è dentro. Passano
// l'aspetto dell'avatar (skin, vestito, colori: parole e numeri da un elenco),
// dove si cammina, il SOPRANNOME (mai il nome vero: JJ, 5/10) e i messaggi
// della chat della piazza, che è sua e non quella di Twitch (JJ, 5/10).
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
// «da solo, la piazza non risponde».
import { DurableObject } from "cloudflare:workers";
import { soprannome, messaggio } from "./filtro.js";

const ORIGINE = "https://jjoeboy93.github.io";
const MAX_DENTRO = 40;          // oltre, «la piazza è piena» (codice 4001)
const MAX_AL_SECONDO = 8;       // oltre, i messaggi di quel telefono si buttano
const MAX_MESSAGGIO = 1500;     // caratteri
const PAUSA_CHAT = 1500;        // ms fra due messaggi della stessa persona
const ZITTO_PER = 10 * 60 * 1000; // chi prova tre volte parole pesanti tace per dieci minuti
const STANZA = "citta";

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
    const stanza = () => env.PIAZZA.get(env.PIAZZA.idFromName(STANZA));
    if (u.pathname === "/entra") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("qui si entra solo con un WebSocket", { status: 426 });
      if (req.headers.get("Origin") !== ORIGINE) return new Response("origine non ammessa", { status: 403 });
      return stanza().fetch(req);
    }
    if (u.pathname === "/") {
      // si apre da un browser: dice se la piazza risponde e quanti sono dentro
      try {
        const d = await (await stanza().fetch("https://piazza/conta")).json();
        return Response.json({ piazza: "JJA-VIS", risponde: true, dentro: d.dentro, max: MAX_DENTRO },
          { headers: { "Access-Control-Allow-Origin": ORIGINE, "Cache-Control": "no-store" } });
      } catch (e) {
        return Response.json({ piazza: "JJA-VIS", risponde: false, errore: String(e && e.message || e) }, { status: 503 });
      }
    }
    return new Response("niente qui", { status: 404 });
  },
};

export class Piazza extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // il telefono dice «ping» ogni 30 s per tenere viva la linea: risponde Cloudflare, la piazza non si sveglia
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.freno = new Map();   // ws → [secondo, quanti]; si perde in letargo, e va bene così
  }

  dentro() { return this.ctx.getWebSockets().filter(w => w.readyState === 1); }

  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/conta") return Response.json({ dentro: this.dentro().length });
    const [client, server] = Object.values(new WebSocketPair());
    if (this.dentro().length >= MAX_DENTRO) {
      server.accept(); server.close(4001, "piena");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), a: null, p: null });
    return new Response(null, { status: 101, webSocket: client });
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
    if (m.t === "ciao") {
      const a = aspetto(m.a); if (!a) return;
      const n = soprannome(m.n);
      if (!n) { ws.send(JSON.stringify({ t: "no", perche: "soprannome" })); return; }   // senza un soprannome buono non si entra
      const primaVolta = !io.a;
      io.a = a; io.n = n; io.p = posto(m.p); ws.serializeAttachment(io);
      const altri = [];
      for (const w of this.dentro()) { if (w === ws) continue; const x = w.deserializeAttachment(); if (x && x.a) altri.push({ id: x.id, n: x.n, a: x.a, p: x.p }); }
      ws.send(JSON.stringify({ t: "tu", id: io.id, n, altri, max: MAX_DENTRO }));
      this.a_tutti(ws, primaVolta ? { t: "arriva", id: io.id, n, a, p: io.p } : { t: "aspetto", id: io.id, n, a });
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
      io.a = a; io.n = n; ws.serializeAttachment(io);
      this.a_tutti(ws, { t: "aspetto", id: io.id, n, a });
    } else if (m.t === "di") {
      // la chat della piazza: va a tutti, anche a chi l'ha scritto (così vede che è passato), e non si salva da nessuna parte
      const ora = Date.now();
      if (io.zitto && ora < io.zitto) { ws.send(JSON.stringify({ t: "no", perche: "zitto", fino: io.zitto })); return; }
      if (io.ultimoDi && ora - io.ultimoDi < PAUSA_CHAT) { ws.send(JSON.stringify({ t: "no", perche: "piano" })); return; }
      const r = messaggio(m.x);
      if (r.no) {
        if (r.no === "parole") { io.brutte = (io.brutte || 0) + 1; if (io.brutte >= 3) { io.zitto = ora + ZITTO_PER; io.brutte = 0; } ws.serializeAttachment(io); }
        ws.send(JSON.stringify({ t: "no", perche: r.no, fino: io.zitto || undefined })); return;
      }
      io.ultimoDi = ora; ws.serializeAttachment(io);
      const d = JSON.stringify({ t: "di", id: io.id, n: io.n, x: r.testo, ora });
      for (const w of this.dentro()) { try { w.send(d); } catch (_) {} }
    }
  }

  saluta(ws) {
    this.freno.delete(ws);
    const io = ws.deserializeAttachment();
    if (io && io.a) this.a_tutti(ws, { t: "va", id: io.id });
  }
  async webSocketClose(ws, code, reason) { this.saluta(ws); try { ws.close(code, reason); } catch (_) {} }
  async webSocketError(ws) { this.saluta(ws); }
}
