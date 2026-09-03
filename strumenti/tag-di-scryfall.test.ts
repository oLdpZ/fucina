import { describe, expect, it } from "vitest";

import { indicizzaTag, riduciTag, type TagGrezzo } from "./tag-di-scryfall.ts";

const NEL_POOL = new Set(["oracle-goblin", "oracle-refusal"]);

function grezzo(pezzi: Partial<TagGrezzo>): TagGrezzo {
  return {
    id: "id-tag",
    label: "counterspell",
    slug: "counterspell",
    type: "oracle",
    taggings: [{ oracle_id: "oracle-refusal" }],
    ...pezzi,
  };
}

describe("riduzione di un tag di Scryfall", () => {
  it("tiene l'id stabile accanto al nome, che è quello che Scryfall consiglia", () => {
    const ridotto = riduciTag(grezzo({ id: "9f2c", slug: "counterspell" }), NEL_POOL);

    expect(ridotto).toEqual({ id: "9f2c", nome: "counterspell", oracleId: ["oracle-refusal"] });
  });

  it("butta via le carte che nel pool non ci sono", () => {
    const ridotto = riduciTag(
      grezzo({ taggings: [{ oracle_id: "oracle-refusal" }, { oracle_id: "oracle-di-un-altro-formato" }] }),
      NEL_POOL,
    );

    expect(ridotto?.oracleId).toEqual(["oracle-refusal"]);
  });

  it("scarta il tag che nel pool non tocca nessuna carta", () => {
    expect(riduciTag(grezzo({ taggings: [{ oracle_id: "oracle-di-un-altro-formato" }] }), NEL_POOL)).toBeNull();
    expect(riduciTag(grezzo({ taggings: [] }), NEL_POOL)).toBeNull();
    // Il campo che manca del tutto, non un elenco vuoto: capita in un file bulk.
    expect(riduciTag({ id: "id-tag", slug: "counterspell" }, NEL_POOL)).toBeNull();
  });

  it("scarta il tag a cui manca il nome o l'identificativo: non si saprebbe come chiamarlo", () => {
    const taggings = [{ oracle_id: "oracle-goblin" }];

    expect(riduciTag(grezzo({ slug: "" }), NEL_POOL)).toBeNull();
    expect(riduciTag({ id: "id-tag", taggings }, NEL_POOL)).toBeNull();
    expect(riduciTag({ slug: "counterspell", taggings }, NEL_POOL)).toBeNull();
  });

  it("non conta due volte la stessa carta", () => {
    const ridotto = riduciTag(
      grezzo({ taggings: [{ oracle_id: "oracle-goblin" }, { oracle_id: "oracle-goblin" }] }),
      NEL_POOL,
    );

    expect(ridotto?.oracleId).toEqual(["oracle-goblin"]);
  });
});

describe("indice dei tag", () => {
  it("dice per ogni carta i tag che ha, in ordine e senza ripetizioni", () => {
    const indice = indicizzaTag([
      { id: "id-2", nome: "ramp", oracleId: ["oracle-goblin"] },
      { id: "id-1", nome: "aggro", oracleId: ["oracle-goblin", "oracle-refusal"] },
    ]);

    expect(indice.perCarta.get("oracle-goblin")).toEqual(["aggro", "ramp"]);
    expect(indice.perCarta.get("oracle-refusal")).toEqual(["aggro"]);
  });

  it("tiene l'identificativo stabile di ogni nome", () => {
    const indice = indicizzaTag([{ id: "id-1", nome: "aggro", oracleId: ["oracle-goblin"] }]);

    expect(indice.identificativi.get("aggro")).toBe("id-1");
  });

  it("con due identificativi per lo stesso nome ne sceglie sempre lo stesso", () => {
    const dritto = indicizzaTag([
      { id: "id-b", nome: "aggro", oracleId: ["oracle-goblin"] },
      { id: "id-a", nome: "aggro", oracleId: ["oracle-refusal"] },
    ]);
    const rovescio = indicizzaTag([
      { id: "id-a", nome: "aggro", oracleId: ["oracle-refusal"] },
      { id: "id-b", nome: "aggro", oracleId: ["oracle-goblin"] },
    ]);

    expect(dritto.identificativi.get("aggro")).toBe("id-a");
    expect(rovescio.identificativi.get("aggro")).toBe("id-a");
    expect(dritto.perCarta.get("oracle-goblin")).toEqual(["aggro"]);
    expect(rovescio.perCarta.get("oracle-refusal")).toEqual(["aggro"]);
  });

  it("una carta senza tag semplicemente non c'è, e non è un guasto", () => {
    const indice = indicizzaTag([]);

    expect(indice.perCarta.size).toBe(0);
    expect(indice.identificativi.size).toBe(0);
  });
});
