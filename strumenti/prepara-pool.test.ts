import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { interpretaFormato } from "../src/dati/carica-formato.ts";
import { improntaDelDocumento } from "../src/dati/impronta-del-documento.ts";
import type { Formato } from "../src/dati/formato.ts";
import type { Carta, Pool } from "../src/dati/pool.ts";
import { COPIE_MASSIME } from "../src/mazzo/taratura.ts";
import {
  confrontaPool,
  contaBuchi,
  preparaPool,
  raccontaBuchi,
  raccontaDiario,
  raccontaFigure,
  raccontaLingue,
  raccontaPosta,
  verificaPoolNonVuoto,
  verificaRaccolto,
  type Buchi,
  type CartaScryfall,
} from "./prepara-pool.ts";
import { indicizzaTag } from "./tag-di-scryfall.ts";

/**
 * Cucitura 2 della specifica: `preparaPool(datiGrezzi, formato) → pool`.
 *
 * Il formato entra come **parametro**, quindi qui non si sa niente del gioco
 * vero: il documento è finto, le edizioni sono inventate, e i nomi delle carte
 * pure. Un test che nominasse una carta vera proverebbe la lista invece del
 * codice, e si romperebbe il giorno che il gruppo cambia idea.
 *
 * Il materiale di prova è un frammento di archivio Scryfall scritto a mano sui
 * casi difficili di *questo* pool: carta solo inglese, carta in due edizioni
 * ammesse a prezzi diversi, carta con immagine italiana segnaposto, carta
 * limitata, carta bandita, carta col permesso nel testo, carta senza prezzo.
 */
const daProva = (nome: string): string =>
  fileURLToPath(new URL(`./materiale-di-prova/${nome}`, import.meta.url));

const FRAMMENTO: CartaScryfall[] = JSON.parse(
  readFileSync(daProva("frammento-scryfall.json"), "utf8"),
);

/**
 * Il documento di formato finto passa dal lettore vero: così questi test
 * provano anche che i due pezzi si parlano, e un campo rinominato da una parte
 * sola non passa inosservato.
 */
const FORMATO: Formato = interpretaFormato(
  JSON.parse(readFileSync(daProva("formato-finto.json"), "utf8")),
);

const QUANDO = "2026-09-06T09:17:09.373+00:00";

const preparazione = () => preparaPool(FRAMMENTO, { formato: FORMATO, aggiornatoIl: QUANDO });

/** Lo stesso formato con una voce cambiata: i test che toccano una riga sola. */
function formatoCon(cambio: Partial<Formato>): Formato {
  return { ...FORMATO, ...cambio };
}

/**
 * Lo stesso formato con le lingue di **una** edizione cambiate: è il modo in
 * cui questi test provano che la regola arriva dal documento e non dal codice.
 */
function conLingue(codice: string, lingue: string[]): Formato {
  return formatoCon({
    edizioni: FORMATO.edizioni.map((edizione) =>
      edizione.codice === codice ? { ...edizione, lingue } : edizione,
    ),
  });
}

/** Una stampa del materiale di prova, per id: i test che ne aggiungono una simile. */
function stampaDiProva(id: string): CartaScryfall {
  const trovata = FRAMMENTO.find((stampa) => stampa.id === id);
  if (!trovata) throw new Error(`la stampa «${id}» non è nel materiale di prova`);
  return trovata;
}

function carta(pool: Pool, nome: string): Carta {
  const trovata = pool.carte.find((c) => c.nome === nome);
  if (!trovata) throw new Error(`la carta «${nome}» non è nel pool`);
  return trovata;
}

