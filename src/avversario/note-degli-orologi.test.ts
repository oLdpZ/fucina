/**
 * La cucitura che decide se la schermata degli orologi porta una nota sul
 * deposito, provata dove decide: un esito di scrittura entra, una parola esce.
 *
 * Il browser non serve. Quel che il ticket 45 chiede — che la nota compaia al
 * primo rifiuto, resti finché una scrittura non riesce, e non arrivi mai quando
 * il deposito funziona — è una domanda su questa funzione, e si prova qui.
 */

import { describe, expect, it } from "vitest";

import type { EsitoDellaScrittura } from "../dati/deposito.js";
import type { OrologiDiPartenza } from "./carica-orologi.js";
import {
  notaDelDeposito,
  notaDelFileDiPartenza,
  notaDellaLettura,
  noteInFila,
} from "./note-degli-orologi.js";

/** Come l'app la usa: ogni esito riscrive la nota, e l'ultima è quella in vista. */
function dopoGliEsiti(
  quale: "salvataggio" | "ripristino",
  esiti: readonly EsitoDellaScrittura[],
) {
  let nota: string | null = null;
  for (const esito of esiti) nota = notaDelDeposito(quale, esito);
  return nota;
}

describe("la nota sul deposito degli orologi", () => {
  it("non dice niente quando il deposito accetta", () => {
    expect(notaDelDeposito("salvataggio", "fatta")).toBe(null);
    expect(notaDelDeposito("ripristino", "fatta")).toBe(null);
  });

  it("dice che cosa si perde quando il deposito rifiuta la scrittura", () => {
    const nota = notaDelDeposito("salvataggio", "rifiutata");
    expect(nota).not.toBe(null);
    // Quel che l'utente perde, non il nome della funzione che ha risposto no.
    expect(nota).toContain("sessione");
    expect(nota).not.toContain("salvaOrologi");
    expect(nota).not.toContain("IndexedDB");
  });

  it("dice che cosa si perde quando il deposito rifiuta di dimenticare", () => {
    const nota = notaDelDeposito("ripristino", "rifiutata");
    expect(nota).not.toBe(null);
    expect(nota).toContain("apertura");
    expect(nota).not.toBe(notaDelDeposito("salvataggio", "rifiutata"));
  });

  /**
   * L'asimmetria, ed è tutta la ragione per cui i tre esiti non sono due.
   *
   * Un deposito che non si apre — navigazione privata, `indexedDB` che non
   * c'è, un'altra scheda che tiene aperta una versione vecchia — non ha
   * scritto: quel che l'utente ha battuto lo perde, e la nota del salvataggio
   * è vera lì come altrove.
   *
   * Della cancellazione invece non si sa niente. In navigazione privata non
   * c'era niente da cancellare e non si perde niente; con un'altra scheda
   * aperta i suoi mazzi sono ancora lì. Una nota serve a **nominare una
   * perdita**, e una perdita che non si sa nominare non si inventa.
   */
  it("su un deposito che non si apre il salvataggio parla e il ripristino tace", () => {
    expect(notaDelDeposito("salvataggio", "nessun-deposito")).toBe(
      notaDelDeposito("salvataggio", "rifiutata"),
    );
    expect(notaDelDeposito("ripristino", "nessun-deposito")).toBe(null);
  });

  it("resta la stessa parola a ogni carattere battuto, e non se ne aggiunge una", () => {
    // Dieci tasti premuti in modo privato: la nota è una, identica, non dieci.
    const dieciRifiuti = dopoGliEsiti(
      "salvataggio",
      Array<EsitoDellaScrittura>(10).fill("nessun-deposito"),
    );
    expect(dieciRifiuti).toBe(notaDelDeposito("salvataggio", "rifiutata"));
  });

  it("se ne va quando una scrittura riesce, e non prima", () => {
    expect(dopoGliEsiti("salvataggio", ["rifiutata", "rifiutata"])).not.toBe(null);
    expect(dopoGliEsiti("salvataggio", ["rifiutata", "rifiutata", "fatta"])).toBe(null);
    expect(dopoGliEsiti("salvataggio", ["rifiutata", "fatta", "rifiutata"])).not.toBe(null);
  });
});

/**
 * L'altra porta, quella d'ingresso (ticket 54). Una lettura che non riesce
 * lascia la schermata senza i mazzi dell'utente pur senza averli persi, e
 * l'app da quel momento non scrive più per non scriverci sopra: sono due fatti
 * che riguardano lui, e tacerli sarebbe lo stesso silenzio del ticket 45.
 */
