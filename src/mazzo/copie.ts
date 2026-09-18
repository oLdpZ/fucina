/**
 * Quante copie di una carta può contenere un mazzo.
 *
 * Il numero **non si deduce qui**: è un dato della carta, scritto dalla
 * preparazione del pool (`tettoDiCopie`), e questo modulo è il posto unico da
 * cui si legge. È la differenza che tiene il motore fuori dal formato: chi
 * costruisce e chi scambia non sa quali carte siano limitate, sa solo leggere
 * un numero.
 *
 * Qui resta però la **regola del gioco** che quel numero in parte decide,
 * perché è una regola del gioco e non del formato: esistono carte che portano
 * scritto «A deck can have any number of cards named …», e un mazzo costruito
 * attorno a una di quelle è esattamente il genere di mazzo fuori meta per cui
 * questa app esiste. Il permesso si legge **dal testo della carta**, mai da un
 * elenco di nomi scritto nel codice: i nomi cambiano, la frase no. È lo stesso
 * principio di `CLAUDE.md`.
 *
 * La preparazione chiama `leggiTettoDiCopie` una volta per carta; l'app chiama
 * `copieMassime` ogni volta che serve.
 */

import type { Carta } from "../dati/pool.js";
import { eTerra } from "../tema/tema.js";
import { COPIE_MASSIME, DIMENSIONE_MAZZO } from "./taratura.js";

/**
 * La frase con cui le carte si concedono l'eccezione. È inglese perché le carte
 * del pool sono in inglese (Q24), ed è cercata alla lettera perché è una
 * formula fissa del gioco.
 */
const PERMESSO = /a deck can have any number of cards named/i;

/**
 * Quante copie ne ammette un mazzo quando il formato dichiara una carta
 * **limitata**. Non è verità di formato: è il significato della parola, e sta
 * qui accanto agli altri numeri di copie invece che sparso in preparazione.
 *
 * *Quali* carte siano limitate lo dice il documento di formato, e questo modulo
 * non lo sa né lo può sapere.
 */
export const COPIE_DI_UNA_LIMITATA = 1;

/**
 * Il tetto che il **gioco** mette a una carta, letto dal suo testo e dai suoi
 * tipi: `null` quando tetto non ce n'è.
 *
 * Le terre base non hanno tetto per regola del gioco, e non per gentilezza
 * dell'app: un mazzo può contenerne quante ne vuole.
 *
 * Prende testo e tipi invece della carta intera perché la preparazione la
 * chiama mentre la carta si sta ancora componendo.
 */
export function leggiTettoDiCopie(
  testo: string,
  tipi: readonly string[],
): number | null {
  if (eTerraBase(tipi)) return null;
  if (PERMESSO.test(testo)) return null;
  return COPIE_MASSIME;
}

/**
 * Il tetto di una carta del pool, in copie, nella forma con cui si fanno i
 * conti: `Infinity` dove il pool scrive `null`, così chi lo usa lo può
 * confrontare e troncare senza distinguere due casi.
 */
export function copieMassime(carta: Carta): number {
  return carta.tettoDiCopie ?? Number.POSITIVE_INFINITY;
}

/**
 * Le copie che l'app si concede davvero di una carta: il suo tetto, ma **mai
 * oltre le quattro**.
 *
 * Le due cose non coincidono nei due sensi opposti, ed è tutto il senso di
 * questa funzione. Sotto: una carta che il formato limita ne ammette una, e una
 * sola ne entra. Sopra: una carta che si concede copie illimitate potrebbe
 * riempire un mazzo intero, e trentatré copie della stessa carta sono un mazzo
 * legale che non è un mazzo — di lì non si parte.
 *
 * Sta qui, e non nel motore, perché la stessa risposta serve a chi costruisce e
 * a chi la **racconta** all'utente: la frase che promette «te ne metto tante»
 * deve leggere lo stesso numero che il mazzo poi contiene, se no promette
 * quattro copie di una carta che il formato limita a una.
 */
export function copieAlMassimo(carta: Carta): number {
  return Math.min(copieMassime(carta), COPIE_MASSIME);
}

