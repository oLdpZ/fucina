import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { Carta, Pool } from "../src/dati/pool.ts";
import {
  confrontaPool,
  preparaPool,
  raccontaDiario,
  type CartaScryfall,
} from "./prepara-pool.ts";
import { indicizzaTag } from "./tag-di-scryfall.ts";

/**
 * Cucitura 2 della specifica: `preparaPool(datiGrezzi) → pool`.
 *
 * Il materiale di prova è un frammento di archivio Scryfall scritto a mano, con
 * nomi inventati: ha la forma esatta dei dati veri ma non invecchia con i set,
 * così i test restano verdi il giorno che esce un'espansione e rossi solo
 * quando qualcosa si rompe davvero.
 */
const FRAMMENTO: CartaScryfall[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("./materiale-di-prova/frammento-scryfall.json", import.meta.url)), "utf8"),
);

const QUANDO = "2026-09-02T09:05:48.145+00:00";

const preparazione = () => preparaPool(FRAMMENTO, { aggiornatoIl: QUANDO });

function carta(pool: Pool, nome: string): Carta {
  const trovata = pool.carte.find((c) => c.nome === nome);
  if (!trovata) throw new Error(`la carta «${nome}» non è nel pool`);
  return trovata;
}

describe("preparazione del pool", () => {
  it("tiene solo le carte che i dati dichiarano legali in Standard", () => {
    const { pool } = preparazione();
    const nomi = pool.carte.map((c) => c.nome);

    expect(nomi).toContain("Fixture Goblin");
    // Bandita e non-legale escono dallo stesso controllo: il campo dei dati.
    expect(nomi).not.toContain("Fixture Cutter");
    expect(nomi).not.toContain("Fixture Relic");
    expect(pool.carte.every((c) => c.legalitaStandard === "legal")).toBe(true);
  });

  it("lascia fuori le carte che nascono da un'unione, che in un mazzo non ci vanno", () => {
    const { pool } = preparazione();
    // I dati la dichiarano legale, ed è vero: ma arriva in gioco solo unendo
    // due carte, e un motore che la mettesse in lista scriverebbe un mazzo
    // impossibile da giocare.
    expect(pool.carte.map((c) => c.nome)).not.toContain("Fixture Colossus");
  });

  it("dà una voce per nome di carta, non una per stampa", () => {
    const { pool } = preparazione();
    const nomi = pool.carte.map((c) => c.nome);
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it("non si lascia sdoppiare dalle stampe fronte-retro della stessa carta", () => {
    const { pool } = preparazione();
    // Scryfall chiama «Fixture Anchorage // Fixture Anchorage» una stampa che
    // ha la stessa carta sui due lati. È un nome diverso, quindi passerebbe il
    // controllo dei doppioni qui sopra — e il pool si ritroverebbe due terre
    // dove ce n'è una, con otto copie legali al posto di quattro.
    expect(pool.carte.map((c) => c.nome)).not.toContain(
      "Fixture Anchorage // Fixture Anchorage",
    );
    expect(pool.carte.filter((c) => c.nome.startsWith("Fixture Anchorage"))).toHaveLength(1);
  });

  it("sceglie la stampa di carta più economica, e da lì prende immagine e prezzo", () => {
    const goblin = carta(preparazione().pool, "Fixture Goblin");

    expect(goblin.prezzo.euro).toBe(0.09);
    expect(goblin.id).toBe("aaaa0002-economica");
    expect(goblin.immagine?.normale).toBe("https://immagini/goblin-economica-normale.jpg");
    expect(goblin.rarita).toBe("uncommon");
  });

  it("non guarda le stampe che non esistono su carta, per quanto costino poco", () => {
    const goblin = carta(preparazione().pool, "Fixture Goblin");
    expect(goblin.id).not.toBe("aaaa0003-digitale");
  });

  it("porta il prezzo con la sua data, che è quella dei dati", () => {
    const { pool } = preparazione();
    expect(pool.generatoIl).toBe(QUANDO);
    expect(carta(pool, "Fixture Goblin").prezzo.aggiornatoIl).toBe(QUANDO);
  });

  it("regge una carta senza prezzo invece di cadere", () => {
    const pauper = carta(preparazione().pool, "Fixture Pauper");
    expect(pauper.prezzo.euro).toBeNull();
    expect(pauper.prezzo.aggiornatoIl).toBe(QUANDO);
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
        "facce",
        "forza",
        "id",
        "identitaDiColore",
        "immagine",
        "legalitaStandard",
        "nome",
        "prezzo",
        "rarita",
        "sottotipi",
        "tag",
        "tagScryfall",
        "terra",
        "testo",
        "tipi",
        "valoreDiMana",
      ].sort(),
    );
  });
});

