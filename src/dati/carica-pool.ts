/**
 * La lettura del pool da parte dell'app.
 *
 * L'app **legge** il pool e non lo produce mai (`spec.md`, «I due programmi»):
 * qui c'è tutto ciò che serve per farlo, e niente che sappia come il pool è
 * stato costruito.
 *
 * Il file è dentro il pacchetto e il service worker lo tiene in cache, quindi
 * questa lettura riesce anche senza rete (storia 15). Se però il file manca o è
 * rotto, l'app deve dirlo con parole: una lista vuota senza spiegazioni
 * sembrerebbe un pool senza carte, e manderebbe a cercare il guasto dalla parte
 * sbagliata.
 */

import { leggiTettoDiCopie } from "../mazzo/copie.js";
import type { Carta, Pool, Prezzo, TagDiScryfall } from "./pool.js";

/** Dov'è il pool, relativo alla base dell'app: l'app gira anche in sottocartella. */
const PERCORSO_POOL = `${import.meta.env.BASE_URL}dati/pool.json`;

/**
 * Controlla che quel che si è letto sia davvero un pool, e lo consegna tipato.
 *
 * Non verifica carta per carta: sarebbe un secondo posto in cui è scritta la
 * forma dei dati, e si scorderebbe di crescere. Verifica le due cose che
 * distinguono un pool da un file qualunque — che abbia una data e che abbia
 * carte.
 */
/**
 * I campi che il rattoppo qui sotto sa riscrivere, e insieme la condizione per
 * saltarlo: se ci sono tutti, la carta è già nella forma di oggi.
 *
 * Sta scritto una volta sola perché l’elenco e il controllo devono cambiare
 * insieme. Il giorno che nascerà un campo nuovo, chi lo aggiunge al rattoppo
 * senza aggiungerlo qui otterrebbe un rattoppo che non gira mai.
 */
const CAMPI_DEL_RATTOPPO = [
  "nomeItaliano",
  "edizione",
  "numeroDiCollezione",
  "linguaDellaStampa",
  "riservata",
  "tettoDiCopie",
] as const satisfies readonly (keyof Carta)[];

