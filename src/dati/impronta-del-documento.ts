/**
 * L'impronta del **documento**: da quale documento di formato viene questo pool.
 *
 * ## Perché ce ne vuole una seconda
 *
 * Un'impronta del formato esiste già, in `ambito.ts`, e non è questa. Le due
 * rispondono a due domande diverse, e mescolarle vorrebbe dire sbagliarle
 * tutte e due:
 *
 * - **`ambito.ts` — «due mazzi sono dello stesso gioco?»** Guarda il criterio e
 *   le edizioni ammesse, e nient'altro. Le limitate e le bandite ne stanno
 *   fuori **apposta**: una carta messa a una copia non fa un formato nuovo, e
 *   se entrasse ogni ripensamento del gruppo chiuderebbe in silenzio tutti i
 *   mazzi salvati.
 * - **qui — «questo pool l'ha prodotto questo documento?»** Guarda *tutto* quel
 *   che decide chi entra nel pool e con quale copia, limitate e bandite
 *   comprese. Devono entrare proprio perché non si applicano a runtime: il pool
 *   se le porta dentro cotte, scritte una volta al momento della generazione, e
 *   da lì in poi nessuno le rilegge. Un nome aggiunto alle bandite e un
 *   `npm run build` senza `npm run dati` darebbero un'app che mostra la lista
 *   nuova e mette in catalogo la carta appena bandita.
 *
 * La prima si mostra e viaggia dentro i mazzi salvati; questa non si mostra a
 * nessuno: sta nel pool, la confronta la compilazione per fermarla, e la
 * confronta l'app per non aprire accanto al documento un pool arrivato dalla
 * rete che viene da un altro (`aggiornamento.ts`, ticket 32).
 *
 * ## Che cosa ci entra, e chi lo decide
 *
 * Ci entrano le voci del documento che cambiano il **contenuto del pool**:
 *
 * - il **criterio**, che decide quali carte esistono;
 * - le **edizioni** — codice e lingue ammesse, queste ultime nell'ordine
 *   dichiarato, perché quell'ordine è la preferenza e decide quale copia
 *   descrive la carta;
 * - le **limitate**, che scrivono il tetto di copie su ogni carta;
 * - le **bandite**, che tengono delle carte fuori dal catalogo.
 *
 * Restano fuori le voci che si mostrano e non decidono: il nome del formato, la
 * data della lista, la fonte, il regolamento di riferimento, i «perché», le
 * divergenze e le domande ancora aperte. Correggere un refuso in un «perché»
 * non cambia una carta del pool, e non deve costringere a riscaricare
 * quattrocento megabyte di archivio.
 *
 * La `SPARTIZIONE` qui sotto **è** questa decisione, scritta invece che
 * sottintesa, pezzo per pezzo del documento: un test la confronta con i campi
 * che il documento ha davvero, e il giorno che ne guadagna uno nessuno può
 * dimenticarsi di dire da che parte sta.
 */

import { somma } from "../somma.js";
import type {
  Criterio,
  Edizione,
  EdizioneEsclusa,
  ElencoDiCarte,
  Formato,
  VoceDiCarta,
} from "./formato.js";

/**
 * Le voci di una parte del documento, divise in due: quelle che cambiano il
 * contenuto del pool e quelle che no.
 */
type Spartizione<T> = {
  fanno: readonly (keyof T)[];
  nonFanno: readonly (keyof T)[];
};

/**
 * La decisione, scritta invece che sottintesa: per ogni pezzo del documento,
 * quali sue voci fanno il pool e quali no.
 *
 * Un test la confronta con i campi che quei pezzi hanno davvero. Il documento è
 * già cresciuto una volta — le lingue per edizione sono nate dopo il pool — e
 * crescerà ancora: un campo nuovo che nessuno ha classificato sarebbe un campo
 * che l'impronta non guarda, cioè questo difetto che rientra dalla finestra. Da
 * qui in poi quel test cade finché qualcuno non dice da che parte sta.
 */