describe("tag di sinergia", () => {
  const tag = (nome: string) => carta(preparazione().pool, nome).tag;

  it("legge dai testi noti i tag che quei testi dicono", () => {
    expect(tag("Fixture Goblin")).toEqual(["produce-pedine"]);
    expect(tag("Fixture Pauper")).toEqual(["guadagna-punti-vita"]);
    expect(tag("Fixture Verdict")).toEqual(["spazza-via"]);
    expect(tag("Fixture Bolt")).toEqual(["rimozione-mirata"]);
    expect(tag("Fixture Altar")).toEqual(["sacrifica", "pesca", "si-cura-del-cimitero"]);
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
    const primo = preparaPool(FRAMMENTO, { aggiornatoIl: QUANDO });
    const secondo = preparaPool([...FRAMMENTO].reverse(), { aggiornatoIl: QUANDO });

    expect(secondo.pool.carte.map((c) => c.tag)).toEqual(primo.pool.carte.map((c) => c.tag));
  });

  it("lascia vincere le correzioni a mano sulle regole meccaniche", () => {
    const { pool } = preparaPool(FRAMMENTO, {
      aggiornatoIl: QUANDO,
      correzioni: [
        { nome: "Fixture Goblin", aggiunge: ["conta-le-creature"], toglie: ["produce-pedine"] },
      ],
    });

    expect(carta(pool, "Fixture Goblin").tag).toEqual(["conta-le-creature"]);
  });

  it("segnala la correzione che non trova più la sua carta, invece di ingoiarla", () => {
    // È così che il manutentore scopre che una carta è ruotata fuori.
    const esito = preparaPool(FRAMMENTO, {
      aggiornatoIl: QUANDO,
      correzioni: [{ nome: "Fixture Ruotata Fuori", aggiunge: ["pesca"], toglie: [] }],
    });

    expect(esito.correzioniOrfane).toEqual(["Fixture Ruotata Fuori"]);
  });

  it("non segnala niente quando ogni correzione trova la sua carta", () => {
    const esito = preparaPool(FRAMMENTO, {
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
        aggiornatoIl: QUANDO,
        correzioni: [{ nome: "Fixture Goblin", aggiunge: ["pesca"], toglie: ["produce-pedine"] }],
      });

    expect(carta(giro().pool, "Fixture Goblin").tag).toEqual(["pesca"]);
    expect(JSON.stringify(giro())).toBe(JSON.stringify(giro()));
  });
});

describe("carte a più facce", () => {
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
    // Sulle carte divise Scryfall dichiara la somma dei due valori — la stanza
    // che si lancia per {U} risulta costare 6. Il valore di mana deve dire la
    // stessa cosa del costo qui sopra, o curva e simulazione non tornano.
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
    expect(doppia.testo).toContain("mill two cards");
  });

  it("prendono l'immagine dalla faccia giocabile per prima", () => {
    const doppia = carta(preparazione().pool, "Fixture Wanderer // Fixture Revenant");
    expect(doppia.immagine?.normale).toBe("https://immagini/wanderer-normale.jpg");
    expect(doppia.facce?.[1]?.immagine?.normale).toBe("https://immagini/revenant-normale.jpg");
  });
});

