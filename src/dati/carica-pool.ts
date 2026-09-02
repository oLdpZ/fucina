/**
 * La lettura del pool da parte dell'app.
 *
 * L'app **legge** il pool e non lo produce mai (`spec.md`, «I due programmi»):
 * qui c'è tutto ciò che serve per farlo, e niente che sappia come il pool è
 * stato costruito.
 *
 * Il file è dentro il pacchetto e il service worker lo tiene in cache, quindi
 * questa lettura riesce anche senza rete (storia 15). Se però il file manca o è
 * rotto, l'app deve dirlo con parole: una lista vuota senza spiegazioni
 * sembrerebbe un pool senza carte, e manderebbe a cercare il guasto dalla parte
 * sbagliata.
 */

import type { Carta, Pool } from "./pool.js";

/** Dov'è il pool, relativo alla base dell'app: l'app gira anche in sottocartella. */
const PERCORSO_POOL = `${import.meta.env.BASE_URL}dati/pool.json`;

/**
 * Controlla che quel che si è letto sia davvero un pool, e lo consegna tipato.
 *
 * Non verifica carta per carta: sarebbe un secondo posto in cui è scritta la
 * forma dei dati, e si scorderebbe di crescere. Verifica le due cose che
 * distinguono un pool da un file qualunque — che abbia una data e che abbia
 * carte.
 */
export function interpretaPool(dati: unknown): Pool {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Il file del pool delle carte non si legge.");
  }

  const { generatoIl, carte } = dati as { generatoIl?: unknown; carte?: unknown };

  if (typeof generatoIl !== "string" || generatoIl === "") {
    throw new Error("Il pool delle carte non dice di che data sono i suoi dati.");
  }
  if (!Array.isArray(carte)) {
    throw new Error("Il pool non contiene un elenco di carte.");
  }
  if (carte.length === 0) {
    throw new Error("Il pool delle carte è vuoto.");
  }

  return { generatoIl, carte: carte as Carta[] };
}

/** Legge il pool incluso nell'app. */
export async function caricaPool(): Promise<Pool> {
  const risposta = await fetch(PERCORSO_POOL);
  if (!risposta.ok) {
    throw new Error(`Il pool delle carte non è raggiungibile (${risposta.status}).`);
  }
  let letto: unknown;
  try {
    letto = await risposta.json();
  } catch {
    // Capita per davvero: un server che risponde con la pagina dell'app al
    // posto di un file mancante. Il messaggio del browser parlerebbe di
    // parentesi angolari, e non aiuterebbe nessuno.
    throw new Error("Il file del pool delle carte non si legge.");
  }
  return interpretaPool(letto);
}

/**
 * La data dei dati, come si direbbe a voce (storia 17).
 *
 * Si legge sempre nel fuso di Greenwich, quello in cui la data è scritta: letta
 * nel fuso di chi guarda, un pool generato di prima mattina diventerebbe del
 * giorno prima per metà del mondo.
 */
export function dataInItaliano(iso: string): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return "data sconosciuta";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(quando);
}
