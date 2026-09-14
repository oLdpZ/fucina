/**
 * La galleria dei temi: otto mazzi che in questo pool **esistono davvero**
 * (ticket 13, storia 9).
 *
 * È la prima cosa che il giocatore vede quando va a dichiarare un tema, e serve
 * a togliere di mezzo il modo peggiore di cominciare: scrivere un'idea, vedersi
 * rispondere che con quelle carte un mazzo non si fa, e riprovare al buio. Le
 * otto voci qui sotto sono otto risposte già verificate — si toccano e il tema è
 * quello.
 *
 * ## Perché scritta a mano
 *
 * Una galleria **generata** — i sottotipi più numerosi, i tag più frequenti —
 * sarebbe stata più corta da scrivere e peggiore da usare. In questo pool i
 * sottotipi tribali si contano sulle dita: i Goblin sono dieci carte, gli Elfi
 * sette, e un elenco ordinato per numerosità proporrebbe «Umani» — ottantatré
 * carte che non sono un'idea di mazzo ma quasi tutte le creature bianche e
 * rosse messe insieme. Il conto direbbe di sì e il giocatore riceverebbe un
 * tema che non vuol dire niente.
 *
 * Perciò le otto voci sono **scelte**, e sono per lo più meccaniche: quel che il
 * mazzo *fa*, non di che sottotipo è fatto. È quel che questo pool sa fare — nel
 * 1994 gli archetipi si chiamavano bruciare, controllare, prosciugare, e sono
 * ancora questi. Nessuna voce tribale ce l'ha fatta: nessun sottotipo di questo
 * pool arriva alle carte che servono per stare comodi, e mettercelo lo stesso
 * vorrebbe dire aprire l'app con un tema che fa scattare l'avviso — l'esatto
 * guasto che questa schermata esiste per togliere.
 *
 * ## Che cosa non c'è scritto qui, e perché
 *
 * **Nessun nome di carta e nessun numero.** I temi sono fatti di colori, tipi,
 * sottotipi, tag di sinergia e costi — il vocabolario del gioco, non la lista di
 * un formato — e il conto delle carte non è scritto accanto a nessuna voce: si
 * ricava dal pool a ogni apertura, con lo stesso conto che dà il verdetto
 * (`galleriaContata`). È ADR-0004 applicato alla galleria, e serve a una cosa
 * concreta: il giorno che il documento di formato cambia una riga, i numeri
 * mostrati qui cambiano da soli, e una voce che avesse smesso di reggere lo
 * direbbe invece di continuare a promettere un mazzo che non c'è.
 *
 * Per la stessa ragione nessuna voce parte da una **carta-seme**: una carta-seme
 * è un nome di carta, e un nome di carta nel sorgente qui non ci va.
 */

import type { Carta, Tag } from "../dati/pool.js";
import { valutaTema, type Ampiezza } from "./ampiezza.js";
import { FILTRO_TEMA_VUOTO, TEMA_VUOTO, type FiltroTema, type Tema } from "./tema.js";

/**
 * Una voce della galleria: un nome, quel che il mazzo promette di fare, e il
 * tema vero che si applica toccandola.
 *
 * `promessa` è una frase scritta a mano, e non è un'eccezione al vincolo delle
 * spiegazioni: non contiene numeri. Le frasi che portano numeri sono generate da
 * modelli su valori calcolati (`spiegazioni/frasi.ts`); questa dice soltanto che
 * cosa fa il mazzo, come lo direbbe un giocatore a un altro, e il numero — le
 * carte che il tema porta dentro — sta accanto e viene dal pool.
 */
export type VoceDiGalleria = {
  /** Il nome del mazzo in italiano, come lo chiamerebbe chi ci gioca. */
  readonly nome: string;
  /** Una riga in italiano semplice: che cosa fa questo mazzo, senza gergo. */
  readonly promessa: string;
  /**
   * **I tag che la promessa nomina**, cioè il legame fra una frase italiana e
   * il vocabolario — dichiarato qui perché una macchina lo possa leggere.
   *
   * Serve al criterio del ticket 71: *il tag più numeroso di una voce dev'essere
   * uno di quelli che la sua promessa nomina*. Senza questo campo quel criterio
   * resta un commento, e un commento non diventa rosso.
   *
   * Non è «i tag del tema» riscritti: le due liste possono divergere, e quando
   * divergono lo dicono. Un tag del tema che non compare qui è roba che il mazzo
   * prende senza averla promessa; un tag qui che non è nel tema è una promessa
   * che il tema non mantiene. Nessuna delle due è per forza un guasto, e tutt'e
   * due vanno guardate invece che pareggiate.
   *
   * **Si riempie leggendo la promessa, non il tema.** Allargare questo elenco
   * finché il test passa è il modo esatto di rompere il criterio: a quel punto è
   * il tema a dettare la promessa, ed è il guasto da cui tutto questo è nato.
   * Il vocabolario è il giudice — `azione` di ogni tag in `vocabolario.ts` dice
   * che cosa quel tag fa, e la promessa o lo dice o non lo dice.
   */
  readonly nominati: readonly Tag[];
  readonly tema: Tema;
};

