import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

import { interpretaFormato } from "../src/dati/carica-formato.ts";
import type { Formato } from "../src/dati/formato.ts";
import { listinoDelPool } from "../src/dati/listino.ts";
import type { Pool } from "../src/dati/pool.ts";
import { DESCRITTORE, dataDellArchivio } from "./archivio-di-scryfall.ts";
import {
  confrontaPool,
  contaBuchi,
  interessante,
  preparaPool,
  raccontaBuchi,
  raccontaDiario,
  raccontaFigure,
  raccontaLingue,
  raccontaPosta,
  verificaPoolNonVuoto,
  verificaRaccolto,
  type CartaScryfall,
} from "./prepara-pool.ts";
import { leggiCorrezioni, raccontaCorrezioni, TAG } from "./tag-di-sinergia.ts";
import {
  indicizzaTag,
  riduciTag,
  type IndiceTag,
  type TagGrezzo,
  type TagRidotto,
} from "./tag-di-scryfall.ts";

/**
 * Il comando unico di aggiornamento dei dati (storia 30).
 *
 *     npm run dati
 *
 * Scarica l'archivio completo Scryfall, tiene le sole stampe delle edizioni che
 * il **documento di formato** ammette, le riduce ai campi che servono, riscrive
 * `public/dati/pool.json` e `public/dati/prezzi.json`, e dice a schermo cosa è
 * cambiato.
 *
 * I due file hanno due vite diverse (ticket 11). Il **pool** si congela
 * nell'app: le carte del 1994 non cambiano, e l'app non lo riscarica mai. Il
 * **listino dei prezzi** invece l'app lo chiede in sottofondo, insieme al
 * documento di formato, perché sono le sole cose che invecchiano: pubblicare
 * prezzi freschi è rilanciare questo comando e pubblicare il sito.
 *
 * Il formato non è scritto qui: si legge da `public/dati/formato.json`, che è
 * il file che una persona apre e corregge
 * ([ADR-0004](../docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md)).
 * Cambiare una carta limitata e rilanciare questo comando è tutto quel che
 * serve, e non si tocca una riga di codice (storia 26).
 *
 * Gira sul computer del manutentore, **mai nel browser**. Per questo è un
 * comando solo, senza argomenti obbligatori e senza dipendenze da installare.
 *
 * Con `--da <archivio>` legge un archivio Scryfall già sulla macchina invece
 * di scaricarlo — `.jsonl` o `.jsonl.gz`, **col nome che gli dà Scryfall e
 * **quello giusto**: serve per riprovare senza rifare quattrocento megabyte
 * di rete. Quale sia quello giusto, e come si riconosce, lo dice
 * `archivio-di-scryfall.ts`; qui basta sapere che un archivio di un'altra si
 * ferma prima di riscrivere il pool. `--tag <archivio>`
 * fa lo stesso per l'archivio dei tag funzionali, che però pesa un
 * sessantesimo: con `--da` da solo i tag si riscaricano, ed è un costo che si
 * può pagare.
 */

/**
 * I tag funzionali di **Scryfall Tagger**, la seconda delle due sorte di tag
 * (ADR-0003): `counterspell`, `removal`, `win-condition` — quel che i tag
 * nostri, che leggono le regole meccaniche, non sanno dire.
 *
 * Si scaricano qui e si congelano nel pool. L'app non li chiede mai a runtime.
 */
const DESCRITTORE_TAG = "https://api.scryfall.com/bulk-data/oracle-tags";

/**
 * Scryfall chiede a chi usa l'API di farsi riconoscere. È gratis e senza
 * chiave: dichiarare chi siamo è la contropartita, ed è anche la condizione dei
 * termini d'uso su cui si regge la legittimità dell'app (`PROGETTO.md` §3).
 */
const INTESTAZIONI = {
  "User-Agent": "mazzi-fuori-meta/0.0 (app hobbistica non commerciale)",
  Accept: "application/json",
};

const qui = (percorso: string) => fileURLToPath(new URL(percorso, import.meta.url));
const POOL = qui("../public/dati/pool.json");
const LISTINO = qui("../public/dati/prezzi.json");

/**
 * Il documento di formato: lo stesso file che l'app legge nel browser, letto
 * qui col medesimo interprete. Un solo posto sa che forma ha.
 */
