# ADR-0006 — Il criterio diventa l'edizione, e la lingua è una regola sulle copie

**Stato:** accettata · **Data:** 2026-09-07

## Contesto

[ADR-0005](0005-da-standard-a-old-school-su-stampe-italiane.md) ha portato l'app
su Old School partendo da una regola che **nessuno aveva mai scritto**: si
giocano le carte stampate in italiano. Era un'inferenza dichiarata come tale, e
il documento di formato la portava scritta come voce da confermare.

Il 2026-09-07 il gruppo ha risposto, per messaggio, al questionario
`to-questionnaire-formato-old-school.md`. Quel che ha detto:

1. Vale l'**edizione**, non la stampa italiana — e Alpha, Beta e Unlimited non si
   giocano.
2. **Rinascimento è fuori.**
3. Le lingue, per edizione: *«roba uscita in italiano francese tedesco per quanto
   riguarda fbb e fwb; Leggende inglese o ita; Dark inglese o ita»*.
4. Le **limitate**: diciotto carte, sei nominate in italiano.
5. Le **bandite**: Falling Star, Rebirth, Tempest Efreet e «tutte le carte che
   menzionano la posta».

### Perché non basta la clausola già scritta

ADR-0005 chiude con: *«Il criterio "stampa italiana" si rivelasse sbagliato — se
cioè il gruppo intendesse "proprio quelle edizioni e basta" — si risolve
cambiando il documento di formato da regola a elenco: una riga di dati, non un
ADR.»*

Quella previsione è sbagliata in tre punti, ed è il motivo per cui questo
documento esiste invece di non esistere.

- Il criterio **non è diventato un elenco**. È rimasto una regola — «sta in una
  di queste edizioni» — che vale anche per le carte che nessuno ha guardato. La
  contrapposizione regola/elenco, che `CONTEXT.md` tiene alla voce **Criterio del
  pool**, non è l'asse su cui la risposta è caduta.
- Si è portato dietro una **regola nuova che ADR-0005 non contempla**: quali
  lingue di ciascuna edizione siano giocabili. Non esiste un posto, né nel
  documento né nel codice, dove quella regola possa essere scritta oggi.
- Contraddice una decisione esplicita di ADR-0005, **«criterio italiano, dati
  inglesi»**: se le copie inglesi di un'edizione non sono giocabili, la stampa
  inglese non può più essere quella che descrive e prezza la carta.

### I numeri, verificati su Scryfall il 2026-09-07

Stanno qui perché `.scratch/` non è in git. Chi li rimisura e li trova diversi ha
trovato un guasto, non una sorpresa.

- La Quarta edizione **italiana è completa**: 378 carte, quanto la Quarta intera.
  Lo stesso per francese e tedesca. **Nessun nome del formato dipende dalla
  lingua**, ed è il fatto su cui poggia metà di questa decisione.
- La Terza a bordo nero: 306 carte italiane, 306 francesi, 307 tedesche.
- **I listini in euro esistono per una sola stampa non inglese**: la Terza a bordo
  nero **francese**, 291 carte su 306. Zero su tutte le italiane (Terza e Quarta),
  zero sulle tedesche, zero sulla Quarta francese.
- Nel pool di prima, le carte descritte da una stampa italiana erano 72 e **nessuna
  aveva un prezzo**. Delle 363 descritte da una Quarta inglese, 241 esistono in
  Terza francese con un prezzo vero (mediana 0,80 €, da 0,08 a 91,68).
- Rigenerato il pool col criterio nuovo: **753 carte, 0 entrate, 25 uscite.** Le
  25 sono tutte di Rinascimento. Il cambio di criterio, da solo, **non ha fatto
  entrare una sola carta**: dentro queste quattro edizioni ogni carta ha già una
  stampa italiana, e le due regole selezionano lo stesso insieme.

## Decisione