export function interpretaPool(dati: unknown): Pool {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Il file del pool delle carte non si legge.");
  }

  const { generatoIl, carte, registroTagScryfall, improntaDelDocumento } = dati as {
    generatoIl?: unknown;
    carte?: unknown;
    registroTagScryfall?: unknown;
    improntaDelDocumento?: unknown;
  };

  if (typeof generatoIl !== "string" || generatoIl === "") {
    throw new Error("Il pool delle carte non dice di che data sono i suoi dati.");
  }
  if (!Array.isArray(carte)) {
    throw new Error("Il pool non contiene un elenco di carte.");
  }
  if (carte.length === 0) {
    throw new Error("Il pool delle carte è vuoto.");
  }

  // Due campi si possono non trovare, e sono i due che sono nati dopo il pool.
  // Non è il controllo carta per carta che questo modulo rifiuta di fare —
  // quello sarebbe un secondo posto in cui è scritta la forma dei dati — è il
  // rattoppo di un pool di ieri alla forma di oggi. I pool di ieri arrivavano
  // per davvero finché l'aggiornamento in sottofondo li scaricava e li
  // conservava sul dispositivo; dal ticket 11 il pool arriva solo col pacchetto,
  // e il rattoppo protegge da un pacchetto pubblicato senza rifare il pool.
  //
  // Il **registro dei tag** di Scryfall manca nei pool scritti prima che i tag
  // della comunità entrassero nel file (ADR-0003): un registro che manca vuol
  // dire soltanto nessun tag, e mancherà anche sulle carte.
  //
  // Il **tetto di copie** manca nei pool scritti prima che diventasse un dato
  // della carta. Qui si riscrive con la regola del gioco, che è la stessa che
  // lo scrive in preparazione: non è un ripiego, è la risposta giusta per un
  // pool a cui nessun formato aveva ancora messo mano. Senza questo rattoppo
  // un tetto assente varrebbe «nessun tetto», e l'app costruirebbe in silenzio
  // mazzi con sessanta copie della stessa carta.
  // Il tetto si guarda **carta per carta** e non sulla prima: un pool a cui
  // manca il campo solo in mezzo passerebbe intero, e quelle carte resterebbero
  // con `undefined`, che `copieMassime` legge come «nessun tetto». Sarebbe
  // esattamente il guasto che questo rattoppo esiste per impedire, e in più
  // silenzioso: il tipo dice `number | null`, quindi nessuno lo vedrebbe.
  //
  // La **Reserved List** manca per la stessa ragione della stampa: è nata col
  // tetto di spesa, che è nato dopo. Un pool che non la porta non fa dire
  // niente di sbagliato all'app — fa dire di meno.
  //
  // La **provenienza del prezzo** manca nei pool scritti prima che il prezzo si
  // staccasse dalla stampa che descrive la carta. Qui, unico caso, c'è qualcosa
  // da ricostruire e non da dichiarare ignoto: in quei pool l'invariante era
  // «il prezzo è di quella stampa e di nessun'altra», quindi scrivere la stampa
  // mostrata non inventa niente, ripete quel che quel file diceva.
  //
  // La **stampa** e il **nome italiano** mancano nei pool scritti prima che il
  // formato smettesse di essere lo Standard. Qui non c'è niente da ricostruire
  // — quale stampa descrivesse una carta di allora non lo sa più nessuno — e
  // l'unica risposta onesta è dirlo: stringa vuota per la stampa, come già fa
  // la rarità di una carta che non ce l'ha, e nessun nome italiano. Sono valori
  // che si mostrano come «non lo so» invece di rompersi, e nessuno dei due
  // decide quante copie entrano in un mazzo.
  const senzaTag = !Array.isArray(registroTagScryfall);

  return {
    generatoIl,
    // Da quale documento di formato viene il pool. Qui non si verifica niente:
    // per il pool incluso quel confronto sta nella **compilazione**, dove i due
    // file stanno sullo stesso disco e uno dei due si può rifare; per quelli
    // arrivati dalla rete lo fa `aggiornamento.ts`, che decide quale pool si
    // apre. Un pool di ieri non ce l'ha — «non lo so» è la stringa vuota, come
    // per la stampa di una carta che non la scriveva.
    improntaDelDocumento: typeof improntaDelDocumento === "string" ? improntaDelDocumento : "",
    registroTagScryfall: senzaTag ? [] : (registroTagScryfall as TagDiScryfall[]),
    carte: (carte as Carta[]).map((carta) => {
      // Prima di chiedere un campo alla voce, si chiede che la voce sia una
      // carta. È la stessa domanda che il pool intero si sente fare in cima, e
      // per la stessa ragione: un file troncato, un JSON scritto a mano male o
      // un deposito recuperato a metà mettono un `null` in mezzo alle carte, e
      // senza questa riga quel che arriva sullo schermo del guasto è la frase
      // del motore JavaScript invece di quella scritta per una persona.
      // `Array.isArray` perché `typeof [] === "object"`: una lista sarebbe
      // l'unica voce a passare la domanda senza essere una carta, e uscirebbe
      // di qui senza nome e senza tag per far cadere il motore molto più in
      // là, dove le parole sono di un altro modulo.
      if (typeof carta !== "object" || carta === null || Array.isArray(carta)) {
        throw new Error("Il file del pool delle carte non si legge.");
      }
      // La scorciatoia va chiesta a **tutti** i campi che il rattoppo scrive, e
      // non a due di loro. I campi nuovi non sono arrivati tutti insieme e non
      // arriveranno tutti insieme la prossima volta: chiedendone solo alcuni,
      // un pool a metà strada passa intero e gli altri restano a `undefined` -
      // che il tipo dichiara impossibile, quindi nessuno lo cercherebbe lì.
      // La provenienza del prezzo non sta in `CAMPI_DEL_RATTOPPO` per una
      // ragione sola: quella lista guarda i campi della carta, e questo campo
      // sta **dentro** il prezzo. Va chiesto a parte, ma va chiesto — se no la
      // scorciatoia lo lascia passare a `undefined`, che il tipo dichiara
      // impossibile e nessuno andrebbe a cercare lì.
      if (
        !senzaTag &&
        CAMPI_DEL_RATTOPPO.every((campo) => carta[campo] !== undefined) &&
        carta.prezzo?.stampa !== undefined
      ) {
        return carta;
      }
      return {
        ...carta,
        ...(senzaTag ? { tagScryfall: [] } : {}),
        nomeItaliano: carta.nomeItaliano ?? null,
        edizione: carta.edizione ?? "",
        numeroDiCollezione: carta.numeroDiCollezione ?? "",
        linguaDellaStampa: carta.linguaDellaStampa ?? "",
        // La Reserved List manca nei pool scritti prima che il tetto di spesa
        // esistesse. «Non riservata» è la risposta giusta per la quasi
        // totalità delle carte, e l'unica che non inventa niente: al massimo
        // l'app tace su una carta di cui avrebbe potuto dire qualcosa.
        riservata: carta.riservata ?? false,
        prezzo: conLaSuaStampa(carta),
        // Testo e tipi si prendono col beneficio del dubbio: rattoppare un pool
        // di ieri vuol dire anche non cadere su un campo che quel pool non
        // aveva. Una carta senza testo e senza tipi prende il tetto di tutti,
        // che è la risposta giusta per quel che se ne sa.
        ...(carta.tettoDiCopie === undefined
          ? { tettoDiCopie: leggiTettoDiCopie(carta.testo ?? "", carta.tipi ?? []) }
          : {}),
      };
    }),
  };
}