export const SPARTIZIONE = {
  /** Il documento intero. */
  documento: {
    fanno: ["criterio", "edizioni", "limitate", "bandite"],
    nonFanno: [
      "nome",
      "daConfermare",
      "aggiornatoIl",
      "fonte",
      "regolamentoDiRiferimento",
      // Le escluse non fanno il pool per definizione: sono le edizioni che non
      // ci sono. Aggiungerne una, o correggerne il perché, non toglie una carta
      // dal pool — toglierla dalle **ammesse** sì, e quello lo vede già
      // `edizioni`.
      "edizioniEscluse",
    ],
  } satisfies Spartizione<Formato>,

  /** Il criterio: la **regola** decide chi entra, la sua descrizione la racconta. */
  criterio: {
    fanno: ["regola"],
    nonFanno: ["descrizione", "daConfermare"],
  } satisfies Spartizione<Criterio>,

  /** Un'edizione ammessa: il codice e le lingue, queste ultime in ordine. */
  edizione: {
    fanno: ["codice", "lingue"],
    nonFanno: ["nome", "perché", "daConfermare"],
  } satisfies Spartizione<Edizione>,

  /**
   * Un'edizione esclusa: niente di suo fa il pool, e il giorno che qualcosa lo
   * facesse questa riga è dove si dice.
   */
  edizioneEsclusa: {
    fanno: [],
    nonFanno: ["codice", "nome", "perché", "daConfermare"],
  } satisfies Spartizione<EdizioneEsclusa>,

  /** Un elenco di carte — le limitate, le bandite. */
  elenco: {
    fanno: ["carte"],
    nonFanno: ["perché", "daConfermare"],
  } satisfies Spartizione<ElencoDiCarte>,

  /**
   * La riga che nomina una carta. Oggi è il **nome** e basta: la riga dice che
   * quella carta è limitata, o che non si gioca, e il resto lo spiega. Il
   * giorno che una limitata potesse valere due copie invece di una, quel numero
   * andrebbe qui — ed è esattamente quel che la spartizione costringe a dire.
   */
  voce: {
    fanno: ["carta"],
    nonFanno: ["perché", "divergenza", "daConfermare"],
  } satisfies Spartizione<VoceDiCarta>,
};

/**
 * L'impronta del documento che ha prodotto — o che dovrebbe aver prodotto — un
 * pool.
 *
 * È corta e illeggibile, al contrario di quella di `ambito.ts`: quella finisce
 * dentro un testo che passa per messaggi e chi la guarda deve poterla capire,
 * questa sta in un campo di `pool.json` e la leggono solo i confronti.
 * Scritta per esteso sarebbe l'elenco di tutte le bandite.
 */
export function improntaDelDocumento(formato: Formato): string {
  return somma(testoDelDocumento(formato));
}

/**
 * Il documento ridotto alle sole cose che fanno il pool, in una forma stabile.
 *
 * Le edizioni si mettono in ordine di codice e le carte in ordine alfabetico,
 * perché il documento lo scrive una mano: due righe scambiate di posto sono una
 * correzione di stile e non un pool diverso. Le **lingue** invece restano
 * nell'ordine dichiarato — lì l'ordine è la preferenza, e cambiarlo cambia
 * quale copia descrive la carta.
 *
 * Codici ed elenchi si ripuliscono come li ripulisce la preparazione: uno
 * spazio in coda a «it » è invisibile a chi scrive, e la preparazione lo toglie
 * prima di guardarci dentro. Se qui non lo togliessimo, un pool giusto
 * risulterebbe di un altro documento.
 */
function testoDelDocumento(formato: Formato): string {
  const edizioni = formato.edizioni
    .map(
      (edizione) =>
        `${edizione.codice.trim().toLowerCase()}:` +
        edizione.lingue.map((lingua) => lingua.trim().toLowerCase()).join(">"),
    )
    .sort();

  const nomi = (elenco: Formato["limitate"]) =>
    elenco.carte
      .map((voce) => voce.carta.trim())
      .sort()
      .join("+");

  return [
    `criterio=${formato.criterio.regola}`,
    `edizioni=${edizioni.join("|")}`,
    `limitate=${nomi(formato.limitate)}`,
    `bandite=${nomi(formato.bandite)}`,
  ].join("\n");
}

/**
 * Il pool viene dal documento incluso? Se no, si ferma tutto.
 *
 * L'impronta arriva come `unknown` di proposito: chi chiama la pesca dal file
 * grezzo, e **non** dal pool già interpretato. Sono due letture diverse e la
 * differenza conta — `carica-pool.ts` rattoppa i pool vecchi per farli aprire
 * lo stesso, e un'impronta assente rattoppata a stringa vuota è precisamente
 * la cosa che qui deve fermare la compilazione.
 *
 * Il messaggio dice quale dei due file rifare, e non è una scelta fra pari: il
 * documento lo scrive una persona e non lo genera nessun comando, quindi a
 * doversi rifare è sempre il pool.
 */
export function verificaAllineamento(
  improntaDelPool: unknown,
  formato: Formato,
): void {
  const attesa = improntaDelDocumento(formato);
  if (improntaDelPool === attesa) return;

  const preambolo =
    typeof improntaDelPool !== "string" || improntaDelPool === ""
      ? "Il pool non dice da quale documento di formato viene: è stato scritto\n" +
        "prima che il legame fra i due esistesse."
      : `Il pool non viene dal documento di formato incluso:\n` +
        `  il documento è «${attesa}», il pool dice di venire da «${improntaDelPool}».`;

  throw new Error(
    `${preambolo}\n` +
      "\n" +
      "Le limitate e le bandite entrano nel pool quando lo si genera, e a\n" +
      "runtime nessuno le rilegge: compilare così darebbe un'app che mostra la\n" +
      "lista nuova e mette in catalogo le carte che quella lista bandisce.\n" +
      "\n" +
      "Il documento di formato lo scrive una mano e non lo genera nessun\n" +
      "comando: a doversi rifare è il pool. Lancia «npm run dati», poi ricompila.",
  );
}
