import { describe, expect, it } from "vitest";

import type { Carta } from "../src/dati/pool.ts";
import { leggiTettoDiCopie } from "../src/mazzo/copie.ts";
import {
  applicaCorrezioni,
  leggiCorrezioni,
  raccontaCorrezioni,
  tagMeccanici,
} from "./tag-di-sinergia.ts";

/**
 * Il file delle correzioni a mano è l'unico pezzo di questo progetto che una
 * persona scrive a mano e un programma legge. I test qui sotto descrivono cosa
 * il manutentore può scriverci dentro, e cosa succede quando sbaglia.
 */

/** Una carta finta, ridotta ai soli campi che le regole guardano. */
function carta(nome: string, testo: string, tipi: string[] = ["Creature"]): Carta {
  return {
    id: nome,
    nome,
    costoDiMana: "{1}",
    valoreDiMana: 1,
    identitaDiColore: [],
    tipi,
    sottotipi: [],
    testo,
    forza: null,
    costituzione: null,
    immagine: null,
    rarita: "common",
    legalitaStandard: "legal",
    prezzo: { euro: null, aggiornatoIl: "2026-09-02" },
    tag: [],
    tagScryfall: [],
    facce: null,
    terra: null,
    tettoDiCopie: leggiTettoDiCopie(testo, tipi),
  };
}

/**
 * Le formule che le carte usano davvero per dire la stessa cosa. Ogni caso qui
 * sotto è stato trovato sul pool vero: o era una carta che il tag lo meritava e
 * non ce l'aveva, o una che ce l'aveva e non lo meritava.
 */
describe("le regole meccaniche", () => {
  const tag = (testo: string, tipi?: string[]) => tagMeccanici(carta("Prova", testo, tipi));

  it("riconosce i punti vita anche quando il numero non è scritto", () => {
    expect(tag("You gain life equal to its power.")).toEqual(["guadagna-punti-vita"]);
    expect(tag("Whenever you gain life, put a +1/+1 counter on this creature.")).toEqual([
      "guadagna-punti-vita",
    ]);
    expect(tag("Whenever this creature attacks, you gain 2 life.")).toEqual([
      "guadagna-punti-vita",
    ]);
    // Chi impedisce di guadagnare punti vita fa l'opposto, e non è del tema.
    expect(tag("Players can't gain life.")).toEqual([]);
  });

  it("riconosce la rimozione con «fino a un bersaglio» e col danno non scritto in cifre", () => {
    expect(tag("Exile up to one target nonland permanent.")).toEqual(["rimozione-mirata"]);
    expect(tag("This creature deals damage equal to its power to target creature.")).toEqual([
      "rimozione-mirata",
    ]);
  });

  it("riconosce la pescata anche quando le carte non si contano a numero", () => {
    expect(tag("Draw cards equal to the number of creatures you control.")).toEqual([
      "pesca",
      "conta-le-creature",
    ]);
    expect(tag("Whenever you draw your second card each turn, scry 1.")).toEqual(["pesca"]);
  });

  it("non chiama «sacrifica» una terra che sacrifica solo se stessa", () => {
    // Sono quarantasei nel pool vero: con il tag, ogni base di terre risulterebbe
    // un mazzo da sacrifici.
    expect(tag("{4}, {T}, Sacrifice this land: Draw 4 cards.", ["Land"])).toEqual(["pesca"]);
    // Una terra che sacrifica **altro** invece del tema fa parte davvero.
    expect(tag("{1}, {T}, Sacrifice a token: Draw a card.", ["Land"])).toEqual([
      "sacrifica",
      "pesca",
    ]);
    // E una creatura che si sacrifica per un effetto è un corpo da sacrificare:
    // quella resta dentro.
    expect(tag("{T}, Sacrifice this creature: Scry 1.")).toEqual(["sacrifica"]);
  });

  it("guarda i tipi della faccia giocabile per prima, non l'unione delle due", () => {
    const doppia: Carta = {
      ...carta("Rito // Itlimoc", "{T}: Add {G} for each creature you control.", [
        "Enchantment",
        "Land",
      ]),
      facce: [
        {
          nome: "Rito",
          costoDiMana: "{2}{G}",
          lineaDiTipo: "Enchantment",
          tipi: ["Enchantment"],
          sottotipi: [],
          testo: "",
          forza: null,
          costituzione: null,
          immagine: null,
        },
        {
          nome: "Itlimoc",
          costoDiMana: "",
          lineaDiTipo: "Legendary Land",
          tipi: ["Legendary", "Land"],
          sottotipi: [],
          testo: "{T}: Add {G} for each creature you control.",
          forza: null,
          costituzione: null,
          immagine: null,
        },
      ],
    };

    // La carta si gioca come incantesimo: è accelerazione di mana a tutti gli
    // effetti, e l'unione dei tipi delle due facce la escludeva.
    expect(tagMeccanici(doppia)).toContain("accelerazione-di-mana");
  });

  it("non si cura del cimitero solo perché dice di non usarlo", () => {
    expect(
      tag(
        "Counter target spell unless its controller pays {3}. If that spell is countered " +
          "this way, exile it instead of putting it into its owner's graveyard.",
      ),
    ).toEqual([]);
  });
});

