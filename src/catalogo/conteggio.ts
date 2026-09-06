/**
 * La riga che dice **quante carte restano**, e rispetto a che cosa.
 *
 * È il numero che il catalogo tiene sempre in vista (storia 13): quello che
 * dice se un'idea è ampia o strettissima. Il numero lo dà la lista — non ha un
 * calcolo suo, e non può quindi discordare da quel che si vede — mentre le
 * parole che gli stanno accanto stanno qui, dove si possono leggere e provare
 * senza aprire un browser.
 *
 * Sono poche parole, e vivono fuori dal componente per una ragione precisa:
 * fino al ticket 07 dicevano «in Standard», che era un **nome di formato
 * scritto nel sorgente**. ADR-0004 non lo permette più, e il modo di non farlo
 * ripetere è che il nome del gioco entri qui da fuori — dal documento di
 * formato, come l'ambito in testata — invece di essere una costante che nessuno
 * ricontrolla.
 */

/**
 * Che cosa segue «37 carte»: il gioco quando non si è filtrato niente, i filtri
 * quando se ne è mosso almeno uno.
 *
 * Le due code rispondono a due domande diverse, ed è il motivo per cui non è
 * sempre la stessa. A riposo il numero misura **il gioco** — quante carte
 * esistono, in tutto — e senza dirlo sembrerebbe il conto di un filtro
 * invisibile. Con dei filtri attivi misura **loro**, e ripetere il nome del
 * gioco lascerebbe credere che il pool si sia ristretto.
 *
 * `ambito` è il nome che il documento di formato dichiara. Oggi non può essere
 * vuoto — un documento senza nome non si apre affatto, e `carica-formato.ts` lo
 * rifiuta — ma se lo fosse la coda sparisce invece di uscire monca: «carte» da
 * solo è vero, «carte in» è una frase lasciata a metà. Costa una riga, e toglie
 * a questa funzione l'unico modo che avrebbe di scrivere una frase sbagliata.
 */
export function codaDelConteggio(filtriAttivi: number, ambito: string): string {
  if (filtriAttivi > 0) return "con questi filtri";
  const nome = ambito.trim();
  return nome === "" ? "" : `in ${nome}`;
}
