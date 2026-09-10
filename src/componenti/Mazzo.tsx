/**
 * La schermata del mazzo: quante terre, quali, e la probabilità reale di
 * lanciare ogni carta al suo turno (ticket 06).
 *
 * È il primo pezzo di calcolo vero dell'app, e risponde da solo alla domanda
 * «questa base regge?». Ogni numero mostrato qui viene da `analizzaBaseDiTerre`
 * e da nessun altro posto: le frasi sono modelli riempiti con quei numeri, mai
 * giudizi inventati — è il vincolo non negoziabile di `CLAUDE.md`.
 *
 * In fondo c'è la **lista della spesa** (ticket 09), e sta qui e non nella
 * schermata che costruisce: è questo il mazzo che il giocatore ha in mano e che
 * porterà al negozio, terre comprese — e le terre le sceglie l'app proprio qui,
 * quindi è qui che se ne conosce il prezzo.
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
import type { Tema } from "../tema/tema.js";
import { CostoDiMana } from "./CostoDiMana.js";
import { ListaDellaSpesa } from "./ListaDellaSpesa.js";
import {
  budgetPerLeTerre,
  confrontoFraTemiSulleTerre,
  terreCandidate,
} from "../mazzo/terre-candidate.js";
import {
  frasePerIlTemaInVigore,
  frasePerIlTettoInVigore,
  frasePerLeRinunceDelBudget,
} from "../spiegazioni/frasi.js";

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
  temaDeiVincoli,
  temaDelMazzo,
  mazzo,
  cambiaCopie,
  terreVolute,
  cambiaTerre,
  tettoDiSpesa,
  sciogliIVincoli,
  apri,
}: {
  pool: Pool;
  /**
   * Il tema che sceglie le terre di **questo** mazzo, e serve qui per una cosa
   * sola: le sue **esclusioni**.
   *
   * Non è per forza quello dichiarato nei Vincoli: un mazzo costruito o riaperto
   * si porta dietro il tema sotto cui è nato, e sono le sue esclusioni a
   * decidere la base finché quel mazzo resta quel mazzo (`in-vigore.ts`,
   * ticket 31).
   */
  tema: Tema;
  /**
   * Il tema dichiarato **adesso** nei Vincoli.
   *
   * Non filtra niente: serve a dire di quanto le due basi differirebbero, e a
   * tacere quando non differiscono affatto. Senza di lui la schermata potrebbe
   * solo dire «le terre sono quelle di un altro tema» senza saper dire quanto —
   * cioè una frase senza numeri dentro, che questa app non scrive.
   */
  temaDeiVincoli: Tema;
  /**
   * Se un tema **è** attaccato a questo mazzo, e quale; `null` quando le sue
   * terre le decide la manopola dei Vincoli.
   *
   * Non serve a filtrare — a quello serve `tema`, che quando questo è `null` è
   * già il tema dei Vincoli — ma a dire la verità sul tasto: sciogliere i
   * vincoli leva anche il tema, e un tasto che dicesse solo «Togli il tetto»
   * mentre ne stacca due direbbe una cosa più piccola di quella che fa.
   */
  temaDelMazzo: Tema | null;
  mazzo: readonly CopieDiCarta[];
  cambiaCopie: (carta: Carta, delta: number) => void;
  terreVolute: number | null;
  cambiaTerre: (quante: number | null) => void;
  /** Il tetto di spesa, `null` quando è spento: vale anche sulle terre. */
  tettoDiSpesa: number | null;
  /**
   * Slegare questo mazzo dai vincoli con cui è nato — il tetto e il tema —
   * senza toccarne le carte (ticket 21, poi ticket 31).
   */
  sciogliIVincoli: () => void;
  apri: (carta: Carta) => void;
}) {
  // Le esclusioni del tema valgono anche per le terre, e valgono **qui** come
  // valgono nel motore: se l'utente ha detto «niente verde», dal verde non
  // arriva nemmeno una foresta. Se questa schermata pescasse dal pool intero,
  // un mazzo costruito senza certe terre se le ritroverebbe dentro appena
  // messo in mano, e la promessa sarebbe rotta nel punto in cui si guarda.
  // Il tetto di spesa vale qui come vale nel motore, e per la stessa ragione
  // per cui ci valgono le esclusioni: la base che questa schermata rifà deve
  // essere **la stessa** che la ricerca ha scelto e prezzato. Senza, un mazzo
  // costruito dentro il tetto se ne ritroverebbe fuori appena messo in mano —
  // con dentro proprio le terre che il motore aveva lasciato fuori perché
  // costavano troppo o perché un listino non ce l'hanno.
  const terreDelPool = useMemo(
    () => terreCandidate(pool.carte, tema, tettoDiSpesa),
    [pool, tema, tettoDiSpesa],
  );
  /**
   * Quel che resta alla base dopo le carte, quando un tetto c'è — e le carte
   * che il pool di oggi non sa prezzare, se ce ne sono (ticket 38).
   *
   * Si ricava qui e non si eredita: la base che si mostra dev'essere la base
   * che il mazzo può permettersi **con queste carte**, o la schermata
   * elencherebbe terre che il conto in fondo non copre.
   *
   * Gli euro si passano alla base **anche** quando qualche carta è incontabile,
   * e non è una svista: il mazzo è dell'utente e le sue terre restano quelle
   * che aveva. Quel che cambia è la riga qui sotto, che smette di promettere di
   * starci dentro — la ragione per esteso sta in `budgetPerLeTerre`.
   */
  const budget = useMemo(() => budgetPerLeTerre(mazzo, tettoDiSpesa), [mazzo, tettoDiSpesa]);
  const euroPerLeTerre = budget?.euro ?? null;
  const incontabili = useMemo(
    () => (budget?.incontabili ?? []).map((carta) => carta.nome),
    [budget],
  );
  /**
   * Di quanto il tema di questo mazzo e quello dei Vincoli differiscono sulle
   * terre: i numeri della frase, e la risposta a **se dirla**.
   *
   * Il conto sta in `terre-candidate.ts` e non qui: la schermata dei salvati fa
   * la stessa domanda per le liste che scrive, e due copie della stessa
   * risposta sono la strada da cui il ticket 19 è arrivato.
   */
  const terreDiDueTemi = useMemo(
    () => confrontoFraTemiSulleTerre(pool.carte, tema, temaDeiVincoli),
    [pool, tema, temaDeiVincoli],
  );
  const base = useMemo(
    () => analizzaBaseDiTerre(mazzo, terreDelPool, { terreVolute, budget: euroPerLeTerre }),
    [mazzo, terreDelPool, terreVolute, euroPerLeTerre],
  );

  // Carte e terre in un elenco solo, ricavato una volta: la lista della spesa
  // ci ragiona sopra, e un elenco nuovo a ogni respiro dell'app le farebbe
  // rifare il conto per niente.
  //
  // Sta **sopra** l'uscita anticipata qui sotto, e non accanto a chi lo usa: i
  // ganci di preact vanno chiamati tutti e sempre nello stesso ordine, e uno
  // messo dopo un `return` scomparirebbe proprio quando il mazzo si svuota.
  const daComprare = useMemo(() => [...mazzo, ...base.terre], [mazzo, base]);

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
              Un mazzo ne vuole {DIMENSIONE_MAZZO}: qui sono{" "}
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

        {/*
          Il tetto in vigore si **dichiara**, e si dichiara sempre che ci sia
          (ticket 21): finché non lo diceva nessuno, la schermata filtrava le
          terre e ne contava le copie con una cifra invisibile, e chi non se la
          ricordava vedeva una base senza sapere perché fosse quella. Il tasto
          accanto è quel che rende accettabile la regola severa che stacca il
          tetto alla prima carta cambiata: chi lo vuole via lo dice qui.
        */}
        {tettoDiSpesa !== null || !terreDiDueTemi.stessaBase ? (
          <div class="vincoli-in-vigore">
            {tettoDiSpesa !== null ? (
              <p class="spiegazione">
                {frasePerIlTettoInVigore({
                  tetto: tettoDiSpesa,
                  conIlSuoTema: temaDelMazzo !== null,
                  incontabili,
                })}
              </p>
            ) : null}
            {/*
              Il tema si dichiara solo quando cambia davvero la base (ticket 31):
              due temi che ammettono le stesse terre scelgono le stesse terre, e
              un avviso su una base identica sarebbe rumore che insegna a non
              leggere gli avvisi.
            */}
            {terreDiDueTemi.stessaBase ? null : (
              <p class="spiegazione">{frasePerIlTemaInVigore(terreDiDueTemi)}</p>
            )}
            {/*
              Il tasto sta su una riga sua e non in mezzo alla frase: dentro il
              testo sarebbe alto quanto una riga, e questa è un'app da telefono
              (Q20) dove sotto il dito ci vogliono i suoi millimetri.

              Uno solo per tutti e due i vincoli, perché uno solo è il fatto che
              tolgono di mezzo: che questo mazzo è quello costruito così. Due
              tasti direbbero che si possono staccare separatamente, e non si
              può — la ragione sta in `in-vigore.ts`.
            */}
            <button type="button" class="togli-tetto" onClick={sciogliIVincoli}>
              {temaDelMazzo === null ? "Togli il tetto" : "Rifà le terre coi vincoli di adesso"}
            </button>
          </div>
        ) : null}

        {/*
          Le rinunce si dicono solo quando l'app sa contare il mazzo (ticket 38).
          Sono un conto fatto **sul budget**, e con una carta incontabile quel
          budget è più largo del vero: gli euro rinunciati sarebbero sottostimati
          e, peggio, la riga direbbe «per stare dentro 30,00 € la base ha
          lasciato fuori…» due righe sotto quella che ha appena spiegato che
          dentro quella cifra non si può promettere niente.
        */}
        {base.rinunceDelBudget.length > 0 && tettoDiSpesa !== null && incontabili.length === 0 ? (
          <p class="spiegazione avviso-budget-terre">
            {frasePerLeRinunceDelBudget({
              tetto: tettoDiSpesa,
              rinunce: base.rinunceDelBudget.map((voce) => ({
                nome: voce.carta.nome,
                copie: voce.copie,
                euro: voce.euro,
              })),
            })}
          </p>
        ) : null}

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

      {/* Carte e terre insieme, che è quel che si compra: le terre di questo
          formato non sono un contorno da pochi centesimi. */}
      <ListaDellaSpesa mazzo={daComprare} />
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
