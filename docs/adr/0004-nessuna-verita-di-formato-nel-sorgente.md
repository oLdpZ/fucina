# ADR-0004 — Nessuna verità di formato vive nel sorgente

**Stato:** accettata · **Data:** 2026-09-06

## Contesto

Fra i cinque vincoli non negoziabili di `CLAUDE.md` ce n'è uno sulla legalità:

> La legalità delle carte si legge dai dati, mai da date scritte nel codice.

È stato scritto il 2 settembre 2026, quando il formato era lo Standard e la
fonte era Scryfall. La ragione era concreta e sta in `PROGETTO.md` §3: lo
Standard ruota, la prossima rotazione è attesa col primo set del 2027 e
**Wizards non ne ha confermato la data**. Una data nel sorgente sarebbe
invecchiata in silenzio, e l'app avrebbe continuato a proporre carte non più
legali con la faccia di chi ha ragione.

La formulazione porta però dentro un'assunzione non dichiarata: che i dati
stiano **altrove**, e che a tenerli in pari sia qualcun altro.

Il formato Old School del gruppo del destinatario (ADR-0005) non sta altrove.
**Non esiste in nessuna banca dati.** Nessuna riga di Scryfall sa che Blood Moon
è limitata a una copia e che Falling Star è bandita: sono decisioni di un gruppo
di persone che gioca il venerdì. La lettera del vincolo, applicata così com'è,
vieta l'unica cosa che funzionerebbe.

### Perché `legalities.oldschool` di Scryfall non è la risposta

Scryfall ha un campo che sembra fatto apposta, e non lo è. Tre ragioni, in
ordine crescente di gravità.

1. **Descrive le regole svedesi.** Sono un altro formato che porta lo stesso
   nome: lista di bandite e limitate diversa dalla sua. Leggerlo vorrebbe dire
   costruire mazzi legali al tavolo di qualcun altro.
2. **Non sa nulla del tetto di copie che ci serve.** Il campo distingue legale
   da limitata secondo la sua lista, non secondo le diciotto del gruppo.
3. **È per stampa, non per nome** — ed è qui che il campo non sbaglia di poco,
   sbaglia al rovescio. *Maze of Ith* risulta `legal` sulla stampa inglese e
   `not_legal` sulla stampa **italiana della stessa espansione**. In un pool
   costruito sul criterio «la carta esiste in stampa italiana», un campo del
   genere risponde no proprio dove la nostra risposta è sì.

Il caso di Maze of Ith non è una curiosità: è la dimostrazione che il campo
risponde a una domanda diversa dalla nostra. E siccome è un campo che si trova
da solo aprendo i dati, la prima persona che lo troverà sarà tentata di usarlo.

## Decisione

**Il vincolo cambia lettera e non cambia sostanza.** La formulazione nuova è:

> **Nessuna verità di formato vive nel sorgente.** Quali edizioni sono ammesse,
> quali carte sono limitate, quali bandite, e come si chiama il formato: sono
> dati che si aprono, si leggono e si correggono senza toccare una riga di
> codice. Nessuna data, nessun nome di carta, nessun codice di edizione nel
> sorgente.

La fonte diventa un **documento di formato** scritto da noi: un file di dati
versionato, in git, con una data e una fonte in testa e un campo `perché`
accanto a ogni riga. Il codice lo legge come parametro e non ne conosce il
contenuto.

`legalities.oldschool` **non si legge**, e la ragione va scritta nel codice
esattamente dove qualcuno sarebbe tentato di usarlo — col caso di Maze of Ith
per esteso. Una decisione negativa che non sta scritta dove si applica viene
disfatta dal primo che passa.

## Perché così

**La sostanza del vincolo non era «Scryfall è l'autorità».** Era: *nessuno
scriva una verità che invecchia dentro un file sorgente*. Un elenco di carte
sepolto in un `.ts` non lo trova chi gioca e non lo aggiorna chi mantiene; ed è
proprio quel che sarebbe successo scrivendo lì le bandite del gruppo. Questa
metà del vincolo sopravvive intera, e anzi diventa più esigente di prima: prima
riguardava le date, ora riguarda anche i nomi delle carte e i codici delle
edizioni.

