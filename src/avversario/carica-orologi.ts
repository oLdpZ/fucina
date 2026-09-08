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

import { interpretaOrologi, type Orologio } from "./orologio.js";

/**
 * Dov'è il file di partenza, relativo alla base dell'app: l'app gira anche in
 * sottocartella. È una funzione e non una costante per la stessa ragione del
 * documento di formato — `import.meta.env` esiste solo dentro Vite.
 */
function percorsoDegliOrologi(): string {
  return `${import.meta.env.BASE_URL}dati/orologi.json`;
}

/**
 * Il file di partenza del manutentore.
 *
 * Se non c'è, o non si legge, torna un elenco **vuoto** invece di cadere: un
 * file di cortesia che manca non è un guasto dell'app, e senza orologi l'app
 * funziona intera — semplicemente non corre contro nessuno.
 */
export async function caricaOrologiDiPartenza(): Promise<Orologio[]> {
  try {
    const risposta = await fetch(percorsoDegliOrologi());
    if (!risposta.ok) return [];
    return interpretaOrologi(await risposta.json());
  } catch {
    return [];
  }
}
