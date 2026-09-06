# Progetto — Costruttore di mazzi Standard fuori meta

Documento d'intesa. Redatto il 2026-09-02 al termine della sessione di analisi.
Nessun codice scritto prima dell'approvazione.

---

## 1. In una frase

Un'app web installabile sul telefono che, dato un tema scelto dall'utente e un tetto
di spesa in euro, costruisce il mazzo Standard **più forte possibile dentro quel
vincolo**, spiega ogni scelta a parole, dice quanto costa in potenza l'originalità
richiesta, e produce la lista della spesa per comprare le carte.

Non è un altro Moxfield. Il fulcro è l'**ottimizzazione sotto vincolo**: la fantasia
la mette l'utente, la letalità la mette il motore.

## 2. Decisioni prese

| # | Decisione | Scelta |
|---|---|---|
| Q1 | Formato | Standard, formato unico |
| Q2 | Supporto | Carta fisica |
| Q3 | Significato di "fuori meta" | Vincolo tematico auto-imposto, ottimizzato al massimo |
| Q4 | Misura dell'efficacia | Euristiche + simulazione statistica (goldfish). Nessun motore di regole |
| Q5 | Destinazione | Strumento per un amico, non un prodotto commerciale |
| Q6 | Tecnologia | A discrezione dello sviluppatore |
| Q7 | Utente | Giocatore **esperto**: ogni scelta va motivata a parole lo stesso (corretto il 2026-09-03 — vedi ADR-0001) |
| Q8 | Espressione del tema | Filtri strutturati + carta-seme + vincoli negativi |
| Q9 | Budget | Tetto di spesa in euro. Nessuna collezione registrata |
| Q10 | Meta | L'app conosce 5-8 mazzi di riferimento e ci si confronta |
| Q11 | Sideboard | Fase successiva, non nel primo rilascio |
| Q12 | Output | Lista + numeri + motivazioni, con ciclo iterativo blocca/escludi |
| Q13 | Modello delle sinergie | Tag generati una volta sola e salvati su file, correggibili a mano, più regole meccaniche deterministiche. **Mai** sinergie dedotte dalle decklist vincenti (riporterebbero al meta) |
| Q14 | Punteggio | Vincolo morbido con prezzo esplicito + frontiera di 4-5 mazzi da purissimo a più forte. Ricerca locale a scambi singoli |
| Q15 | Base di terre | Generata dall'app, con probabilità reali mostrate |
| Q16 | Intelligenza artificiale a runtime | **Nessuna.** Nessuna chiave API, nessun costo, comportamento deterministico. Cade la descrizione a parole libere del tema |
| Q17 | Consegna | App web installabile (PWA), raggiungibile da un link |
| Q18 | Rigenerazione | Minima distanza dal mazzo attuale + modalità "consigliami una modifica" |
| Q19 | Calcoli | Interamente nel browser. Nessun server, nessun costo ricorrente |
| Q20 | Dispositivo | Pensata per telefono, usabile bene anche su schermo grande |
| Q21 | Ingresso | Galleria di temi all'apertura, ricerca carta-seme, filtri per raffinare |
| Q22 | Salvataggio | Sul dispositivo + esportazione/importazione per scambiarsi i mazzi |
| Q23 | Esportazione | Lista della spesa con prezzi e totale + lista formattata per torneo |
| Q24 | Lingua carte | **Solo inglese**, con immagine della carta sempre visibile |
| Q25 | Livello di gioco | Serata al negozio (FNM) — il meta di riferimento è quello locale |
| Q26 | Tema ingiocabile | Avviso preventivo prima di generare + allargamento dichiarato del tema |
| Q27 | Manutenzione | Comando di aggiornamento semi-automatico. L'app deve **degradare bene** se abbandonata |
| Q28 | Ordine | Sosta e prova reale dopo la tappa 2 |
| Q29 | Freschezza dati | Ibrido: dati inclusi nell'app, aggiornamento in sottofondo se c'è rete |
| Q31 | Meta | Compilato a mano, incollando le liste viste al negozio |
| Q32 | Modello economico | Gratuita, senza scopo di lucro, con le note legali richieste |

## 3. Fatti verificati (2026-09-02)

- **Standard**: 18 set legali, da *Wilds of Eldraine* a *The Hobbit* (14/08/2026).
  Nessuna rotazione nel 2026; la prossima è attesa con il primo set del 2027
  (indicativamente febbraio, **data non confermata da Wizards**). Conseguenza di
  progetto: la legalità si legge sempre dai dati, mai da una data scritta nel codice.
