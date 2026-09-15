import { describe, expect, it } from "vitest";

import type { ContenutoMazzo } from "./salvato.js";
import { leggiScambio, listaDaTorneo, scriviScambio } from "./scambio.js";
import { FILTRO_TEMA_VUOTO } from "../tema/tema.js";

/**
 * Ticket 07: si esporta un mazzo in un testo, lo si manda a un amico, l'amico
 * lo importa e vede lo stesso mazzo — lista **e** richiesta che l'ha prodotto.
 *
 * Il testo passa per messaggi, appunti e programmi di posta: arriva tagliato,
 * arriva con righe in più, arriva incollato due volte. In tutti questi casi
 * l'app deve dire che cosa non va, mai cadere.
 */

/**
 * Il formato che l'app sta giocando nei test: inventato, perché nessun nome di
 * formato né codice di edizione vive nel sorgente (ADR-0004), e un test è
 * sorgente. Il mazzo di prova è di questo formato, come ogni mazzo che l'app
 * scrive oggi: un testo senza formato è un altro caso, provato più sotto.
 */
const FORMATO = { nome: "Formato di prova", impronta: "una-regola/aaa+bbb" };

const MAZZO: ContenutoMazzo = {
  nome: "Il mazzo dell'amico",
  salvatoIl: "2026-09-03T10:00:00.000Z",
  datiDel: "2026-09-02T09:05:48.145+00:00",
  richiesta: { origine: "a-mano", terreVolute: 22 },
  formato: FORMATO,
  carte: [
    { nome: "Prima Carta", copie: 4 },
    { nome: "Seconda Carta", copie: 2 },
  ],
};

/** Il testo letto dall'app che gioca il formato di prova. */
const leggi = (testo: string) => leggiScambio(testo, FORMATO);

describe("il testo da scambiare", () => {
  it("si legge: c'è dentro il nome del mazzo e ogni carta con le sue copie", () => {
    const testo = scriviScambio(MAZZO);
    expect(testo).toContain("Il mazzo dell'amico");
    expect(testo).toContain("4 Prima Carta");
    expect(testo).toContain("2 Seconda Carta");
  });

  it("porta con sé la richiesta, non solo la lista", () => {
    expect(scriviScambio(MAZZO)).toMatch(/richiesta/i);
    expect(scriviScambio(MAZZO)).toMatch(/22/);
  });

  it("riletto, ricostruisce il mazzo così com'era", () => {
    expect(leggi(scriviScambio(MAZZO))).toEqual(MAZZO);
  });

  it("ricostruisce anche un mazzo le cui terre le decide la curva", () => {
    const dallaCurva: ContenutoMazzo = {
      ...MAZZO,
      richiesta: { origine: "a-mano", terreVolute: null },
    };
    expect(leggi(scriviScambio(dallaCurva))).toEqual(dallaCurva);
  });

  it("sopporta gli spazi e le righe vuote che i programmi di posta aggiungono", () => {
    const maltrattato = scriviScambio(MAZZO)
      .split("\n")
      .map((riga) => `  ${riga}  `)
      .join("\n\n");
    expect(leggi(maltrattato)).toEqual(MAZZO);
  });

  it("sopporta le righe terminate come le termina Windows", () => {
    expect(leggi(scriviScambio(MAZZO).replace(/\n/gu, "\r\n"))).toEqual(MAZZO);
  });
});

describe("un testo che non si può importare", () => {
  it("dice che non è un mazzo, se non lo è", () => {
    expect(() => leggi("ciao come stai")).toThrow(/mazzo/i);
    expect(() => leggi("")).toThrow(/mazzo/i);
  });

  it("dice che è troncato, se finisce a metà", () => {
    const meta = scriviScambio(MAZZO).split("\n").slice(0, 6).join("\n");
    expect(() => leggi(meta)).toThrow(/tronc/i);
  });

  it("si accorge se manca una carta, anche se la riga finale c'è", () => {
    const senzaUnaCarta = scriviScambio(MAZZO)
      .split("\n")
      .filter((riga) => !riga.includes("Seconda Carta"))
      .join("\n");
    expect(() => leggi(senzaUnaCarta)).toThrow(/(manca|incomplet|copie)/i);
  });

  it("non si fida di un testo che non dice quante carte contiene", () => {
    const senzaConta = scriviScambio(MAZZO)
      .split("\n")
      .filter((riga) => !riga.startsWith("Carte ("))
      .join("\n");
    expect(() => leggi(senzaConta)).toThrow(/quante carte/i);
  });

  it("si accorge di un testo incollato due volte, e non lo chiama tagliato", () => {
    const doppio = `${scriviScambio(MAZZO)}\n${scriviScambio(MAZZO)}`;
    expect(() => leggi(doppio)).toThrow(/due volte/i);
  });

  it("dice che viene da un'app più recente, se il formato è di là da venire", () => {
    const dalFuturo = scriviScambio(MAZZO).replace("formato 1", "formato 9");
    expect(() => leggi(dalFuturo)).toThrow(/recente/i);
  });

  it("non accetta un mazzo senza carte", () => {
    const senzaCarte = scriviScambio(MAZZO)
      .split("\n")
      .filter((riga) => !/^\d+ /u.test(riga.trim()))
      .join("\n");
    expect(() => leggi(senzaCarte)).toThrow(/carte/i);
  });
});

