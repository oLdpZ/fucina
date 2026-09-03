# Fucina

App web installabile sul telefono che, dato un **tema scelto da chi la usa** e
un tetto di spesa in euro, costruisce il mazzo Standard cartaceo più forte
possibile dentro quel vincolo, spiega ogni scelta a parole e produce la lista
della spesa.

Il fulcro non è «qual è il mazzo più forte» — quella risposta la danno già i
siti del meta, gratis e meglio. È il **tasso di cambio fra originalità e
potenza**: quanto costa, in punti di potenza, restare fedeli alla propria idea.
L'app mostra quattro o cinque mazzi affiancati, dal più fedele al tema al più
forte, e dove fermarsi lo sceglie chi gioca.

## Come funziona

Tutto avviene **nel browser**. Non c'è un server, non c'è un account, non c'è un
database, e non c'è **nessun modello linguistico a runtime**: le spiegazioni
sono modelli di frase riempiti con numeri calcolati davvero, mai testo inventato.
Il comportamento è deterministico — stessa richiesta e stesso seme, stesso mazzo,
sempre.

La legalità delle carte si legge dai dati di Scryfall, mai da date scritte nel
codice.

## Per svilupparla

```
npm install
npm run dev      # sviluppo
npm test         # i test
npm run tipi     # solo il controllo dei tipi
npm run build    # compila in dist/
npm run dati     # riscarica carte e tag da Scryfall e riscrive il pool
```

Serve Node 22.18 o più recente. `public/dati/pool.json` è un prodotto di
compilazione: si rigenera con `npm run dati`, non si modifica a mano.

Il documento d'intesa è [`PROGETTO.md`](PROGETTO.md); lo stato dei lavori sta
in [`HANDOFF.md`](HANDOFF.md).

## Note legali

- Questa applicazione è un contenuto dei fan, realizzato nel rispetto della
  [politica sui contenuti dei fan di Wizards of the Coast](https://company.wizards.com/en/legal/fancontentpolicy).
- Il materiale letterale delle carte, i nomi, le illustrazioni e Magic: The
  Gathering sono © Wizards of the Coast LLC.
- Questa applicazione non è prodotta né approvata da Wizards of the Coast.
- I dati delle carte vengono da [Scryfall](https://scryfall.com). Scryfall non
  produce né approva questa applicazione.
- L'applicazione è gratuita e senza scopo di lucro: nessuna pubblicità, nessun
  abbonamento, nessun link d'acquisto remunerato. È la condizione che rende
  legittimo l'uso dei dati delle carte, e non cambierà.
