/**
 * Perché il mazzo più fedele ha dovuto prendere carte fuori tema (ticket 52).
 *
 * La frase accusava il tema di quel che aveva tolto **il tetto di spesa**, e per
 * farlo metteva nella stessa riga due popolazioni che non si confrontano: le
 * carte distinte le contava `valutaTema`, che il prezzo non lo guarda affatto, e
 * i posti li contava il pool già filtrato dal tetto. Su un tema «Goblin» con un
 * tetto da 20 € si leggeva «prende 10 carte dal pool, buone per 36 posti», e
 * quelle 10 carte bastavano per 40: la differenza era un Goblin che il prezzo
 * aveva escluso, e la frase non lo nominava.
 *
 * Qui i numeri arrivano già da una popolazione sola — le carte del tema che il
 * tetto **lascia comprare** — e quel che il tetto ha tolto si conta a parte e si
 * dice a parte. Sono due accuse diverse: «il tema non aveva abbastanza carte» e
 * «le carte c'erano, e non te le puoi permettere» mandano l'utente a cambiare
 * due cose diverse.
 *
 * Il tetto si nomina solo quando sul tema ha davvero pesato: a tetto spento, e a
 * tetto acceso che non ha tolto niente, incolparlo sarebbe falso quanto
 * incolpare il tema.
 */

/** Gli euro come si scrivono in una frase: due decimali e il simbolo. */
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** I numeri della frase, tutti contati sulle carte che il tetto lascia comprare. */
export interface ContoDelFuoriTema {
  /** Le carte distinte che il tema prende dal pool, comprabili. */
  readonly carte: number;
  /** I posti che quelle carte sanno riempire, contando le copie ammesse. */
  readonly capienza: number;
  /** I posti non-terra che il mazzo ha davvero da riempire. */
  readonly posti: number;
  /** Quante carte del tema costano da sole più del tetto. */
  readonly troppoCare: number;
  /** Quante carte del tema un listino non ce l'hanno in nessuna copia ammessa. */
  readonly senzaPrezzo: number;
  /** Il tetto di spesa, `null` quando è spento. */
  readonly tetto: number | null;
}

export function notaDelFuoriTema(conto: ContoDelFuoriTema): string {
  const { carte, capienza, posti, troppoCare, senzaPrezzo, tetto } = conto;

  const una = carte === 1;
  const corpo =
    `tema prende ${carte} ${una ? "carta" : "carte"} dal pool, ` +
    `${una ? "buona" : "buone"} per ${capienza} posti sui ${posti} da riempire: ` +
    `nemmeno il mazzo più fedele si è potuto finire senza carte fuori tema.`;

  const tolte = troppoCare + senzaPrezzo;
  if (tetto === null || tolte === 0) return `Il ${corpo}`;

  // Le due ragioni per cui il prezzo toglie una carta restano due, e le tiene
  // separate la stessa regola che le separa nel racconto del tetto di spesa
  // (`SpesaDellaRicerca`): alzare il tetto fa entrare quel che costa troppo, e
  // non farà mai entrare una carta di cui non si sa il prezzo. Chiamarle tutte
  // «lasciate fuori dal tetto» manderebbe l'utente ad alzare una cifra che per
  // metà di quelle carte non è mai stata la ragione.
  const pezzi: string[] = [];
  if (troppoCare > 0) {
    pezzi.push(
      troppoCare === 1
        ? `una carta del tema, che da sola costa più del tetto`
        : `${troppoCare} carte del tema, che da sole costano più del tetto`,
    );
  }
  if (senzaPrezzo > 0) {
    pezzi.push(
      senzaPrezzo === 1
        ? `una carta del tema, che un listino non ce l'ha in nessuna copia ammessa`
        : `${senzaPrezzo} carte del tema, che un listino non ce l'hanno in nessuna copia ammessa`,
    );
  }

  const chiusura =
    tolte === 1 ? `quel posto non l'ha tolto il tema.` : `quei posti non li ha tolti il tema.`;

  return `Dentro ${EURO.format(tetto)} il ${corpo} Restano fuori anche ${pezzi.join(", e ")}: ${chiusura}`;
}
