/**
 * Le poche frasi che l'interfaccia e il worker si scambiano.
 *
 * Stanno a sé perché le leggono in due, da due mondi diversi: il modulo del
 * worker non può importare niente dell'interfaccia e viceversa. Sono tipi e
 * basta — nessun codice, nessun peso a runtime.
 *
 * Il pool si manda **una volta sola** e resta lì: sono quattro megabyte di
 * carte, e ricopiarli a ogni tasto premuto sarebbe il costo più stupido
 * dell'app. Quando i dati si aggiornano in sottofondo (ticket 05), si rimanda.
 */

import type { Carta } from "../dati/pool.js";
import type { Avanzamento, Frontiera, Richiesta } from "./costruisci.js";

export type AllaRicerca =
  /** Le carte con cui costruire: una volta sola, e di nuovo se cambiano. */
  | { tipo: "pool"; carte: Carta[] }
  | { tipo: "costruisci"; richiesta: Richiesta };

export type DallaRicerca =
  | { tipo: "avanzamento"; avanzamento: Avanzamento }
  | { tipo: "frontiera"; frontiera: Frontiera }
  /**
   * Il guasto arriva come un messaggio come gli altri: un worker che muore in
   * silenzio lascerebbe l'interfaccia a girare per sempre su «sto lavorando».
   */
  | { tipo: "guasto"; messaggio: string };
