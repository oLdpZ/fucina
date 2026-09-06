# ADR-0005 — Da Standard a Old School su stampe italiane

**Stato:** accettata · **Data:** 2026-09-06

## Contesto

Q1 di `PROGETTO.md` dice «Standard, formato unico». Su quella decisione è
costruito tutto: il pool, i filtri, le tarature, le frasi. L'app è finita per due
tappe su sette, è pubblicata, funziona, e la frontiera — il suo fulcro — gira sui
dati veri.

E il **destinatario non gioca in Standard**. Gioca **Old School**: quattro
edizioni del 1994 più Rinascimento, una lista di limitate e bandite decisa dal
suo gruppo, e una regola che nessuno gli ha mai scritto ma che spiega tutto il
resto — si giocano le carte **stampate in italiano**.

Non è una svista scoperta tardi. Q5 dice «strumento per un amico, non un prodotto
commerciale» e Q25 dice «serata al negozio, il meta di riferimento è quello
locale». Il meta locale è il suo gruppo, e il suo gruppo gioca questo. Quel che
mancava non era una decisione: era una domanda.

### I numeri, verificati su Scryfall il 2026-09-06

Stanno qui perché `.scratch/` non è in git e questi numeri devono sopravvivere a
un clone. Chi li rimisura e li trova diversi ha trovato un guasto, non una
sorpresa.

- Il pool è di **786 nomi distinti**. Le cinque edizioni ammesse: `fbb` 306 carte
  italiane, `4ed` italiana 378, `leg` 310, `drk` 119, `rin` 69.
- **Rinascimento aggiunge 26 nomi** che le altre non hanno: 14 da Arabian Nights
  e 12 da Antiquities, fra cui **City of Brass**, **Erhnam Djinn**, **Ashnod's
  Altar** e le tre terre di Urza.
- Il **nome italiano** esiste per tutte e 786. L'**immagine** italiana manca per
  **98** (80 dalla Quarta, 18 da FBB). Il **testo di regole** in italiano **non
  esiste**: è popolato su 7 stampe su 1182.
- Le **bandite sono 7, non 12**: le sei carte con la posta dentro queste edizioni,
  più Falling Star. Rebirth e Tempest Efreet *sono* due delle sei — la formula
  corrente «le carte con la posta più Rebirth e Tempest Efreet» si semplifica.
- Le **limitate sono 18**: le diciassette del gruppo più **Mind Twist**, che manca
  dalla sua lista ed è limitata in ogni regolamento pubblicato (è una delle
  quattro voci da confermare).
- I **prezzi in euro delle stampe italiane non esistono**: zero su tutte e 306 le
  FBB italiane, zero su Leggende, Oscurità e Quarta italiane.
- **122 carte sono in Reserved List**: non saranno mai ristampate e il prezzo non
  scenderà.
- Forma del pool: 348 creature (38 vaniglia pura), 149 incantesimi, 125 artefatti,
  93 istantanei, 63 stregonerie, 37 terre di cui **32 non base**. Curva media
  **2,9**, con **44 carte a costo zero** e una coda di **32 a costo sette o più**.
- Copertura dei **tag funzionali** di Scryfall Tagger: **50,5%** del pool, contro
  il 65-71% dei set recenti. I tag `synergy-*`, quelli su cui la densità di
  sinergia si regge oggi: **8 carte in tutto**.

**Trappole da non ripetere**, costate tempo la prima volta: `o:ante` su Scryfall
pesca 83 carte perché fa match su «ench**ante**d»; i filtri `otag:` e `has:otag`
nella ricerca vengono **ignorati in silenzio** e restituiscono tutto (la pipeline
interroga Tagger direttamente, e va lasciata così); sottrarre insiemi di edizioni
con `-(…)` conta **per stampa** e dà risposte sbagliate.

## Decisione

**Fucina smette di costruire mazzi Standard e costruisce mazzi Old School su
stampe italiane.** Standard esce e non torna: l'app non impara a gestire più di
un formato.

Non cambia il fulcro. Resta il **tasso di cambio** fra **tema** e **potenza**,
reso visibile dalla **frontiera** di mazzi affiancati dal più puro al più forte.
Restano le due sole cuciture di test. Resta il vocabolario di `CONTEXT.md`.

Cambia il gioco sotto:

- il formato diventa un **documento di dati** e non un fatto implicito del
  codice ([ADR-0004](0004-nessuna-verita-di-formato-nel-sorgente.md));
- il pool nasce da un **criterio, non da un elenco**: una carta entra se esiste
  una sua stampa in italiano dentro le edizioni ammesse. Il conto è **per nome**,
  mai per stampa;
- **criterio italiano, dati inglesi**: nome, testo, immagine e prezzo vengono
  dalla stampa inglese ammessa più economica, e il pool conserva **quale**;
- il **tetto di copie è cotto nel pool**, un dato di ogni carta: uno per le
  limitate, nessuno per chi se lo concede nel testo, quattro per tutte le altre.
  Così `costruisciMazzo` continua a non conoscere il formato;
- il **vocabolario delle sinergie si riscrive**, e non si eredita;
- **nessuna costante di taratura sopravvive senza essere rimisurata**, e la
  **sosta e prova reale si rifà da capo** su questo pool — prima di dichiarare
  finito il lavoro, non dopo;
- il **tetto di spesa parte spento**.

