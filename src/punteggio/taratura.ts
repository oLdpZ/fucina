/**
 * **Tutti i pesi del punteggio, in un punto solo, e tutti provvisori.**
 *
 * È la richiesta esplicita del ticket 10 e di `spec.md`: alla sosta si guardano
 * le liste che il motore produce sui dati veri e si cambiano questi numeri —
 * solo questi. Nessuno di loro è una legge di Magic: sono il punto di partenza
 * ragionevole da cui misurare, e chi legge il punteggio deve poterli trovare
 * senza cercarli nel codice.
 *
 * Un vincolo che vale per tutti: **niente popolarità, niente prezzo, niente
 * peso appreso da dati esterni** (`CLAUDE.md`, Q13, Q16). Ogni numero qui sotto
 * è una scelta dichiarata di chi scrive, non una statistica ricavata da mazzi
 * altrui.
 */

import type { Tag } from "../dati/pool.js";

/* ------------------------------------------------------------------------- *
 * Come pesano le cinque componenti l'una rispetto all'altra
 * ------------------------------------------------------------------------- */

/**
 * I pesi con cui le cinque componenti si combinano quando serve **un numero
 * solo** — la ricerca a scambi singoli del ticket 11.
 *
 * Le componenti restano comunque separate nella risposta: questa combinazione
 * è un servizio per chi deve ordinare due mazzi, non il punteggio.
 *
 * Sommano a uno perché così il totale sta anche lui fra zero e uno, e due
 * mazzi si confrontano a occhio senza sapere quanti pesi ci sono dietro.
 */
export const PESI_DELLE_COMPONENTI = {
  velocita: 0.3,
  curva: 0.15,
  colori: 0.2,
  sinergia: 0.15,
  qualita: 0.2,
} as const;

/* ------------------------------------------------------------------------- *
 * La corsa contro gli orologi dell'avversario
 * ------------------------------------------------------------------------- */

/**
 * Quanto pesa la **sesta** componente, quando c'è.
 *
 * Sta fuori da `PESI_DELLE_COMPONENTI` perché la corsa non c'è sempre: senza
 * orologi dichiarati non esiste, e le altre cinque tornano a sommare a uno da
 * sole. È `combina` a rinormalizzare, e l'effetto è quello che serve — chi non
 * dichiara nessun orologio ottiene esattamente la classifica di prima.
 *
 * Il valore è alto quanto la velocità perché la corsa è la domanda che l'utente
 * ha fatto per prima — *batto il mazzo che incontro?* — e non un contorno. È
 * provvisorio come tutti gli altri: alla sosta si guarda se sposta davvero la
 * classifica dei mazzi, e se non la sposta scende o sparisce.
 */
export const PESO_DELLA_CORSA = 0.3;

/**
 * Le copie non-terra di un mazzo tipico: il metro su cui si legge quante copie
 * l'avversario dedica a una cosa sola.
 *
 * Serve perché dell'avversario si sanno **tre numeri** e nient'altro: quanto sia
 * grande la sua metà non-terra l'app non lo sa, e otto rimozioni si devono pur
 * confrontare con qualcosa. Ventiquattro è sessanta meno una base di terre
 * ordinaria, arrotondato: da ritarare guardando i mazzi veri.
 */
export const COPIE_NON_TERRA_DI_RIFERIMENTO = 24;

/**
 * Quanti turni mi costano le sue rimozioni, quando ne porta tante e io do
 * bersagli a tutte.
 *
 * Il numero è a occhio, come dev'essere: nessuno ha misurato quanto valga un
 * Terminate contro un mazzo di creature, perché misurarlo vorrebbe dire far
 * giocare la partita. Due turni è la scommessa di partenza.
 *
 * **Messo a zero, le rimozioni smettono di contare.** È la via per cui ADR-0002
 * chiede di aggiungere i tre numeri dell'orologio uno alla volta: alla sosta si
 * azzera, si guarda se la classifica dei mazzi cambia, e se non cambia il
 * numero si toglie dall'orologio invece di restare lì a fare volume.
 */
export const TURNI_PERSI_PER_RIMOZIONI = 2;

