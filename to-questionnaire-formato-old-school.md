# Le tre domande sul formato che solo il tuo gruppo può chiudere

**Purpose:** l'app che ti sto costruendo deve sapere **quali carte esistono** nel
vostro formato e **quali si giocano a una copia sola**. Su tre punti ho dovuto
tirare a indovinare, e finché restano aperti l'app può proporti mazzi che al
tavolo del venerdì non sono legali. Le tue risposte entrano dritte nel file che
l'app legge: non c'è codice da cambiare, si corregge una riga e cambia tutto.

**From:** oLdpZ — **To:** te — **How your answers will be used:** finiscono in
`public/dati/formato.json`, il documento che l'app apre per sapere che gioco
state giocando. Ogni riga lì dentro porta scritto il suo perché e da dove viene;
le tue risposte diventeranno quel perché.

## Context

L'app costruisce mazzi dentro un'idea che dai tu — «voglio giocare Goblin», «non
voglio vedere blu» — e per farlo deve conoscere le regole del vostro tavolo. Il
problema è che **il vostro formato non esiste in nessuna banca dati**: Scryfall
sa cos'è l'Old School svedese, che ha una lista di limitate diversa dalla
vostra, e non sa niente di quello che decidete voi. Quindi l'unica fonte siete
voi, e per adesso ho messo dei segnaposto presi dal regolamento pubblico di
Eternal Central, marcati come «da confermare» perché non fossero scambiati per
verità.

Due delle tre domande qui sotto **cambiano quali carte esistono**, non solo
quali si limitano. Se la risposta ribalta quello che ho assunto, i mazzi salvati
prima della correzione smettono di valere — l'app se ne accorge da sola e te lo
dice, ma è il motivo per cui conviene chiuderle adesso che di mazzi salvati non
ce ne sono ancora.

## How to answer

Un quarto d'ora, scrivendo sotto ogni domanda. **Scadenza: [—]**.

Rispondi anche a metà: «queste sei sono sicure, sulle altre devo chiedere» è una
risposta utilissima, «non lo so» pure. Quello che non serve è una risposta sicura
che sicura non è — un dato incerto dichiarato incerto resta un dato, scritto come
certo diventa un errore che aspetta. Se per una domanda devi sentire qualcun
altro del gruppo, segnalamelo e la lascio aperta.

## Le carte limitate a una copia

### Quali sono le carte che il gruppo limita a una copia per mazzo?

_Why this matters: è la domanda più importante delle tre. L'app mette in un mazzo il numero di copie che questa lista permette, quindi una carta che manca qui finisce nei mazzi in quattro copie — e te ne accorgi solo quando qualcuno al tavolo te lo fa notare._

Mi risulta che siano **diciassette**, ma non le ho mai viste scritte. Quelle che
ho messo dentro adesso sono **dieci**: le limitate del regolamento di Eternal
Central che nel vostro pool esistono davvero, più Blood Moon.

Ecco l'elenco che l'app usa oggi. **Cancella quelle che non limitate e aggiungi
quelle che mancano:**

1. Balance
2. Blood Moon
3. Braingeyser
4. Channel
5. Demonic Tutor
6. Mana Drain
7. Mind Twist
8. Recall
9. Regrowth
10. Sol Ring

>

### Mind Twist è fra le vostre limitate?

_Why this matters: la tengo separata perché è l'unica su cui ho un sospetto preciso invece che un buco — voglio una conferma esplicita, non un silenzio._

Non compariva nell'elenco che mi era arrivato, ma è in Terza e in Quarta
edizione ed è limitata in ogni regolamento pubblicato che ho trovato. Il mio
sospetto è che sia stata dimenticata nel passaparola, non esclusa apposta. Se
invece da voi si gioca in quattro copie, dimmelo e la tolgo: è una vostra scelta
e non un errore da correggere.

>

### Le otto bandite sono giuste?

_Why this matters: è l'unica lista che credo di avere completa, e mi serve sapere se posso smettere di dubitarne._

Sette sono le carte che si giocano scommettendo qualcosa di vero prima della
partita, e l'ottava è Falling Star, che chiede di lanciare fisicamente la carta
sul tavolo. Il regolamento di riferimento **non** banda Falling Star: l'ho messa
perché mi risultava vostra.

1. Bronze Tablet
2. Contract from Below
3. Darkpact
4. Demonic Attorney
5. Falling Star
6. Jeweled Bird
7. Rebirth
8. Tempest Efreet

>

## Quali carte esistono nel formato

### Una carta è ammessa perché **esiste stampata in italiano**, o perché sta in **una di cinque edizioni precise**?

_Why this matters: sembra la stessa cosa e non lo è. La prima è una regola e vale anche per le carte che nessuno ha ancora guardato; la seconda è un elenco chiuso. Le due danno pool di dimensioni diverse, e l'app deve eseguirne una sola._

Detto come lo direi al tavolo, sono due frasi diverse:

- **«Si gioca quello che è uscito in italiano»** — allora conta la lingua della
  stampa, e una carta entra se da qualche parte in quelle edizioni ne esiste una
  copia italiana.
- **«Si giocano queste cinque edizioni»** — allora conta l'edizione e basta, e
  una carta entra anche se in italiano non è mai stata stampata.

Oggi l'app esegue la **prima**. Quale delle due dicono al tavolo quando qualcuno
tira fuori una carta e chiede se si può giocare?

>

### Se vale la seconda: si possono giocare le copie inglesi di quelle edizioni?

_Why this matters: cambia se devo cercare i prezzi delle stampe inglesi o di quelle italiane, e su alcune carte i due numeri non si somigliano per niente._

Rispondi solo se sopra hai scelto «queste cinque edizioni». Se vale la prima
frase, salta pure.

>

## Rinascimento

### Rinascimento è dentro il formato?

_Why this matters: è l'unica strada per cui Arabian Nights e Antiquities esistono in italiano, quindi la risposta non aggiunge 69 carte qualunque — cambia che mazzi si possono fare._

Porta dentro **City of Brass**, **Erhnam Djinn**, **Ashnod's Altar** e le tre
terre di Urza, più altri 26 nomi che nelle altre quattro edizioni non ci sono.
Se sta fuori, i mazzi che l'app costruisce cambiano parecchio.

>

### Se è dentro, entra tutta o solo alcune carte?

_Why this matters: qualche gruppo la ammette con delle eccezioni, e un'eccezione non scritta è esattamente il genere di cosa che l'app sbaglierebbe in silenzio._

>

## Anything else?

C'è qualcos'altro che il vostro tavolo dà per scontato e che io non ho chiesto?
Penso a cose come: si gioca con la sideboard, e di quante carte? Ci sono carte
che nessuno banda ma che «non si fanno»? Il mazzo è da sessanta carte minimo o
esattamente sessanta? Qualunque regola che a voi sembra ovvia è probabilmente
una che ho sbagliato.

>