describe("passo 1 — chi entra", () => {
  it("prende la carta che ha una stampa italiana in un'edizione ammessa", () => {
    expect(preparazione().pool.carte.map((c) => c.nome)).toContain("Fixture Goblin");
  });

  it("lascia fuori la carta che in quelle edizioni esiste solo in inglese", () => {
    expect(preparazione().pool.carte.map((c) => c.nome)).not.toContain("Fixture Relic");
  });

  it("lascia fuori la carta che in italiano c'è, ma in un'edizione che il formato non ammette", () => {
    expect(preparazione().pool.carte.map((c) => c.nome)).not.toContain("Fixture Antico");
  });

  it("conta per nome e non per stampa: due edizioni ammesse fanno una carta sola", () => {
    const nomi = preparazione().pool.carte.map((c) => c.nome);
    expect(nomi.filter((nome) => nome === "Fixture Goblin")).toHaveLength(1);
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it("non si lascia sdoppiare dalle stampe fronte-retro della stessa carta", () => {
    // Scryfall chiama «Fixture Anchorage // Fixture Anchorage» una stampa che
    // ha la stessa carta sui due lati. È un nome diverso, quindi passerebbe il
    // controllo dei doppioni qui sopra — e il pool si ritroverebbe due terre
    // dove ce n'è una, con otto copie legali al posto di quattro.
    const nomi = preparazione().pool.carte.map((c) => c.nome);
    expect(nomi).not.toContain("Fixture Anchorage // Fixture Anchorage");
    expect(nomi.filter((nome) => nome.startsWith("Fixture Anchorage"))).toHaveLength(1);
  });

  it("lascia fuori le carte che nascono da un'unione, che in un mazzo non ci vanno", () => {
    // I dati la dichiarano una carta, ed è vero: ma arriva in gioco solo unendo
    // due carte, e un motore che la mettesse in lista scriverebbe un mazzo
    // impossibile da giocare.
    expect(preparazione().pool.carte.map((c) => c.nome)).not.toContain("Fixture Colossus");
  });

  it("con l'altro criterio prende anche la carta che l'italiano non ha mai avuto", () => {
    // Il codice sa eseguire due criteri e non ne preferisce nessuno: quale sia
    // il gioco vero lo dice il documento, e cambiarlo cambia il pool.
    const { pool } = preparaPool(FRAMMENTO, {
      formato: formatoCon({
        criterio: { ...FORMATO.criterio, regola: "solo-edizioni" },
      }),
      aggiornatoIl: QUANDO,
    });

    expect(pool.carte.map((c) => c.nome)).toContain("Fixture Relic");
    expect(pool.carte.map((c) => c.nome)).not.toContain("Fixture Antico");
  });

  it("tiene anche le carte che il formato bandisce: le toglie l'app, leggendo il documento", () => {
    // ADR-0008. Il pool si congela nell'app e il documento di formato si
    // aggiorna da solo: una carta tolta di qui non potrebbe tornare il giorno
    // che il gruppo la sbandisce, senza un pool nuovo.
    const esito = preparazione();
    expect(esito.pool.carte.map((c) => c.nome)).toContain("Fixture Contratto");
    expect(esito.bandite).toEqual(["Fixture Contratto"]);
  });

  it("si ferma se il documento nomina una carta che non esiste", () => {
    // È così che un errore di battitura nel documento si scopre subito, invece
    // di restare una limitata che non limita niente.
    const storto = formatoCon({
      limitate: {
        ...FORMATO.limitate,
        carte: [
          { carta: "Fixture Sigilo", perché: "scritta storta", divergenza: null, daConfermare: null },
        ],
      },
    });

    expect(() => preparaPool(FRAMMENTO, { formato: storto, aggiornatoIl: QUANDO })).toThrow(
      /Fixture Sigilo/,
    );
  });

  it("non chiama errore di battitura una carta bandita", () => {
    expect(() => preparazione()).not.toThrow();
  });
});

describe("passo 2 — cosa si mostra", () => {
  it("prende immagine, prezzo e rarità dalla prima lingua dichiarata, la più economica", () => {
    const goblin = carta(preparazione().pool, "Fixture Goblin");

    expect(goblin.prezzo.euro).toBe(0.09);
    expect(goblin.id).toBe("goblin-xb-en");
    expect(goblin.immagine?.normale).toBe("https://immagini/goblin-economica-normale.jpg");
    expect(goblin.rarita).toBe("common");
  });

  it("conserva quale stampa ha usato, che è quel che si cerca su Cardmarket", () => {
    const goblin = carta(preparazione().pool, "Fixture Goblin");

    expect(goblin.edizione).toBe("xb");
    expect(goblin.numeroDiCollezione).toBe("7");
    expect(goblin.linguaDellaStampa).toBe("en");
  });

  it("non guarda le stampe che non esistono su carta, per quanto costino poco", () => {
    expect(carta(preparazione().pool, "Fixture Goblin").id).not.toBe("goblin-xb-digitale");
  });

  it("scende alla lingua dopo quando della prima non esiste nessuna stampa", () => {
    // `xa` dichiara «en, it, fr» e la Duale in inglese non esiste: la descrive
    // l'italiana, che è la seconda dell'elenco. Il nome e il testo restano
    // inglesi lo stesso, perché Scryfall li scrive in inglese su ogni stampa;
    // quel che manca è il prezzo, e viene da un'altra copia ammessa.
    const duale = carta(preparazione().pool, "Fixture Duale");

    expect(duale.linguaDellaStampa).toBe("it");
    expect(duale.edizione).toBe("xa");
    expect(duale.nome).toBe("Fixture Duale");
    expect(duale.testo).toContain("Add {B} or {U}");
    expect(duale.immagine?.normale).toBe("https://immagini/duale-italiana-normale.jpg");
  });

  it("non si lascia descrivere da una lingua più in basso nell'ordine che costa meno", () => {
    // La stessa carta in francese, stessa edizione, e il francese `xa` lo
    // ammette: al tavolo quella copia passa. A **descrivere** la carta non ci
    // arriva lo stesso, perché nell'elenco viene dopo l'italiano — l'ordine è
    // la preferenza, e il prezzo non la scavalca.
    const duale = carta(preparazione().pool, "Fixture Duale");

    expect(duale.linguaDellaStampa).toBe("it");
    expect(duale.edizione).toBe("xa");
    expect(duale.nomeItaliano).toBe("Palude Tropicale");
  });

  it("regge una carta senza prezzo su nessuna stampa, invece di cadere", () => {
    const pauper = carta(preparazione().pool, "Fixture Pauper");
    expect(pauper.prezzo.euro).toBeNull();
    expect(pauper.prezzo.aggiornatoIl).toBe(QUANDO);
  });

  it("porta il prezzo con la sua data, che è quella dei dati", () => {
    const { pool } = preparazione();
    expect(pool.generatoIl).toBe(QUANDO);
    expect(carta(pool, "Fixture Goblin").prezzo.aggiornatoIl).toBe(QUANDO);
  });

  it("prende l'immagine dalla stampa che descrive finché ce n'è una", () => {
    // Il Segnaposto ha la figura buona sull'inglese e un segnaposto
    // sull'italiana: finché a descrivere è l'inglese, la figura è la sua e non
    // c'è nessun prestito di mezzo.
    expect(carta(preparazione().pool, "Fixture Segnaposto").immagine?.normale).toBe(
      "https://immagini/segnaposto-normale.jpg",
    );

    const { pool } = preparaPool(FRAMMENTO, {
      formato: conLingue("xa", ["it", "en", "fr"]),
      aggiornatoIl: QUANDO,
    });

    // Mostrata l'italiana, che di figura ha un dorso, la carta non resta al
    // buio: la figura arriva dall'inglese della stessa edizione e dello stesso
    // numero di collezione (ADR-0007). L'identità della stampa non si sposta di
    // un millimetro — edizione, numero e lingua restano quelli dell'italiana:
    // è la sola figura a essere presa in prestito.
    const segnaposto = carta(pool, "Fixture Segnaposto");
    expect(segnaposto.linguaDellaStampa).toBe("it");
    expect(segnaposto.immagine?.normale).toBe("https://immagini/segnaposto-normale.jpg");
    expect(segnaposto.prezzo.euro).toBe(0.25);
  });

  it("non spaccia per immagine il dorso di una carta quando altro non c'è", () => {
    // Scryfall gli indirizzi li dà lo stesso, e puntano a un dorso: mostrarlo
    // sarebbe peggio del riquadro vuoto, e nasconderebbe il buco al manutentore.
    expect(carta(preparazione().pool, "Fixture Velo").immagine).toBeNull();
  });

  it("non lascia rientrare il dorso dalla faccia, che è della stessa stampa", () => {
    // Lo stato dell'immagine Scryfall lo dichiara una volta per stampa. Guardato
    // solo al livello della carta, il davanti glielo ridava indietro: stessa
    // figura, stesso indirizzo, e l'utente avrebbe visto un dorso.
    const doppia = carta(preparazione().pool, "Fixture Dorso // Fixture Rovescio");

    expect(doppia.immagine).toBeNull();
    expect(doppia.facce?.[0]?.immagine).toBeNull();
  });

  it("conserva il nome italiano di ogni carta che ne ha uno, come chiave di ricerca", () => {
    const { pool } = preparazione();
    expect(carta(pool, "Fixture Goblin").nomeItaliano).toBe("Folletto di Prova");
    expect(carta(pool, "Fixture Duale").nomeItaliano).toBe("Palude Tropicale");
  });

  it("lascia il nome italiano vuoto quando la carta una stampa italiana non ce l'ha", () => {
    const { pool } = preparaPool(FRAMMENTO, {
      formato: formatoCon({ criterio: { ...FORMATO.criterio, regola: "solo-edizioni" } }),
      aggiornatoIl: QUANDO,
    });

    expect(carta(pool, "Fixture Relic").nomeItaliano).toBeNull();
  });

  it("prende il nome italiano dall'edizione mostrata, non dalla stampa italiana più vecchia", () => {
    // Ticket 42. L'Abominio è mostrato dall'italiana di xd, e in italiano esiste
    // anche in xc, che è più vecchia. Nessuna delle due ha un listino, quindi il
    // prezzo non decide e a scegliere arrivava la data: l'alias di ricerca era
    // il nome stampato su un'edizione che all'utente non è mai stata nominata.
    const rinominato = FRAMMENTO.map((stampa) =>
      stampa.id === "abominio-xc-it" ? { ...stampa, printed_name: "Abominio Vecchio" } : stampa,
    );
    const { pool } = preparaPool(rinominato, { formato: FORMATO, aggiornatoIl: QUANDO });

    const abominio = carta(pool, "Fixture Abominio");
    expect(abominio.edizione).toBe("xd");
    expect(abominio.nomeItaliano).toBe("Abominio di Prova");
  });

  it("per una carta mostrata in un'altra lingua prende l'italiana della stessa edizione", () => {
    // Il Goblin è mostrato dall'inglese di xb. Con un'italiana di xb accanto,
    // il nome da cercare è quello scritto sulla copia di quell'edizione, anche
    // se in xa ce n'è una più vecchia.
    const conSorella = [
      ...FRAMMENTO,
      {
        ...stampaDiProva("goblin-xa-it"),
        id: "goblin-xb-it",
        set: "xb",
        collector_number: "7",
        released_at: "1995-04-01",
        printed_name: "Folletto Ristampato",
      },
    ];
    const { pool } = preparaPool(conSorella, { formato: FORMATO, aggiornatoIl: QUANDO });

    const goblin = carta(pool, "Fixture Goblin");
    expect(goblin.edizione).toBe("xb");
    expect(goblin.linguaDellaStampa).toBe("en");
    expect(goblin.nomeItaliano).toBe("Folletto Ristampato");
  });

  it("senza un'italiana nell'edizione mostrata ripiega su un'altra, e sempre sulla stessa", () => {
    // Il Goblin mostrato da xb in italiano c'è solo in xa: il nome resta, perché
    // una carta che si cerca solo in inglese il destinatario non la trova.
    const { pool } = preparazione();
    expect(carta(pool, "Fixture Goblin").edizione).toBe("xb");
    expect(carta(pool, "Fixture Goblin").nomeItaliano).toBe("Folletto di Prova");
    expect(JSON.stringify(preparazione().pool)).toBe(JSON.stringify(pool));
  });

  it("non si lascia svuotare il nome da una stampa mostrata che non ne ha scritto uno", () => {
    // Una scritta vuota sull'italiana di xd non toglie la chiave di ricerca: il
    // nome arriva dall'italiana di un'altra edizione, che uno ce l'ha.
    const senzaNome = FRAMMENTO.map((stampa) =>
      stampa.id === "abominio-xd-it" ? { ...stampa, printed_name: " " } : stampa,
    );
    const { pool } = preparaPool(senzaNome, { formato: FORMATO, aggiornatoIl: QUANDO });

    const abominio = carta(pool, "Fixture Abominio");
    expect(abominio.edizione).toBe("xd");
    expect(abominio.nomeItaliano).toBe("Abominio di Prova");
  });

  it("conserva i campi che servono, e nient'altro", () => {
    const goblin = carta(preparazione().pool, "Fixture Goblin");

    expect(goblin.costoDiMana).toBe("{1}{R}");
    expect(goblin.valoreDiMana).toBe(2);
    expect(goblin.identitaDiColore).toEqual(["R"]);
    expect(goblin.tipi).toEqual(["Creature"]);
    expect(goblin.sottotipi).toEqual(["Goblin", "Warrior"]);
    expect(goblin.testo).toContain("it deals 1 damage to target player");
    expect(goblin.forza).toBe("2");
    expect(goblin.costituzione).toBe("1");
    expect(goblin.terra).toBeNull();
    expect(goblin.facce).toBeNull();

    // I campi Scryfall che non servono non arrivano fino all'app: il pool è
    // incluso nel pacchetto e ogni campo di troppo è peso sul telefono.
    expect(Object.keys(goblin).sort()).toEqual(
      [
        "costituzione",
        "costoDiMana",
        "edizione",
        "facce",
        "forza",
        "id",
        "identitaDiColore",
        "immagine",
        "linguaDellaStampa",
        "nome",
        "nomeItaliano",
        "numeroDiCollezione",
        "prezzo",
        "rarita",
        "riservata",
        "sottotipi",
        "tag",
        "tagScryfall",
        "terra",
        "tettoDiCopie",
        "testo",
        "tipi",
        "valoreDiMana",
      ].sort(),
    );
  });
});

describe("le lingue ammesse, che il documento dichiara per edizione", () => {
  it("descrive la carta con la prima lingua dell'ordine dichiarato, e non con la più economica", () => {
    // La Trilingue esiste in tre lingue ammesse dalla stessa edizione, a tre
    // prezzi diversi. A descriverla vince l'inglese perché è la **prima**
    // dell'elenco, non perché costi meno: costa il triplo della francese.
    const trilingue = carta(preparazione().pool, "Fixture Trilingue");

    expect(trilingue.linguaDellaStampa).toBe("en");
    expect(trilingue.edizione).toBe("xa");
  });

  it("cambia la stampa mostrata quando il documento cambia l'ordine delle lingue", () => {
    // È la prova che l'ordine **è** la preferenza, e non un caso: si sposta una
    // parola in un file di dati, e centinaia di carte del pool vero cambiano
    // stampa senza un commit di codice.
    const { pool } = preparaPool(FRAMMENTO, {
      formato: conLingue("xa", ["it", "en", "fr"]),
      aggiornatoIl: QUANDO,
    });

    expect(carta(pool, "Fixture Trilingue").linguaDellaStampa).toBe("it");
  });

  it("non si fa descrivere da una stampa in una lingua che l'edizione non ammette", () => {
    // La tedesca della Trilingue costa un centesimo: è la più economica di
    // tutte, e non descrive niente. Che resti fuori non è una proprietà del
    // tedesco — dichiarata, la stessa stampa descrive la carta: è la prova che
    // la lingua non è cablata da nessuna parte, e che l'unica cosa che la tiene
    // fuori è l'elenco del documento.
    expect(carta(preparazione().pool, "Fixture Trilingue").linguaDellaStampa).toBe("en");

    const { pool } = preparaPool(FRAMMENTO, {
      formato: conLingue("xa", ["de", "en", "it", "fr"]),
      aggiornatoIl: QUANDO,
    });

    expect(carta(pool, "Fixture Trilingue").linguaDellaStampa).toBe("de");
  });

  it("non prezza da una stampa in una lingua che l'edizione non ammette", () => {
    // Il pavimento è il prezzo di una copia **legale**: se la tedesca entrasse,
    // il tetto di spesa conterebbe un cartoncino che al tavolo l'arbitro
    // respinge.
    const trilingue = carta(preparazione().pool, "Fixture Trilingue");

    expect(trilingue.prezzo.euro).toBe(0.5);
    expect(trilingue.prezzo.stampa?.lingua).toBe("fr");
  });

  it("tratta la stessa lingua in modo diverso in due edizioni con elenchi diversi", () => {
    // È il cuore della regola. La Straniera ha una stampa francese in ciascuna
    // delle due edizioni: xa il francese lo ammette, xb no. Vince quella di xa,
    // che costa dieci volte tanto — e un formato con un elenco di lingue solo
    // non lo proverebbe.
    const straniera = carta(preparazione().pool, "Fixture Straniera");

    expect(straniera.prezzo.euro).toBe(1);
    expect(straniera.prezzo.stampa).toEqual({
      edizione: "xa",
      numeroDiCollezione: "600",
      lingua: "fr",
    });
  });

  it("cambia risposta sulla stessa carta se l'altra edizione ammette quella lingua", () => {
    const { pool } = preparaPool(FRAMMENTO, {
      formato: conLingue("xb", ["en", "it", "fr"]),
      aggiornatoIl: QUANDO,
    });

    expect(carta(pool, "Fixture Straniera").prezzo.euro).toBe(0.1);
  });

  it("regge una lingua dichiarata per la quale non esiste nessuna stampa", () => {
    // Un'edizione dichiarata generosamente resta lecita: il documento è scritto
    // a mano, e chi lo scrive non ha davanti l'elenco delle stampe che esistono.
    const { pool } = preparaPool(FRAMMENTO, {
      formato: conLingue("xc", ["ja", "it", "ru"]),
      aggiornatoIl: QUANDO,
    });

    expect(carta(pool, "Fixture Velo").linguaDellaStampa).toBe("it");
  });

  it("fa entrare lo stesso la carta che in nessuna lingua ammessa esiste, e lo dice", () => {
    // Il caso che ADR-0006 dichiara impossibile oggi. La lingua non è un
    // criterio e non deve togliere nomi: la carta entra, e la preparazione lo
    // dice a voce alta invece di lasciarlo sparire.
    const esito = preparaPool(FRAMMENTO, {
      formato: conLingue("xc", ["en"]),
      aggiornatoIl: QUANDO,
    });

    expect(esito.pool.carte.map((c) => c.nome)).toContain("Fixture Velo");
    expect(esito.senzaLinguaAmmessa).toEqual(["Fixture Velo"]);
  });

  it("non tappa il buco della carta che segnala col prezzo di una copia non ammessa", () => {
    // La Trilingue ha un listino su tutte e quattro le sue stampe. Con
    // un'edizione che non ne ammette nessuna, il prezzo deve sparire del tutto:
    // prendere il più basso che c'è sarebbe il prezzo di una carta che al
    // tavolo non si può giocare, cioè il contrario di un pavimento.
    const esito = preparaPool(FRAMMENTO, {
      formato: conLingue("xa", ["ja"]),
      aggiornatoIl: QUANDO,
    });

    const trilingue = carta(esito.pool, "Fixture Trilingue");
    expect(esito.senzaLinguaAmmessa).toContain("Fixture Trilingue");
    expect(trilingue.prezzo.euro).toBeNull();
    expect(trilingue.prezzo.stampa).toBeNull();
  });

  it("resta muta quando ogni carta ha una copia ammessa", () => {
    expect(preparazione().senzaLinguaAmmessa).toEqual([]);
    expect(raccontaLingue([])).toBe("");
    expect(raccontaLingue(["Fixture Velo"])).toContain("Fixture Velo");
  });
});

describe("a pari lingua, l'edizione mostrata la sceglie il prezzo", () => {
  it("mostra l'italiana dell'edizione da cui il prezzo viene, non la più vecchia", () => {
    // Il caso che il ticket 30 ha misurato: l'Abominio esiste in italiano in
    // due edizioni, e nessuna delle due italiane ha un listino. A pari rango di
    // lingua il prezzo non decide niente, e a decidere restava la data — cioè
    // l'edizione più vecchia, che è anche la più rara. Il giocatore leggeva il
    // numero di collezione di una carta e il prezzo di un'altra.
    const abominio = carta(preparazione().pool, "Fixture Abominio");

    expect(abominio.linguaDellaStampa).toBe("it");
    expect(abominio.edizione).toBe("xd");
    expect(abominio.numeroDiCollezione).toBe("117");
    expect(abominio.prezzo.euro).toBe(0.22);
    expect(abominio.prezzo.stampa).toEqual({
      edizione: "xd",
      numeroDiCollezione: "117",
      lingua: "en",
    });
  });

  it("non lascia che l'edizione del prezzo scavalchi l'ordine delle lingue", () => {
    // La Ristampa è prezzata da xb, ma la sua stampa di primo rango sta in xa:
    // l'edizione del prezzo è uno spareggio, non una preferenza, e non entra
    // mai prima della lingua che il documento dichiara. Le due stampe restano
    // di edizioni diverse, ed è l'interfaccia a doverlo dire.
    const ristampa = carta(preparazione().pool, "Fixture Ristampa");

    expect(ristampa.edizione).toBe("xa");
    expect(ristampa.linguaDellaStampa).toBe("en");
    expect(ristampa.prezzo.stampa?.edizione).toBe("xb");
  });

  it("prende la figura dalla copia di fianco quando la stampa mostrata ha un segnaposto", () => {
    // Il costo che seguire il prezzo si porta dietro: l'italiana dell'edizione
    // che prezza spesso Scryfall non l'ha scansionata, e mostrarla vorrebbe
    // dire togliere la figura a metà del pool. La si prende dalla copia ammessa
    // della **stessa edizione e dello stesso numero di collezione**: stessa
    // illustrazione, stesso bordo, un'altra scritta. Non da un'altra edizione,
    // che sarebbe un'altra figura.
    const abominio = carta(preparazione().pool, "Fixture Abominio");

    expect(abominio.edizione).toBe("xd");
    expect(abominio.linguaDellaStampa).toBe("it");
    expect(abominio.immagine?.normale).toBe("https://immagini/abominio-xd-en-normale.jpg");
  });

  it("conta le figure prese in prestito, invece di lasciarle passare in silenzio", () => {
    // Nel pool la carta non porta scritto che la figura è di un'altra copia:
    // il conto è l'unico posto in cui la cosa si vede, e serve a chi tiene
    // l'app per accorgersi se un giorno diventa la regola invece che il caso.
    // Sono due: l'Abominio, che l'italiana di xd ce l'ha col dorso, e il
    // Bifronte, che il dorso ce l'ha sulle facce.
    expect(preparazione().figureDaUnAltraCopia).toBe(2);
  });

  it("non fa rientrare il dorso dalla porta di servizio delle facce", () => {
    // La faccia che nella copia in prestito non esiste non deve riprendersi i
    // **propri** indirizzi — che puntano a un dorso, ed è il motivo per cui la
    // figura si stava prendendo altrove — col permesso dello stato della copia
    // buona. Stato e indirizzi dicono insieme se una figura esiste, e
    // scambiarne uno solo rimette in circolo quel che lo stato tiene fuori.
    const bifronte = carta(preparazione().pool, "Fixture Bifronte // Fixture Retro");

    expect(bifronte.linguaDellaStampa).toBe("it");
    expect(bifronte.facce?.[0]?.immagine?.normale).toBe(
      "https://immagini/bifronte-davanti-normale.jpg",
    );
    expect(bifronte.facce?.[1]?.immagine).toBeNull();
  });

  it("non va a cercare la figura in un'altra edizione", () => {
    // Il Velo ha per unica stampa un segnaposto, e resta senza figura: prenderla
    // altrove vorrebbe dire mostrare l'illustrazione di un'altra edizione sotto
    // il numero di collezione di questa.
    expect(carta(preparazione().pool, "Fixture Velo").immagine).toBeNull();
  });

  it("torna a decidere per data quando nessuna copia ammessa ha un listino", () => {
    // Senza prezzo non c'è nessuna edizione da seguire, e lo spareggio resta
    // l'unica cosa che rende la scelta ripetibile. Ci arriva però solo quando
    // non c'è altro: il pool finisce in git, e due preparazioni sugli stessi
    // dati devono scrivere lo stesso file.
    const { pool } = preparaPool(FRAMMENTO, {
      formato: conLingue("xd", ["it"]),
      aggiornatoIl: QUANDO,
    });
    const abominio = carta(pool, "Fixture Abominio");

    expect(abominio.prezzo.euro).toBeNull();
    expect(abominio.edizione).toBe("xc");
  });
});

describe("passo 3 - quale stampa fa il prezzo", () => {
  it("prende il prezzo dalla stampa ammessa piu economica che un listino ce l'abbia", () => {
    // È il caso normale del pool vero: le stampe italiane, che sono quelle
    // mostrate, su Cardmarket un listino non ce l'hanno, e il tetto di spesa
    // teneva fuori quelle carte non perché costassero ma perché non sapeva
    // quanto costano.
    const duale = carta(preparazione().pool, "Fixture Duale");

    expect(duale.prezzo.euro).toBe(280);
    expect(duale.prezzo.stampa).toEqual({
      edizione: "xa",
      numeroDiCollezione: "288",
      lingua: "fr",
    });
  });

  it("dice quale stampa ha fatto il prezzo anche quando è quella che descrive", () => {
    // Il caso normale non ha niente di speciale da dire, e proprio per questo
    // lo dice come tutti gli altri: chi legge il prezzo non deve indovinare
    // quando la provenienza c'è e quando manca.
    const goblin = carta(preparazione().pool, "Fixture Goblin");

    expect(goblin.prezzo.euro).toBe(0.09);
    expect(goblin.prezzo.stampa).toEqual({
      edizione: "xb",
      numeroDiCollezione: "7",
      lingua: "en",
    });
  });

  it("cerca il prezzo anche nelle altre edizioni ammesse, non solo in quella che descrive", () => {
    const ristampa = carta(preparazione().pool, "Fixture Ristampa");

    expect(ristampa.edizione).toBe("xa");
    expect(ristampa.linguaDellaStampa).toBe("en");
    expect(ristampa.prezzo.euro).toBe(1.5);
    expect(ristampa.prezzo.stampa).toEqual({
      edizione: "xb",
      numeroDiCollezione: "12",
      lingua: "it",
    });
  });

  it("non prezza da un'edizione che il formato non ammette, per quanto costi poco", () => {
    // Il pavimento è il prezzo di una copia **legale**: la stampa da cinque
    // centesimi di un'edizione fuori formato è un numero vero di una carta che
    // al tavolo l'arbitro respinge.
    expect(carta(preparazione().pool, "Fixture Ristampa").prezzo.euro).not.toBe(0.05);
  });

  it("non guarda le stampe che non esistono su carta nemmeno per il prezzo", () => {
    // La stampa digitale del materiale di prova costa un centesimo, cioè meno
    // di ogni altra: se il prezzo la guardasse, sarebbe lei a vincere. Si
    // controlla l'euro e non l'identificativo, perché è l'euro che l'utente
    // legge — e perché il prezzo della digitale non è il prezzo di niente che
    // si possa portare al tavolo.
    expect(carta(preparazione().pool, "Fixture Goblin").prezzo.euro).toBe(0.09);
  });

  it("lascia il prezzo assente e **senza** provenienza quando nessuna stampa ammessa ha listino", () => {
    // Non si prende il prezzo di una copia non ammessa per tappare il buco: una
    // provenienza scritta su un euro che non c'è sarebbe una mezza verità.
    const pauper = carta(preparazione().pool, "Fixture Pauper");

    expect(pauper.prezzo.euro).toBeNull();
    expect(pauper.prezzo.stampa).toBeNull();
    expect(pauper.prezzo.aggiornatoIl).toBe(QUANDO);
  });

  it("non cade su una carta che un listino non ce l'ha da nessuna parte", () => {
    expect(() => preparazione()).not.toThrow();
  });
});

describe("la Reserved List", () => {
  it("segna la carta che Scryfall dichiara riservata", () => {
    // È il fatto che spiega i prezzi di questo pool: una carta riservata non
    // sarà mai ristampata, quindi il tetto di spesa che la lascia fuori la
    // lascia fuori per sempre. L'app lo dice, e per dirlo deve saperlo.
    expect(carta(preparazione().pool, "Fixture Duale").riservata).toBe(true);
  });

  it("non la segna quando Scryfall non ne dice niente", () => {
    // Il campo assente vuol dire «non riservata»: è la risposta giusta per la
    // stragrande maggioranza delle carte, e non inventa niente.
    expect(carta(preparazione().pool, "Fixture Goblin").riservata).toBe(false);
  });
});

describe("il tetto di copie", () => {
  const tetto = (nome: string) => carta(preparazione().pool, nome).tettoDiCopie;

  it("è quattro per una carta qualunque", () => {
    expect(tetto("Fixture Goblin")).toBe(COPIE_MASSIME);
  });

  it("è quello del gioco anche per la carta che il documento dichiara limitata", () => {
    // Il tetto del formato non si cuoce qui (ADR-0008): lo scrive l'app sopra
    // il pool, leggendo il documento, così che un documento più fresco lo
    // cambi senza un pool nuovo. Quel che il pool porta è la regola del gioco.
    expect(tetto("Fixture Sigillo")).toBe(COPIE_MASSIME);
  });

  it("non c'è per la carta che se lo concede da sé nel testo", () => {
    // La frase è quella stampata sulle carte vere; il nome è inventato, perché
    // il permesso si legge dal testo e mai da un elenco di nomi nel codice.
    expect(tetto("Fixture Sciame")).toBeNull();
  });

  it("non c'è per le terre base", () => {
    expect(tetto("Fixture Forest")).toBeNull();
  });
});

describe("la verifica della posta", () => {
  it("segnala la carta con la posta che la lista delle bandite non nomina", () => {
    expect(preparazione().postaNonBandita).toEqual(["Fixture Scommessa"]);
  });

  it("non segnala la carta con la posta che la lista nomina già, anche se nel pool c'è", () => {
    expect(preparazione().postaNonBandita).not.toContain("Fixture Contratto");
  });

  it("non scambia «enchanted» per la posta", () => {
    // La trappola vera: cercare la parola dentro le altre pesca ottantatré
    // carte del catalogo Scryfall, e nessuna di quelle si gioca per la posta.
    expect(preparazione().postaNonBandita).not.toContain("Fixture Incanto");
  });

  it("resta muta quando non c'è niente da dire", () => {
    expect(raccontaPosta([])).toBe("");
    expect(raccontaPosta(["Fixture Scommessa"])).toContain("Fixture Scommessa");
  });

  it("con una carta sola parla al singolare", () => {
    // Uno è il numero più probabile per un controllo di residui (ticket 58).
    const una = raccontaPosta(["Fixture Scommessa"]);
    expect(una).toContain("resta una carta che nel testo parla di posta");
    expect(una).toContain("se va bandita");
    expect(una).not.toContain("1 carte");
    expect(raccontaPosta(["Fixture Scommessa", "Fixture Altra"])).toContain(
      "restano 2 carte che nel testo parlano di posta",
    );
  });
});

describe("i buchi del pool", () => {
  // Alla frase delle figure servono solo il totale e le carte senza immagine:
  // il resto dei buchi è a zero perché non conta.
  const buchiDi = (totale: number, senzaImmagine: number): Buchi => ({
    senzaImmagine,
    senzaPrezzo: 0,
    senzaTagNostri: 0,
    senzaTag: 0,
    prezzoDaUnAltroCartoncino: 0,
    totale,
  });

  it("conta le carte che hanno perso immagine, prezzo o tag", () => {
    const buchi = contaBuchi(preparazione().pool);

    expect(buchi.totale).toBe(preparazione().pool.carte.length);
    // Il Velo e il Dorso hanno per unica figura un segnaposto: restano senza.
    expect(buchi.senzaImmagine).toBe(2);
    // Il Pezzente non ha prezzo su nessuna stampa; la Duale, il Sigillo, la
    // Scommessa, il Velo e l'Incanto sono descritti dalla loro stampa italiana.
    expect(buchi.senzaPrezzo).toBeGreaterThan(0);
    expect(buchi.senzaTag).toBeGreaterThan(0);
    // Le carte senza tag nostri sono almeno quelle senza nessun tag: chi non ha
    // niente non ha nemmeno i nostri (ticket 06).
    expect(buchi.senzaTagNostri).toBeGreaterThanOrEqual(buchi.senzaTag);
  });

  it("conta le carte che il prezzo se lo fanno fare da un altro cartoncino", () => {
    // È il numero che il ticket 30 chiede di misurare **dopo** il cambio, e non
    // di dare per zero: la stampa mostrata segue l'edizione del prezzo solo a
    // pari lingua, quindi qualcuna resta — la Ristampa, che di primo rango ce
    // l'ha in un'edizione e il listino nell'altra. Contarle è il modo in cui
    // chi tiene l'app si accorge se un giorno tornano a essere centinaia.
    const buchi = contaBuchi(preparazione().pool);

    expect(buchi.prezzoDaUnAltroCartoncino).toBe(1);
  });

  it("si racconta a schermo con tutti i numeri", () => {
    const racconto = raccontaBuchi(contaBuchi(preparazione().pool));

    expect(racconto).toContain("senza immagine");
    expect(racconto).toContain("senza prezzo");
    expect(racconto).toContain("senza nessuno dei nostri tag");
    expect(racconto).toContain("senza nemmeno un tag");
    expect(racconto).toContain("si comprano al prezzo di un altro");
  });

  it("dice a schermo quante figure sono prese in prestito, anche quando sono zero", () => {
    // A zero si dice lo stesso: è il prezzo di una decisione, non un guasto, e
    // chi legge il comando deve poterlo confrontare con la volta prima.
    expect(raccontaFigure(0, buchiDi(753, 80))).toContain("0");
    expect(raccontaFigure(246, buchiDi(753, 80))).toContain("246");
    expect(raccontaFigure(246, buchiDi(753, 80))).toContain("stessa edizione");
  });

  it("conta le figure prese in prestito sulle carte che una figura ce l'hanno", () => {
    // Il denominatore è la popolazione che la frase nomina, non il pool intero
    // con le carte senza immagine che raccontaBuchi conta a parte (ticket 58).
    const buchi = contaBuchi(preparazione().pool);
    const conUnaFigura = buchi.totale - buchi.senzaImmagine;

    expect(raccontaFigure(0, buchi)).toContain(
      `Delle ${conUnaFigura} carte del pool con una figura, 0 `,
    );
    expect(raccontaFigure(246, buchiDi(753, 80))).toContain(
      "Delle 673 carte del pool con una figura",
    );
    expect(raccontaFigure(246, buchiDi(753, 80))).not.toContain("carte del pool.");
  });

  it("con una carta sola le figure si contano al singolare", () => {
    expect(raccontaFigure(1, buchiDi(753, 80))).toContain(", 1 la prende in prestito");
    expect(raccontaFigure(0, buchiDi(753, 80))).toContain(", 0 la prendono in prestito");
    expect(raccontaFigure(1, buchiDi(3, 2))).toContain(
      "Dell'unica carta del pool con una figura, 1 la prende",
    );
  });
});

describe("tag di sinergia", () => {
  const tag = (nome: string) => carta(preparazione().pool, nome).tag;

  it("legge dai testi noti i tag che quei testi dicono", () => {
    expect(tag("Fixture Goblin")).toEqual(["danno-diretto"]);
    expect(tag("Fixture Pauper")).toEqual(["previene-il-danno"]);
    expect(tag("Fixture Verdict")).toEqual(["spazza-via"]);
    expect(tag("Fixture Bolt")).toEqual(["rimozione-mirata"]);
    expect(tag("Fixture Altar")).toEqual([
      "pesca",
      "accelerazione-di-mana",
      "si-cura-del-cimitero",
    ]);
    expect(tag("Fixture Druid")).toEqual(["accelerazione-di-mana"]);
  });

  it("non chiama accelerazione di mana una terra, che il mana lo produce per mestiere", () => {
    expect(tag("Fixture Anchorage")).toEqual([]);
  });

  it("non legge il testo fra parentesi, che è un promemoria delle regole e non un effetto", () => {
    // Il promemoria del controincantesimo nomina il cimitero: se lo si legge,
    // ogni risposta diventa una carta che si cura del cimitero.
    expect(tag("Fixture Refusal")).toEqual(["controincantesimo"]);
  });

  it("non chiama rimozione un danno all'avversario, che non toglie di mezzo niente", () => {
    // Il danno addosso a chi gioca ha un tag suo — su questo formato è mezzo
    // gioco — ma non è una rimozione: non c'è niente che tolga di mezzo.
    expect(tag("Fixture Bluffs")).toEqual(["danno-diretto"]);
  });

  it("non chiama spazza-via chi esilia solo le proprie pedine", () => {
    expect(tag("Fixture Nightmare")).toEqual([]);
  });

  it("dà gli stessi tag alla stessa carta a ogni giro", () => {
    const primo = preparaPool(FRAMMENTO, { formato: FORMATO, aggiornatoIl: QUANDO });
    const secondo = preparaPool([...FRAMMENTO].reverse(), {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
    });

    expect(secondo.pool.carte.map((c) => c.tag)).toEqual(primo.pool.carte.map((c) => c.tag));
  });

  it("lascia vincere le correzioni a mano sulle regole meccaniche", () => {
    const { pool } = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Goblin", aggiunge: ["evasione"], toglie: ["danno-diretto"] }],
    });

    expect(carta(pool, "Fixture Goblin").tag).toEqual(["evasione"]);
  });

  it("segnala la correzione che non trova più la sua carta, invece di ingoiarla", () => {
    // Un nome che nessuna edizione ammessa contiene: è così che il manutentore
    // scopre di averlo scritto storto.
    const esito = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Scritta Storta", aggiunge: ["pesca"], toglie: [] }],
    });

    expect(esito.correzioniOrfane).toEqual(["Fixture Scritta Storta"]);
    expect(esito.correzioniFuoriDalCriterio).toEqual([]);
  });

  it("chiama orfana la carta di un'edizione non ammessa, anche se il nome è giusto (ticket 66)", () => {
    // Il nome è giusto, ma l'archivio arriva setacciato per edizione: da qui
    // non si separa da un refuso, ed è il racconto a nominare le due cause.
    const esito = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Antico", aggiunge: ["pesca"], toglie: [] }],
    });

    expect(esito.correzioniOrfane).toEqual(["Fixture Antico"]);
    expect(esito.correzioniFuoriDalCriterio).toEqual([]);
  });

  it("applica la correzione a una carta bandita, che nel pool c'è (ticket 66)", () => {
    // Il bando lo applica l'app (ADR-0008): una carta corretta che un giorno
    // il gruppo bandisce non deve far gridare al nome scritto storto.
    const esito = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Contratto", aggiunge: ["pesca"], toglie: [] }],
    });

    expect(esito.correzioniOrfane).toEqual([]);
    expect(esito.correzioniFuoriDalCriterio).toEqual([]);
    expect(carta(esito.pool, "Fixture Contratto").tag).toContain("pesca");
  });

  it("non chiama orfana la correzione a una carta che esiste ma il criterio non ammette (ticket 66)", () => {
    // Il nome è giusto: la carta sta in un'edizione ammessa, solo senza una
    // stampa italiana. Dirlo scritto storto manderebbe a cercare un refuso
    // che non c'è.
    const esito = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Relic", aggiunge: ["pesca"], toglie: [] }],
    });

    expect(esito.correzioniOrfane).toEqual([]);
    expect(esito.correzioniFuoriDalCriterio).toEqual(["Fixture Relic"]);
  });

  it("non segnala niente quando ogni correzione trova la sua carta", () => {
    const esito = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Goblin", aggiunge: ["pesca"], toglie: [] }],
    });

    expect(esito.correzioniOrfane).toEqual([]);
  });

  it("non perde le correzioni quando la preparazione si rilancia", () => {
    // Le correzioni stanno in un file che la preparazione legge e non riscrive
    // mai: rifarla due volte deve dare due volte lo stesso pool corretto.
    const giro = () =>
      preparaPool(FRAMMENTO, {
        formato: FORMATO,
        aggiornatoIl: QUANDO,
        correzioni: [{ nome: "Fixture Goblin", aggiunge: ["pesca"], toglie: ["danno-diretto"] }],
      });

    expect(carta(giro().pool, "Fixture Goblin").tag).toEqual(["pesca"]);
    expect(JSON.stringify(giro())).toBe(JSON.stringify(giro()));
  });
});

