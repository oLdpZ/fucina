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
    riservata: false,
    nomeItaliano: null,
    edizione: "prova",
    numeroDiCollezione: "1",
    linguaDellaStampa: "en",
    prezzo: {
      euro: null,
      aggiornatoIl: "2026-09-02",
      stampa: { edizione: "prova", numeroDiCollezione: "1", lingua: "en" },
    },
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

  it("separa il danno addosso a chi gioca dal danno che toglie di mezzo una carta", () => {
    expect(tag("Lightning Bolt deals 3 damage to any target.")).toEqual([
      "danno-diretto",
      "rimozione-mirata",
    ]);
    // Fireball scrive il bersaglio dall'altra parte, e nel 1994 lo fanno in tanti.
    expect(tag("Fireball deals X damage divided evenly among any number of targets.")).toEqual([
      "danno-diretto",
    ]);
    expect(tag("Inferno deals 6 damage to each creature and each player.")).toEqual([
      "danno-diretto",
      "spazza-via",
    ]);
    // Un colpo su una creatura sola non è danno diretto: non arriva a nessuno.
    expect(tag("This creature deals damage equal to its power to target creature.")).toEqual([
      "rimozione-mirata",
    ]);
  });

  it("riconosce la rimozione con «fino a un bersaglio» e chi la carta se la porta via", () => {
    expect(tag("Exile up to one target nonland permanent.")).toEqual(["rimozione-mirata"]);
    // Control Magic in questo formato è la rimozione migliore che ci sia.
    expect(tag("Enchant creature\nYou control enchanted creature.")).toEqual(["rimozione-mirata"]);
    // Rimbalzare non è rimuovere: la carta torna in mano e si rigioca.
    expect(tag("Return target creature to its owner's hand.")).toEqual([]);
  });

  it("tiene separata la terra distrutta dal permanente distrutto", () => {
    expect(tag("Destroy target land.")).toEqual(["attacca-le-terre"]);
    // Fissure sceglie: è una rimozione **e** un colpo alla base di terre, e la
    // parola «land» in fondo alla frase non deve toglierle la prima.
    expect(tag("Destroy target creature or land. It can't be regenerated.")).toEqual([
      "rimozione-mirata",
      "attacca-le-terre",
    ]);
    expect(tag("Destroy all lands.")).toEqual(["spazza-via", "attacca-le-terre"]);
    // Blood Moon non distrugge niente e fa lo stesso mestiere.
    expect(tag("Nonbasic lands are Mountains.")).toEqual(["attacca-le-terre"]);
    // Ma una terra sacrificata come **proprio** costo è un prezzo, non un attacco.
    expect(tag("When this creature enters, sacrifice it unless you sacrifice two Swamps.")).toEqual(
      [],
    );
  });

  it("riconosce la pescata anche quando le carte non si contano a numero", () => {
    expect(tag("Draw cards equal to the number of creatures you control.")).toEqual(["pesca"]);
    expect(tag("Target player draws two cards.")).toEqual(["pesca"]);
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
    // Il cimitero conta come **provenienza**: finirci dentro è solo morire.
    expect(
      tag(
        "Counter target spell unless its controller pays {3}. If that spell is countered " +
          "this way, exile it instead of putting it into its owner's graveyard.",
      ),
    ).toEqual(["controincantesimo"]);
    expect(tag("Return target creature card from your graveyard to your hand.")).toEqual([
      "si-cura-del-cimitero",
    ]);
  });

  /*
   * Le quattro trappole del 1994: qui le regole scritte sul modo di scrivere le
   * carte di oggi tacciono o sbagliano, ed è la ragione per cui questo
   * vocabolario è stato riscritto invece che ereditato.
   */

  it("legge le parole chiave nude, che nel 1994 non hanno promemoria", () => {
    // Non c'è nessun «(This creature can't be blocked except by…)» da leggere:
    // c'è la parola e basta, a inizio riga o dopo una virgola.
    expect(tag("Flying")).toEqual(["evasione"]);
    expect(tag("Defender, flying")).toEqual(["evasione"]);
    expect(tag("Enchant creature\nEnchanted creature has flying.")).toEqual([
      "potenzia",
      "evasione",
    ]);
  });

  it("non chiama evasione la carta che il volo lo nomina per punirlo", () => {
    // Sono una ventina nel pool vero, e col tag direbbero il contrario del vero.
    expect(tag("Hurricane deals X damage to each creature with flying and each player.")).toEqual([
      "danno-diretto",
      "spazza-via",
    ]);
    expect(tag("All creatures lose flying.")).toEqual([]);
    expect(
      tag("Creatures with mountainwalk can be blocked as though they didn't have mountainwalk."),
    ).toEqual([]);
  });

  it("né la carta che l'attraversamento lo toglie", () => {
    // Sono le terre leggendarie del pool — Hammerheim, Urborg, Tolaria — e la
    // regola le prendeva tutte, perché cercava `landwalk` dovunque nel testo.
    // Dal ticket 08 non è un difetto cosmetico: i tag scelgono le terre di
    // utilità che entrano nel mazzo, e un mazzo di creature che passano si
    // sarebbe preso quattro copie della terra che serve a fermarle.
    expect(tag("{T}: Target creature loses all landwalk abilities until end of turn.")).toEqual([]);
    expect(
      tag("{T}: Target creature loses first strike and all landwalk abilities until end of turn."),
    ).toEqual([]);
    // E la parola chiave nuda, che è quel che la regola deve continuare a
    // prendere: a inizio riga, o data da un «has».
    expect(tag("Mountainwalk")).toEqual(["evasione"]);
    expect(tag("Enchant creature\nEnchanted creature has islandwalk.")).toEqual([
      "potenzia",
      "evasione",
    ]);
  });

  it("non chiama prigione la carta che il difetto ce l'ha addosso", () => {
    // Mana Vault non imbriglia nessuno: paga il proprio costo.
    expect(tag("This artifact doesn't untap during your untap step.\n{T}: Add {C}{C}{C}.")).toEqual(
      ["accelerazione-di-mana"],
    );
    expect(tag("This creature can't attack unless defending player controls an Island.")).toEqual(
      [],
    );
    // Chi invece il campo lo tiene fermo davvero.
    expect(tag("{1}, {T}: Tap target creature.")).toEqual(["imbriglia"]);
    expect(tag("Players skip their untap steps.")).toEqual(["imbriglia"]);
  });

  it("né quella che il difetto se lo scrive addosso in mezzo a un'altra frase", () => {
    // Leviathan: «enters tapped **and** doesn't untap», la forma rovesciata. La
    // regola la saltava solo quando la clausola stava da sola, e per questo la
    // carta è stata a mano in `correzioni-tag.txt` fino a qui.
    expect(
      tag(
        "Trample\nThis creature enters tapped and doesn't untap during your untap step.\n" +
          "At the beginning of your upkeep, you may sacrifice two Islands. " +
          "If you do, untap this creature.",
      ),
    ).toEqual([]);
  });

  it("non chiama rimozione la creatura che si distrugge da sé", () => {
    // Stone Giant presta il volo a una creatura **tua** e a fine turno te la
    // distrugge. Il ramo «destroy that creature» era l'unico dei sei senza
    // guardia, e la guardia per frase che usa il primo ramo qui non basterebbe:
    // il bersaglio è dichiarato nella frase **precedente**, e nessun `[^.]*`
    // ci arriva. Il tag la mandava nel tema «Controllare», a quattro copie.
    expect(
      tag(
        "{T}: Target creature you control with toughness less than this creature's power " +
          "gains flying until end of turn. Destroy that creature at the beginning of the " +
          "next end step.",
      ),
    ).toEqual(["potenzia", "evasione"]);
    // Le altre sette carte che usano la stessa formula distruggono roba
    // altrui — Cockatrice, Thicket Basilisk, Venom, Abomination — e la
    // rimozione la devono tenere.
    expect(
      tag(
        "Whenever this creature blocks or becomes blocked by a creature, destroy that " +
          "creature at end of combat.",
      ),
    ).toEqual(["rimozione-mirata"]);
  });

  it("non chiama prigione chi gira o blocca i propri permanenti", () => {
    // Energy Tap gira una creatura **propria** per farne mana: è l'opposto di
    // una prigione, ed è la stessa ragione per cui `rimozione-mirata` salta chi
    // colpisce quel che «you control».
    expect(
      tag(
        "Tap target untapped creature you control. If you do, add an amount of {C} equal to " +
          "that creature's mana value.",
      ),
    ).toEqual(["accelerazione-di-mana"]);
    // Akron Legionnaire ed Evil Eye of Orms-by-Gore: difetti puri di chi le gioca.
    expect(
      tag(
        "Except for creatures named Akron Legionnaire and artifact creatures, creatures you " +
          "control can't attack.",
      ),
    ).toEqual([]);
    expect(
      tag(
        "Non-Eye creatures you control can't attack.\n" +
          "This creature can't be blocked except by Walls.",
      ),
    ).toEqual(["evasione"]);
  });

  it("legge «enchanted» come «mio» quando la carta incanta un proprio permanente", () => {
    // Cocoon dice «Enchant creature you control» una riga sola, e da lì in poi
    // ogni «enchanted creature» è roba sua: girarla non imbriglia nessuno.
    expect(
      tag(
        "Enchant creature you control\n" +
          "When this Aura enters, tap enchanted creature and put three pupa counters on this Aura.\n" +
          "Enchanted creature doesn't untap during your untap step if this Aura has a pupa " +
          "counter on it.",
      ),
    ).toEqual([]);
    // La stessa frase su un'aura che incanta quel che vuole resta una prigione.
    expect(
      tag("Enchant creature\nEnchanted creature doesn't untap during your untap step."),
    ).toEqual(["imbriglia"]);
  });

  it("non toglie il difetto proprio quando è un'abilità data a un permanente altrui", () => {
    // Glyph of Delusion incolla «This creature doesn't untap…» addosso a una
    // creatura che non è sua: fra virgolette, «this creature» non parla di sé.
    // Senza questo la carta usciva dal pool con zero tag, invisibile ai temi.
    expect(
      tag(
        "Put X glyph counters on target creature that target Wall blocked this turn, where X is " +
          "the power of that blocked creature. The creature gains \"This creature doesn't " +
          "untap during your untap step if it has a glyph counter on it\" and \"At the " +
          "beginning of your upkeep, remove a glyph counter from this creature.\"",
      ),
    ).toEqual(["imbriglia"]);
  });

  it("non chiama rigenerazione la frase che la vieta", () => {
    expect(tag("{B}: Regenerate this creature.")).toEqual(["rigenera"]);
    expect(tag("Destroy all creatures. They can't be regenerated.")).toEqual(["spazza-via"]);
    expect(tag("{T}: Target creature can't be regenerated this turn.")).toEqual([]);
  });
});