describe("la lista da consegnare all'arbitro", () => {
  const carte = [
    { nome: "Seconda Carta", copie: 2 },
    { nome: "Prima Carta", copie: 4 },
  ];
  const terre = [
    { nome: "Mountain", copie: 12 },
    { nome: "Blood Crypt", copie: 4 },
  ];

  it("è solo testo: nomi inglesi e copie, niente altro", () => {
    expect(listaDaTorneo(carte, terre)).toBe(
      ["4 Prima Carta", "2 Seconda Carta", "4 Blood Crypt", "12 Mountain"].join("\n"),
    );
  });

  it("mette le terre in fondo, come si scrive una lista", () => {
    const righe = listaDaTorneo(carte, terre).split("\n");
    expect(righe.indexOf("12 Mountain")).toBeGreaterThan(righe.indexOf("4 Prima Carta"));
  });

  it("regge un mazzo senza terre, che è il mazzo appena cominciato", () => {
    expect(listaDaTorneo(carte, [])).toBe(["4 Prima Carta", "2 Seconda Carta"].join("\n"));
  });
});

describe("il formato scritto nel testo da scambiare", () => {
  it("dice a parole di che formato è il mazzo", () => {
    expect(scriviScambio(MAZZO)).toContain("Formato di prova");
  });

  it("riletto, ricostruisce anche il formato", () => {
    expect(leggi(scriviScambio(MAZZO)).formato).toEqual(FORMATO);
  });

  it("porta l'impronta, non solo il nome: è quella che si confronta", () => {
    // Il nome del formato è la voce del documento più esposta a cambiare. Un
    // testo che portasse solo quello direbbe «altro formato» il giorno che il
    // gruppo decide come si chiama il proprio — e lo rifiuterebbe.
    const rinominato = leggi(
      scriviScambio(MAZZO).replace("Formato di prova", "Come lo chiamano al tavolo"),
    );

    expect(rinominato.formato?.impronta).toBe(FORMATO.impronta);
    expect(rinominato.carte).toEqual(MAZZO.carte);
  });
});

/**
 * Ticket 10: il testo di un altro gioco si **rifiuta con la sua ragione**, per
 * la stessa porta da cui passa la richiesta che non si riconosce — un errore
 * che si legge all'utente così com'è.
 */
describe("un testo di un altro formato", () => {
  const ALTRO = { nome: "Formato di prima", impronta: "altra-regola/ccc" };

  it("si rifiuta, e il rifiuto nomina il formato del testo e quello dell'app", () => {
    const diPrima = scriviScambio({ ...MAZZO, formato: ALTRO });

    expect(() => leggi(diPrima)).toThrow(/«Formato di prima»/u);
    expect(() => leggi(diPrima)).toThrow(/«Formato di prova»/u);
    expect(() => leggi(diPrima)).toThrow(/non l.ho importato/u);
  });

  it("un testo che il formato non lo dichiara si rifiuta: «non si sa» non è «è il mio»", () => {
    // È il testo esportato prima che l'app scrivesse il formato, cioè dal gioco
    // di prima: le sue carte qui non esistono.
    const { formato: _formato, ...senza } = MAZZO;

    expect(() => leggi(scriviScambio(senza))).toThrow(/non dice di che formato/u);
  });

  it("il formato si guarda prima delle righe che il gioco di prima scriveva diverse", () => {
    // Un tema scritto con i filtri di un altro gioco non deve coprire la ragione
    // vera: il mazzo non si importa perché è di un altro formato.
    const conTemaStorto = scriviScambio({ ...MAZZO, formato: ALTRO }).replace(
      "Richiesta:",
      'Tema: {"esclusioni":{"colori":["Nero"]}}\nRichiesta:',
    );

    expect(() => leggi(conTemaStorto)).toThrow(/«Formato di prima»/u);
  });

  it("un testo tagliato resta un testo tagliato, anche se è di un altro formato", () => {
    // Il formato si legge dal testo: se il testo non è intero non si sa
    // nemmeno quello, e la ragione da dire è la prima.
    const meta = scriviScambio({ ...MAZZO, formato: ALTRO }).split("\n").slice(0, 6).join("\n");

    expect(() => leggi(meta)).toThrow(/tronc/i);
  });
});

