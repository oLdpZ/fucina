/**
 * Il tasto che costruisce il mazzo, e quel che si vede mentre lo costruisce
 * (ticket 11).
 *
 * La ricerca dura secondi e gira in un **web worker**: l'interfaccia resta
 * viva, si può passare al catalogo a controllare una carta e tornare qui a
 * trovare la ricerca dov'era. Il worker non vive qui dentro ma nell'App
 * (`ricerca/usa-motore.ts`), ed è per quello: una schermata che si smonta non
 * deve poter buttare via otto secondi di lavoro. Questo componente è solo la
 * faccia del motore — non decide niente e non tiene niente.
 *
 * Il tetto di tempo sta nella richiesta, come il seme, e quando scatta il mazzo
 * torna lo stesso, dichiarato troncato.
 *
 * Il **seme** è in vista e si cambia a mano. Non è un vezzo da programmatori:
 * è la cosa che rende ripetibile quel che l'app fa. Stesso tema e stesso seme,
 * stesso mazzo, sempre; cambiando seme si chiede alla ricerca di ripartire da
 * un'altra parte.
 *
 * ## La frontiera (ticket 12)
 *
 * Quel che torna non è un mazzo ma **quattro o cinque**, allineati dal più
 * fedele al tema al più forte, e sono affiancati apposta: il fulcro del
 * progetto non è la lista, è il **tasso di cambio** fra originalità e potenza.
 * Ogni mazzo porta scritto quanto tema ha ceduto e quanta potenza ha guadagnato
 * rispetto a quello prima di lui — numeri che la ricerca ha già calcolato
 * (`MazzoCostruito.passo`), non differenze rifatte qui.
 *
 * Dove fermarsi lo sceglie l'utente, ed è il senso di tutto: il primo mazzo è
 * selezionato perché è quello che ha chiesto, non perché sia il consigliato.
 *
 * ## Le spiegazioni (ticket 13)
 *
 * Ogni carta del mazzo si apre e dice perché è lì e perché in tante copie; sotto
 * le terre c'è come sono state scelte; e chiude l'elenco delle carte del tema
 * rimaste fuori, col motivo. Le frasi non si scrivono qui: arrivano già fatte da
 * `spiegazioni/spiegazioni.ts`, che le riempie di numeri già calcolati.
 *
 * Le carte si aprono una per volta e non stanno aperte tutte: chi vuole la
 * lista la legge come una lista, e chi vuole capire tocca la carta. È l'unico
 * modo di dare una spiegazione lunga a ogni carta senza che la lista smetta di
 * essere leggibile.
 *
 * ## Il tetto di spesa (ticket 09)
 *
 * **Parte spento**, e sta qui sotto spento finché non lo si accende. Non è
 * pigrizia: il fulcro dell'app è il tasso di cambio fra tema e potenza, e la
 * frontiera esiste per mostrarne uno solo. Un budget acceso di default ne
 * metterebbe un secondo accanto — quanto costa in euro quel che costa in tema —
 * e i due prezzi si confonderebbero. La prima risposta che il giocatore riceve
 * dev'essere sul tema, non sul portafoglio.
 *
 * Acceso, vincola la costruzione come il tema: nessun mazzo della frontiera
 * costa più del tetto. E l'app dice **a chiare lettere** che cosa sta lasciando
 * fuori — quante carte, e quante di quelle non saranno mai ristampate.
 */

import { useEffect, useMemo, useState } from "preact/hooks";

import type { Combo as CarteDellaCombo } from "../combo/combo.js";
import type { Pool } from "../dati/pool.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import { AVVISO_STIMA_AL_RIBASSO, listaDellaSpesa } from "../mazzo/spesa.js";
import type { Richiesta, SpesaDellaRicerca } from "../ricerca/costruisci.js";
import { TEMPO_MASSIMO_PREDEFINITO_MS } from "../ricerca/taratura.js";
import type { Motore } from "../ricerca/usa-motore.js";
import { frasePerIlMazzoSolo } from "../spiegazioni/frasi.js";
import { spiegaFrontiera } from "../spiegazioni/spiegazioni.js";
import { temaDichiarato, type Tema } from "../tema/tema.js";

const NUMERI = new Intl.NumberFormat("it-IT");
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/**
 * Il tetto che si propone quando lo si accende, in euro.
 *
 * Non è una verità sul formato e non decide niente: è il numero da cui si parte
 * a spostare la manopola, e si cambia con due tocchi. Serve solo perché
 * accendere un tetto vuoto vorrebbe dire chiedere subito «zero euro», che non è
 * una domanda.
 */
