/**
 * Il pool **in vigore**: il pool congelato nell'app, con sopra il documento di
 * formato e il listino dei prezzi di adesso.
 *
 * ## Perché le limitate e le bandite si applicano qui
 *
 * Fino al ticket 11 le cuoceva la preparazione: le bandite non entravano nel
 * file, e le limitate ci entravano con un tetto di una copia. Andava bene finché
 * l'aggiornamento in sottofondo portava pool nuovi. Adesso il pool si congela —
 * le carte del 1994 non cambiano — e quel che si aggiorna da solo è il
 * documento: se le liste restassero cotte nel pool, un documento più fresco
 * cambierebbe il nome del formato e lascerebbe in catalogo la carta appena
 * bandita. Il perché per esteso sta in
 * [ADR-0008](../../docs/adr/0008-limitate-e-bandite-le-applica-l-app.md).
 *
 * Per questo il pool porta **tutte** le carte che il criterio ammette, bandite
 * comprese, ciascuna col tetto che il gioco le dà. Il formato le toglie e le
 * limita qui, e nessuna riga di codice sa quali siano: le legge dal documento
 * (ADR-0004).
 *
 * ## Quel che non si può applicare
 *
 * Il criterio e le edizioni no: decidono **quali carte esistono** e quale copia
 * le descrive, e per cambiarli serve un archivio di Scryfall, cioè un pool
 * nuovo. Un documento o un listino che non vengono dallo stesso criterio del
 * pool si rifiutano, e il rifiuto dice perché.
 */

import { verificaCarteEsistenti } from "./carica-formato.js";
import type { Formato } from "./formato.js";
import { improntaDelDocumento } from "./impronta-del-documento.js";
import type { Listino } from "./listino.js";
import type { Pool } from "./pool.js";
import { COPIE_DI_UNA_LIMITATA, eTerraBase } from "../mazzo/copie.js";

/**
 * Il documento di formato sopra il pool: le bandite escono, le limitate stanno
 * a una copia.
 *
 * Il formato ha l'ultima parola anche sul permesso scritto nel testo: fra «il
 * gioco dice quante ne vuoi» e «il gruppo dice una», al tavolo del venerdì vince
 * il gruppo.
 *
 * Solleva, con una frase per l'utente, quando il documento non si può applicare:
 * perché viene da un altro criterio o da altre edizioni, o perché nomina una
 * carta che nel pool non esiste. Il secondo è l'errore di battitura, e qui si
 * vede per la stessa ragione per cui lo vedeva la preparazione: il pool ha
 * davanti i nomi di **tutte** le carte, bandite comprese.
 */
export function applicaIlFormato(pool: Pool, formato: Formato): Pool {
  if (improntaDelDocumento(formato) !== pool.improntaDelDocumento) {
    throw new Error(
      "Il documento di formato ammette edizioni, lingue o un criterio diversi da quelli " +
        "delle carte di questa app: per usarlo serve un'app aggiornata.",
    );
  }
  verificaCarteEsistenti(
    formato,
    pool.carte.map((carta) => carta.nome),
  );

  const bandite = new Set(formato.bandite.carte.map((voce) => voce.carta));
  const limitate = new Set(formato.limitate.carte.map((voce) => voce.carta));

  return {
    ...pool,
    carte: pool.carte
      .filter((carta) => !bandite.has(carta.nome))
      .map((carta) =>
        limitate.has(carta.nome) ? { ...carta, tettoDiCopie: COPIE_DI_UNA_LIMITATA } : carta,
      ),
  };
}

/**
 * Il listino sopra il pool: ogni carta prende il prezzo del listino, con la sua
 * data e la copia da cui viene.
 *
 * Solleva quando il listino viene da un altro criterio, e quando è
 * **incompleto**: un listino a cui mancano delle carte non le lascia col prezzo
 * di ieri — due date nello stesso conto della spesa — e non le lascia senza
 * prezzo, che il tetto di spesa leggerebbe come «non si compra». Si tiene il
 * listino che c'era, e lo si dice.
 *
 * Una voce per una carta che il pool non ha si ignora: non prezza niente di
 * quel che l'app mostra, e il criterio — l'unica ragione per cui potrebbero
 * esserci carte in più — lo ha già guardato l'impronta.
 */
