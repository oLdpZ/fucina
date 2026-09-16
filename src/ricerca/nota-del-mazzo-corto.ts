/**
 * Il no di un mazzo che la ricerca non è riuscita a finire (ticket 64).
 *
 * La frase aggiungeva sempre, col tetto acceso, «Nessun mazzo sta dentro X €, e
 * sopra il tetto chiesto non se ne consegna nessuno: il meno caro che la ricerca
 * ha guardato ne costava Y». Ma per contare un mazzo corto la ricerca deve
 * averne **consegnato** uno, e `cerca` consegna solo quel che è passato da
 * `dentroIlTetto`: arrivare qui dimostra che dentro il tetto un mazzo ci stava.
 * La frase affermava il contrario di quel che la sua stessa esistenza prova, e
 * mandava ad alzare una cifra che non era il vincolo che mordeva — quel che
 * manca sono le carte, o le terre, per finire il mazzo.
 *
 * È un ramo **latente**: `costruisci.ts` lo chiama «la rete all'uscita», e oggi
 * non si raggiunge da nessuna strada nota. `riempi` riempie i posti anche quando
 * i soldi sono finiti — «il portafoglio governa quali carte entrano, mai quante»
 * — e `scegliTerre` è scritta per non restituire mai meno terre di quante ne ha
 * promesse. Perciò la frase si prova qui, da sola: una rete che nessuno può far
 * scattare è anche una rete che nessun test a cucitura può guardare.
 */

/** Gli euro come si scrivono in una frase: due decimali e il simbolo. */
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** I numeri del no: quante copie sono uscite, quante ne chiede un mazzo. */
export interface ContoDelMazzoCorto {
  /** Le copie del mazzo più lungo che la ricerca ha prodotto e scartato. */
  readonly copie: number;
  /** Le copie che un mazzo intero chiede. */
  readonly dimensione: number;
  /** Il tetto di spesa, `null` quando è spento. */
  readonly tetto: number | null;
  /**
   * Quanti passi della frontiera il tetto ha lasciato senza mazzo.
   *
   * È la metà che distingue le due frasi qui sotto: un passo che non consegna
   * niente l'ha perso per il tetto, e quei passi potevano essere mazzi
   * **interi**. Dove ce n'è anche uno solo, dire «non è il tetto ad averlo
   * fermato» toglie di mano all'utente l'unica leva che gli consegnerebbe un
   * mazzo.
   */
  readonly passiSenzaMazzo: number;
}

export function notaDelMazzoCorto(conto: ContoDelMazzoCorto): string {
  const { copie, dimensione, tetto, passiSenzaMazzo } = conto;

  const corpo =
    `Con queste carte la ricerca arriva a ${copie} ${copie === 1 ? "copia" : "copie"} ` +
    `su ${dimensione}, e un mazzo corto non si consegna: mancano le carte — o le terre — ` +
    `per finirlo.`;

  if (tetto === null) return corpo;

  // Il caso misto: questo mazzo dentro il tetto ci stava, **e** il tetto ha
  // tolto altri passi. Le due cose sono vere insieme e si dicono insieme —
  // com'era prima del ticket 64, che di quella frase ha corretto la parte
  // falsa e non questa.
  if (passiSenzaMazzo > 0) {
    const persi =
      passiSenzaMazzo === 1
        ? `un altro passo della frontiera è rimasto senza mazzo`
        : `altri ${passiSenzaMazzo} passi della frontiera sono rimasti senza mazzo`;
    return (
      `${corpo} Dentro ${EURO.format(tetto)} quel mazzo ci stava, ma ${persi} per il ` +
      `prezzo: alzare il tetto può rimettere in gioco proprio quelli, oltre alle carte ` +
      `che qui mancano.`
    );
  }

  // Nessun passo perso: il tetto si nomina lo stesso, ma per dire la verità
  // invece del contrario — ci stava, e alzarlo resta una strada non perché il
  // mazzo ne sia uscito, ma perché più soldi rimettono in gioco carte e terre
  // che il prezzo aveva lasciato fuori, e sono quelle che mancano per finirlo.
  return (
    `${corpo} Dentro ${EURO.format(tetto)} quel mazzo ci stava: non è il tetto ad averlo ` +
    `fermato, ma le carte che mancano — alzarlo può però rimettere in gioco quel che il ` +
    `prezzo aveva lasciato fuori.`
  );
}
