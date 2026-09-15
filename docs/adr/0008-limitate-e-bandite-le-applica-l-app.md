# ADR-0008 — Le limitate e le bandite le applica l'app, non il pool

**Stato:** accettata · **Data:** 2026-09-15

## Contesto

Fino al ticket 11 la preparazione dei dati **cuoceva** il documento di formato
dentro il pool: le carte bandite non entravano nel file, e le limitate ci
entravano con `tettoDiCopie: 1`. A runtime nessuno rileggeva le due liste.
L'impronta del documento (ticket 26) guardava perciò anche limitate e bandite, e
la compilazione si fermava quando pool e documento non erano stati fatti
insieme.

Andava bene finché l'aggiornamento in sottofondo portava **pool** nuovi: un
bando nuovo arrivava col pool rigenerato.

Il cambio di formato (`PROGETTO.md` §7, Q29) ha rovesciato la premessa. Le carte
del 1994 non cambiano, e il pool **si congela nell'app**: l'aggiornamento in
sottofondo scarica soltanto quel che invecchia, cioè il documento di formato e i
prezzi. Il ticket 11 chiede che un documento più fresco cambi limitate, bandite
e nome del formato **senza ricompilare l'app**.

Con le liste cotte nel pool, questo non si può fare. Un documento più fresco
cambierebbe il nome del formato e lascerebbe in catalogo la carta appena
bandita. Una carta sbandita, poi, non potrebbe tornare: nel pool non c'è.

## Decisione

**Il pool porta tutte le carte che il criterio ammette, bandite comprese,
ciascuna col tetto di copie che il gioco le dà. Le limitate e le bandite le
applica l'app**, leggendo il documento di formato che ha in mano
(`src/dati/pool-in-vigore.ts`). Catalogo, motore e mazzi vedono solo il pool in
vigore.

Ne seguono tre cose.

- **L'impronta del documento si restringe** a criterio ed edizioni (codice e
  lingue): sono le voci che scelgono quali carte esistono e quale copia le
  descrive, e per cambiarle serve un archivio di Scryfall, cioè un pool nuovo.
  Un documento arrivato dalla rete con un'impronta diversa da quella del pool
  non si applica. L'app lo dice, e aspetta di essere aggiornata.
- **Il controllo dei nomi si sposta anche nell'app.** Un documento che nomina
  una carta che il pool non ha si rifiuta, e si nomina la carta. Il controllo
  si può fare perché il pool ha davanti tutti i nomi, bandite comprese: è la
  stessa ragione per cui prima lo faceva la preparazione, che lo fa ancora.
- **I prezzi viaggiano in un file a parte**, `prezzi.json`, che la stessa
  preparazione scrive accanto al pool, con la stessa impronta. La stampa che
  descrive una carta resta quella del pool: se un listino più fresco la prezza
  da un'altra copia, lo dice `Prezzo.stampa`, come già faceva (ADR-0007).

## Alternative scartate

- **Tenere le liste cotte, e aggiornare senza ricompilare solo il nome e i
  «perché».** È la lettera più corta, e lascia fuori proprio la cosa per cui il
  documento si aggiorna: il gruppo bandisce e limita, e raramente rinomina.
- **Scaricare il pool quando cambia il documento.** È il meccanismo che il
  cambio di formato toglie di mezzo, e riporterebbe dentro i quattro megabyte e
  la finestra fra i due file dei ticket 32 e 81.

## Conseguenze

- Il file del pool contiene carte che il catalogo non mostra. Il diario di
  `npm run dati` le elenca a parte, come «nel pool ma fuori dal catalogo».
- Le correzioni ai tag e il registro di Tagger contano anche le bandite: un tag
  che solo una bandita porta sta nel registro.
- La verifica della posta salta le bandite, che nel pool adesso ci sono.
- Rigenerare il pool per un bando non serve più. Serve per un'edizione, una
  lingua, un criterio, o per prezzi nuovi.

## Si riaprirebbe se

Una voce del documento che l'app non sa applicare sopra un pool già fatto
entrasse fra quelle che il gruppo cambia spesso. Per esempio, una limitata
«a due copie di una stampa precisa». Quella voce andrebbe nella spartizione
dell'impronta dalla parte di quel che fa il pool, e il test della spartizione
costringe a dirlo.