/**
 * Quanti turni mi costano le sue contromagie. Vedi `TURNI_PERSI_PER_RIMOZIONI`:
 * stessa scommessa, stessa disciplina, e la stessa via per toglierle.
 *
 * È più basso perché le contromagie mordono **tutti** — non chiedono bersagli —
 * e un peso pieno le farebbe pesare due volte.
 */
export const TURNI_PERSI_PER_CONTROMAGIE = 1.5;

/* ------------------------------------------------------------------------- *
 * Velocità e affidabilità
 * ------------------------------------------------------------------------- */

/**
 * I due turni fra cui si stende il voto sulla chiusura: chiudere entro il
 * turno «ottimo» vale uno, chiudere al turno «pessimo» o non chiudere vale
 * zero, in mezzo si interpola diritto.
 *
 * Quattro e dodici sono a occhio: quattro è il turno in cui chiude un aggro
 * che ha rubato la partita, dodici è il turno oltre il quale in un negozio si
 * va a orologio. Da ritarare guardando i turni veri che la simulazione tira
 * fuori sui mazzi veri.
 */
export const TURNO_DI_CHIUSURA_OTTIMO = 4;
export const TURNO_DI_CHIUSURA_PESSIMO = 12;

/**
 * Come si dividono, dentro la componente, la velocità e l'affidabilità.
 *
 * `chiusura` è quanto presto e quanto spesso il mazzo vince; `mani` è la quota
 * di prime mani tenibili; `partenza` è il non partire impiantati. Le ultime due
 * insieme pesano quanto la prima: un mazzo velocissimo che rimescola una volta
 * su tre non è un mazzo veloce, è un mazzo che a volte non gioca.
 */
export const PESI_DELLA_VELOCITA = {
  chiusura: 0.5,
  mani: 0.25,
  partenza: 0.25,
} as const;

/* ------------------------------------------------------------------------- *
 * Forma della curva
 * ------------------------------------------------------------------------- */

/**
 * Le due forme di curva attese, in caselle di costo: 1 o meno, 2, 3, 4, 5,
 * 6 o più. Sono **quote**, e sommano a uno ciascuna.
 *
 * Non esiste una curva giusta in assoluto: esiste la curva giusta **per la
 * velocità di quel mazzo**, ed è per questo che le forme sono due e il mazzo
 * si colloca fra l'una e l'altra secondo il turno in cui chiude davvero
 * (ticket 10). Un mazzo che vince al quarto turno con sei carte da sei mana ha
 * vinto nonostante la curva, non grazie a lei.
 */
export const CURVA_ATTESA_VELOCE: readonly number[] = [0.3, 0.32, 0.2, 0.1, 0.05, 0.03];
export const CURVA_ATTESA_LENTA: readonly number[] = [0.1, 0.2, 0.22, 0.2, 0.16, 0.12];

/**
 * I due turni fra cui si passa da una forma attesa all'altra: un mazzo che
 * chiude entro il quarto turno è veloce e si confronta con la curva veloce, uno
 * che chiude al decimo o non chiude si confronta con quella lenta.
 */
export const TURNO_MAZZO_VELOCE = 4;
export const TURNO_MAZZO_LENTO = 10;

/* ------------------------------------------------------------------------- *
 * Densità di sinergia
 * ------------------------------------------------------------------------- */

/**
 * Le coppie di tag che **si attivano a vicenda**: due carte che le portano
 * fanno insieme più di quanto farebbero separate.
 *
 * L'elenco è corto di proposito, come le regole dei tag: preferisce tacere che
 * sbagliare (`HANDOFF.md`). È stato **riscritto** col vocabolario nuovo del 6
 * settembre 2026: le coppie dello Standard parlavano di pedine e sacrifici, che
 * su questo pool sono nove carte in tutto.
 *
 * Le coppie sono **non ordinate**: l'ordine in cui si scrivono non conta.
 */
