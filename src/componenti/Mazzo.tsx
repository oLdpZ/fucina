/**
 * La schermata del mazzo: quante terre, quali, e la probabilità reale di
 * lanciare ogni carta al suo turno (ticket 06).
 *
 * È il primo pezzo di calcolo vero dell'app, e risponde da solo alla domanda
 * «questa base regge?». Ogni numero mostrato qui viene da `analizzaBaseDiTerre`
 * e da nessun altro posto: le frasi sono modelli riempiti con quei numeri, mai
 * giudizi inventati — è il vincolo non negoziabile di `CLAUDE.md`.
 */

import { useMemo } from "preact/hooks";

import {
  analizzaBaseDiTerre,
  type CopieDiCarta,
  type RigaDelMazzo,
} from "../mazzo/base-di-terre.js";
import { copieMassime } from "../mazzo/copie.js";
import {
  DIMENSIONE_MAZZO,
  PERDITA_MASSIMA_PER_I_COLORI,
  TERRE_A_MANO_MASSIME,
  TERRE_A_MANO_MINIME,
} from "../mazzo/taratura.js";
import type { Carta, ColoreMana, Pool } from "../dati/pool.js";
import { escluso, type Tema } from "../tema/tema.js";
import { CostoDiMana } from "./CostoDiMana.js";

const PERCENTUALE = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 0,
});
const UN_DECIMALE = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

const NOME_COLORE: Record<ColoreMana, string> = {
  W: "bianco",
  U: "blu",
  B: "nero",
  R: "rosso",
  G: "verde",
  C: "incolore",
};

