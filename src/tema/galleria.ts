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

import type { Carta } from "../dati/pool.js";
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
    tema: tema({ tag: ["danno-diretto"] }),
  },
  {
    nome: "Controllare",
    promessa:
      "Dici di no a quello che prova a fare, gli togli dal tavolo quel che è riuscito a giocare, e intanto peschi più carte di lui.",
    tema: tema({ tag: ["controincantesimo", "pesca", "rimozione-mirata", "spazza-via"] }),
  },
  {
    nome: "Prosciugare",
    promessa:
      "Non corri: gli levi le carte di mano e dal tavolo una alla volta, e quando non gli resta niente hai vinto.",
    tema: tema({ colori: ["B"], tag: ["scarta", "si-cura-del-cimitero", "rimozione-mirata"] }),
  },
  {
    nome: "Passare di sopra",
    promessa:
      "Creature che non riesce a bloccare: volano, o passano lo stesso. Poche ferite per turno, tutti i turni.",
    tema: tema({ tag: ["evasione"] }),
  },
  {
    nome: "Ingrossare",
    promessa:
      "Creature piccole che diventano grandi. Da sole non fanno paura: quel che le rende grosse lo giochi tu.",
    tema: tema({ tag: ["potenzia"] }),
  },
  {
    nome: "Gli artefatti",
    promessa:
      "Carte che qualunque colore può giocare: il mazzo non deve decidere da che parte stare, e le terre sono un problema in meno.",
    tema: tema({ tipi: ["Artifact"] }),
  },
  {
    nome: "La prigione",
    promessa:
      "Non ammazzi niente: gli impedisci di usarlo. Le creature restano ferme e le terre non producono.",
    tema: tema({ tag: ["imbriglia", "attacca-le-terre"] }),
  },
  {
    nome: "Reggere l'urto",
    promessa:
      "Il danno non passa e le tue creature non muoiono. Vinci restando in piedi più a lungo di lui.",
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