## Perché così

**Q5 è la decisione che chiude il discorso.** Un'app con un utente solo, che
costruisce mazzi per un formato che quell'utente non gioca, vale zero per quanto
sia ben fatta. Ogni argomento a favore di tenere lo Standard è un argomento sul
codice già scritto — e il codice non è la cosa di valore. Il ragionamento lo è, e
il ragionamento sopravvive intero: motore, frontiera, punteggio a componenti,
spiegazioni da modelli di frase. Cambia la base su cui poggiano.

**Il pool più piccolo di sei volte non è solo una perdita.** Il primo dei tre
problemi che la specifica elenca è del giocatore, non dell'app: ottocento carte
del 1994, la maggior parte delle quali non ha mai visto giocare. La domanda
smette di essere «quali carte esistono dentro la mia idea» e diventa «quali di
queste ottocento fanno qualcosa». Un'app può conoscere 786 carte meglio di una
persona. Su 4.886 non poteva, e infatti non era quello che prometteva.

**Il criterio italiano è l'unica regola non scritta che andava tradotta in
codice, e per fortuna è verificabile**: la stampa esiste o non esiste. Mostrare
l'inglese non la contraddice — è la separazione fra il **criterio**, che decide
chi entra, e quel che si **mostra**, che decide cosa si legge. Sono due domande
diverse e i dati rispondono bene solo se restano diverse: per le stampe italiane
Cardmarket non ha listini e Scryfall non ha il testo di regole.

**Il vocabolario delle sinergie si riscrive perché ereditarlo sarebbe misurare
niente.** I tag `synergy-*` coprono otto carte: nel 1994 gli archetipi codificati
non esistevano, e un vocabolario scritto sul modo di scrivere le carte di oggi
darebbe una densità di sinergia che non distingue nessun mazzo da nessun altro.
Su 786 carte una passata a mano è un lavoro **finito**, cosa che con le duemila e
settecento dello Standard non era. I tag di Tagger restano materiale grezzo, mai
verità.

**Nessuna taratura sopravvive perché ogni costante è stata scelta guardando lo
Standard**, dove Sol Ring non esiste e le creature costano la metà. Un pool con
44 carte a costo zero, 32 terre non base su 37 e una coda a costo sette non ha la
stessa curva attesa, non ha la stessa densità, non chiude allo stesso turno. Una
costante tenuta senza rimisurarla è un numero che **sembra misurato e non lo è**,
ed è peggio di uno dichiarato provvisorio.

**Il tetto di spesa parte spento** perché il fulcro è un tasso di cambio solo. Se
il budget entra nella stessa frontiera, i due prezzi si confondono e l'app smette
di rispondere alla domanda per cui esiste. Resta acceso dall'utente quando sta
per comprare — che è il momento in cui serve davvero.

## Conseguenze

- Quali delle 32 decisioni decadono e quali reggono con una ragione nuova sta
  scritto in `PROGETTO.md` §7, «Il cambio di formato del 6 settembre 2026».
  `PROGETTO.md` non si riscrive: il ragionamento che ha portato fin qui è la cosa
  di più valore che contiene, e resta leggibile com'era.
- **La sosta del ticket 14 è nulla come misura.** Non era sbagliata: era su un
  altro gioco. Ogni numero verificato sul pool Standard — il costo di una
  valutazione, la lunghezza della frontiera, le densità accalcate sul tetto —
  descrive una cosa che non esiste più.
- **La casella aperta più grossa non si chiude, peggiora.** La potenza è oggi una
  misura da aggro, perché la simulazione goldfish legge di ogni carta quattro
  cose sole e mai il testo. Su un pool dove 32 terre su 37 non sono base e 44
  carte costano zero, i mazzi che quella misura non vede — combo e prigione —
  sono esattamente quelli che il formato produce. Sta scritto qui per essere
  ritrovato, non per essere risolto qui.
- **La Reserved List va detta, non aggirata.** Con un tetto di spesa acceso il
  motore escluderà quasi tutte le 122 carte, e sono le migliori del pool. È la
  realtà del formato.
- I **mazzi salvati** di formato diverso non si distruggono in silenzio: si
  aprono in sola lettura con la loro ragione, e l'importazione di un file di un
  altro formato si rifiuta dicendo perché.
- **Il rischio serio dichiarato in `PROGETTO.md` §4** — che il motore non abbia
  buon gusto — torna al punto di partenza: era stato verificato guardando liste
  Standard, e quelle liste non dicono più niente.

## Si riaprirebbe se

- **Il destinatario cambiasse gruppo o formato.** Un cambio di liste — bandite,
  limitate — lo assorbe il documento di formato senza toccare codice; un cambio
  d'era (aggiungere o togliere un'edizione) costa una riga di dati. Quel che non
  si assorbe è **due formati insieme**: sarebbe una decisione nuova, non
  un'estensione di questa.
- **Il criterio «stampa italiana» si rivelasse sbagliato** — se cioè il gruppo
  intendesse «proprio quelle edizioni e basta». È una delle quattro voci da
  confermare, e si risolve cambiando il documento di formato da regola a elenco:
  una riga di dati, non un ADR.
- **Il destinatario tornasse a giocare Standard.** È l'unica ragione per cui
  questa decisione si ribalterebbe, e vale la pena scriverlo: l'app segue il
  giocatore, non il contrario.