**Il criterio del pool passa da `stampa-italiana` a `solo-edizioni`.** Una carta è
nel formato se sta in una delle edizioni ammesse, che ne esista o meno una stampa
italiana. Le edizioni diventano quattro: Rinascimento esce.

**La lingua non è un criterio: è una proprietà dell'edizione.** Non decide quali
carte esistono — decide quale copia è legale portare al tavolo. Il documento di
formato la dichiara per ogni edizione, e governa un meccanismo solo: la scelta
della stampa.

**La stampa si sdoppia.** Fino a oggi una sola stampa faceva due mestieri:
descriveva la carta (edizione, numero di collezione, immagine) e ne portava il
prezzo. Da qui in avanti sono due:

- **descrive** la stampa italiana dove esiste, poi l'inglese dove l'edizione la
  ammette, poi la più economica fra le lingue ammesse;
- **prezza** la stampa ammessa più economica che un listino ce l'abbia.

**Le lingue non entrano nell'impronta del formato.** L'impronta risponde a una
domanda sola — *questo mazzo salvato è dello stesso gioco?* — e un mazzo è una
lista di nomi. Le lingue non cambiano nessun nome, quindi stanno con le limitate
e le bandite: stesso gioco, una riga in più.

## Perché così

**Il criterio cambia perché il gruppo l'ha detto, e il gruppo è l'unica fonte che
esista.** Non c'è un regolamento scritto, Scryfall conosce l'Old School svedese e
non questo, e ADR-0005 aveva costruito su un'inferenza dichiarandola tale. La
risposta la sostituisce. Questo è il funzionamento previsto, non un incidente.

**La lingua non è un criterio perché è stato misurato, non supposto.** Se la
Quarta italiana fosse stata parziale, filtrare per lingua avrebbe tolto nomi dal
pool e la lingua sarebbe stata parte del criterio a pieno titolo. È completa: 378
su 378. Trattarla come criterio significherebbe scrivere un filtro che non filtra
mai niente e che un giorno filtrerebbe per sbaglio.

**La stampa si sdoppia perché altrimenti l'app prezza una carta che non si può
giocare.** Il punto è tutto qui. La «stima al ribasso» di `CONTEXT.md` promette
che ogni prezzo è un pavimento, e il pavimento regge finché è il prezzo di una
copia **legale** che il giocatore potrebbe comprare. Con l'inglese di Terza fuori
legge, il vecchio meccanismo avrebbe mostrato edizione, numero e prezzo di un
cartoncino che al tavolo l'arbitro respinge: non un pavimento, il prezzo di
un'altra carta.

Sdoppiando, le 72 carte oggi senza prezzo ne prendono uno vero — francese,
legale, dichiarato — e l'utente continua a vedere descritta la stampa che
verosimilmente avrà in mano.

**Il costo è dichiarato:** `Carta` porta due stampe invece di una, e ogni punto
che mostra un prezzo deve dire di quale stampa parla. È complessità vera, pagata
per non mentire su un numero.

**L'inglese di Quarta è ammesso per scelta, non per risposta.** Il gruppo ha
elencato «italiano francese tedesco» per Terza e Quarta senza nominare l'inglese,
mentre per Leggende e L'Oscurità l'inglese l'ha nominato: un contrasto che sembra
voluto. L'app lo ammette lo stesso, per decisione di chi la tiene, e la voce
dell'edizione porta scritta la domanda. Da quella risposta dipende quale stampa
descrive e prezza 363 carte: è la prima cosa da chiedere al prossimo giro.

## Conseguenze

- **Il cambio di criterio, misurato, non sposta nessuna carta.** Zero entrate.
  L'inferenza di ADR-0005 — «si giocano le carte stampate in italiano» —
  selezionava esattamente lo stesso pool della regola vera, perché dentro queste
  quattro edizioni ogni carta una stampa italiana ce l'ha. Non toglie ragione al
  cambio: la regola eseguita adesso è quella che il gruppo ha detto, e non una
  che gli somiglia per caso. Ma è onesto scrivere che l'app costruisce mazzi
  identici a prima, e che chi cercasse una differenza nel pool non la troverebbe.
  La differenza vera arriverà con la lingua e con la stampa sdoppiata, non da qui.
