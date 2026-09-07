import type { Carta, Tag } from "../src/dati/pool.ts";

/**
 * I tag di sinergia: due sorgenti, mai una terza (`PROGETTO.md` Q13).
 *
 * 1. **Regole meccaniche deterministiche**, scritte qui sotto sul testo e sui
 *    tipi della carta. Stessa carta, stesso tag, sempre: sono espressioni
 *    regolari su un testo che nel pool è già fissato, senza orologio, senza
 *    caso e senza rete.
 * 2. **Un file di correzioni a mano**, che il manutentore apre e modifica senza
 *    toccare il codice. Si applica **dopo** le regole e le sovrascrive.
 *
 * Vietato per decisione di progetto: dedurre sinergie dalle decklist vincenti.
 * Riporterebbe al meta, cioè all'opposto dello scopo dell'app.
 *
 * Questo modulo gira solo nella preparazione dati, mai nel browser: l'app i tag
 * li trova già scritti nel pool.
 */

/**
 * Il testo su cui le regole lavorano: quello della carta **senza i promemoria
 * fra parentesi** e senza le tre frasi che dicono il contrario di quel che
 * sembrano dire.
 *
 * Il testo fra parentesi ripete regole del gioco che il giocatore potrebbe non
 * ricordare, e non è quel che la carta fa. Su questo pool ce n'è pochissimo —
 * nel 1994 le parole chiave si stampavano nude, senza promemoria — e proprio
 * per questo le regole qui sotto non possono appoggiarsi al promemoria per
 * capire cosa una parola chiave voglia dire: devono conoscere la parola.
 *
 * Le tre frasi tolte prima di leggere sono negazioni scritte con le stesse
 * parole dell'affermazione, ed è la trappola più frequente di un pool dove
 * quasi ogni meccanica ha la sua carta che la spegne:
 *
 * - «as though they didn't have mountainwalk» — sono i quattro muri di
 *   Rinascimento, che dell'attraversare parlano per **impedirlo**;
 * - «creatures with islandwalk can be blocked…» — la stessa cosa detta dal
 *   verso opposto;
 * - «can't be regenerated» — sta su Wrath of God e su Terror, che rigenerare
 *   non lo fanno affatto.
 */
function testoDelleRegole(carta: Carta): string {
  return carta.testo
    .replace(/\([^)]*\)/g, " ")
    .replace(ANTI_ATTRAVERSAMENTO, " ")
    .replace(COME_SE_NON_AVESSE, " ")
    .replace(NIENTE_RIGENERAZIONE, " ");
}

/** «Creatures with forestwalk can be blocked as though they didn't have forestwalk.» */
const ANTI_ATTRAVERSAMENTO =
  /\bcreatures with (?:forest|island|swamp|mountain|plains)walk can be blocked[^.]*\./gi;