export const COPPIE_CHE_SI_ATTIVANO: readonly (readonly [Tag, Tag])[] = [
  // L'aggressione del formato: un corpo che passa e qualcosa che lo ingrossa.
  ["potenzia", "evasione"],
  // E quando il corpo non basta, il danno che chiude la partita dalla mano.
  ["evasione", "danno-diretto"],
  // Il controllo: annullare quel che si può, pescare per averne ancora.
  ["controincantesimo", "pesca"],
  // La prigione: fermare il campo e togliere le terre con cui si scioglierebbe.
  ["imbriglia", "attacca-le-terre"],
  // Il mana veloce serve a lanciare prima quel che chiude, e qui chiude il danno.
  ["accelerazione-di-mana", "danno-diretto"],
  // Gli artefatti sono il mana veloce di questo formato: chi li usa e chi li
  // muove guardano la stessa metà del pool.
  ["accelerazione-di-mana", "colpisce-gli-artefatti"],
  // Svuotare la mano avversaria e ripescarsi la propria dal cimitero.
  ["scarta", "si-cura-del-cimitero"],
  // Rigenerare è la risposta allo spazzino: i propri restano, gli altri no.
  ["spazza-via", "rigenera"],
];

/**
 * La densità di sinergia oltre la quale la componente vale uno.
 *
 * La densità è la quota di coppie di copie non-terra che si attivano a
 * vicenda, e non arriva mai vicino a uno nemmeno in un mazzo costruito
 * apposta. Questo numero è il punto in cui si dice «basta così»: sopra,
 * aggiungere sinergia non è più il problema del mazzo.
 *
 * **Misurato sul pool vero il 13 settembre 2026** (ticket 15), ed era il primo
 * indiziato per sua stessa ammissione. Valeva `0,15`, e a quel valore la
 * componente era **morta**: su trentotto mazzi misurati — gli otto temi della
 * galleria più i sei casi limite — trentasei valevano esattamente `1,000`. Il
 * quindici per cento del punteggio era una costante additiva, uguale per ogni
 * mazzo, che non distingueva niente da niente.
 *
 * Le densità vere si dividono in due gobbe: trentatré mazzi fra **0,147 e
 * 0,20** (mediana 0,164) e cinque fra **0,31 e 0,80**, che sono i temi così
 * stretti da ripetere le stesse poche carte. La soglia vecchia cadeva sotto il
 * fondo della prima gobba — di lì il tetto per tutti.
 *
 * **0,30** sta nella valle fra le due, ed è dove il numero è stato messo. Ha
 * migliorato le cose e **non le ha sistemate**, e la seconda misura — lo stesso
 * banco, rifatto sul punteggio nuovo — dice perché, meglio di quanto sapesse
 * chi ha scelto il numero:
 *
 * | | soglia 0,15 | soglia 0,30 |
 * | --- | --- | --- |
 * | mazzi al tetto | 36 su 38 | 17 su 31 |
 * | densità mediana | 0,164 | **0,300** |
 * | densità dal p25 al p75 | 0,155 → 0,201 | **0,293 → 0,314** |
 *
 * La mediana è atterrata **esattamente sulla soglia**, e il quartile centrale
 * si è stretto attorno a lei. Non è una coincidenza ed è la cosa da capire:
 * `densità / soglia` tagliato a uno è una funzione che **satura**, la ricerca
 * spinge la densità fino al punto in cui smette di essere premiata e lì si
 * ferma. La soglia non misura i mazzi, **li attira**. Alzarla da 0,15 a 0,30 ha
 * spostato il mucchio da «tutti sopra» a «tutti sul bordo», che è meno peggio —
 * il fondo della scala ora si vede, il valore minimo è 0,475 — ma è lo stesso
 * difetto in un altro punto.
 *
 * **Quindi il numero resta provvisorio, e il difetto non è nel numero**: è nella
 * forma. Una funzione che sale sempre, piano, senza un tetto da raggiungere,
 * non avrebbe un punto in cui accatastarsi. Vedi il ticket 72.
 */
export const DENSITA_DI_SINERGIA_PIENA = 0.3;

/* ------------------------------------------------------------------------- *
 * Qualità delle singole carte
 * ------------------------------------------------------------------------- */

/**
 * Il costo che si somma al valore di mana per misurare l'efficienza di una
 * creatura: `(forza + costituzione) / (valore di mana + questo)`.
 *
 * Serve perché una carta costa anche **se stessa** — la si è pescata invece di
 * pescarne un'altra — e senza di lui una creatura da zero mana avrebbe
 * efficienza infinita.
 */
export const COSTO_DI_BASE_DI_UNA_CARTA = 1;

