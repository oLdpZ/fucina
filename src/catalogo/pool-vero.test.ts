import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { interpretaPool } from "../dati/carica-pool.js";
import type { Carta, Colore } from "../dati/pool.js";
import {
  COSTO_MASSIMO_SEPARATO,
  FILTRI_VUOTI,
  SCALINI_DI_COSTO,
  cerca,
  type Filtri,
} from "./filtri.js";
import { ORDINE_DEI_COLORI, sottotipiDiCreatura, tipiPresenti } from "./vocabolario.js";

/**
 * Il catalogo provato **sul pool vero**, e non sul pool finto.
 *
 * Gli altri test di questa cartella girano su carte inventate, ed è giusto così:
 * provano che i filtri fanno quel che dicono, e per quello un pool di dieci
 * carte scelte apposta è più chiaro di ottocento vere. Questo file prova una
 * cosa diversa, che il pool finto non può provare: che i filtri **abbiano
 * ancora senso su questo gioco**, dopo che il pool ha cambiato formato
 * (`PROGETTO.md` §7). Un filtro tarato su un altro pool passa tutti i suoi test
 * e non serve a nessuno.
 *
 * Le attese non sono numeri copiati a mano: si ricavano dal pool a ogni corsa.
 * È la stessa ragione di ADR-0004 — nessuna verità di formato nel sorgente —
 * applicata ai test: il giorno che il documento di formato cambia una riga il
 * pool si rigenera, e questi test devono restare veri senza che nessuno li
 * riscriva. Un `expect(...).toBe(44)` scritto qui sarebbe una verità di formato
 * dentro un file `.ts`, con in più il difetto di diventare rosso per una
 * correzione giusta.
 */

const POOL = interpretaPool(
  JSON.parse(
    readFileSync(fileURLToPath(new URL("../../public/dati/pool.json", import.meta.url)), "utf8"),
  ),
);
const CARTE = POOL.carte;

const con = (parziali: Partial<Filtri>): Filtri => ({ ...FILTRI_VUOTI, ...parziali });
const quante = (parziali: Partial<Filtri>): number => cerca(CARTE, con(parziali)).length;

describe("il pool su cui il catalogo lavora", () => {
  it("è quello vero, e non un file vuoto o di prova", () => {
    // Senza questo, ogni controllo qui sotto passerebbe su una lista vuota
    // senza dire niente — che è il modo in cui un file di test smette di
    // proteggere qualcosa restando verde.
    expect(CARTE.length).toBeGreaterThan(500);
  });
});

describe("i filtri sul pool nuovo", () => {
  it("il colore mostra quel che si può giocare in quella combinazione", () => {
    for (const colore of ORDINE_DEI_COLORI) {
      const attese = CARTE.filter((carta) =>
        carta.identitaDiColore.every((c: Colore) => c === colore),
      );
      expect(quante({ colori: [colore] })).toBe(attese.length);
      // Ogni colore ha carte: un pool in cui un filtro non mostra mai niente
      // sarebbe un bottone che mente.
      expect(attese.length).toBeGreaterThan(0);
    }
  });

  it("ogni tipo offerto dal filtro mostra esattamente le carte che promette", () => {
    const tipi = tipiPresenti(CARTE);
    expect(tipi.length).toBeGreaterThan(0);
    for (const voce of tipi) {
      expect(quante({ tipi: [voce.tipo] })).toBe(voce.quante);
    }
  });

  it("ogni sottotipo offerto trova almeno le creature che ha contato", () => {
    const sottotipi = sottotipiDiCreatura(CARTE);
    expect(sottotipi.length).toBeGreaterThan(0);
    for (const voce of sottotipi) {
      // «Almeno», e non «esattamente»: il conto del vocabolario guarda le
      // creature, mentre il filtro guarda ogni carta che porti quel sottotipo.
      expect(quante({ sottotipi: [voce.sottotipo] })).toBeGreaterThanOrEqual(voce.quante);
    }
  });

  it("la parola nel testo trova le carte che la contengono", () => {
    // La parola si pesca dal pool invece di sceglierla a mano: una scritta qui
    // sarebbe una scommessa su che cosa dicono le carte di questo formato.
    const parola = paroleFrequenti()[0] as string;
    const attese = CARTE.filter((carta) => carta.testo.toLowerCase().includes(parola));
    expect(attese.length).toBeGreaterThan(0);
    expect(quante({ testo: parola })).toBe(attese.length);
  });

  it("filtri diversi si restringono a vicenda", () => {
    const tipo = tipiPresenti(CARTE)[0]?.tipo as string;
    const soloTipo = quante({ tipi: [tipo] });
    const tipoEColore = quante({ tipi: [tipo], colori: ["W"] });
    expect(tipoEColore).toBeLessThanOrEqual(soloTipo);
    expect(tipoEColore).toBeGreaterThan(0);
  });
});

