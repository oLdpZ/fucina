import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vitest/config";

import { NOME_APP, PROMESSA_APP } from "./src/identita.js";
import { DIREZIONE_VISIVA } from "./src/stili/direzione.js";
// @ts-expect-error strumenti del manutentore: JavaScript semplice, senza tipi.
import { coloriDelTema, risorsePwa } from "./strumenti/risorse-pwa.mjs";

const qui = (percorso: string) => fileURLToPath(new URL(percorso, import.meta.url));

const colori = coloriDelTema(qui("./src/stili/tema.css"), DIREZIONE_VISIVA) as Record<
  string,
  string
>;

type Risorsa = { nome: string; tipo: string; contenuto: Buffer | string };

/** Il pool delle carte, scritto da `npm run dati` e copiato da `public/`. */
const POOL_INCLUSO = "dati/pool.json";

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
          // Il pool sta in `public/`, che Vite copia fuori dal bundle: senza
          // nominarlo qui l'app resterebbe senza carte al primo uso senza rete.
          POOL_INCLUSO,
        ]),
      ]
        // Le icone grandi non servono all'apertura: le scarica il sistema.
        .filter((nome) => !nome.startsWith("icone/icona-512"))
        .filter((nome) => !nome.endsWith("icona-maskable-512.png"))
        .map((nome) => (nome === "./" ? nome : `./${nome}`));

      // La versione della cache cambia quando cambia una qualunque risorsa:
      // così il service worker vecchio non serve un guscio misto.
      //
      // Il pool entra nell'impronta col suo contenuto e non col suo nome, che
      // non cambia mai: un aggiornamento dei bandi tocca solo quel file, e
      // senza questo l'app installata continuerebbe a servire il pool vecchio
      // per sempre — cioè carte bandite, in silenzio.
      const impronta = somma(
        daMettereInCache.join("|") +
          JSON.stringify(Object.keys(bundle)) +
          somma(readFileSync(qui(`./public/${POOL_INCLUSO}`), "utf8")),
      );

      const sorgente = readFileSync(qui("./src/sw.js"), "utf8")
        .replace("__VERSIONE__", impronta)
        .replace("__RISORSE__", JSON.stringify(daMettereInCache, null, 2))
        .replace("__INDICE__", "./");

      this.emitFile({ type: "asset", fileName: "sw.js", source: sorgente });
    },
  };
}

/** Impronta breve e stabile di una stringa, per il nome della cache. */
function somma(testo: string): string {
  let valore = 0x811c9dc5;
  for (let i = 0; i < testo.length; i += 1) {
    valore ^= testo.charCodeAt(i);
    valore = Math.imul(valore, 0x01000193) >>> 0;
  }
  return valore.toString(36);
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
  plugins: [pwa()],
  test: {
    environment: "node",
    // Due programmi, due posti: l'app sotto `src/`, gli strumenti del
    // manutentore sotto `strumenti/`. I test seguono il codice che provano.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "strumenti/**/*.test.ts"],
  },
});
