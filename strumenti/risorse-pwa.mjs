import { readFileSync } from "node:fs";

import { codificaPng, leggiColore } from "./png.mjs";

/**
 * Manifest e icone dell'applicazione, generati a ogni compilazione da:
 * - il nome, che sta in `src/identita.ts`;
 * - i colori, che stanno in `src/stili/tema.css`.
 *
 * Sono generati e non scritti a mano proprio per questo: il nome e la direzione
 * visiva sono ancora da decidere (`PROGETTO.md` §6), e cambiarli non deve voler
 * dire ricordarsi di ridisegnare un'icona.
 */

/** Legge le variabili di colore della direzione attiva da `tema.css`. */
export function coloriDelTema(percorsoTema, direzione) {
  const css = readFileSync(percorsoTema, "utf8");

  const blocchi = [
    estraiBlocco(css, /:root\s*\{([\s\S]*?)\}/),
    direzione === "pergamena" ? "" : bloccoRichiesto(css, direzione),
  ].join("\n");

  const colori = {};
  for (const [, nome, valore] of blocchi.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    colori[nome] = valore;
  }

  for (const richiesto of ["fondo", "superficie", "accento"]) {
    if (!colori[richiesto]) {
      throw new Error(`tema.css: manca --${richiesto} per la direzione «${direzione}»`);
    }
  }
  return colori;
}

/**
 * Il blocco di `tema.css` che appartiene a una direzione, cercato per posizione
 * e non con un'espressione regolare: le sequenze di scappamento in un modello di
 * stringa si perdono per strada, e il blocco non si troverebbe mai — in
 * silenzio, che è il modo peggiore.
 */
function bloccoDirezione(css, direzione) {
  const selettore = `:root[data-direzione="${direzione}"]`;
  const inizio = css.indexOf(selettore);
  if (inizio === -1) return null;

  const apertura = css.indexOf("{", inizio);
  const chiusura = css.indexOf("}", apertura);
  if (apertura === -1 || chiusura === -1) return null;

  return css.slice(apertura + 1, chiusura);
}

/** Come `bloccoDirezione`, ma una direzione che non esiste è un errore. */
function bloccoRichiesto(css, direzione) {
  const blocco = bloccoDirezione(css, direzione);
  if (blocco === null) {
    throw new Error(`tema.css: nessun blocco per la direzione «${direzione}»`);
  }
  return blocco;
}

function estraiBlocco(css, espressione) {
  const trovato = css.match(espressione);
  return trovato?.[1] ?? "";
}

/**
 * Il marchio provvisorio: un rombo, la forma dei simboli di mana, in campo
 * pieno. Volutamente povero — l'icona vera arriva con la direzione visiva.
 */
export function disegnaIcona(lato, colori, { zonaSicura = 1 } = {}) {
  const fondo = leggiColore(colori.fondo);
  const accento = leggiColore(colori.accento);
  const superficie = leggiColore(colori.superficie);

  const pixel = new Uint8Array(lato * lato * 4);
  const centro = lato / 2;
  const raggioEsterno = centro * 0.72 * zonaSicura;
  const raggioInterno = raggioEsterno * 0.46;

  for (let y = 0; y < lato; y += 1) {
    for (let x = 0; x < lato; x += 1) {
      // Tre campioni per lato: basta a togliere la scalettatura dai bordi.
      let dentroEsterno = 0;
      let dentroInterno = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const distanza =
            Math.abs(x + (sx + 0.5) / 3 - centro) + Math.abs(y + (sy + 0.5) / 3 - centro);
          if (distanza <= raggioEsterno) dentroEsterno += 1 / 9;
          if (distanza <= raggioInterno) dentroInterno += 1 / 9;
        }
      }

      const colore = mescola(
        mescola(fondo, accento, dentroEsterno),
        superficie,
        dentroInterno,
      );
      const posizione = (y * lato + x) * 4;
      pixel[posizione] = colore[0];
      pixel[posizione + 1] = colore[1];
      pixel[posizione + 2] = colore[2];
      pixel[posizione + 3] = 255;
    }
  }

  return codificaPng(lato, lato, pixel);
}

function mescola(sotto, sopra, quota) {
  return sotto.map((canale, i) => Math.round(canale + (sopra[i] - canale) * quota));
}

/**
 * Le risorse da servire accanto all'app: il manifest e le tre icone.
 * @returns {{ nome: string, tipo: string, contenuto: Buffer | string }[]}
 */
export function risorsePwa({ nomeApp, descrizione, base, colori }) {
  const manifest = {
    name: nomeApp,
    short_name: nomeApp,
    description: descrizione,
    id: base,
    start_url: base,
    scope: base,
    display: "standalone",
    lang: "it",
    dir: "ltr",
    background_color: colori.fondo,
    theme_color: colori.fondo,
    icons: [
      { src: "icone/icona-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icone/icona-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "icone/icona-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return [
    { nome: "manifest.webmanifest", tipo: "application/manifest+json", contenuto: JSON.stringify(manifest, null, 2) },
    { nome: "icone/icona-192.png", tipo: "image/png", contenuto: disegnaIcona(192, colori) },
    { nome: "icone/icona-512.png", tipo: "image/png", contenuto: disegnaIcona(512, colori) },
    {
      nome: "icone/icona-maskable-512.png",
      tipo: "image/png",
      // Nelle icone mascherate il sistema può ritagliare fino al 40% del lato.
      contenuto: disegnaIcona(512, colori, { zonaSicura: 0.6 }),
    },
  ];
}