/**
 * Nelle edizioni ammesse non esiste una sola carta con più di una faccia, né un
 * costo ibrido, né una stanza: sono tutte «normal», verificato sui dati veri. Il
 * codice che legge queste forme è del **formato dei dati di Scryfall** e non del
 * gioco, e resta provato perché resta scritto: il giorno che lo si togliesse,
 * questi test direbbero cosa si sta togliendo.
 */
describe("carte a più facce, che questo formato non ha", () => {
  it("restano una carta sola, con le facce annidate", () => {
    const { pool } = preparazione();
    const nomi = pool.carte.map((c) => c.nome);

    expect(nomi).toContain("Fixture Wanderer // Fixture Revenant");
    expect(nomi).not.toContain("Fixture Wanderer");

    const doppia = carta(pool, "Fixture Wanderer // Fixture Revenant");
    expect(doppia.facce?.map((f) => f.nome)).toEqual(["Fixture Wanderer", "Fixture Revenant"]);
  });

  it("usano per la curva il costo della faccia giocabile per prima", () => {
    const doppia = carta(preparazione().pool, "Fixture Wanderer // Fixture Revenant");
    expect(doppia.costoDiMana).toBe("{2}{G}");
    expect(doppia.valoreDiMana).toBe(3);
  });

  it("usano la faccia giocabile per prima anche quando i dati sommano i due costi", () => {
    // Sulle avventure e sulle carte divise Scryfall scrive al livello della
    // carta i due costi attaccati — «{1}{B} // {B}» — che non è il costo di
    // niente. Chi conta i simboli per la curva e per le terre leggerebbe il
    // doppio dei colori.
    const avventura = carta(preparazione().pool, "Fixture Rogue // Fixture Errand");
    expect(avventura.costoDiMana).toBe("{1}{B}");
    expect(avventura.facce?.[1]?.costoDiMana).toBe("{B}");
  });

  it("contano il valore di mana della faccia giocabile per prima, non la somma", () => {
    const divisa = carta(preparazione().pool, "Fixture Stanza // Fixture Salone");
    expect(divisa.costoDiMana).toBe("{U}");
    expect(divisa.valoreDiMana).toBe(1);
  });

  it("leggono i costi ibridi per quel che valgono davvero", () => {
    const ibrida = carta(preparazione().pool, "Fixture Ibrido // Fixture Riflesso");
    // {2/W} vale due, {G/U} vale uno, {X} vale zero.
    expect(ibrida.costoDiMana).toBe("{X}{2/W}{G/U}");
    expect(ibrida.valoreDiMana).toBe(3);
  });

  it("si fanno trovare dai tipi e dal testo di tutte le facce", () => {
    const doppia = carta(preparazione().pool, "Fixture Wanderer // Fixture Revenant");
    expect(doppia.sottotipi).toEqual(["Human", "Scout", "Zombie"]);
    expect(doppia.testo).toContain("mills two cards");
  });

  it("prendono l'immagine dalla faccia giocabile per prima", () => {
    const doppia = carta(preparazione().pool, "Fixture Wanderer // Fixture Revenant");
    expect(doppia.immagine?.normale).toBe("https://immagini/wanderer-normale.jpg");
    expect(doppia.facce?.[1]?.immagine?.normale).toBe("https://immagini/revenant-normale.jpg");
  });
});

