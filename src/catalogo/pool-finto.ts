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
    forza: null,
    costituzione: null,
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
