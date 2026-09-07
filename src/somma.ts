/**
 * L'impronta breve e stabile di una stringa.
 *
 * Serve a due mestieri diversi che hanno in comune una cosa sola: ridurre un
 * testo lungo a una manciata di caratteri che si possono **confrontare** e
 * scrivere dentro un file. La versione della cache del service worker
 * (`vite.config.ts`) e l'impronta del documento di formato
 * (`dati/impronta-del-documento.ts`) la chiamano tutte e due.
 *
 * È FNV-1a a 32 bit: non è una funzione crittografica e non deve esserlo —
 * qui nessuno cerca di ingannare nessuno, si vuole solo che due contenuti
 * diversi diano quasi sempre due stringhe diverse, senza dipendenze e con lo
 * stesso risultato su Node e nel browser.
 */
export function somma(testo: string): string {
  let valore = 0x811c9dc5;
  for (let i = 0; i < testo.length; i += 1) {
    valore ^= testo.charCodeAt(i);
    valore = Math.imul(valore, 0x01000193) >>> 0;
  }
  return valore.toString(36);
}