/**
 * Nemmeno una terra delle edizioni ammesse entra girata. Vale qui la stessa
 * ragione delle facce: quel che si prova è la lettura del testo, e la base di
 * terre la usa.
 */
describe("terre", () => {
  it("dicono quali colori producono", () => {
    expect(carta(preparazione().pool, "Fixture Duale").terra?.coloriProdotti).toEqual([
      "B",
      "U",
    ]);
  });

  it("dicono se entrano girate", () => {
    const anchorage = carta(preparazione().pool, "Fixture Anchorage");
    expect(anchorage.terra?.entraGirata).toBe(true);
    expect(anchorage.terra?.condizione).toBeNull();
  });

  it("conservano la condizione quando entrano girate solo a volte", () => {
    const campground = carta(preparazione().pool, "Fixture Campground");
    expect(campground.terra?.entraGirata).toBe(true);
    expect(campground.terra?.condizione).toBe("you control a basic land");
  });

  it("conservano la condizione anche quando non è scritta con «unless»", () => {
    const crypt = carta(preparazione().pool, "Fixture Crypt");
    expect(crypt.terra?.entraGirata).toBe(true);
    expect(crypt.terra?.condizione).toBe("As this land enters, you may pay 2 life");
  });

  it("non si fanno ingannare da un ritorno in gioco girato", () => {
    const verge = carta(preparazione().pool, "Fixture Verge");
    expect(verge.terra?.entraGirata).toBe(false);
    expect(verge.terra?.condizione).toBeNull();
  });

  it("non danno informazioni sulle terre alle carte che terre non sono", () => {
    expect(carta(preparazione().pool, "Fixture Pauper").terra).toBeNull();
  });
});

