// Gli account di JJA-VIS (JJ, 5/10: «bisogna che ognuno abbia un suo account, e fondamentale il mio deve essere quello che
// può fare tutto senza gettoni, anche se li ho»; «accedi con Google è più comodo per tutti ... ma a me non resta niente,
// quindi come facciamo?»). Google fa da portiere: conferma chi è e ci passa numero, mail e nome. L'account vero sta qui,
// nel database di questo Durable Object (SQLite, account Cloudflare di JJA-VIS): soprannome, gettoni, skin.
//
// Regole di Google per il biglietto (documentazione letta il 5/10): firma con le chiavi pubbliche di Google, aud = il
// nostro ID client, iss = accounts.google.com, non scaduto; e la mail deve essere verificata.
import { DurableObject } from "cloudflare:workers";
import { soprannome as soprannomeOk } from "./filtro.js";

const CHIAVI_GOOGLE = "https://www.googleapis.com/oauth2/v3/certs";
const EMITTENTI = new Set(["accounts.google.com", "https://accounts.google.com"]);
const DURATA_SESSIONE = 180 * 24 * 3600 * 1000;   // sei mesi, poi si rientra
const MAX_PORTATI = 1000;                          // gettoni che un telefono può portare nell'account, una volta sola
const MAX_VINTI_COLPO = 100, MAX_VINTI_GIORNO = 1000, MAX_SPESA = 5000;

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const testo = u8 => new TextDecoder().decode(u8);
const esa = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const mailOk = v => { if (typeof v !== "string") return null; const m = v.trim().toLowerCase(); return m.length <= 120 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(m) ? m : null; };
const parola = v => (typeof v === "string" && /^[a-z0-9-]{1,24}$/.test(v)) ? v : null;

let chiaviInMemoria = null, chiaviFino = 0;
async function chiaviGoogle(env) {
  // solo nel collaudo: wrangler dev --var PROVA_JWK:… --var LOCALE:1. In produzione nessuna delle due esiste
  if (env.PROVA_JWK && env.LOCALE === "1") return { keys: [JSON.parse(env.PROVA_JWK)] };
  if (chiaviInMemoria && Date.now() < chiaviFino) return chiaviInMemoria;
  const r = await fetch(CHIAVI_GOOGLE);
  if (!r.ok) throw new Error("chiavi di Google: " + r.status);
  const m = /max-age=(\d+)/.exec(r.headers.get("Cache-Control") || "");
  chiaviInMemoria = await r.json(); chiaviFino = Date.now() + 1000 * (m ? Math.min(+m[1], 86400) : 3600);
  return chiaviInMemoria;
}

// il biglietto di Google: ritorna i dati se è buono, altrimenti {no: perché}
export async function verificaGoogle(token, env) {
  if (typeof token !== "string" || token.length > 4096) return { no: "biglietto" };
  const pezzi = token.split("."); if (pezzi.length !== 3) return { no: "biglietto" };
  let testa, dati;
  try { testa = JSON.parse(testo(b64url(pezzi[0]))); dati = JSON.parse(testo(b64url(pezzi[1]))); } catch (_) { return { no: "biglietto" }; }
  if (testa.alg !== "RS256") return { no: "biglietto" };
  const jwk = (await chiaviGoogle(env)).keys.find(k => k.kid === testa.kid);
  if (!jwk) return { no: "chiave" };
  const chiave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const buono = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", chiave, b64url(pezzi[2]), new TextEncoder().encode(pezzi[0] + "." + pezzi[1]));
  if (!buono) return { no: "firma" };
  if (dati.aud !== env.GOOGLE_CLIENT_ID) return { no: "aud" };
  if (!EMITTENTI.has(dati.iss)) return { no: "iss" };
  if (!(dati.exp * 1000 > Date.now())) return { no: "scaduto" };
  if (dati.email_verified !== true || typeof dati.email !== "string") return { no: "mail" };
  if (typeof dati.sub !== "string" || !dati.sub) return { no: "biglietto" };
  return { sub: dati.sub, mail: dati.email.toLowerCase(), nome: typeof dati.name === "string" ? dati.name.slice(0, 80) : "" };
}