/**
 * L'efficienza a cui una creatura vale un corpo pieno. Due è la creatura da due
 * mana 3/3: `(3 + 3) / (2 + 1)`. Sopra non si guadagna altro, perché oltre
 * quella soglia il problema del mazzo non è più il corpo.
 */
export const EFFICIENZA_ATTESA = 2;

/**
 * I tre mestieri che una carta può fare, e quanto vale ciascuno.
 *
 * Si **sommano**, perché una carta che ne fa due vale più di una che ne fa uno,
 * e il totale resta tagliato a uno: una creatura efficiente che pesca entrando
 * e toglie di mezzo qualcosa è una bomba, e le bombe stanno al tetto.
 *
 * Nessuno dei tre arriva da solo al tetto, ed è voluto: se il corpo ci
 * arrivasse, ogni creatura da un 3/3 in su si mangerebbe il bonus contro il
 * tetto e una creatura che pesca varrebbe quanto la stessa creatura muta.
 *
 * Una **risposta** non ha forza né costituzione, ma toglie di mezzo la carta
 * dell'avversario: vale quasi quanto un corpo pieno. Se però colpisce solo
 * certi bersagli, in partita a volte non colpisce niente.
 *
 * Risposta e non «rimozione»: dal 14 settembre 2026 (ticket 73) questo peso lo
 * prendono **due** tag e non uno — la rimozione mirata toglie di mezzo quel che
 * è già in campo, il controincantesimo lo ferma prima che ci arrivi. Sono lo
 * stesso mestiere fatto in due momenti, e valgono lo stesso peso: una carta che
 * li sa fare tutt'e due vale per il **migliore** dei due e non per la somma,
 * perché le due metà sono la stessa carta giocata in due modi e si sceglie.
 * Stanno scritti in `MODI_DI_RISPONDERE`, qui sotto.
 *
 * Il terzo tag che risponde — lo spazzino — **non** prende questo peso e resta
 * dov'era, nel vantaggio in carte: quel che lui porta è di prendere più carte
 * con una sola, ed è esattamente quel che la sua condizione gli toglie. Vedi
 * `MODI_DI_VANTAGGIO`.
 */
export const VALORE_DEL_CORPO = 0.6;
export const VALORE_DELLA_RISPOSTA = 0.5;

/**
 * Quanto resta a una rimozione che colpisce solo certi bersagli.
 *
 * **Misurata sul pool del 2026-09-14** (ticket 74), con la regola delle altre
 * due: quante carte colpisce davvero, contro quante ne colpirebbe senza la sua
 * condizione — le 335 creature per chi bersaglia creature, i 570 permanenti
 * non-terra per chi bersaglia permanenti. Il colore è quello **stampato**, che è
 * quello che una rimozione nomina: «destroy target black creature» non tocca la
 * creatura verde che si attiva pagando nero.
 *
 * | condizione | quante ne colpisce | quota |
 * | --- | --- | --- |
 * | una creatura che non è un artefatto | 306 su 335 | 0,913 |
 * | una creatura che non è nera | 252 su 335 | 0,752 |
 * | una creatura di un colore | 62–87 su 335 | 0,185–0,260 |
 * | un permanente di un colore | 97–111 su 570 | 0,170–0,195 |
 * | una creatura che vola | 50 su 335 | 0,149 |
 * | un Muro | 24 su 335 | 0,072 |
 *
 * La **mediana** è 0,192, e di lì il numero — lo stesso della contromagia, e
 * arrotondato come gli altri due, perché la terza cifra direbbe una precisione
 * che questa misura non ha. Non la media (0,313), che le due condizioni **al
 * negativo** tirano su da sole: chi lascia fuori una categoria copre quasi tutto
 * per costruzione, e pesarle come un terzo del conto direbbe di ogni rimozione
 * quel che vale solo per loro.
 *
 * Due condizioni si misurano ma **non fanno mediana**, e il banco lo stampa
 * accanto: «non è un Muro» (0,928) e «di costituzione 3 o meno» (0,645). La
 * frase c'è, ma nel pool nessuna carta la porta da sola — chi la pone la pone in
 * combattimento, o su una creatura propria. Contarle direbbe della rimozione
 * quel che varrebbe per una rimozione che il pool non ha, e sono le due righe
 * più alte del campione. Fuori misura per la stessa ragione, e da sempre, le
 * condizioni che non stanno nella carta ma nel turno: chi attacca, chi blocca,
 * chi è TAPpato.
 *
 * Il numero di prima era **0,6**, e non veniva da nessuna misura: era scelto, da
 * prima che il pool fosse questo. La misura ne lascia in piedi un terzo, e
 * sposta ogni rimozione del pool — il tag più numeroso che ci sia. Quel che il
 * taglio **non** butta via sta scritto in `CONDIZIONI_DELLA_RIMOZIONE`: la
 * rimozione migliore del formato è un'aura, e la sua frase è stata tolta
 * dall'elenco apposta perché non la prendesse.
 */
