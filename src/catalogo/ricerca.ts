/**
 * La ricerca per nome, tollerante ai refusi (storie 4 e 5).
 *
 * I nomi delle carte si **mostrano** in inglese per decisione di progetto (Q24),
 * perché devono corrispondere a quelli stampati e alle liste da torneo. Ma chi
 * li cerca non parla inglese: sbaglia una lettera, ne inverte due, ignora
 * accenti e apostrofi. La ricerca deve perdonare tutto questo senza mai
 * inventare risultati — «Goblin Chieftain» si trova scrivendo «goblim
 * chieftan», e «qwertyuiop» non trova niente.
 *
 * ## Perché si cerca anche in italiano, e non si mostra
 *
 * Il formato è definito dalle **stampe italiane** (`PROGETTO.md` §7, ADR-0005):
 * chi ci gioca ha in mano cartoncini italiani e alle carte pensa con quel nome
 * lì. Cercare solo in inglese vorrebbe dire chiedergli di tradurre prima di
 * poter chiedere.
 *
 * Mostrare l'italiano invece no, e la ragione sta in `PROGETTO.md` §7 sotto
 * Q24, coi numeri per esteso. In breve: il nome italiano c'è per tutte le carte
 * del pool, ma l'**immagine** italiana manca per una fetta consistente e il
 * **testo di regole** italiano su Scryfall non esiste quasi per nessuna. Una
 * interfaccia in italiano darebbe nome italiano, immagine a volte inglese e
 * testo sempre inglese — cioè tre lingue in una scheda. In più i prezzi sono
 * quelli delle stampe inglesi: mostrando l'inglese, nome e prezzo parlano della
 * stessa stampa.
 *
 * Da qui la forma di questo modulo: **due chiavi, un risultato**. Si cerca su
 * entrambi i nomi, e quel che esce è sempre la carta — che si mostra in inglese
 * come si è sempre mostrata.
 *
 * Nessun indice, nessuna libreria: un passaggio sul pool a ogni battuta — due,
 * da quando i nomi sono due. Sul pool vero costa pochi millisecondi, e un test
 * lo tiene fermo.
 */

import type { Carta } from "../dati/pool.js";

/**
 * Riduce un testo alla forma in cui lo si confronta: minuscole, senza accenti,
 * senza apostrofi né punteggiatura, con gli spazi ridotti a uno.
 *
 * Gli apostrofi spariscono invece di diventare spazi, perché «Krenko's» si
 * cerca scrivendo «krenkos».
 */
export function normalizza(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Il testo delle regole di una carta, normalizzato, calcolato una volta sola.
 *
 * Senza questa memoria, cercare una parola nel testo rinormalizzerebbe quasi
 * un megabyte di regole a ogni tasto premuto — sul telefono si sentirebbe. La
 * mappa è debole: se un giorno il pool venisse sostituito, il vecchio se ne va
 * da solo.
 */
const testiNormalizzati = new WeakMap<Carta, string>();

export function testoNormalizzato(carta: Carta): string {
  let pronto = testiNormalizzati.get(carta);
  if (pronto === undefined) {
    pronto = normalizza(carta.testo);
    testiNormalizzati.set(carta, pronto);
  }
  return pronto;
}

/**
 * Le parole del testo delle regole, come insieme.
 *
 * Serve a chiedere se una carta **nomina** qualcosa — un sottotipo, di solito —
 * senza che «Goblin» si trovi dentro «Goblinoid»: cercare la parola intera è la
 * sola lettura che non inventi corrispondenze.
 */
const paroleDeiTesti = new WeakMap<Carta, ReadonlySet<string>>();

export function paroleDelTesto(carta: Carta): ReadonlySet<string> {
  let pronte = paroleDeiTesti.get(carta);
  if (pronte === undefined) {
    pronte = new Set(testoNormalizzato(carta).split(" ").filter((parola) => parola !== ""));
    paroleDeiTesti.set(carta, pronte);
  }
  return pronte;
}

/**
 * I nomi normalizzati costano più della ricerca stessa: si calcolano una volta
 * sola per nome e restano qui. La mappa cresce quanto il pool, e il pool è uno.
 */
const normalizzati = new Map<string, string>();

function nomeNormalizzato(nome: string): string {
  let pronto = normalizzati.get(nome);
  if (pronto === undefined) {
    pronto = normalizza(nome);
    normalizzati.set(nome, pronto);
  }
  return pronto;
}

/**
 * Quanti errori si perdonano, in funzione di quanto si è scritto: su una parola
 * corta un errore cambia la parola, su una lunga è solo un dito storto.
 */
function erroriPerdonati(lunghezza: number): number {
  if (lunghezza < 4) return 0;
  if (lunghezza < 8) return 1;
  return 2;
}

/**
 * Distanza di modifica fra due parole — sostituzioni, inserimenti, rimozioni e
 * scambi di due lettere vicine — che si ferma appena supera il tetto.
 *
 * Restituisce `null` quando la distanza è oltre il tetto: al chiamante non
 * serve sapere quanto oltre, e fermarsi presto è ciò che tiene la ricerca
 * istantanea sull'intero pool.
 */
export function distanza(a: string, b: string, tetto: number): number | null {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tetto) return null;
  if (a.length === 0 || b.length === 0) return Math.max(a.length, b.length);

  let precedente: number[] = [];
  let corrente: number[] = [];
  let duePrima: number[] = [];

  for (let j = 0; j <= b.length; j += 1) precedente[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    corrente = new Array<number>(b.length + 1);
    corrente[0] = i;
    let minimoDiRiga = i;

    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let valore = Math.min(
        (corrente[j - 1] as number) + 1,
        (precedente[j] as number) + 1,
        (precedente[j - 1] as number) + costo,
      );
      // Lo scambio di due lettere vicine («porspector») è un errore solo, non due.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valore = Math.min(valore, (duePrima[j - 2] as number) + 1);
      }
      corrente[j] = valore;
      if (valore < minimoDiRiga) minimoDiRiga = valore;
    }

    if (minimoDiRiga > tetto) return null;
    duePrima = precedente;
    precedente = corrente;
  }

  const finale = precedente[b.length] as number;
  return finale > tetto ? null : finale;
}

