/**
 * La lista della spesa: che cosa comprare, in quale stampa, e quanto costa
 * (ticket 09).
 *
 * Tre cose che questa schermata non può non dire, e che qui stanno tutte e tre:
 *
 * - **quale stampa** si compra, e — quando il prezzo viene da un'altra copia
 *   ammessa — da quale stampa è il conto. Senza il codice di edizione chi cerca
 *   su Cardmarket non sa quale delle cinque guardare, e senza la seconda non sa
 *   che sta confrontando due cartoncini diversi;
 * - che il totale è una **stima al ribasso**: è il prezzo delle copie ammesse
 *   più economiche che un listino ce l'abbiano, e quelle che si troveranno da
 *   comprare possono costare di più. Il numero qui sotto è un pavimento;
 * - che alcune di queste carte non diventeranno **mai** più economiche, perché
 *   sono in Reserved List e non saranno ristampate.
 *
 * I numeri arrivano già fatti da `mazzo/spesa.ts`: qui si compongono le frasi,
 * su quei numeri e mai inventate.
 */

import { useMemo } from "preact/hooks";

import { dataInItaliano } from "../dati/carica-pool.js";
import { frasePerIlPrezzoDichiarato } from "../spiegazioni/frasi.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import {
  altraStampaDelPrezzo,
  attaccoDelPrezzo,
  AVVISO_STIMA_AL_RIBASSO,
  copieAPrezzoDichiarato,
  descriviLaStampa,
  listaDellaSpesa,
  prezzoDichiarato as prezzoDichiaratoDi,
} from "../mazzo/spesa.js";

const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function ListaDellaSpesa({ mazzo }: { mazzo: readonly CopieDiCarta[] }) {
  const lista = useMemo(() => listaDellaSpesa(mazzo), [mazzo]);

  if (lista.voci.length === 0) return null;

  const incompleto = lista.senzaPrezzo.length > 0;
  const prezzoDichiarato = frasePerIlPrezzoDichiarato(copieAPrezzoDichiarato(lista));

  return (
    <section class="lista-della-spesa">
      <h3>La lista della spesa</h3>

      <p class="totale-spesa">
        {incompleto ? "Almeno " : ""}
        <strong>{EURO.format(lista.totale)}</strong>
        {lista.aggiornatoIl === null ? null : (
          <> · prezzi Cardmarket del {dataInItaliano(lista.aggiornatoIl)}</>
        )}
      </p>

      <p class="avviso-prezzi">{AVVISO_STIMA_AL_RIBASSO}</p>

      {/* Le copie il cui prezzo il gruppo ha dichiarato: stanno nel totale, e
          l'avviso qui sopra promette Cardmarket anche per loro (ticket 83). */}
      {prezzoDichiarato === null ? null : <p class="avviso-prezzi">{prezzoDichiarato}</p>}

      {incompleto ? (
        <p class="avviso-prezzi">
          {lista.senzaPrezzo.length === 1
            ? "Una carta non ha listino e nel totale non c’è"
            : `${lista.senzaPrezzo.length} carte non hanno listino e nel totale non ci sono`}
          : di quelle carte Cardmarket non ha il listino di nessuna copia ammessa. Il conto vero è
          più alto di quello qui sopra.
        </p>
      ) : null}

      {lista.riservate.length > 0 ? (
        <p class="avviso-prezzi">
          {lista.riservate.length === 1
            ? "Una di queste carte è in Reserved List"
            : `${lista.riservate.length} di queste carte sono in Reserved List`}
          : non saranno mai ristampate, e aspettare non le farà costare di meno.
        </p>
      ) : null}

      <ul class="righe-spesa">
        {lista.voci.map((voce) => {
          // `null` quando a prezzare è la stessa copia che si compra, che è il
          // caso normale e non ha niente di speciale da dire.
          const altraStampa = altraStampaDelPrezzo(voce.carta);
          return (
            <li key={voce.carta.nome} data-riservata={voce.carta.riservata ? "" : undefined}>
              <span class="copie">{voce.copie}×</span>
              <span class="nome-carta">{voce.carta.nome}</span>
              {/* La stampa sta accanto al nome e non in fondo: è quel che si
                scrive nella casella di ricerca del negozio, e senza di lei il
                nome da solo pesca cinque edizioni a prezzi diversi. */}
              <span class="stampa">
                {descriviLaStampa(voce.carta)}
                {altraStampa === null ? null : ` · ${attaccoDelPrezzo(voce.carta)}${altraStampa}`}
                {/* La cifra dichiarata si dice sulla **riga**, e non solo nel
                    riassunto in testa: è lì che si legge «0,00 €», ed è lì che
                    senza una parola sembrerebbe un prezzo di mercato che nessun
                    negozio farà (ticket 83). */}
                {prezzoDichiaratoDi(voce.carta) ? " · prezzo dichiarato dal gruppo" : null}
              </span>
              <span class="prezzo-voce">
                {voce.euro === null ? (
                  <em>senza listino</em>
                ) : (
                  <>
                    {EURO.format(voce.euro)}
                    {voce.copie > 1 && voce.euroPerCopia !== null ? (
                      <span class="al-pezzo"> ({EURO.format(voce.euroPerCopia)} l’una)</span>
                    ) : null}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
