import { describe, expect, it } from "vitest";

import {
  identitaDelFormato,
  identitaSeSiLegge,
  interpretaIdentita,
  stessoFormato,
} from "./ambito.js";
import type { Formato } from "./formato.js";

/**
 * L'ambito è **quale gioco si sta giocando**, e da qui in poi non è più una
 * costante del sorgente: è una cosa che si legge dal documento di formato e che
 * un mazzo salvato si porta dietro.
 *
 * Da qui si prova la sola cosa che conta davvero: **che cosa rende due formati
 * lo stesso formato**. Il nome non basta — è la voce del documento più esposta
 * a cambiare, ed è dichiarata da confermare — mentre il criterio e le edizioni
 * sono il gioco vero. Un mazzo salvato sopravvive a un cambio di nome e non
 * sopravvive a un cambio di edizioni, e questo è giusto in entrambi i versi.
 *
 * Le edizioni nominate qui sono **inventate**: ADR-0004 dice che nessun codice
 * di edizione vive nel sorgente, e un test è sorgente.
 */

const FORMATO: Formato = {
  nome: "Formato di prova",
  daConfermare: null,
  aggiornatoIl: "2026-09-06",
  fonte: "Il gruppo del giovedì, a voce",
  regolamentoDiRiferimento: "Il regolamento di prova",
  criterio: {
    regola: "stampa-italiana",
    descrizione: "Entra la carta che esiste stampata in italiano.",
    daConfermare: null,
  },
  edizioni: [
    {
      codice: "aaa",
      nome: "Prima edizione",
      perché: "È l'era.",
      lingue: ["it", "en"],
      daConfermare: null,
    },
    {
      codice: "bbb",
      nome: "Seconda edizione",
      perché: "È l'era.",
      lingue: ["it"],
      daConfermare: null,
    },
  ],
  limitate: { perché: "Troppo forti.", daConfermare: null, carte: [] },
  bandite: { perché: "Si giocano per la posta.", daConfermare: null, carte: [] },
};

describe("l'identità di un formato", () => {
  it("porta il nome che l'utente legge, preso dal documento", () => {
    expect(identitaDelFormato(FORMATO).nome).toBe("Formato di prova");
  });

  it("non cambia se cambia il nome: quello si mostra, non si confronta", () => {
    const rinominato = { ...FORMATO, nome: "Come lo chiamano al tavolo" };

    expect(identitaDelFormato(rinominato).impronta).toBe(identitaDelFormato(FORMATO).impronta);
  });

  it("non cambia se cambiano le limitate e le bandite: è lo stesso gioco", () => {
    // Una carta che il gruppo mette a una copia non fa un formato nuovo: fa lo
    // stesso formato con una riga in più. I mazzi salvati devono continuare ad
    // aprirsi, o ogni ripensamento del gruppo li chiuderebbe tutti.
    const conUnaLimitata: Formato = {
      ...FORMATO,
      limitate: {
        ...FORMATO.limitate,
        carte: [
          {
            carta: "Anello di Prova",
            perché: "Fa troppo mana.",
            divergenza: null,
            daConfermare: null,
          },
        ],
      },
    };

    expect(identitaDelFormato(conUnaLimitata).impronta).toBe(
      identitaDelFormato(FORMATO).impronta,
    );
  });

  it("non cambia se cambiano le lingue ammesse: le carte sono le stesse", () => {
    // Un mazzo è una lista di nomi, e l'impronta risponde a una domanda sola:
    // questo mazzo salvato è dello stesso gioco? Le lingue dicono quale copia si
    // porta al tavolo, non quali carte esistono — se entrassero, il giorno che
    // il gruppo risponde sulla Quarta inglese si chiuderebbero tutti i mazzi
    // salvati per una regola che non ne tocca nessuna carta (ADR-0006).
    const altreLingue: Formato = {
      ...FORMATO,
      edizioni: FORMATO.edizioni.map((edizione) => ({ ...edizione, lingue: ["fr", "de"] })),
    };

    expect(identitaDelFormato(altreLingue).impronta).toBe(identitaDelFormato(FORMATO).impronta);
  });

  it("cambia se cambiano le edizioni ammesse: è un altro gioco", () => {
    const conUnEdizioneInPiu: Formato = {
      ...FORMATO,
      edizioni: [
        ...FORMATO.edizioni,
        {
          codice: "ccc",
          nome: "Terza edizione",
          perché: "È l'era.",
          lingue: ["it"],
          daConfermare: null,
        },
      ],
    };

    expect(identitaDelFormato(conUnEdizioneInPiu).impronta).not.toBe(
      identitaDelFormato(FORMATO).impronta,
    );
  });

  it("cambia se cambia il criterio, a parità di edizioni", () => {
    const altroCriterio: Formato = {
      ...FORMATO,
      criterio: { ...FORMATO.criterio, regola: "solo-edizioni" },
    };

    expect(identitaDelFormato(altroCriterio).impronta).not.toBe(
      identitaDelFormato(FORMATO).impronta,
    );
  });

  it("non dipende dall'ordine in cui il documento elenca le edizioni", () => {
    // Il documento lo scrive una mano: due righe scambiate sono una correzione
    // di stile, non un formato nuovo.
    const rimescolato: Formato = { ...FORMATO, edizioni: [...FORMATO.edizioni].reverse() };

    expect(identitaDelFormato(rimescolato).impronta).toBe(identitaDelFormato(FORMATO).impronta);
  });
});