- **Carte bandite**: 13. Ultimo aggiornamento 10/08/2026.
  **Prossimo annuncio: 12/10/2026** — servirà un aggiornamento dei dati.
- **Dati carte**: Scryfall, gratuito e senza chiave. Un'app hobbistica non
  commerciale rientra esplicitamente nei termini d'uso. Archivio filtrabile a
  Standard cartaceo: poche migliaia di carte, dimensione adatta al browser.
- **Prezzi in euro**: già presenti nei dati Scryfall, di origine Cardmarket,
  aggiornati una volta al giorno. **L'API di Cardmarket è chiusa a nuove
  richieste, ma non ci serve.** I prezzi mostrati riporteranno sempre la data.
- **Il vuoto di mercato**: esistono simulatori open source, ma **nessun
  ottimizzatore di mazzi mantenuto e con licenza pulita**. Ciò che costruiamo non
  esiste già.
- **Fonti di decklist**: quelle che coprono i tornei ufficiali di Standard
  cartaceo (melee.gg, MTGGoldfish, siti Wizards) **vietano lo scraping**. Fonti
  legittime esistono (Topdeck.gg con attribuzione, archivio fbettega) ma
  descrivono il meta online, non quello del negozio. Da qui la scelta Q31.

## 4. Percorso di realizzazione

1. **Fondamenta** — Pool carte Standard cartaceo, filtri, ricerca, immagini,
   base di terre generata con le probabilità reali di avere i colori giusti al
   turno giusto. Già utile da solo.
2. **Motore** — Ricerca locale a scambi singoli, punteggio, simulazione
   statistica delle mani, spiegazioni a parole. **← sosta e prova reale**
3. **Strategia e avversario** — La strategia di vittoria dichiarata dall'utente
   e verificata dal comportamento; l'avversario come orologio; la corsa come
   sesta componente del punteggio. Aggiunta il 2026-09-03: vedi ADR-0001 e
   ADR-0002, e `CONTEXT.md` per il vocabolario.
4. Galleria dei temi, tetto di spesa, lista della spesa.
5. Ciclo iterativo blocca/escludi/rigenera.
6. Confronto col meta locale.
7. Sideboard con guida agli scambi per avversario.

Il rischio serio dell'intero progetto è **uno solo**: che il motore non abbia buon
gusto nel costruire mazzi. È il motivo della sosta dopo la tappa 2 — si scopre
guardando le liste che produce, e si scopre presto.

## 5. Note legali da includere nell'app

- Politica sui contenuti dei fan di Wizards of the Coast
- © Wizards of the Coast per le carte
- "Non prodotto né approvato da Wizards of the Coast"
- "Scryfall non produce né approva questa applicazione"
- Prezzi a titolo informativo, con data di aggiornamento

Tutte valide **a condizione che l'app resti gratuita**: nessuna pubblicità,
nessun abbonamento, nessun link d'acquisto remunerato.

## 6. Rimasto in sospeso

- ~~**Nome dell'app** e indirizzo web.~~ Fatto: **Fucina**, su
  `https://oldpz.github.io/fucina/`.
- **La direzione visiva**: quattro candidate disegnate, la scelta è dell'utente.
- Nessuna scadenza dichiarata.

## 7. Il cambio di formato del 6 settembre 2026

Il destinatario non gioca in Standard. Gioca **Old School**: le quattro edizioni del
1994 più Rinascimento, una lista di limitate e bandite decisa dal suo gruppo, e
le carte **stampate in italiano**. Q5 dice che quest'app è uno strumento per lui, e
un'app che costruisce mazzi per un formato che il suo unico utente non gioca
vale zero. Il formato cambia.

Il perché per esteso, coi numeri verificati, sta in
[ADR-0005](docs/adr/0005-da-standard-a-old-school-su-stampe-italiane.md); il
vincolo della legalità riformulato sta in
[ADR-0004](docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md).

**Da qui in su questo documento non si riscrive**, e il titolo dice ancora
«Standard» apposta. Le sezioni da 1 a 6 sono il verbale del 2 settembre: il
ragionamento che ha portato fin qui è la cosa di più valore che contengono, e
riscriverlo per farlo tornare vorrebbe dire perdere le ragioni insieme alle
conclusioni. Questa sezione è la correzione, e vince sulle precedenti dove le
contraddice.