/** «…as though it didn't have defender», «…as though they didn't have flying». */
const COME_SE_NON_AVESSE = /\bas though (?:it|they) (?:didn't|doesn't|don't) have [^.]*/gi;

/** «Destroy all creatures. They can't be regenerated.» */
const NIENTE_RIGENERAZIONE = /\bcan't be regenerated\b/gi;

/**
 * Le clausole che una carta scrive **su se stessa** e che le regole della
 * prigione devono saltare.
 *
 * Su questo pool è un caso frequentissimo: una ventina di creature e artefatti
 * portano «doesn't untap during your untap step» o «can't attack unless
 * defending player controls an Island» come **proprio difetto**, e sono
 * l'opposto di una carta che imbriglia il campo altrui. Mana Vault non è una
 * prigione: è un mostro che paga il proprio costo.
 *
 * Il difetto si scrive anche **appeso a un'altra clausola** — «this creature
 * enters tapped **and** doesn't untap during your untap step», che è Leviathan:
 * la stessa frase detta al rovescio, e per un po' è costata una riga a mano nel
 * file delle correzioni.
 *
 * Quel che il setaccio **non** deve prendere è la stessa frase **fra
 * virgolette**: lì «this creature» non parla di sé, ma del permanente altrui a
 * cui la carta sta regalando il difetto. È quel che fa Glyph of Delusion, e
 * toglierlo la lasciava uscire dal pool con zero tag — cioè invisibile al
 * motore dei temi, che è il modo peggiore di sbagliare un tag.
 */
const SU_SE_STESSO =
  /(?<!["“])\bthis (?:creature|artifact|land|enchantment) (?:enters tapped and )?(?:can't attack|can't block|doesn't untap|attacks each combat if able|blocks each combat if able)[^.]*\./gi;

/**
 * L'aura che si posa su un permanente **proprio**: «Enchant creature you
 * control». Da quella riga in poi ogni «enchanted creature» del testo parla di
 * una carta di chi gioca l'aura, anche dove il «you control» non è ripetuto — e
 * Cocoon, che gira la propria creatura per farla crescere, non è una prigione
 * più di quanto lo sia Mana Vault.
 */
const INCANTA_UN_PROPRIO = /\benchant\b[^.\n]*\byou control\b/i;

/** «Creatures you control can't attack»: il difetto di chi gioca, non altrui. */
const SUI_PROPRI = /\byou control\b/i;

/**
 * Il testo ridotto a quel che la carta fa **al campo altrui**. Solo la regola
 * della prigione legge di qui, ed è la sola che ne ha bisogno.
 *
 * Toglie due cose, per la stessa ragione per cui `rimozione-mirata` non guarda
 * quel che «you control»: una carta che tappa, blocca o non fa stappare i
 * **propri** permanenti non fa a nessuno quel che il tag promette.
 *
 * 1. Le clausole che la carta scrive su se stessa (`SU_SE_STESSO`).
 * 2. Le frasi che nominano i propri permanenti — dicendolo con «you control»,
 *    oppure dicendo «enchanted» quando l'aura si posa su una carta propria.
 *
 * Il taglio è **per frase** e non sul testo intero, com'è già `[^.]*` in
 * `rimozione-mirata`: una carta che tiene fermo il campo altrui in una riga e
 * potenzia il proprio in un'altra resta una prigione. Quel che resta si ricuce
 * con un punto, perché la regola guarda anche quanto lontano stia una parola
 * dall'altra **dentro la stessa frase**.
 */
function soloSulCampoAltrui(testo: string): string {
  const senzaSe = testo.replace(SU_SE_STESSO, " ");
  const proprio = INCANTA_UN_PROPRIO.test(senzaSe);
  return senzaSe
    .split(/[.\n]/)
    .filter((frase) => !SUI_PROPRI.test(frase))
    .filter((frase) => !(proprio && /\benchanted\b/i.test(frase)))
    .join(". ");
}

/**
 * Il bersaglio di una distruzione, guardato da vicino: «target land», «target
 * Mountains», «X target Mountains».
 *
 * Le due parole di margine bastano per «target **basic** land» e per «target
 * creature **or** land», e non arrivano fino a una terra nominata più in là
 * nella frase — che è il punto: Savaen Elves distrugge «target Aura attached to
 * a land», e l'Aura è il bersaglio, non la terra.
 */
const BERSAGLIO_TERRA =
  /\btarget\s+(?:\w+\s+){0,2}?(?:lands?|Forests?|Islands?|Swamps?|Mountains?|Plains)\b/i;

/** Lo stesso sguardo, per il permanente che terra non è. */
const BERSAGLIO_NON_TERRA =
  /\btarget\s+(?:\w+\s+){0,3}?(?:creature|permanent|artifact|enchantment|Aura|Wall)\b/i;

/**
 * I tipi della **faccia giocabile per prima**, che è quella con cui la carta si
 * gioca: sono quelli che dicono cos'è la carta in mano.
 *
 * `carta.tipi` unisce invece i tipi di tutte le facce, perché chi cerca «tutti i
 * Goblin» deve trovare anche chi è Goblin solo sul retro (ticket 02). Le due
 * cose servono a scopi diversi: usare l'unione qui vorrebbe dire trattare come
 * terra un incantesimo che *diventa* una terra girandosi.
 */
function tipiGiocabili(carta: Carta): string[] {
  return carta.facce?.[0]?.tipi ?? carta.tipi;
}

function eUnaTerra(carta: Carta): boolean {
  return tipiGiocabili(carta).includes("Land");
}

/**
 * Le regole, una per tag, lette sul testo inglese delle regole della carta —
 * quello di tutte le facce, perché una carta è anche il suo retro.
 *
 * Sono volutamente letterali: leggono le formule che le carte usano davvero, e
 * quando non sono sicure **non** mettono il tag. Un tag mancante lo aggiunge il
 * manutentore in una riga del file delle correzioni; un tag di troppo, sparso
 * su decine di carte, avvelena il punteggio di sinergia senza farsi vedere.
 *
 * Le formule sono state guardate sul pool vero prima di essere scritte così, e
 * ogni caso che le ha fatte stringere è nel materiale di prova col nome della
 * trappola che rappresenta.
 */
const REGOLE: Record<Tag, (carta: Carta, testo: string) => boolean> = {
  /**
   * Il fulcro rosso e nero del formato: il danno che va **addosso a chi
   * gioca**, non su una creatura. Lightning Bolt, Fireball, Psionic Entity.
   *
   * Il «to» prima del bersaglio non si chiede, perché mezze carte lo scrivono
   * dall'altra parte — «deals X damage to each creature and each player» — e
   * chiederlo lasciava fuori Earthquake, Hurricane e Inferno, che sono tre dei
   * modi in cui questo formato chiude una partita.
   */
  "danno-diretto": (_, testo) =>
    /\bdeals?\b[^.]*\bdamage\b[^.]*\b(?:any target|any number of targets|target player|target opponent|each opponent|each player|that player)\b/i.test(
      testo,
    ),

  /**
   * Togliere di mezzo **un** permanente: distruggerlo, esiliarlo, ucciderlo col
   * danno, ridurgli la costituzione a zero, o portarselo via — Control Magic in
   * questo formato è la rimozione migliore che ci sia, e chiamarla altrimenti
   * sarebbe un cavillo.
   *
   * Tre cose che assomigliano a una rimozione e non lo sono, e per cui la
   * regola guarda dentro la stessa frase prima di dire di sì: la **terra**, che
   * ha un tag suo; il **cimitero** (Tormod's Crypt esilia carte già morte); e
   * quel che colpisce le **proprie** carte, come Safe Haven, che i suoi li mette
   * al sicuro. Rimbalzare invece non è rimuovere, e Boomerang qui non entra: la
   * carta torna in mano e si rigioca.
   *
   * La terra si guarda **sul bersaglio** e non nella frase intera, perché
   * esistono carte che possono colpire l'una o l'altra: Fissure distrugge
   * «target creature or land», e la sola parola *land* in fondo alla frase le
   * toglieva di dosso la rimozione. Quando dopo `target` compare anche un
   * permanente non-terra, la carta è una rimozione e prende il tag — e se la
   * terra la sa colpire lo stesso, quello lo dice `attacca-le-terre`.
   */
  "rimozione-mirata": (_, testo) =>
    (/\b(?:destroy|exile)\b[^.]*\btarget\b(?![^.]*\bgraveyards?\b)(?![^.]*\byou control\b)/i.test(
      testo,
    ) &&
      (!BERSAGLIO_TERRA.test(testo) || BERSAGLIO_NON_TERRA.test(testo))) ||
    /\bdeals?\b[^.]*\bdamage\b[^.]*\bto\s+(?:any target|target[^.]*creature)\b/i.test(testo) ||
    /\b(?:target|enchanted)\s+creature[^.]*\bgets?\s+-\d+\/-[1-9]/i.test(testo) ||
    /\bdestroy (?:that|the other) creature\b/i.test(testo) ||
    /\bgains? control of (?:target|enchanted)\b/i.test(testo) ||
    /\byou control enchanted creature\b/i.test(testo),

  /**
   * Lo spazzino: colpisce una **categoria intera**. Qui ci sono i tre modi in
   * cui questo pool spazza — la distruzione di massa (Wrath of God), il danno a
   * tutti (Inferno, Earthquake) e la costituzione tolta a tutti (Holy Light).
   *
   * Il taglio di forza non basta: «All creatures get -1/-0» è un trucco di
   * combattimento, non uno spazzino, e sono tre carte che senza questo
   * distinguo passavano per Wrath of God.
   */
  "spazza-via": (_, testo) =>
    /\b(?:destroy|exile)\s+(?:all|each)\b(?:[^.]*?)\b(?:creatures?|permanents?|artifacts?|enchantments?|lands?|Forests?|Islands?|Swamps?|Mountains?|Plains)\b/i.test(
      testo,
    ) ||
    /\b(?:all|non\w+) creatures?\b[^.]*\bgets?\s+-\d+\/-[1-9]/i.test(testo) ||
    /\bdeals?\b[^.]*\bdamage\b[^.]*\bto each (?:creature|permanent)\b/i.test(testo) ||
    /\beach (?:player|opponent) sacrifices\b/i.test(testo),

  /**
   * Colpire la **base di mana** dell'avversario: è un archetipo intero di questo
   * formato, e nello Standard non lo era. Armageddon e Stone Rain la
   * distruggono, Blood Moon e Evil Presence la cambiano di tipo, Mana Vortex la
   * fa sacrificare.
   *
   * Il sacrificio conta solo quando a pagarlo è **un giocatore qualunque**: una
   * dozzina di carte del pool si sacrifica una terra da sé come costo — Mold
   * Demon, Wood Elemental, Dark Heart of the Wood — e quello è un prezzo, non
   * un attacco.
   */
  "attacca-le-terre": (_, testo) =>
    /\bdestroy\b[^.]*\b(?:target|all|each|X target)\b[^.]*\b(?:lands?|Forests?|Islands?|Swamps?|Mountains?|Plains)\b/i.test(
      testo,
    ) ||
    /\bdestroy that land\b/i.test(testo) ||
    /\b(?:that player|each player|any player|players?) sacrifices? (?:a|an|one|two|X|\w+) lands?\b/i.test(
      testo,
    ) ||
    /\bplayers can't play lands\b|\blands can't enter\b/i.test(testo) ||
    /\bnonbasic lands are\b/i.test(testo) ||
    /(?:^|[\n.] *)all (?:Forests?|Islands?|Swamps?|Mountains?|Plains) are\b/i.test(testo) ||
    /(?:^|[\n.] *)enchanted land is an? \w+/i.test(testo),

  /**
   * Gli artefatti come materia: distruggerli, rubarli, animarli, contarli.
   *
   * Sta in piedi da sola perché in questo pool gli artefatti sono
   * centoventitré su 778 — un sesto del gioco — e portano il mana veloce, le
   * prigioni e mezze creature. Chi ne fa un mazzo e chi li odia guardano la
   * stessa parola, ed è giusto: sono la stessa sinergia vista dalle due parti.
   */
  "colpisce-gli-artefatti": (_, testo) =>
    /\btarget (?:\w+ )?artifacts?\b/i.test(testo) ||
    /\b(?:all|each) (?:\w+ )?artifacts?\b/i.test(testo) ||
    /\b(?:enchant|enchanted) artifact\b/i.test(testo) ||
    /\bartifacts? (?:you|an opponent|your opponents?) controls?\b/i.test(testo) ||
    /\bnumber of artifacts\b/i.test(testo) ||
    /\bartifact cards?\b/i.test(testo),

  /**
   * Rispondere prima che l'incantesimo risolva. Nel 1994 questi si chiamavano
   * *interrupt* e non avevano una parola chiave: la formula scritta è sempre
   * «counter target spell», o «counter it» dentro un innesco.
   */
  controincantesimo: (_, testo) =>
    /\bcounter target\b/i.test(testo) ||
    /\bcounters? (?:that|the) spell\b/i.test(testo) ||
    /\bcounter it\b/i.test(testo),

  /**
   * Svuotare la mano dell'avversario: Hymn to Tourach, Mind Twist, The Rack.
   * Una parola sola basta, perché in questo pool «discard» non è mai un costo
   * nascosto in un promemoria.
   */
  scarta: (_, testo) => /\bdiscards?\b/i.test(testo),

  /**
   * La prigione: tenere fermo il campo altrui. Winter Orb, Stasis, Icy
   * Manipulator, Moat, The Abyss — è metà di quel che questo formato sa fare, e
   * nello Standard di oggi non esiste quasi più.
   *
   * La regola legge il **campo altrui** e non il testo intero
   * (`soloSulCampoAltrui`): Mana Vault, Colossus of Sardia e le dodici creature
   * che «can't attack unless defending player controls an Island» non
   * imbrigliano nessuno, pagano un prezzo; ed Energy Tap, che gira una creatura
   * «you control» per farne mana, è quello stesso prezzo detto all'incontrario.
   */
  imbriglia: (_, testo) => {
    const altrui = soloSulCampoAltrui(testo);
    return (
      /\btap\b[^.]{0,24}\btarget\b/i.test(altrui) ||
      /\btap all\b/i.test(altrui) ||
      /\b(?:doesn't|don't|can't) untap\b/i.test(altrui) ||
      /\bcan't (?:attack|block|be untapped)\b/i.test(altrui) ||
      /\b(?:attacks?|blocks?) (?:each|this) (?:combat|turn) if able\b/i.test(altrui) ||
      /\bskips? (?:their|his or her) (?:untap|draw) steps?\b/i.test(altrui) ||
      /\bremove it from combat\b/i.test(altrui)
    );
  },

  /**
   * Impedire il danno invece di subirlo: i Circle of Protection, i Ward, Fog,
   * la protezione stampata su una creatura.
   *
   * È una voce che nello Standard non avrebbe meritato un tag e qui ne merita
   * uno: sessantotto carte del pool prevengono danno, ed è la ragione per cui
   * un mazzo bianco di questo formato riesce a non morire al quarto turno.
   */
  "previene-il-danno": (_, testo) =>
    /\bprevent\b[^.]*\bdamage\b/i.test(testo) ||
    /\bprotection from\b/i.test(testo) ||
    /\bdamage that would be dealt\b/i.test(testo),

  /**
   * Rendere una creatura più grossa o più difficile da fermare: Giant Growth,
   * Crusade, le aure che aggiungono forza, i contatori +1/+1.
   *
   * Le parole chiave si leggono **nude**, perché nel 1994 si stampavano così:
   * «Enchanted creature has flying» non ha promemoria, e una regola scritta sul
   * modo di scrivere di oggi qui non vedrebbe niente.
   */
  potenzia: (_, testo) =>
    /\bgets?\s+\+/i.test(testo) ||
    /\+1\/\+1 counter|\+1\/\+0 counter|\+0\/\+1 counter/i.test(testo) ||
    /\b(?:gains?|have|has)\s+(?:flying|first strike|trample|banding|haste|vigilance|forestwalk|islandwalk|swampwalk|mountainwalk|plainswalk|protection from|rampage)/i.test(
      testo,
    ),

  /**
   * Passare oltre i bloccanti. Il volo è la parola più comune del pool, e va
   * riconosciuta **solo quando la carta ce l'ha o la dà**: una ventina di carte
   * il volo lo nominano per punirlo — Hurricane, Earthbind, Gravity Sphere — e
   * con loro dentro il tag avrebbe detto il contrario del vero.
   *
   * Da qui la forma della regola: la parola chiave vale quando sta all'inizio di
   * una riga o dopo una virgola, cioè dove si stampa una parola chiave, oppure
   * dietro un «gains» o un «has». «to target creature with flying» non è
   * nessuna delle due.
   *
   * **L'attraversamento chiede la stessa disciplina**, e per un po' non ce l'ha
   * avuta: cercare `landwalk` dovunque nel testo prendeva anche le terre
   * leggendarie che l'attraversamento lo **tolgono** — «target creature loses
   * all landwalk abilities» — cioè le carte che fanno l'esatto contrario. Non è
   * un difetto cosmetico: dal ticket 08 sono i tag a scegliere quali terre di
   * utilità entrano nel mazzo, e un mazzo di creature che passano si sarebbe
   * preso quattro copie di una terra che serve a fermarle.
   *
   * La parola dell'attraversamento porta però spesso un aggettivo davanti —
   * «legendary landwalk», «nonbasic landwalk» — e per quello l'ancora concede
   * **una** parola prima: quella di Livonya Silone è una parola chiave stampata
   * come le altre, e senza il permesso sarebbe caduta insieme alle vere
   * negazioni.
   */
  evasione: (_, testo) =>
    /(?:^|[\n.,;] *)(?:flying|fear)\b/i.test(testo) ||
    /\b(?:gains?|has|have) (?:flying|fear)\b/i.test(testo) ||
    /\btokens?\b[^.]*\bwith flying\b/i.test(testo) ||
    /\bcan't be blocked\b/i.test(testo) ||
    /\bcan be blocked only\b/i.test(testo) ||
    /(?:^|[\n.,;] *)(?:[a-z]+ )?(?:forest|island|swamp|mountain|plains|land)walk\b/i.test(testo) ||
    /\b(?:gains?|has|have) (?:[a-z]+ )?(?:forest|island|swamp|mountain|plains|land)walk\b/i.test(
      testo,
    ),

  /** «Draw a card», «draw two cards», «target player draws». */
  pesca: (_, testo) => /\bdraws?\b[^.]*\bcards?\b/i.test(testo),

  /**
   * Mana in più, ma **non** dalle terre: una terra il mana lo produce per
   * mestiere, e chiamarla accelerazione vorrebbe dire dare il tag a tutte.
   *
   * Sono i Moxen, Sol Ring, Dark Ritual, Llanowar Elves: su un pool con
   * quarantaquattro carte a costo zero, questo tag è la porta d'ingresso di
   * quasi ogni mazzo veloce.
   */
  "accelerazione-di-mana": (carta, testo) =>
    !eUnaTerra(carta) &&
    (/\badds?\s+\{/i.test(testo) ||
      /\badds?\s+(?:one|two|three|four|X|an additional|an amount)\b/i.test(testo) ||
      /\bsearch your library for a[^.]*\bland card\b[^.]*\bbattlefield\b/i.test(testo)),

  /**
   * Il cimitero come risorsa: pescarci dentro (Regrowth, Raise Dead, Animate
   * Dead), contarne le carte, o riempirlo col macinare.
   *
   * La regola chiede il cimitero come **provenienza** e non come destinazione:
   * «put into a graveyard from the battlefield» è il modo normale di dire «se
   * muore», e col cimitero come risorsa non c'entra niente.
   */
  "si-cura-del-cimitero": (_, testo) =>
    /\bfrom (?:your|a|their|its owner's|target player's) graveyards?\b/i.test(testo) ||
    /\bin (?:your|a|their) graveyards?\b/i.test(testo) ||
    /\byour graveyard (?:into|to)\b/i.test(testo) ||
    /\bexile target player's graveyard\b/i.test(testo) ||
    /\bmills?\b/i.test(testo),

  /**
   * Rigenerare: la parola con cui nel 1994 una creatura sopravvive a quasi
   * tutto. È l'unica risposta che questo pool ha contro Wrath of God e contro
   * il combattimento, e per questo sta fra i quindici invece del guadagno di
   * punti vita, che qui è quasi sempre una carta che nessuno gioca.
   *
   * «can't be regenerated» è già sparito dal testo prima di arrivare qui: è la
   * negazione scritta con le stesse parole, e sta sulle carte che rigenerare
   * non lo fanno per niente.
   */
  rigenera: (_, testo) => /\bregenerates?\b/i.test(testo),
};

/**
 * L'elenco chiuso dei tag, nell'ordine in cui compaiono su ogni carta. È anche
 * il vocabolario che il file delle correzioni accetta: scriverne uno che non è
 * qui dentro è un errore segnalato, non un tag nuovo.
 *
 * Viene dalle chiavi delle regole e non da un secondo elenco scritto a mano:
 * `REGOLE` è indicizzato su `Tag`, quindi il compilatore garantisce che ci
 * siano tutti, e un tag nuovo non può nascere spento per dimenticanza.
 */
export const TAG: readonly Tag[] = Object.keys(REGOLE) as Tag[];

/** I tag che le regole meccaniche danno a una carta, nell'ordine di `TAG`. */
export function tagMeccanici(carta: Carta): Tag[] {
  const testo = testoDelleRegole(carta);
  return TAG.filter((tag) => REGOLE[tag](carta, testo));
}

/**
 * Una riga del file delle correzioni: una carta, i tag da aggiungere e quelli
 * da togliere. La carta è identificata **per nome**, perché è l'unica cosa che
 * il manutentore ha sotto gli occhi.
 */
export type Correzione = {
  nome: string;
  aggiunge: Tag[];
  toglie: Tag[];
};

export type LetturaCorrezioni = {
  correzioni: Correzione[];
  /** Le righe che non si capiscono, dette in italiano e col loro numero. */
  problemi: string[];
};

/**
 * Il file delle correzioni, letto. Una riga per correzione:
 *
 *     # le righe che iniziano con # sono commenti, e servono a dire perché
 *     Jade Monolith: +previene-il-danno, -rimozione-mirata
 *
 * Il formato è questo e non JSON per un motivo solo: il file lo scrive una
 * persona a mano, e una persona ha bisogno di poter scrivere accanto alla
 * correzione il motivo per cui l'ha fatta.
 *
 * Il motivo si può scrivere anche in fondo alla riga, dopo un `#`.
 *
 * Il nome sta prima dell'**ultimo** due punti di quel che resta: esistono carte
 * che i due punti ce l'hanno nel nome, e sarebbe scortese non poterle
 * correggere.
 */
export function leggiCorrezioni(testo: string): LetturaCorrezioni {
  const correzioni: Correzione[] = [];
  const problemi: string[] = [];

  testo.split(/\r?\n/).forEach((riga, indice) => {
    const numero = indice + 1;
    // Il commento in coda si toglie prima di tutto: il file esiste perché una
    // persona possa scrivere accanto alla correzione il motivo per cui l'ha
    // fatta, e un motivo che contiene due punti non deve rovinare il nome.
    const pulita = riga.replace(/#.*$/, "").trim();
    if (pulita === "") return;

    const taglio = pulita.lastIndexOf(":");
    if (taglio === -1) {
      problemi.push(
        `riga ${numero}: «${pulita}» non ha i due punti. ` +
          `Si scrive «Nome della carta: +tag, -altro-tag».`,
      );
      return;
    }

    const nome = pulita.slice(0, taglio).trim();
    const aggiunge: Tag[] = [];
    const toglie: Tag[] = [];
    let sana = nome !== "";

    if (!sana) problemi.push(`riga ${numero}: manca il nome della carta.`);

    const voci = pulita
      .slice(taglio + 1)
      .split(/[,\s]+/)
      .filter((voce) => voce !== "");

    if (voci.length === 0) {
      problemi.push(`riga ${numero}: a «${nome}» non è stato chiesto nessun tag.`);
      sana = false;
    }

    for (const voce of voci) {
      const segno = voce[0];
      const tag = voce.slice(1);
      if (segno !== "+" && segno !== "-") {
        problemi.push(
          `riga ${numero}: «${voce}» non dice se il tag va aggiunto o tolto. ` +
            `Serve un + o un - davanti.`,
        );
        sana = false;
      } else if (!(TAG as readonly string[]).includes(tag)) {
        problemi.push(
          `riga ${numero}: il tag «${tag}» non esiste. Quelli che esistono sono: ` +
            `${TAG.join(", ")}.`,
        );
        sana = false;
      } else if (segno === "+") {
        aggiunge.push(tag as Tag);
      } else {
        toglie.push(tag as Tag);
      }
    }

    for (const tag of aggiunge) {
      if (toglie.includes(tag)) {
        problemi.push(
          `riga ${numero}: il tag «${tag}» è chiesto e tolto nella stessa riga, ` +
            `e non si capisce quale dei due valga.`,
        );
        sana = false;
      }
    }

    // Una riga sbagliata si segnala e si salta intera: applicarla a metà
    // vorrebbe dire fare alla carta qualcosa che nessuno ha chiesto.
    if (sana) correzioni.push({ nome, aggiunge, toglie });
  });

  return { correzioni, problemi };
}

export type EsitoCorrezioni = {
  carte: Carta[];
  /** I nomi corretti che nel pool non esistono: su un pool congelato, nomi storti. */
  orfane: string[];
};

/**
 * Le correzioni applicate al pool, **dopo** le regole meccaniche e sopra di
 * esse. Le carte in ingresso non vengono toccate: ne escono di nuove.
 *
 * Una correzione che non trova la sua carta non viene ignorata: il suo nome
 * esce di qui e finisce a schermo, perché è il modo in cui il manutentore
 * scopre di avere scritto storto un nome — su un pool congelato non c'è altra
 * ragione perché una correzione non trovi la sua carta.
 */
export function applicaCorrezioni(carte: Carta[], correzioni: Correzione[]): EsitoCorrezioni {
  const perNome = new Map<string, Correzione[]>();
  for (const correzione of correzioni) {
    const gruppo = perNome.get(correzione.nome);
    if (gruppo) gruppo.push(correzione);
    else perNome.set(correzione.nome, [correzione]);
  }

  const corrette = carte.map((carta) => {
    const gruppo = perNome.get(carta.nome);
    if (!gruppo) return carta;

    const tag = new Set(carta.tag);
    for (const correzione of gruppo) {
      for (const aggiunto of correzione.aggiunge) tag.add(aggiunto);
      for (const tolto of correzione.toglie) tag.delete(tolto);
    }
    // L'ordine resta quello dichiarato: un tag aggiunto a mano non deve far
    // sembrare diversa una carta che è cambiata solo in quello.
    return { ...carta, tag: TAG.filter((t) => tag.has(t)) };
  });

  const presenti = new Set(carte.map((c) => c.nome));
  const orfane = [...perNome.keys()].filter((nome) => !presenti.has(nome));

  return { carte: corrette, orfane };
}

/**
 * Quel che il manutentore deve leggere a schermo dopo un aggiornamento dati.
 * Vuoto quando non c'è niente da dire, così chi chiama non stampa una riga per
 * dire che va tutto bene.
 */
export function raccontaCorrezioni(esito: { problemi: string[]; orfane: string[] }): string {
  const righe: string[] = [];

  if (esito.problemi.length > 0) {
    righe.push(`Righe non capite nel file delle correzioni (${esito.problemi.length}):`);
    for (const problema of esito.problemi) righe.push(`  ${problema}`);
  }

  if (esito.orfane.length > 0) {
    if (righe.length > 0) righe.push("");
    righe.push(
      `Correzioni a carte che nel pool non ci sono (${esito.orfane.length}) — il pool` +
        ` è congelato, quindi quasi certamente il nome è scritto storto:`,
    );
    for (const nome of esito.orfane) righe.push(`  ${nome}`);
  }

  return righe.join("\n");
}
