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
 * - le richieste verso altri domini (le immagini delle carte, più avanti) qui
 *   non vengono toccate.
 */

const VERSIONE = "__VERSIONE__";
const CACHE = `guscio-${VERSIONE}`;
const RISORSE = __RISORSE__;
const INDICE = "__INDICE__";

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
  if (new URL(richiesta.url).origin !== self.location.origin) return;

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
