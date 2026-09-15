/**
 * **Il ripensamento**: un ingresso della richiesta che cambia mentre il motore
 * lavora.
 *
 * `App` butta il mazzo costruito appena la richiesta cambia, e se il motore sta
 * ancora cercando ferma anche la ricerca: sta rispondendo a una domanda che non
 * le è più stata fatta. Che si fermi è giusto; che lo facesse **in silenzio** no
 * — «Sto costruendo…» tornava «Costruisci il mazzo», l'avanzamento spariva, e
 * chi guardava non sapeva se aveva finito, se era andata male o se era stato lui
 * (ticket 46).
 *
 * Qui stanno le due metà della frase che lo dice: quale parte della domanda è
 * cambiata, e come dirlo. Non è un guasto — nessuno ha sbagliato niente — e la
 * frase racconta una cosa successa, senza chiedere niente a nessuno.
 *
 * Non sta in `spiegazioni/frasi.ts` perché non spiega una decisione dell'app né
 * porta un numero: è una riga di stato del motore, come «Preparo le carte…».
 *
 * «Cambiati» non vuol dire «l'hai cambiato tu»: gli orologi di cortesia possono
 * arrivare tardi, a ricerca partita, e anche quello è un cambio vero della
 * domanda. La frase dice che cosa è cambiato, non chi.
 */

/** Le parti della richiesta che, cambiando, buttano il mazzo. */
export type IngressoDellaRichiesta = "tema" | "combo" | "tetto" | "orologi";

/**
 * Gli ingressi così come l'effetto di `App` li guarda: gli stessi valori che
 * stanno nella sua lista di dipendenze, con gli orologi già ridotti alla loro
 * impronta della corsa.
 */
export type IngressiDellaRichiesta = {
  tema: unknown;
  combo: unknown;
  tettoDiSpesa: unknown;
  corsa: unknown;
};

const QUALE: ReadonlyArray<readonly [keyof IngressiDellaRichiesta, IngressoDellaRichiesta]> = [
  ["tema", "tema"],
  ["combo", "combo"],
  ["tettoDiSpesa", "tetto"],
  ["corsa", "orologi"],
];

/**
 * Quali ingressi non sono più quelli di prima, nell'ordine in cui la richiesta
 * li elenca.
 *
 * Il confronto è per **identità**, come quello con cui l'effetto decide di
 * scattare: se fosse più fine, un effetto scattato potrebbe non trovare niente
 * da nominare — e allora la frase ripiega sulla richiesta intera, invece di
 * indovinare.
 */
export function ingressiCambiati(
  prima: IngressiDellaRichiesta,
  adesso: IngressiDellaRichiesta,
): IngressoDellaRichiesta[] {
  return QUALE.filter(([chiave]) => !Object.is(prima[chiave], adesso[chiave])).map(
    ([, ingresso]) => ingresso,
  );
}

/**
 * Come si chiama ogni ingresso sulla schermata. Gli orologi sono «i mazzi che
 * incontri», come li chiama il pannello «Chi incontri» dove li si scrive.
 */
const NOME: Record<IngressoDellaRichiesta, { nome: string; accordo: string }> = {
  tema: { nome: "il tema", accordo: "è cambiato" },
  combo: { nome: "la combo", accordo: "è cambiata" },
  tetto: { nome: "il tetto di spesa", accordo: "è cambiato" },
  orologi: { nome: "i mazzi che incontri", accordo: "sono cambiati" },
};

/** «La ricerca si è fermata: il tema è cambiato mentre lavorava.» */
export function fraseDellaRicercaFermata(cambiati: readonly IngressoDellaRichiesta[]): string {
  return `La ricerca si è fermata: ${soggettoEVerbo(cambiati)} mentre lavorava.`;
}

function soggettoEVerbo(cambiati: readonly IngressoDellaRichiesta[]): string {
  const [solo] = cambiati;
  if (solo === undefined) return "la richiesta è cambiata";
  if (cambiati.length === 1) return `${NOME[solo].nome} ${NOME[solo].accordo}`;
  const nomi = cambiati.map((ingresso) => NOME[ingresso].nome);
  const elenco = `${nomi.slice(0, -1).join(", ")} e ${nomi.at(-1)}`;
  // Due o più ingressi insieme ne contano sempre uno maschile — la combo è la
  // sola femminile — e il plurale va al maschile.
  return `${elenco} sono cambiati`;
}
