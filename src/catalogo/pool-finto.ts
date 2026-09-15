/**
 * Il pool finto dei test: poche carte inventate, con proprietà scelte apposta.
 *
 * La specifica lo chiede esplicitamente (`spec.md`, «Cosa rende buono un
 * test»): i test non toccano l'archivio Scryfall vero, così girano in un lampo
 * e non si rompono quando esce un set. I nomi sono inventati ma somigliano a
 * quelli veri, perché la ricerca per nome va provata su parole plausibili.
 *
 * Alcune carte portano anche il **nome italiano**, e altre no: sono i due stati
 * che il pool vero conosce, e la ricerca deve reggerli tutti e due — chi scrive
 * in italiano trova la carta, e la carta che in italiano non è mai stata
 * stampata non fa cadere niente.
 *
 * Vive fuori dai file `.test.ts` perché lo condividono più test.
 */

import type { Carta, Colore, ColoreMana, Tag } from "../dati/pool.js";
import { COPIE_DI_UNA_LIMITATA, leggiTettoDiCopie } from "../mazzo/copie.js";

type Abbozzo = {
  nome: string;
  /** Il nome italiano, quando il test ha bisogno di cercarlo. */
  nomeItaliano?: string;
  costoDiMana?: string;
  valoreDiMana?: number;
  identitaDiColore?: Colore[];
  tipi?: string[];
  sottotipi?: string[];
  testo?: string;
  tag?: Tag[];
  euro?: number | null;
  forza?: string | null;
  costituzione?: string | null;
  /**
   * La carta è **limitata** dal documento di formato: una copia sola per mazzo.
   *
   * Nel pool in vigore questo numero lo scrive l'app leggendo il documento di
   * formato (`pool-in-vigore.ts`), e nessuna riga di codice sa quali carte
   * siano limitate. Qui lo scrive il test, che è l'unico posto in cui il
   * formato lo si inventa apposta.
   */
  limitata?: boolean;
  /** La carta è nella Reserved List: serve ai test del tetto di spesa. */
  riservata?: boolean;
};

const GENERATO_IL = "2026-09-02T09:05:48.145+00:00";

