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

import { dataInItaliano } from "../dati/carica-pool.js";
import { dimenticaMazzo, elencaMazziSalvati, salvaMazzo } from "../dati/mazzi-salvati.js";
import type { Pool } from "../dati/pool.js";
import { analizzaBaseDiTerre, type CopieDiCarta } from "../mazzo/base-di-terre.js";
import { leggiScambio, listaDaTorneo, scriviScambio } from "../mazzo/scambio.js";
import {
  nomePulito,
  NOME_MASSIMO,
  type ContenutoMazzo,
  type MazzoSalvato,
} from "../mazzo/salvato.js";

/** Il mazzo aperto adesso: il suo posto nel deposito, se ne ha già uno. */
export type MazzoAperto = { id: string; nome: string; salvatoIl: string } | null;

export function MazziSalvati({
  pool,
  mazzo,
  terreVolute,
  aperto,
  apriMazzo,
  chiudiMazzo,
}: {
  pool: Pool;
  mazzo: readonly CopieDiCarta[];
  terreVolute: number | null;
  aperto: MazzoAperto;
  /**
   * Rimettere in mano un mazzo salvato. `vaiAlMazzo` porta anche a vederlo: lo
   * si vuole aprendo dall'elenco, non quando si è appena salvato o importato e
   * c'è un messaggio da leggere su questa schermata.
   */
  apriMazzo: (salvato: MazzoSalvato, vaiAlMazzo: boolean) => void;
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
      richiesta: { origine: "a-mano", terreVolute },
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

  const terreDelPool = useMemo(() => pool.carte.filter((carta) => carta.terra !== null), [pool]);
  const daTorneo = useMemo(() => {
    if (mazzo.length === 0) return "";
    const base = analizzaBaseDiTerre(mazzo, terreDelPool, { terreVolute });
    return listaDaTorneo(
      base.righe.map((riga) => ({ nome: riga.carta.nome, copie: riga.copie })),
      base.terre.map((voce) => ({ nome: voce.carta.nome, copie: voce.copie })),
    );
  }, [mazzo, terreDelPool, terreVolute]);

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
    apriMazzo(salvato, false);
    racconta(`«${salvato.nome}» è salvato su questo dispositivo.`, null);
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
    apriMazzo(salvato, false);
    racconta(`«${salvato.nome}» è stato importato, ed è il mazzo che hai in mano.`, null);
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
                  onClick={() => apriMazzo(salvato, true)}
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
          <Testo
            titolo="Il mazzo da mandare a un amico"
            spiegazione="Contiene la lista e la richiesta che l’ha prodotta: chi lo importa
              ritrova il mazzo com’era."
            testo={scriviScambio(contenuto)}
            nomeFile={`${nomeFile(contenuto.nome)}.txt`}
          />
          <Testo
            titolo="La lista da consegnare all’arbitro"
            spiegazione="Solo copie e nomi in inglese, terre comprese, come le vuole una lista
              da torneo."
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