const FORMATO = qui("../public/dati/formato.json");

/**
 * Le correzioni a mano ai tag di sinergia: il file che il manutentore scrive e
 * questo comando non riscrive mai. È lì che le correzioni sopravvivono a un
 * aggiornamento dei dati.
 */
const CORREZIONI = qui("./correzioni-tag.txt");

type Descrittore = {
  updated_at: string;
  jsonl_download_uri: string;
  compressed_size?: number;
};

async function principale(): Promise<void> {
  const argomenti = process.argv.slice(2);
  const daFile = leggiOpzione(argomenti, "--da");
  const daFileTag = leggiOpzione(argomenti, "--tag");

  // Il formato si legge **per primo**: senza di lui non si sa nemmeno quali
  // stampe tenere mentre l'archivio scorre, e un errore nel documento deve
  // fermare il comando prima di quattrocento megabyte di rete, non dopo.
  const formato = leggiFormato();
  console.log(
    `Formato «${formato.nome}», lista del ${formato.aggiornatoIl}: ` +
      `${formato.edizioni.length} edizioni ammesse ` +
      `(${formato.edizioni.map((e) => e.codice).join(", ")}), ` +
      `${formato.limitate.carte.length} limitate, ${formato.bandite.carte.length} bandite.`,
  );

  const { grezze, aggiornatoIl } = daFile
    ? await daArchivioLocale(daFile, formato)
    : await daScryfall(formato);

  console.log(`Trovate ${grezze.length} stampe nelle edizioni ammesse.`);

  // Zero stampe si dice **qui**, e non più avanti. Più avanti `preparaPool`
  // confronta i nomi del documento di formato con quelli che ha in mano, e da
  // un archivio vuoto non ne riconosce nessuno: il comando moriva dicendo che
  // il documento nomina carte che non esistono, cioè accusando l'unico dei due
  // file scritto a mano — e l'unico dei due che fosse giusto (ticket 18).
  verificaRaccolto(grezze.length, daFile ?? DESCRITTORE);

  // I tag si chiedono per le carte che abbiamo in mano e non per tutta la
  // storia di Magic: Tagger copre trent'anni, questo formato ne copre uno, e
  // tenere in memoria il resto non servirebbe a nessuno.
  const tag = await tagFunzionali(daFileTag, oracleIdDelle(grezze));

  const lettura = leggiCorrezioni(existsSync(CORREZIONI) ? readFileSync(CORREZIONI, "utf8") : "");
  const preparazione = preparaPool(grezze, {
    formato,
    aggiornatoIl,
    correzioni: lettura.correzioni,
    tag: tag.indice,
  });
  const precedente = poolPrecedente();

  if (lettura.correzioni.length > 0) {
    console.log(
      `Applicate ${lettura.correzioni.length} correzioni a mano dei tag da ` +
        `${percorsoLeggibile(CORREZIONI)}.`,
    );
  }

  // Quel che non ha funzionato nel file scritto a mano si dice **prima** di
  // scrivere il pool e non dopo il diario, che è lungo: una riga con un errore
  // di battitura vuol dire una correzione che non c'è, e il manutentore la deve
  // vedere subito (user story 62). Per lo stesso motivo il comando esce con un
  // codice di errore: se un giorno girerà dentro uno script, deve accorgersene.
  // Anche la riga su una carta che il criterio ha lasciato fuori fa uscire con
  // errore: il nome è giusto, ma la correzione non fa niente, e chi la scrisse
  // la crede in vigore.
  const guaiDeiTag = raccontaCorrezioni({
    problemi: lettura.problemi,
    orfane: preparazione.correzioniOrfane,
    fuoriDalCriterio: preparazione.correzioniFuoriDalCriterio,
  });
  if (guaiDeiTag !== "") {
    console.log("");
    console.log(guaiDeiTag);
    process.exitCode = 1;
  }

  // Il pool vuoto si ferma **qui**, dove si sa ancora di chi è la colpa: le
  // stampe c'erano (`verificaRaccolto` l'ha già chiesto), quindi è il criterio
  // a non averne ammessa nessuna, e il manutentore va mandato al documento e
  // non a riscaricare l'archivio.
  verificaPoolNonVuoto(preparazione.pool, formato);
  scriviPool(preparazione.pool);
  scriviListino(preparazione.pool);

  const conTag = preparazione.pool.carte.filter((c) => c.tagScryfall.length > 0).length;
  console.log(
    `Agganciati ${preparazione.pool.registroTagScryfall.length} tag funzionali di Scryfall ` +
      `Tagger: ne ha almeno uno ${conTag} carte su ${preparazione.pool.carte.length}.`,
  );

  // I tag più freschi delle carte vogliono dire un pool nuovo con la data
  // vecchia — perché la data dei dati è quella delle carte, ed è la stessa dei
  // prezzi. Il pool arriva lo stesso, con l'app; ma il listino porta quella
  // data, e il controllo di freschezza dei prezzi (ticket 11) non scatterà:
  // chi ha già i prezzi di quel giorno non vedrà quelli di oggi, perché oggi
  // non ce ne sono. Succede solo rileggendo un archivio di carte vecchio con `--da`.
  if (tag.aggiornatoIl !== null && tag.aggiornatoIl > aggiornatoIl) {
    console.log(
      `  Attenzione: i tag sono del ${tag.aggiornatoIl}, più freschi delle carte. ` +
        `I prezzi restano del giorno delle carte, quindi le app già installate ` +
        `non prenderanno prezzi nuovi: rilancia senza --da.`,
    );
  }

  console.log("");
  console.log(raccontaDiario(confrontaPool(precedente, preparazione)));
  console.log("");
  console.log(raccontaBuchi(contaBuchi(preparazione.pool)));
  console.log("");
  console.log(raccontaFigure(preparazione.figureDaUnAltraCopia, preparazione.pool.carte.length));

  // Le carte che nessuna copia ammessa descrive. ADR-0006 dà questo caso per
  // impossibile — le stampe straniere di queste edizioni sono complete, ed è
  // misurato — quindi qui non stampa niente. Se stampasse, sarebbe scattata la
  // clausola «si riaprirebbe se» di quell'ADR.
  //
  // Non esce con un codice di errore, a differenza della posta qui sotto, e la
  // differenza è vera: la carta da posta rimasta in catalogo è un documento da
  // correggere, mentre questa è una carta che nel pool ci va e ci sta bene. Il
  // pool scritto è giusto; è la decisione a monte che va riguardata.
  const lingue = raccontaLingue(preparazione.senzaLinguaAmmessa);
  if (lingue !== "") {
    console.log("");
    console.log(lingue);
  }

  // La verifica della posta, che è una verifica e non una fonte: se il pool ne
  // contiene una che la lista non nomina, lo si dice e si esce con un codice di
  // errore, perché una carta da posta rimasta in catalogo non deve passare
  // inosservata. A bandirla resta una riga da scrivere a mano nel documento.
  const posta = raccontaPosta(preparazione.postaNonBandita);
  if (posta !== "") {
    console.log("");
    console.log(posta);
    process.exitCode = 1;
  }

  console.log("");
  console.log(
    `Scritti ${percorsoLeggibile(POOL)} e ${percorsoLeggibile(LISTINO)}: ` +
      `${preparazione.pool.carte.length} carte, dati Scryfall del ${aggiornatoIl}.`,
  );
  console.log("Sono prodotti di compilazione: vanno messi in git, mai modificati a mano.");
}

