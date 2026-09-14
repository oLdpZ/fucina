import { describe, expect, it } from "vitest";

import { ARCHIVIO, dataDellArchivio } from "./archivio-di-scryfall.ts";

/** Il nome che Scryfall dà davvero all'archivio che ci serve. */
const BUONO = `${ARCHIVIO}-20260906091709.jsonl.gz`;

describe("la data dei dati, letta dal nome dell'archivio", () => {
  it("legge l'istante dal nome che Scryfall dà all'archivio", () => {
    expect(dataDellArchivio(BUONO)).toBe("2026-09-06T09:17:09.000+00:00");
  });

  it("legge lo stesso nome da un percorso qualunque, e anche senza compressione", () => {
    expect(dataDellArchivio(`/scaricati/2020/${BUONO}`)).toBe("2026-09-06T09:17:09.000+00:00");
    // Su Windows, e dentro una cartella che di cifre ne ha quattordici sue.
    expect(dataDellArchivio(["C:", "archivi", "19700101000000", BUONO].join("\\"))).toBe(
      "2026-09-06T09:17:09.000+00:00",
    );
    expect(dataDellArchivio(`${ARCHIVIO}-20260906091709.jsonl`)).toBe(
      "2026-09-06T09:17:09.000+00:00",
    );
  });

  it("non si accontenta di una corsa di cifre qualunque dentro il nome", () => {
    // Una cifra di troppo non è più l'impronta di Scryfall: fermarsi costa una
    // riga di comando, passare costa un pool intero con la data sbagliata.
    expect(() => dataDellArchivio(`${ARCHIVIO}-202609060917091.jsonl.gz`)).toThrow(
      /non si legge la data/,
    );
    expect(() => dataDellArchivio(`${ARCHIVIO}-2026090609170.jsonl.gz`)).toThrow(
      /non si legge la data/,
    );
    // Quattordici cifre giuste, ma non è più un archivio JSONL.
    expect(() => dataDellArchivio(`${ARCHIVIO}-20260906091709.json`)).toThrow(
      /non si legge la data/,
    );
  });

  it("una data che non esiste si ferma invece di finire sul prezzo di ogni carta", () => {
    // Il mese tredici e l'ora venticinque dell'esempio del ticket 18.
    expect(() => dataDellArchivio(`${ARCHIVIO}-20261301250000.jsonl.gz`)).toThrow(
      /non è un istante che esiste/,
    );
    // Il 30 febbraio: giorno plausibile, mese plausibile, data inesistente.
    expect(() => dataDellArchivio(`${ARCHIVIO}-20260230120000.jsonl.gz`)).toThrow(
      /non è un istante che esiste/,
    );
  });

  it("l'archivio sbagliato si ferma, e il messaggio dice quale scaricare", () => {
    // `default-cards` preferisce l'inglese: passerebbe, e darebbe un pool con
    // `nomeItaliano` a null dappertutto senza che nessun resoconto lo dica.
    const guaio = (): unknown => dataDellArchivio("default-cards-20260906091709.jsonl.gz");

    expect(guaio).toThrow(/default-cards/);
    expect(guaio).toThrow(new RegExp(ARCHIVIO));

    // Anche una copia rinominata dell'archivio giusto si ferma: da fuori non si
    // distingue da un archivio che non è quello giusto, e indovinare costa un pool.
    expect(() => dataDellArchivio(`copia-di-${ARCHIVIO}-20260906091709.jsonl.gz`)).toThrow(
      new RegExp(ARCHIVIO),
    );
  });
});
