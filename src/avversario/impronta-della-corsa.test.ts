/**
 * L'impronta della corsa, provata dove il ticket 37 la mette al lavoro: dire se
 * il mazzo in mano risponde ancora alla domanda che gli è stata fatta.
 *
 * Ogni prova è una cosa che l'utente fa nella schermata degli orologi, e la
 * risposta è sempre la stessa domanda: questo butta il mazzo, o no?
 */

import { describe, expect, it } from "vitest";

import { improntaDellaCorsa } from "./impronta-della-corsa.js";
import type { Orologio } from "./orologio.js";

const MONO_ROSSO: Orologio = {
  nome: "Mono rosso",
  perche: "Lo porta metà tavolo il venerdì.",
  turnoDiChiusura: 5,
  rimozioni: 8,
  contromagie: 0,
};

const CONTROLLO: Orologio = {
  nome: "Il blu di Marco",
  perche: "",
  turnoDiChiusura: 11,
  rimozioni: 4,
  contromagie: 6,
};

/** Come la schermata riscrive una voce: un campo cambiato, l'array rifatto. */
function con(orologio: Orologio, parti: Partial<Orologio>): Orologio {
  return { ...orologio, ...parti };
}

describe("l'impronta della corsa", () => {
  it("è la stessa per due elenchi scritti uguali da due mani diverse", () => {
    expect(improntaDellaCorsa([MONO_ROSSO, CONTROLLO])).toBe(
      improntaDellaCorsa([{ ...MONO_ROSSO }, { ...CONTROLLO }]),
    );
  });

  it("non correre contro nessuno è una corsa sola, comunque ci si arrivi", () => {
    expect(improntaDellaCorsa([])).toBe(improntaDellaCorsa([]));
  });

  it("cancellare tutti gli orologi cambia la domanda", () => {
    expect(improntaDellaCorsa([])).not.toBe(improntaDellaCorsa([MONO_ROSSO]));
  });

  it("aggiungere un orologio cambia la domanda", () => {
    expect(improntaDellaCorsa([MONO_ROSSO])).not.toBe(
      improntaDellaCorsa([MONO_ROSSO, CONTROLLO]),
    );
  });

  it("togliere un orologio dal mezzo cambia la domanda", () => {
    expect(improntaDellaCorsa([MONO_ROSSO, CONTROLLO])).not.toBe(
      improntaDellaCorsa([MONO_ROSSO]),
    );
  });

  it.each([
    ["il turno di chiusura", { turnoDiChiusura: 6 }],
    ["le rimozioni", { rimozioni: 9 }],
    ["le contromagie", { contromagie: 2 }],
  ])("correggere %s cambia la domanda", (_che, parti: Partial<Orologio>) => {
    expect(improntaDellaCorsa([MONO_ROSSO])).not.toBe(
      improntaDellaCorsa([con(MONO_ROSSO, parti)]),
    );
  });

  it("rinominare un orologio cambia la domanda: l'esito è intestato a lui", () => {
    expect(improntaDellaCorsa([MONO_ROSSO])).not.toBe(
      improntaDellaCorsa([con(MONO_ROSSO, { nome: "Rosso di Anna" })]),
    );
  });

  it("correggere il perché non cambia niente: non lo legge nessun conto", () => {
    expect(improntaDellaCorsa([MONO_ROSSO])).toBe(
      improntaDellaCorsa([con(MONO_ROSSO, { perche: "L'ho rivisto anche ieri." })]),
    );
  });

  it("uno spazio in coda al nome non butta il mazzo di nessuno", () => {
    expect(improntaDellaCorsa([MONO_ROSSO])).toBe(
      improntaDellaCorsa([con(MONO_ROSSO, { nome: "  Mono rosso " })]),
    );
  });

  it("due orologi scambiati di posto sono un elenco a cui è successo qualcosa", () => {
    expect(improntaDellaCorsa([MONO_ROSSO, CONTROLLO])).not.toBe(
      improntaDellaCorsa([CONTROLLO, MONO_ROSSO]),
    );
  });

  it("due nomi diversi non si confondono per via di un separatore", () => {
    const uno = con(MONO_ROSSO, { nome: 'a", 5, 8, 0], ["b' });
    const altro = con(MONO_ROSSO, { nome: "a" });
    expect(improntaDellaCorsa([uno])).not.toBe(
      improntaDellaCorsa([altro, con(MONO_ROSSO, { nome: "b" })]),
    );
  });
});
