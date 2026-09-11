/**
 * La lettura degli orologi, provata dalla cucitura che l'app usa davvero.
 *
 * Gli orologi li scrive una **mano**, e una mano sbaglia in modi che il tipo
 * non vede: un turno di chiusura a zero, duecento rimozioni, due mazzi con lo
 * stesso nome. Ognuno di quei casi qui ha il suo test, e ognuno deve dire quale
 * riga guardare — chi legge il messaggio ha il file aperto davanti.
 */

import { describe, expect, it } from "vitest";

import {
  interpretaOrologi,
  OROLOGI_MASSIMI,
  orologiCheSiLeggono,
  righeCheNonSiConservano,
  TURNO_DI_CHIUSURA_MASSIMO,
} from "./orologio.js";

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

/**
 * Il lettore indulgente, che sta accanto a quello severo come
 * `identitaSeSiLegge` sta accanto a `interpretaIdentita`.
 *
 * Là dentro gli orologi sono **già dell'utente**: una voce storta è una riga
 * scritta a metà, e non deve poter portarsi via le altre undici che nessuno
 * può ricostruire al posto suo (ticket 35).
 */
describe("gli orologi che si leggono", () => {
  it("tiene le voci che si leggono e lascia cadere quella storta", () => {
    const { nome: _, ...senzaNome } = BUONO;
    const altro = { ...BUONO, nome: "Il mazzo dell'Abyss" };

    expect(orologiCheSiLeggono([BUONO, senzaNome, altro])).toEqual([
      interpretaOrologi([BUONO])[0],
      interpretaOrologi([altro])[0],
    ]);
  });

  it("di due orologi con lo stesso nome tiene il primo", () => {
    // Il secondo è quello che l'utente sta ancora scrivendo: il primo è quello
    // su cui aveva già deciso.
    expect(orologiCheSiLeggono([BUONO, { ...BUONO, turnoDiChiusura: 7 }])).toEqual([
      interpretaOrologi([BUONO])[0],
    ]);
  });

  it("tiene i primi e lascia cadere quelli di troppo", () => {
    const tanti = Array.from({ length: OROLOGI_MASSIMI + 2 }, (_, i) => ({
      ...BUONO,
      nome: `Mazzo ${i}`,
    }));
    const tenuti = orologiCheSiLeggono(tanti);
    expect(tenuti).toHaveLength(OROLOGI_MASSIMI);
    expect(tenuti?.[0]?.nome).toBe("Mazzo 0");
  });

  it("distingue l'elenco vuoto da quel che elenco non è", () => {
    // È la distinzione su cui sta in piedi tutta la riapertura: l'elenco vuoto
    // è «non voglio correre contro nessuno», e va rispettato; `undefined` è
    // «non ha mai deciso», e allora si mostra il file del manutentore.
    expect(orologiCheSiLeggono([])).toEqual([]);
    expect(orologiCheSiLeggono(BUONO)).toBeUndefined();
    expect(orologiCheSiLeggono(null)).toBeUndefined();
  });

  it("un orologio senza nome continua a non entrare nella corsa", () => {
    const { nome: _, ...senzaNome } = BUONO;
    expect(orologiCheSiLeggono([senzaNome])).toEqual([]);
  });
});

describe("le righe che non si conservano", () => {
  it("non ne trova nessuna in un elenco che si legge tutto", () => {
    expect(righeCheNonSiConservano([BUONO, { ...BUONO, nome: "Altro" }]).size).toBe(0);
  });

  it("dice di una riga senza nome perché non si salva, nominando la riga", () => {
    const { nome: _, ...senzaNome } = BUONO;
    const guai = righeCheNonSiConservano([BUONO, senzaNome]);
    expect(guai.get(1)).toMatch(/nome/);
    expect(guai.has(0)).toBe(false);
  });

  it("dice del doppione, e lo dice del secondo e non del primo", () => {
    const guai = righeCheNonSiConservano([BUONO, { ...BUONO, nome: "MONO ROSSO" }]);
    expect(guai.get(1)).toMatch(/Mono rosso/);
    expect(guai.has(0)).toBe(false);
  });

  it("dice delle righe oltre il massimo", () => {
    const tanti = Array.from({ length: OROLOGI_MASSIMI + 1 }, (_, i) => ({
      ...BUONO,
      nome: `Mazzo ${i}`,
    }));
    expect(righeCheNonSiConservano(tanti).get(OROLOGI_MASSIMI)).toMatch(
      new RegExp(String(OROLOGI_MASSIMI)),
    );
  });
});
