/**
 * L'aggiornamento dei dati in sottofondo (storie 18 e 19, decisione Q29).
 *
 * La forma è **ibrida**, ed è quella che regge anche se il progetto viene
 * abbandonato (Q27): i dati stanno dentro l'app e bastano da soli; se c'è rete,
 * l'app guarda in sottofondo se ne esistono di più freschi e se li tiene sul
 * dispositivo. Nessun passaggio di questa storia può impedire all'app di
 * aprirsi: la rete che manca, la risposta rotta, lo spazio finito sono casi
 * normali, non guasti.
 *
 * Qui c'è la **decisione** — quale pool si apre, e cosa si fa di quel che
 * arriva dalla rete. Il tubo (il file su disco, il deposito del dispositivo)
 * sta altrove ed entra da fuori, così i casi che contano si provano senza rete.
 */

import { caricaPool, interpretaPool, scaricaPool } from "./carica-pool.js";
import { conservaPool, dimenticaPool, leggiPoolConservato } from "./deposito.js";
import type { Pool } from "./pool.js";

/** Com'è andato il controllo di freschezza. Nessuno dei tre casi è un guasto. */
export type Esito =
  | { tipo: "preso"; pool: Pool }
  | { tipo: "nulla-di-nuovo" }
  | { tipo: "non-riuscito"; motivo: string };

/**
 * Se il candidato porta dati più recenti di quelli in uso.
 *
 * Le date si confrontano come istanti e non come stringhe: due pool possono
 * scrivere lo stesso momento con fusi diversi, e l'ordine alfabetico li
 * metterebbe al contrario. A parità vince chi è già in uso — sostituire dati
 * identici sarebbe lavoro per niente.
 */
export function piuFresco(candidato: Pool, inUso: Pool): boolean {
  const quandoCandidato = Date.parse(candidato.generatoIl);
  if (Number.isNaN(quandoCandidato)) return false;

  const quandoInUso = Date.parse(inUso.generatoIl);
  // Dati in uso senza data leggibile: qualunque data vera è un passo avanti.
  if (Number.isNaN(quandoInUso)) return true;

  return quandoCandidato > quandoInUso;
}

/**
 * Fra i dati inclusi nell'app e quelli conservati sul dispositivo, quali aprire.
 *
 * `dimentica` è vero quando la copia conservata non serve più: succede quando
 * l'app stessa è stata aggiornata con dati altrettanto freschi o più. Tenerla
 * sarebbe occupare quattro megabyte per niente.
 */
export function scegliPool(
  incluso: Pool | null,
  conservato: Pool | null,
): { pool: Pool | null; dimentica: boolean } {
  if (conservato === null) return { pool: incluso, dimentica: false };
  // I dati inclusi possono mancare: file arrivato a metà, cache svuotata a
  // mano. La copia sul dispositivo è comunque un pool buono, e va aperta —
  // perdere dati che l'app aveva è proprio il caso che il ticket vieta.
  if (incluso === null) return { pool: conservato, dimentica: false };
  if (piuFresco(conservato, incluso)) return { pool: conservato, dimentica: false };
  return { pool: incluso, dimentica: true };
}

/**
 * Chiede alla rete se esistono dati più freschi, e li interpreta.
 *
 * Qualunque cosa vada storta — rete assente, server che risponde con la pagina
 * dell'app al posto del file, pool arrivato vuoto — finisce in `non-riuscito`:
 * i dati in uso non si toccano mai, e l'app va avanti come se niente fosse.
 */
export async function cercaAggiornamento(
  inUso: Pool,
  scarica: () => Promise<unknown>,
): Promise<Esito> {
  let candidato: Pool;
  try {
    candidato = interpretaPool(await scarica());
  } catch (errore: unknown) {
    return { tipo: "non-riuscito", motivo: errore instanceof Error ? errore.message : String(errore) };
  }

  if (!piuFresco(candidato, inUso)) return { tipo: "nulla-di-nuovo" };
  return { tipo: "preso", pool: candidato };
}

/**
 * Il pool da cui l'app parte all'apertura: quello incluso, o quello più fresco
 * scaricato in una sessione passata.
 *
 * Non aspetta mai la rete. Se il deposito del dispositivo non risponde — modo
 * privato, spazio finito, permessi negati — si aprono i dati inclusi. Se sono i
 * dati inclusi a non leggersi, si apre la copia sul dispositivo. Solo quando
 * mancano tutt'e due si parla di guasto, e si dice quello del file incluso, che
 * è il guasto che il manutentore può riparare.
 */
export async function poolDaAprire(): Promise<Pool> {
  const [incluso, conservato] = await Promise.all([
    caricaPool().catch((errore: unknown) => errore as Error),
    leggiPoolConservato(),
  ]);

  const scelta = scegliPool(incluso instanceof Error ? null : incluso, conservato);
  if (scelta.dimentica) void dimenticaPool();
  if (scelta.pool === null) {
    throw incluso instanceof Error ? incluso : new Error("Il pool delle carte non c'è.");
  }
  return scelta.pool;
}

/**
 * Il controllo di freschezza vero e proprio, da lanciare dopo aver già mostrato
 * qualcosa: non blocca niente e non ha fretta.
 *
 * Se il dispositivo si dichiara scollegato non si tenta nemmeno: una richiesta
 * che non riceverà mai risposta costa batteria e non porta niente.
 */
export async function aggiornaInSottofondo(inUso: Pool): Promise<Esito> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { tipo: "non-riuscito", motivo: "Il dispositivo è senza rete." };
  }

  const esito = await cercaAggiornamento(inUso, scaricaPool);
  // Lo spazio esaurito non annulla l'aggiornamento: i dati freschi valgono per
  // questa sessione anche se non si riesce a tenerli per la prossima.
  if (esito.tipo === "preso") await conservaPool(esito.pool);
  return esito;
}