/**
 * **Se una carta entra nel mazzo che l'utente tiene in mano.**
 *
 * Le terre no, e non è una restrizione: è il senso della schermata «Mazzo». La
 * base la sceglie l'app dalla curva, e una terra fra queste copie sarebbe una
 * carta che l'app conta, salva ed esporta **senza mostrarla** — il conto della
 * base la salta (`analizzaBaseDiTerre` guarda solo le non-terre), quindi non
 * comparirebbe in nessuna riga e non si potrebbe nemmeno togliere.
 *
 * La regola non è nuova: era già in quattro posti, ricordata quattro volte a
 * memoria — il comando delle copie, il filtro con cui il motore sceglie le
 * giocabili, la riapertura di un mazzo salvato, il conto della base. Quattro
 * memorie separate della stessa regola sono quattro occasioni di dimenticarla
 * in tre, e l'unica che poteva sbagliare senza che nessuno se ne accorgesse era
 * la porta d'ingresso: `cambiaCopie` non la conosceva affatto, e si fidava del
 * fatto che nessun bottone gliela facesse attraversare. Sta qui perché si legga,
 * e perché un test la possa provare (ticket 51).
 */
export function entraInMano(carta: Carta): boolean {
  // Le due domande e non una: `terra` è quel che la preparazione ha saputo
  // **leggere** di una terra, e un pool vecchio — o scritto a mano — può
  // benissimo portare una carta di tipo Land di cui non ha letto niente. Il
  // motore si guardava già da tutte e due (`costruisci.ts`); la porta d'ingresso
  // no, e guardava solo la prima. Delle due è questa la lettura giusta: una
  // carta che il gioco chiama terra è una terra anche se l'app non sa dire che
  // mana produca.
  return carta.terra === null && !eTerra(carta);
}

/**
 * **Quante copie di una carta la mano tiene davvero**, volendone `volute`.
 *
 * È la porta da cui le copie entrano nel mazzo: ci passano il più e il meno del
 * catalogo e la riapertura di un mazzo salvato, e ci passano insieme perché
 * quel che rientra da un file deve stare negli **stessi limiti** di quel che si
 * aggiunge a mano — un mazzo scritto a mano non deve poter mettere nell'app uno
 * stato che l'app da sola non produrrebbe mai.
 *
 * Il tetto è quello della carta, ma mai oltre il mazzo: una carta che si concede
 * copie illimitate si ferma dove finisce il posto. E non è `copieAlMassimo`, che
 * è un'altra domanda: quella dice quante il **motore** se ne concede, e sono al
 * più quattro; questa dice quante l'utente ne può mettere a mano, e se vuole
 * riempire il mazzo di una carta sola sono affari suoi.
 */
export function copieInMano(carta: Carta, volute: number): number {
  return Math.max(0, Math.min(tettoInMano(carta), volute));
}

/**
 * **Fin dove le copie di una carta possono arrivare in mano**: zero per una
 * terra, il tetto della carta per tutte le altre, e comunque mai oltre il mazzo.
 *
 * È lo stesso numero a cui `copieInMano` tronca, e serve a parte per una ragione
 * sola: i bottoni del più devono sapere **quando spegnersi**. Leggevano prima
 * `copieMassime`, che per una carta a copie illimitate è `Infinity`: il bottone
 * restava acceso per sempre sopra un passo che non faceva più niente, perché a
 * sessanta copie il troncamento lo mangiava. Un comando che si accende su un
 * gesto che non succede è un comando che mente.
 */
export function tettoInMano(carta: Carta): number {
  if (!entraInMano(carta)) return 0;
  return Math.min(copieMassime(carta), DIMENSIONE_MAZZO);
}

/**
 * Se questi tipi sono quelli di una **terra base**.
 *
 * Il supertipo e il tipo insieme, e nessun nome di carta: è così che l'app
 * riconosce le terre base ovunque le serva riconoscerle (ADR-0004). Sta qui
 * perché qui nasce — il gioco concede copie illimitate a queste e a nessun'altra
 * — e da qui la legge anche chi applica il prezzo che il gruppo dichiara per
 * loro (`dati/pool-in-vigore.ts`, ticket 83).
 */
export function eTerraBase(tipi: readonly string[]): boolean {
  return tipi.includes("Basic") && tipi.includes("Land");
}
