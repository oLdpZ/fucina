/**
 * L'identità dell'app, in un punto solo.
 *
 * Il nome non è ancora deciso (`PROGETTO.md` §6): finché resta fra parentesi
 * quadre è un segnaposto dichiarato, e l'app lo dice a chi la guarda. Sceglierlo
 * significa cambiare una costante qui dentro, non cercare per il progetto — un
 * test lo verifica.
 */
export const NOME_APP = "[NOME APP]";

/** Vero finché il nome è un segnaposto e non una scelta. */
export const NOME_APP_DA_DECIDERE = NOME_APP.startsWith("[");

/** Riga di contesto sotto il nome: dice subito di cosa parla l'app. */
export const AMBITO_APP = "Standard · cartaceo";

/** Una frase, quella di `PROGETTO.md` §1, ridotta a misura di schermo. */
export const PROMESSA_APP =
  "Il mazzo più forte possibile dentro l'idea che hai in mente.";
