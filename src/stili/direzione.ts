/**
 * La direzione visiva, in un punto solo.
 *
 * I valori delle quattro strade disegnate stanno in `tema.css`; qui si dice
 * quale è in uso. Cambiare aspetto all'app è cambiare questa costante.
 */
export const DIREZIONI_VISIVE = [
  "pergamena",
  "taverna",
  "grimorio",
  "braci",
] as const;

export type DirezioneVisiva = (typeof DIREZIONI_VISIVE)[number];

/** Ancora da scegliere con l'utente (`PROGETTO.md` §6). */
export const DIREZIONE_VISIVA: DirezioneVisiva = "pergamena";
