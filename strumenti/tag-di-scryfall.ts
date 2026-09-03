/**
 * I tag funzionali di **Scryfall Tagger**, la seconda razza di tag
 * ([ADR-0003](../docs/adr/0003-tag-di-scryfall-affiancati-ai-nove.md)).
 *
 * I nove tag nostri nascono da regole meccaniche che si leggono in un
 * pomeriggio; questi li scrive la comunità, dicono cose che le regole non
 * saprebbero dire — `counterspell`, `win-condition`, `removal` — e proprio per
 * questo restano **accanto** ai nove e non al loro posto.
 *
 * Si scaricano a tempo di compilazione e si congelano nel pool: **l'app non
 * interroga mai Scryfall a runtime**, e il determinismo non si tocca.
 *
 * Questo modulo è la parte pura del lavoro — dal file bulk all'indice — e non
 * tocca la rete né il disco. Chi scarica è `aggiorna-pool.ts`.
 */

import type { TagDiScryfall } from "../src/dati/pool.ts";

/**
 * Una riga del file bulk dei tag. Il file è **orientato al tag** e non alla
 * carta: ogni riga è un tag con l'elenco delle carte che l'hanno, agganciate
 * per `oracle_id`. L'indice lo si costruisce girando l'elenco al contrario.
 */
export type TagGrezzo = {
  id?: string;
  label?: string;
  slug?: string;
  type?: string;
  taggings?: { oracle_id?: string }[];
};

/**
 * Un tag ridotto a quel che il pool ne conserva, e alle sole carte del pool.
 *
 * `nome` è lo **slug** e non l'etichetta: è la parola con cui il tag si cerca
 * su Tagger (`otag:counterspell`), ha la stessa forma dei nove nostri, e non
 * contiene spazi. L'etichetta a volte sì («grave pact»).
 */
export type TagRidotto = {
  id: string;
  nome: string;
  oracleId: string[];
};

/** L'indice, girato dalla parte della carta. */
export type IndiceTag = {
  /**
   * Il nome di ogni tag al suo **id stabile**. Scryfall consiglia di tracciare
   * quello, perché la comunità rinomina: il nome è come si legge il tag oggi,
   * l'id è chi è.
   */
  identificativi: Map<string, string>;
  /** L'`oracle_id` di una carta ai nomi dei suoi tag, in ordine alfabetico. */
  perCarta: Map<string, string[]>;
};

/**
 * Una riga del file bulk, ridotta alle sole carte che ci riguardano.
 *
 * Restituisce `null` quando il tag non tocca nessuna carta del pool — sono la
 * grande maggioranza, perché Tagger copre tutta la storia di Magic e noi
 * guardiamo lo Standard di oggi — e quando gli manca il nome o l'id: un tag
 * che non si sa come chiamare non si può né scrivere nel pool né ritrovare.
 */
export function riduciTag(grezzo: TagGrezzo, interessanti: ReadonlySet<string>): TagRidotto | null {
  const id = grezzo.id ?? "";
  const nome = grezzo.slug ?? "";
  if (id === "" || nome === "") return null;

  const oracleId: string[] = [];
  for (const tagging of grezzo.taggings ?? []) {
    const oracle = tagging.oracle_id ?? "";
    if (!interessanti.has(oracle) || oracleId.includes(oracle)) continue;
    oracleId.push(oracle);
  }

  return oracleId.length === 0 ? null : { id, nome, oracleId };
}

/**
 * L'indice, dai tag ridotti. L'ordine dei tag su una carta è alfabetico e non
 * quello del file bulk: il pool finisce in git, e un diff deve mostrare i tag
 * cambiati e non come Scryfall ha ordinato le sue righe.
 */
export function indicizzaTag(ridotti: TagRidotto[]): IndiceTag {
  const identificativi = new Map<string, string>();
  const perCarta = new Map<string, Set<string>>();

  for (const tag of ridotti) {
    // Due id per lo stesso nome non dovrebbero esistere; se esistessero, vince
    // il più piccolo — non perché sia più giusto, ma perché la stessa scelta
    // non deve dipendere dall'ordine in cui il file è arrivato.
    const gia = identificativi.get(tag.nome);
    if (gia === undefined || tag.id < gia) identificativi.set(tag.nome, tag.id);

    for (const oracle of tag.oracleId) {
      const nomi = perCarta.get(oracle);
      if (nomi) nomi.add(tag.nome);
      else perCarta.set(oracle, new Set([tag.nome]));
    }
  }

  return {
    identificativi,
    perCarta: new Map(
      [...perCarta].map(([oracle, nomi]) => [oracle, [...nomi].sort(confrontaTesti)]),
    ),
  };
}

/**
 * Il registro dei tag da scrivere nel pool: **solo quelli che una carta ha
 * davvero**, col loro id stabile, in ordine alfabetico.
 *
 * Si costruisce dai tag finiti sulle carte e non dall'indice intero, perché fra
 * l'indice e il pool qualche carta si perde per strada — le bandite, le stampe
 * doppie — e un registro che nomina tag che nessuno porta racconterebbe una
 * cosa falsa.
 */
export function registroDeiTag(indice: IndiceTag, usati: Iterable<string>): TagDiScryfall[] {
  return [...new Set(usati)].sort(confrontaTesti).map((nome) => {
    const id = indice.identificativi.get(nome);
    // Non può capitare: i nomi arrivano dalle carte, e sulle carte li ha messi
    // questo stesso indice. Se capitasse, vorrebbe dire che l'indice e le carte
    // si sono scollati — e un id vuoto scritto nel pool sarebbe un tag che dice
    // «io sono» senza dire chi, cioè il contrario di quel che il campo serve a
    // fare. Meglio fermare il comando che scrivere un file che mente.
    if (id === undefined) {
      throw new Error(`Il tag «${nome}» è su una carta ma non ha un identificativo nell'indice.`);
    }
    return { id, nome };
  });
}

/** Come in `prepara-pool.ts`: un ordine dichiarato, uguale su ogni computer. */
function confrontaTesti(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
