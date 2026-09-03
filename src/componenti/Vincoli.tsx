/**
 * La schermata dei vincoli: qui l'utente dichiara il suo tema (ticket 08).
 *
 * Tre strumenti, e nessuna frase da scrivere: le **inclusioni** (filtri
 * strutturati), una **carta-seme** da cui partire, e le **esclusioni**, che
 * vincono sempre sulle altre due. Almeno uno dei tre serve, se no non c'è un
 * tema.
 *
 * Il conteggio delle carte è vivo, e sotto c'è il verdetto: se il tema non
 * basta a fare un mazzo, lo si legge **prima** di generare qualunque cosa, non
 * dopo venti secondi di attesa (Q26). Quando il tema è stretto arrivano gli
 * allargamenti, uno per uno, ciascuno con quante carte porterebbe dentro:
 * nessuno si applica finché non lo si accetta, e quelli accettati restano
 * scritti in cima, dove si vedono.
 */

import { useMemo, useState } from "preact/hooks";

import { cercaPerNome } from "../catalogo/ricerca.js";
import {
  NOMI_DEI_COLORI,
  ORDINE_DEI_COLORI,
  TAG_IN_ORDINE,
  etichettaTag,
  sottotipiDiCreatura,
  tipiPresenti,
  type VoceSottotipo,
  type VoceTipo,
} from "../catalogo/vocabolario.js";
import type { Carta, Colore, Pool, Tag } from "../dati/pool.js";
import { valutaTema } from "../tema/ampiezza.js";
import {
  accetta,
  carteDelTema,
  eTerra,
  filtroVuoto,
  rifiuta,
  risolviTema,
  temaDichiarato,
  type Allargamento,
  type FiltroTema,
  type Tema,
} from "../tema/tema.js";
import { GrigliaCarte } from "./GrigliaCarte.js";
import { SchedaCarta } from "./SchedaCarta.js";

const NUMERI = new Intl.NumberFormat("it-IT");

/** Quanti sottotipi si mostrano come bottoni prima di passare all'elenco. */
const SOTTOTIPI_IN_VISTA = 8;

/** Quante carte-seme si propongono mentre si scrive: un pollice ne sceglie fra poche. */
const SEMI_PROPOSTI = 6;

/** Il costo più alto che ha senso chiedere: oltre, in Standard, non c'è niente. */
const COSTO_PIU_ALTO = 12;

function commuta<T>(voci: readonly T[], voce: T): T[] {
  return voci.includes(voce) ? voci.filter((v) => v !== voce) : [...voci, voce];
}

/** «carta» o «carte», che è la differenza fra un'app che legge bene e una che no. */
function carteContate(quante: number): string {
  return `${NUMERI.format(quante)} ${quante === 1 ? "carta" : "carte"}`;
}