/** Scarica il descrittore, poi l'archivio, e lo setaccia mentre arriva. */
async function daScryfall(
  formato: Formato,
): Promise<{ grezze: CartaScryfall[]; aggiornatoIl: string }> {
  console.log(`Chiedo a Scryfall qual è l'archivio più fresco…`);
  const risposta = await fetch(DESCRITTORE, { headers: INTESTAZIONI });
  if (!risposta.ok) {
    throw new Error(`Scryfall ha risposto ${risposta.status} al descrittore dell'archivio.`);
  }
  const descrittore = (await risposta.json()) as Descrittore;

  const peso = descrittore.compressed_size;
  console.log(
    `Archivio del ${descrittore.updated_at}` +
      (peso === undefined ? "" : `, ${(peso / 1e6).toFixed(0)} MB compressi`) +
      ". Scarico…",
  );

  const scaricato = await fetch(descrittore.jsonl_download_uri, { headers: INTESTAZIONI });
  if (!scaricato.ok || scaricato.body === null) {
    throw new Error(`Scryfall ha risposto ${scaricato.status} all'archivio.`);
  }

  return {
    // `tsconfig.json` carica anche i tipi del browser, e lì `ReadableStream` è
    // un altro tipo con lo stesso nome: a runtime è quello di Node ed è giusto.
    grezze: await setaccia(Readable.fromWeb(scaricato.body as never), true, formato),
    aggiornatoIl: descrittore.updated_at,
  };
}

