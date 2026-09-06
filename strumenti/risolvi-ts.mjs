import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Fa risolvere a Node gli import di `src/`, che finiscono in `.js`.
 *
 * Dentro `src/` un modulo ne importa un altro scrivendo `"./punteggio.js"`
 * anche se il file su disco è `punteggio.ts`: è la forma che TypeScript chiede
 * per i moduli ES, ed è quella che Vite e vitest risolvono da soli. Node crudo
 * no — cerca un `.js` che non esiste e si ferma.
 *
 * Questo gancio riscrive `.js` in `.ts` **solo quando il `.js` non c'è e il
 * `.ts` sì**: nessun file vero viene mai scavalcato. Serve agli strumenti del
 * manutentore che leggono codice di `src/` fuori dal browser: la preparazione
 * del pool, che da lì prende la regola del tetto di copie, e la sosta, che da
 * lì fa girare il motore intero.
 *
 *     node --import ./strumenti/risolvi-ts.mjs strumenti/<strumento>.ts
 *
 * Non entra nell'app in nessun modo: è codice del manutentore, e il browser
 * riceve solo quel che Vite ha compilato.
 */
registerHooks({
  resolve(specificatore, contesto, avanti) {
    const relativo = specificatore.startsWith(".");
    if (relativo && specificatore.endsWith(".js") && contesto.parentURL !== undefined) {
      const comEScritto = new URL(specificatore, contesto.parentURL);
      if (!existsSync(fileURLToPath(comEScritto))) {
        const inTs = `${specificatore.slice(0, -".js".length)}.ts`;
        if (existsSync(fileURLToPath(new URL(inTs, contesto.parentURL)))) {
          return avanti(inTs, contesto);
        }
      }
    }
    return avanti(specificatore, contesto);
  },
});
