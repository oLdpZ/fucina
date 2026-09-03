/**
 * Il motore, in un thread suo.
 *
 * La ricerca del ticket 11 dura secondi, e secondi in cui l'interfaccia non
 * risponde sono un'app rotta: sul telefono non si muove nemmeno lo scorrimento
 * della pagina. Qui gira in un **web worker**, e verso l'interfaccia partono i
 * messaggi di avanzamento mentre lavora.
 *
 * Questo file non contiene nessuna decisione: le decisioni stanno tutte in
 * `costruisci.ts`, che è puro e provato dai test. Qui c'è solo il passaggio dei
 * messaggi, l'orologio vero — che il worker può leggere perché è lui il fuori,
 * rispetto alla funzione pura — e il pool tenuto da parte per non ricopiarlo a
 * ogni richiesta.
 */

import { costruisciMazzo, orologioDiSistema } from "./costruisci.js";
import type { AllaRicerca, DallaRicerca } from "./protocollo.js";
import type { Carta } from "../dati/pool.js";

const ambito = self as unknown as DedicatedWorkerGlobalScope;

/** Le carte, mandate una volta sola e tenute qui finché non cambiano. */
let carte: readonly Carta[] = [];

function rispondi(messaggio: DallaRicerca): void {
  ambito.postMessage(messaggio);
}

ambito.addEventListener("message", (evento: MessageEvent<AllaRicerca>) => {
  const messaggio = evento.data;

  if (messaggio.tipo === "pool") {
    carte = messaggio.carte;
    return;
  }

  try {
    const frontiera = costruisciMazzo(messaggio.richiesta, carte, {
      orologio: orologioDiSistema,
      avanzamento: (avanzamento) => rispondi({ tipo: "avanzamento", avanzamento }),
    });
    rispondi({ tipo: "frontiera", frontiera });
  } catch (errore: unknown) {
    // Un guasto qui non deve lasciare l'interfaccia ad aspettare per sempre:
    // torna indietro come messaggio, e la schermata lo dice.
    rispondi({
      tipo: "guasto",
      messaggio: errore instanceof Error ? errore.message : String(errore),
    });
  }
});