export const QUOTA_DELLA_RIMOZIONE_CONDIZIONALE = 0.2;

/**
 * Le frasi che rendono **condizionale** una rimozione, lette dal testo inglese
 * della carta come tutto il resto (`CLAUDE.md`: mai un elenco di nomi di carta,
 * che ruotano; le frasi delle regole no).
 *
 * L'elenco è provvisorio e va allungato alla sosta guardando le rimozioni vere
 * del pool: qui sta la stessa scelta dei tag — meglio dire «incondizionata» a
 * una rimozione che non lo è del tutto, che inventare condizioni che non ci
 * sono.
 *
 * Riscritto col pool del 6 settembre 2026: qui le rimozioni si condizionano
 * quasi tutte sul **colore** («target black creature», «target blue
 * permanent») o sul muro, che sono i due modi in cui il 1994 scriveva «non
 * tutto». Ogni frase qui sotto è stata contata sulle rimozioni vere del pool, e
 * quelle che non toccavano nemmeno una carta — «that entered», «with mana
 * value», «target white», «target green» — sono state tolte invece di restare a
 * far numero.
 *
 * Due frasi sono state **aggiunte** il 14 settembre 2026 (ticket 74), e non per
 * gusto: abbassando la quota da 0,6 a 0,2 ogni frase che manca all'elenco costa
 * il doppio di prima. «attacking» e «blocking» prendono chi bersaglia *target
 * attacking creature*, ma non chi la stessa cosa la scrive come innesco —
 * «whenever this creature blocks or becomes blocked by…», «whenever this
 * creature attacks and isn't blocked». Sono la stessa condizione scritta
 * nell'altro modo, e senza queste due frasi due carte meccanicamente identiche a
 * quelle già scontate valevano quattro volte tanto.
 *
 * Fra le tolte c'è anche «enchanted creature», che pure di carte ne toccava
 * cinque: ci sarebbe finita dentro **Control Magic**, che in questo formato è
 * la rimozione migliore che ci sia. Un'aura si può disincantare, e in quel senso
 * è condizionale; ma chiamare mezza rimozione la carta che ruba il drago è un
 * errore più grosso di quello che si voleva evitare.
 */
export const CONDIZIONI_DELLA_RIMOZIONE: readonly string[] = [
  "target blue",
  "target black",
  "target red",
  "nonartifact",
  "nonblack",
  "with toughness",
  "with flying",
  "attacking",
  "blocking",
  "becomes blocked by",
  "isn't blocked",
  "tapped creature",
  "non-wall",
  "target wall",
];

/* --- Le contromagie e gli spazzini, alle loro condizioni ------------------ */

/**
 * Le frasi che rendono **condizionale** una contromagia, lette dal testo
 * inglese come quelle della rimozione.
 *
 * **Misurate sul pool del 2026-09-14** (ticket 73), con la stessa regola di
 * `CONDIZIONI_DELLA_RIMOZIONE`: ogni frase qui sotto porta dentro almeno una
 * carta che senza di lei passerebbe per incondizionata, e quelle che non ne
 * portavano nessuna — «target white spell» fra loro — sono state tolte invece
 * di restare a far numero.
 *
 * L'ultima frase è la più stretta di tutte e vale una carta sola: c'è chi
 * annulla **se stesso** e nient'altro. Senza di lei passava per contromagia
 * piena, e in un mazzo ce ne finivano quattro copie.
 *
 * Restano incondizionate, e sono sei, le contromagie che annullano
 * **qualunque** cosa: quelle secche e quelle che chiedono un pedaggio. Il
 * pedaggio non è una condizione — la carta arriva su tutto, e tardi arriva su
 * niente — ed è la stessa scelta di sempre: meglio dire «incondizionata» a una
 * che non lo è del tutto, che inventare condizioni che non ci sono.
 */
