// Il listino delle skin (JJ, 11/10: «chiudi assolutamente il buco dell'acquisto gratis, non ci devono essere modi se non
// usando gettoni»). Il prezzo lo decide questo file, non il telefono: prima il server prendeva per buono il prezzo che gli
// mandava la città, e chi sapeva come fare comprava una skin da 2000 gettoni pagandola zero. Una skin che non è qui non si
// compra e non si indossa con gli altri. Deve dire gli stessi prezzi della città (JJA-VIS/citta.html, SKIN): lo controlla
// JJA-VIS/collaudo/conto.py, che legge questo file.
const DEI = ["zeus", "hera", "athena", "ares", "poseidone", "apollo", "artemide", "efesto", "afrodite", "hestia", "demetra", "hermes", "ade", "persefone", "dioniso"];
export const LISTINO = Object.freeze({
  "base": 0, "classica": 0,
  "avventuriera": 1500, "cavaliere": 2000,
  ...Object.fromEntries(DEI.map(d => ["dio-" + d, 2000])),   // gli dèi dell'Olimpo (JJ, 11/10: «a 2000 gettoni, come le skin super fighe di Fortnite»)
});
export const prezzoDi = id => (typeof id === "string" && Object.prototype.hasOwnProperty.call(LISTINO, id)) ? LISTINO[id] : null;
export const GRATIS = Object.freeze(Object.keys(LISTINO).filter(k => LISTINO[k] === 0));
