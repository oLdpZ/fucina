/**
 * La fila davanti al deposito, provata dove decide: due lavori che partono
 * insieme, e l'ordine in cui atterrano.
 *
 * IndexedDB non serve, ed è il motivo per cui questa regola è una funzione sua.
 * Quel che il ticket 55 chiede — che due operazioni atterrino nell'ordine in
 * cui sono partite — è una domanda su questa fila, e si prova qui.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { creaFila, TETTO_DEL_TURNO } from "./fila.js";

/** Una promessa che si scioglie quando lo si dice, e non prima. */
function trattenuta<T>() {
  let sciogli!: (valore: T) => void;
  const promessa = new Promise<T>((risolvi) => {
    sciogli = risolvi;
  });
  return { promessa, sciogli };
}

describe("la fila davanti al deposito", () => {
  it("non fa partire il secondo finché il primo non ha finito", async () => {
    const inFila = creaFila();
    const primo = trattenuta<string>();
    let secondoPartito = false;

    const uno = inFila(() => primo.promessa);
    const due = inFila(() => {
      secondoPartito = true;
      return Promise.resolve("due");
    });

    // Il primo è ancora in volo: il secondo non deve aver nemmeno cominciato.
    await Promise.resolve();
    expect(secondoPartito).toBe(false);

    primo.sciogli("uno");
    expect(await uno).toBe("uno");
    expect(await due).toBe("due");
    expect(secondoPartito).toBe(true);
  });

  /**
   * Il caso del ticket 55, nudo: una scrittura partita da un tasto premuto è
   * ancora in volo quando parte il «rimetti i mazzi di partenza». Se atterrano
   * in ordine inverso, la cancellazione è annunciata e poi disfatta.
   */
  it("atterrano nell'ordine in cui sono partite, non in quello in cui finiscono", async () => {
    const inFila = creaFila();
    const atterrati: string[] = [];
    const lenta = trattenuta<void>();

    const scrittura = inFila(async () => {
      await lenta.promessa;
      atterrati.push("scrittura");
    });
    const cancellazione = inFila(() => {
      atterrati.push("cancellazione");
      return Promise.resolve();
    });

    lenta.sciogli();
    await Promise.all([scrittura, cancellazione]);
    expect(atterrati).toEqual(["scrittura", "cancellazione"]);
  });

  /**
   * Una fila che si spezza al primo guasto sarebbe peggio del difetto che
   * chiude: da lì in poi **nessuna** scrittura passerebbe più, e in silenzio.
   * Le funzioni del deposito promettono di non sollevare, ma la fila non si
   * fida di una promessa altrui per una conseguenza così grossa.
   */
  it("un lavoro che solleva non ferma quelli dopo", async () => {
    const inFila = creaFila();
    const rotto = inFila(() => Promise.reject(new Error("guasto")));
    const dopo = inFila(() => Promise.resolve("passo lo stesso"));

    await expect(rotto).rejects.toThrow("guasto");
    expect(await dopo).toBe("passo lo stesso");
  });

  it("due file sono due code: una lenta non trattiene l'altra", async () => {
    const una = creaFila();
    const altra = creaFila();
    const ferma = trattenuta<void>();

    void una(() => ferma.promessa);
    expect(await altra(() => Promise.resolve("libera"))).toBe("libera");
    ferma.sciogli();
  });
});

/**
 * Il tetto, che è la ragione per cui una fila si può mettere qui senza paura.
 *
 * `indexedDB.open()` **può restare muto per sempre**: non risponde né sì né no,
 * in contesti che certi browser trattano come ristretti — è il caso che
 * `TETTO_DEPOSITO` nomina in `aggiornamento.ts`, e non è un'ipotesi. Senza un
 * tetto qui, un turno che non finisce fermerebbe ogni operazione successiva
 * per il resto della sessione, in silenzio: il salvataggio degli orologi, i
 * mazzi, tutto. Sarebbe un difetto più grosso di quello che la fila chiude.
 *
 * Il turno scade e il prossimo parte. L'ordine si perde solo lì, dove non era
 * comunque più possibile tenerlo.
 */
describe("il tetto del turno", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un turno che non finisce mai non tiene ferma la fila per sempre", async () => {
    vi.useFakeTimers();
    const inFila = creaFila();
    let dopoPartito = false;

    // Un lavoro che non risponde né sì né no: il deposito muto.
    void inFila(() => new Promise<void>(() => {}));
    const dopo = inFila(() => {
      dopoPartito = true;
      return Promise.resolve("passo");
    });

    await vi.advanceTimersByTimeAsync(TETTO_DEL_TURNO - 1);
    expect(dopoPartito).toBe(false);

    await vi.advanceTimersByTimeAsync(2);
    expect(await dopo).toBe("passo");
  });

  it("un turno che finisce non lascia dietro di sé un'attesa", async () => {
    vi.useFakeTimers();
    const inFila = creaFila();
    await inFila(() => Promise.resolve("subito"));
    // La sveglia di un turno si spegne un soffio dopo il lavoro che la teneva:
    // chi ha chiesto il lavoro ha già la sua risposta mentre la fila sta ancora
    // chiudendo il turno.
    await vi.advanceTimersByTimeAsync(0);
    // Nessun timer sopravvive al lavoro che l'ha acceso: uno per operazione,
    // moltiplicato per un tasto premuto a ogni carattere, sarebbe una scia.
    expect(vi.getTimerCount()).toBe(0);
  });

  /**
   * Il tetto è di **un turno**, non della fila intera.
   *
   * La differenza non è un dettaglio: se la sveglia si armasse quando ci si
   * mette in fila invece di quando comincia il turno, tutti i lavori in coda la
   * farebbero partire insieme, e un po' di lavoro accumulato — qualche tasto
   * premuto in fretta, o i quattro megabyte del pool conservato — basterebbe a
   * liberarli tutti in una volta. Da lì in poi la fila non metterebbe più in
   * ordine niente, che è esattamente il difetto che esiste per chiudere. E col
   * deposito muto sarebbe peggio ancora: non scavalcherebbe solo il lavoro
   * fermo, ma tutta la coda dietro di lui.
   *
   * Qui nessun lavoro arriva vicino al tetto: è la **somma** a superarlo.
   */
  it("il tetto è di un turno, e non lo consuma chi sta in fila", async () => {
    vi.useFakeTimers();
    const inFila = creaFila();
    const atterrati: string[] = [];
    const dopo = (quanto: number, nome: string) => () =>
      new Promise<void>((risolvi) =>
        setTimeout(() => {
          atterrati.push(nome);
          risolvi();
        }, quanto),
      );

    // Due secondi e mezzo più uno: più del tetto sommati, meno ciascuno.
    const tutti = Promise.all([
      inFila(dopo(2500, "a")),
      inFila(dopo(1000, "b")),
      inFila(() => {
        atterrati.push("c");
        return Promise.resolve();
      }),
    ]);

    await vi.advanceTimersByTimeAsync(TETTO_DEL_TURNO * 2);
    await tutti;
    expect(atterrati).toEqual(["a", "b", "c"]);
  });
});
