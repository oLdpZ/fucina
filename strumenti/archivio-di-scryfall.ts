/**
 * Quale archivio Scryfall serve, e come si riconosce.
 *
 * È un modulo a parte perché è l'unica cosa di `aggiorna-pool.ts` che si possa
 * mettere alla prova senza scaricare quattrocento megabyte: una funzione pura
 * che guarda un nome di file e ne cava una data — o si ferma.
 *
 * Fermarsi è il punto. La data che esce di qui finisce in `generatoIl`, viene
 * scritta su **ogni** carta come `prezzo.aggiornatoIl`, si mostra all'utente in
 * fondo alla schermata, e decide quale pool vince all'apertura in
 * `src/dati/aggiornamento.ts` — un pool con la data sbagliata può battere
 * quello buono per sempre. Un controllo che si ferma costa una riga di comando
 * da ribattere; uno che passa costa un pool intero (ticket 18).
 *
 * Qui non vive nessuna verità di **formato** — quali edizioni, quali carte,
 * come si chiama il gioco: quella sta nel documento
 * ([ADR-0004](../docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md)).
 * Qui vive solo il nome che Scryfall dà alle proprie cose, che è un fatto
 * della loro API e non del nostro gioco.
 */


/**
 * L'archivio di **tutte** le carte in **tutte le lingue**.
 *
 * Non è quello che bastava allo Standard, ed è cinque volte più pesante. È il
 * prezzo del criterio: una carta è nel formato se ne esiste una stampa in
 * italiano, e l'archivio predefinito — `default-cards` — le stampe non inglesi
 * le tiene solo quando in inglese la carta non esiste affatto, cioè quasi mai,
 * proprio per le carte di cui qui si deve decidere.
 *
 * Il nome vive in un posto solo: da qui esce l'indirizzo da cui si scarica e
 * l'impronta con cui si riconosce il file già sul disco. Sono la stessa
 * decisione, e prenderla due volte è il modo in cui le due si separano.
 */
export const ARCHIVIO = "all-cards";

/** Il descrittore da cui Scryfall dice dov'è l'archivio più fresco. */
export const DESCRITTORE = `https://api.scryfall.com/bulk-data/${ARCHIVIO}`;

/**
 * Il nome che Scryfall dà all'archivio: come si chiama, l'istante in quattordici
 * cifre, e l'estensione. **Ancorato** ai due capi — senza àncore basterebbe una
 * corsa di cifre in un punto qualunque del nome, ed è così che una cartella coi
 * numeri dentro dettava la data dei prezzi.
 */
const IMPRONTA = new RegExp(`^${ARCHIVIO}-(\\d{14})\\.jsonl(?:\\.gz)?$`);

/** La stessa forma, ma col nome lasciato libero: serve solo a dirlo meglio. */
const IMPRONTA_DI_UN_ALTRO = /^(.+)-\d{14}\.jsonl(?:\.gz)?$/;

/**
 * La data dei dati, letta dal nome dell'archivio già sul disco.
 *
 * Non si inventa e non si indovina: il prezzo di ogni carta se la porta dietro,
 * e sbagliarla vorrebbe dire mentire a chi legge un euro. Guarda **solo il nome
 * del file** e non il percorso, perché una cartella chiamata con dei numeri
 * darebbe una data plausibile e falsa.
 *
 * L'ultimo pezzo si taglia su **tutti e due i separatori**, non con `basename`
 * di Node: `basename` sa quelli del sistema su cui gira, e su Linux la barra
 * rovescia non separa niente. Il manutentore scrive percorsi Windows, i test
 * girano anche su Linux, e la guardia deve dire la stessa cosa da tutte e due
 * le parti — altrimenti è verde a casa e rossa in pubblicazione, che è
 * esattamente com'è stata scoperta (ticket 85).
 */
export function dataDellArchivio(percorso: string): string {
  const nome = percorso.replaceAll("\\", "/").split("/").pop() ?? "";
  const impronta = IMPRONTA.exec(nome);

  if (!impronta) {
    const altro = IMPRONTA_DI_UN_ALTRO.exec(nome);
    if (altro) {
      throw new Error(
        `«${nome}» non è l'archivio che serve: è «${altro[1]}», e a noi serve ` +
          `«${ARCHIVIO}». Ogni altro nome è un archivio diverso — quello ` +
          `predefinito, per dire, tiene quasi solo le stampe inglesi, e ne ` +
          `uscirebbe un pool senza italiano di cui nessun resoconto si lamenta. ` +
          `Scaricalo da ${DESCRITTORE}`,
      );
    }
    throw new Error(
      `Dal nome «${nome}» non si legge la data dei dati. Serve il nome che gli dà ` +
        `Scryfall, cioè ${ARCHIVIO}- e quattordici cifre, tipo ` +
        `${ARCHIVIO}-20260906091709.jsonl.gz`,
    );
  }

  // Le quattordici cifre arrivano in un pezzo solo e si tagliano qui. Prenderle
  // come sei gruppi separati costringeva a un cast per convincere il compilatore
  // che ci fossero tutti e sei, e in un file la cui tesi è «non si indovina» un
  // cast è la cosa peggiore da scrivere.
  const cifre = impronta[1] ?? "";
  const anno = cifre.slice(0, 4);
  const mese = cifre.slice(4, 6);
  const giorno = cifre.slice(6, 8);
  const ore = cifre.slice(8, 10);
  const minuti = cifre.slice(10, 12);
  const secondi = cifre.slice(12, 14);
  const istante = `${anno}-${mese}-${giorno}T${ore}:${minuti}:${secondi}.000+00:00`;

  // Quattordici cifre sono quattordici cifre: `20261301250000` ne ha il numero
  // giusto e descrive il primo di tredicembre alle venticinque. Il calendario
  // lo dice solo se glielo si chiede, e `Date.UTC` non protesta: fa scorrere il
  // mese tredici a gennaio dell'anno dopo. Il controllo è il viaggio di
  // ritorno — se quel che ne esce non è quel che c'era scritto, non esisteva.
  const data = new Date(
    Date.UTC(
      Number(anno),
      Number(mese) - 1,
      Number(giorno),
      Number(ore),
      Number(minuti),
      Number(secondi),
    ),
  );
  const tornato =
    data.getUTCFullYear() === Number(anno) &&
    data.getUTCMonth() === Number(mese) - 1 &&
    data.getUTCDate() === Number(giorno) &&
    data.getUTCHours() === Number(ore) &&
    data.getUTCMinutes() === Number(minuti) &&
    data.getUTCSeconds() === Number(secondi);

  if (!tornato) {
    throw new Error(
      `Il nome «${nome}» dice ${istante}, che non è un istante che esiste. ` +
        `Quella data finirebbe sul prezzo di ogni carta: meglio fermarsi qui.`,
    );
  }

  return istante;
}