/**
 * Quanto bene un nome risponde a una domanda: **più basso è, meglio è**, e
 * `null` vuol dire che non risponde affatto.
 *
 * I gradini, dal migliore: nome esatto, nome che comincia così, parola che
 * comincia così, nome che contiene, e infine il nome o una sua parola a un paio
 * di errori di distanza.
 */
export function corrispondenza(domanda: string, nome: string): number | null {
  const cercato = nomeNormalizzato(nome);
  if (cercato === domanda) return 0;
  if (cercato.startsWith(domanda)) return 1;

  const parole = cercato.split(" ");
  if (parole.some((parola) => parola.startsWith(domanda))) return 2;
  if (cercato.includes(domanda)) return 3;

  const tetto = erroriPerdonati(domanda.length);
  if (tetto === 0) return null;

  const interoNome = distanza(domanda, cercato, tetto);
  if (interoNome !== null) return 4 + interoNome;

  let migliore: number | null = null;
  for (const parola of parole) {
    const errori = distanza(domanda, parola, tetto);
    if (errori !== null && (migliore === null || errori < migliore)) migliore = errori;
  }
  return migliore === null ? null : 4 + migliore;
}

/**
 * Quanto bene una **carta** risponde a una domanda, guardando tutti i nomi che
 * porta: l'inglese, che è quello che si mostra, e l'italiano, che è quello con
 * cui spesso la si pensa.
 *
 * Vale il migliore dei due, e non la loro somma: i gradini di `corrispondenza`
 * dicono *quanto bene* si è indovinato, e aver indovinato in una lingua sola è
 * aver indovinato. Chi scrive il nome inglese per intero resta davanti a chi
 * gli assomiglia in italiano, perché il gradino dell'esatto è più basso di
 * qualunque gradino approssimato — in qualsiasi lingua.
 *
 * Il nome italiano assente non è un guasto e non vale come risposta storta: la
 * carta risponde in inglese come ha sempre fatto.
 *
 * Assente si chiede col `typeof` e non con un `=== null`, ed è l’unico campo di
 * questo modulo a meritarlo. Il nome inglese c’è da sempre; l’italiano è nato
 * dopo, e `carica-pool.ts` lo riscrive per i pool che non lo avevano — senza
 * però controllare le carte una per una, che sarebbe un secondo posto in cui è
 * scritta la forma dei dati. Il pool però arriva anche dal deposito del
 * dispositivo, e un campo scritto storto là dentro costerebbe caro proprio qui:
 * questa funzione gira a ogni battuta, e cadendo si porterebbe via il catalogo
 * intero invece di una carta sola.
 */
export function corrispondenzaDellaCarta(domanda: string, carta: Carta): number | null {
  const inglese = corrispondenza(domanda, carta.nome);
  if (typeof carta.nomeItaliano !== "string") return inglese;

  const italiano = corrispondenza(domanda, carta.nomeItaliano);
  if (inglese === null) return italiano;
  if (italiano === null) return inglese;
  return Math.min(inglese, italiano);
}

/**
 * Le carte che rispondono alla domanda, dalla più pertinente alla meno.
 *
 * Senza domanda si restituisce tutto nell'ordine ricevuto: il catalogo a riposo
 * è il pool, in ordine alfabetico, non una classifica.
 */
export function cercaPerNome(carte: readonly Carta[], domanda: string): Carta[] {
  const cercato = normalizza(domanda);
  if (cercato.length === 0) return [...carte];

  const trovate: { carta: Carta; punteggio: number }[] = [];
  for (const carta of carte) {
    const punteggio = corrispondenzaDellaCarta(cercato, carta);
    if (punteggio !== null) trovate.push({ carta, punteggio });
  }

  // A parità di pertinenza l'ordine alfabetico: due liste uguali non devono mai
  // dipendere dall'ordine in cui il pool è capitato.
  trovate.sort(
    (a, b) => a.punteggio - b.punteggio || a.carta.nome.localeCompare(b.carta.nome, "en"),
  );
  return trovate.map((trovata) => trovata.carta);
}