describe("l'identità riletta da fuori", () => {
  it("si rilegge com'era stata scritta", () => {
    expect(interpretaIdentita(identitaDelFormato(FORMATO))).toEqual(identitaDelFormato(FORMATO));
  });

  it("è assente, e non un guasto, quando il mazzo non la porta", () => {
    // È il mazzo salvato prima che l'app scrivesse il formato: si apre lo
    // stesso, e chi lo apre saprà dire che il formato non lo dichiara.
    expect(interpretaIdentita(undefined)).toBeUndefined();
    expect(interpretaIdentita(null)).toBeUndefined();
  });

  it("si rifiuta di leggere un'identità storta, invece di prenderla per buona", () => {
    expect(() => interpretaIdentita({ nome: "Un formato" })).toThrow(/formato/i);
    expect(() => interpretaIdentita({ impronta: "una-regola/aaa" })).toThrow(/formato/i);
    expect(() => interpretaIdentita("un formato")).toThrow(/formato/i);
  });
});

describe("due formati che si confrontano", () => {
  it("sono lo stesso quando l'impronta coincide", () => {
    const rinominato = identitaDelFormato({ ...FORMATO, nome: "Un altro nome" });

    expect(stessoFormato(identitaDelFormato(FORMATO), rinominato)).toBe(true);
  });

  it("non sono lo stesso quando le edizioni cambiano", () => {
    const altro = identitaDelFormato({ ...FORMATO, edizioni: [FORMATO.edizioni[0] as never] });

    expect(stessoFormato(identitaDelFormato(FORMATO), altro)).toBe(false);
  });

  it("un mazzo che non dichiara il formato non è del formato corrente", () => {
    // Non si sa di che formato sia, e «non si sa» non è «è il mio»: dirlo
    // altrimenti aprirebbe mazzi di un gioco che non si gioca più.
    expect(stessoFormato(identitaDelFormato(FORMATO), undefined)).toBe(false);
    expect(stessoFormato(undefined, undefined)).toBe(false);
  });
});

describe("l'identità riletta dal deposito", () => {
  it("storta vale assente: un mazzo non sparisce per il suo campo meno importante", () => {
    expect(identitaSeSiLegge({ nome: "Un formato" })).toBeUndefined();
    expect(identitaSeSiLegge("un formato")).toBeUndefined();
  });

  it("buona si legge come l'altra", () => {
    expect(identitaSeSiLegge(identitaDelFormato(FORMATO))).toEqual(identitaDelFormato(FORMATO));
  });
});
