/**
 * La schermata dei mazzi salvati (ticket 07): si dà un nome al mazzo e resta
 * sul telefono; si riapre, si cancella; si esporta in un testo da mandare a un
 * amico, o nella lista da consegnare all'arbitro; e si importa il testo che un
 * amico ha mandato.
 *
 * Tutto sul dispositivo: nessun account, nessun server, nessuna
 * sincronizzazione (Q19, Q22). Il solo modo in cui un mazzo esce di qui è un
 * testo che l'utente copia o scarica con le sue mani.
 */

import { useEffect, useMemo, useState } from "preact/hooks";

import type { IdentitaDiFormato } from "../dati/ambito.js";
import { dataInItaliano } from "../dati/carica-pool.js";
import { dimenticaMazzo, elencaMazziSalvati, salvaMazzo } from "../dati/mazzi-salvati.js";
import type { Pool } from "../dati/pool.js";
import {
  budgetPerLeTerre,
  confrontoFraTemiSulleTerre,
  terreCandidate,
} from "../mazzo/terre-candidate.js";
import type { Tema } from "../tema/tema.js";
import { analizzaBaseDiTerre, type CopieDiCarta } from "../mazzo/base-di-terre.js";
import { leggiScambio, listaDaTorneo, scriviScambio } from "../mazzo/scambio.js";
import {
  fraseConLeTerreScartate,
  frasePerIlTemaSuQuelCheEsce,
  frasePerIlTettoSuQuelCheEsce,
} from "../spiegazioni/frasi.js";
import {
  nomePulito,
  NOME_MASSIMO,
  type ContenutoMazzo,
  type MazzoSalvato,
} from "../mazzo/salvato.js";

/** Il mazzo aperto adesso: il suo posto nel deposito, se ne ha già uno. */
export type MazzoAperto = { id: string; nome: string; salvatoIl: string } | null;

/**
 * Le terre che una lista portava e che nell'elenco non entrano: chi rimette in
 * mano un mazzo le restituisce, perché vanno **dette**.
 */
export type TerreScartate = readonly { nome: string; copie: number }[];