describe("ripetibilità", () => {
  it("dà lo stesso pool a ogni giro, byte per byte", () => {
    expect(JSON.stringify(preparazione())).toBe(JSON.stringify(preparazione()));
  });

  it("non dipende dall'ordine in cui l'archivio elenca le stampe", () => {
    const rovesciato = preparaPool([...FRAMMENTO].reverse(), {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
    });
    expect(JSON.stringify(rovesciato)).toBe(JSON.stringify(preparazione()));
  });
});

describe("i tag di Scryfall, accanto ai quindici", () => {
  /**
   * L'indice come lo consegnerebbe il file bulk: il Goblin e il Refusal
   * taggati, la Relic pure — ma la Relic in italiano non c'è, e col criterio
   * del documento finto nel pool non entra.
   */
  const INDICE = indicizzaTag([
    { id: "id-counterspell", nome: "counterspell", oracleId: ["oracolo-refusal"] },
    { id: "id-aggro", nome: "aggro-payoff", oracleId: ["oracolo-goblin"] },
    { id: "id-token", nome: "token-generator", oracleId: ["oracolo-goblin"] },
    { id: "id-reliquia", nome: "relic", oracleId: ["oracolo-relic"] },
  ]);

  const conTag = () =>
    preparaPool(FRAMMENTO, { formato: FORMATO, aggiornatoIl: QUANDO, tag: INDICE });

  it("aggancia i tag alla carta per oracle_id, in ordine", () => {
    expect(carta(conTag().pool, "Fixture Goblin").tagScryfall).toEqual([
      "aggro-payoff",
      "token-generator",
    ]);
    expect(carta(conTag().pool, "Fixture Refusal").tagScryfall).toEqual(["counterspell"]);
  });

  it("dice per ogni tag il suo id stabile, non solo il nome", () => {
    expect(conTag().pool.registroTagScryfall).toContainEqual({
      id: "id-counterspell",
      nome: "counterspell",
    });
  });

  it("nel registro non mette i tag che nessuna carta del pool porta", () => {
    // «relic» esiste nell'indice, ma è solo della Relic, che il criterio lascia fuori.
    const nomi = conTag().pool.registroTagScryfall.map((t) => t.nome);

    expect(nomi).not.toContain("relic");
    expect(nomi).toEqual(["aggro-payoff", "counterspell", "token-generator"]);
  });

  it("lascia i quindici dove sono e come sono", () => {
    const senza = carta(preparazione().pool, "Fixture Goblin");
    const con = carta(conTag().pool, "Fixture Goblin");

    expect(con.tag).toEqual(senza.tag);
    expect(con.tag).toContain("danno-diretto");
  });

  it("una carta senza tag di Scryfall resta legittima", () => {
    expect(carta(conTag().pool, "Fixture Bluffs").tagScryfall).toEqual([]);
  });

  it("senza indice dei tag il pool si prepara lo stesso, con i campi vuoti", () => {
    const { pool } = preparazione();

    expect(pool.registroTagScryfall).toEqual([]);
    expect(pool.carte.every((c) => c.tagScryfall.length === 0)).toBe(true);
  });

  it("un tag che sparisce fra due aggiornamenti non fa cadere niente", () => {
    const dopo = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      tag: indicizzaTag([{ id: "id-aggro", nome: "aggro-payoff", oracleId: ["oracolo-goblin"] }]),
    });

    expect(carta(dopo.pool, "Fixture Refusal").tagScryfall).toEqual([]);
    expect(dopo.pool.registroTagScryfall.map((t) => t.nome)).toEqual(["aggro-payoff"]);
  });

  it("dà lo stesso pool a ogni giro, byte per byte, anche coi tag", () => {
    expect(JSON.stringify(conTag())).toBe(JSON.stringify(conTag()));
  });
});