/**
 * L'archivio già sul disco. La data dei dati non si inventa: si legge dal nome
 * che Scryfall dà al file, perché il prezzo di ogni carta la porta con sé e
 * sbagliarla vorrebbe dire mentire. Chi la legge — e chi si ferma quando il
 * nome non si sa leggere, o dice un istante che non esiste, o è di un archivio
 * che non è quello giusto — è `archivio-di-scryfall.ts`.
 */
async function daArchivioLocale(
  percorso: string,
  formato: Formato,
): Promise<{ grezze: CartaScryfall[]; aggiornatoIl: string }> {
  const aggiornatoIl = dataDellArchivio(percorso);

  console.log(`Leggo ${percorsoLeggibile(percorso)} (dati del ${aggiornatoIl})…`);
  return {
    grezze: await setaccia(createReadStream(percorso), percorso.endsWith(".gz"), formato),
    aggiornatoIl,
  };
}

/**
 * L'archivio arriva a righe, una carta per riga, e viene setacciato mentre
 * scorre: in memoria restano solo le poche migliaia di carte che ci riguardano,
 * e non il mezzo gigabyte dell'archivio intero.
 */
async function setaccia(
  sorgente: Readable,
  compresso: boolean,
  formato: Formato,
): Promise<CartaScryfall[]> {
  return raccogli(setacciaFlusso(sorgente, compresso), formato);
}

/** Il flusso pronto da leggere a righe: decompresso se serve. */
function setacciaFlusso(sorgente: Readable, compresso: boolean): Readable {
  if (!compresso) return sorgente;

  const decompresso = sorgente.pipe(createGunzip());
  // `pipe` non porta avanti gli errori: senza questo, una rete che cade a metà
  // lascerebbe il comando ad aspettare per sempre invece di dirlo.
  sorgente.on("error", (guaio) => decompresso.destroy(guaio));
  return decompresso;
}

async function raccogli(flusso: Readable, formato: Formato): Promise<CartaScryfall[]> {
  const grezze: CartaScryfall[] = [];
  let lette = 0;

  for await (const grezza of righeJson<CartaScryfall>(flusso)) {
    if (interessante(grezza, formato)) grezze.push(grezza);

    lette += 1;
    if (lette % 100_000 === 0) console.log(`  …${lette.toLocaleString("it")} carte lette`);
  }
  return grezze;
}

/**
 * Le righe di un archivio JSONL, una alla volta e già interpretate. L'archivio
 * ha un oggetto per riga; le parentesi quadre della variante a elenco, se ci
 * sono, non sono un oggetto.
 */
async function* righeJson<T>(flusso: Readable): AsyncGenerator<T> {
  for await (const riga of createInterface({ input: flusso, crlfDelay: Infinity })) {
    const pulita = riga.trim().replace(/,$/, "");
    if (pulita === "" || pulita === "[" || pulita === "]") continue;
    yield JSON.parse(pulita) as T;
  }
}

/**
 * Gli `oracle_id` delle carte in mano: è per quello che Tagger aggancia i suoi
 * tag, e le tre stampe di una carta lo condividono.
 */
function oracleIdDelle(grezze: CartaScryfall[]): Set<string> {
  const identificativi = new Set<string>();
  for (const grezza of grezze) {
    if (grezza.oracle_id !== undefined && grezza.oracle_id !== "") {
      identificativi.add(grezza.oracle_id);
    }
  }
  return identificativi;
}

