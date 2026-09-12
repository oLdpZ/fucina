import { describe, expect, it } from "vitest";

import { POOL_FINTO, TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import type { CopieDiCarta } from "./base-di-terre.js";
import {
  altraStampaDelPrezzo,
  attaccoDelPrezzo,
  AVVISO_STIMA_AL_RIBASSO,
  descriviLaStampa,
  listaDellaSpesa,
  contoDelMazzo,
  costaMeno,
  nonSupera,
  prezzoDiUnaCopia,
} from "./spesa.js";

const carta = (nome: string): Carta => {
  const trovata = [...POOL_FINTO, ...TERRE_FINTE].find((c) => c.nome === nome);
  if (trovata === undefined) throw new Error(`Il pool finto non ha ${nome}.`);
  return trovata;
};

/** Una carta del pool finto con un prezzo scelto dal test. */
const a = (nome: string, euro: number | null, copie: number): CopieDiCarta => ({
  carta: {
    ...carta(nome),
    prezzo: {
      euro,
      aggiornatoIl: "2026-09-06T09:17:09.373+00:00",
      stampa: euro === null ? null : { edizione: "prova", numeroDiCollezione: "1", lingua: "en" },
    },
  },
  copie,
});

describe("il prezzo di una carta", () => {
  it("è quello della stampa che il pool ha scelto", () => {
    expect(prezzoDiUnaCopia(a("Goblin Chieftain", 3.5, 1).carta)).toBe(3.5);
  });

  it("è «non lo so» e non zero quando nessuna copia ammessa ha listino", () => {
    // Sono le carte di cui Cardmarket non quota nessuna copia che il formato
    // ammetta. Contarle zero direbbe che sono gratis, che è la bugia più cara
    // di tutte.
    expect(prezzoDiUnaCopia(a("Goblin Chieftain", null, 1).carta)).toBeNull();
  });
});

describe("il conto di un mazzo", () => {
  it("somma le copie, non le carte", () => {
    const mazzo = [a("Goblin Chieftain", 2, 4), a("Skirk Prospector", 0.5, 2)];

    expect(contoDelMazzo(mazzo).minimo).toBeCloseTo(9, 6);
  });

  it("conta solo quel che ha un prezzo, invece di far finta che il resto sia gratis", () => {
    const mazzo = [a("Goblin Chieftain", 2, 4), a("Skirk Prospector", null, 4)];

    expect(contoDelMazzo(mazzo).minimo).toBeCloseTo(8, 6);
  });

  it("di un mazzo vuoto è zero", () => {
    expect(contoDelMazzo([]).minimo).toBe(0);
  });

  it("porta con sé le carte che non sa contare, invece di lasciarle sparire", () => {
    // È la metà che mancava (ticket 34). Il minimo da solo non sa di essere un
    // minimo, e chi lo confrontava col tetto di spesa non poteva accorgersene:
    // una carta senza listino pesava zero, il conto tornava, e il mazzo usciva
    // con un prezzo scritto sotto che nessuno poteva mantenere.
    const mazzo = [a("Goblin Chieftain", 2, 4), a("Skirk Prospector", null, 4)];

    expect(contoDelMazzo(mazzo).incontabili.map((carta) => carta.nome)).toEqual([
      "Skirk Prospector",
    ]);
  });

  it("di un mazzo che sa contare tutto non nomina nessuno", () => {
    // Vuoto è la notizia buona: lì il minimo è il prezzo, e si può confrontare
    // con un tetto senza mentire.
    expect(contoDelMazzo([a("Goblin Chieftain", 2, 4)]).incontabili).toEqual([]);
  });

  it("non nomina una carta di cui il mazzo tiene zero copie", () => {
    // `scendiNelBudget` chiama di qui con le voci già scese a zero, una alla
    // volta, per vedere quanto costerebbe la base senza. Zero copie non sono
    // una carta nel mazzo, e chi leggesse `incontabili` da lì rifiuterebbe un
    // mazzo per una carta che non contiene.
    expect(contoDelMazzo([a("Goblin Chieftain", null, 0)]).incontabili).toEqual([]);
  });

  it("la stessa carta in due voci si nomina una volta sola", () => {
    // Come in `listaDellaSpesa`: due righe da comprare per una carta sola
    // direbbero che le carte incontabili sono il doppio di quante sono.
    const mazzo = [a("Goblin Chieftain", null, 2), a("Goblin Chieftain", null, 2)];

    expect(contoDelMazzo(mazzo).incontabili).toHaveLength(1);
  });
});

describe("la lista della spesa", () => {
  const mazzo = [
    a("Goblin Chieftain", 2, 4),
    a("Skirk Prospector", 0.5, 3),
    a("Mountain", 0.32, 20),
  ];

  it("mette in cima quel che costa di più: è lì che si decide", () => {
    expect(listaDellaSpesa(mazzo).voci.map((v) => v.carta.nome)).toEqual([
      "Goblin Chieftain",
      "Mountain",
      "Skirk Prospector",
    ]);
  });

  it("dice quanto costa una copia e quanto costano le copie chieste", () => {
    const voce = listaDellaSpesa(mazzo).voci[0];

    expect(voce?.euroPerCopia).toBe(2);
    expect(voce?.euro).toBe(8);
  });

  it("dà il totale di quel che si può contare", () => {
    expect(listaDellaSpesa(mazzo).totale).toBeCloseTo(8 + 1.5 + 6.4, 6);
  });

  it("tiene da parte le carte senza prezzo, perché il totale non le racconta", () => {
    const lista = listaDellaSpesa([...mazzo, a("Krenko's Command", null, 2)]);

    expect(lista.senzaPrezzo.map((v) => v.carta.nome)).toEqual(["Krenko's Command"]);
    // Il totale resta quello di prima: la carta senza prezzo non lo alza né lo
    // abbassa, ed è la ragione per cui va nominata a parte.
    expect(lista.totale).toBeCloseTo(8 + 1.5 + 6.4, 6);
  });

  it("nomina le carte della Reserved List, che non diventeranno più economiche", () => {
    const riservata: CopieDiCarta = {
      carta: { ...a("Goblin Chieftain", 90, 1).carta, riservata: true },
      copie: 1,
    };
    const lista = listaDellaSpesa([riservata, a("Skirk Prospector", 0.5, 3)]);

    expect(lista.riservate.map((v) => v.carta.nome)).toEqual(["Goblin Chieftain"]);
  });

  it("porta la data dei prezzi, che senza sarebbero una mezza bugia", () => {
    expect(listaDellaSpesa(mazzo).aggiornatoIl).toBe("2026-09-06T09:17:09.373+00:00");
  });

  it("di un mazzo vuoto non inventa una data", () => {
    const lista = listaDellaSpesa([]);

    expect(lista.aggiornatoIl).toBeNull();
    expect(lista.totale).toBe(0);
    expect(lista.voci).toEqual([]);
  });

  it("mette una carta sola per nome, con tutte le sue copie", () => {
    expect(listaDellaSpesa(mazzo).voci).toHaveLength(3);
  });
});

describe("quale stampa ha fatto il conto", () => {
  it("dice edizione, numero e lingua: è quel che si cerca su Cardmarket", () => {
    const goblin: Carta = {
      ...carta("Goblin Chieftain"),
      edizione: "4ed",
      numeroDiCollezione: "212",
      linguaDellaStampa: "en",
    };

    expect(descriviLaStampa(goblin)).toBe("4ED 212, inglese");
  });

  it("chiama l'italiano col suo nome: sono le carte senza prezzo, e si vede da qui", () => {
    const duale: Carta = {
      ...carta("Goblin Chieftain"),
      edizione: "leg",
      numeroDiCollezione: "288",
      linguaDellaStampa: "it",
    };

    expect(descriviLaStampa(duale)).toBe("LEG 288, italiano");
  });

  it("chiama col suo nome anche una lingua che il prezzo può portare", () => {
    // Da quando il prezzo si stacca dalla stampa mostrata, la lingua è spesso
    // l'unico pezzo che distingue le due: un codice di due lettere in mezzo a
    // una frase italiana sarebbe la confusione che la riga esiste per togliere.
    const francese: Carta = {
      ...carta("Goblin Chieftain"),
      edizione: "fbb",
      numeroDiCollezione: "139",
      linguaDellaStampa: "fr",
    };

    expect(descriviLaStampa(francese)).toBe("FBB 139, francese");
  });

  it("non inventa il nome di una lingua che non conosce: ne scrive il codice", () => {
    const ignota: Carta = {
      ...carta("Goblin Chieftain"),
      edizione: "leg",
      numeroDiCollezione: "288",
      linguaDellaStampa: "ru",
    };

    expect(descriviLaStampa(ignota)).toBe("LEG 288, ru");
  });

  it("dice «non lo so» per una carta che la stampa non ce l'ha", () => {
    // Succede coi mazzi salvati da un pool vecchio, che la stampa non la
    // scriveva: meglio una frase che dice di non sapere di una che finge.
    const senza: Carta = {
      ...carta("Goblin Chieftain"),
      edizione: "",
      numeroDiCollezione: "",
      linguaDellaStampa: "",
    };

    expect(descriviLaStampa(senza)).toBe("stampa sconosciuta");
  });
});

describe("quale stampa ha fatto il prezzo, quando non è quella mostrata", () => {
  const goblin = (): Carta => ({
    ...carta("Goblin Chieftain"),
    edizione: "leg",
    numeroDiCollezione: "288",
    linguaDellaStampa: "it",
  });

  it("la dice quando il prezzo viene da un'altra copia ammessa", () => {
    // Sono le carte che l'app descrive con una stampa che listino non ha: chi
    // legge il prezzo deve sapere quale delle due cercare su Cardmarket, o
    // confronterebbe il proprio numero con quello di un'altra copia.
    const carta: Carta = {
      ...goblin(),
      prezzo: {
        euro: 280,
        aggiornatoIl: "2026-09-06T09:17:09.373+00:00",
        stampa: { edizione: "leg", numeroDiCollezione: "288", lingua: "fr" },
      },
    };

    expect(altraStampaDelPrezzo(carta)).toBe("LEG 288, francese");
  });

  it("non dice niente quando a prezzare è la stessa copia che si mostra", () => {
    // È il caso normale, e non ha niente di speciale da dire: ripeterla
    // sarebbe rumore che insegna a non leggere la riga quando conta.
    const carta: Carta = {
      ...goblin(),
      prezzo: {
        euro: 3,
        aggiornatoIl: "2026-09-06T09:17:09.373+00:00",
        stampa: { edizione: "leg", numeroDiCollezione: "288", lingua: "it" },
      },
    };

    expect(altraStampaDelPrezzo(carta)).toBeNull();
  });

  it("non dice niente quando un prezzo non c'è affatto", () => {
    const carta: Carta = {
      ...goblin(),
      prezzo: { euro: null, aggiornatoIl: "2026-09-06T09:17:09.373+00:00", stampa: null },
    };

    expect(altraStampaDelPrezzo(carta)).toBeNull();
  });

  it("dice che è un'altra **edizione** quando a cambiare non è solo la lingua", () => {
    // La differenza che il ticket 30 chiede di non lasciare sottovoce. Un'altra
    // lingua della stessa edizione è lo stesso cartoncino in un'altra stampa e
    // costa press'a poco uguale; un'altra edizione è un'altra carta da comprare,
    // e il pavimento che l'app promette non è il pavimento di quella mostrata.
    const carta: Carta = {
      ...goblin(),
      prezzo: {
        euro: 0.22,
        aggiornatoIl: "2026-09-06T09:17:09.373+00:00",
        stampa: { edizione: "4ed", numeroDiCollezione: "117", lingua: "en" },
      },
    };

    expect(attaccoDelPrezzo(carta)).toContain("altra edizione");
    expect(altraStampaDelPrezzo(carta)).toBe("4ED 117, inglese");
  });

  it("avvisa anche quando a cambiare è il numero di collezione dentro la stessa edizione", () => {
    // Nel pool vero sono sette: le cinque terre base, che dentro la Quarta
    // hanno più figure con numeri diversi, e due carte che la Quarta tedesca
    // numera per conto suo. L'edizione è la stessa, ma il cartoncino no — e la
    // riga manda a cercare un numero che non è quello mostrato. Dirlo nel
    // registro sottovoce vorrebbe dire chiamarlo «la stessa carta».
    const carta: Carta = {
      ...goblin(),
      edizione: "4ed",
      numeroDiCollezione: "378",
      prezzo: {
        euro: 0.09,
        aggiornatoIl: "2026-09-06T09:17:09.373+00:00",
        stampa: { edizione: "4ed", numeroDiCollezione: "377", lingua: "en" },
      },
    };

    expect(attaccoDelPrezzo(carta)).toContain("un’altra stampa");
    expect(attaccoDelPrezzo(carta)).not.toContain("edizione");
  });

  it("non parla né di edizione né di stampa quando a cambiare è la sola lingua", () => {
    // Dirlo qui vorrebbe dire dirlo quasi sempre — nel pool vero è il caso di
    // gran lunga più comune — e un avviso che c'è sempre non avvisa di niente.
    const carta: Carta = {
      ...goblin(),
      prezzo: {
        euro: 280,
        aggiornatoIl: "2026-09-06T09:17:09.373+00:00",
        stampa: { edizione: "leg", numeroDiCollezione: "288", lingua: "fr" },
      },
    };

    expect(attaccoDelPrezzo(carta)).not.toContain("edizione");
  });
});

describe("l'avviso che accompagna ogni prezzo", () => {
  it("dice che è una stima al ribasso, e perché", () => {
    expect(AVVISO_STIMA_AL_RIBASSO).toMatch(/stima al ribasso/i);
    // Il pavimento è il prezzo di una copia che al tavolo si può giocare: è una
    // promessa più forte di quella di prima, e va detta per quella che è.
    expect(AVVISO_STIMA_AL_RIBASSO).toMatch(/listino/i);
    expect(AVVISO_STIMA_AL_RIBASSO).toMatch(/copi/i);
  });
});

describe("quando una spesa sta dentro una cifra chiesta", () => {
  /**
   * La cifra che l'utente legge e riscrive: due decimali, come la mostra
   * ogni schermata dell'app.
   */
  const mostrata = (quanti: number): number => Number(quanti.toFixed(2));

  it("ci sta un conto che in binario non torna, e a occhio è lo stesso numero", () => {
    // Il caso vero: un mazzo costa la somma di sessanta decimali, l'app ne
    // mostra «233,25 €», e chi riscrive quella cifra nella casella del tetto
    // deve riavere quel mazzo. Il confronto nudo rispondeva di no.
    const conto = 0.1 + 0.2;

    expect(conto).toBeGreaterThan(mostrata(conto));
    expect(nonSupera(conto, mostrata(conto))).toBe(true);
  });

  it("non ci sta un centesimo in più, che è una differenza vera", () => {
    // Il perdono vale mezzo centesimo, cioè quanto un prezzo può discostarsi
    // dalla cifra che lo mostra. Un centesimo intero è un prezzo diverso, e un
    // tetto che lo lasciasse passare non sarebbe più il tetto chiesto.
    expect(nonSupera(30.01, 30)).toBe(false);
  });

  it("ci sta, come sempre, quel che costa meno", () => {
    expect(nonSupera(29, 30)).toBe(true);
    expect(nonSupera(30, 30)).toBe(true);
  });
});

describe("quando una spesa costa meno di un'altra", () => {
  it("due somme che valgono lo stesso non sono un risparmio", () => {
    // La domanda della base di terre quando sceglie quale copia togliere: le
    // due somme stanno sopra insiemi diversi di terre, e valendo lo stesso
    // differiscono lo stesso di un quadrilionesimo. Prendere quel rumore per un
    // risparmio faceva rinunciare a una terra per niente — e l'utente se lo
    // leggeva scritto (ticket 47).
    const somma = 0.1 + 0.2;

    expect(somma).not.toBe(0.3);
    expect(costaMeno(somma, 0.3)).toBe(false);
    expect(costaMeno(0.3, somma)).toBe(false);
  });

  it("un centesimo è un risparmio, e si può scrivere in euro", () => {
    // Ogni prezzo arriva dal listino scritto al centesimo: sotto il centesimo
    // non c'è nessuna differenza vera da trovare, e il centesimo intero deve
    // passare tutto.
    expect(costaMeno(29.99, 30)).toBe(true);
    expect(costaMeno(30, 29.99)).toBe(false);
  });
});
