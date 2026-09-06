/**
 * L'identità dell'app, in un punto solo.
 *
 * Da qui passano il titolo della pagina, l'intestazione, e il nome con cui
 * l'app si installa sul telefono: cambiarlo è cambiare **questa** costante, non
 * cercare per il progetto — un test lo verifica.
 *
 * ## Perché «Fucina»
 *
 * Il nome dice il mestiere dell'app e non il suo risultato. Chi la apre non
 * viene a chiedere «qual è il mazzo più forte» — quella risposta la danno già i
 * siti del meta, gratis e meglio. Viene con **un'idea sua**, e vuole sapere se
 * sta in piedi e quanto costa tenerla. Una fucina è il posto dove ci si porta
 * la propria idea e si esce con la cosa fatta: è esattamente il patto di questa
 * app, ed è anche la ragione per cui il fulcro è il tasso di cambio fra
 * originalità e potenza, e non una classifica.
 *
 * È una parola sola, italiana, che si dice e si scrive senza esitare, e sta
 * bene sotto tutte e quattro le direzioni visive ancora aperte: taverna,
 * grimorio e braci sono già fuoco e artigianato.
 *
 * E non contiene **nessun marchio di Wizards**: né «Magic», né la sigla del
 * gioco, né una parola del suo immaginario. Non è delicatezza ma la condizione
 * che tiene in piedi tutto il resto — l'app vive dentro la politica sui
 * contenuti dei fan, che chiede di non presentarsi come se fosse loro.
 */
export const NOME_APP = "Fucina";

/**
 * Vero finché il nome è un segnaposto e non una scelta. Adesso è falso, e resta
 * qui perché la forma della domanda vale più della risposta di oggi: il giorno
 * che il nome cambiasse ancora, l'app saprebbe di nuovo dirlo da sé.
 */
export const NOME_APP_DA_DECIDERE = NOME_APP.startsWith("[");

/*
 * L'**ambito** — la riga di contesto sotto il nome, che dice di quale gioco
 * parla l'app — qui non c'è più, e non è una dimenticanza.
 *
 * Era una costante scritta accanto a queste, ed era una verità di formato nel
 * sorgente: ADR-0004 dice che quelle si leggono dai dati. Adesso l'ambito è il
 * nome che il documento di formato dichiara, e passa da `dati/ambito.ts`. Il
 * nome dell'app resta qui perché è nostro; il nome del gioco no, è del gruppo
 * che lo gioca.
 */

/** Una frase, quella di `PROGETTO.md` §1, ridotta a misura di schermo. */
export const PROMESSA_APP =
  "Il mazzo più forte possibile dentro l'idea che hai in mente.";
