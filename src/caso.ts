/**
 * Il caso, con il seme in mano a chi chiama.
 *
 * `CLAUDE.md` chiede un comportamento deterministico e verificabile, e la
 * simulazione delle partite (ticket 09) è il punto in cui il caso entra
 * nell'app. Perché il vincolo regga, il caso qui non è mai quello di sistema:
 * niente `Math.random`, niente orologio, niente `crypto`. **Il seme arriva da
 * fuori** e fa parte della richiesta, così la stessa richiesta dà lo stesso
 * risultato sempre — sul telefono di oggi come su quello di chi la rifà fra un
 * anno.
 *
 * Il generatore è *mulberry32*: trentadue bit di stato, una manciata di
 * operazioni intere, nessuna dipendenza. Non è crittografico e non deve
 * esserlo — qui serve solo a mescolare un mazzo.
 */

export type Caso = {
  /** Un numero in `[0, 1)`. */
  frazione(): number;
  /** Un intero in `[0, limite)`. `limite` deve essere positivo. */
  intero(limite: number): number;
};

/**
 * Il generatore dato il seme. Due generatori con lo stesso seme danno la stessa
 * sequenza, e non condividono niente fra loro.
 */
export function caso(seme: number): Caso {
  // Il seme si controlla invece di piegarlo. `seme >>> 0` da solo schiaccerebbe
  // in silenzio `NaN`, i decimali e i negativi sullo stesso stato di un altro
  // seme: la ricerca a scambi singoli (ticket 11) chiamerà la simulazione una
  // volta per scambio con semi calcolati, e due ricerche che si credono
  // indipendenti finirebbero sulla stessa identica sequenza restando
  // «deterministiche». Un errore qui è molto meglio di un numero che sembra a
  // posto.
  if (!Number.isInteger(seme) || seme < 0 || seme > 0xffffffff) {
    throw new Error("Il seme dev'essere un intero fra 0 e 2^32 − 1.");
  }
  let stato = seme >>> 0;

  const frazione = (): number => {
    stato = (stato + 0x6d2b79f5) | 0;
    let t = Math.imul(stato ^ (stato >>> 15), 1 | stato);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    frazione,
    // Il taglio dei bit alti introduce una distorsione minuscola quando il
    // limite non divide 2^32. È dichiarata e accettata: qui il limite è al più
    // la dimensione di un mazzo, e la distorsione sta molto sotto il rumore
    // delle poche centinaia di partite che si simulano.
    intero(limite) {
      if (limite <= 0) throw new Error("Il limite di `intero` dev'essere positivo.");
      return Math.min(limite - 1, Math.floor(frazione() * limite));
    },
  };
}

/**
 * Mescola una copia della lista — Fisher-Yates, dal fondo verso l'inizio.
 *
 * Non tocca la lista di partenza: il mazzo dell'utente resta com'è, e ogni
 * partita simulata parte dalla stessa lista mescolata in modo diverso.
 */
export function mescola<T>(carte: readonly T[], generatore: Caso): T[] {
  const mescolate = [...carte];
  for (let i = mescolate.length - 1; i > 0; i--) {
    const j = generatore.intero(i + 1);
    const scambio = mescolate[i]!;
    mescolate[i] = mescolate[j]!;
    mescolate[j] = scambio;
  }
  return mescolate;
}
