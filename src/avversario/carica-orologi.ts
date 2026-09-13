/**
 * Da dove arrivano gli orologi: il file del manutentore, e quel che l'utente ha
 * scritto sul proprio dispositivo.
 *
 * L'ordine è quello, ed è una decisione. Gli orologi dell'utente **vincono
 * sempre**: il meta del suo negozio non è il meta di internet, e il file di
 * partenza serve a una cosa sola — che la prima schermata non sia vuota. Appena
 * ne scrive uno suo, quello del manutentore non si guarda più.
 *
 * Un elenco **vuoto** salvato dall'utente è una risposta e non un'assenza: vuol
 * dire «non voglio correre contro nessuno», e in quel caso la sesta componente
 * del punteggio sparisce. Per questo si distingue fra «non c'è niente di
 * salvato» e «è salvato un elenco vuoto», che senza `null` non si potrebbero
 * dire diversi.
 */

import {
  orologiCheSiLeggono,
  righeCheNonSiConservano,
  type Orologio,
} from "./orologio.js";

/**
 * Dov'è il file di partenza, relativo alla base dell'app: l'app gira anche in
 * sottocartella. È una funzione e non una costante per la stessa ragione del
 * documento di formato — `import.meta.env` esiste solo dentro Vite.
 */
function percorsoDegliOrologi(): string {
  return `${import.meta.env.BASE_URL}dati/orologi.json`;
}

/**
 * Che cosa c'era nel file di partenza, e che cosa non si è potuto leggere.
 *
 * `non-si-e-letto` è il file che manca, che la rete non consegna, o che elenco
 * non è: di quel che avrebbe dovuto contenere non si sa niente. `letti` è tutto
 * il resto, comprese le voci cadute — che non sono un'assenza del file, ma
 * righe sue che qualcuno deve poter andare a correggere.
 */
export type OrologiDiPartenza =
  | {
      readonly come: "letti";
      readonly orologi: Orologio[];
      /** Le righe che non sono entrate, per posizione e col perché. */
      readonly scarti: Map<number, string>;
    }
  | { readonly come: "non-si-e-letto" };

/**
 * Che cosa si legge nel file di partenza — **riga per riga**, e non tutto o
 * niente.
 *
 * Qui c'era il lettore severo, e la ragione era buona: per un testo arrivato da
 * fuori è il momento di dire quale riga guardare, perché il file non è ancora
 * di nessuno. Ma il severo solleva, e questa funzione un'eccezione non la può
 * far uscire — un file di cortesia che manca non è un guasto dell'app —, quindi
 * quel che sollevava finiva in un `catch` che tornava un elenco vuoto e non
 * diceva niente. Bastava una riga storta perché il file che esiste **per non
 * far trovare la prima schermata vuota** (ADR-0002) producesse esattamente una
 * prima schermata vuota, in silenzio (ticket 57).
 *
 * Adesso si perde la riga e restano le altre, come per il deposito
 * (`orologiCheSiLeggono`, ticket 35) — e il principio del severo resta in piedi
 * dove contava davvero: le ragioni riga per riga non si buttano, escono di qui
 * con l'elenco (`righeCheNonSiConservano`) e qualcuno le dice.
 *
 * Sta fuori dal `fetch` perché è la decisione, e una decisione si prova senza
 * rete.
 */
export function letturaDelFileDiPartenza(dati: unknown): OrologiDiPartenza {
  const orologi = orologiCheSiLeggono(dati);
  // Quel che elenco non è non è un file vuoto: è un file di cui non si è capito
  // niente, e prometterne il contenuto sarebbe inventarlo.
  if (orologi === undefined || !Array.isArray(dati)) return { come: "non-si-e-letto" };
  return { come: "letti", orologi, scarti: righeCheNonSiConservano(dati) };
}

/**
 * Il file di partenza del manutentore.
 *
 * Se non c'è, o non arriva, non cade: un file di cortesia che manca non è un
 * guasto dell'app, e senza orologi l'app funziona intera — semplicemente non
 * corre contro nessuno. Lo **dice** però, invece di consegnare un elenco vuoto
 * che si legge come una decisione dell'utente (ticket 57).
 */
export async function caricaOrologiDiPartenza(): Promise<OrologiDiPartenza> {
  try {
    const risposta = await fetch(percorsoDegliOrologi());
    if (!risposta.ok) return { come: "non-si-e-letto" };
    return letturaDelFileDiPartenza(await risposta.json());
  } catch {
    return { come: "non-si-e-letto" };
  }
}
