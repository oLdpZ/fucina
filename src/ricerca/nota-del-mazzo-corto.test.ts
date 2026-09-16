import { describe, expect, it } from "vitest";

import { notaDelMazzoCorto } from "./nota-del-mazzo-corto.js";

/**
 * La frase del mazzo che la ricerca non è riuscita a finire (ticket 64).
 *
 * Quel che si prova qui è che la frase non dica «nessun mazzo sta dentro il
 * tetto» proprio nel ramo che dimostra il contrario — per arrivare lì un mazzo
 * dev'essere passato da `dentroIlTetto` — e che non dica nemmeno il rovescio:
 * che il tetto non c'entri, quando altri passi della frontiera li ha tolti lui.
 */

const CONTO = { copie: 52, dimensione: 60, tetto: null, passiSenzaMazzo: 0 } as const;

describe("la nota del mazzo corto", () => {
  it("a tetto spento conta le copie che mancano, e del prezzo non parla", () => {
    const nota = notaDelMazzoCorto(CONTO);

    expect(nota).toContain("52 copie su 60");
    expect(nota).toMatch(/mancano le carte/);
    expect(nota).not.toMatch(/tetto|€/);
  });

  it("col tetto acceso non dice che nessun mazzo ci stava dentro", () => {
    // È il guasto del ticket: la frase aggiungeva sempre «Nessun mazzo sta
    // dentro X €», ma per arrivare a contare un mazzo corto la ricerca deve
    // averne consegnato uno che `dentroIlTetto` aveva accettato.
    const nota = notaDelMazzoCorto({ ...CONTO, tetto: 20 });

    expect(nota).not.toMatch(/Nessun mazzo sta dentro/);
    expect(nota).not.toMatch(/il meno caro/);
  });

  it("col tetto acceso dice che quel mazzo dentro il tetto ci stava", () => {
    // La verità al posto della bugia, e resta agibile: alzare il tetto può
    // rimettere in gioco carte e terre che il prezzo aveva lasciato fuori.
    const nota = notaDelMazzoCorto({ ...CONTO, tetto: 20 });

    expect(nota).toContain("20,00");
    expect(nota).toContain("52 copie su 60");
    expect(nota).toMatch(/ci stava|non è il tetto/);
  });

  it("quando il tetto ha lasciato altri passi senza mazzo, non nega che c'entri", () => {
    // Il caso misto: questo mazzo dentro il tetto ci stava, ma gli altri passi
    // della frontiera il tetto li ha tolti — e quelli potevano essere mazzi
    // interi. Dire «non è il tetto ad averlo fermato» toglierebbe di mano
    // all'utente l'unica leva che gli consegnerebbe un mazzo.
    const nota = notaDelMazzoCorto({ ...CONTO, tetto: 20, passiSenzaMazzo: 2 });

    expect(nota).not.toMatch(/non è il tetto/);
    expect(nota).toMatch(/tetto/);
    expect(nota).toContain("20,00");
  });

  it("senza altri passi persi, il tetto si può dire estraneo, perché lo è", () => {
    const nota = notaDelMazzoCorto({ ...CONTO, tetto: 20, passiSenzaMazzo: 0 });

    expect(nota).toMatch(/non è il tetto/);
  });

  it("al singolare parla di una copia sola, e non di «1 copie»", () => {
    const nota = notaDelMazzoCorto({ ...CONTO, copie: 1 });

    expect(nota).toContain("1 copia su 60");
    expect(nota).not.toMatch(/1 copie/);
  });
});