describe("il file delle correzioni a mano", () => {
  it("legge una correzione che aggiunge e una che toglie", () => {
    const esito = leggiCorrezioni(["Alfa: +pesca", "Beta: -evasione"].join("\n"));

    expect(esito.problemi).toEqual([]);
    expect(esito.correzioni).toEqual([
      { nome: "Alfa", aggiunge: ["pesca"], toglie: [] },
      { nome: "Beta", aggiunge: [], toglie: ["evasione"] },
    ]);
  });

  it("accetta più tag sulla stessa riga, aggiunti e tolti insieme", () => {
    const esito = leggiCorrezioni("Alfa: +pesca, +spazza-via, -evasione");

    expect(esito.problemi).toEqual([]);
    expect(esito.correzioni[0]).toEqual({
      nome: "Alfa",
      aggiunge: ["pesca", "spazza-via"],
      toglie: ["evasione"],
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
  const pool = [carta("Alfa", "Draw a card."), carta("Beta", "{B}: Regenerate this creature.")];

  it("aggiungono e tolgono tag alla carta giusta", () => {
    const conTag = pool.map((c) => ({ ...c, tag: tagMeccanici(c) }));
    const esito = applicaCorrezioni(conTag, [
      { nome: "Alfa", aggiunge: ["evasione"], toglie: ["pesca"] },
    ]);

    expect(esito.carte[0]?.tag).toEqual(["evasione"]);
    // La carta che nessuno corregge resta com'era.
    expect(esito.carte[1]?.tag).toEqual(["rigenera"]);
    expect(esito.senzaCarta).toEqual([]);
  });

  it("non ripetono un tag che la regola meccanica aveva già dato", () => {
    const conTag = pool.map((c) => ({ ...c, tag: tagMeccanici(c) }));
    const esito = applicaCorrezioni(conTag, [{ nome: "Alfa", aggiunge: ["pesca"], toglie: [] }]);

    expect(esito.carte[0]?.tag).toEqual(["pesca"]);
  });

  it("segnalano la correzione che non trova la sua carta", () => {
    const esito = applicaCorrezioni(pool, [
      { nome: "Carta Che Non C'è", aggiunge: ["pesca"], toglie: [] },
    ]);

    expect(esito.senzaCarta).toEqual(["Carta Che Non C'è"]);
  });

  it("non toccano il pool che ricevono", () => {
    const conTag = pool.map((c) => ({ ...c, tag: tagMeccanici(c) }));
    applicaCorrezioni(conTag, [{ nome: "Alfa", aggiunge: [], toglie: ["pesca"] }]);

    expect(conTag[0]?.tag).toEqual(["pesca"]);
  });
});

describe("il racconto delle correzioni", () => {
  it("tace quando non c'è niente da dire", () => {
    expect(raccontaCorrezioni({ problemi: [], orfane: [], fuoriDalCriterio: [] })).toBe("");
  });

  it("non dice «scritto storto» della carta che il criterio ha lasciato fuori (ticket 66)", () => {
    const racconto = raccontaCorrezioni({
      problemi: [],
      orfane: [],
      fuoriDalCriterio: ["Carta Senza Italiano"],
    });

    expect(racconto).toContain("Carta Senza Italiano");
    expect(racconto).toContain("criterio");
    expect(racconto).not.toContain("storto");
  });

  it("tiene separate le due specie, così la carta lasciata fuori non si confonde col refuso", () => {
    const racconto = raccontaCorrezioni({
      problemi: [],
      orfane: ["Carta Storta"],
      fuoriDalCriterio: ["Carta Senza Italiano"],
    });
    const [storte, fuori] = racconto.split("\n\n");

    expect(storte).toContain("Carta Storta");
    expect(storte).not.toContain("Carta Senza Italiano");
    expect(fuori).toContain("Carta Senza Italiano");
  });

  it("della carta orfana non accusa soltanto il refuso: l'edizione può essere uscita", () => {
    // L'archivio arriva setacciato per edizione, e un nome giusto la cui
    // edizione il documento ha tolto non si distingue da uno storto (ticket 66).
    const racconto = raccontaCorrezioni({
      problemi: [],
      orfane: ["Carta Orfana"],
      fuoriDalCriterio: [],
    });

    expect(racconto).toContain("Carta Orfana");
    expect(racconto).toContain("storto");
    expect(racconto).toContain("edizione è uscita");
  });

  it("riporta anche le righe che non si capiscono", () => {
    const racconto = raccontaCorrezioni({
      problemi: ["riga 2: non si capisce"],
      orfane: [],
      fuoriDalCriterio: [],
    });

    expect(racconto).toContain("riga 2");
  });
});