/**
 * L'archivio dei tag funzionali, scaricato o letto da disco, e ridotto mentre
 * scorre alle sole carte che ci riguardano.
 *
 * L'archivio è orientato al tag e non alla carta — una riga per tag, con
 * dentro tutte le carte che ce l'hanno — e la stragrande maggioranza dei tag
 * non tocca nemmeno una carta del nostro pool: setacciare mentre si legge
 * significa tenere in memoria un migliaio di righe invece di cinquemila piene.
 */
async function tagFunzionali(
  daFile: string | null,
  interessanti: Set<string>,
): Promise<EsitoTag> {
  try {
    const archivio = daFile
      ? apriArchivioLocaleDeiTag(daFile)
      : await scaricaArchivioDeiTag();

    const ridotti: TagRidotto[] = [];
    for await (const grezzo of righeJson<TagGrezzo>(archivio.flusso)) {
      const ridotto = riduciTag(grezzo, interessanti);
      if (ridotto !== null) ridotti.push(ridotto);
    }
    return { indice: indicizzaTag(ridotti), aggiornatoIl: archivio.aggiornatoIl };
  } catch (guaio) {
    // Il pavimento non si perde per il vocabolario (ADR-0003): se Tagger non
    // risponde, o cambia indirizzo, o sparisce, il pool si scrive lo stesso —
    // senza i tag della comunità, con dentro tutto il resto. Buttare via anche
    // ottanta megabyte di carte già scaricate sarebbe il modo peggiore di
    // fallire, e il giorno in cui capiterà è il giorno di un annuncio di bandi.
    //
    // Ma si dice forte, e il comando esce con un codice di errore: un pool a cui
    // mancano di colpo millesettecento tag non deve poter passare inosservato.
    console.log("");
    console.log(
      `I tag funzionali di Scryfall non si sono presi: ${(guaio as Error).message}\n` +
        `  Il pool si scrive lo stesso, senza. Le carte e i ${TAG.length} tag nostri ci ` +
        `sono tutti;\n  quel che manca è il vocabolario della comunità. Riprova più tardi.`,
    );
    process.exitCode = 1;
    return { aggiornatoIl: null };
  }
}

/**
 * Com'è andata la richiesta dei tag: l'indice quando c'è, e la data che
 * l'archivio dichiara — che non è quella del pool, ma serve ad accorgersi
 * quando le due sorgenti non sono dello stesso giorno.
 */
type EsitoTag = {
  indice?: IndiceTag;
  aggiornatoIl: string | null;
};

type ArchivioDeiTag = { flusso: Readable; aggiornatoIl: string | null };

async function scaricaArchivioDeiTag(): Promise<ArchivioDeiTag> {
  const risposta = await fetch(DESCRITTORE_TAG, { headers: INTESTAZIONI });
  if (!risposta.ok) {
    throw new Error(`Scryfall ha risposto ${risposta.status} al descrittore dei tag funzionali.`);
  }
  const descrittore = (await risposta.json()) as Descrittore;

  const peso = descrittore.compressed_size;
  console.log(
    `Tag funzionali del ${descrittore.updated_at}` +
      (peso === undefined ? "" : `, ${(peso / 1e6).toFixed(0)} MB compressi`) +
      ". Scarico…",
  );

  const scaricato = await fetch(descrittore.jsonl_download_uri, { headers: INTESTAZIONI });
  if (!scaricato.ok || scaricato.body === null) {
    throw new Error(`Scryfall ha risposto ${scaricato.status} all'archivio dei tag funzionali.`);
  }
  return {
    flusso: setacciaFlusso(Readable.fromWeb(scaricato.body as never), true),
    aggiornatoIl: descrittore.updated_at,
  };
}

/**
 * L'archivio dei tag già sul disco. Qui la data non si legge dal nome, come
 * invece si fa per le carte: da questo file non viene nessun prezzo, e una data
 * sbagliata non finirebbe sotto gli occhi di nessuno.
 */
function apriArchivioLocaleDeiTag(percorso: string): ArchivioDeiTag {
  console.log(`Leggo i tag funzionali da ${percorsoLeggibile(percorso)}…`);
  return {
    flusso: setacciaFlusso(createReadStream(percorso), percorso.endsWith(".gz")),
    aggiornatoIl: null,
  };
}