/** Riempie i campi che al test non interessano, per non ripeterli ogni volta. */
function carta(abbozzo: Abbozzo): Carta {
  const nome = abbozzo.nome;
  const tipi = abbozzo.tipi ?? ["Creature"];
  const testo = abbozzo.testo ?? "";
  return {
    id: `finta-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    nome,
    nomeItaliano: abbozzo.nomeItaliano ?? null,
    // La stampa che descriverebbe la carta: inventata come tutto il resto, e
    // scritta perché la sua forma è quella del pool vero.
    edizione: "prova",
    numeroDiCollezione: "1",
    linguaDellaStampa: "en",
    costoDiMana: abbozzo.costoDiMana ?? "",
    valoreDiMana: abbozzo.valoreDiMana ?? 0,
    identitaDiColore: abbozzo.identitaDiColore ?? [],
    tipi,
    sottotipi: abbozzo.sottotipi ?? [],
    testo,
    forza: abbozzo.forza ?? null,
    costituzione: abbozzo.costituzione ?? null,
    immagine: null,
    rarita: "common",
    riservata: abbozzo.riservata ?? false,
    // Il caso normale: a prezzare è la stessa copia che descrive, e la
    // provenienza coincide. Il caso interessante — un prezzo che viene da
    // un'altra copia ammessa — si prova a cucitura, dove i dati sono veri.
    prezzo: {
      euro: abbozzo.euro ?? 0.1,
      aggiornatoIl: GENERATO_IL,
      stampa: { edizione: "prova", numeroDiCollezione: "1", lingua: "en" },
    },
    tag: abbozzo.tag ?? [],
    tagScryfall: [],
    facce: null,
    terra: null,
    // Il tetto lo scrive la stessa regola che lo scrive nel pool vero: un pool
    // finto che se lo calcolasse a modo suo proverebbe un gioco diverso. Le
    // limitate lo scavalcano come nel pool in vigore, dove a scavalcarlo è il
    // documento di formato.
    tettoDiCopie:
      abbozzo.limitata === true ? COPIE_DI_UNA_LIMITATA : leggiTettoDiCopie(testo, tipi),
  };
}

export const POOL_FINTO: readonly Carta[] = [
  carta({
    nome: "Goblin Chieftain",
    nomeItaliano: "Capoclan dei Goblin",
    costoDiMana: "{1}{R}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["R"],
    tipi: ["Creature"],
    sottotipi: ["Goblin"],
    testo: "Other Goblins you control get +1/+1.",
  }),
  carta({
    nome: "Skirk Prospector",
    nomeItaliano: "Cercatore di Skirk",
    costoDiMana: "{R}",
    valoreDiMana: 1,
    identitaDiColore: ["R"],
    tipi: ["Creature"],
    sottotipi: ["Goblin"],
    testo: "Sacrifice a Goblin: Add {R} to your mana pool.",
    tag: ["accelerazione-di-mana"],
  }),
  carta({
    nome: "Krenko's Command",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    tipi: ["Sorcery"],
    testo: "Goblins you control get +1/+1 until end of turn.",
    tag: ["potenzia"],
  }),
  carta({
    nome: "Lightning Strike",
    nomeItaliano: "Fulmine",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    tipi: ["Instant"],
    testo: "Lightning Strike deals 3 damage to target creature or player.",
    tag: ["rimozione-mirata"],
    euro: 0.6,
  }),
  carta({
    nome: "Gravedigger Zombie",
    costoDiMana: "{3}{B}",
    valoreDiMana: 4,
    identitaDiColore: ["B"],
    tipi: ["Creature"],
    sottotipi: ["Zombie"],
    testo: "When Gravedigger Zombie comes into play, return target creature card from your graveyard to your hand.",
    tag: ["si-cura-del-cimitero"],
  }),
  carta({
    nome: "Rakdos Firestarter",
    costoDiMana: "{1}{B}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["B", "R"],
    tipi: ["Creature"],
    sottotipi: ["Goblin", "Shaman"],
    testo: "Whenever Rakdos Firestarter attacks, defending player loses 1 life.",
  }),
  carta({
    nome: "Ancient Colossus",
    costoDiMana: "{7}",
    valoreDiMana: 7,
    tipi: ["Artifact", "Creature"],
    sottotipi: ["Golem"],
    testo: "Trample.",
  }),
  carta({
    nome: "Whispering Sage",
    nomeItaliano: "Saggio Sussurrante",
    costoDiMana: "{2}{U}",
    valoreDiMana: 3,
    identitaDiColore: ["U"],
    tipi: ["Creature"],
    sottotipi: ["Human", "Wizard"],
    testo: "When Whispering Sage comes into play, draw a card.",
    tag: ["pesca"],
  }),
  carta({
    nome: "Sunlit Sanctuary",
    nomeItaliano: "Santuario Soleggiato",
    tipi: ["Land"],
    testo: "Sunlit Sanctuary comes into play tapped.\n{T}: Add {W} to your mana pool.",
    euro: null,
  }),
  // Un nome con accento e uno con apostrofo: sulle carte inglesi vere capita
  // (`Jötun Grunt`, `Krenko's Command`), e chi cerca li scrive senza.
  carta({
    nome: "Jötun Emberkin",
    nomeItaliano: "Progenie di Brace",
    costoDiMana: "{2}{G}",
    valoreDiMana: 3,
    identitaDiColore: ["G"],
    tipi: ["Enchantment"],
    testo: "Creatures you control get +0/+1.",
  }),
];

/**
 * Le terre finte: le sei base, qualche terra a due colori scelta apposta per i
 * casi che contano — una che entra dritta, una che entra girata sempre, una che
 * entra girata solo a volte, e una terra incolore che non fa nessun colore del
 * mazzo — e in fondo le **terre di utilità** del ticket 08.
 *
 * I nomi delle terre base sono quelli veri perché sono gli unici nomi di carta
 * che non ruotano mai; gli altri sono inventati, come nel resto del pool finto.
 */
function terra(
  nome: string,
  coloriProdotti: ColoreMana[],
  extra: {
    base?: boolean;
    entraGirata?: boolean;
    condizione?: string | null;
    identita?: Colore[];
    euro?: number | null;
    /** Quel che la terra **fa**, oltre a fare mana: è ciò che la rende di utilità. */
    tag?: Tag[];
    testo?: string;
  } = {},
): Carta {
  const identita = extra.identita ?? (coloriProdotti.filter((c) => c !== "C") as Colore[]);
  return {
    ...carta({
      nome,
      tipi: extra.base === true ? ["Basic", "Land"] : ["Land"],
      identitaDiColore: identita,
      euro: extra.euro ?? 0.05,
      ...(extra.tag === undefined ? {} : { tag: extra.tag }),
      ...(extra.testo === undefined ? {} : { testo: extra.testo }),
    }),
    terra: {
      coloriProdotti,
      entraGirata: extra.entraGirata ?? false,
      condizione: extra.condizione ?? null,
    },
  };
}

export const TERRE_FINTE: readonly Carta[] = [
  terra("Plains", ["W"], { base: true }),
  terra("Island", ["U"], { base: true }),
  terra("Swamp", ["B"], { base: true }),
  terra("Mountain", ["R"], { base: true }),
  terra("Forest", ["G"], { base: true }),
  terra("Wastes", ["C"], { base: true }),
  terra("Cinder Crossing", ["B", "R"], { euro: 6 }),
  terra("Ashen Waystation", ["B", "R"], { entraGirata: true, euro: 0.1 }),
  terra("Sootfall Gate", ["B", "R"], { entraGirata: true, euro: 0.03 }),
  terra("Pyre Threshold", ["B", "R"], {
    entraGirata: true,
    condizione: "you control two or fewer other lands",
    euro: 0.4,
  }),
  terra("Tideglass Steps", ["U", "W"], { entraGirata: true }),
  // Una terra che non fa nessun colore: nel conto vale come terra e basta.
  terra("Hollow Quarry", ["C"], { identita: [] }),

  /* --- Le terre di utilità (ticket 08) ----------------------------------- *
   * Il formato ne è pieno, e fino al ticket 08 nessuna poteva entrare in un
   * mazzo per nessuna strada. Sono quattro apposta: una che fa mana e picchia,
   * una che fa mana e distrugge terre, una che **non fa mana affatto**, e una
   * che non porta nessun tag — quella deve restare fuori, ed è il caso che
   * distingue «l'app sceglie» da «l'app indovina».
   * ---------------------------------------------------------------------- */
  terra("Emberworks Foundry", ["C"], {
    testo:
      "{T}: Add {C} to your mana pool.\n{1}: Target Assembly-Worker creature gets +1/+1 until end of turn.",
    tag: ["potenzia"],
    euro: 7,
  }),
  terra("Sunken Quarry", ["C"], {
    testo:
      "{T}: Add {C} to your mana pool.\n{T}, Sacrifice Sunken Quarry: Destroy target land.",
    tag: ["attacca-le-terre"],
    euro: 8,
  }),
  // Non fa mana: nel mazzo è un posto che non lancia niente, e i conti lo
  // devono dire — né `probabilita.ts` né `simulazione.ts` la contano fra le fonti.
  terra("Winding Causeway", [], {
    testo:
      "{T}: Untap target attacking creature. Prevent all combat damage that would be dealt to and dealt by that creature this turn.",
    tag: ["previene-il-danno"],
    euro: 30,
  }),
  // Nessun tag: di questa terra l'app non sa dire niente, e non la mette.
  terra("Sorrowfen Path", [], { testo: "{T}: Target creature gains banding until end of turn." }),
];

/**
 * Il pool finto **del motore**: qualche decina di carte inventate, scelte
 * perché la ricerca a scambi singoli (ticket 11) abbia davvero qualcosa da
 * scegliere.
 *
 * `POOL_FINTO` qui sopra ne conta dieci, che bastano al catalogo e non bastano
 * a un mazzo da sessanta carte con un tema dentro. Queste bastano a riempire i
 * posti non-terra in più modi diversi, e sono scritte apposta per i casi che il
 * ticket elenca:
 *
 * - un nucleo di **Goblin rossi** di qualità diversa, così che scambiarne uno
 *   con un altro cambi il punteggio in un verso prevedibile;
 * - carte **fuori tema** nettamente più forti, così che si veda quanto costa
 *   non tradire il tema;
 * - una carta che si concede **copie illimitate**, come quelle vere che portano
 *   scritto «A deck can have any number of cards named …»;
 * - un sottotipo che tocca **una carta sola**, per il tema degenere che lascia
 *   una carta in mano alla ricerca;
 * - tag di sinergia distribuiti in modo che le coppie dichiarate in
 *   `punteggio/taratura.ts` si possano realizzare o mancare.
 *
 * Le terre restano quelle di `TERRE_FINTE`: la base la sceglie l'app.
 */
export const POOL_DEL_MOTORE: readonly Carta[] = [
  /* --- Il nucleo del tema: Goblin rossi, di qualità diversa --------------- */
  carta({
    nome: "Emberhorde Captain",
    costoDiMana: "{2}{R}{R}",
    valoreDiMana: 4,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin", "Soldier"],
    testo: "Other Goblins you control get +1/+0.",
    forza: "2",
    costituzione: "2",
    tag: ["potenzia"],
  }),
  carta({
    nome: "Torchbearer Goblin",
    costoDiMana: "{2}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "When Torchbearer Goblin comes into play, it deals 1 damage to target creature.",
    forza: "2",
    costituzione: "2",
    tag: ["danno-diretto"],
  }),
  carta({
    nome: "Cinder Skirmisher",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "{R}, Sacrifice a creature: Cinder Skirmisher gets +2/+0 until end of turn.",
    forza: "2",
    costituzione: "3",
  }),
  // **La creatura vaniglia**: nessun testo, nessun tag. Il 1994 ne è pieno, e
  // serve a provare che una carta di cui l'app non sa dire niente entra lo
  // stesso in un mazzo — per i suoi numeri, che sono tutto quel che ha.
  carta({
    nome: "Ember Scrapper",
    costoDiMana: "{R}",
    valoreDiMana: 1,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    forza: "2",
    costituzione: "1",
  }),
  carta({
    nome: "Firepit Raider",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "Mountainwalk.",
    forza: "3",
    costituzione: "2",
    tag: ["evasione"],
  }),
  carta({
    nome: "Warren Marshal",
    costoDiMana: "{3}{R}",
    valoreDiMana: 4,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "Other Goblins you control get +0/+1.",
    forza: "2",
    costituzione: "3",
    tag: ["potenzia"],
  }),
  carta({
    nome: "Scrapheap Bombardier",
    costoDiMana: "{3}{R}",
    valoreDiMana: 4,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin", "Artificer"],
    testo: "{T}: Destroy target artifact.",
    forza: "1",
    costituzione: "3",
    tag: ["colpisce-gli-artefatti"],
  }),
  carta({
    nome: "Goblin Powdersmith",
    costoDiMana: "{R}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo:
      "{T}: Goblin Powdersmith deals 1 damage to target creature or player. Goblin Powdersmith deals 1 damage to you.",
    forza: "2",
    costituzione: "2",
    tag: ["danno-diretto"],
  }),
  carta({
    nome: "Emberflock Scout",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin", "Scout"],
    testo: "Mountainwalk.",
    forza: "1",
    costituzione: "2",
    tag: ["evasione"],
  }),
  carta({
    nome: "Kindlefang Runt",
    costoDiMana: "{R}",
    valoreDiMana: 1,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "This creature can't block.",
    forza: "1",
    costituzione: "1",
  }),

  /* --- Rossi fuori dal sottotipo: il primo allargamento naturale ---------- */
  carta({
    nome: "Scorch Bolt",
    costoDiMana: "{R}",
    valoreDiMana: 1,
    identitaDiColore: ["R"],
    tipi: ["Instant"],
    testo: "Scorch Bolt deals 3 damage to target creature or player.",
    tag: ["danno-diretto"],
  }),
  carta({
    nome: "Emberpact Ritual",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    tipi: ["Sorcery"],
    testo: "Add {R}{R}{R} to your mana pool.",
    tag: ["accelerazione-di-mana"],
  }),
  carta({
    nome: "Molten Insight",
    costoDiMana: "{2}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["R"],
    tipi: ["Instant"],
    testo: "Draw two cards, then discard a card.",
    tag: ["pesca"],
  }),
  carta({
    nome: "Wildfire Sweep",
    costoDiMana: "{3}{R}",
    valoreDiMana: 4,
    identitaDiColore: ["R"],
    tipi: ["Sorcery"],
    testo: "Wildfire Sweep deals 3 damage to each creature.",
    tag: ["spazza-via"],
  }),
  carta({
    nome: "Warrenwatch Beacon",
    costoDiMana: "{2}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["R"],
    tipi: ["Enchantment"],
    testo:
      "Creatures can't attack you unless their controller pays {1} for each creature they control.",
    tag: ["imbriglia"],
  }),

  /* --- Fuori tema, e più forti: il prezzo di restare puri ----------------- */
  carta({
    nome: "Nightfall Herald",
    costoDiMana: "{3}{B}{B}",
    valoreDiMana: 5,
    identitaDiColore: ["B"],
    sottotipi: ["Vampire"],
    testo: "Flying.\n{B}: Regenerate Nightfall Herald.",
    forza: "5",
    costituzione: "5",
    tag: ["evasione", "rigenera"],
  }),
  // Il tre mana che decide le partite del formato: piccolo, vola, e svuota la
  // mano. È la carta per cui vale la pena tradire il tema, e serve che nel pool
  // ce ne sia una — se no la frontiera non ha niente da mostrare.
  carta({
    nome: "Duskwing Harrier",
    costoDiMana: "{1}{B}{B}",
    valoreDiMana: 3,
    identitaDiColore: ["B"],
    sottotipi: ["Specter"],
    testo:
      "Flying. Whenever Duskwing Harrier deals damage to a player, that player discards a card at random.",
    forza: "2",
    costituzione: "2",
    tag: ["evasione", "scarta"],
    euro: 40,
  }),
  carta({
    nome: "Vile Extraction",
    costoDiMana: "{1}{B}",
    valoreDiMana: 2,
    identitaDiColore: ["B"],
    tipi: ["Instant"],
    testo: "Destroy target creature. It can't be regenerated.",
    tag: ["rimozione-mirata"],
  }),
  carta({
    nome: "Grave Reveler",
    costoDiMana: "{2}{B}",
    valoreDiMana: 3,
    identitaDiColore: ["B"],
    sottotipi: ["Zombie"],
    testo:
      "When Grave Reveler comes into play, return target creature card from your graveyard to your hand.",
    forza: "4",
    costituzione: "3",
    tag: ["si-cura-del-cimitero"],
  }),
  carta({
    nome: "Bone Collector",
    costoDiMana: "{1}{B}",
    valoreDiMana: 2,
    identitaDiColore: ["B"],
    sottotipi: ["Skeleton"],
    testo: "{B}: Regenerate Bone Collector.",
    forza: "2",
    costituzione: "2",
    tag: ["rigenera"],
  }),
  carta({
    nome: "Crypt Tithe",
    costoDiMana: "{2}{B}",
    valoreDiMana: 3,
    identitaDiColore: ["B"],
    tipi: ["Sorcery"],
    testo: "Target player discards two cards at random.",
    tag: ["scarta"],
  }),
  carta({
    nome: "Tidecaller Adept",
    costoDiMana: "{1}{U}",
    valoreDiMana: 2,
    identitaDiColore: ["U"],
    sottotipi: ["Merfolk", "Wizard"],
    testo: "Islandwalk.",
    forza: "2",
    costituzione: "2",
    tag: ["evasione"],
  }),
  carta({
    nome: "Skyward Archivist",
    costoDiMana: "{3}{U}",
    valoreDiMana: 4,
    identitaDiColore: ["U"],
    sottotipi: ["Bird", "Wizard"],
    testo: "Flying.\n{U}{U}: Draw a card.",
    forza: "2",
    costituzione: "5",
    tag: ["evasione", "pesca"],
  }),
  carta({
    nome: "Thornwood Guardian",
    costoDiMana: "{2}{G}",
    valoreDiMana: 3,
    identitaDiColore: ["G"],
    sottotipi: ["Beast"],
    testo: "Trample.",
    forza: "4",
    costituzione: "4",
  }),
  carta({
    nome: "Verdant Surge",
    costoDiMana: "{G}",
    valoreDiMana: 1,
    identitaDiColore: ["G"],
    tipi: ["Sorcery"],
    testo: "Search your library for a basic land card and put it into play tapped.",
    tag: ["accelerazione-di-mana"],
  }),
  carta({
    nome: "Dawnlight Vicar",
    costoDiMana: "{1}{W}",
    valoreDiMana: 2,
    identitaDiColore: ["W"],
    sottotipi: ["Human", "Cleric"],
    testo: "{W}: Prevent the next 1 damage that would be dealt to any target this turn.",
    forza: "2",
    costituzione: "2",
    tag: ["previene-il-danno"],
  }),
  carta({
    nome: "Iron Sentinel",
    costoDiMana: "{4}",
    valoreDiMana: 4,
    tipi: ["Artifact", "Creature"],
    sottotipi: ["Golem"],
    testo: "Trample.",
    forza: "4",
    costituzione: "4",
  }),

  /* --- Gli artefatti, che in questo formato sono metà del gioco ----------- */
  // **L'artefatto a costo zero, e insieme la carta limitata**: il pool vero ne
  // ha diciotto, e sono quasi tutte fra le più forti che ci siano. È il caso
  // che il ticket 08 chiede per nome — se la legalità si controllasse a valle,
  // scartando i mazzi illegali, un pool così la farebbe fallire quasi sempre.
  carta({
    nome: "Onyx Chalice",
    costoDiMana: "{0}",
    valoreDiMana: 0,
    tipi: ["Artifact"],
    testo: "{T}, Sacrifice Onyx Chalice: Add {R}{R}{R} to your mana pool.",
    tag: ["accelerazione-di-mana"],
    euro: 900,
    limitata: true,
    // In Reserved List come le sue sorelle vere: non sarà mai ristampata, e il
    // suo prezzo non scenderà aspettando. È il caso che il tetto di spesa deve
    // saper raccontare quando la lascia fuori.
    riservata: true,
  }),
  carta({
    nome: "Rustvein Talisman",
    costoDiMana: "{2}",
    valoreDiMana: 2,
    tipi: ["Artifact"],
    testo: "{T}: Add one mana of any color to your mana pool.",
    tag: ["accelerazione-di-mana"],
    euro: 3,
  }),

  /* --- Il controllo, perché la coppia di tag esista nel pool -------------- */
  carta({
    nome: "Wavebreak Denial",
    costoDiMana: "{1}{U}",
    valoreDiMana: 2,
    identitaDiColore: ["U"],
    tipi: ["Instant"],
    testo: "Counter target spell.",
    tag: ["controincantesimo"],
  }),

  /* --- I due casi limite -------------------------------------------------- */
  // Copie illimitate, come le quattro carte vere che se lo concedono: il tetto
  // si legge dalla frase, mai da un elenco di nomi (`mazzo/copie.ts`).
  carta({
    nome: "Endless Rat Swarm",
    costoDiMana: "{1}{B}",
    valoreDiMana: 2,
    identitaDiColore: ["B"],
    sottotipi: ["Rat"],
    testo: "A deck can have any number of cards named Endless Rat Swarm.",
    forza: "1",
    costituzione: "1",
  }),
  // L'unico Sphinx del pool: il tema che lascia una carta sola.
  carta({
    nome: "Lone Sphinx",
    costoDiMana: "{5}{U}",
    valoreDiMana: 6,
    identitaDiColore: ["U"],
    sottotipi: ["Sphinx"],
    testo: "Flying.",
    forza: "5",
    costituzione: "5",
    tag: ["evasione"],
  }),
];
