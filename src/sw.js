/*
 * Service worker: mette in cache il guscio dell'app.
 *
 * L'elenco delle risorse e la versione sono scritti qui dalla compilazione
 * (`vite.config.ts`): un elenco compilato a mano si dimentica sempre un file.
 *
 * Le regole, tutte cache-first, perché l'app deve aprirsi al tavolo del negozio
 * anche senza rete (storia 15):
 * - le risorse compilate hanno l'impronta nel nome: se sono in cache sono
 *   giuste per sempre, e la rete non viene nemmeno interpellata;
 * - la navigazione risponde con la pagina salvata; la copia fresca si cerca in
 *   sottofondo, e solo quando il dispositivo si dichiara collegato, così una
 *   richiesta che non risponderà mai non tiene in piedi nulla;
 * - le immagini delle carte arrivano da un altro dominio (Scryfall) e non sono
 *   nel pacchetto: si tengono da parte man mano che si vedono, in una cache
 *   loro, così la seconda volta ci sono anche senza rete. Non si scaricano mai
 *   in blocco: sarebbe ridistribuire dati altrui.
 * - ogni altra richiesta verso altri domini qui non viene toccata.
 */

const VERSIONE = "__VERSIONE__";
const CACHE = `guscio-${VERSIONE}`;
const RISORSE = __RISORSE__;
const INDICE = "__INDICE__";

/**
 * Le immagini già viste. Non porta la versione nel nome: cambiare una riga di
 * codice non è una buona ragione per far riscaricare mezzo migliaio di
 * immagini a chi è al negozio con la connessione del telefono.
 */
const CACHE_IMMAGINI = "immagini-carte";

/**
 * Quante immagini si tengono. Una carta piccola pesa una trentina di kilobyte,
 * una grande un centinaio: questo tetto sta comodamente dentro lo spazio che i
 * browser concedono, e le più vecchie lasciano il posto alle nuove.
 */
const IMMAGINI_TENUTE = 1200;

/**
 * Da dove arrivano le immagini delle carte. Non è una regola di Magic e non sta
 * nei dati: è l'unico terzo a cui l'app parla (`spec.md`), e qualunque altra
 * immagine di qualunque altro dominio non va né richiesta due volte né tenuta.
 */
const DOMINIO_IMMAGINI = "scryfall.io";

/** Una potatura per volta: sessanta immagini in arrivo insieme sono la norma. */
let potaturaInCorso = null;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(RISORSE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      // Solo le nostre cache vecchie: su un dominio condiviso (le pagine di un
      // profilo GitHub, per dire) le altre applicazioni vivono qui accanto.
      .then((nomi) =>
        Promise.all(
          nomi
            .filter((nome) => nome.startsWith("guscio-") && nome !== CACHE)
            .map((nome) => caches.delete(nome)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== "GET") return;

  const indirizzo = new URL(richiesta.url);
  if (indirizzo.origin !== self.location.origin) {
    // Solo le immagini delle carte: qualunque altra cosa passa liscia.
    if (richiesta.destination === "image" && daScryfall(indirizzo)) {
      evento.respondWith(immagine(richiesta, evento));
    }
    return;
  }

  const navigazione = richiesta.mode === "navigate";
  const chiave = navigazione ? INDICE : richiesta.url;

  evento.respondWith(rispondi(chiave, richiesta, evento, navigazione));
});

async function rispondi(chiave, richiesta, evento, aggiornaInSottofondo) {
  const cache = await caches.open(CACHE);
  const salvata = await cache.match(chiave);

  if (salvata) {
    if (aggiornaInSottofondo && self.navigator.onLine) {
      evento.waitUntil(aggiorna(cache, chiave, richiesta));
    }
    return salvata;
  }

  try {
    const risposta = await fetch(richiesta);
    if (daSalvare(risposta)) {
      await cache.put(chiave, risposta.clone());
    }
    return risposta;
  } catch {
    return new Response("Non disponibile senza rete.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

/**
 * Un'immagine di carta: dalla cache se c'è, altrimenti dalla rete e poi in
 * cache. Se la rete non c'è e l'immagine non è mai stata vista, si risponde
 * con un errore e basta: la griglia mostra il nome della carta al suo posto,
 * e l'app va avanti.
 */
function daScryfall(indirizzo) {
  return indirizzo.hostname === DOMINIO_IMMAGINI || indirizzo.hostname.endsWith(`.${DOMINIO_IMMAGINI}`);
}

async function immagine(richiesta, evento) {
  const cache = await caches.open(CACHE_IMMAGINI);
  const salvata = await cache.match(richiesta);
  if (salvata) return salvata;

  // Senza rete non c'è niente da tentare: si risponde subito con l'errore,
  // invece di spendere due richieste morte per ogni carta mai vista.
  if (!self.navigator.onLine) return Response.error();

  // Un `<img>` verso un altro dominio chiede una risposta **opaca**: non se ne
  // può leggere nemmeno lo stato, e messa in cache sarebbe indistinguibile da
  // un errore travestito da immagine — un 404 salvato per sempre. Si richiede
  // quindi la stessa immagine in modalità normale, che Scryfall concede, e
  // così si può controllare che sia davvero arrivata prima di tenerla.
  let risposta;
  try {
    risposta = await fetch(richiesta.url, { mode: "cors", credentials: "omit" });
  } catch {
    // Se un giorno quel permesso sparisse, l'immagine si mostra lo stesso: non
    // si potrà solo tenerla da parte.
    return fetch(richiesta);
  }

  if (risposta.ok) {
    await cache.put(richiesta, risposta.clone());
    // La potatura non sta fra l'immagine e chi la aspetta: enumerare mille
    // chiavi davanti a sessanta immagini in arrivo le rallenterebbe tutte, e
    // sessanta potature simultanee, ciascuna sul conto vecchio, ne
    // butterebbero via molte più del dovuto.
    evento.waitUntil(potaAncora(cache));
  }
  return risposta;
}

/** Mette in fila la potatura: una alla volta, in sottofondo. */
function potaAncora(cache) {
  potaturaInCorso = (potaturaInCorso ?? Promise.resolve())
    .then(() => sfoltisci(cache))
    .catch(() => {});
  return potaturaInCorso;
}

/** Toglie le immagini più vecchie quando sono troppe. */
async function sfoltisci(cache) {
  const chiavi = await cache.keys();
  if (chiavi.length <= IMMAGINI_TENUTE) return;
  // `keys()` le dà nell'ordine in cui sono entrate: le prime sono le più vecchie.
  await Promise.all(chiavi.slice(0, chiavi.length - IMMAGINI_TENUTE).map((c) => cache.delete(c)));
}

/**
 * Una risposta si salva solo se è nostra, valida, e **non** è arrivata dopo un
 * rinvio: servire una risposta rinviata a una navigazione fa fallire il
 * caricamento nel browser, e resterebbe rotta finché qualcuno non svuota la
 * cache a mano.
 */
function daSalvare(risposta) {
  return risposta.ok && risposta.type === "basic" && !risposta.redirected;
}

/** Rimette in cache la pagina, se la rete risponde davvero. */
async function aggiorna(cache, chiave, richiesta) {
  try {
    const risposta = await fetch(richiesta, { cache: "no-store" });
    if (daSalvare(risposta)) await cache.put(chiave, risposta);
  } catch {
    // Senza rete non c'è niente da aggiornare: la copia salvata resta buona.
  }
}
