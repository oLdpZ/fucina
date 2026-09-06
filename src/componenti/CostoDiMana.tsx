/**
 * Il costo di mana come lo si vede sulla carta: una pastiglia per simbolo.
 *
 * I dati lo danno come testo — `{1}{R}{R}` — e mostrarlo così sarebbe leggibile
 * solo a chi già sa. Le pastiglie si riconoscono a colpo d'occhio, che è tutto
 * il punto per un giocatore poco esperto.
 */

const SIMBOLO = /\{([^}]+)\}/g;

/** I colori noti hanno una pastiglia colorata; tutto il resto è incolore. */
const COLORI_NOTI = new Set(["W", "U", "B", "R", "G"]);

/**
 * Di che colore si dipinge un simbolo. I simboli ibridi e Phyrexiani si
 * scrivono a pezzi separati da una barra — `{G/U}`, `{2/R}`, `{W/P}` — e nel
 * pool di adesso non ce n'è **nemmeno uno**: sono stati inventati vent'anni
 * dopo le carte che questo formato gioca.
 *
 * La riga resta lo stesso, e non per abbondanza. Il pool è un dato, non un
 * elenco chiuso scritto qui: il giorno che il documento di formato ammettesse
 * un'edizione più recente, una carta con la barra arriverebbe senza che nessuno
 * tocchi questo file, e dipingerla incolore toglierebbe alla pastiglia proprio
 * la cosa per cui esiste. Si prende il primo colore che si riconosce.
 */
function coloreDelSimbolo(simbolo: string): string {
  return simbolo.split("/").find((pezzo) => COLORI_NOTI.has(pezzo)) ?? "C";
}

export function CostoDiMana({ costo }: { costo: string }) {
  const simboli = [...costo.matchAll(SIMBOLO)].map((trovato) => trovato[1] as string);
  if (simboli.length === 0) return null;

  return (
    <span class="costo" aria-label={`costo di mana ${simboli.join(" ")}`}>
      {simboli.map((simbolo, indice) => (
        <span
          key={`${simbolo}-${indice}`}
          class="mana"
          data-mana={coloreDelSimbolo(simbolo)}
          aria-hidden="true"
        >
          {simbolo}
        </span>
      ))}
    </span>
  );
}