export class Conti extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS conti(
      uid TEXT PRIMARY KEY, mail TEXT NOT NULL, nome TEXT, soprannome TEXT,
      gettoni INTEGER NOT NULL DEFAULT 100, skin TEXT NOT NULL DEFAULT '[]', portato INTEGER NOT NULL DEFAULT 0,
      giorno TEXT, vinti_oggi INTEGER NOT NULL DEFAULT 0, creato INTEGER NOT NULL, visto INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessioni(impronta TEXT PRIMARY KEY, uid TEXT NOT NULL, fino INTEGER NOT NULL)`);
    // 6/10, la classifica dei giochi (JJ: «il gioco dei gettoni non mostra la classifica a fine gioco»): il record di ognuno
    this.sql.exec(`CREATE TABLE IF NOT EXISTS record(uid TEXT NOT NULL, gioco TEXT NOT NULL, punti INTEGER NOT NULL, quando INTEGER NOT NULL, PRIMARY KEY(uid, gioco))`);
    // 6/10, entrare con la mail (JJ: «serve il metodo per chi non ha Google»): un codice di 6 cifre, valido 10 minuti, 5 tentativi
    this.sql.exec(`CREATE TABLE IF NOT EXISTS codici(mail TEXT PRIMARY KEY, impronta TEXT NOT NULL, fino INTEGER NOT NULL, tentativi INTEGER NOT NULL DEFAULT 0,
      ultimo INTEGER NOT NULL, giorno TEXT, mandati_oggi INTEGER NOT NULL DEFAULT 0)`);
    // 6/10, la moderazione: bloccato e zittito restano sull'account (una tabella già nata non prende colonne da CREATE: si aggiungono)
    const colonne = this.sql.exec("PRAGMA table_info(conti)").toArray().map(c => c.name);
    if (!colonne.includes("bloccato")) this.sql.exec("ALTER TABLE conti ADD COLUMN bloccato INTEGER NOT NULL DEFAULT 0");
    if (!colonne.includes("zitto_fino")) this.sql.exec("ALTER TABLE conti ADD COLUMN zitto_fino INTEGER NOT NULL DEFAULT 0");
  }
  admin(mail) { const a = (this.env.JJAVIS_ADMIN || "").trim().toLowerCase(); return !!a && mail === a; }
  mostra(c) {   // quello che il telefono vede del suo account
    return { soprannome: c.soprannome, nome: c.nome, mail: c.mail, gettoni: c.gettoni, skin: JSON.parse(c.skin), portato: !!c.portato, admin: this.admin(c.mail) };
  }
  classifica(gioco) {
    return this.sql.exec(`SELECT c.soprannome AS n, r.punti AS punti, r.quando AS quando FROM record r JOIN conti c ON c.uid = r.uid
      WHERE r.gioco = ? AND c.bloccato = 0 AND c.soprannome IS NOT NULL ORDER BY r.punti DESC, r.quando ASC LIMIT 10`, gioco).toArray();
  }
  perMail(mail) { return this.sql.exec("SELECT * FROM conti WHERE mail = ? ORDER BY creato ASC LIMIT 1", mail).toArray()[0] || null; }
  async sessione(uid) {
    const t = esa(crypto.getRandomValues(new Uint8Array(32)).buffer), ora = Date.now();
    this.sql.exec("DELETE FROM sessioni WHERE fino < ?", ora);
    this.sql.exec("INSERT INTO sessioni(impronta, uid, fino) VALUES (?, ?, ?)", await this.impronta(t), uid, ora + DURATA_SESSIONE);
    return t;
  }
  conto(uid) { return this.sql.exec("SELECT * FROM conti WHERE uid = ?", uid).toArray()[0] || null; }
  async impronta(t) { return esa(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))); }

  // le vie interne: le chiama solo il server della città, col suo stub. Dal mondo non si arriva (il worker passa solo /conto)
  async interno(via, corpo) {
    if (via === "/interno/chi") {   // chi c'è dietro questo token: per entrare in città con gli altri
      if (typeof corpo.token !== "string" || !/^[0-9a-f]{64}$/.test(corpo.token)) return risposta({ no: "account" }, 401);
      const s = this.sql.exec("SELECT * FROM sessioni WHERE impronta = ?", await this.impronta(corpo.token)).toArray()[0];
      const c = s && s.fino >= Date.now() ? this.conto(s.uid) : null;
      if (!c) return risposta({ no: "account" }, 401);
      return risposta({ uid: c.uid, admin: this.admin(c.mail), soprannome: c.soprannome, bloccato: !!c.bloccato, zitto_fino: c.zitto_fino });
    }
    if (via === "/interno/moderati") {   // chi è bloccato o zittito adesso: l'amministratore li vede e li può sbloccare (JJ, 6/10)
      const elenco = this.sql.exec("SELECT uid, soprannome, nome, bloccato, zitto_fino FROM conti WHERE bloccato = 1 OR zitto_fino > ? ORDER BY visto DESC LIMIT 50", Date.now()).toArray()
        .map(c => ({ uid: c.uid, soprannome: c.soprannome, nome: c.nome, bloccato: !!c.bloccato, zitto_fino: c.zitto_fino > Date.now() ? c.zitto_fino : 0 }));
      return risposta({ elenco });
    }
    const c = typeof corpo.uid === "string" ? this.conto(corpo.uid) : null;
    if (!c) return risposta({ no: "chi" }, 404);
    if (via === "/interno/soprannome") {
      const n = soprannomeOk(corpo.soprannome); if (!n) return risposta({ no: "soprannome" }, 400);
      this.sql.exec("UPDATE conti SET soprannome = ? WHERE uid = ?", n, c.uid); return risposta({ fatto: true, soprannome: n });
    }
    if (via === "/interno/modera") {   // lo chiede l'amministratore dalla città
      if (this.admin(c.mail)) return risposta({ no: "admin" }, 400);   // l'amministratore non si blocca da solo
      if (corpo.azione === "zittisci") { const fino = Date.now() + Math.max(1, Math.min(7 * 24 * 60, corpo.minuti | 0 || 60)) * 60000; this.sql.exec("UPDATE conti SET zitto_fino = ? WHERE uid = ?", fino, c.uid); return risposta({ fatto: true, fino }); }
      if (corpo.azione === "blocca") { this.sql.exec("UPDATE conti SET bloccato = 1 WHERE uid = ?", c.uid); this.sql.exec("DELETE FROM sessioni WHERE uid = ?", c.uid); return risposta({ fatto: true }); }
      if (corpo.azione === "sblocca") { this.sql.exec("UPDATE conti SET bloccato = 0, zitto_fino = 0 WHERE uid = ?", c.uid); return risposta({ fatto: true }); }
      return risposta({ no: "azione" }, 400);
    }
    return risposta({ no: "via" }, 404);
  }

  async fetch(req) {
    const u = new URL(req.url), via = u.pathname;
    if (via.startsWith("/interno/")) { let corpo = {}; try { corpo = await req.json(); } catch (_) {} return this.interno(via, corpo || {}); }
    let corpo = {};
    if (req.method === "POST") { try { corpo = await req.json(); } catch (_) { return risposta({ no: "corpo" }, 400); } if (!corpo || typeof corpo !== "object") corpo = {}; }

    // la classifica: la legge chiunque (soprannome e punti, niente altro); i bloccati non ci sono
    if (via === "/conto/classifica" && req.method === "GET") {
      const gioco = parola(u.searchParams.get("gioco")) || "acchiappa";
      return risposta({ gioco, classifica: this.classifica(gioco) });
    }
    if (via === "/conto/google" && req.method === "POST") {
      const g = await verificaGoogle(corpo.credential, this.env);
      if (g.no) return risposta({ no: "google", perche: g.no }, 401);
      const ora = Date.now();
      let uid = "g:" + g.sub, c = this.conto(uid);
      if (!c) { const stessa = this.perMail(g.mail); if (stessa) { uid = stessa.uid; c = stessa; } }   // una mail, un account: anche se è nato col codice
      if (!c) {
        if (corpo.eta14 !== true) return risposta({ no: "eta" }, 400);   // un account nuovo solo con «ho almeno 14 anni»
        this.sql.exec("INSERT INTO conti(uid, mail, nome, creato, visto) VALUES (?, ?, ?, ?, ?)", uid, g.mail, g.nome, ora, ora);
      } else {
        if (c.bloccato) return risposta({ no: "bloccato" }, 403);   // bloccato dall'amministratore: non rientra
        this.sql.exec("UPDATE conti SET mail = ?, nome = ?, visto = ? WHERE uid = ?", g.mail, g.nome, ora, uid);
      }
      return risposta({ token: await this.sessione(uid), conto: this.mostra(this.conto(uid)), nuovo: !c });
    }
    if (via === "/conto/mail/codice" && req.method === "POST") {   // manda il codice
      const mail = mailOk(corpo.mail); if (!mail) return risposta({ no: "mail" }, 400);
      const ora = Date.now(), oggi = new Date(ora).toISOString().slice(0, 10);
      const prima = this.sql.exec("SELECT * FROM codici WHERE mail = ?", mail).toArray()[0];
      if (prima && ora - prima.ultimo < 60000) return risposta({ no: "presto", fra: Math.ceil((60000 - (ora - prima.ultimo)) / 1000) }, 429);
      const mandati = prima && prima.giorno === oggi ? prima.mandati_oggi : 0;
      if (mandati >= 5) return risposta({ no: "troppi" }, 429);
      const esistente = this.perMail(mail); if (esistente && esistente.bloccato) return risposta({ no: "bloccato" }, 403);
      const codice = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      try {
        if (!this.env.BREVO_API_KEY || !this.env.MITTENTE) throw new Error("Brevo non configurato");
        const r = await fetch(`${this.env.BREVO_API || "https://api.brevo.com"}/v3/smtp/email`, { method: "POST",
          headers: { "api-key": this.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sender: { name: "JJA-VIS", email: this.env.MITTENTE }, to: [{ email: mail }], subject: `Il tuo codice JJA-VIS: ${codice}`,
            textContent: `Il tuo codice per entrare in JJA-VIS è ${codice}.\n\nVale 10 minuti. Se non l'hai chiesto tu, ignora questa mail: senza il codice nessuno entra.` }) });
        if (!r.ok) throw new Error("Brevo " + r.status);
      } catch (e) { return risposta({ no: "invio", errore: String(e.message || e) }, 502); }   // un guasto si dice: il codice non è partito
      this.sql.exec(`INSERT INTO codici(mail, impronta, fino, tentativi, ultimo, giorno, mandati_oggi) VALUES (?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT(mail) DO UPDATE SET impronta = excluded.impronta, fino = excluded.fino, tentativi = 0, ultimo = excluded.ultimo, giorno = excluded.giorno, mandati_oggi = excluded.mandati_oggi`,
        mail, await this.impronta(mail + ":" + codice), ora + 10 * 60000, ora, oggi, mandati + 1);
      return risposta({ fatto: true });
    }
    if (via === "/conto/mail/entra" && req.method === "POST") {   // il codice giusto apre l'account di quella mail (o lo crea)
      const mail = mailOk(corpo.mail), codice = typeof corpo.codice === "string" ? corpo.codice.replace(/\D/g, "") : "";
      if (!mail || codice.length !== 6) return risposta({ no: "codice" }, 400);
      const k = this.sql.exec("SELECT * FROM codici WHERE mail = ?", mail).toArray()[0], ora = Date.now();
      if (!k || k.fino < ora || k.tentativi >= 5) return risposta({ no: "scaduto" }, 401);
      if (await this.impronta(mail + ":" + codice) !== k.impronta) {
        this.sql.exec("UPDATE codici SET tentativi = tentativi + 1 WHERE mail = ?", mail);
        return risposta({ no: "codice", restano: 4 - k.tentativi }, 401);
      }
      let c = this.perMail(mail);
      if (c && c.bloccato) return risposta({ no: "bloccato" }, 403);
      if (!c && corpo.eta14 !== true) return risposta({ no: "eta" }, 400);   // il codice resta buono: si spunta la casella e si riprova
      this.sql.exec("DELETE FROM codici WHERE mail = ?", mail);
      const nuovo = !c;
      if (!c) { const uid = "m:" + (await this.impronta(mail)).slice(0, 24); this.sql.exec("INSERT INTO conti(uid, mail, nome, creato, visto) VALUES (?, ?, ?, ?, ?)", uid, mail, "", ora, ora); c = this.conto(uid); }
      else this.sql.exec("UPDATE conti SET visto = ? WHERE uid = ?", ora, c.uid);
      return risposta({ token: await this.sessione(c.uid), conto: this.mostra(this.conto(c.uid)), nuovo });
    }

    // da qui serve la sessione
    const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!/^[0-9a-f]{64}$/.test(t)) return risposta({ no: "sessione" }, 401);
    const imp = await this.impronta(t);
    const s = this.sql.exec("SELECT * FROM sessioni WHERE impronta = ?", imp).toArray()[0];
    if (!s || s.fino < Date.now()) return risposta({ no: "sessione" }, 401);
    let c = this.conto(s.uid);
    if (!c) return risposta({ no: "sessione" }, 401);
    const admin = this.admin(c.mail), uid = c.uid;
    const aggiorna = () => risposta({ conto: this.mostra(this.conto(uid)) });

    if (via === "/conto" && req.method === "GET") return aggiorna();
    if (req.method !== "POST") return risposta({ no: "via" }, 404);

    if (via === "/conto/porta") {   // la prima volta: gettoni e skin che il telefono aveva già
      if (c.portato) return aggiorna();
      const n = Number.isInteger(corpo.gettoni) ? Math.max(0, Math.min(MAX_PORTATI, corpo.gettoni)) : 0;
      const sk = new Set(JSON.parse(c.skin)); (Array.isArray(corpo.skin) ? corpo.skin : []).slice(0, 50).map(parola).filter(Boolean).forEach(x => sk.add(x));
      this.sql.exec("UPDATE conti SET gettoni = MAX(gettoni, ?), skin = ?, portato = 1 WHERE uid = ?", n, JSON.stringify([...sk]), uid);
      return aggiorna();
    }
    if (via === "/conto/spendi") {
      const n = corpo.n; if (!Number.isInteger(n) || n < 1 || n > MAX_SPESA) return risposta({ no: "quanto" }, 400);
      if (admin) return aggiorna();   // JJ: «può fare tutto senza gettoni, anche se li ho»
      // fra la lettura e la scrittura non c'è un await: il Durable Object fa una cosa alla volta, nessuno si infila
      if (c.gettoni < n) return risposta({ no: "pochi", conto: this.mostra(c) }, 409);
      this.sql.exec("UPDATE conti SET gettoni = gettoni - ? WHERE uid = ?", n, uid);
      return aggiorna();
    }
    if (via === "/conto/guadagna") {
      const n = corpo.n; if (!Number.isInteger(n) || n < 1 || n > MAX_VINTI_COLPO) return risposta({ no: "quanto" }, 400);
      const oggi = new Date().toISOString().slice(0, 10), gia = c.giorno === oggi ? c.vinti_oggi : 0, dai = Math.max(0, Math.min(n, MAX_VINTI_GIORNO - gia));
      this.sql.exec("UPDATE conti SET gettoni = gettoni + ?, giorno = ?, vinti_oggi = ? WHERE uid = ?", dai, oggi, gia + dai, uid);
      return risposta({ conto: this.mostra(this.conto(uid)), dati: dai });
    }
    if (via === "/conto/skin") {   // sbloccare una skin: paga qui, una volta; all'amministratore non costa
      const id = parola(corpo.id), prezzo = corpo.prezzo;
      if (!id || !Number.isInteger(prezzo) || prezzo < 0 || prezzo > MAX_SPESA) return risposta({ no: "skin" }, 400);
      const sk = JSON.parse(c.skin); if (sk.includes(id)) return aggiorna();
      sk.push(id);
      if (admin || prezzo === 0) { this.sql.exec("UPDATE conti SET skin = ? WHERE uid = ?", JSON.stringify(sk), uid); return aggiorna(); }
      if (c.gettoni < prezzo) return risposta({ no: "pochi", conto: this.mostra(c) }, 409);
      this.sql.exec("UPDATE conti SET gettoni = gettoni - ?, skin = ? WHERE uid = ?", prezzo, JSON.stringify(sk), uid);
      return aggiorna();
    }
    if (via === "/conto/partita") {   // a fine partita: il record resta se è più alto. Tetto: in 25 secondi oltre 200 non si fa
      const gioco = parola(corpo.gioco) || "acchiappa", punti = corpo.punti;
      if (!Number.isInteger(punti) || punti < 0 || punti > 200) return risposta({ no: "punti" }, 400);
      const prima = this.sql.exec("SELECT punti FROM record WHERE uid = ? AND gioco = ?", uid, gioco).toArray()[0];
      const nuovo = !prima || punti > prima.punti;
      if (nuovo) this.sql.exec("INSERT INTO record(uid, gioco, punti, quando) VALUES (?, ?, ?, ?) ON CONFLICT(uid, gioco) DO UPDATE SET punti = excluded.punti, quando = excluded.quando", uid, gioco, punti, Date.now());
      return risposta({ record: nuovo ? punti : prima.punti, nuovoRecord: nuovo && punti > 0, classifica: this.classifica(gioco) });
    }
    if (via === "/conto/soprannome") {
      const n = soprannomeOk(corpo.soprannome); if (!n) return risposta({ no: "soprannome" }, 400);
      this.sql.exec("UPDATE conti SET soprannome = ? WHERE uid = ?", n, uid); return aggiorna();
    }
    if (via === "/conto/esci") { this.sql.exec("DELETE FROM sessioni WHERE impronta = ?", imp); return risposta({ fatto: true }); }
    if (via === "/conto/elimina") {   // il diritto di cancellarsi: via l'account e tutte le sessioni, subito
      this.sql.exec("DELETE FROM sessioni WHERE uid = ?", uid); this.sql.exec("DELETE FROM record WHERE uid = ?", uid); this.sql.exec("DELETE FROM conti WHERE uid = ?", uid);
      return risposta({ fatto: true });
    }
    return risposta({ no: "via" }, 404);
  }
}

const ORIGINE = "https://jjoeboy93.github.io";
export const CORS = { "Access-Control-Allow-Origin": ORIGINE, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
export function risposta(d, stato = 200) { return Response.json(d, { status: stato, headers: { ...CORS, "Cache-Control": "no-store" } }); }
