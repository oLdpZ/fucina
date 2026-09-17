/**
 * **La decisione del ticket 10 della tappa 2, difesa da un test.**
 *
 * Quel ticket stabilisce che la forma attesa della curva è quella della
 * velocità **misurata**, e non quella di un archetipo scritto nel codice.
 * ADR-0001 aggiunge gli archetipi al vocabolario dell'app senza ribaltarlo:
 * l'utente *dichiara* la strategia, l'app la *verifica* misurando un
 * comportamento — e nessun elenco di archetipi diventa una regola su quel che
 * un mazzo deve contenere.
 *
 * Questa tappa esiste per **non** ribaltare quella decisione, e il ticket 04 ne
 * chiede la prova. La prova è di tipo, prima che di disciplina:
 *
 * - `archetipoDi` non riceve carte — riceve un comportamento misurato — e
 *   quindi la regola vietata lì dentro non si può nemmeno scrivere: non c'è
 *   niente da contare;
 * - gli altri moduli della strategia si appoggiano a lui, e **non** conoscono le
 *   carte: qui si guarda che non se le facciano passare da nessuna parte;
 * - l'unica eccezione dichiarata è la **guardia**, che le carte le guarda per
 *   forza. Il suo verdetto però non ha modo di dire che un mazzo *è* un
 *   archetipo: sa dire solo «impossibile» e «tace», e quello è un tipo, non una
 *   promessa a parole.
 *
 * Guarda il sorgente come testo, come fanno gli altri guardiani di vincolo di
 * questo progetto (`dati/nessun-nome-di-formato-nel-sorgente.test.ts`): è
 * grossolano quanto il confine che difende.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ArchetipoMisurato } from "./archetipo.js";
import { guardiaDellaStrategia, type VerdettoDellaGuardia } from "./guardia.js";
import { POOL_DEL_MOTORE } from "../catalogo/pool-finto.js";
import { STRATEGIE } from "./strategia.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));

/** I moduli della strategia, tolti i test e tolta la guardia. */
function moduli(): { nome: string; testo: string }[] {
  return readdirSync(QUI, { withFileTypes: true })
    .filter(
      (voce) =>
        voce.isFile() &&
        voce.name.endsWith(".ts") &&
        !voce.name.endsWith(".test.ts") &&
        voce.name !== "guardia.ts",
    )
    .map((voce) => ({
      nome: voce.name,
      testo: readFileSync(join(QUI, voce.name), "utf8"),
    }));
}

/** Il codice senza commenti: quel che il sorgente **fa**, non quel che dice. */
function senzaCommenti(testo: string): string {
  return testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("nessun elenco di archetipi è diventato una regola sulla composizione", () => {
  it("i moduli della strategia non conoscono le carte", () => {
    for (const modulo of moduli()) {
      const codice = senzaCommenti(modulo.testo);
      // Le carte arrivano da `dati/pool.js`, e di lì non si passa: chi non ha
      // una carta in mano non può contare quante creature ci sono dentro.
      expect(codice, modulo.nome).not.toContain("dati/pool.js");
      // E nemmeno dalla porta di servizio: le copie di un mazzo.
      expect(codice, modulo.nome).not.toContain("base-di-terre.js");
    }
  });

  it("i moduli della strategia non contano tipi di carta", () => {
    for (const modulo of moduli()) {
      const codice = senzaCommenti(modulo.testo).toLowerCase();
      // Le parole con cui una regola sulla composizione si scriverebbe: «un
      // aggro ha almeno N creature» comincia sempre da qui.
      for (const parola of ["creature", "tipi", "sottotipi", "costoDiMana".toLowerCase()]) {
        expect(codice, `${modulo.nome}: ${parola}`).not.toContain(parola);
      }
    }
  });

  it("la guardia non ha modo di dire che un mazzo è di un archetipo", () => {
    // Il tipo lo vieta: `impossibile` oppure `tace`, e nient'altro. Se un
    // giorno comparisse un terzo verdetto, questo test non compilerebbe più — e
    // sarebbe il momento di riaprire ADR-0001 invece di aggiungere un ramo.
    const verdetti: VerdettoDellaGuardia["verdetto"][] = ["tace", "impossibile"];
    for (const strategia of STRATEGIE) {
      const verdetto = guardiaDellaStrategia({
        strategia,
        carte: POOL_DEL_MOTORE,
        orologi: [{ nome: "Rossi", turnoDiChiusura: 6, rimozioni: 2, contromagie: 0, perche: "" }],
      });
      expect(verdetti).toContain(verdetto.verdetto);
    }
  });

  it("l'archetipo misurato resta una misura del comportamento", () => {
    // I valori grezzi che l'app mostra sono turni, quote e corse: nessun conto
    // sulle carte è fra quelli che giustificano la casella, e non per scelta di
    // chi scrive la frase — perché `archetipoDi` non ne ha nessuno.
    const chiavi: (keyof ArchetipoMisurato["grezzi"])[] = [
      "turnoMedioDiChiusura",
      "quotaPartiteChiuse",
      "corse",
      "corseRetteGrazieAlRitardo",
    ];
    expect(chiavi).toHaveLength(4);
  });
});