/**
 * Il prezzo di una carta di ieri, con scritto da quale copia viene.
 *
 * Nei pool scritti prima che il prezzo si staccasse dalla stampa mostrata la
 * risposta è nota e sta nella carta stessa: era il prezzo di **quella** stampa
 * e di nessun'altra. Si scrive, invece di dire «non lo so» di una cosa che si sa.
 *
 * Due volte però `null` è l'unica risposta onesta: quando quel pool un euro non
 * ce l'aveva — euro e provenienza vanno a coppia — e quando la stampa mostrata
 * non la scriveva nemmeno lei, che è il pool dei tempi dello Standard.
 */
function conLaSuaStampa(carta: Carta): Prezzo {
  const prezzo: Prezzo | undefined = carta.prezzo;
  const euro = prezzo?.euro ?? null;
  const edizione = carta.edizione ?? "";
  return {
    euro,
    aggiornatoIl: prezzo?.aggiornatoIl ?? "",
    stampa:
      prezzo?.stampa ??
      (euro === null || edizione === ""
        ? null
        : {
            edizione,
            numeroDiCollezione: carta.numeroDiCollezione ?? "",
            lingua: carta.linguaDellaStampa ?? "",
          }),
  };
}

/** Legge il pool incluso nell'app. */
export async function caricaPool(): Promise<Pool> {
  const risposta = await fetch(PERCORSO_POOL);
  if (!risposta.ok) {
    throw new Error(`Il pool delle carte non è raggiungibile (${risposta.status}).`);
  }
  let letto: unknown;
  try {
    letto = await risposta.json();
  } catch {
    // Capita per davvero: un server che risponde con la pagina dell'app al
    // posto di un file mancante. Il messaggio del browser parlerebbe di
    // parentesi angolari, e non aiuterebbe nessuno.
    throw new Error("Il file del pool delle carte non si legge.");
  }
  return interpretaPool(letto);
}

/**
 * La data dei dati, come si direbbe a voce (storia 17).
 *
 * Si legge sempre nel fuso di Greenwich, quello in cui la data è scritta: letta
 * nel fuso di chi guarda, un pool generato di prima mattina diventerebbe del
 * giorno prima per metà del mondo.
 */
export function dataInItaliano(iso: string): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return "data sconosciuta";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(quando);
}