export function Vincoli({
  pool,
  tema,
  cambiaTema,
  copiePerNome,
  cambiaCopie,
}: {
  pool: Pool;
  /** Il tema vive fuori: passando alle altre schermate non si perde. */
  tema: Tema;
  cambiaTema: (tema: Tema) => void;
  copiePerNome: ReadonlyMap<string, number>;
  cambiaCopie: (carta: Carta, delta: number) => void;
}) {
  const [aperta, setAperta] = useState<Carta | null>(null);

  const tipi = useMemo(() => tipiPresenti(pool.carte), [pool]);
  const sottotipi = useMemo(() => sottotipiDiCreatura(pool.carte), [pool]);

  const dichiarato = temaDichiarato(tema);
  // Il verdetto costa un passaggio sul pool — pochi millisecondi sul pool vero —
  // e si rifà a ogni tocco: è così che l'avviso arriva mentre si costruisce il
  // tema e non dopo.
  const ampiezza = useMemo(() => valutaTema(pool.carte, tema), [pool, tema]);
  // Le stesse carte che il verdetto ha contato, e senza terre come lui: le
  // terre le sceglie l'app dalla curva del mazzo (ticket 06), non il tema. Se
  // la lista e il numero venissero da due conti diversi, prima o poi
  // direbbero due cose diverse.
  const carte = useMemo(
    () =>
      dichiarato
        ? carteDelTema(
            pool.carte.filter((carta) => !eTerra(carta)),
            risolviTema(tema, pool.carte),
          )
        : [],
    [pool, tema, dichiarato],
  );

  const seme = tema.seme === null ? null : (pool.carte.find((c) => c.nome === tema.seme) ?? null);

  return (
    <div class="vincoli">
      <section class="verdetto" data-verdetto={dichiarato ? ampiezza.verdetto : "assente"}>
        {!dichiarato ? (
          <>
            <p class="conteggio-tema">Nessun tema, per ora</p>
            <p class="spiega-verdetto">
              Non hai ancora detto che mazzo vuoi. Scegli un sottotipo, un colore, una carta da cui
              partire — o dì che cosa <em>non</em> vuoi giocare.
            </p>
          </>
        ) : (
          <>
            <p class="conteggio-tema" aria-live="polite">
              <strong>{NUMERI.format(ampiezza.carteDisponibili)}</strong>{" "}
              {ampiezza.carteDisponibili === 1 ? "carta" : "carte"} dentro il tema
            </p>
            <div class="barra-ampiezza">
              <div
                class="riempimento"
                style={{
                  width: `${Math.min(100, Math.round((ampiezza.carteDisponibili / ampiezza.carteComode) * 100))}%`,
                }}
              />
            </div>
            <p class="scala-ampiezza">
              <span>{carteContate(ampiezza.carteDisponibili)} disponibili</span>
              <span>{ampiezza.carteComode} per stare comodi</span>
            </p>
            <p class="spiega-verdetto">
              {ampiezza.verdetto === "impossibile"
                ? `Con queste carte un mazzo non si fa: i posti da riempire sono ${ampiezza.postiNonTerra}, e contando le copie ammesse il tema ne copre ${ampiezza.copieDisponibili}.`
                : ampiezza.verdetto === "stretto"
                  ? `Le carte bastano appena. Un mazzo esce, ma la scelta è poca: i mazzi che ti proporrò si somiglieranno fra loro.`
                  : `C'è di che scegliere: ${carteContate(ampiezza.carteDisponibili)} per ${ampiezza.postiNonTerra} posti.`}
            </p>
          </>
        )}
      </section>

      {tema.allargamenti.length > 0 ? (
        <section class="gruppo-vincolo allargati">
          <h2>Il tema che hai allargato</h2>
          <p class="nota-filtro">
            Sta scritto qui perché tu lo sappia: non è più solo quello che avevi chiesto.
          </p>
          <ul class="elenco-allargamenti">
            {tema.allargamenti.map((allargamento) => (
              <li key={allargamento.descrizione} class="allargamento accettato">
                <p class="frase-allargamento">{allargamento.descrizione}</p>
                <button
                  type="button"
                  class="azzera"
                  onClick={() => cambiaTema(rifiuta(tema, allargamento))}
                >
                  Togli
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dichiarato && ampiezza.allargamenti.length > 0 ? (
        <section class="gruppo-vincolo proposte">
          <h2>{ampiezza.verdetto === "impossibile" ? "Le strade che restano" : "Se vuoi più scelta"}</h2>
          <p class="nota-filtro">
            Ognuna allarga il tema di quel tanto che dice. Nessuna vale finché non la accetti.
          </p>
          <ul class="elenco-allargamenti">
            {ampiezza.allargamenti.map((allargamento: Allargamento) => (
              <li key={allargamento.descrizione} class="allargamento">
                <p class="frase-allargamento">{allargamento.descrizione}</p>
                <button
                  type="button"
                  class="accetta"
                  onClick={() => cambiaTema(accetta(tema, allargamento))}
                >
                  Accetta
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div class="corpo-vincoli">
        <div class="colonna-vincoli">
      <section class="gruppo-vincolo">
        <h2>Che mazzo vuoi</h2>
        <FiltroStrutturato
          filtro={tema.inclusioni}
          cambia={(inclusioni) => cambiaTema({ ...tema, inclusioni })}
          tipi={tipi}
          sottotipi={sottotipi}
          conColori
          idElenco="sottotipi-inclusi"
        />
      </section>

      <section class="gruppo-vincolo">
        <h2>Una carta da cui partire</h2>
        <p class="nota-filtro">
          Il tema diventa lei e il suo vicinato: le carte che con lei condividono un sottotipo di
          creatura o una cosa che sanno fare.
        </p>
        {seme !== null ? (
          <div class="seme-scelto">
            <span class="nome-seme">{seme.nome}</span>
            <button type="button" class="azzera" onClick={() => cambiaTema({ ...tema, seme: null })}>
              Togli
            </button>
          </div>
        ) : (
          <SceltaDelSeme
            carte={pool.carte}
            scegli={(nome) => cambiaTema({ ...tema, seme: nome })}
            mancante={tema.seme}
          />
        )}
      </section>

      <section class="gruppo-vincolo">
        <h2>Che cosa non vuoi giocare</h2>
        <p class="nota-filtro">
          Quello che escludi resta fuori sempre: vince su tutto il resto, compresa la carta da cui
          sei partito e gli allargamenti che accetti.
        </p>
        <FiltroStrutturato
          filtro={tema.esclusioni}
          cambia={(esclusioni) => cambiaTema({ ...tema, esclusioni })}
          tipi={tipi}
          sottotipi={sottotipi}
          idElenco="sottotipi-esclusi"
        />
      </section>

        </div>

      <section class="gruppo-vincolo carte-del-tema">
        <h2>Le carte del tema</h2>
        {dichiarato ? (
          <GrigliaCarte
            carte={carte}
            apri={setAperta}
            copiePerNome={copiePerNome}
            cambiaCopie={cambiaCopie}
          />
        ) : (
          <p class="nota-filtro">Appena dici qualcosa, qui sotto compaiono le carte che intendi.</p>
        )}
      </section>
      </div>

      {aperta ? (
        <SchedaCarta
          carta={aperta}
          chiudi={() => setAperta(null)}
          copie={copiePerNome.get(aperta.nome) ?? 0}
          cambiaCopie={cambiaCopie}
        />
      ) : null}
    </div>
  );
}

/**
 * Un filtro strutturato: le stesse leve del catalogo, più i tag di sinergia.
 *
 * I colori si offrono solo alle inclusioni. In esclusione sarebbero una
 * trappola: il filtro dei colori prende chi **non sconfina**, e «escludi il
 * rosso» butterebbe fuori anche tutte le carte senza colore, che col rosso non
 * c'entrano niente.
 */
function FiltroStrutturato({
  filtro,
  cambia,
  tipi,
  sottotipi,
  conColori = false,
  idElenco,
}: {
  filtro: FiltroTema;
  cambia: (filtro: FiltroTema) => void;
  tipi: readonly VoceTipo[];
  sottotipi: readonly VoceSottotipo[];
  conColori?: boolean;
  idElenco: string;
}) {
  const inVista = sottotipi.slice(0, SOTTOTIPI_IN_VISTA);
  // Un sottotipo scelto dall'elenco lungo resta visibile fra i bottoni, o non
  // si potrebbe più togliere senza ricordarsi come si chiamava.
  const scelti = filtro.sottotipi.filter((s) => !inVista.some((vista) => vista.sottotipo === s));

  const costo = (quale: "costoMinimo" | "costoMassimo") => (valore: string) => {
    const numero = Number.parseInt(valore, 10);
    cambia({
      ...filtro,
      [quale]: Number.isNaN(numero) ? null : Math.max(0, Math.min(COSTO_PIU_ALTO, numero)),
    });
  };

  return (
    <div class="filtri">
      {conColori ? (
        <div class="gruppo-filtro">
          <h3>Colori</h3>
          <div class="pastiglie-colore">
            {ORDINE_DEI_COLORI.map((colore: Colore) => (
              <button
                key={colore}
                type="button"
                class="pastiglia-colore"
                data-mana={colore}
                aria-pressed={filtro.colori.includes(colore)}
                aria-label={NOMI_DEI_COLORI[colore]}
                onClick={() => cambia({ ...filtro, colori: commuta(filtro.colori, colore) })}
              >
                {colore}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div class="gruppo-filtro">
        <h3>Tipo di carta</h3>
        <div class="chips">
          {tipi.map((voce) => (
            <button
              key={voce.tipo}
              type="button"
              class="chip"
              aria-pressed={filtro.tipi.includes(voce.tipo)}
              onClick={() => cambia({ ...filtro, tipi: commuta(filtro.tipi, voce.tipo) })}
            >
              {voce.etichetta}
            </button>
          ))}
        </div>
      </div>

      <div class="gruppo-filtro">
        <h3>Sottotipo di creatura</h3>
        <div class="chips">
          {[...inVista, ...scelti.map((sottotipo) => ({ sottotipo, quante: 0 }))].map((voce) => (
            <button
              key={voce.sottotipo}
              type="button"
              class="chip"
              aria-pressed={filtro.sottotipi.includes(voce.sottotipo)}
              onClick={() =>
                cambia({ ...filtro, sottotipi: commuta(filtro.sottotipi, voce.sottotipo) })
              }
            >
              {voce.sottotipo}
              {voce.quante > 0 ? <span class="chip-conto">{voce.quante}</span> : null}
            </button>
          ))}
        </div>
        <label class="campo">
          <span class="etichetta-campo">Un altro sottotipo</span>
          <input
            type="text"
            list={idElenco}
            placeholder="Dragon, Elf, Vampire…"
            // Campo non controllato di proposito, come nel catalogo: il
            // sottotipo scelto diventa un bottone qui sopra e il campo torna
            // vuoto, ma imporgli un valore cancellerebbe quel che si scrive.
            onChange={(evento) => {
              const campo = evento.currentTarget;
              const scelto = campo.value.trim();
              const esiste = sottotipi.find(
                (voce) => voce.sottotipo.toLowerCase() === scelto.toLowerCase(),
              );
              if (!esiste) return;
              campo.value = "";
              if (!filtro.sottotipi.includes(esiste.sottotipo)) {
                cambia({ ...filtro, sottotipi: [...filtro.sottotipi, esiste.sottotipo] });
              }
            }}
          />
        </label>
        <datalist id={idElenco}>
          {sottotipi.map((voce) => (
            <option key={voce.sottotipo} value={voce.sottotipo} />
          ))}
        </datalist>
      </div>

      <div class="gruppo-filtro">
        <h3>Cosa sanno fare</h3>
        <div class="chips">
          {TAG_IN_ORDINE.map((tag: Tag) => (
            <button
              key={tag}
              type="button"
              class="chip"
              aria-pressed={filtro.tag.includes(tag)}
              onClick={() => cambia({ ...filtro, tag: commuta(filtro.tag, tag) })}
            >
              {etichettaTag(tag)}
            </button>
          ))}
        </div>
      </div>

      <div class="gruppo-filtro">
        <h3>Costo di mana</h3>
        <div class="coppia-di-costi">
          <label class="campo">
            <span class="etichetta-campo">Da</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={COSTO_PIU_ALTO}
              value={filtro.costoMinimo ?? ""}
              onInput={(evento) => costo("costoMinimo")(evento.currentTarget.value)}
            />
          </label>
          <label class="campo">
            <span class="etichetta-campo">A</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={COSTO_PIU_ALTO}
              value={filtro.costoMassimo ?? ""}
              onInput={(evento) => costo("costoMassimo")(evento.currentTarget.value)}
            />
          </label>
        </div>
      </div>

      <div class="gruppo-filtro">
        <h3>Parola nel testo</h3>
        <label class="campo">
          <span class="etichetta-campo">Cerca fra le regole delle carte</span>
          <input
            type="search"
            placeholder="graveyard, token, sacrifice…"
            value={filtro.testo}
            onInput={(evento) => cambia({ ...filtro, testo: evento.currentTarget.value })}
          />
        </label>
      </div>

      {filtroVuoto(filtro) ? null : (
        <p class="nota-filtro">
          Le voci di uno stesso filtro si sommano; filtri diversi si restringono a vicenda.
        </p>
      )}
    </div>
  );
}

/**
 * La scelta della carta-seme: si scrive il nome, anche sbagliato, e si tocca
 * quella giusta fra le poche proposte.
 *
 * `mancante` è il nome di un seme che il pool di oggi non ha più — una
 * rotazione, un bando. Non si cancella di nascosto: si dice, perché il tema
 * dell'utente adesso non prende più niente e deve poterlo capire.
 */
function SceltaDelSeme({
  carte,
  scegli,
  mancante,
}: {
  carte: readonly Carta[];
  scegli: (nome: string) => void;
  mancante: string | null;
}) {
  const [domanda, setDomanda] = useState("");
  const proposte = useMemo(
    () => (domanda.trim() === "" ? [] : cercaPerNome(carte, domanda).slice(0, SEMI_PROPOSTI)),
    [carte, domanda],
  );

  return (
    <>
      {mancante !== null ? (
        <p class="nota-filtro avviso-seme">
          «{mancante}» non è più fra le carte legali: il tema è rimasto senza la sua carta di
          partenza.
        </p>
      ) : null}
      <label class="campo">
        <span class="etichetta-campo">Cerca una carta per nome</span>
        <input
          type="search"
          autocomplete="off"
          spellcheck={false}
          placeholder="Scrivi il nome, anche sbagliato"
          value={domanda}
          onInput={(evento) => setDomanda(evento.currentTarget.value)}
        />
      </label>
      {proposte.length > 0 ? (
        <ul class="proposte-seme">
          {proposte.map((carta) => (
            <li key={carta.id}>
              <button
                type="button"
                class="chip"
                onClick={() => {
                  scegli(carta.nome);
                  setDomanda("");
                }}
              >
                {carta.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