describe("terre", () => {
  it("dicono quali colori producono", () => {
    const anchorage = carta(preparazione().pool, "Fixture Anchorage");
    expect(anchorage.terra?.coloriProdotti).toEqual(["U", "W"]);
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
    // Il ciclo più importante dello Standard scrive la condizione al contrario:
    // paghi, e allora non entra girata. Leggerla come «entra girata sempre»
    // vorrebbe dire penalizzare le terre migliori che ci sono (ticket 06).
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
    const rovesciato = preparaPool([...FRAMMENTO].reverse(), { aggiornatoIl: QUANDO });
    expect(JSON.stringify(rovesciato)).toBe(JSON.stringify(preparazione()));
  });
});

describe("i tag di Scryfall, accanto ai nove", () => {
  /**
   * L'indice come lo consegnerebbe il file bulk: il Goblin e il Refusal
   * taggati, il Cutter pure — ma il Cutter è bandito e nel pool non entra.
   */
  const INDICE = indicizzaTag([
    { id: "id-counterspell", nome: "counterspell", oracleId: ["oracolo-refusal"] },
    { id: "id-aggro", nome: "aggro-payoff", oracleId: ["oracolo-goblin"] },
    { id: "id-token", nome: "token-generator", oracleId: ["oracolo-goblin"] },
    { id: "id-equip", nome: "equipment", oracleId: ["oracolo-cutter"] },
  ]);

  const conTag = () => preparaPool(FRAMMENTO, { aggiornatoIl: QUANDO, tag: INDICE });

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
    // «equipment» esiste nell'indice, ma è solo del Cutter, che è bandito.
    const nomi = conTag().pool.registroTagScryfall.map((t) => t.nome);

    expect(nomi).not.toContain("equipment");
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
      aggiornatoIl: QUANDO,
      tag: indicizzaTag([
        { id: "id-aggro", nome: "aggro-payoff", oracleId: ["oracolo-goblin"] },
      ]),
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
    const prima = poolPrecedente(["Fixture Goblin", "Fixture Cutter", "Fixture Antico"]);
    const diario = confrontaPool(prima, nuova);

    expect(diario.primaVolta).toBe(false);
    expect(diario.entrate).not.toContain("Fixture Goblin");
    expect(diario.entrate).toContain("Fixture Anchorage");
    // Bandita: sparita dal pool, ma sparita per un motivo che ha un nome.
    expect(diario.bandite).toEqual(["Fixture Cutter"]);
    // Uscita: sparita e basta — è ruotata fuori.
    expect(diario.uscite).toEqual(["Fixture Antico"]);
  });

  it("elenca in ordine, così che due giri uguali si leggano uguali", () => {
    const prima = poolPrecedente(["Fixture Zeta", "Fixture Alfa"]);
    const diario = confrontaPool(prima, nuova);
    expect(diario.uscite).toEqual(["Fixture Alfa", "Fixture Zeta"]);
    expect([...diario.entrate]).toEqual([...diario.entrate].sort());
  });

  it("dopo una rotazione dice il numero invece di srotolare centinaia di nomi", () => {
    const molte = Array.from({ length: 300 }, (_, i) => `Fixture Uscita ${String(i).padStart(3, "0")}`);
    const racconto = raccontaDiario(confrontaPool(poolPrecedente(molte), nuova));

    expect(racconto).toContain("uscite (300)");
    expect(racconto).toContain("Fixture Uscita 000");
    expect(racconto).not.toContain("Fixture Uscita 299");
    expect(racconto).toContain("e altre 260");
  });

  it("si racconta a schermo nominando le tre categorie e i loro numeri", () => {
    const prima = poolPrecedente(["Fixture Goblin", "Fixture Cutter", "Fixture Antico"]);
    const racconto = raccontaDiario(confrontaPool(prima, nuova));

    expect(racconto).toContain("entrate");
    expect(racconto).toContain("uscite");
    expect(racconto).toContain("bandite");
    expect(racconto).toContain("Fixture Cutter");
    expect(racconto).toContain("Fixture Antico");
  });
});