describe("diario delle differenze", () => {
  const nuova = preparazione();

  const poolPrecedente = (nomi: string[]): Pool => ({
    generatoIl: "2026-08-01T00:00:00.000+00:00",
    improntaDelDocumento: "",
    registroTagScryfall: [],
    carte: nomi.map((nome) => ({ ...carta(nuova.pool, "Fixture Goblin"), nome })),
  });

  it("al primo giro dichiara che è il primo, e non finge uscite", () => {
    const diario = confrontaPool(null, nuova);
    expect(diario.primaVolta).toBe(true);
    expect(diario.entrate).toEqual(nuova.pool.carte.map((c) => c.nome).sort());
    expect(diario.uscite).toEqual([]);
  });

  it("separa chi è entrato, chi è uscito, e dice quali carte del pool l'app terrà fuori", () => {
    const prima = poolPrecedente(["Fixture Goblin", "Fixture Contratto", "Fixture Uscita"]);
    const diario = confrontaPool(prima, nuova);

    expect(diario.primaVolta).toBe(false);
    expect(diario.entrate).not.toContain("Fixture Goblin");
    expect(diario.entrate).toContain("Fixture Anchorage");
    // Bandita: nel pool c'è, e c'era — ma nel catalogo non si vedrà (ADR-0008).
    expect(diario.bandite).toEqual(["Fixture Contratto"]);
    expect(diario.uscite).not.toContain("Fixture Contratto");
    // Uscita: sparita e basta.
    expect(diario.uscite).toEqual(["Fixture Uscita"]);
  });

  it("elenca in ordine, così che due giri uguali si leggano uguali", () => {
    const prima = poolPrecedente(["Fixture Zeta", "Fixture Alfa"]);
    const diario = confrontaPool(prima, nuova);
    expect(diario.uscite).toEqual(["Fixture Alfa", "Fixture Zeta"]);
    expect([...diario.entrate]).toEqual([...diario.entrate].sort());
  });

  it("dopo un cambio di criterio dice il numero invece di srotolare centinaia di nomi", () => {
    const molte = Array.from(
      { length: 300 },
      (_, i) => `Fixture Uscita ${String(i).padStart(3, "0")}`,
    );
    const racconto = raccontaDiario(confrontaPool(poolPrecedente(molte), nuova));

    expect(racconto).toContain("uscite (300)");
    expect(racconto).toContain("Fixture Uscita 000");
    expect(racconto).not.toContain("Fixture Uscita 299");
    expect(racconto).toContain("e altre 260");
  });

  it("si racconta a schermo nominando le tre categorie e i loro numeri", () => {
    const prima = poolPrecedente(["Fixture Goblin", "Fixture Contratto", "Fixture Uscita"]);
    const racconto = raccontaDiario(confrontaPool(prima, nuova));

    expect(racconto).toContain("entrate");
    expect(racconto).toContain("uscite");
    expect(racconto).toContain("bandite");
    expect(racconto).toContain("Fixture Contratto");
    expect(racconto).toContain("Fixture Uscita");
  });
});