/** Un tema di sole inclusioni: la forma di tutte le voci della galleria. */
function tema(inclusioni: Partial<FiltroTema>): Tema {
  return { ...TEMA_VUOTO, inclusioni: { ...FILTRO_TEMA_VUOTO, ...inclusioni } };
}

/**
 * Gli otto temi, nell'ordine in cui si mostrano.
 *
 * L'ordine è quello con cui un giocatore nuovo li capisce, non quello per
 * numero di carte: prima i tre modi classici di vincere una partita —
 * aggredire, controllare, logorare — poi le tre strade che passano da un'altra
 * parte, e in fondo le due che si difendono. Chi apre la schermata legge
 * dall'alto e trova per prima la cosa che si aspetta.
 */
export const GALLERIA: readonly VoceDiGalleria[] = [
  {
    nome: "Bruciare",
    promessa:
      "Il danno lo mandi dove vuoi tu: sulle sue creature o addosso a lui. Vinci in fretta, prima che si sistemi.",
    nominati: ["danno-diretto"],
    tema: tema({ tag: ["danno-diretto"] }),
  },
  {
    nome: "Controllare",
    promessa:
      "Dici di no a quello che prova a fare, gli togli dal tavolo quel che è riuscito a giocare, e intanto peschi più carte di lui.",
    /**
     * Tre clausole, tre tag. «Dici di no a quello che prova a fare» è il
     * controincantesimo; «gli togli dal tavolo quel che è riuscito a giocare»
     * è lo spazzino; «peschi più carte di lui» è la pesca.
     *
     * **`rimozione-mirata` non è nominata**, e la differenza non è un cavillo:
     * il vocabolario le dà come azione «tolgono di mezzo una carta sola»,
     * mentre questa riga parla di *quel che è riuscito a giocare* — tutto, non
     * uno. La voce che nomina la rimozione mirata è «Prosciugare», e infatti lo
     * dice con le parole giuste: «dal tavolo **una alla volta**».
     */
    nominati: ["controincantesimo", "spazza-via", "pesca"],
    /**
     * **`rimozione-mirata` non è qui, ed è la correzione del ticket 71.**
     *
     * C'era, e con lei il tema uniti 128 carte di cui il 54% erano quelle — è
     * quel che la sosta del ticket 71 vide, sul pool di quel giorno: ogni
     * creatura che tappa per tirare un danno addosso a un'altra è rimozione per
     * davvero e entrava di diritto. Il mazzo che usciva sul pool vero non aveva
     * **nessuna contromagia e nessuna pesca** — era un mazzo di creature verdi e
     * rosse con purezza 1,000, cioè perfettamente dentro il tema e perfettamente
     * fuori dalla promessa.
     *
     * Il criterio che la sosta ne ha ricavato vale per **ogni voce di questa
     * galleria**: **il tag più numeroso di una voce dev'essere uno di quelli che
     * la sua promessa nomina.** Dal ticket 77 non tocca più a chi legge
     * ricordarsene — sta in `galleria.test.ts` e diventa rosso da solo, coi
     * numeri della corsa scritti nel messaggio.
     *
     * Non è una regola sulla cardinalità, ed è per questo che si scrive così.
     * «Reggere l'urto» è dominato al 76% da `previene-il-danno` e sta benissimo,
     * perché quel tag **è** la sua promessa — «il danno non passa». Qui il tag
     * dominante era l'unico dei quattro che la promessa non nominava.
     *
     * Tolta lei il più numeroso è `spazza-via`, che la promessa nomina: «gli
     * togli dal tavolo quel che è riuscito a giocare». Sul pool del 2026-09-14
     * sono 55 carte in tutto — `spazza-via` 24, `controincantesimo` 20, `pesca`
     * 11.
     *
     * Quei tre numeri si muovono ogni volta che una correzione dei tag li tocca,
     * e si sono mossi due volte in una settimana (ticket 73 e 75): quel che deve
     * reggere non è la cifra ma **l'ordine**, cioè che a comandare resti un tag
     * che la promessa nomina. Chi li trova diversi non ha trovato un guasto; chi
     * trova `spazza-via` scavalcato, sì.
     *
     * Le rimozioni a bersaglio singolo non spariscono dall'app: chi le vuole le
     * trova nel catalogo e le mette a mano, e il motore le pesca comunque quando
     * la frontiera cede tema per potenza. Non sono più il tema.
     */
    tema: tema({ tag: ["controincantesimo", "pesca", "spazza-via"] }),
  },
  {
    nome: "Prosciugare",
    promessa:
      "Non corri: gli levi le carte di mano e dal tavolo una alla volta, e quando non gli resta niente hai vinto.",
    /**
     * «Gli levi le carte di mano» è lo scarto; «dal tavolo una alla volta» è la
     * rimozione mirata, detta con l'azione che il vocabolario le dà.
     *
     * **`si-cura-del-cimitero` sta nel tema e questa riga non lo nomina.** Non è
     * una svista di questo elenco: la promessa non dice niente del cimitero, e
     * scrivercelo per far tornare i conti sarebbe l'errore che il campo esiste
     * per impedire. È il secondo tag per numerosità dentro il nero — sedici
     * carte contro diciannove — e il giorno che scavalca, il test diventa rosso
     * e chiede di scegliere: o la promessa lo nomina, o il tema lo lascia
     * andare.
     */
    nominati: ["scarta", "rimozione-mirata"],
    tema: tema({ colori: ["B"], tag: ["scarta", "si-cura-del-cimitero", "rimozione-mirata"] }),
  },
  {
    nome: "Passare di sopra",
    promessa:
      "Creature che non riesce a bloccare: volano, o passano lo stesso. Poche ferite per turno, tutti i turni.",
    nominati: ["evasione"],
    tema: tema({ tag: ["evasione"] }),
  },
  {
    nome: "Ingrossare",
    promessa:
      "Creature piccole che diventano grandi. Da sole non fanno paura: quel che le rende grosse lo giochi tu.",
    nominati: ["potenzia"],
    tema: tema({ tag: ["potenzia"] }),
  },
  {
    nome: "Gli artefatti",
    promessa:
      "Carte che qualunque colore può giocare: il mazzo non deve decidere da che parte stare, e le terre sono un problema in meno.",
    /**
     * Vuoto, e giusto così: questa voce seleziona per **tipo**, non per tag. La
     * promessa parla di che cosa vuol dire giocare artefatti — nessun colore da
     * scegliere — e non nomina nessun mestiere, perché il tema non ne chiede
     * nessuno. Senza tag non c'è un tag più numeroso, e il criterio su questa
     * voce non ha niente da dire.
     */
    nominati: [],
    tema: tema({ tipi: ["Artifact"] }),
  },
  {
    nome: "La prigione",
    promessa:
      "Non ammazzi niente: gli impedisci di usarlo. Le creature restano ferme e le terre non producono.",
    /** «Le creature restano ferme» è l'imbriglio; «le terre non producono» è l'attacco alla base di terre. */
    nominati: ["imbriglia", "attacca-le-terre"],
    tema: tema({ tag: ["imbriglia", "attacca-le-terre"] }),
  },
  {
    nome: "Reggere l'urto",
    promessa:
      "Il danno non passa e le tue creature non muoiono. Vinci restando in piedi più a lungo di lui.",
    /** «Il danno non passa» previene il danno; «le tue creature non muoiono» rigenera. */
    nominati: ["previene-il-danno", "rigenera"],
    tema: tema({ tag: ["previene-il-danno", "rigenera"] }),
  },
];

/**
 * Una voce col suo verdetto sul pool di oggi.
 *
 * Il verdetto è quello di `valutaTema`, lo stesso identico che la schermata
 * mostra dopo che il tema è stato scelto. Non è un dettaglio: se il numero della
 * galleria e quello del verdetto venissero da due conti diversi, prima o poi
 * direbbero due cose diverse sulla stessa carta, e la galleria diventerebbe il
 * posto dove l'app si contraddice.
 */
export type VoceContata = {
  readonly voce: VoceDiGalleria;
  readonly ampiezza: Ampiezza;
};

/**
 * La galleria col conto delle carte, ricavato dal pool che si ha in mano.
 *
 * Otto passaggi sul pool — pochi millisecondi sulle carte vere — e si rifanno
 * solo quando il pool cambia. Una voce che non reggesse più non si nasconde: il
 * suo verdetto lo dice, e la schermata può scriverlo. Una galleria che tacesse
 * un tema caduto sarebbe peggio di una galleria più corta.
 */
export function galleriaContata(carte: readonly Carta[]): VoceContata[] {
  return GALLERIA.map((voce) => ({ voce, ampiezza: valutaTema(carte, voce.tema) }));
}