### Quel che non si muove

Il **fulcro** — il tasso di cambio fra tema e potenza, reso visibile dalla
frontiera — e con lui Q3, Q8, Q14, Q26. I cinque **vincoli non negoziabili** di
`CLAUDE.md`, di cui uno riformulato nella lettera e non nella sostanza
(ADR-0004). Il **percorso** di §4: la tappa 3 è già implementata e va rimessa in
piedi sul pool nuovo, non riprogettata. Le **note legali** di §5, e con loro la
condizione che le rende valide: l'app resta gratuita.

### Le decisioni che decadono

| # | Che cosa cade | Che cosa resta |
|---|---|---|
| **Q1** | *Standard*. Il pool è **Old School su stampe italiane**: 786 nomi in cinque edizioni, 7 bandite, 18 limitate | *Formato unico*. L'app non impara a gestirne due: lo Standard esce e non torna |
| **Q10** | I 5-8 mazzi di riferimento sono Standard e **si buttano**. Si riparte da cinque o sei archetipi classici, riscritti sul pool solo-italiano e non copiati dalle liste storiche, che girano su carte che qui non esistono | Che l'app conosca il meta come **orologi** e ci si confronti (ADR-0002) |
| **Q31** | Le liste da incollare | Che il meta lo **compili a mano l'utente**: il meta del suo negozio non è il meta di internet, e su questo formato è ancora più vero |
| **Q29** | L'*ibrido*: che le carte possano cambiare. Il pool si **congela nell'app** — le carte del 1994 non cambiano, non c'è rotazione e non c'è annuncio bandi | L'aggiornamento in sottofondo, **ristretto** a quel che davvero invecchia: il documento di formato e i prezzi. Il codice si semplifica invece di complicarsi, e «degrada bene se abbandonata» (Q27) diventa vero alla lettera: senza rete l'app resta corretta per sempre |

Toccate ma non decadute: **Q9** (il tetto di spesa c'è ancora, ma **parte
spento**, se no il budget diventerebbe un secondo tasso di cambio accanto al
solo che la frontiera deve mostrare) e **Q13** (il modello delle sinergie regge
intero; è il **vocabolario** dei tag che si riscrive invece di ereditarsi,
perché i tag `synergy-*` coprono otto carte di 786).

### Le decisioni che reggono con una ragione nuova

**Q24 — lingua delle carte: solo inglese.** Regge, e la ragione non è più quella
di prima. Il formato è **definito** dalle stampe italiane, e sembrerebbe naturale
mostrarle; ma il nome italiano esiste per tutte e 786, l'**immagine** italiana
manca per 98 (tutta la Quarta italiana è un segnaposto) e il **testo di regole**
italiano su Scryfall **non esiste** — 7 stampe su 1182. L'italiano in
interfaccia significherebbe nome italiano, immagine a volte inglese e testo
sempre inglese. In più i prezzi disponibili sono quelli delle stampe inglesi:
mostrando l'inglese, nome e prezzo parlano della stessa carta.

L'italiano entra dove serve davvero — come **chiave di ricerca**: chi scrive
«Labirinto di Ith» trova *Maze of Ith*, e il pool conserva il nome italiano di
ogni carta per questo.

**Q7 — giocatore esperto.** Già corretta il 3 settembre (ADR-0001), e su questo
pool è ancora più vera: ottocento carte del 1994, di cui la maggior parte non ha
mai visto giocare. La seconda metà della decisione regge dov'era — *ogni scelta
va motivata a parole* — e diventa il servizio principale, non una cortesia.

**Q4 — nessun motore di regole.** Regge, con la conseguenza già scritta in
ADR-0002 e in `HANDOFF.md`: la potenza è una misura da aggro, perché la
simulazione legge di ogni carta quattro cose e mai il testo. Su un pool con 32
terre non base su 37 e 44 carte a costo zero — cioè un pool che produce combo e
prigione — quella misura sbaglia più spesso di prima. È la casella aperta più
grossa del cambio, e non la chiude questa sezione.

**Q27 — degradare bene se abbandonata.** Vedi Q29 qui sopra: da promessa diventa
un fatto.

### Il rischio, azzerato

Il rischio serio dichiarato in §4 — *che il motore non abbia buon gusto* — si
scopre guardando le liste che produce. Le liste guardate finora erano Standard.
La **sosta e prova reale si rifà da capo** su questo pool, e viene **prima** di
dichiarare finito il lavoro.