/**
 * Il documento di formato, letto dal disco con lo stesso interprete che usa
 * l'app: quel che qui non passa non passerebbe nemmeno nel browser, e il
 * manutentore lo scopre sulla propria macchina invece che sul telefono.
 */
function leggiFormato(): Formato {
  if (!existsSync(FORMATO)) {
    throw new Error(
      `Manca ${percorsoLeggibile(FORMATO)}: senza documento di formato non si sa ` +
        `quale gioco si sta preparando, e non lo si può indovinare.`,
    );
  }
  return interpretaFormato(JSON.parse(readFileSync(FORMATO, "utf8")));
}

/** Il pool com'era prima di questo giro, se esiste: serve solo al diario. */
function poolPrecedente(): Pool | null {
  if (!existsSync(POOL)) return null;
  try {
    return JSON.parse(readFileSync(POOL, "utf8")) as Pool;
  } catch {
    console.log("Il pool precedente non si legge: il diario racconterà un primo giro.");
    return null;
  }
}

/**
 * Il pool si scrive con una carta per riga: è JSON valido, ma un diff di git
 * mostra le carte cambiate invece di una riga lunga due megabyte. Il file non
 * si modifica a mano, ma si deve poter *leggere* cosa è cambiato.
 */
function scriviPool(pool: Pool): void {
  // L'ultima rete, e non più una diagnosi: chi sa *perché* il pool è vuoto —
  // l'archivio o il criterio — l'ha già chiesto e l'ha già detto, ognuno con la
  // sua frase. Se si arriva qui è perché nessuna delle due ha parlato, e allora
  // l'unica cosa vera da dire è che scrivere cancellerebbe in silenzio l'unico
  // file che fa funzionare l'app offline.
  if (pool.carte.length === 0) {
    throw new Error("Il pool è vuoto e nessuno sa dire perché: il file non viene toccato.");
  }

  mkdirSync(qui("../public/dati"), { recursive: true });
  const carte = pool.carte.map((carta) => JSON.stringify(carta)).join(",\n");
  // Anche il registro dei tag va a righe, e per la stessa ragione delle carte:
  // fra due aggiornamenti la comunità ne aggiunge e ne toglie una manciata, e
  // il diff deve poter mostrare quali.
  const tag = pool.registroTagScryfall.map((voce) => JSON.stringify(voce)).join(",\n");
  writeFileSync(
    POOL,
    `{\n"generatoIl": ${JSON.stringify(pool.generatoIl)},\n` +
      // Da quale documento di formato viene questo pool: una riga sua, come la
      // data, perché è l'altra metà della stessa domanda — da dove vengono
      // queste carte — e perché il diff la deve mostrare da sola.
      `"improntaDelDocumento": ${JSON.stringify(pool.improntaDelDocumento)},\n` +
      `"registroTagScryfall": [\n${tag}\n],\n` +
      `"carte": [\n${carte}\n]\n}\n`,
    "utf8",
  );
}

/**
 * Il listino dei prezzi si scrive con una voce per riga, come le carte del pool:
 * è il file che cambia a ogni giro, e il diff deve mostrare quali prezzi.
 *
 * Viene dallo stesso pool appena scritto, e mai da un giro a parte: chi entra e
 * quale copia prezza una carta lo decide la stessa preparazione, e un listino
 * fatto altrove potrebbe prezzare carte che il pool non ha.
 */
function scriviListino(pool: Pool): void {
  const listino = listinoDelPool(pool);
  const voci = listino.prezzi.map((voce) => JSON.stringify(voce)).join(",\n");
  writeFileSync(
    LISTINO,
    `{\n"generatoIl": ${JSON.stringify(listino.generatoIl)},\n` +
      `"improntaDelDocumento": ${JSON.stringify(listino.improntaDelDocumento)},\n` +
      `"prezzi": [\n${voci}\n]\n}\n`,
    "utf8",
  );
}

function leggiOpzione(argomenti: string[], nome: string): string | null {
  const posizione = argomenti.indexOf(nome);
  if (posizione === -1) return null;
  const valore = argomenti[posizione + 1];
  if (valore === undefined) throw new Error(`A ${nome} manca il percorso del file.`);
  return valore;
}

function percorsoLeggibile(percorso: string): string {
  return percorso.replace(qui("../"), "").replaceAll("\\", "/");
}

await principale();