export function applicaIlListino(pool: Pool, listino: Listino): Pool {
  if (listino.improntaDelDocumento !== pool.improntaDelDocumento) {
    throw new Error(
      "Il listino dei prezzi è fatto per edizioni, lingue o un criterio diversi da quelli " +
        "delle carte di questa app.",
    );
  }

  const mancano = pool.carte.filter((carta) => !listino.prezzi.has(carta.nome)).length;
  if (mancano > 0) {
    throw new Error(
      mancano === 1
        ? "Il listino dei prezzi è incompleto: manca il prezzo di una carta."
        : `Il listino dei prezzi è incompleto: mancano i prezzi di ${mancano} carte.`,
    );
  }

  return {
    ...pool,
    carte: pool.carte.map((carta) => ({
      ...carta,
      prezzo: listino.prezzi.get(carta.nome) ?? carta.prezzo,
    })),
  };
}

/**
 * Il prezzo che il gruppo **dichiara** per le terre base, sopra il pool
 * (ticket 83).
 *
 * Nasce da un guasto che nessun test vedeva. Nelle edizioni ammesse dal
 * 2026-09-17 quattro terre base su cinque non hanno prezzo in euro, e col tetto
 * di spesa acceso l'app non mette in mazzo quel che non sa contare: sotto un
 * tetto, un mazzo che non fosse verde non poteva avere terre base — cioè non
 * poteva esistere.
 *
 * Il prezzo dichiarato vince sul listino, e non è una svista. Nel pool vero una
 * sola terra base un prezzo ce l'ha: lasciarglielo darebbe una base di terre in
 * cui un colore costa e gli altri quattro no, che come conto non vuol dire
 * niente. O le terre base valgono quel che il gruppo ha dichiarato, tutte, o la
 * dichiarazione non serve.
 *
 * Non porta con sé nessuna **stampa**, e non perché non si sappia quale: perché
 * non c'è nessuna copia da andare a cercare al banchetto. È il terzo stato di
 * `Prezzo`, dichiarato lì accanto agli altri due (`pool.ts`).
 *
 * Non è esportata: si applica **dopo** che il documento è stato accettato, e da
 * sola non ha modo di sapere se lo sia. Chi la volesse per conto proprio
 * chiamerebbe `poolInVigore`, che i controlli li fa.
 */
function applicaIlPrezzoDichiarato(pool: Pool, formato: Formato): Pool {
  const dichiarato = formato.prezzoDelleTerreBase;
  if (dichiarato === null) return pool;

  return {
    ...pool,
    carte: pool.carte.map((carta) =>
      eTerraBase(carta.tipi)
        ? {
            ...carta,
            prezzo: {
              euro: dichiarato.euro,
              // La data è quella del documento che l'ha dichiarato: è di lì che
              // il numero viene, e datarlo col listino direbbe che l'ha detto
              // il mercato.
              aggiornatoIl: formato.aggiornatoIl,
              stampa: null,
            },
          }
        : carta,
    ),
  };
}

/**
 * Il pool che l'app mostra e con cui costruisce: il listino, se ce n'è uno più
 * fresco del pool, poi il formato, e infine i prezzi che il formato dichiara.
 *
 * Il listino va **prima**: si confronta col pool intero, bandite comprese,
 * perché è così che la preparazione lo scrive — e un listino giusto non deve
 * sembrare incompleto per via di un bando.
 *
 * Il prezzo dichiarato va **ultimo**, e per due ragioni. Dopo il listino, o il
 * listino glielo riscriverebbe sopra: è una dichiarazione del gruppo, e il
 * mercato non la smentisce. Dopo il formato, perché è il formato a dire se
 * quel documento si possa applicare affatto — scrivere prezzi da un documento
 * non ancora accettato vorrebbe dire lavorare su una risposta che sta per
 * essere rifiutata.
 */
export function poolInVigore(pool: Pool, formato: Formato, listino: Listino | null): Pool {
  const conPrezzi = listino === null ? pool : applicaIlListino(pool, listino);
  return applicaIlPrezzoDichiarato(applicaIlFormato(conPrezzi, formato), formato);
}