describe("il vocabolario dei sottotipi", () => {
  it("è esattamente quel che il pool contiene, e nient'altro", () => {
    // È la prova che il vocabolario **si rigenera** invece di essere ereditato:
    // i sottotipi di un altro formato non possono restare, perché nessun elenco
    // è scritto nel codice. Non si nomina nessun sottotipo scomparso — sarebbe
    // scrivere qui la verità che i dati devono portare da soli.
    const nelPool = new Set<string>();
    for (const carta of CARTE) {
      if (!carta.tipi.includes("Creature")) continue;
      for (const sottotipo of carta.sottotipi) nelPool.add(sottotipo);
    }

    const offerti = sottotipiDiCreatura(CARTE).map((voce) => voce.sottotipo);
    expect(new Set(offerti)).toEqual(nelPool);
    expect(offerti.length).toBe(new Set(offerti).size);
  });

  it("non offre un sottotipo che qui non esiste", () => {
    const offerti = sottotipiDiCreatura(CARTE).map((voce) => voce.sottotipo);
    const inventato = "Sottotipochenonesiste";
    expect(offerti).not.toContain(inventato);
    expect(quante({ sottotipi: [inventato] })).toBe(0);
  });

  it("ogni voce offerta ha davvero delle carte dietro", () => {
    for (const voce of sottotipiDiCreatura(CARTE)) {
      expect(voce.quante).toBeGreaterThan(0);
    }
  });
});

describe("gli scalini del costo", () => {
  it("presi tutti insieme non perdono una carta", () => {
    // «Senza tagliarla»: la coda di questo pool è lunga da tutte e due le
    // parti, e uno scalino che mancasse farebbe sparire delle carte dal
    // catalogo senza che nessun filtro dica di averle tolte.
    expect(quante({ costi: [...SCALINI_DI_COSTO] })).toBe(CARTE.length);
  });

  it("non si sovrappongono: ogni carta sta in uno e uno solo", () => {
    const somma = SCALINI_DI_COSTO.reduce(
      (totale, scalino) => totale + quante({ costi: [scalino] }),
      0,
    );
    expect(somma).toBe(CARTE.length);
  });

  it("lo scalino zero non è vuoto: le carte a costo zero esistono", () => {
    const aZero = CARTE.filter((carta: Carta) => carta.valoreDiMana === 0);
    expect(aZero.length).toBeGreaterThan(0);
    expect(quante({ costi: [0] })).toBe(aZero.length);
  });

  it("l'ultimo scalino raccoglie tutta la coda alta, invece di tagliarla", () => {
    const inCoda = CARTE.filter((carta: Carta) => carta.valoreDiMana >= COSTO_MASSIMO_SEPARATO);
    expect(inCoda.length).toBeGreaterThan(0);
    expect(quante({ costi: [COSTO_MASSIMO_SEPARATO] })).toBe(inCoda.length);
    // E la coda va davvero oltre l'ultimo scalino: se ci finisse esatta,
    // «7 o più» sarebbe un modo complicato di scrivere «7».
    expect(CARTE.some((carta: Carta) => carta.valoreDiMana > COSTO_MASSIMO_SEPARATO)).toBe(true);
  });
});

describe("la ricerca in italiano sul pool vero", () => {
  it("trova le carte scritte col nome con cui sono stampate in italiano", () => {
    // Le carte non si nominano: si pescano dal pool, e si cerca il nome che
    // portano. Scriverne una qui sarebbe un nome di carta nel sorgente.
    const conNomeItaliano = CARTE.filter((carta: Carta) => carta.nomeItaliano !== null);
    expect(conNomeItaliano.length).toBeGreaterThan(0);

    for (const carta of assaggio(conNomeItaliano, 40)) {
      const trovate = cerca(CARTE, con({ nome: carta.nomeItaliano as string }));
      expect(trovate.map((trovata: Carta) => trovata.nome)).toContain(carta.nome);
    }
  });
});

/** Le parole più ricorrenti nei testi di regole del pool, dalla più comune. */
function paroleFrequenti(): string[] {
  const conteggio = new Map<string, number>();
  for (const carta of CARTE) {
    for (const parola of carta.testo.toLowerCase().match(/[a-z]{6,}/g) ?? []) {
      conteggio.set(parola, (conteggio.get(parola) ?? 0) + 1);
    }
  }
  return [...conteggio.entries()].sort((a, b) => b[1] - a[1]).map(([parola]) => parola);
}

/**
 * Qualche carta presa a distanza regolare dall'elenco: prova un campione sparso
 * per il pool invece delle prime che capitano, e resta veloce.
 */
function assaggio(carte: readonly Carta[], quante: number): Carta[] {
  const passo = Math.max(1, Math.floor(carte.length / quante));
  const presi: Carta[] = [];
  for (let i = 0; i < carte.length; i += passo) presi.push(carte[i] as Carta);
  return presi;
}