const TETTO_DA_CUI_PARTIRE = 200;
const PERCENTO = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });
/**
 * La differenza fra un mazzo e il precedente: le stesse due percentuali di
 * sopra, sottratte, **col segno sempre in vista**. «−8% di tema, +2% di
 * potenza» dice il baratto in due numeri, e il segno è metà di quel che dice.
 */
const PUNTI = new Intl.NumberFormat("it-IT", {
  // Un decimale, e non zero: i guadagni di potenza veri stanno intorno all'uno
  // per cento, e arrotondarli all'intero scriverebbe «+0% di potenza» proprio
  // sul numero per cui questa schermata esiste.
  maximumFractionDigits: 1,
  style: "percent",
  signDisplay: "always",
});

/** Il seme sta in trentadue bit, come lo vuole `caso.ts`. */
const SEME_MASSIMO = 0xffffffff;

export function Costruzione({
  pool,
  tema,
  combo,
  seme,
  cambiaSeme,
  tettoDiSpesa,
  cambiaTetto,
  motore,
  mettiInMano,
}: {
  pool: Pool;
  tema: Tema;
  /** Le carte della combo dichiarata, per nome: vanno nella richiesta. */
  combo: CarteDellaCombo;
  seme: number;
  cambiaSeme: (seme: number) => void;
  /** Il tetto di spesa in euro, `null` quando è spento — ed è così che parte. */
  tettoDiSpesa: number | null;
  cambiaTetto: (tetto: number | null) => void;
  motore: Motore;
  /** Il mazzo costruito torna in mano all'utente, nella schermata «Mazzo». */
  mettiInMano: (
    carte: readonly CopieDiCarta[],
    terre: number,
    /** Il tetto con cui è stato costruito: viaggia col mazzo. */
    tetto: number | null,
  ) => void;
}) {
  const dichiarato = temaDichiarato(tema);
  const mazzi = motore.frontiera?.mazzi ?? [];
  // Quale mazzo della frontiera si sta guardando. Zero è il più fedele al tema:
  // si parte da lì perché è quello che l'utente ha chiesto, e scendere lungo la
  // frontiera è una scelta che fa lui, non un consiglio che gli si dà.
  const [scelto, scegli] = useState(0);
  // Una frontiera nuova riporta la scelta sul primo: lasciare il dito dov'era
  // mostrerebbe, dopo una ricerca diversa, il mazzo di una posizione che in
  // quella nuova frontiera vuol dire un'altra cosa.
  useEffect(() => scegli(0), [motore.frontiera]);
  const mazzo = mazzi[Math.min(scelto, mazzi.length - 1)] ?? null;

  // Le spiegazioni si rifanno solo quando cambia la frontiera, il tema o il
  // pool: sono un passaggio sul pool per mazzo, e rifarle a ogni battito di
  // cursore sul seme non servirebbe a niente.
  const spiegazioni = useMemo(
    () =>
      motore.frontiera === null ? [] : spiegaFrontiera(motore.frontiera, tema, pool.carte),
    [motore.frontiera, tema, pool.carte],
  );
  const spiegato = spiegazioni[Math.min(scelto, spiegazioni.length - 1)] ?? null;

  // Quante carte del mazzo scelto un listino non ce l'hanno: sono quelle che il
  // conto non racconta, e il conto va detto «almeno» quando ce ne sono.
  const senzaListino =
    mazzo === null
      ? 0
      : listaDellaSpesa([...mazzo.carte, ...mazzo.terre]).senzaPrezzo.length;

  const costruisci = () => {
    const richiesta: Richiesta = {
      tema,
      combo,
      seme,
      tempoMassimoMs: TEMPO_MASSIMO_PREDEFINITO_MS,
      tettoDiSpesa,
    };
    // L'impronta del pool è la data dei suoi dati: cambia quando e solo quando
    // cambiano le carte (ticket 05).
    motore.costruisci(pool.carte, pool.generatoIl, richiesta);
  };

  return (
    <section class="costruzione">
      <h2>Il mazzo</h2>

      <div class="comandi-costruzione">
        <button
          type="button"
          class="genera"
          disabled={!dichiarato || motore.allOpera}
          onClick={costruisci}
        >
          {motore.allOpera ? "Sto costruendo…" : "Costruisci il mazzo"}
        </button>
        {motore.allOpera ? (
          <button type="button" class="ferma" onClick={motore.ferma}>
            Ferma
          </button>
        ) : null}
        <label class="campo seme">
          <span class="etichetta-campo">Seme</span>
          <input
            type="number"
            min={0}
            max={SEME_MASSIMO}
            step={1}
            value={seme}
            disabled={motore.allOpera}
            onInput={(evento) => {
              // Il seme che si vede dev'essere **quello che parte**: un numero
              // rifiutato in silenzio lascerebbe scritta una cosa e ne
              // manderebbe un'altra, che è esattamente quel che il seme esiste
              // per impedire. Perciò si porta dentro i limiti invece di
              // ignorarlo, e il campo si riscrive con quello vero.
              const scritto = evento.currentTarget.value.trim();
              if (scritto === "") return;
              const letto = Number(scritto);
              if (!Number.isFinite(letto)) return;
              cambiaSeme(Math.max(0, Math.min(SEME_MASSIMO, Math.floor(letto))));
            }}
          />
        </label>
      </div>

      <TettoDiSpesa tetto={tettoDiSpesa} cambia={cambiaTetto} bloccato={motore.allOpera} />

      {!dichiarato ? (
        <p class="nota-filtro">
          Prima dichiara un tema qui sopra: è quello il vincolo dentro cui l&rsquo;app costruisce.
        </p>
      ) : null}

      {motore.allOpera ? (
        <p class="avanzamento" aria-live="polite">
          {motore.avanzamento === null
            ? "Preparo le carte…"
            : `Mazzo ${motore.avanzamento.passo + 1} di ${motore.avanzamento.passi}, partenza ${
                motore.avanzamento.partenza + 1
              } di ${motore.avanzamento.partenze}, ${NUMERI.format(
                motore.avanzamento.valutazioni,
              )} ${motore.avanzamento.valutazioni === 1 ? "mazzo provato" : "mazzi provati"}.`}
        </p>
      ) : null}

      {motore.guasto !== null ? (
        <p class="nota-filtro avviso-seme">Il motore si è fermato: {motore.guasto}</p>
      ) : null}

      {motore.frontiera !== null ? (
        <div class="esito-costruzione" data-esito={motore.frontiera.esito}>
          <p class="motivo">{motore.frontiera.motivo}</p>
          {motore.frontiera.spesa === null ? null : (
            <CosaHaLasciatoFuori spesa={motore.frontiera.spesa} />
          )}
          {motore.frontiera.troncataPerTempo ? (
            <p class="nota-filtro">
              Il tempo concesso è finito prima che la ricerca si fermasse da sé: questo è il meglio
              che ha trovato, non il meglio che c&rsquo;è.
            </p>
          ) : null}

          {mazzi.length > 0 ? (
            <>
              {mazzi.length > 1 ? (
                <p class="nota-frontiera">
                  {mazzi.length} mazzi, dal più fedele al tema al più forte. Ogni passo dice quanto
                  tema costa e quanta potenza rende: dove fermarsi lo scegli tu.
                </p>
              ) : (
                // Le tre ragioni per cui la frontiera resta lunga uno — il
                // tempo, il tetto, e il baratto che davvero non c'è — le
                // distingue `frasePerIlMazzoSolo`, che sta coi modelli di frase
                // insieme a tutti gli altri (ticket 24).
                <p class="nota-frontiera">
                  {frasePerIlMazzoSolo({
                    troncataPerTempo: motore.frontiera.troncataPerTempo,
                    tetto:
                      motore.frontiera.spesa === null
                        ? null
                        : {
                            euro: motore.frontiera.spesa.tetto,
                            passiSenzaMazzo: motore.frontiera.spesa.passiSenzaMazzo,
                          },
                  })}
                </p>
              )}
              <ol class="frontiera">
                {mazzi.map((voce, indice) => (
                  <li key={voce.peso}>
                    <button
                      type="button"
                      aria-pressed={indice === scelto}
                      class="passo-frontiera"
                      data-scelto={indice === scelto ? "" : undefined}
                      onClick={() => scegli(indice)}
                    >
                      <span class="posizione">
                        {indice === 0
                          ? "il più fedele"
                          : indice === mazzi.length - 1
                            ? "il più forte"
                            : `${indice + 1}º`}
                      </span>
                      <span class="numeri">
                        <span class="etichetta-numero">tema</span>
                        <strong>{PERCENTO.format(voce.purezza)}</strong>
                        <span class="etichetta-numero">potenza</span>
                        <strong>{PERCENTO.format(voce.potenza)}</strong>
                      </span>
                      <span class="passo">
                        {voce.passo === null
                          ? "il mazzo più puro che il tema permetta"
                          : `${PUNTI.format(-voce.passo.purezzaCeduta)} di tema, ${PUNTI.format(
                              voce.passo.potenzaGuadagnata,
                            )} di potenza`}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {mazzo !== null ? (
            <>
              <ul class="componenti">
                <li>
                  <span>fedeltà al tema</span>
                  <strong>{PERCENTO.format(mazzo.purezza)}</strong>
                </li>
                {Object.values(mazzo.punteggio).map((componente) => (
                  <li key={componente.etichetta}>
                    <span>{componente.etichetta}</span>
                    <strong>{PERCENTO.format(componente.valore)}</strong>
                  </li>
                ))}
              </ul>

              <p class="spiegazione spiegazione-spesa">
                {/* «Almeno» quando qualche carta un listino non ce l&rsquo;ha: il conto le
                    salta, e chiamarlo «il prezzo» sarebbe la bugia che
                    `mazzo/spesa.ts` esiste per non far dire. Col tetto acceso non
                    succede — quelle carte restano fuori — ma col tetto spento sì. */}
                Comprarlo costa {senzaListino > 0 ? "almeno " : ""}
                {EURO.format(mazzo.spesa)}, terre comprese.{" "}
                {senzaListino > 0
                  ? `${senzaListino === 1 ? "Una carta non ha listino e nel conto non c’è" : `${NUMERI.format(senzaListino)} carte non hanno listino e nel conto non ci sono`}. `
                  : ""}
                {AVVISO_STIMA_AL_RIBASSO} La lista con le stampe da cercare sta nella schermata
                «Mazzo», appena lo metti in mano.
              </p>

              {spiegato !== null && spiegato.passo !== null ? (
                <p class="spiegazione spiegazione-passo">{spiegato.passo.frase}</p>
              ) : null}

              {/*
                La combo dichiarata, col patto dentro la frase: sta sopra la lista
                perché è la domanda con cui l'utente è venuto, e la lista è la
                risposta.
              */}
              {spiegato !== null && spiegato.combo !== null ? (
                <p class="spiegazione spiegazione-combo">{spiegato.combo.frase}</p>
              ) : null}

              <h3>Le carte</h3>
              <ol class="lista-spiegata">
                {mazzo.carte.map((voce, indice) => {
                  const detta = spiegato?.carte[indice] ?? null;
                  return (
                    <li key={voce.carta.nome}>
                      <details>
                        <summary>
                          <span class="copie">{voce.copie}</span> {voce.carta.nome}
                        </summary>
                        {detta === null ? null : (
                          <>
                            <p class="spiegazione">{detta.perche.frase}</p>
                            <p class="spiegazione">{detta.quante.frase}</p>
                          </>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ol>

              <h3>Le terre</h3>
              <ul class="lista-costruita">
                {mazzo.terre.map((voce) => (
                  <li key={voce.carta.nome}>
                    <span class="copie">{voce.copie}</span> {voce.carta.nome}
                  </li>
                ))}
              </ul>
              {spiegato === null ? null : (
                <p class="spiegazione">{spiegato.terre.frase}</p>
              )}

              {spiegato !== null && spiegato.esclusioni.length > 0 ? (
                <>
                  <h3>Rimaste fuori</h3>
                  <ul class="rimaste-fuori">
                    {spiegato.esclusioni.map((esclusione) => (
                      <li key={esclusione.grezzi.nome} class="spiegazione">
                        {esclusione.frase}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <button
                type="button"
                class="genera"
                onClick={() =>
                  mettiInMano(mazzo.carte, mazzo.base.numeroTerre, motore.frontiera?.spesa?.tetto ?? null)
                }
              >
                Mettilo in mano
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Il tetto di spesa: spento, e il perché scritto accanto.
 *
 * Lo spento non è uno stato da riempire in fretta: è la risposta giusta finché
 * il giocatore sta scegliendo un mazzo invece di comprarlo. Perciò l'interruttore
 * porta con sé la ragione — se no sembrerebbe una cosa che l'app si è dimenticata
 * di accendere.
 */
function TettoDiSpesa({
  tetto,
  cambia,
  bloccato,
}: {
  tetto: number | null;
  cambia: (tetto: number | null) => void;
  /** Mentre il motore lavora la richiesta è partita: cambiarla mentirebbe. */
  bloccato: boolean;
}) {
  const acceso = tetto !== null;
  return (
    <div class="tetto-di-spesa" data-acceso={acceso ? "" : undefined}>
      <label class="interruttore">
        <input
          type="checkbox"
          checked={acceso}
          disabled={bloccato}
          onChange={(evento) =>
            cambia(evento.currentTarget.checked ? TETTO_DA_CUI_PARTIRE : null)
          }
        />
        <span>Tetto di spesa</span>
      </label>

      {acceso ? (
        <>
          <label class="campo euro">
            <span class="etichetta-campo">Euro</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={10}
              value={tetto}
              disabled={bloccato}
              onInput={(evento) => {
                // Il campo vuoto si lascia vuoto **mentre si scrive** — chi
                // cancella per riscrivere non vuole vedersi rimettere uno zero
                // sotto le dita — ma non si costruisce con un tetto che nessuno
                // vede: ci pensa `onBlur` qui sotto a rimettere in pari campo e
                // stato appena il dito se ne va.
                const scritto = evento.currentTarget.value.trim();
                if (scritto === "") return;
                const letto = Number(scritto);
                if (!Number.isFinite(letto)) return;
                cambia(Math.max(0, letto));
              }}
              onBlur={(evento) => {
                // Quel che si vede e quel che parte devono essere lo stesso
                // numero: un campo lasciato vuoto tornerebbe altrimenti a
                // costruire col tetto di prima, che sullo schermo non c'è più.
                const campo = evento.currentTarget;
                if (campo.value.trim() === "") campo.value = String(tetto);
              }}
            />
          </label>
          <p class="nota-filtro">
            Da adesso l&rsquo;app costruisce solo mazzi che stanno dentro questa cifra.{" "}
            {AVVISO_STIMA_AL_RIBASSO}
          </p>
        </>
      ) : (
        <p class="nota-filtro">
          Spento apposta: la prima risposta che ricevi è sul tema, non sul portafoglio. Accendilo
          quando stai per comprare.
        </p>
      )}
    </div>
  );
}

/**
 * Che cosa il tetto sta lasciando fuori, detto a chiare lettere.
 *
 * «A chiare lettere» vuol dire con dentro il numero, e vuol dire dicendo la
 * cosa scomoda: su questo pool le carte care sono le migliori, e più di cento
 * sono in Reserved List — non saranno mai ristampate, e il loro prezzo non
 * scenderà. Alzare il tetto è l&rsquo;unica strada, e chi legge deve poterlo
 * sapere invece di scoprirlo fra un anno.
 */
function CosaHaLasciatoFuori({ spesa }: { spesa: SpesaDellaRicerca }) {
  if (spesa.troppoCare === 0 && spesa.senzaPrezzo === 0) {
    return (
      <p class="nota-filtro avviso-spesa">
        Con {EURO.format(spesa.tetto)} il tetto non ha lasciato fuori niente: ci sta tutto quello
        che il tema permette.
      </p>
    );
  }

  return (
    <p class="nota-filtro avviso-spesa">
      Con {EURO.format(spesa.tetto)} restano fuori{" "}
      {spesa.troppoCare > 0 ? (
        <>
          <strong>
            {spesa.troppoCare === 1 ? "una carta" : `${NUMERI.format(spesa.troppoCare)} carte`}
          </strong>{" "}
          che da sole costano più del tetto
          {spesa.troppoCareRiservate > 0 ? (
            <>
              , e {NUMERI.format(spesa.troppoCareRiservate)} di quelle sono in Reserved List: non
              saranno mai ristampate, e aspettare non le farà scendere di prezzo
            </>
          ) : null}
        </>
      ) : null}
      {spesa.troppoCare > 0 && spesa.senzaPrezzo > 0 ? "; restano fuori anche " : ""}
      {spesa.senzaPrezzo > 0 ? (
        <>
          <strong>
            {spesa.senzaPrezzo === 1 ? "una carta" : `${NUMERI.format(spesa.senzaPrezzo)} carte`}
          </strong>{" "}
          che un listino non ce l&rsquo;hanno in nessuna copia ammessa, e con un tetto
          acceso l&rsquo;app non mette nel mazzo quel che non sa contare
        </>
      ) : null}
      . Sotto {EURO.format(spesa.minimo)} non si scende comunque: tanto costano le sessanta
      carte meno care rimaste, messe insieme senza guardare se facciano un mazzo — quello vero
      costa di più.
    </p>
  );
}