**Quel che cambia davvero è che la fonte non è più esterna, ed è una perdita che
va dichiarata.** Una riga di Scryfall è giusta senza che nessuno faccia niente;
il nostro documento è giusto finché qualcuno lo tiene giusto. Tre cose la
contengono:

- le carte del 1994 **non cambiano**. Non c'è rotazione, non c'è annuncio bandi
  trimestrale, non c'è un set nuovo ogni tre mesi. La verità che invecchia è
  quella del gruppo, e cambia quando il gruppo decide;
- la verità che invecchia è **corta**: otto bandite (sette al momento di
  scrivere questa riga, corrette al ticket 04), diciotto limitate, cinque
  edizioni. Chiunque la verifica in dieci secondi, e questo era falso per le
  tredici bandite dello Standard in mezzo a 4.886 carte;
- il documento porta **data e fonte**, così fra un anno si sa a che cosa si
  riferiva.

**Le bandite si scrivono per nome anche dove una regola basterebbe.** Sette
delle otto sono descrivibili — *le carte che menzionano la posta* — ma la regola
vive nel campo `perché` accanto alla riga, non al posto della riga. Otto righe si
verificano a occhio; una regola come fonte banderebbe in silenzio la prima carta
che nomina la posta per un altro motivo. La regola resta utile come
**verifica**: il comando di preparazione può segnalare le carte con quella
meccanica che la lista non nomina. Fonte no, controllo sì.

**Il divieto sulle date resta intero, e qui è più forte che nello Standard.**
Old School non ruota: una data nel sorgente non sarebbe soltanto fragile,
sarebbe finzione pura.

## Conseguenze

- `CLAUDE.md` porta la formulazione nuova e **punta qui** per la motivazione,
  che non si duplica.
- Il ticket 04 scrive il documento di formato. Niente che venga prima può
  nominare una carta, un'edizione o una data: scrivere il documento prima
  dell'ADR che lo autorizza sarebbe la scorciatoia presa di nascosto.
- Il documento di formato è **dato, non prodotto di compilazione**: entra in
  git e si modifica a mano, come `strumenti/correzioni-tag.txt`. `pool.json`
  resta prodotto di compilazione, e non si scrive mai a mano.
- Ne nasce un obbligo nuovo per l'interfaccia: l'app deve saper dire **con quale
  documento di formato** è stata costruita — data e fonte visibili dove si
  leggono le note legali. Chi porta un mazzo al tavolo del venerdì deve poter
  controllare se l'app conosce la lista di oggi. Finora questa domanda non
  esisteva, perché a rispondere era Scryfall.
- L'aggiornamento in sottofondo cambia oggetto e non ragione: scarica il
  documento di formato e i prezzi — le sole cose che invecchiano — e non più le
  carte (ticket 11).
- Il documento porta le quattro voci **da confermare** col destinatario (Mind
  Twist, il criterio, Rinascimento, il nome del formato) marcate come tali. Un
  dato incerto dichiarato incerto è un dato; scritto senza dirlo è un errore che
  aspetta.

## Si riaprirebbe se

- **Il gruppo adottasse le regole svedesi.** Allora `legalities.oldschool`
  tornerebbe leggibile per bandite e limitate — resterebbe per stampa, e il
  criterio del pool resterebbe comunque nostro. Il documento di formato non
  sparirebbe: si accorcerebbe.
- **Nascesse una banca dati pubblica dei formati amatoriali** con dentro le
  liste del gruppo. Non ne esiste nessuna, e non è il genere di cosa che nasce.
- **Se i formati diventassero più d'uno.** Il documento come parametro lo
  reggerebbe, ma è fuori perimetro dichiarato (ADR-0005) e sarebbe una decisione
  nuova, non un'estensione di questa.
