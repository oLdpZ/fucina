# ADR-0002 — L'avversario è un orologio; il motore di regole è rimandato

**Stato:** accettata · **Data:** 2026-09-03

## Contesto

L'utente vuole **battere un mazzo del meta con un mazzo poco conosciuto**, e ha
chiesto che il sistema «capisca le combo e le regole del gioco in maniera
approfondita».

Le due richieste sono una sola: per dire *«questo mazzo batte il mono-rosso»*
bisogna far giocare i due mazzi uno contro l'altro — la mia rimozione deve poter
uccidere la loro creatura, il loro contromagia contrastare la mia magia,
qualcuno deve bloccare. Cioè bisogna sapere **cosa fa ogni carta**: un motore di
regole.

Q4 di `PROGETTO.md` lo esclude («euristiche + simulazione statistica goldfish,
nessun motore di regole»). Q4 è una **decisione**, non uno dei cinque vincoli non
negoziabili di `CLAUDE.md`: si può cambiare. Prima di cambiarla abbiamo cercato
i fatti (3 settembre 2026, fonti vive).

### Quel che la ricerca ha trovato

- **Magic è dimostrato indecidibile.** Churchill, Biderman, Herrick,
  [arXiv:1904.09828](https://arxiv.org/abs/1904.09828), pubblicato in LIPIcs FUN
  2021: determinare l'esito di una partita in cui tutte le mosse sono forzate
  equivale al problema della fermata. È il gioco reale computazionalmente più
  complesso noto in letteratura.
- **Nessun motore di regole maturo esiste in JavaScript o TypeScript.** L'unico
  percorso vivo verso il browser è [Manabrew](https://github.com/witchesofthehill/manabrew)
  (Forge portato in Rust, compilato a WebAssembly): repo creato il 18 maggio
  2026, dichiarato *pre-release*, copertura carte «still in progress», licenza
  AGPL-3.0+.
- **Nessun port funzionante di Forge o XMage nel browser.** *Forge Web* esiste
  ma è **solo spettatore**, col motore Java su un server.
- **Il costo umano.** XMage: 19.200 carte, ~106 MB di sorgenti Java, quindici
  anni di comunità. Forge: dal 2008. Argentum, una persona sola nel 2026:
  41.000 righe di Kotlin più 12.000 di TypeScript, partendo da *Portal* (il set
  semplificato del 1997), e copertura ancora parziale. Wizards ha un team a
  tempo pieno sul GRE di Arena.
- **Non esiste alcun formato pubblico che dica cosa fa una carta.** Scryfall e
  MTGJSON danno metadati più `oracle_text` in inglese. Le uniche approssimazioni
  sono gli script carta di Forge (DSL proprietario, GPL-3.0) e i tag funzionali
  di Scryfall Tagger.
- **Il costo di calcolo.** [Q-DeckRec](https://arxiv.org/pdf/1806.09771) misura
  ~5 secondi per 300 partite simulate con una IA proxy. Riportato sulla ricerca
  di Fucina — 40 partite per valutazione, ~3.900 valutazioni per frontiera — fa
  **circa 43 minuti per una frontiera** su un computer da tavolo, contro i **17
  secondi** di oggi: ~150 volte più lento, e peggio sul telefono.
- **Quel che l'utente ha chiesto esiste già, e mostra il prezzo.**
  [Grim.Cards](https://grim.cards/case-study/2026-07-01) fa giocare i mazzi degli
  utenti contro un gauntlet del meta usando una build custom di Forge **su un
  server**. L'avvertenza è degli autori: *«Results describe AI engine behavior…
  Win rates in this report are not predictions of human-play outcomes.»*

## Decisione

**Il motore di regole è rimandato, non escluso.** Q4 resta in piedi.

L'avversario entra come **orologio**: un mazzo del meta ridotto a pochi numeri
compilati a mano — turno di chiusura, rimozioni, contromagie. I tre numeri si
aggiungono **uno alla volta**, e ognuno deve dimostrare sui dati veri di
cambiare la classifica dei mazzi: se non la cambia, si toglie.

Gli orologi li scrive **soprattutto l'utente**. Il manutentore fornisce un file
di partenza perché la prima schermata non sia vuota.

L'esito della **corsa** diventa la **sesta componente del punteggio**.

## Perché così

L'orologio dà una risposta vera alla domanda che conta — *reggo contro l'aggro
veloce? affogo contro il controllo?* — senza conoscere una sola carta
dell'avversario. È una **caricatura, e l'app deve dirlo**, ma è una caricatura
verificabile e deterministica, e sta dentro tutti i vincoli attuali.

Contro il motore di regole non c'è un solo argomento ma la loro somma: non
esiste in JavaScript, l'unico percorso browser ha tre mesi ed è AGPL pre-release,
una persona sola arriva a decine di migliaia di righe con copertura parziale,
**ogni carta va insegnata una per una** e ne escono di nuove ogni tre mesi — è
un impegno permanente, non una tappa — e anche riuscendoci la frontiera
morirebbe come cosa che si guarda mentre si aspetta, misurando per giunta *come
gioca l'IA* e non come gioca una persona.

La corsa entra **nel punteggio** e non accanto al mazzo perché altrimenti l'app
saprebbe dire che perdi senza **costruire per non perdere**, che è la richiesta
originale.

Gli orologi li scrive l'utente perché **il meta del suo negozio non è il meta di
internet**: un giocatore esperto sa quali tre mazzi incontra il venerdì, e quella
conoscenza è più precisa di qualunque file compilato e di qualunque fonte online.
In più non invecchia mai — la aggiorna lui — e azzera la manutenzione a carico
del progetto, che con l'annuncio bandi del 12 ottobre 2026 alle porte non è un
dettaglio.

## Conseguenze

- Il **precalcolo fuori dall'app è ammesso**, come già per il pool: i conti
  pesanti li fa il manutentore una volta e l'app scarica il risultato. Non
  tradisce «niente server» — nessun servizio da pagare, nessun account.
- Ogni schermata che mostra un esito di corsa deve **dichiarare che l'avversario
  è una caricatura**. Un numero che sembra un win rate e non lo è sarebbe la
  bugia peggiore che quest'app possa dire.
- La tappa «confronto col meta locale» (§4.5) resta dov'è per la parte grossa —
  decklist e matchup dettagliati.

## Si riaprirebbe se

- **Manabrew maturasse**: copertura carte ampia, versioni stabili, un anno di
  storia. È l'unico percorso credibile. Da rivedere non prima di metà 2027, e la
  licenza AGPL-3.0+ va valutata allora contro la distribuzione dell'app.
- oppure se alla sosta l'orologio si rivelasse **inutile** — se cioè i suoi
  numeri non cambiassero mai la classifica dei mazzi. In quel caso la domanda
  «batto il meta?» resta senza risposta onesta a buon mercato, e il motore di
  regole torna a essere l'unica strada, col suo prezzo.
