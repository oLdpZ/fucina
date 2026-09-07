/**
 * Le note legali richieste da `PROGETTO.md` §5.
 *
 * Sono la condizione che rende legittimo l'uso dei dati delle carte, insieme
 * alla gratuità dell'app (Q32). Stanno qui come dati, non come marcatura, così
 * che un test possa verificarne la presenza senza guardare l'interfaccia.
 */

export type IdNotaLegale =
  | "politica-contenuti-fan"
  | "copyright-wizards"
  | "non-approvata-wizards"
  | "non-approvata-scryfall"
  | "prezzi"
  | "gratuita";

export type NotaLegale = {
  readonly id: IdNotaLegale;
  readonly testo: string;
  readonly collegamento?: { readonly etichetta: string; readonly url: string };
};

export const NOTE_LEGALI: readonly NotaLegale[] = [
  {
    id: "politica-contenuti-fan",
    testo:
      "Questa applicazione è un contenuto dei fan, realizzato nel rispetto della politica sui contenuti dei fan di Wizards of the Coast.",
    collegamento: {
      etichetta: "Politica sui contenuti dei fan",
      url: "https://company.wizards.com/en/legal/fancontentpolicy",
    },
  },
  {
    id: "copyright-wizards",
    testo:
      "Il materiale letterale delle carte, i nomi, le illustrazioni e Magic: The Gathering sono © Wizards of the Coast LLC.",
  },
  {
    id: "non-approvata-wizards",
    testo:
      "Questa applicazione non è prodotta né approvata da Wizards of the Coast.",
  },
  {
    id: "non-approvata-scryfall",
    testo:
      "I dati delle carte vengono da Scryfall. Scryfall non produce né approva questa applicazione.",
  },
  {
    // `PROGETTO.md` §5 la chiede fra le note: «prezzi a titolo informativo, con
    // data di aggiornamento». La data non si scrive qui — è quella del pool, e
    // cambia — ma qui si dice **da dove vengono** e **di quali stampe sono**,
    // che è la parte che il giocatore non potrebbe indovinare: il prezzo è
    // quello della copia ammessa più economica che un listino ce l'abbia, e la
    // copia che troverà da comprare può essere un'altra.
    id: "prezzi",
    testo:
      "I prezzi sono a titolo informativo: vengono da Cardmarket attraverso Scryfall, portano sempre la data del giorno in cui sono stati presi, e sono quelli delle copie più economiche, fra quelle che il formato ammette, che un listino ce l'abbiano. La copia che troverai da comprare può costare di più.",
  },
  {
    id: "gratuita",
    testo:
      "L'applicazione è gratuita e senza scopo di lucro: nessuna pubblicità, nessun abbonamento, nessun link d'acquisto remunerato.",
  },
];
