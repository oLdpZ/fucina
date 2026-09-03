# ADR-0003 — I tag di Scryfall si affiancano ai nove, non li sostituiscono

**Stato:** accettata · **Data:** 2026-09-03

## Contesto

ADR-0001 chiede all'app di verificare un archetipo dichiarato. Ma con i tag di
oggi non si può: sono **nove**, ricavati da regole meccaniche —
`produce-pedine`, `sacrifica`, `guadagna-punti-vita`, `rimozione-mirata`,
`spazza-via`, `pesca`, `accelerazione-di-mana`, `conta-le-creature`,
`si-cura-del-cimitero` — e **nessuno di essi dice come si vince**. Non esiste
nel pool nemmeno un tag per le contromagie: senza, «controllo» è una parola
senza numeri sotto.

La ricerca del 3 settembre 2026 ha stabilito che **non esiste alcun formato
pubblico che dica cosa fa una carta**: Scryfall e MTGJSON danno metadati più
`oracle_text` in inglese. Ma **Scryfall Tagger**
([docs](https://scryfall.com/docs/api/tags)) pubblica tag di **funzione** —
`removal`, `ramp`, `draw`, `win-condition` — interrogabili con `otag:`,
disponibili come file bulk aggiornati ogni giorno e agganciabili alle carte
tramite `oracle_id`.

Sono curati dalla comunità, quindi cambiano nel tempo. Scryfall consiglia di
tracciare l'`id` UUID stabile.

## Decisione

I tag di Scryfall si **affiancano** ai nove, non li sostituiscono.

Si scaricano **a tempo di compilazione**, dentro `npm run dati`, e si congelano
in `public/dati/pool.json` insieme al resto. **L'app non li interroga mai a
runtime.** Di ciascuno si registra l'`id` stabile.

## Perché così

**Il determinismo non si tocca.** Congelati nel pool, i tag della comunità
diventano un dato come tutti gli altri: la stessa richiesta con lo stesso seme
sul **medesimo pool** dà lo stesso mazzo, sempre. Un aggiornamento dei tag è un
aggiornamento del pool, che l'app già sa gestire e datare.

**Non violano Q13.** Quel divieto colpisce le sinergie dedotte **dalle decklist
vincenti** — «riporterebbero al meta». Un tag che dice che una carta *è una
rimozione* non viene dai tornei: è una classificazione funzionale della carta in
sé, e chiunque la leggesse concluderebbe lo stesso. Q13 chiede inoltre tag
«generati una volta sola e salvati su file, correggibili a mano»: è esattamente
questo.

**I nove restano perché sono nostri.** Nascono da regole meccaniche scritte in
`strumenti/tag-di-sinergia.ts`, si leggono in un pomeriggio, e non dipendono da
nessuno. Se domani Scryfall Tagger cambiasse politica o sparisse, l'app perde
vocabolario ma non perde il pavimento. Sostituirli sarebbe barattare una base
verificabile con una comoda.

## Conseguenze

- `strumenti/aggiorna-pool.ts` deve scaricare anche i file bulk dei tag e
  agganciarli per `oracle_id`, raccontando quanti ne ha trovati — come già
  racconta il resto.
- La **densità di sinergia** cambia significato se il numero di tag cresce di
  ordini di grandezza: le coppie che «si attivano a vicenda» sono oggi quattro e
  scelte a mano. Vanno riviste, o va deciso che la sinergia continua a guardare
  **solo i nove**. È una domanda per la sosta.
- Le note legali già citano Scryfall come fonte dei dati; i tag ricadono lì
  dentro e non richiedono una nota nuova.
- Un tag che sparisce da Scryfall fra due aggiornamenti del pool non deve far
  cadere niente: l'assenza di un tag è già uno stato legittimo per 1.943 carte.

## Si riaprirebbe se

- i tag della comunità si rivelassero **instabili** fra un aggiornamento e il
  successivo al punto da cambiare i mazzi costruiti a parità di richiesta: in tal
  caso vanno congelati a una revisione fissa, aggiornata a mano e di rado;
- oppure se Scryfall cambiasse i termini d'uso dei bulk data: la gratuità e la
  non commercialità dell'app sono la condizione che rende legittimo l'uso dei
  loro dati, e va riverificata quando cambia quel che si scarica.