export const CONDIZIONI_DEL_CONTROINCANTESIMO: readonly string[] = [
  "creature spell",
  "instant spell",
  "instant or aura spell",
  "enchantment spell",
  "target blue spell",
  "target red spell",
  "target black spell",
  "target green spell",
  "activated ability",
  "destroy a land you control",
  "when you cast this spell, counter it",
];

/**
 * Quanto resta a una contromagia che annulla **una cosa sola**.
 *
 * **Misurata sul pool del 2026-09-14**, 720 carte non-terra (ticket 73). La
 * misura è quante di quelle carte la contromagia annulla davvero, contro le 720
 * che «Counter target spell» annulla tutte:
 *
 * | condizione | quante ne annulla | quota |
 * | --- | --- | --- |
 * | una magia creatura | 335 | 0,465 |
 * | un istantaneo o un'aura che bersaglia roba tua | 164 | 0,228 |
 * | un incantesimo | 147 | 0,204 |
 * | una magia di un colore solo | 134–137 | 0,186–0,190 |
 * | un istantaneo | 93 | 0,129 |
 * | una magia che distrugge una tua terra | 22 | 0,031 |
 * | un'abilità attivata di un artefatto | 0 | 0,000 |
 * | se stessa, e nient'altro | 0 | 0,000 |
 *
 * La **mediana** è 0,188, e di lì il numero. Non la media (0,165): una sola
 * condizione — la magia creatura — copre il doppio di tutte le altre, e una
 * media tirata da lei direbbe di ognuna quel che vale solo per quella.
 *
 * Il numero è basso, e va detto che cosa **non** butta via. Una carta che
 * annulla il blu e in più distrugge un permanente blu è anche una rimozione, e
 * vale per il mestiere migliore dei due: la quota qui sotto non la tocca, la
 * sconta la rimozione alla sua. È la cautela che il ticket 73 chiedeva per
 * nome, e regge perché la risposta si prende al massimo e non a somma.
 */
export const QUOTA_DEL_CONTROINCANTESIMO_CONDIZIONALE = 0.2;

/**
 * Le frasi che rendono **condizionale** uno spazzino: prende una categoria
 * sola, o una parte del campo, o roba propria.
 *
 * **Misurate sul pool del 2026-09-14** (ticket 73) con la regola di sempre. Due
 * cose vanno dette perché non si riscoprano:
 *
 * - «destroy all artifacts.» porta il punto per forza. Senza, la frase prende
 *   anche lo spazzino che distrugge artefatti, creature e incantesimi insieme,
 *   che è il contrario di condizionale — il punto distingue chi si ferma lì da
 *   chi tira il respiro e continua.
 * - «without flying» e «with flying» sono state **provate e tolte**. Toccavano
 *   le due magie che fanno danno a ogni creatura e a ogni giocatore, che in
 *   questo formato sono fra le più forti che esistano e chiudono anche la
 *   partita. È la stessa scelta fatta per «enchanted creature» in
 *   `CONDIZIONI_DELLA_RIMOZIONE`: chiamare mezzo spazzino la carta che vince la
 *   partita sarebbe un errore più grosso di quello che si voleva evitare.
 *
 * Restano incondizionati, e sono otto, gli spazzini che puliscono il tavolo:
 * quelli che distruggono ogni creatura, ogni terra o ogni permanente, e quelli
 * che fanno danno a tutto il campo.
 */
export const CONDIZIONI_DELLO_SPAZZA_VIA: readonly string[] = [
  "all black creatures",
  "all white creatures",
  "nonblack creatures",
  "nonwhite creatures",
  "all enchantments",
  "destroy all artifacts.",
  "all goblins",
  "all forests",
  "all plains",
  "all islands",
  "target mountains",
  "that didn't attack",
  "were blocked by",
];