/**
 * Il pool è un prodotto di compilazione di un file che non compila niente, e
 * fin qui il legame fra i due stava soltanto nell'ordine in cui il manutentore
 * lancia i comandi. Da qui in poi il pool se lo porta scritto dentro.
 */
describe("il pool dice da quale documento viene", () => {
  it("porta l'impronta del documento che l'ha prodotto", () => {
    expect(preparazione().pool.improntaDelDocumento).toBe(improntaDelDocumento(FORMATO));
  });

  it("ne porta un'altra se un'edizione ammette altre lingue", () => {
    const dopo = preparaPool(FRAMMENTO, { formato: conLingue("xb", ["it", "en"]), aggiornatoIl: QUANDO });

    expect(dopo.pool.improntaDelDocumento).not.toBe(preparazione().pool.improntaDelDocumento);
  });

  it("porta la stessa se il documento bandisce una carta in più: il bando lo applica l'app", () => {
    const conUnBando = formatoCon({
      bandite: {
        ...FORMATO.bandite,
        carte: [
          ...FORMATO.bandite.carte,
          {
            carta: "Fixture Goblin",
            perché: "Per prova.",
            divergenza: null,
            daConfermare: null,
          },
        ],
      },
    });
    const dopo = preparaPool(FRAMMENTO, { formato: conUnBando, aggiornatoIl: QUANDO });

    expect(dopo.pool.improntaDelDocumento).toBe(preparazione().pool.improntaDelDocumento);
    expect(JSON.stringify(dopo.pool)).toBe(JSON.stringify(preparazione().pool));
  });
});

