import { deflateSync } from "node:zlib";

/**
 * Un codificatore PNG in venti righe, per non aggiungere una dipendenza a un
 * progetto che deve sopravvivere all'abbandono (Q27). Serve solo alle icone
 * dell'app, generate a ogni compilazione dai colori del tema.
 */

const TABELLA_CRC = (() => {
  const tabella = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabella[n] = c >>> 0;
  }
  return tabella;
})();

function crc32(dati) {
  let c = 0xffffffff;
  for (const byte of dati) c = TABELLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function blocco(tipo, dati) {
  const corpo = Buffer.concat([Buffer.from(tipo, "latin1"), dati]);
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length);
  const controllo = Buffer.alloc(4);
  controllo.writeUInt32BE(crc32(corpo));
  return Buffer.concat([lunghezza, corpo, controllo]);
}

/**
 * @param {number} larghezza
 * @param {number} altezza
 * @param {Uint8Array} pixel - RGBA, `larghezza * altezza * 4` byte.
 * @returns {Buffer}
 */
export function codificaPng(larghezza, altezza, pixel) {
  const righe = Buffer.alloc(altezza * (larghezza * 4 + 1));
  for (let y = 0; y < altezza; y += 1) {
    const inizio = y * (larghezza * 4 + 1);
    righe[inizio] = 0; // filtro «nessuno»: le icone sono piccole
    Buffer.from(pixel.buffer, pixel.byteOffset + y * larghezza * 4, larghezza * 4).copy(
      righe,
      inizio + 1,
    );
  }

  const intestazione = Buffer.alloc(13);
  intestazione.writeUInt32BE(larghezza, 0);
  intestazione.writeUInt32BE(altezza, 4);
  intestazione[8] = 8; // bit per canale
  intestazione[9] = 6; // RGBA
  intestazione[10] = 0;
  intestazione[11] = 0;
  intestazione[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco("IHDR", intestazione),
    blocco("IDAT", deflateSync(righe, { level: 9 })),
    blocco("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` → `[r, g, b]`.
 *
 * Una lunghezza diversa è un errore dichiarato: senza questo controllo un
 * refuso in `tema.css` diventerebbe un canale a zero, e l'icona uscirebbe di un
 * colore sbagliato senza che nessuno se ne accorga.
 */
export function leggiColore(esadecimale) {
  const pulito = esadecimale.trim().replace("#", "");
  const espanso =
    pulito.length === 3 || pulito.length === 4
      ? pulito
          .split("")
          .map((c) => c + c)
          .join("")
      : pulito;

  if (espanso.length !== 6 && espanso.length !== 8) {
    throw new Error(`colore non riconosciuto: «${esadecimale}»`);
  }

  return [
    Number.parseInt(espanso.slice(0, 2), 16),
    Number.parseInt(espanso.slice(2, 4), 16),
    Number.parseInt(espanso.slice(4, 6), 16),
  ];
}