export function MazziSalvati({
  pool,
  tema,
  temaDeiVincoli,
  tettoDiSpesa,
  vincoliDelMazzo,
  formato,
  mazzo,
  terreVolute,
  aperto,
  apriMazzo,
  chiudiMazzo,
}: {
  pool: Pool;
  /**
   * Il tema e il tetto con cui il mazzo in mano è stato costruito.
   *
   * Servono a una cosa sola, ed è la ragione per cui questa schermata li chiede
   * invece di arrangiarsi: la lista da consegnare all'arbitro deve elencare
   * **le stesse terre** che la schermata del mazzo mostra. Senza, le due
   * scelgono da due pool diversi e scrivono due basi diverse per lo stesso
   * mazzo — e quella sul foglio è quella sbagliata, perché il giocatore in mano
   * ha l'altra.
   */
  tema: Tema;
  /**
   * Il tema dichiarato **adesso** nei Vincoli, che qui non filtra niente: serve
   * solo a dire di quanto le terre di queste liste differiscono da quelle che
   * il tema di adesso sceglierebbe, e a tacere quando non differiscono affatto.
   */
  temaDeiVincoli: Tema;
  tettoDiSpesa: number | null;
  /**
   * I vincoli che questo mazzo si porta dietro **nel file**, già pronti da
   * scrivere: il tema e il tetto in vigore su di lui, assenti quando non ne ha
   * (ticket 40).
   *
   * Non sono le due prop qui sopra e non si ricavano da loro. Quelle servono a
   * mostrare le terre, e per mostrarle un mazzo senza vincoli ripiega su quel
   * che dicono i Vincoli adesso — è con quello che questa schermata ha appena
   * scritto le liste. Scrivere quel ripiego nel file darebbe a un mazzo slegato
   * apposta, o montato a mano dal catalogo, un tema che non ha mai avuto.
   *
   * Arrivano in **un valore solo** perché sono un fatto solo: chi li prepara
   * (`vincoliDaSalvare`) li mette o li toglie insieme, e di qui non c'è modo di
   * scriverne metà.
   */
  vincoliDelMazzo: { tema?: Tema; tetto?: number };
  /**
   * Il gioco che si sta giocando. Entra da fuori e non si legge qui: il mazzo
   * che si salva e quello che si esporta devono dichiarare lo **stesso**
   * formato che l'app ha aperto, non uno riletto per conto proprio.
   */
  formato: IdentitaDiFormato;
  mazzo: readonly CopieDiCarta[];
  terreVolute: number | null;
  aperto: MazzoAperto;
  /**
   * Rimettere in mano un mazzo salvato. `vaiAlMazzo` porta anche a vederlo: lo
   * si vuole aprendo dall'elenco, non quando si è appena salvato o importato e
   * c'è un messaggio da leggere su questa schermata.
   */
  apriMazzo: (salvato: MazzoSalvato, vaiAlMazzo: boolean) => TerreScartate;
  /** Il mazzo che si stava guardando non c'è più: è stato cancellato. */
  chiudiMazzo: () => void;
}) {
  const [salvati, setSalvati] = useState<MazzoSalvato[]>([]);
  const [nome, setNome] = useState(aperto?.nome ?? "");
  const [avviso, setAvviso] = useState<string | null>(null);
  const [guasto, setGuasto] = useState<string | null>(null);
  const [daImportare, setDaImportare] = useState("");

  /**
   * Quel che è andato bene e quel che non è andato si dicono **insieme**: un
   * «salvato» rimasto lì sopra un «non si è potuto salvare» direbbe all'utente
   * due cose opposte nello stesso momento.
   */
  const racconta = (fatto: string | null, male: string | null) => {
    setAvviso(fatto);
    setGuasto(male);
  };

  // L'elenco si rilegge dal deposito, che è la sola verità: due schede aperte
  // sullo stesso telefono non devono mostrare due elenchi diversi.
  useEffect(() => {
    let vivo = true;
    void elencaMazziSalvati().then((letti) => {
      if (vivo) setSalvati(letti);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Riaprendo un mazzo salvato, il campo del nome porta già il suo nome: chi lo
  // modifica e risalva sta lavorando su quello, non ne sta facendo un altro.
  useEffect(() => setNome(aperto?.nome ?? ""), [aperto?.id, aperto?.nome]);

  /**
   * Il mazzo da salvare o da esportare, costruito da **quel che è nel mazzo**
   * e non da quel che l'utente ha toccato: una carta uscita dal pool — una
   * rotazione, un bando — non è più nel mazzo, e non deve finire né nel file
   * che si manda a un amico né nella lista che si consegna all'arbitro.
   *
   * La data arriva da fuori: l'orologio non può stare in un calcolo che si
   * rifà a ogni disegno, e quello vero si legge nell'istante in cui si salva.
   */
  const componi = (salvatoIl: string): ContenutoMazzo | null => {
    const carte = mazzo
      .filter((voce) => voce.copie > 0)
      .map((voce) => ({ nome: voce.carta.nome, copie: voce.copie }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "en"));
    if (carte.length === 0) return null;
    const scelto = nomePulito(nome);
    return {
      nome: scelto === "" ? "Mazzo senza nome" : scelto,
      salvatoIl,
      datiDel: pool.generatoIl,
      // Sotto quali vincoli le terre di questo mazzo sono state scelte
      // (ticket 31). Sono quelli **in vigore sul mazzo** e non le manopole, e
      // arrivano già decisi da fuori: scriverli è quel che permette a chi lo
      // riaprirà — fra una settimana, dopo aver cambiato tema dieci volte — di
      // ritrovare queste terre e non altre. Un mazzo che non ne ha non ne
      // scrive, ed è altrettanto importante: è così che «Rifà le terre coi
      // vincoli di adesso» sopravvive a un salvataggio (ticket 40).
      richiesta: { origine: "a-mano", terreVolute, ...vincoliDelMazzo },
      // Di che gioco è questo mazzo. Un mazzo salvato dura più a lungo del
      // formato che l'ha prodotto — il documento si corregge — e senza questa
      // riga, il giorno che il formato cambia, il mazzo si riaprirebbe mezzo
      // vuoto senza che nessuno sappia dire perché. Scriverla è tutto quel che
      // si fa oggi: **leggerla** — la sola lettura, il file rifiutato con la
      // sua ragione — è il ticket 10, che aspettava proprio questo.
      formato,
      carte,
    };
  };

  /**
   * La data che porta il testo da esportare: quella del mazzo salvato, se se
   * ne sta guardando uno, altrimenti l'istante in cui si è aperta la
   * schermata. Ferma: un orologio riletto a ogni disegno riscriverebbe il
   * testo sotto le dita di chi lo sta selezionando.
   */
  const apertaAlle = useMemo(() => new Date().toISOString(), []);
  const contenuto = componi(aperto?.salvatoIl ?? apertaAlle);

  // La stessa funzione della schermata del mazzo, e non gli stessi filtri
  // riscritti: due liste di terre che divergono sono due mazzi diversi con lo
  // stesso nome, ed è già successo (ticket 19).
  const terreDelPool = useMemo(
    () => terreCandidate(pool.carte, tema, tettoDiSpesa),
    [pool, tema, tettoDiSpesa],
  );
  /**
   * Quel che resta alla base dopo le carte, e le carte che il pool di oggi non
   * sa prezzare (ticket 38).
   *
   * Gli euro vanno alla base **anche** quando qualcuna è incontabile: queste
   * liste devono elencare le stesse terre che il giocatore ha in mano, o si
   * torna al guasto del ticket 19. Le incontabili vanno invece alla frase qui
   * sotto, che senza di loro prometterebbe che le terre stanno dentro una cifra
   * che non si sa raggiungere — e lo prometterebbe sul **foglio per l'arbitro**,
   * cioè dove la promessa costa di più.
   */
  const budget = useMemo(() => budgetPerLeTerre(mazzo, tettoDiSpesa), [mazzo, tettoDiSpesa]);
  const euroPerLeTerre = budget?.euro ?? null;
  const incontabili = useMemo(
    () => (budget?.incontabili ?? []).map((carta) => carta.nome),
    [budget],
  );
  /**
   * Lo stesso confronto della schermata del mazzo, con **la stessa funzione**:
   * le due schermate devono dire di queste terre le stesse cose, e riscriverlo
   * qui sarebbe la copia da cui, dopo il ticket 19, la lista per l'arbitro
   * elencava terre che il mazzo mostrato non conteneva.
   */
  const terreDiDueTemi = useMemo(
    () => confrontoFraTemiSulleTerre(pool.carte, tema, temaDeiVincoli),
    [pool, tema, temaDeiVincoli],
  );
  const daTorneo = useMemo(() => {
    if (mazzo.length === 0) return "";
    // Lo stesso budget della schermata del mazzo: è quella che mostra al
    // giocatore le terre che avrà in mano, e il foglio per l'arbitro deve
    // dirne le stesse. Con `null` qui, un mazzo costruito sotto un tetto usciva
    // sul foglio con le terre che il tetto gli aveva **negato**.
    const base = analizzaBaseDiTerre(mazzo, terreDelPool, {
      terreVolute,
      budget: euroPerLeTerre,
    });
    return listaDaTorneo(
      base.righe.map((riga) => ({ nome: riga.carta.nome, copie: riga.copie })),
      base.terre.map((voce) => ({ nome: voce.carta.nome, copie: voce.copie })),
      formato,
    );
  }, [mazzo, terreDelPool, terreVolute, euroPerLeTerre, formato]);

  /**
   * Quel che un gesto ha fatto, e le terre che gli è costato: dette insieme.
   *
   * Ci passano **tutte** le strade che rimettono un mazzo in mano — si importa,
   * si riapre dall'elenco, si salva — e non solo l'importazione: un mazzo
   * arrivato da un amico resta nel deposito con le sue terre dentro, e
   * riaprirlo le riperde uguale; un mazzo montato a mano dal catalogo le perde
   * nell'istante in cui lo si salva. Tacerlo da qualche parte vorrebbe dire
   * avvisare solo nei casi in cui il file è ancora intero.
   *
   * Quale delle due notizie si legga per prima non lo decide questa schermata:
   * lo decide il modello di frase, che è lo stesso per tutti e tre.
   */
  const raccontaLeTerreScartate = (scartate: TerreScartate, annuncio: string | null): void => {
    racconta(fraseConLeTerreScartate({ annuncio, terre: scartate }), null);
  };

  const salva = async () => {
    // L'orologio si legge qui: è adesso che l'utente sta salvando.
    const daSalvare = componi(new Date().toISOString());
    if (daSalvare === null) return;
    const salvato = await salvaMazzo(daSalvare, aperto?.id);
    if (salvato === null) {
      racconta(
        null,
        "Il mazzo non si è potuto salvare: il dispositivo non concede spazio, o il browser " +
          "è in navigazione privata. Esportalo qui sotto e tienilo da parte.",
      );
      return;
    }
    setSalvati(await elencaMazziSalvati());
    // Anche salvare rimette il mazzo in mano, e ci passa dallo stesso posto
    // degli altri due: quel che `apriMazzo` scarta si racconta, non si butta.
    //
    // Oggi non scarta niente, e si può **dimostrare**: le terre in mano non ci
    // entrano da nessuna porta (`entraInMano`, ticket 51), quindi il file che
    // `componi()` ha appena scritto non ne contiene. Il ticket 48 raccontava
    // un'altra storia — quattro terre prese dal catalogo, il file che le tiene
    // e il «Risalva» che le cancella — e quella storia non stava in piedi: il
    // comando delle copie una terra non la aggiunge, e non lo faceva nemmeno
    // allora. Il giro resta perché la regola sia una per tutti e tre e non tre
    // uguali, che è quel che la rende vera anche domani.
    raccontaLeTerreScartate(
      apriMazzo(salvato, false),
      `«${salvato.nome}» è salvato su questo dispositivo.`,
    );
  };

  const cancella = async (salvato: MazzoSalvato) => {
    await dimenticaMazzo(salvato.id);
    // Cancellato il mazzo che si stava guardando, non lo si sta più guardando:
    // senza questo il bottone direbbe ancora «Risalva», e il salvataggio dopo
    // rimetterebbe al mondo, con lo stesso posto, il mazzo appena cancellato.
    if (salvato.id === aperto?.id) chiudiMazzo();
    setSalvati(await elencaMazziSalvati());
    racconta(`«${salvato.nome}» è stato cancellato.`, null);
  };

  const importa = async () => {
    let arrivato: ContenutoMazzo;
    try {
      arrivato = leggiScambio(daImportare);
    } catch (errore) {
      racconta(null, errore instanceof Error ? errore.message : String(errore));
      return;
    }
    const salvato = await salvaMazzo(arrivato);
    if (salvato === null) {
      racconta(
        null,
        "Il mazzo si legge, ma non si è potuto salvare: manca spazio sul dispositivo.",
      );
      return;
    }
    setSalvati(await elencaMazziSalvati());
    setDaImportare("");
    // Il mazzo importato va **in mano**, non solo nell'elenco: altrimenti il
    // bottone «Risalva» punterebbe al mazzo dell'amico mentre in mano c'è il
    // proprio, e il primo salvataggio distruggerebbe quello appena arrivato.
    // Si resta però qui, dove c'è il messaggio da leggere.
    raccontaLeTerreScartate(
      apriMazzo(salvato, false),
      `«${salvato.nome}» è stato importato, ed è il mazzo che hai in mano.`,
    );
  };

  return (
    <div class="salvati">
      <section class="salva-mazzo">
        <h2>Salva questo mazzo</h2>
        {contenuto === null ? (
          <p class="nota">
            Il mazzo è vuoto: aggiungi carte dal catalogo, poi torna qui a dargli un nome.
          </p>
        ) : (
          <>
            <label class="campo-nome">
              <span>Nome del mazzo</span>
              <input
                type="text"
                value={nome}
                maxLength={NOME_MASSIMO}
                placeholder="Come lo chiami?"
                onInput={(evento) => setNome((evento.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <button type="button" class="principale" onClick={() => void salva()}>
              {aperto === null ? "Salva sul dispositivo" : `Risalva «${aperto.nome}»`}
            </button>
            <p class="nota">
              Resta su questo dispositivo e basta: non c&rsquo;è nessun account e nessun server.
              Per darlo a un amico, esportalo qui sotto.
            </p>
          </>
        )}
      </section>

      {guasto !== null ? (
        <p class="avviso-guasto" role="alert">
          {guasto}
        </p>
      ) : null}
      {avviso !== null ? (
        <p class="avviso-fatto" role="status">
          {avviso}
        </p>
      ) : null}

      <section class="elenco-salvati">
        <h2>I mazzi salvati</h2>
        {salvati.length === 0 ? (
          <p class="nota">Non ne hai ancora salvato nessuno.</p>
        ) : (
          <ul>
            {salvati.map((salvato) => (
              <li key={salvato.id} data-aperto={salvato.id === aperto?.id}>
                <button
                  type="button"
                  class="nome-salvato"
                  onClick={() => raccontaLeTerreScartate(apriMazzo(salvato, true), null)}
                >
                  <span class="nome">{salvato.nome}</span>
                  <span class="dettagli">
                    {copieDi(salvato)} carte · salvato il {dataInItaliano(salvato.salvatoIl)}
                  </span>
                </button>
                <button
                  type="button"
                  class="cancella"
                  onClick={() => void cancella(salvato)}
                  aria-label={`Cancella ${salvato.nome}`}
                >
                  Cancella
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {contenuto !== null ? (
        <>
          {/*
            Il tetto vale anche qui — le terre di queste liste sono filtrate
            con la stessa cifra della schermata del mazzo — e qui va detto per
            la stessa ragione (ticket 21): un foglio per l'arbitro con una base
            decisa da un numero che nella pagina non compare è la stessa cifra
            invisibile di prima, spostata di una schermata.
          */}
          {tettoDiSpesa !== null ? (
            <p class="nota vincoli-in-vigore">
              {frasePerIlTettoSuQuelCheEsce({ tetto: tettoDiSpesa, incontabili })}
            </p>
          ) : null}
          {/*
            E lo stesso per il tema (ticket 31), che sulle terre viene **prima**
            del prezzo: un foglio per l'arbitro con una base decisa da un vincolo
            che nella pagina non compare è la stessa cifra invisibile di prima,
            spostata da un filtro all'altro.
          */}
          {terreDiDueTemi.stessaBase ? null : (
            <p class="nota vincoli-in-vigore">{frasePerIlTemaSuQuelCheEsce(terreDiDueTemi)}</p>
          )}
          <Testo
            titolo="Il mazzo da mandare a un amico"
            spiegazione="Contiene la lista e la richiesta che l’ha prodotta: chi lo importa
              ritrova il mazzo com’era."
            testo={scriviScambio(contenuto)}
            nomeFile={`${nomeFile(contenuto.nome)}.txt`}
          />
          <Testo
            titolo="La lista da consegnare all’arbitro"
            spiegazione="Il formato in testa, poi solo copie e nomi in inglese, terre
              comprese, come le vuole una lista da torneo."
            testo={daTorneo}
            nomeFile={`${nomeFile(contenuto.nome)}-torneo.txt`}
          />
        </>
      ) : null}

      <section class="importa">
        <h2>Importa un mazzo</h2>
        <p class="nota">Incolla qui il testo che ti ha mandato un amico.</p>
        <textarea
          rows={6}
          value={daImportare}
          spellcheck={false}
          onInput={(evento) => setDaImportare((evento.currentTarget as HTMLTextAreaElement).value)}
        />
        <button
          type="button"
          class="principale"
          disabled={daImportare.trim() === ""}
          onClick={() => void importa()}
        >
          Importa
        </button>
      </section>
    </div>
  );
}

/** Un testo da copiare o da scaricare: il blocco si ripete due volte, uguale. */
function Testo({
  titolo,
  spiegazione,
  testo,
  nomeFile: nomeDelFile,
}: {
  titolo: string;
  spiegazione: string;
  testo: string;
  nomeFile: string;
}) {
  const [copiato, setCopiato] = useState(false);

  // Cambiato il testo, quel che è negli appunti non è più questo: il bottone
  // deve tornare a dire «Copia», o direbbe una bugia.
  useEffect(() => setCopiato(false), [testo]);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(true);
    } catch {
      // Senza permesso per gli appunti resta il testo, che si seleziona a mano.
      setCopiato(false);
    }
  };

  return (
    <section class="testo-da-portare">
      <h2>{titolo}</h2>
      <p class="nota">{spiegazione}</p>
      <textarea rows={8} readOnly spellcheck={false} value={testo} />
      <div class="bottoni">
        <button type="button" onClick={() => void copia()}>
          {copiato ? "Copiato" : "Copia"}
        </button>
        <button type="button" onClick={() => scarica(testo, nomeDelFile)}>
          Scarica il file
        </button>
      </div>
    </section>
  );
}

function copieDi(mazzo: MazzoSalvato): number {
  return mazzo.carte.reduce((somma, voce) => somma + voce.copie, 0);
}

/** Il nome del mazzo, reso un nome di file che ogni sistema accetta. */
function nomeFile(nome: string): string {
  const pulito = nome
    .normalize("NFD")
    // I segni diacritici staccati dalla NFD: via, che nei nomi di file danno guai.
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  return pulito === "" ? "mazzo" : pulito;
}

/**
 * Il file scaricato.
 *
 * L'indirizzo temporaneo si libera **dopo**, non nello stesso istante: certi
 * browser cominciano lo scaricamento un momento più tardi, e liberarlo subito
 * lascerebbe l'utente senza file e senza spiegazioni.
 */
function scarica(testo: string, nome: string): void {
  const indirizzo = URL.createObjectURL(new Blob([testo], { type: "text/plain;charset=utf-8" }));
  const collegamento = document.createElement("a");
  collegamento.href = indirizzo;
  collegamento.download = nome;
  document.body.append(collegamento);
  collegamento.click();
  collegamento.remove();
  setTimeout(() => URL.revokeObjectURL(indirizzo), 60_000);
}
