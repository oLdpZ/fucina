/**
 * La lettura degli orologi, provata dalla cucitura che l'app usa davvero.
 *
 * Gli orologi li scrive una **mano**, e una mano sbaglia in modi che il tipo
 * non vede: un turno di chiusura a zero, duecento rimozioni, due mazzi con lo
 * stesso nome. Ognuno di quei casi qui ha il suo test, e ognuno deve dire quale
 * riga guardare — chi legge il messaggio ha il file aperto davanti.
 */

import { describe, expect, it } from "vitest";

import { interpretaOrologi, OROLOGI_MASSIMI, TURNO_DI_CHIUSURA_MASSIMO } from "./orologio.js";

const BUONO = {
  nome: "Mono rosso",
  perche: "Lo porta metà tavolo il venerdì.",
  turnoDiChiusura: 5,
  rimozioni: 8,
  contromagie: 0,
};

describe("la lettura degli orologi", () => {
  it("legge una voce intera e la consegna tipata", () => {
    expect(interpretaOrologi([BUONO])).toEqual([
      {
        nome: "Mono rosso",
        perche: "Lo porta metà tavolo il venerdì.",
        turnoDiChiusura: 5,
        rimozioni: 8,
        contromagie: 0,
      },
    ]);
  });

  it("accetta un elenco vuoto: nessun orologio dichiarato è una risposta", () => {
    // È lo stato in cui l'app parte se l'utente butta il file del manutentore
    // senza scriverne uno suo, ed è legittimo: la corsa semplicemente non si
    // corre. Rifiutarlo obbligherebbe a dichiarare un meta che non si conosce.
    expect(interpretaOrologi([])).toEqual([]);
  });

  it("regge un perché mancante, che è per chi rilegge e non per il motore", () => {
    const { perche: _, ...senzaPerche } = BUONO;
    expect(interpretaOrologi([senzaPerche])[0]?.perche).toBe("");
  });

  it("rifiuta una voce senza nome, dicendo quale voce", () => {
    const { nome: _, ...senzaNome } = BUONO;
    expect(() => interpretaOrologi([BUONO, senzaNome])).toThrow(/numero 2/);
  });

  it("rifiuta un turno di chiusura che nessun mazzo ha", () => {
    // Zero non è un mazzo veloce: è un refuso. E passarlo metterebbe nel
    // punteggio una corsa contro un avversario che non esiste.
    expect(() => interpretaOrologi([{ ...BUONO, turnoDiChiusura: 0 }])).toThrow(
      /turno di chiusura/,
    );
    expect(() =>
      interpretaOrologi([{ ...BUONO, turnoDiChiusura: TURNO_DI_CHIUSURA_MASSIMO + 1 }]),
    ).toThrow(/turno di chiusura/);
  });

  it("rifiuta conte di copie che in un mazzo non ci stanno", () => {
    expect(() => interpretaOrologi([{ ...BUONO, rimozioni: -1 }])).toThrow(/rimozioni/);
    expect(() => interpretaOrologi([{ ...BUONO, contromagie: 61 }])).toThrow(/contromagie/);
  });

  it("rifiuta un numero scritto come testo, invece di indovinarlo", () => {
    // «5» non è 5: leggerlo come tale vorrebbe dire che il file può contenere
    // qualunque cosa purché somigli a un numero, e il prossimo refuso passa.
    expect(() => interpretaOrologi([{ ...BUONO, turnoDiChiusura: "5" }])).toThrow(/intero/);
  });

  it("rifiuta due orologi con lo stesso nome", () => {
    // L'esito della corsa si mostra per nome: due nomi uguali sono due righe
    // che dicono cose diverse e sembrano la stessa.
    expect(() => interpretaOrologi([BUONO, { ...BUONO, turnoDiChiusura: 7 }])).toThrow(
      /Mono rosso/,
    );
  });

  it("non si fa ingannare da un nome uguale con altre maiuscole", () => {
    expect(() => interpretaOrologi([BUONO, { ...BUONO, nome: "MONO ROSSO" }])).toThrow(
      /MONO ROSSO/,
    );
  });

  it("rifiuta un elenco più lungo di quanto qualcuno ne tenga aggiornati", () => {
    const tanti = Array.from({ length: OROLOGI_MASSIMI + 1 }, (_, i) => ({
      ...BUONO,
      nome: `Mazzo ${i}`,
    }));
    expect(() => interpretaOrologi(tanti)).toThrow(/aggiorna/);
  });

  it("rifiuta qualcosa che non è nemmeno un elenco", () => {
    expect(() => interpretaOrologi(BUONO)).toThrow(/elenco/);
    expect(() => interpretaOrologi(null)).toThrow(/elenco/);
  });
});
