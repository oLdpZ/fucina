# ADR-0001 — La strategia si dichiara, l'archetipo si misura

**Stato:** accettata · **Data:** 2026-09-03

## Contesto

L'utente vuole poter chiedere un mazzo legato non solo a un tema ma anche a una
**strategia di vittoria** — aggro, controllo, midrange, combo — e vuole che il
mazzo non vinca soltanto con le creature.

C'è una decisione già presa che questo tocca. Il ticket 10 stabilisce che *la
forma attesa della curva non è una sola: è quella della velocità del mazzo, e la
velocità la dice la simulazione, **non un archetipo scritto nel codice***.
L'app rifiuta deliberatamente di avere gli archetipi come etichette scritte a
mano.

C'è anche una tensione col perimetro del progetto: *aggro*, *controllo* e
*combo* sono il vocabolario con cui si classificano i mazzi vincenti dei tornei,
cioè del meta contro cui l'app si definisce (Q3), e Q13 vieta di imparare dalle
decklist vincenti.

## Decisione

La strategia è un **secondo ingresso facoltativo** accanto al tema, col
vocabolario classico dei quattro archetipi. È un **vincolo duro**: l'app
costruisce solo mazzi che la soddisfano.

L'archetipo si verifica **per comportamento misurato** — il turno in cui il
mazzo chiude, quanto spesso, come regge la corsa — e **mai per composizione**.
Nessuna regola del tipo «un aggro ha almeno N creature» entra nel codice.

Prima di costruire parla una **guardia**: un conto grossolano che dice
*impossibile* solo quando è certo, e tace in ogni altro caso.

Quando la ricerca prova uno scambio che rompe l'archetipo, lo **rifiuta**. Se a
un peso della frontiera nessun mazzo valido esiste, quel **passo sparisce**.

## Perché così

**Il ticket 10 non è ribaltato.** L'utente *dichiara* la strategia, l'app la
*verifica*: la distanza fra le due è precisamente il lavoro che l'app fa, e
nessun archetipo finisce scritto nel codice come regola su cosa un mazzo debba
contenere. Il vocabolario del meta entra come **etichetta d'ingresso**, non come
conoscenza: l'app non ha imparato da nessuna decklist che cosa sia un aggro —
misura un comportamento e verifica che corrisponda a quel che le è stato
chiesto.

**Vincolo e non peso.** Un peso accanto alle componenti del punteggio farebbe
competere la strategia con la potenza: l'app cederebbe strategia per guadagnare
potenza **senza dirlo**, cioè creerebbe un secondo tasso di cambio invisibile.
La frontiera esiste per rendere visibile l'unico tasso di cambio che c'è; un
secondo nascosto sotto la superficie la contraddirebbe.

**Un asse solo.** Far scorrere anche la strategia trasformerebbe la frontiera da
curva in superficie: non più quattro mazzi in fila che si guardano, ma una
griglia che nessuno sa leggere. La leggibilità della frontiera non è cosmetica —
è la ragione per cui l'utente può scegliere dove fermarsi.

**La guardia esiste per una contraddizione reale.** Un archetipo misurato non si
conosce senza misurarlo, e misurarlo vuol dire costruire: il verdetto «prima di
costruire» sarebbe incalcolabile. La guardia lo rende possibile senza definire
niente, perché **esclude soltanto**. È la stessa figura già usata due volte: il
verdetto sul tema, dove *impossibile* esce da un conto non negoziabile e
*stretto* da una soglia tarata; e i tag di sinergia, che hanno scritto in testa
*le regole preferiscono tacere che sbagliare* — ed è per questo che 1.943 carte
non hanno alcun tag ed è giusto così.

**La combo si dichiara nominando le carte.** Dedurre che due carte formino una
combo significa capire cosa fanno, cioè far rientrare dalla finestra il motore
di regole che ADR-0002 rimanda. Il modello ha già la forma giusta: il tema
dichiara il `seme` per nome. L'app non giudica se la combo vinca — lo afferma
l'utente — e calcola la probabilità esatta di assemblarla entro un turno, con
una macchina che esiste già (`probabilitaDiPescarne`).

## Conseguenze

- Serve una nozione di comportamento più ricca di quella di oggi: **il
  «controllo» non è misurabile finché non esiste l'orologio** di ADR-0002, e le
  due cose vanno perciò costruite insieme.
- La frontiera può risultare **più corta** quando la strategia stringe. È un
  esito legittimo e va spiegato all'utente, non nascosto.
- Le soglie che separano aggro, midrange e controllo, e il conto che la guardia
  usa per dire *impossibile*, sono **tarature** e nascono provvisorie: si
  fissano alla sosta del ticket 14, sui mazzi veri.
- `PROGETTO.md` Q7 si corregge: il destinatario è un giocatore **esperto**,
  ed è ciò che rende legittimo il vocabolario classico. La seconda metà di Q7 —
  *ogni scelta va motivata a parole* — resta intatta: non era una concessione ai
  principianti ma la condizione di verificabilità dell'app.

## Si riaprirebbe se

- alla sosta si scoprisse che il comportamento misurato **non separa** gli
  archetipi in modo riconoscibile — cioè che mazzi che ogni giocatore chiamerebbe
  diversi cadono nella stessa casella;
- oppure che la guardia tace quasi sempre, e allora il verdetto «prima di
  costruire» promesso all'utente non arriva mai, e va ripensato o tolto.