export function Mazzo({
  pool,
  tema,
  mazzo,
  cambiaCopie,
  terreVolute,
  cambiaTerre,
  apri,
}: {
  pool: Pool;
  /** Il tema serve qui per una cosa sola: le sue **esclusioni**. */
  tema: Tema;
  mazzo: readonly CopieDiCarta[];
  cambiaCopie: (carta: Carta, delta: number) => void;
  terreVolute: number | null;
  cambiaTerre: (quante: number | null) => void;
  apri: (carta: Carta) => void;
}) {
  // Le esclusioni del tema valgono anche per le terre, e valgono **qui** come
  // valgono nel motore: se l'utente ha detto «niente verde», dal verde non
  // arriva nemmeno una foresta. Se questa schermata pescasse dal pool intero,
  // un mazzo costruito senza certe terre se le ritroverebbe dentro appena
  // messo in mano, e la promessa sarebbe rotta nel punto in cui si guarda.
  const terreDelPool = useMemo(
    () => pool.carte.filter((carta) => carta.terra !== null && !escluso(carta, tema)),
    [pool, tema],
  );
  const base = useMemo(
    () => analizzaBaseDiTerre(mazzo, terreDelPool, { terreVolute }),
    [mazzo, terreDelPool, terreVolute],
  );

  if (mazzo.length === 0) {
    return (
      <div class="mazzo vuoto">
        <h2>Il mazzo è vuoto</h2>
        <p>
          Aggiungi carte dal catalogo con il <strong>+</strong> sotto ognuna. Le terre non si
          scelgono: le mette l&rsquo;app, e qui sotto ti dice quante, quali, e con che probabilità
          riesci a lanciare ogni carta al suo turno.
        </p>
      </div>
    );
  }

  const totale = base.copieNonTerra + base.numeroTerre;
  const righeOrdinate = [...base.righe].sort(
    (a, b) =>
      a.carta.valoreDiMana - b.carta.valoreDiMana || a.carta.nome.localeCompare(b.carta.nome, "en"),
  );

  return (
    <div class="mazzo">
      <section class="riepilogo">
        <h2>La base di terre</h2>
        <p class="conta-carte">
          <strong>{base.numeroTerre}</strong> terre e <strong>{base.copieNonTerra}</strong> carte
          non-terra: <strong>{totale}</strong> in tutto.
          {totale < DIMENSIONE_MAZZO ? (
            <>
              {" "}
              Ne mancano {DIMENSIONE_MAZZO - totale} per un mazzo da {DIMENSIONE_MAZZO}; le
              probabilità qui sotto sono calcolate come se ci fossero già.
            </>
          ) : totale > DIMENSIONE_MAZZO ? (
            <>
              {" "}
              Un mazzo Standard ne vuole {DIMENSIONE_MAZZO}: qui sono{" "}
              {totale - DIMENSIONE_MAZZO} di troppo.
            </>
          ) : null}
        </p>
        <p class="spiegazione">
          Le carte del mazzo costano {UN_DECIMALE.format(base.costoMedio)} di media, e da lì
          vengono le {base.numeroTerreDallaCurva} terre che l&rsquo;app consiglia.
          {base.terreCheEntranoGirate > 0 ? (
            <>
              {" "}
              {base.terreCheEntranoGirate} di queste terre entrano girate
              {base.terreGirateSoloAVolte > 0
                ? ` (${base.terreGirateSoloAVolte} solo a certe condizioni, e qui contano` +
                  " come girate: è la lettura che non promette più di quel che avrai)"
                : ""}
              , e il turno in cui le giochi non producono mana.
            </>
          ) : (
            " Nessuna di queste terre entra girata."
          )}
        </p>

        <ManopolaTerre
          numeroTerre={base.numeroTerre}
          dallaCurva={base.numeroTerreDallaCurva}
          aMano={terreVolute !== null}
          cambia={cambiaTerre}
        />
      </section>

      <section class="terre-scelte">
        <h3>Le terre</h3>
        <ul class="elenco-terre">
          {base.terre.map((voce) => (
            <li key={voce.carta.nome}>
              <button type="button" class="nome-terra" onClick={() => apri(voce.carta)}>
                <span class="copie">{voce.copie}×</span> {voce.carta.nome}
              </button>
              {voce.carta.terra?.entraGirata === true ? (
                <span class="girata">
                  {voce.carta.terra.condizione === null ? "entra girata" : "entra girata a volte"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {base.coloriRichiesti.length > 0 ? (
          <table class="fonti">
            <caption>Quanto ogni colore è chiesto, e quante terre lo fanno</caption>
            <thead>
              <tr>
                <th scope="col">Colore</th>
                <th scope="col">Simboli</th>
                <th scope="col">Fonti</th>
              </tr>
            </thead>
            <tbody>
              {base.coloriRichiesti.map((richiesta) => (
                <tr key={richiesta.colore}>
                  <th scope="row">{NOME_COLORE[richiesta.colore]}</th>
                  <td>{UN_DECIMALE.format(richiesta.simboli)}</td>
                  <td>{richiesta.fonti}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {base.difficili.length > 0 ? (
        <section class="avviso-difficili">
          <h3>
            {base.difficili.length === 1
              ? "Una carta che questa base non regge"
              : `${base.difficili.length} carte che questa base non regge`}
          </h3>
          <p>
            Per queste carte i simboli colorati costano più di{" "}
            {PERCENTUALE.format(PERDITA_MASSIMA_PER_I_COLORI)} di probabilità rispetto a una carta
            che costasse lo stesso senza colori: o si sostituiscono, o si accetta il rischio
            sapendolo.
          </p>
          <ul>
            {base.difficili.map((riga) => (
              <li key={riga.carta.nome}>
                <strong>{riga.carta.nome}</strong> — {PERCENTUALE.format(riga.probabilita)} al turno{" "}
                {riga.turno}, contro {PERCENTUALE.format(riga.probabilitaSenzaColori)} se non
                chiedesse colori.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section class="carte-del-mazzo">
        <h3>Le carte, e quanto spesso partono al loro turno</h3>
        <ul class="righe-mazzo">
          {righeOrdinate.map((riga) => (
            <RigaCarta key={riga.carta.nome} riga={riga} cambiaCopie={cambiaCopie} apri={apri} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Il numero di terre: quello dell'app, e la possibilità di scavalcarlo. */
function ManopolaTerre({
  numeroTerre,
  dallaCurva,
  aMano,
  cambia,
}: {
  numeroTerre: number;
  dallaCurva: number;
  aMano: boolean;
  cambia: (quante: number | null) => void;
}) {
  return (
    <div class="manopola-terre">
      <span class="etichetta-manopola" id="etichetta-terre">
        Terre
      </span>
      <div class="passi" role="group" aria-labelledby="etichetta-terre">
        <button
          type="button"
          onClick={() => cambia(numeroTerre - 1)}
          disabled={numeroTerre <= TERRE_A_MANO_MINIME}
          aria-label="Una terra in meno"
        >
          −
        </button>
        <output class="numero-terre">{numeroTerre}</output>
        <button
          type="button"
          onClick={() => cambia(numeroTerre + 1)}
          disabled={numeroTerre >= TERRE_A_MANO_MASSIME}
          aria-label="Una terra in più"
        >
          +
        </button>
      </div>
      {aMano ? (
        <button type="button" class="torna" onClick={() => cambia(null)}>
          Torna alle {dallaCurva} dell&rsquo;app
        </button>
      ) : (
        <span class="nota-manopola">deciso dalla curva del mazzo</span>
      )}
    </div>
  );
}

function RigaCarta({
  riga,
  cambiaCopie,
  apri,
}: {
  riga: RigaDelMazzo;
  cambiaCopie: (carta: Carta, delta: number) => void;
  apri: (carta: Carta) => void;
}) {
  const percentuale = PERCENTUALE.format(riga.probabilita);
  return (
    <li class="riga-mazzo" data-difficile={riga.difficile}>
      <div class="passi piccoli">
        <button
          type="button"
          onClick={() => cambiaCopie(riga.carta, -1)}
          disabled={riga.copie <= 0}
          aria-label={`Una copia in meno di ${riga.carta.nome}`}
        >
          −
        </button>
        <span class="copie">{riga.copie}</span>
        <button
          type="button"
          onClick={() => cambiaCopie(riga.carta, +1)}
          disabled={riga.copie >= copieMassime(riga.carta)}
          aria-label={`Una copia in più di ${riga.carta.nome}`}
        >
          +
        </button>
      </div>

      <button type="button" class="nome-nel-mazzo" onClick={() => apri(riga.carta)}>
        <span class="nome-carta">{riga.carta.nome}</span>
        <CostoDiMana costo={riga.carta.costoDiMana} />
      </button>

      <div class="probabilita">
        <div
          class="barra"
          role="img"
          aria-label={`${percentuale} di poterla lanciare al turno ${riga.turno}`}
        >
          <span style={{ width: `${riga.probabilita * 100}%` }} />
        </div>
        <span class="valore">
          {percentuale} <span class="al-turno">al turno {riga.turno}</span>
        </span>
      </div>

      {riga.difficile ? <span class="segnale">difficile</span> : null}
    </li>
  );
}