describe("l'archivio che non produce nessuna stampa", () => {
  it("tace quando qualche stampa è uscita", () => {
    expect(() => verificaRaccolto(1, "un archivio qualunque")).not.toThrow();
  });

  it("accusa l'archivio, non il documento di formato", () => {
    // Senza questa guardia il primo a protestare era `verificaCarteEsistenti`,
    // che diceva «il documento nomina N carte che non esistono»: accusava
    // l'unico dei due file scritto a mano, e l'unico dei due che fosse giusto.
    const guaio = (): void => verificaRaccolto(0, "un archivio qualunque");

    expect(guaio).toThrow(/un archivio qualunque/);
    expect(guaio).toThrow(/archivio/i);
    expect(guaio).not.toThrow(/documento/i);
  });
});

describe("il pool che esce vuoto dice di chi è la colpa", () => {
  it("tace quando qualche carta il criterio l'ha ammessa", () => {
    expect(() => verificaPoolNonVuoto(preparazione().pool, FORMATO)).not.toThrow();
  });

  it("accusa il criterio, e non l'archivio che le carte le aveva date", () => {
    // Il caso vero: l'archivio è quello giusto e di stampe ne ha date, ma il
    // criterio non ne ammette nessuna. Dire «dall'archivio non è uscita nessuna
    // carta» sarebbe falso, e manderebbe il manutentore a riscaricare
    // quattrocento megabyte buoni (rilievo della review del ticket 18).
    const vuoto = { ...preparazione().pool, carte: [] };
    const guaio = (): void => verificaPoolNonVuoto(vuoto, FORMATO);

    expect(guaio).toThrow(/criterio/i);
    expect(guaio).toThrow(new RegExp(FORMATO.criterio.regola));
    expect(guaio).not.toThrow(/archivio/i);
  });
});
