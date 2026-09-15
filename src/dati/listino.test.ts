import { describe, expect, it } from "vitest";

import { POOL_FINTO } from "../catalogo/pool-finto.js";
import { interpretaListino, listinoDelPool } from "./listino.js";
import type { Pool } from "./pool.js";

/**
 * Il listino dei prezzi (ticket 11): il file che l'app scarica al posto delle
 * carte. Arriva dalla rete, e si legge voce per voce: un listino a metà non deve
 * poter mettere un euro inventato accanto a una carta.
 */

const POOL: Pool = {
  generatoIl: "2026-09-02T09:05:48.145+00:00",
  improntaDelDocumento: "documento-di-prova",
  registroTagScryfall: [],
  carte: [...POOL_FINTO],
};

describe("il listino di un pool", () => {
  it("porta la data e l'impronta del pool, e un prezzo per ogni carta", () => {
    const scritto = listinoDelPool(POOL);

    expect(scritto.generatoIl).toBe(POOL.generatoIl);
    expect(scritto.improntaDelDocumento).toBe(POOL.improntaDelDocumento);
    expect(scritto.prezzi.map((voce) => voce.nome).sort()).toEqual(
      POOL.carte.map((carta) => carta.nome).sort(),
    );
  });

  it("si rilegge uguale: i prezzi tornano quelli del pool, con la loro data", () => {
    const letto = interpretaListino(JSON.parse(JSON.stringify(listinoDelPool(POOL))));

    for (const carta of POOL.carte) {
      expect(letto.prezzi.get(carta.nome)).toEqual(carta.prezzo);
    }
  });

  it("scrive le voci in ordine di nome, perché il file entra in git", () => {
    const nomi = listinoDelPool(POOL).prezzi.map((voce) => voce.nome);
    expect(nomi).toEqual([...nomi].sort());
  });
});

describe("la lettura del listino", () => {
  const buono = () => JSON.parse(JSON.stringify(listinoDelPool(POOL)));

  it("rifiuta quel che listino non è, con una frase", () => {
    for (const spazzatura of [undefined, null, "<!doctype html>", [], 7]) {
      expect(() => interpretaListino(spazzatura)).toThrow(/listino dei prezzi/);
    }
  });

  it("rifiuta il listino senza una data che si legga", () => {
    expect(() => interpretaListino({ ...buono(), generatoIl: "ieri" })).toThrow(/data/);
  });

  it("rifiuta il listino che non dice per quale formato è fatto", () => {
    expect(() => interpretaListino({ ...buono(), improntaDelDocumento: "" })).toThrow(/formato/);
  });

  it("rifiuta il listino vuoto", () => {
    expect(() => interpretaListino({ ...buono(), prezzi: [] })).toThrow(/nessun prezzo/);
  });

  it("rifiuta la voce storta, e dice quale", () => {
    const prezzi = buono().prezzi;
    prezzi[2] = { nome: "Goblin Chieftain", euro: "tre euro", stampa: null };
    expect(() => interpretaListino({ ...buono(), prezzi })).toThrow(/voce numero 3/);
  });

  it("rifiuta un euro senza la copia da cui viene", () => {
    const prezzi = buono().prezzi;
    prezzi[0] = { ...prezzi[0], stampa: null };
    expect(() => interpretaListino({ ...buono(), prezzi })).toThrow(/voce numero 1/);
  });

  it("legge la carta che un listino non ce l'ha, senza inventarle un euro", () => {
    const prezzi = buono().prezzi;
    prezzi[0] = { nome: prezzi[0].nome, euro: null, stampa: null };
    const letto = interpretaListino({ ...buono(), prezzi });
    expect(letto.prezzi.get(prezzi[0].nome)).toEqual({
      euro: null,
      stampa: null,
      aggiornatoIl: POOL.generatoIl,
    });
  });

  it("rifiuta due prezzi per la stessa carta", () => {
    const prezzi = buono().prezzi;
    prezzi.push({ ...prezzi[0] });
    expect(() => interpretaListino({ ...buono(), prezzi })).toThrow(/due prezzi/);
  });
});
