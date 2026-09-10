/**
 * Quando un mazzo smette di essere «quello che il motore ha costruito», e con
 * quello smette di portarsi dietro il tetto di spesa con cui è nato (ticket 21).
 *
 * Il tetto viaggia col mazzo e non con l'interruttore — chi costruisce a 30 € e
 * poi spegne l'interruttore non deve vedersi cambiare la base sotto le mani — e
 * finché non c'era questo modulo non si staccava mai: si poteva sostituire a
 * mano tutte e sessanta le carte e continuare a leggere che «per stare dentro
 * 30,00 € la base ha lasciato fuori…», per un tetto che nessuno aveva chiesto
 * per quel mazzo.
 *
 * La regola è la più stretta delle tre che il ticket metteva in fila, ed è
 * scelta per quel che non ha: **nessun numero da tarare**. Il tetto vale finché
 * il mazzo in mano è, carta per carta, quello che il motore ha consegnato; alla
 * prima copia cambiata a mano non lo è più, e il tetto se ne va. Severa, ma
 * dicibile in una frase — e all'utente non si toglie niente di nascosto,
 * perché finché il tetto è in vigore la schermata del mazzo lo **dice** e gli
 * dà il modo di levarlo prima ancora di toccare una carta.
 *
 * Il confronto si rifà **ogni volta**, e non si tiene da parte un «questo mazzo
 * è stato toccato»: chi toglie una copia e la rimette si ritrova il tetto, e le
 * terre che aveva prima. È la conseguenza voluta della domanda a cui questo
 * modulo risponde, che non è «l'utente ha toccato qualcosa» ma «quel che ha in
 * mano è il mazzo che il motore gli ha dato». Se lo è di nuovo, lo è: un tetto
 * che restasse staccato dopo un ripensamento starebbe rispondendo alla prima
 * domanda mentre ne dichiara un'altra.
 *
 * Il tetto non si deduce mai dall'interruttore della costruzione: quello dice
 * che cosa l'utente sta chiedendo **adesso** al motore, non con che cifra il
 * mazzo che ha in mano è stato costruito.
 */

/**
 * Il mazzo come il motore l'ha consegnato: la cifra con cui l'ha costruito, e
 * le carte che ci ha messo.
 *
 * Le due cose stanno insieme perché senza le seconde la prima non si può più
 * mettere in discussione: un tetto da solo è una cifra che non sa più a quale
 * mazzo apparteneva.
 *
 * Le terre non ci sono, e non è una dimenticanza: la schermata del mazzo le
 * rifà dalle carte, quindi non sono una scelta dell'utente da confrontare.
 * Cambiare **quante** terre si vogliono non rifà il mazzo, lo rilegge.
 */
export type MazzoConsegnato = {
  /** Il tetto con cui il motore l'ha costruito, in euro. */
  tetto: number;
  /** Le copie per nome al momento della consegna. */
  copie: ReadonlyMap<string, number>;
};

/** Le copie che ci sono davvero: una voce a zero è una carta che non c'è. */
function presenti(copie: ReadonlyMap<string, number>): Map<string, number> {
  return new Map([...copie].filter(([, quante]) => quante > 0));
}

/** Se due elenchi di copie sono lo stesso mazzo. L'ordine non conta. */
function stessoMazzo(uno: ReadonlyMap<string, number>, altro: ReadonlyMap<string, number>): boolean {
  const primo = presenti(uno);
  const secondo = presenti(altro);
  if (primo.size !== secondo.size) return false;
  for (const [nome, quante] of primo) {
    if (secondo.get(nome) !== quante) return false;
  }
  return true;
}

/**
 * Il tetto che vale **adesso** sul mazzo in mano: quello con cui è stato
 * costruito finché è ancora quel mazzo, `null` appena non lo è più.
 *
 * `null` anche per i mazzi messi insieme a mano e per quelli riaperti dai
 * salvati, che qui arrivano senza nessun mazzo consegnato: nessun tetto li ha
 * prodotti, e nessuno se ne applica.
 */
export function tettoInVigore(
  consegnato: MazzoConsegnato | null,
  inMano: ReadonlyMap<string, number>,
): number | null {
  if (consegnato === null) return null;
  return stessoMazzo(consegnato.copie, inMano) ? consegnato.tetto : null;
}