describe("il file delle correzioni a mano", () => {
  it("legge una correzione che aggiunge e una che toglie", () => {
    const esito = leggiCorrezioni(["Alfa: +pesca", "Beta: -sacrifica"].join("\n"));

    expect(esito.problemi).toEqual([]);
    expect(esito.correzioni).toEqual([
      { nome: "Alfa", aggiunge: ["pesca"], toglie: [] },
      { nome: "Beta", aggiunge: [], toglie: ["sacrifica"] },
    ]);
  });

  it("accetta più tag sulla stessa riga, aggiunti e tolti insieme", () => {
    const esito = leggiCorrezioni("Alfa: +pesca, +spazza-via, -sacrifica");

    expect(esito.problemi).toEqual([]);
    expect(esito.correzioni[0]).toEqual({
      nome: "Alfa",
      aggiunge: ["pesca", "spazza-via"],
      toglie: ["sacrifica"],
    });
  });

  it("lascia scrivere commenti e righe vuote, che è come si spiega il perché", () => {
    const esito = leggiCorrezioni(
      ["# la regola non vede che produce pedine solo di rado", "", "  ", "Alfa: +pesca"].join(
        "\n",
      ),
    );

    expect(esito.problemi).toEqual([]);
    expect(esito.correzioni).toHaveLength(1);
  });

  it("non si perde con i nomi che hanno i due punti dentro", () => {
    // «Ratonhnhaké:ton» esiste davvero: il nome sta prima dell'ultimo due punti.
    const esito = leggiCorrezioni("Ratonhnhaké:ton: +pesca");

    expect(esito.problemi).toEqual([]);
    expect(esito.correzioni[0]?.nome).toBe("Ratonhnhaké:ton");
  });

  it("segnala un tag che non esiste invece di ingoiarlo", () => {
    const esito = leggiCorrezioni("Alfa: +vola");

    expect(esito.correzioni).toEqual([]);
    expect(esito.problemi.join("\n")).toContain("vola");
  });

  it("segnala una riga che non si capisce, dicendo quale", () => {
    const esito = leggiCorrezioni(["Alfa: +pesca", "Beta pesca"].join("\n"));

    expect(esito.correzioni).toHaveLength(1);
    expect(esito.problemi.join("\n")).toContain("riga 2");
  });

  it("chiede il segno davanti a ogni tag, perché senza non si sa cosa vuole", () => {
    const esito = leggiCorrezioni("Alfa: pesca");

    expect(esito.correzioni).toEqual([]);
    expect(esito.problemi).toHaveLength(1);
  });

  it("lascia scrivere il motivo in fondo alla riga, che è il senso del file", () => {
    const esito = leggiCorrezioni("Alfa: +pesca  # la regola non vede: il testo è nel promemoria");

    expect(esito.problemi).toEqual([]);
    expect(esito.correzioni).toEqual([{ nome: "Alfa", aggiunge: ["pesca"], toglie: [] }]);
  });

  it("non lascia chiedere e disdire lo stesso tag nella stessa riga", () => {
    const esito = leggiCorrezioni("Alfa: +pesca, -pesca");

    expect(esito.correzioni).toEqual([]);
    expect(esito.problemi.join("\n")).toContain("pesca");
  });
});

describe("le correzioni applicate al pool", () => {
  const pool = [carta("Alfa", "Draw a card."), carta("Beta", "Sacrifice a creature: Scry 1.")];

  it("aggiungono e tolgono tag alla carta giusta", () => {
    const conTag = pool.map((c) => ({ ...c, tag: tagMeccanici(c) }));
    const esito = applicaCorrezioni(conTag, [
      { nome: "Alfa", aggiunge: ["conta-le-creature"], toglie: ["pesca"] },
    ]);

    expect(esito.carte[0]?.tag).toEqual(["conta-le-creature"]);
    // La carta che nessuno corregge resta com'era.
    expect(esito.carte[1]?.tag).toEqual(["sacrifica"]);
    expect(esito.orfane).toEqual([]);
  });

  it("non ripetono un tag che la regola meccanica aveva già dato", () => {
    const conTag = pool.map((c) => ({ ...c, tag: tagMeccanici(c) }));
    const esito = applicaCorrezioni(conTag, [{ nome: "Alfa", aggiunge: ["pesca"], toglie: [] }]);

    expect(esito.carte[0]?.tag).toEqual(["pesca"]);
  });

  it("segnalano la correzione che non trova più la sua carta", () => {
    const esito = applicaCorrezioni(pool, [
      { nome: "Carta Ruotata Fuori", aggiunge: ["pesca"], toglie: [] },
    ]);

    expect(esito.orfane).toEqual(["Carta Ruotata Fuori"]);
  });

  it("non toccano il pool che ricevono", () => {
    const conTag = pool.map((c) => ({ ...c, tag: tagMeccanici(c) }));
    applicaCorrezioni(conTag, [{ nome: "Alfa", aggiunge: [], toglie: ["pesca"] }]);

    expect(conTag[0]?.tag).toEqual(["pesca"]);
  });
});

describe("il racconto delle correzioni", () => {
  it("tace quando non c'è niente da dire", () => {
    expect(raccontaCorrezioni({ problemi: [], orfane: [] })).toBe("");
  });

  it("nomina la carta orfana, che è come si scopre che è ruotata fuori", () => {
    const racconto = raccontaCorrezioni({ problemi: [], orfane: ["Carta Ruotata Fuori"] });

    expect(racconto).toContain("Carta Ruotata Fuori");
  });

  it("riporta anche le righe che non si capiscono", () => {
    const racconto = raccontaCorrezioni({ problemi: ["riga 2: non si capisce"], orfane: [] });

    expect(racconto).toContain("riga 2");
  });
});
