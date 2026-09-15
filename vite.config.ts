import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vitest/config";

import { interpretaFormato } from "./src/dati/carica-formato.js";
import { verificaAllineamento } from "./src/dati/impronta-del-documento.js";
import { NOME_APP, PROMESSA_APP } from "./src/identita.js";
import { somma } from "./src/somma.js";
import { DIREZIONE_VISIVA } from "./src/stili/direzione.js";
// @ts-expect-error strumenti del manutentore: JavaScript semplice, senza tipi.
import { coloriDelTema, risorsePwa } from "./strumenti/risorse-pwa.mjs";

const qui = (percorso: string) => fileURLToPath(new URL(percorso, import.meta.url));

const colori = coloriDelTema(qui("./src/stili/tema.css"), DIREZIONE_VISIVA) as Record<
  string,
  string
>;

type Risorsa = { nome: string; tipo: string; contenuto: Buffer | string };

/**
 * I file di dati inclusi nell'app, copiati da `public/`.
 *
 * Sono di razze diverse e viaggiano insieme per una ragione sola: senza rete
 * l'app deve averli in mano tutti. Il **pool** lo scrive `npm run dati` e non
 * si tocca a mano; il **documento di formato** lo scrive una persona (ADR-0004)
 * e non lo genera nessun comando; gli **orologi** sono il file di cortesia del
 * manutentore, che serve perché la prima schermata non sia vuota (ADR-0002) e
 * che l'utente butta appena scrive i suoi.
 *
 * Hanno un nome ciascuno perché non si guardano più solo in fila: il controllo
 * di allineamento qui sotto ne apre uno per volta, e ognuno per una ragione
 * diversa. Gli orologi in quel controllo non entrano — non dicono niente su
 * quale gioco si giochi — ma nella cache sì, perché senza rete la prima
 * apertura resterebbe senza avversari per sempre.
 */
const POOL = "dati/pool.json";
const FORMATO = "dati/formato.json";
const OROLOGI = "dati/orologi.json";
const DATI_INCLUSI = [POOL, FORMATO, OROLOGI];

/** Uno dei due file di dati, letto da `public/` come lo legge la compilazione. */
const leggiDato = (nome: string) => readFileSync(qui(`./public/${nome}`), "utf8");

/**
 * Da quale documento il pool dice di venire, letto **grezzo**.
 *
 * Non passa da `interpretaPool`, ed è voluto: quella lettura rattoppa i pool di
 * ieri per farli aprire lo stesso, e un'impronta assente le uscirebbe come
 * stringa vuota — cioè come un pool che dichiara qualcosa. Qui l'assenza deve
 * restare assenza.
 */
function improntaScrittaNelPool(): unknown {
  const letto: unknown = JSON.parse(leggiDato(POOL));
  if (typeof letto !== "object" || letto === null) return undefined;
  return (letto as { improntaDelDocumento?: unknown }).improntaDelDocumento;
}

/**
 * La guardia sui due file di dati: il pool viene dal documento incluso?
 *
 * I due file di `DATI_INCLUSI` viaggiano insieme e finora niente controllava che
 * il primo l'avesse prodotto il secondo. Il legame è vero e sta tutto in un
 * ordine di comandi — `npm run dati`, poi `npm run build` — che nessuno ricorda
 * per sempre. Dal ticket 11 il legame è più stretto di prima e più largo di
 * prima insieme: le limitate e le bandite le applica l'app (ADR-0008), quindi
 * cambiarle non chiede un pool nuovo; il criterio e le edizioni invece sì, e
 * saltare il primo comando dopo averli cambiati spedisce un'app che applica il
 * documento a un catalogo che non è il suo — e che ogni documento rifiuta.
 *
 * Sta nella **compilazione** e non in un comando a parte per la ragione di
 * sempre: un controllo che qualcuno deve ricordarsi di lanciare è lo stesso
 * ordine di comandi di prima, con un passaggio in più da scordare.
 *
 * È un plugin suo, con `apply: "build"`, e non una riga dentro quello della PWA.
 * La ragione è che `buildStart` gira anche quando Vite apre un server — cioè in
 * sviluppo **e sotto i test**: là un documento appena toccato non farebbe cadere
 * la compilazione, farebbe cadere l'intera suite prima del primo test, compresi
 * i test che servono a rimettere le cose a posto. Il documento si corregge una
 * riga per volta senza compilare niente (ADR-0004), e questa guardia non deve
 * togliere quella possibilità: deve solo impedire che l'app **parta** così.
 */
function allineamentoDeiDati(): Plugin {
  return {
    name: "mazzi-allineamento-dei-dati",
    apply: "build",

    buildStart() {
      verificaAllineamento(
        improntaScrittaNelPool(),
        interpretaFormato(JSON.parse(leggiDato(FORMATO))),
      );
    },
  };
}

/**
 * Manifest, icone e service worker.
 *
 * Tutto generato: il nome dell'app e i colori vivono in un punto solo del
 * codice (ticket 01), e un file scritto a mano sarebbe il secondo.
 */