describe("il formato sulla lista da consegnare all'arbitro", () => {
  const carte = [{ nome: "Prima Carta", copie: 4 }];

  it("nomina il formato quando lo si conosce, perché l'arbitro deve leggerlo", () => {
    const lista = listaDaTorneo(carte, [], { nome: "Formato di prova", impronta: "r/aaa" });

    expect(lista.split("\n")[0]).toContain("Formato di prova");
    expect(lista).toContain("4 Prima Carta");
  });
});

/**
 * Ticket 31: il testo che si manda a un amico porta gli **stessi campi** del
 * mazzo salvato, tema e tetto compresi. Senza, un mazzo esportato e reimportato
 * perderebbe per strada proprio quel che decide le sue terre — cioè il guasto
 * del ticket, spostato di una porta.
 */
describe("il tema e il tetto nel testo da scambiare", () => {
  const CON_VINCOLI: ContenutoMazzo = {
    ...MAZZO,
    richiesta: {
      ...MAZZO.richiesta,
      tema: {
        inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] },
        seme: "Goblin King",
        esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] },
        allargamenti: [],
      },
      tetto: 30,
    },
  };

  it("fa il giro intero e torna identico: è la promessa su cui poggiano le terre", () => {
    expect(leggi(scriviScambio(CON_VINCOLI))).toEqual(CON_VINCOLI);
  });

  it("dice il tetto in una riga che si legge a occhio", () => {
    expect(scriviScambio(CON_VINCOLI)).toMatch(/Tetto di spesa in euro: 30/u);
  });

  it("un testo scritto prima di questo cambio si legge lo stesso, senza vincoli", () => {
    // Le due righe del ticket 31 semplicemente non ci sono, e il mazzo si
    // importa intero — purché dichiari il formato che l'app gioca: un testo
    // senza formato si rifiuta per quello (ticket 10), prima ancora di arrivare
    // alle righe del tema e del tetto.
    const letto = leggi(scriviScambio(MAZZO));
    expect(letto.richiesta.tema).toBeUndefined();
    expect(letto.richiesta.tetto).toBeUndefined();
    expect(letto.carte).toEqual(MAZZO.carte);
  });

  it("un testo vecchio, scritto senza le righe nuove, non le pretende", () => {
    const senzaRighe = scriviScambio(CON_VINCOLI)
      .split("\n")
      .filter((riga) => !riga.startsWith("Tema:") && !riga.startsWith("Tetto di spesa"))
      .join("\n");

    const letto = leggi(senzaRighe);
    expect(letto.richiesta.tema).toBeUndefined();
    expect(letto.richiesta.tetto).toBeUndefined();
    expect(letto.carte).toEqual(MAZZO.carte);
  });

  it("una riga del tema maltrattata per strada si dice, e dice come rimediare", () => {
    // Un tema letto a metà rifarebbe in silenzio una base di terre che nessuno
    // ha chiesto: è proprio la cosa che il ticket 31 chiude, e qui si preferisce
    // fermarsi dicendo che cosa togliere per importare comunque la lista.
    const rotto = scriviScambio(CON_VINCOLI).replace(/^Tema: .*$/mu, 'Tema: {"esclusioni":');

    expect(() => leggi(rotto)).toThrow(/tema/i);
    expect(() => leggi(rotto)).toThrow(/riga/i);
  });

  it("un tema che non si riconosce si rifiuta invece di essere indovinato", () => {
    const storto = scriviScambio(CON_VINCOLI).replace(
      /^Tema: .*$/mu,
      'Tema: {"esclusioni":{"colori":["Nero"]}}',
    );

    expect(() => leggi(storto)).toThrow(/colore/i);
  });

  it("una riga del tema che non contiene un tema si dice, invece di valere «nessun tema»", () => {
    // JSON valido, forma sbagliata: prima si lasciava spogliare fino a diventare
    // «nessun vincolo», e chi importava si rifaceva le terre col proprio tema
    // senza che niente glielo dicesse. È il guasto del ticket rientrato dalla
    // porta di servizio, e va chiuso di qui.
    for (const scritto of ['Tema: {}', 'Tema: []', 'Tema: {"esclusioni":["B"]}']) {
      const storto = scriviScambio(CON_VINCOLI).replace(/^Tema: .*$/mu, scritto);
      expect(() => leggi(storto)).toThrow(/tema/i);
    }
  });

  it("il tetto zero fa il giro come tetto, non come «nessun tetto»", () => {
    const gratis: ContenutoMazzo = {
      ...MAZZO,
      richiesta: { ...MAZZO.richiesta, tetto: 0 },
    };
    expect(leggi(scriviScambio(gratis)).richiesta.tetto).toBe(0);
  });

  it("un tetto che non è una cifra si dice, invece di passare per nessun tetto", () => {
    const storto = scriviScambio(CON_VINCOLI).replace(
      /^Tetto di spesa in euro: .*$/mu,
      "Tetto di spesa in euro: trenta",
    );

    expect(() => leggi(storto)).toThrow(/tetto/i);
  });
});
