/**
 * Il motore visto dall'interfaccia: un worker che vive quanto l'app, e non
 * quanto la schermata da cui lo si è acceso.
 *
 * Sta in un gancio a sé, e non dentro il componente del tasto, per una ragione
 * precisa: le schermate dell'app si scambiano montandosi e smontandosi, e una
 * ricerca che vivesse dentro il componente morirebbe ogni volta che si va a
 * guardare una carta nel catalogo. Otto secondi di lavoro buttati, senza
 * nemmeno un avviso. Qui il gancio lo tiene l'App, che non si smonta mai, e la
 * ricerca continua mentre si gira per l'app — che è **il motivo per cui esiste
 * il worker**.
 *
 * Il risultato si butta via da solo quando cambia il tema (`dimentica`): un
 * mazzo costruito per un tema che l'utente ha nel frattempo riscritto è un
 * mazzo che risponde a una domanda che non gli è più stata fatta, e lasciare
 * lì il tasto «mettilo in mano» sarebbe una piccola bugia.
 */

import { useEffect, useRef, useState } from "preact/hooks";

import type { Carta } from "../dati/pool.js";
import type { Avanzamento, Frontiera, Richiesta } from "./costruisci.js";
import type { AllaRicerca, DallaRicerca } from "./protocollo.js";

export type Motore = {
  allOpera: boolean;
  avanzamento: Avanzamento | null;
  frontiera: Frontiera | null;
  guasto: string | null;
  /** Accende il worker se serve, gli manda le carte se non le ha, e parte. */
  costruisci: (carte: readonly Carta[], impronta: string, richiesta: Richiesta) => void;
  /** Ferma la ricerca in corso e spegne il worker. Il risultato di prima resta. */
  ferma: () => void;
  /** Butta via il risultato — e la ricerca in corso, se ce n'è una. */
  dimentica: () => void;
};

export function usaMotore(): Motore {
  const worker = useRef<Worker | null>(null);
  /** L'impronta del pool che il worker ha già in casa: `null` se non ne ha. */
  const poolMandato = useRef<string | null>(null);

  const [allOpera, setAllOpera] = useState(false);
  const [avanzamento, setAvanzamento] = useState<Avanzamento | null>(null);
  const [frontiera, setFrontiera] = useState<Frontiera | null>(null);
  const [guasto, setGuasto] = useState<string | null>(null);

  const spegni = () => {
    worker.current?.terminate();
    worker.current = null;
    // Il worker nuovo nascerà senza carte: dimenticarsene qui vorrebbe dire
    // mandargli una richiesta su un pool vuoto, e il pool vuoto non costruisce.
    poolMandato.current = null;
  };

  // L'app che si chiude si porta via il worker: un thread lasciato a girare è
  // un telefono che si scalda per niente.
  useEffect(() => spegni, []);

  const ferma = () => {
    spegni();
    setAllOpera(false);
    setAvanzamento(null);
  };

  return {
    allOpera,
    avanzamento,
    frontiera,
    guasto,

    costruisci(carte, impronta, richiesta) {
      if (worker.current === null) {
        worker.current = new Worker(new URL("./motore.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.current.addEventListener("message", (evento: MessageEvent<DallaRicerca>) => {
          const messaggio = evento.data;
          if (messaggio.tipo === "avanzamento") {
            setAvanzamento(messaggio.avanzamento);
            return;
          }
          if (messaggio.tipo === "frontiera") setFrontiera(messaggio.frontiera);
          else setGuasto(messaggio.messaggio);
          setAllOpera(false);
        });
        // Un worker che non parte proprio — il file non si carica, la memoria
        // finisce — va spento come uno fermato a mano: se restasse installato,
        // il tasto premuto la volta dopo parlerebbe con un morto e la
        // schermata resterebbe su «sto costruendo» per sempre.
        worker.current.addEventListener("error", () => {
          spegni();
          setGuasto("il motore non è partito.");
          setAllOpera(false);
        });
      }

      const manda = (messaggio: AllaRicerca) => worker.current?.postMessage(messaggio);

      // Le carte si mandano solo se il worker non le ha già: sono quattro
      // megabyte. Quando in sottofondo ne arrivano di più fresche (ticket 05)
      // l'impronta cambia, e allora si rimandano — il mazzo dev'essere fatto
      // con le carte che l'utente sta guardando.
      if (poolMandato.current !== impronta) {
        manda({ tipo: "pool", carte: [...carte] });
        poolMandato.current = impronta;
      }

      setGuasto(null);
      setFrontiera(null);
      setAvanzamento(null);
      setAllOpera(true);
      manda({ tipo: "costruisci", richiesta });
    },

    ferma,

    dimentica() {
      if (allOpera) ferma();
      setFrontiera(null);
      setGuasto(null);
    },
  };
}
