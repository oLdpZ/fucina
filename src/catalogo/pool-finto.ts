/**
 * Il pool finto dei test: poche carte inventate, con proprietà scelte apposta.
 *
 * La specifica lo chiede esplicitamente (`spec.md`, «Cosa rende buono un
 * test»): i test non toccano l'archivio Scryfall vero, così girano in un lampo
 * e non si rompono quando esce un set. I nomi sono inventati ma somigliano a
 * quelli veri, perché la ricerca per nome va provata su parole plausibili.
 *
 * Vive fuori dai file `.test.ts` perché lo condividono più test.
 */

import type { Carta, Colore, ColoreMana, Tag } from "../dati/pool.js";

type Abbozzo = {
  nome: string;
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
};

const GENERATO_IL = "2026-09-02T09:05:48.145+00:00";

/** Riempie i campi che al test non interessano, per non ripeterli ogni volta. */
function carta(abbozzo: Abbozzo): Carta {
  const nome = abbozzo.nome;
  return {
    id: `finta-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    nome,
    costoDiMana: abbozzo.costoDiMana ?? "",
    valoreDiMana: abbozzo.valoreDiMana ?? 0,
    identitaDiColore: abbozzo.identitaDiColore ?? [],
    tipi: abbozzo.tipi ?? ["Creature"],
    sottotipi: abbozzo.sottotipi ?? [],
    testo: abbozzo.testo ?? "",
    forza: abbozzo.forza ?? null,
    costituzione: abbozzo.costituzione ?? null,
    immagine: null,
    rarita: "common",
    legalitaStandard: "legal",
    prezzo: { euro: abbozzo.euro ?? 0.1, aggiornatoIl: GENERATO_IL },
    tag: abbozzo.tag ?? [],
    facce: null,
    terra: null,
  };
}

export const POOL_FINTO: readonly Carta[] = [
  carta({
    nome: "Goblin Chieftain",
    costoDiMana: "{1}{R}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["R"],
    tipi: ["Creature"],
    sottotipi: ["Goblin"],
    testo: "Other Goblin creatures you control get +1/+1 and have haste.",
  }),
  carta({
    nome: "Skirk Prospector",
    costoDiMana: "{R}",
    valoreDiMana: 1,
    identitaDiColore: ["R"],
    tipi: ["Creature"],
    sottotipi: ["Goblin"],
    testo: "Sacrifice a Goblin: Add {R}.",
    tag: ["sacrifica", "accelerazione-di-mana"],
  }),
  carta({
    nome: "Krenko's Command",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    tipi: ["Sorcery"],
    testo: "Create two 1/1 red Goblin creature tokens.",
    tag: ["produce-pedine"],
  }),
  carta({
    nome: "Lightning Strike",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    tipi: ["Instant"],
    testo: "Lightning Strike deals 3 damage to any target.",
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
    testo: "When this creature enters, return target creature card from your graveyard to your hand.",
    tag: ["si-cura-del-cimitero"],
  }),
  carta({
    nome: "Rakdos Firestarter",
    costoDiMana: "{1}{B}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["B", "R"],
    tipi: ["Creature"],
    sottotipi: ["Goblin", "Shaman"],
    testo: "Whenever this creature attacks, each opponent loses 1 life.",
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
    costoDiMana: "{2}{U}",
    valoreDiMana: 3,
    identitaDiColore: ["U"],
    tipi: ["Creature"],
    sottotipi: ["Human", "Wizard"],
    testo: "When this creature enters, draw a card.",
    tag: ["pesca"],
  }),
  carta({
    nome: "Sunlit Sanctuary",
    tipi: ["Land"],
    testo: "This land enters tapped.\n{T}: Add {W}.",
    euro: null,
  }),
  // Un nome con accento e uno con apostrofo: sulle carte inglesi vere capita
  // (`Jötun Grunt`, `Krenko's Command`), e chi cerca li scrive senza.
  carta({
    nome: "Jötun Emberkin",
    costoDiMana: "{2}{G}",
    valoreDiMana: 3,
    identitaDiColore: ["G"],
    tipi: ["Enchantment"],
    testo: "Creatures you control get +0/+1.",
  }),
];

/**
 * Le terre finte: le sei base più qualche terra a due colori scelta apposta per
 * i casi che contano — una che entra dritta, una che entra girata sempre, una
 * che entra girata solo a volte, e una terra incolore che non fa nessun colore
 * del mazzo.
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
  } = {},
): Carta {
  const identita = extra.identita ?? (coloriProdotti.filter((c) => c !== "C") as Colore[]);
  return {
    ...carta({
      nome,
      tipi: extra.base === true ? ["Basic", "Land"] : ["Land"],
      identitaDiColore: identita,
      euro: extra.euro ?? 0.05,
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
    forza: "5",
    costituzione: "3",
    tag: ["conta-le-creature"],
  }),
  carta({
    nome: "Torchbearer Goblin",
    costoDiMana: "{2}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "When this creature enters, create a 1/1 red Goblin creature token.",
    forza: "3",
    costituzione: "3",
    tag: ["produce-pedine"],
  }),
  carta({
    nome: "Cinder Skirmisher",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "Sacrifice another creature: This creature gets +2/+0 until end of turn.",
    forza: "2",
    costituzione: "3",
    tag: ["sacrifica"],
  }),
  carta({
    nome: "Ember Scrapper",
    costoDiMana: "{R}",
    valoreDiMana: 1,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "Haste.",
    forza: "2",
    costituzione: "1",
  }),
  carta({
    nome: "Firepit Raider",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "Whenever this creature attacks, it gets +1/+0 until end of turn.",
    forza: "3",
    costituzione: "2",
  }),
  carta({
    nome: "Warren Marshal",
    costoDiMana: "{3}{R}",
    valoreDiMana: 4,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "When this creature enters, create two 1/1 red Goblin creature tokens.",
    forza: "3",
    costituzione: "4",
    tag: ["produce-pedine"],
  }),
  carta({
    nome: "Scrapheap Bombardier",
    costoDiMana: "{3}{R}",
    valoreDiMana: 4,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin", "Artificer"],
    testo: "Sacrifice a creature: This creature deals 1 damage to any target.",
    forza: "3",
    costituzione: "3",
    tag: ["sacrifica"],
  }),
  carta({
    nome: "Goblin Powdersmith",
    costoDiMana: "{R}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin"],
    testo: "When this creature enters, it deals 2 damage to target creature an opponent controls.",
    forza: "2",
    costituzione: "2",
    tag: ["rimozione-mirata"],
  }),
  carta({
    nome: "Emberflock Scout",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    sottotipi: ["Goblin", "Scout"],
    testo: "Menace.",
    forza: "1",
    costituzione: "2",
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
    testo: "Scorch Bolt deals 3 damage to any target.",
    tag: ["rimozione-mirata"],
  }),
  carta({
    nome: "Emberpact Ritual",
    costoDiMana: "{1}{R}",
    valoreDiMana: 2,
    identitaDiColore: ["R"],
    tipi: ["Sorcery"],
    testo: "Add {R}{R}{R}.",
    tag: ["accelerazione-di-mana"],
  }),
  carta({
    nome: "Molten Insight",
    costoDiMana: "{2}{R}",
    valoreDiMana: 3,
    identitaDiColore: ["R"],
    tipi: ["Instant"],
    testo: "Draw two cards.",
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
    testo: "At the beginning of your end step, create a 1/1 red Goblin creature token.",
    tag: ["produce-pedine"],
  }),

  /* --- Fuori tema, e più forti: il prezzo di restare puri ----------------- */
  carta({
    nome: "Nightfall Herald",
    costoDiMana: "{3}{B}{B}",
    valoreDiMana: 5,
    identitaDiColore: ["B"],
    sottotipi: ["Vampire"],
    testo: "Flying. Whenever this creature deals damage, you gain that much life.",
    forza: "5",
    costituzione: "5",
    tag: ["guadagna-punti-vita"],
  }),
  carta({
    nome: "Vile Extraction",
    costoDiMana: "{1}{B}",
    valoreDiMana: 2,
    identitaDiColore: ["B"],
    tipi: ["Instant"],
    testo: "Destroy target creature.",
    tag: ["rimozione-mirata"],
  }),
  carta({
    nome: "Grave Reveler",
    costoDiMana: "{2}{B}",
    valoreDiMana: 3,
    identitaDiColore: ["B"],
    sottotipi: ["Zombie"],
    testo:
      "When this creature enters, return target creature card from your graveyard to your hand.",
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
    testo: "Sacrifice a creature: Draw a card.",
    forza: "2",
    costituzione: "2",
    tag: ["sacrifica", "pesca"],
  }),
  carta({
    nome: "Crypt Tithe",
    costoDiMana: "{2}{B}",
    valoreDiMana: 3,
    identitaDiColore: ["B"],
    tipi: ["Sorcery"],
    testo: "Draw two cards. You lose 2 life.",
    tag: ["pesca"],
  }),
  carta({
    nome: "Tidecaller Adept",
    costoDiMana: "{1}{U}",
    valoreDiMana: 2,
    identitaDiColore: ["U"],
    sottotipi: ["Merfolk", "Wizard"],
    testo: "When this creature enters, draw a card.",
    forza: "2",
    costituzione: "2",
    tag: ["pesca"],
  }),
  carta({
    nome: "Skyward Archivist",
    costoDiMana: "{3}{U}",
    valoreDiMana: 4,
    identitaDiColore: ["U"],
    sottotipi: ["Bird", "Wizard"],
    testo: "Flying. At the beginning of your upkeep, draw a card.",
    forza: "2",
    costituzione: "5",
    tag: ["pesca"],
  }),
  carta({
    nome: "Thornwood Guardian",
    costoDiMana: "{2}{G}",
    valoreDiMana: 3,
    identitaDiColore: ["G"],
    sottotipi: ["Beast"],
    testo: "Reach.",
    forza: "4",
    costituzione: "4",
  }),
  carta({
    nome: "Verdant Surge",
    costoDiMana: "{G}",
    valoreDiMana: 1,
    identitaDiColore: ["G"],
    tipi: ["Sorcery"],
    testo: "Search your library for a basic land card and put it onto the battlefield tapped.",
    tag: ["accelerazione-di-mana"],
  }),
  carta({
    nome: "Dawnlight Vicar",
    costoDiMana: "{1}{W}",
    valoreDiMana: 2,
    identitaDiColore: ["W"],
    sottotipi: ["Human", "Cleric"],
    testo: "When this creature enters, you gain 3 life.",
    forza: "2",
    costituzione: "2",
    tag: ["guadagna-punti-vita"],
  }),
  carta({
    nome: "Iron Sentinel",
    costoDiMana: "{4}",
    valoreDiMana: 4,
    tipi: ["Artifact", "Creature"],
    sottotipi: ["Golem"],
    testo: "Vigilance.",
    forza: "4",
    costituzione: "4",
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
  }),
];