- **L'impronta del formato cambia due volte**: da `stampa-italiana/4ed+drk+fbb+leg+rin`
  a `solo-edizioni/4ed+drk+fbb+leg`. È un altro gioco, e i mazzi salvati di prima
  non sono più del formato corrente. Non morde nessuno solo perché di mazzi
  salvati non ce n'è ancora — ed è la ragione per cui questa domanda andava chiusa
  adesso e non fra sei mesi.
- **Il nome del formato è diventato impreciso.** «Old School · stampe italiane»
  descrive il criterio vecchio. Non si cambia qui: come si chiami il proprio gioco
  lo dice il gruppo, e la domanda è già scritta nel documento.
- **Il titolo di questo ADR contraddice quello di ADR-0005**, che dice «su stampe
  italiane». ADR-0005 non si riscrive: la sua decisione — smettere lo Standard e
  passare a Old School — regge intera, e la parte che decade è il criterio, non il
  cambio di formato.
- **Rinascimento esce dal pool** e con lui 26 nomi che le altre edizioni non
  hanno, City of Brass ed Erhnam Djinn compresi. La ragione per cui era stato
  proposto resta leggibile nel campo `edizioniEscluse` del documento, e non solo
  in `git log`.
- **Le bandite scendono da 8 a 7, e non perché il gruppo abbia cambiato idea.**
  Jeweled Bird è di Arabian Nights, e nel formato entrava soltanto attraverso
  Rinascimento: uscito Rinascimento, la carta non esiste, e una riga che bandisce
  una carta inesistente non descrive niente. Non l'aveva previsto né questo ADR
  né il questionario: l'ha trovato `verificaCarteEsistenti`, la guardia che
  rifiuta un documento che nomina carte fuori dal pool, fermando la
  preparazione prima che scrivesse un `pool.json` sbagliato. Vale la pena
  scriverlo perché è il primo caso in cui **togliere un'edizione ha cambiato una
  lista di carte**, e la prossima volta che si tocca `edizioni` va riguardato
  anche il resto del documento.
- **Il campo `lingue` per edizione e la stampa sdoppiata non sono in questa
  tappa.** Qui c'è la metà che è dati: criterio, edizioni, limitate, bandite. La
  metà che è codice — tipo, validazione, esecuzione in `prepara-pool.ts`,
  interfaccia — passa da una spec e dai suoi ticket. Fino ad allora la regola di
  lingua vive nel «perché» di ogni edizione, a parole: scritta come campo
  strutturato sarebbe una regola che il documento dichiara e nessuno esegue.
- **Le limitate passano da 10 a 19**, di cui 18 dal gruppo e Mind Twist tenuta a
  una copia in attesa di risposta esplicita. Non cambia l'impronta: è lo stesso
  gioco con più righe.

## Si riaprirebbe se

- **Il gruppo dicesse che la Quarta e la Terza inglesi non si giocano.** È la
  domanda aperta più grossa, ed è già scritta nel documento: cambierebbe la stampa
  che descrive e prezza 363 carte, non quali carte esistono.
- **Le copie francesi si rivelassero teoriche.** Se al tavolo girano solo copie
  italiane, prezzare dalla francese è corretto e fuorviante insieme, e il
  pavimento andrebbe ripensato — non lo sdoppiamento, che regge comunque.
- **Un'edizione straniera si rivelasse incompleta.** Il fatto che la lingua non
  tolga nomi è misurato sulla Quarta e sulla Terza di oggi. Se un giorno il gruppo
  ammettesse un'edizione le cui stampe straniere sono parziali, la lingua
  tornerebbe a essere parte del criterio, e questa decisione andrebbe rifatta.
