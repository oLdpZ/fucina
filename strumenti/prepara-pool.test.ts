import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { interpretaFormato } from "../src/dati/carica-formato.ts";
import type { Formato } from "../src/dati/formato.ts";
import type { Carta, Pool } from "../src/dati/pool.ts";
import { COPIE_DI_UNA_LIMITATA } from "../src/mazzo/copie.ts";
import { COPIE_MASSIME } from "../src/mazzo/taratura.ts";
import {
  confrontaPool,
  contaBuchi,
  preparaPool,
  raccontaBuchi,
  raccontaDiario,
  raccontaPosta,
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

  it("non fa entrare le carte che il formato bandisce", () => {
    const esito = preparazione();
    expect(esito.pool.carte.map((c) => c.nome)).not.toContain("Fixture Contratto");
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

  it("non chiama errore di battitura una carta bandita, che nel pool non c'è per definizione", () => {
    // Il controllo si fa **prima** di togliere le bandite: se lo si facesse
    // dopo, ogni riga della lista dei bandi sembrerebbe un nome sbagliato.
    expect(() => preparazione()).not.toThrow();
  });
});

describe("passo 2 — cosa si mostra", () => {
  it("prende immagine, prezzo e rarità dalla stampa inglese più economica fra le ammesse", () => {
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

  it("ripiega sulla stampa italiana quando in inglese, fra le ammesse, la carta non esiste", () => {
    // Nel pool vero sono settantadue carte, e fra loro le terre duali. Il nome
    // e il testo restano inglesi lo stesso, perché Scryfall li scrive in
    // inglese su ogni stampa; quel che manca è il prezzo, e si dice.
    const duale = carta(preparazione().pool, "Fixture Duale");

    expect(duale.linguaDellaStampa).toBe("it");
    expect(duale.edizione).toBe("xa");
    expect(duale.nome).toBe("Fixture Duale");
    expect(duale.testo).toContain("Add {B} or {U}");
    expect(duale.prezzo.euro).toBeNull();
    expect(duale.immagine?.normale).toBe("https://immagini/duale-italiana-normale.jpg");
  });

  it("non si lascia comprare da una stampa di un'altra lingua che costa meno", () => {
    // La stessa carta in francese, stessa edizione ammessa, con un prezzo che
    // l'italiana non ha: è un numero vero di una carta che il destinatario non
    // gioca, e la lista della spesa manderebbe a comprare quella.
    const duale = carta(preparazione().pool, "Fixture Duale");

    expect(duale.linguaDellaStampa).toBe("it");
    expect(duale.nomeItaliano).toBe("Palude Tropicale");
    expect(duale.prezzo.euro).toBeNull();
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

  it("ripiega sull'inglese senza rumore quando l'immagine italiana è un segnaposto", () => {
    const segnaposto = carta(preparazione().pool, "Fixture Segnaposto");
    expect(segnaposto.immagine?.normale).toBe("https://immagini/segnaposto-normale.jpg");
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

  it("conserva i campi che servono, e nient'altro", () => {
    const goblin = carta(preparazione().pool, "Fixture Goblin");

    expect(goblin.costoDiMana).toBe("{1}{R}");
    expect(goblin.valoreDiMana).toBe(2);
    expect(goblin.identitaDiColore).toEqual(["R"]);
    expect(goblin.tipi).toEqual(["Creature"]);
    expect(goblin.sottotipi).toEqual(["Goblin", "Warrior"]);
    expect(goblin.testo).toContain("create a 1/1 red Goblin creature token");
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

describe("il tetto di copie", () => {
  const tetto = (nome: string) => carta(preparazione().pool, nome).tettoDiCopie;

  it("è quattro per una carta qualunque", () => {
    expect(tetto("Fixture Goblin")).toBe(COPIE_MASSIME);
  });

  it("è uno per la carta che il documento di formato dichiara limitata", () => {
    expect(tetto("Fixture Sigillo")).toBe(COPIE_DI_UNA_LIMITATA);
  });

  it("torna quattro se il documento smette di dichiararla limitata", () => {
    // Cambiare una riga di dati cambia il pool, e non serve toccare il codice:
    // è la promessa fatta al manutentore (storia 26).
    const { pool } = preparaPool(FRAMMENTO, {
      formato: formatoCon({ limitate: { ...FORMATO.limitate, carte: [] } }),
      aggiornatoIl: QUANDO,
    });

    expect(carta(pool, "Fixture Sigillo").tettoDiCopie).toBe(COPIE_MASSIME);
  });

  it("non c'è per la carta che se lo concede da sé nel testo", () => {
    // La frase è quella stampata sulle carte vere; il nome è inventato, perché
    // il permesso si legge dal testo e mai da un elenco di nomi nel codice.
    expect(tetto("Fixture Sciame")).toBeNull();
  });

  it("non c'è per le terre base", () => {
    expect(tetto("Fixture Forest")).toBeNull();
  });

  it("la limitata resta a una copia anche se il testo si concedesse il permesso", () => {
    // Il formato ha l'ultima parola: fra «il gioco dice quante ne vuoi» e «il
    // gruppo dice una», al tavolo del venerdì vince il gruppo.
    const { pool } = preparaPool(FRAMMENTO, {
      formato: formatoCon({
        limitate: {
          ...FORMATO.limitate,
          carte: [
            { carta: "Fixture Sciame", perché: "troppo forte", divergenza: null, daConfermare: null },
          ],
        },
      }),
      aggiornatoIl: QUANDO,
    });

    expect(carta(pool, "Fixture Sciame").tettoDiCopie).toBe(COPIE_DI_UNA_LIMITATA);
  });
});

describe("la verifica della posta", () => {
  it("segnala la carta con la posta che la lista delle bandite non nomina", () => {
    expect(preparazione().postaNonBandita).toEqual(["Fixture Scommessa"]);
  });

  it("non segnala la carta con la posta che la lista nomina già", () => {
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
});

describe("i buchi del pool", () => {
  it("conta le carte che hanno perso immagine, prezzo o tag", () => {
    const buchi = contaBuchi(preparazione().pool);

    expect(buchi.totale).toBe(preparazione().pool.carte.length);
    // Il Velo e il Dorso hanno per unica figura un segnaposto: restano senza.
    expect(buchi.senzaImmagine).toBe(2);
    // Il Pezzente non ha prezzo su nessuna stampa; la Duale, il Sigillo, la
    // Scommessa, il Velo e l'Incanto sono descritti dalla loro stampa italiana.
    expect(buchi.senzaPrezzo).toBeGreaterThan(0);
    expect(buchi.senzaTag).toBeGreaterThan(0);
  });

  it("si racconta a schermo con tutti e tre i numeri", () => {
    const racconto = raccontaBuchi(contaBuchi(preparazione().pool));

    expect(racconto).toContain("senza immagine");
    expect(racconto).toContain("senza prezzo");
    expect(racconto).toContain("senza nemmeno un tag");
  });
});

describe("tag di sinergia", () => {
  const tag = (nome: string) => carta(preparazione().pool, nome).tag;

  it("legge dai testi noti i tag che quei testi dicono", () => {
    expect(tag("Fixture Goblin")).toEqual(["produce-pedine"]);
    expect(tag("Fixture Pauper")).toEqual(["guadagna-punti-vita"]);
    expect(tag("Fixture Verdict")).toEqual(["spazza-via"]);
    expect(tag("Fixture Bolt")).toEqual(["rimozione-mirata"]);
    expect(tag("Fixture Altar")).toEqual([
      "sacrifica",
      "pesca",
      "accelerazione-di-mana",
      "si-cura-del-cimitero",
    ]);
    expect(tag("Fixture Druid")).toEqual(["accelerazione-di-mana", "conta-le-creature"]);
  });

  it("non chiama accelerazione di mana una terra, che il mana lo produce per mestiere", () => {
    expect(tag("Fixture Anchorage")).toEqual([]);
  });

  it("non legge il testo fra parentesi, che è un promemoria delle regole e non un effetto", () => {
    // Il promemoria del Tesoro parla di sacrificare e di aggiungere mana: se lo
    // si legge, ogni controincantesimo diventa una carta che sacrifica.
    expect(tag("Fixture Refusal")).toEqual(["produce-pedine", "accelerazione-di-mana"]);
  });

  it("non chiama rimozione un danno all'avversario, che non toglie di mezzo niente", () => {
    expect(tag("Fixture Bluffs")).toEqual([]);
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
      correzioni: [
        { nome: "Fixture Goblin", aggiunge: ["conta-le-creature"], toglie: ["produce-pedine"] },
      ],
    });

    expect(carta(pool, "Fixture Goblin").tag).toEqual(["conta-le-creature"]);
  });

  it("segnala la correzione che non trova più la sua carta, invece di ingoiarla", () => {
    // È così che il manutentore scopre che una carta non è più nel pool.
    const esito = preparaPool(FRAMMENTO, {
      formato: FORMATO,
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Uscita Di Scena", aggiunge: ["pesca"], toglie: [] }],
    });

    expect(esito.correzioniOrfane).toEqual(["Fixture Uscita Di Scena"]);
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
        correzioni: [{ nome: "Fixture Goblin", aggiunge: ["pesca"], toglie: ["produce-pedine"] }],
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

describe("i tag di Scryfall, accanto ai nove", () => {
  /**
   * L'indice come lo consegnerebbe il file bulk: il Goblin e il Refusal
   * taggati, il Contratto pure — ma il Contratto è bandito e nel pool non entra.
   */
  const INDICE = indicizzaTag([
    { id: "id-counterspell", nome: "counterspell", oracleId: ["oracolo-refusal"] },
    { id: "id-aggro", nome: "aggro-payoff", oracleId: ["oracolo-goblin"] },
    { id: "id-token", nome: "token-generator", oracleId: ["oracolo-goblin"] },
    { id: "id-ante", nome: "ante", oracleId: ["oracolo-contratto"] },
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
    // «ante» esiste nell'indice, ma è solo del Contratto, che è bandito.
    const nomi = conTag().pool.registroTagScryfall.map((t) => t.nome);

    expect(nomi).not.toContain("ante");
    expect(nomi).toEqual(["aggro-payoff", "counterspell", "token-generator"]);
  });

  it("lascia i nove dove sono e come sono", () => {
    const senza = carta(preparazione().pool, "Fixture Goblin");
    const con = carta(conTag().pool, "Fixture Goblin");

    expect(con.tag).toEqual(senza.tag);
    expect(con.tag).toContain("produce-pedine");
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
    registroTagScryfall: [],
    carte: nomi.map((nome) => ({ ...carta(nuova.pool, "Fixture Goblin"), nome })),
  });

  it("al primo giro dichiara che è il primo, e non finge uscite", () => {
    const diario = confrontaPool(null, nuova);
    expect(diario.primaVolta).toBe(true);
    expect(diario.entrate).toEqual(nuova.pool.carte.map((c) => c.nome).sort());
    expect(diario.uscite).toEqual([]);
    expect(diario.bandite).toEqual([]);
  });

  it("separa chi è entrato, chi è uscito e chi è stato bandito", () => {
    const prima = poolPrecedente(["Fixture Goblin", "Fixture Contratto", "Fixture Uscita"]);
    const diario = confrontaPool(prima, nuova);

    expect(diario.primaVolta).toBe(false);
    expect(diario.entrate).not.toContain("Fixture Goblin");
    expect(diario.entrate).toContain("Fixture Anchorage");
    // Bandita: sparita dal pool, ma sparita per un motivo che ha un nome.
    expect(diario.bandite).toEqual(["Fixture Contratto"]);
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