function pwa(): Plugin {
  const risorse: Risorsa[] = risorsePwa({
    nomeApp: NOME_APP,
    descrizione: PROMESSA_APP,
    base: "./",
    colori,
  });

  return {
    name: "mazzi-pwa",

    transformIndexHtml(html: string) {
      return {
        // La direzione entra nell'elemento <html> prima che il foglio di stile
        // dipinga: nessun lampo del tema chiaro su un'app scura.
        html: html.replace(
          '<html lang="it">',
          `<html lang="it" data-direzione="${DIREZIONE_VISIVA}">`,
        ),
        tags: [
          { tag: "title", children: NOME_APP, injectTo: "head" as const },
          {
            tag: "meta",
            attrs: { name: "description", content: PROMESSA_APP },
            injectTo: "head" as const,
          },
          {
            tag: "meta",
            attrs: { name: "theme-color", content: colori["fondo"] as string },
            injectTo: "head" as const,
          },
          {
            tag: "link",
            attrs: { rel: "manifest", href: "manifest.webmanifest" },
            injectTo: "head" as const,
          },
          {
            tag: "link",
            attrs: { rel: "icon", href: "icone/icona-192.png", type: "image/png" },
            injectTo: "head" as const,
          },
          {
            tag: "link",
            attrs: { rel: "apple-touch-icon", href: "icone/icona-192.png" },
            injectTo: "head" as const,
          },
          {
            // Su iOS «black-translucent» scrive l'ora in bianco sopra la pagina:
            // su fondo chiaro sparisce. Segue la direzione, come il colore del tema.
            tag: "meta",
            attrs: {
              name: "apple-mobile-web-app-status-bar-style",
              content:
              DIREZIONE_VISIVA === "pergamena" ? "default" : "black-translucent",
            },
            injectTo: "head" as const,
          },
        ],
      };
    },

    // In sviluppo le risorse generate non esistono su disco: le serve il server.
    configureServer(server) {
      server.middlewares.use((richiesta, risposta, avanti) => {
        const percorso = (richiesta.url ?? "").split("?")[0]?.replace(/^\//, "");
        const risorsa = risorse.find((r) => r.nome === percorso);
        if (!risorsa) return avanti();
        risposta.setHeader("content-type", risorsa.tipo);
        risposta.end(risorsa.contenuto);
      });
    },

    generateBundle(_opzioni, bundle) {
      for (const risorsa of risorse) {
        this.emitFile({ type: "asset", fileName: risorsa.nome, source: risorsa.contenuto });
      }

      const daMettereInCache = [
        ...new Set([
          "./",
          ...Object.keys(bundle),
          ...risorse.map((risorsa) => risorsa.nome),
          // I dati stanno in `public/`, che Vite copia fuori dal bundle: senza
          // nominarli qui l'app resterebbe senza carte — e senza sapere che
          // formato gioca — al primo uso senza rete.
          ...DATI_INCLUSI,
        ]),
      ]
        // Le icone grandi non servono all'apertura: le scarica il sistema.
        .filter((nome) => !nome.startsWith("icone/icona-512"))
        .filter((nome) => !nome.endsWith("icona-maskable-512.png"))
        .map((nome) => (nome === "./" ? nome : `./${nome}`));

      // La versione della cache cambia quando cambia una qualunque risorsa:
      // così il service worker vecchio non serve un guscio misto.
      //
      // I dati entrano nell'impronta col loro contenuto e non col loro nome,
      // che non cambia mai: un aggiornamento dei bandi tocca solo quei file, e
      // senza questo l'app installata continuerebbe a servire i dati vecchi
      // per sempre — cioè carte bandite, in silenzio.
      const impronta = somma(
        daMettereInCache.join("|") +
          JSON.stringify(Object.keys(bundle)) +
          DATI_INCLUSI.map((nome) => somma(leggiDato(nome))).join("|"),
      );

      const sorgente = readFileSync(qui("./src/sw.js"), "utf8")
        .replace("__VERSIONE__", impronta)
        .replace("__RISORSE__", JSON.stringify(daMettereInCache, null, 2))
        .replace("__INDICE__", "./");

      this.emitFile({ type: "asset", fileName: "sw.js", source: sorgente });
    },
  };
}

// Nessun plugin per Preact: basta la trasformazione JSX di esbuild, configurata
// qui e in `tsconfig.json`. Meno strumenti installati, meno cose che possono
// rompersi da sole se il progetto resta fermo (Q27).
export default defineConfig({
  base: "./",
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
  build: {
    target: "es2022",
  },
  plugins: [allineamentoDeiDati(), pwa()],
  test: {
    environment: "node",
    // Due programmi, due posti: l'app sotto `src/`, gli strumenti del
    // manutentore sotto `strumenti/`. I test seguono il codice che provano.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "strumenti/**/*.test.ts"],
  },
});