/**
 * Quanto resta a uno spazzino che prende **una categoria sola**.
 *
 * **Misurata sul pool del 2026-09-14** (ticket 73), come quella delle
 * contromagie: quante carte prende davvero, contro quelle che prenderebbe lo
 * spazzino senza la sua condizione — le 335 creature per chi spazza creature,
 * i 570 permanenti non-terra per chi spazza permanenti.
 *
 * | condizione | quante ne prende | quota |
 * | --- | --- | --- |
 * | le creature che non sono bianche | 275 su 335 | 0,821 |
 * | le creature che non sono nere | 252 su 335 | 0,752 |
 * | le creature di un colore | 60–83 su 335 | 0,179–0,248 |
 * | gli incantesimi | 147 su 570 | 0,258 |
 * | gli artefatti | 117 su 570 | 0,205 |
 * | una razza sola | 10 su 335 | 0,030 |
 *
 * Mediana 0,248, e di lì il numero. La media sarebbe 0,356, tirata su dalle due
 * condizioni al negativo che lasciano fuori un colore solo: sono due carte, e
 * pesarle come metà del conto direbbe degli altri quel che vale solo per loro.
 *
 * Fuori misura restano le condizioni che il pool non sa esprimere: chi spazza
 * un tipo di terra, e chi prende la parte di campo che non ha attaccato o che
 * è stata bloccata. Contano come condizionali — perché lo sono — ma la loro
 * quota non è stata misurata, e non fa media.
 */
export const QUOTA_DELLO_SPAZZA_VIA_CONDIZIONALE = 0.25;

/* ------------------------------------------------------------------------- *
 * Vantaggio in carte
 * ------------------------------------------------------------------------- */

/**
 * Quanto vale, in più, una carta che porta vantaggio in carte — pesca, oppure
 * spazza via il campo prendendo più carte con una.
 */
export const VALORE_DEL_VANTAGGIO_CARTE = 0.25;

/* ------------------------------------------------------------------------- *
 * Chi fa che mestiere, e a quali condizioni smette di farlo per intero
 * ------------------------------------------------------------------------- */

/**
 * Un mestiere che un tag fa, con l'elenco di frasi che lo condizionano e quel
 * che ne resta quando una di quelle frasi c'è.
 *
 * L'elenco vuoto vuol dire **senza condizioni possibili**: quel tag vale sempre
 * uno, e lo dice invece di lasciarlo dedurre. La quota accanto a un elenco
 * vuoto non si legge mai, e per questo si scrive uno.
 */
export type ModoDiUnTag = {
  tag: Tag;
  condizioni: readonly string[];
  quota: number;
};

/**
 * I tag che **rispondono** alla carta dell'avversario, e a che condizioni.
 *
 * Sta qui e non nel motore per la ragione di tutto questo file: chi aggiunge un
 * tag a questa tabella deve dire nello stesso momento da quali frasi si fa
 * condizionare e quanto gliene resta. Un tag aggiunto altrove, senza queste due
 * colonne, varrebbe uno in silenzio — che è il modo in cui uno sconto misurato
 * si perde senza che nessuno se ne accorga.
 */
export const MODI_DI_RISPONDERE: readonly ModoDiUnTag[] = [
  {
    tag: "rimozione-mirata",
    condizioni: CONDIZIONI_DELLA_RIMOZIONE,
    quota: QUOTA_DELLA_RIMOZIONE_CONDIZIONALE,
  },
  {
    tag: "controincantesimo",
    condizioni: CONDIZIONI_DEL_CONTROINCANTESIMO,
    quota: QUOTA_DEL_CONTROINCANTESIMO_CONDIZIONALE,
  },
];

/**
 * I tag che valgono come **vantaggio in carte**, e a che condizioni.
 *
 * `pesca` non si condiziona: chi rimette carte in mano lo fa e basta. Lo
 * spazzino sì, e alla quota misurata sul pool vero — quel che porta è prendere
 * più carte con una sola, e prenderne una categoria sola è meno di quello.
 */
export const MODI_DI_VANTAGGIO: readonly ModoDiUnTag[] = [
  { tag: "pesca", condizioni: [], quota: 1 },
  {
    tag: "spazza-via",
    condizioni: CONDIZIONI_DELLO_SPAZZA_VIA,
    quota: QUOTA_DELLO_SPAZZA_VIA_CONDIZIONALE,
  },
];
