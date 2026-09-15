/**
 * Lo stato del motore visto dall'interfaccia, provato senza worker: ogni prova
 * è una sequenza di cose che succedono — il tasto, i messaggi del worker, un
 * ingresso della richiesta che cambia — e quel che la schermata mostra dopo.
 */

import { describe, expect, it } from "vitest";

import type { Frontiera } from "./costruisci.js";
import {
  STATO_DEL_MOTORE_INIZIALE,
  avanzaIlMotore,
  type EventoDelMotore,
  type StatoDelMotore,
} from "./stato-del-motore.js";

// La frontiera non la legge nessuno, qui: basta che sia una.
const FRONTIERA = { esito: "trovato" } as unknown as Frontiera;
const AVANZAMENTO = { passo: 0, passi: 5, partenza: 1, partenze: 4, valutazioni: 120, migliore: 3 };

function dopo(...eventi: EventoDelMotore[]): StatoDelMotore {
  return eventi.reduce(avanzaIlMotore, STATO_DEL_MOTORE_INIZIALE);
}

describe("una ricerca fermata da un ripensamento", () => {
  it("smette di lavorare e lascia scritto quale ingresso è cambiato", () => {
    const stato = dopo(
      { tipo: "parte" },
      { tipo: "avanzamento", avanzamento: AVANZAMENTO },
      { tipo: "ripensamento", cambiati: ["orologi"], interrotta: true },
    );

    expect(stato.allOpera).toBe(false);
    expect(stato.avanzamento).toBeNull();
    expect(stato.fermataPer).toEqual(["orologi"]);
  });

  it("non è un guasto", () => {
    const stato = dopo(
      { tipo: "parte" },
      { tipo: "ripensamento", cambiati: ["tema"], interrotta: true },
    );
    expect(stato.guasto).toBeNull();
  });

  it("se ne va da sé alla costruzione successiva", () => {
    const stato = dopo(
      { tipo: "parte" },
      { tipo: "ripensamento", cambiati: ["tema"], interrotta: true },
      { tipo: "parte" },
    );
    expect(stato.fermataPer).toBeNull();
  });

  it("resta scritta se dopo cambia un altro ingresso: è ancora successa", () => {
    const stato = dopo(
      { tipo: "parte" },
      { tipo: "ripensamento", cambiati: ["tema"], interrotta: true },
      { tipo: "ripensamento", cambiati: ["combo"], interrotta: false },
    );
    expect(stato.fermataPer).toEqual(["tema"]);
  });
});

describe("nessuna frase quando la ricerca non è stata interrotta da un ripensamento", () => {
  it("una ricerca che finisce da sola", () => {
    const stato = dopo(
      { tipo: "parte" },
      { tipo: "avanzamento", avanzamento: AVANZAMENTO },
      { tipo: "frontiera", frontiera: FRONTIERA },
    );
    expect(stato.allOpera).toBe(false);
    expect(stato.frontiera).toBe(FRONTIERA);
    expect(stato.fermataPer).toBeNull();
  });

  it("un ingresso che cambia quando il motore è fermo butta il mazzo, e basta", () => {
    const stato = dopo(
      { tipo: "parte" },
      { tipo: "frontiera", frontiera: FRONTIERA },
      { tipo: "ripensamento", cambiati: ["tetto"], interrotta: false },
    );
    expect(stato.frontiera).toBeNull();
    expect(stato.fermataPer).toBeNull();
  });

  it("una ricerca fermata a mano: l'ha fermata chi guarda, e lo sa", () => {
    const stato = dopo({ tipo: "parte" }, { tipo: "fermata-a-mano" });
    expect(stato.allOpera).toBe(false);
    expect(stato.fermataPer).toBeNull();
  });

  it("una ricerca che si guasta dice il guasto, non il ripensamento", () => {
    const stato = dopo({ tipo: "parte" }, { tipo: "guasto", messaggio: "il motore non è partito." });
    expect(stato.allOpera).toBe(false);
    expect(stato.guasto).toBe("il motore non è partito.");
    expect(stato.fermataPer).toBeNull();
  });
});

describe("quel che il motore faceva già", () => {
  it("partire butta il risultato e il guasto di prima", () => {
    const stato = dopo(
      { tipo: "guasto", messaggio: "x" },
      { tipo: "frontiera", frontiera: FRONTIERA },
      { tipo: "parte" },
    );
    expect(stato).toEqual({ ...STATO_DEL_MOTORE_INIZIALE, allOpera: true });
  });

  it("il ripensamento butta il mazzo e il guasto", () => {
    const stato = dopo(
      { tipo: "guasto", messaggio: "x" },
      { tipo: "ripensamento", cambiati: [], interrotta: false },
    );
    expect(stato.guasto).toBeNull();
    expect(stato.frontiera).toBeNull();
  });
});