describe("la nota sulla lettura degli orologi", () => {
  it("non dice niente quando la lettura è riuscita", () => {
    expect(notaDellaLettura("letti")).toBe(null);
    expect(notaDellaLettura("mai-salvati")).toBe(null);
  });

  it("dice quali mazzi non si sono letti, e che questa sessione non si salva", () => {
    const nota = notaDellaLettura("non-si-e-letto");
    expect(nota).not.toBe(null);
    // **Quali** mazzi: quelli che incontri, come li chiama la nota del
    // salvataggio. L'app ne conserva anche un altro tipo — i mazzi salvati
    // dall'utente, che stanno in un altro scaffale e questa nota non tocca —
    // e chi legge non deve credere che siano quelli a essersi persi.
    expect(nota).toContain("mazzi che incontri");
    expect(nota).toContain("sessione");
    expect(nota).not.toContain("leggiOrologiSalvati");
    expect(nota).not.toContain("IndexedDB");
  });

  /**
   * La regola delle altre note vale anche qui: **solo quel che si sa**. Un
   * deposito che non si è lasciato leggere non dice che cosa ci sia dentro, e
   * promettere che i mazzi dell'utente sono al sicuro sarebbe inventare — la
   * stessa invenzione per cui la nota del ripristino tace.
   */
  it("non promette che quel che non si è letto sia ancora là", () => {
    const nota = notaDellaLettura("non-si-e-letto") ?? "";
    expect(nota).not.toContain("non sono persi");
    expect(nota).not.toContain("al sicuro");
  });

  it("non è la nota del salvataggio: dicono due cose diverse", () => {
    expect(notaDellaLettura("non-si-e-letto")).not.toBe(
      notaDelDeposito("salvataggio", "rifiutata"),
    );
  });
});

/**
 * La terza porta: il file di cortesia del manutentore (ticket 57).
 *
 * Quel file esiste per una cosa sola — che la prima schermata non sia vuota —,
 * e quando è lui a mancare la schermata resta vuota per un guasto e non per una
 * decisione. È la stessa distinzione del ticket 54, da un'altra parte ancora.
 */
describe("la nota sul file di partenza degli orologi", () => {
  const letti = (scarti: Map<number, string>): OrologiDiPartenza => ({
    come: "letti",
    orologi: [],
    scarti,
  });

  it("non dice niente quando il file si è letto per intero", () => {
    expect(notaDelFileDiPartenza(letti(new Map()))).toBe(null);
  });

  it("dice che i mazzi di partenza non ci sono, quando il file non si è letto", () => {
    const nota = notaDelFileDiPartenza({ come: "non-si-e-letto" });
    expect(nota).not.toBe(null);
    // Che cosa vede l'utente: il pannello comincia vuoto, e non perché lo abbia
    // deciso lui. Non il nome del file, non il codice della risposta.
    expect(nota).toContain("vuoto");
    expect(nota).not.toContain("orologi.json");
    expect(nota).not.toContain("fetch");
  });

  it("conta le righe cadute, e dice che le altre ci sono", () => {
    const una = notaDelFileDiPartenza(letti(new Map([[1, "non si legge"]])));
    const due = notaDelFileDiPartenza(letti(new Map([[1, "no"], [3, "no"]])));
    expect(una).toContain("1 mazzo");
    expect(due).toContain("2 mazzi");
    // Non è la nota del file che manca: là non c'è niente, qui c'è quasi tutto.
    expect(una).not.toBe(notaDelFileDiPartenza({ come: "non-si-e-letto" }));
  });
});

/**
 * Due porte che si aprono insieme e una casella sola.
 *
 * Succede al «rimetti i mazzi di partenza»: la cancellazione può fallire e il
 * file di cortesia può non arrivare, nello stesso istante. Le due note vanno
 * messe in fila senza che l'una neghi quel che l'altra afferma — che è la
 * ragione per cui la nota del ripristino non dice più «i mazzi di partenza
 * sono tornati sullo schermo»: quando il file non arriva, non sono tornati.
 */
describe("due note nella stessa casella", () => {
  it("una sola nota resta quella che è", () => {
    const sola = notaDelDeposito("ripristino", "rifiutata");
    expect(noteInFila(null, sola)).toBe(sola);
    expect(noteInFila(sola, null)).toBe(sola);
  });

  it("niente da dire resta niente", () => {
    expect(noteInFila(null, null)).toBe(null);
  });

  it("due note stanno nella stessa casella, nell'ordine in cui arrivano", () => {
    const insieme = noteInFila(
      notaDelFileDiPartenza({ come: "non-si-e-letto" }),
      notaDelDeposito("ripristino", "rifiutata"),
    );
    expect(insieme).toContain("non si sono potuti caricare");
    expect(insieme).toContain("apertura");
  });

  it("nessuna delle due promette che i mazzi di partenza siano sullo schermo", () => {
    // Il ripristino parla del **dispositivo**, non dello schermo: la frase che
    // parlava dello schermo diventava falsa appena il file non arrivava.
    const nota = notaDelDeposito("ripristino", "rifiutata") ?? "";
    expect(nota).not.toContain("sono tornati sullo schermo");
  });
});
