/**
 * **L'impronta della corsa**: di un elenco di orologi, quel che fa domanda.
 *
 * Serve a una cosa sola, e in un posto solo: `App` butta il mazzo costruito
 * appena la richiesta cambia, e gli orologi sono un ingresso della richiesta
 * come il tema, la combo e il tetto di spesa — «due richieste con orologi
 * diversi sono due richieste diverse, e devono poter dare due mazzi diversi».
 * Finché fra le dipendenze di quell'effetto gli orologi non c'erano, «Contro chi
 * incontri» continuava a mostrare gli esiti contro un meta che non esisteva più,
 * e «Mettilo in mano» offriva ancora quel mazzo: la piccola bugia che l'effetto
 * è stato scritto per non dire (ticket 37).
 *
 * ## Perché non basta l'elenco così com'è
 *
 * L'elenco è un array nello stato di `App`, e la schermata degli orologi lo
 * riscrive **a ogni tasto**: scrivere una lettera nel «perché» di un mazzo
 * produce un array nuovo. Metterlo fra le dipendenze com'è vorrebbe dire buttare
 * il mazzo costruito mentre si annota, in una casella, una frase che il motore
 * non legge. Il confronto dev'essere dunque più fine dell'identità — e allora è
 * una **regola**, e una regola sta dove la si può provare, non annidata in una
 * lista di dipendenze.
 *
 * ## Che cosa entra, e che cosa no
 *
 * Entrano i **tre numeri** — il turno di chiusura, le rimozioni, le contromagie
 * — perché sono quelli che `corsa.ts` legge, e cambiarne uno cambia gli esiti e
 * la sesta componente del punteggio.
 *
 * Entra il **nome**, che il motore non legge ma l'utente sì: sta in cima a ogni
 * riga di «Contro chi incontri», e un esito intestato a un mazzo che l'utente ha
 * appena chiamato in un altro modo racconta la partita sbagliata.
 *
 * Non entra il **perché**. È scritto per chi riapre il file fra sei mesi e non
 * si ricorda perché ci aveva messo dentro quel mazzo: non lo legge il motore,
 * non compare in nessun esito, e correggerlo non cambia di una virgola la
 * domanda che il mazzo in mano sta rispondendo.
 *
 * L'**ordine** conta. Non perché sposti un punteggio — non lo sposta — ma
 * perché la schermata non ha nessun modo di riordinare gli orologi: un elenco
 * che arriva qui in un ordine diverso è un elenco a cui è successo qualcos'altro,
 * e chiamarlo uguale vorrebbe dire indovinare che cosa.
 */

import type { Orologio } from "./orologio.js";

/**
 * L'impronta di una corsa: due elenchi con la stessa impronta fanno al mazzo la
 * stessa domanda, e un mazzo costruito per l'una vale per l'altra.
 *
 * Non si mostra a nessuno — vive dentro una lista di dipendenze — e per questo è
 * scritta in un modo che non si può confondere invece che in uno che si legge
 * bene: due nomi diversi non devono poter produrre la stessa riga per via di un
 * separatore che uno dei due si porta dentro.
 *
 * Il nome si ripulisce ai bordi: uno spazio in coda non si vede, e quel che non
 * si vede non deve poter buttare il mazzo di nessuno.
 */
export function improntaDellaCorsa(orologi: readonly Orologio[]): string {
  return JSON.stringify(
    orologi.map((orologio) => [
      orologio.nome.trim(),
      orologio.turnoDiChiusura,
      orologio.rimozioni,
      orologio.contromagie,
    ]),
  );
}
