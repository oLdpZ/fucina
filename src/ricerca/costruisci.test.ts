/**
 * La ricerca a scambi singoli, verificata **dalla cucitura principale**:
 * `costruisciMazzo(richiesta, pool)`.
 *
 * `spec.md` lo chiede così, e il ticket 11 lo ripete: i test entrano da qui e
 * usano il pool finto scritto a mano, non l'archivio Scryfall vero. Quel che si
 * asserisce sono **proprietà** — il mazzo è legale, le esclusioni non si
 * violano, la stessa richiesta dà la stessa uscita — e mai il valore di un peso
 * che alla sosta cambierà.
 *
 * L'orologio arriva da fuori come il seme: è l'unico modo di provare il tetto
 * di tempo senza far dipendere un test dalla velocità della macchina che lo
 * esegue.
 */

import { describe, expect, it } from "vitest";

import { POOL_DEL_MOTORE, TERRE_FINTE } from "../catalogo/pool-finto.js";
import { COMBO_VUOTA } from "../combo/combo.js";
import { TURNO_DELLA_COMBO } from "../combo/taratura.js";
import type { Carta } from "../dati/pool.js";
import { COPIE_DI_UNA_LIMITATA, copieMassime } from "../mazzo/copie.js";
import { probabilitaDiAssemblarne } from "../mazzo/probabilita.js";
import { COPIE_MASSIME, DIMENSIONE_MAZZO } from "../mazzo/taratura.js";
import { escluso, FILTRO_TEMA_VUOTO, TEMA_VUOTO, type Tema } from "../tema/tema.js";
import { analizzaBaseDiTerre } from "../mazzo/base-di-terre.js";
import { comprabile, contoDelMazzo, PARI_IN_EURO } from "../mazzo/spesa.js";
import { costruisciMazzo, type Frontiera, type Opzioni, type Richiesta } from "./costruisci.js";
import { PESI_DELLA_PUREZZA } from "./taratura.js";

const POOL: readonly Carta[] = [...POOL_DEL_MOTORE, ...TERRE_FINTE];

/** Un orologio fermo: la ricerca non viene mai troncata dal tempo. */
const OROLOGIO_FERMO = () => 0;

/**
 * Le manopole strette apposta per i test: la ricerca fa poche valutazioni e
 * simula poche partite, così la suite gira in un lampo. Sono le stesse
 * manopole che `taratura.ts` dichiara provvisorie — passarle da fuori è il modo
 * di misurarle alla sosta, e qui serve a non aspettare.
 */
const SVELTA: Opzioni = {
  orologio: OROLOGIO_FERMO,
  taratura: {
    partenze: 2,
    partiteInRicerca: 12,
    valutazioniMassimePerPartenza: 60,
    candidatiMassimi: 40,
  },
};

function tema(parti: Partial<Tema>): Tema {
  return { ...TEMA_VUOTO, ...parti };
}

const GOBLIN = tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] } });

/**
 * Il tema nero: è quello che pesca dalla metà del pool dove stanno la carta
 * limitata e quella che si concede copie illimitate, e serve ai test della
 * legalità qui sotto.
 */
const NERO = tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] } });

/** Ogni voce di ogni mazzo della frontiera: la legalità si guarda su tutti. */
function tutteLeVoci(frontiera: Frontiera) {
  return frontiera.mazzi.flatMap((mazzo) => [...mazzo.carte, ...mazzo.terre]);
}

function richiesta(parti: Partial<Richiesta> = {}): Richiesta {
  return {
    tema: GOBLIN,
    combo: COMBO_VUOTA,
    seme: 7,
    tempoMassimoMs: 10_000,
    // Spento, come nell'app: il fulcro è il tasso di cambio fra tema e
    // potenza, e un budget acceso di default ne metterebbe un secondo accanto.
    tettoDiSpesa: null,
    ...parti,
  };
}

function costruisci(parti: Partial<Richiesta> = {}, opzioni: Opzioni = SVELTA): Frontiera {
  return costruisciMazzo(richiesta(parti), POOL, opzioni);
}

/**
 * Un pool minuscolo: `quante` carte da quattro copie e **una terra sola**, da
 * quattro copie anche lei.
 *
 * Le carte a copie **illimitate** restano fuori apposta, e così le terre base:
 * una sola delle prime riempirebbe sessanta posti da sé, e le seconde ne
 * concedono infinite — con dentro una qualsiasi delle due il caso sparirebbe.
 */
function poolMinuscolo(quante: number): readonly Carta[] {
  return [
    ...POOL_DEL_MOTORE.filter(
      (carta) => carta.terra === null && carta.tettoDiCopie === COPIE_MASSIME,
    ).slice(0, quante),
    ...TERRE_FINTE.filter((carta) => carta.nome === "Sootfall Gate"),
  ];
}

/** Tutte le voci del mazzo, carte e terre insieme, come si conta una lista. */
function voci(frontiera: Frontiera) {
  const mazzo = frontiera.mazzi[0];
  expect(mazzo).toBeDefined();
  return [...mazzo!.carte, ...mazzo!.terre];
}

function carteTotali(frontiera: Frontiera): number {
  return voci(frontiera).reduce((somma, voce) => somma + voce.copie, 0);
}

function nomi(frontiera: Frontiera): string[] {
  return voci(frontiera).map((voce) => voce.carta.nome);
}

/** L'uscita ridotta a quel che l'utente vedrebbe: la lista, in ordine. */
function lista(frontiera: Frontiera): string {
  return JSON.stringify(voci(frontiera).map((voce) => [voce.carta.nome, voce.copie]));
}

describe("il primo mazzo costruito dall'app", () => {
  it("torna una frontiera di mazzi, e il primo è quello che l'utente ha chiesto", () => {
    const frontiera = costruisci();
    expect(frontiera.esito).toBe("costruito");
    expect(frontiera.mazzi.length).toBeGreaterThan(0);
  });

  it("è legale: sessanta carte, e nessuna carta oltre il tetto che si porta dietro", () => {
    const frontiera = costruisci();
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);

    // Il tetto lo dice la **carta**, non questo test: rileggerlo qui dal testo
    // o dai tipi vorrebbe dire provare il motore contro una seconda copia della
    // regola, che è il modo di non accorgersi mai che le due divergono.
    for (const voce of voci(frontiera)) {
      expect(voce.copie).toBeLessThanOrEqual(copieMassime(voce.carta));
      expect(voce.copie).toBeGreaterThan(0);
    }
  });

  it("resta a sessanta anche quando le carte giocabili sono appena quelle", () => {
    // Nove carte fanno trentasei copie: bastano a un mazzo con ventiquattro
    // terre, e non a uno con venti. I posti non-terra devono scendere a quel
    // che il pool sa dare, se no esce un mazzo da cinquantotto carte annunciato
    // come se fosse a posto.
    const poche = [...POOL_DEL_MOTORE.slice(0, 9), ...TERRE_FINTE];
    const frontiera = costruisciMazzo(richiesta(), poche, SVELTA);

    expect(frontiera.mazzi.length).toBeGreaterThan(0);
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
  });

  it("le copie illimitate non contano come un mazzo intero quando si conta se si può fare", () => {
    // Una carta che si concede copie illimitate ne mette comunque quattro nel
    // mazzo che l'app costruisce: contarla per trentatré direbbe «si fa» a un
    // pool che non ci arriva.
    const illimitata = POOL_DEL_MOTORE.find((carta) =>
      /any number of cards named/i.test(carta.testo),
    );
    expect(illimitata).toBeDefined();
    const scarso = [
      illimitata!,
      ...POOL_DEL_MOTORE.filter((carta) => carta !== illimitata).slice(0, 7),
      ...TERRE_FINTE,
    ];
    const frontiera = costruisciMazzo(richiesta(), scarso, SVELTA);

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
  });

  it("sa mettere nel mazzo una terra che non fa colori ma fa qualcosa", () => {
    // Le terre di utilità sono metà di quel che definisce questo formato, e fino
    // al ticket 08 non potevano entrare in un mazzo per nessuna strada: gli
    // incantesimi candidati escludono ogni terra, il catalogo non le fa
    // aggiungere a mano, e la base voleva due colori di identità. Un motore che
    // non le sa mettere costruisce mazzi legali e sbagliati.
    const terre = costruisci().mazzi[0]!.terre;
    const utilita = terre.filter(
      (voce) => !voce.carta.tipi.includes("Basic") && voce.carta.tag.length > 0,
    );

    expect(utilita.length).toBeGreaterThan(0);
    expect(costruisci().mazzi[0]!.base.terreDiUtilita).toBeGreaterThan(0);
  });

  it("le terre che il mazzo porta sono quelle che la sua curva chiede", () => {
    const mazzo = costruisci().mazzi[0]!;
    expect(mazzo.base.numeroTerre).toBe(mazzo.base.numeroTerreDallaCurva);
  });

  it("non mette in campo nessun nome che il pool non contenga", () => {
    const delPool = new Set(POOL.map((carta) => carta.nome));
    for (const nome of nomi(costruisci())) expect(delPool.has(nome)).toBe(true);
    // E nessuna carta compare due volte nella lista: quattro copie sono una riga.
    expect(new Set(nomi(costruisci())).size).toBe(nomi(costruisci()).length);
  });

  it("porta con sé la base di terre, la simulazione e le componenti", () => {
    const mazzo = costruisci().mazzi[0]!;
    expect(mazzo.terre.length).toBeGreaterThan(0);
    expect(mazzo.simulazione.partite).toBeGreaterThan(0);
    expect(Object.keys(mazzo.punteggio)).toEqual([
      "velocita",
      "curva",
      "colori",
      "sinergia",
      "qualita",
      "corsa",
    ]);
    // Senza orologi dichiarati la sesta non esiste, e la ricerca ordina i mazzi
    // esattamente come li ordinava prima che la corsa fosse scritta.
    expect(mazzo.punteggio.corsa).toBeNull();
  });
});

describe("la legalità, che è un dato della carta e non un controllo a valle", () => {
  it("nessuna carta supera il proprio tetto, in nessun mazzo della frontiera", () => {
    for (const voce of tutteLeVoci(costruisciMazzo(richiesta({ tema: NERO }), POOL, SVELTA))) {
      expect(voce.copie).toBeLessThanOrEqual(copieMassime(voce.carta));
    }
  });

  it("una carta limitata non compare mai due volte, per quanto forte sia", () => {
    const frontiera = costruisciMazzo(richiesta({ tema: NERO }), POOL, SVELTA);
    const limitate = tutteLeVoci(frontiera).filter(
      (voce) => voce.carta.tettoDiCopie === COPIE_DI_UNA_LIMITATA,
    );

    // Che ce ne sia almeno una è metà del test, e la metà che conta: se il
    // motore le scartasse tutte questa asserzione cadrebbe, e l'altra passerebbe
    // per vuota.
    expect(limitate.length).toBeGreaterThan(0);
    for (const voce of limitate) expect(voce.copie).toBe(COPIE_DI_UNA_LIMITATA);
  });

  it("la limitata più forte del pool entra lo stesso: non si butta il mazzo, si mette una copia", () => {
    // Nel pool finto la limitata è l'artefatto a costo zero, cioè la carta più
    // forte che ci sia — come nel formato vero. Un motore che controllasse la
    // legalità **a valle**, scartando i mazzi illegali, su un pool così
    // scarterebbe quasi sempre: o non costruirebbe niente, o consegnerebbe
    // mazzi senza le carte migliori. Qui la carta c'è, una volta sola.
    const forte = POOL_DEL_MOTORE.find(
      (carta) => carta.tettoDiCopie === COPIE_DI_UNA_LIMITATA && carta.valoreDiMana === 0,
    );
    expect(forte).toBeDefined();

    const frontiera = costruisciMazzo(richiesta({ tema: NERO }), POOL, SVELTA);
    expect(frontiera.esito).not.toBe("niente-da-costruire");

    const dove = tutteLeVoci(frontiera).filter((voce) => voce.carta.nome === forte!.nome);
    expect(dove.length).toBeGreaterThan(0);
    for (const voce of dove) expect(voce.copie).toBe(1);
  });

  it("una carta col permesso nel testo non supera le quattro copie, nemmeno per scambio", () => {
    // «A deck can have any number of cards named …»: il permesso è scritto sulla
    // carta e il formato lo concede, ma l'app ne mette quattro — è quel che
    // `copieAlMassimo` promette a chi conta la capienza, a chi riempie e a chi
    // lo racconta. Lo scambio leggeva il tetto nudo, e ogni scambio accettato ne
    // aggiungeva una senza che niente la ritirasse. Il tema qui è il sottotipo
    // che quella carta ha da sola, così la ricerca ha tutte le ragioni di
    // volerne di più.
    const illimitata = POOL_DEL_MOTORE.find((carta) => carta.tettoDiCopie === null);
    expect(illimitata).toBeDefined();

    const suo = tema({
      inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: illimitata!.sottotipi },
    });
    const frontiera = costruisciMazzo(richiesta({ tema: suo }), POOL, SVELTA);

    const copie = tutteLeVoci(frontiera)
      .filter((voce) => voce.carta.nome === illimitata!.nome)
      .map((voce) => voce.copie);
    // Che ci sia è metà del test: se la ricerca la lasciasse fuori, il tetto
    // passerebbe per vuoto.
    expect(copie.length).toBeGreaterThan(0);
    expect(Math.max(...copie)).toBe(COPIE_MASSIME);
  });

  it("il motore non sa quali carte siano limitate: cambia il dato, cambia il mazzo", () => {
    // La prova che il formato non vive nel sorgente. Si prende lo stesso pool e
    // si limita a mano una carta qualunque — è quel che farebbe il documento di
    // formato — e il mazzo che ne esce la rispetta, senza che nessuna riga di
    // codice sappia il suo nome.
    const vittima = POOL_DEL_MOTORE.find((carta) => carta.nome === "Nightfall Herald");
    expect(vittima).toBeDefined();
    const limitato: readonly Carta[] = POOL.map((carta) =>
      carta.nome === vittima!.nome ? { ...carta, tettoDiCopie: COPIE_DI_UNA_LIMITATA } : carta,
    );

    const prima = costruisciMazzo(richiesta({ tema: NERO }), POOL, SVELTA);
    const dopo = costruisciMazzo(richiesta({ tema: NERO }), limitato, SVELTA);

    const quante = (frontiera: Frontiera) =>
      Math.max(
        0,
        ...tutteLeVoci(frontiera)
          .filter((voce) => voce.carta.nome === vittima!.nome)
          .map((voce) => voce.copie),
      );

    expect(quante(prima)).toBeGreaterThan(1);
    expect(quante(dopo)).toBeLessThanOrEqual(COPIE_DI_UNA_LIMITATA);
  });
});

describe("il tema, che la ricerca non tradisce", () => {
  it("costruisce un mazzo quasi tutto nel tema, molto più puro del pool da cui pesca", () => {
    const frontiera = costruisci();
    // Nel pool finto i Goblin sono una minoranza: un mazzo che pescasse a caso
    // avrebbe la purezza di quella minoranza, e questo dev'essere ben di più.
    const quotaNelPool =
      POOL_DEL_MOTORE.filter((carta) => carta.sottotipi.includes("Goblin")).length /
      POOL_DEL_MOTORE.length;
    expect(frontiera.mazzi[0]!.purezza).toBeGreaterThan(quotaNelPool * 2);
    expect(frontiera.mazzi[0]!.purezza).toBeGreaterThan(0.8);
  });

  it("non viola mai le esclusioni, nemmeno quando violarle alzerebbe il punteggio", () => {
    // Le carte più forti del pool costano tre o più: escluderle è chiedere alla
    // ricerca di rinunciare al punteggio, ed è quel che deve fare.
    const stretto = tema({
      inclusioni: GOBLIN.inclusioni,
      esclusioni: { ...FILTRO_TEMA_VUOTO, costoMinimo: 3 },
    });
    const frontiera = costruisci({ tema: stretto });

    // I Goblin che restano non bastano più a riempire il mazzo, e l'esito lo
    // dice: il resto arriva da fuori tema. Ma dell'esclusione non passa niente,
    // ed è il punto — le carte da tre mana in su erano le più forti del pool.
    expect(frontiera.esito).toBe("costruito-fuori-tema");
    for (const voce of frontiera.mazzi[0]!.carte) {
      expect(voce.carta.valoreDiMana).toBeLessThan(3);
    }
  });

  it("le esclusioni valgono anche per le terre, che pure le sceglie l'app", () => {
    const senzaTerre = tema({
      inclusioni: GOBLIN.inclusioni,
      esclusioni: { ...FILTRO_TEMA_VUOTO, tipi: ["Land"] },
    });
    const frontiera = costruisci({ tema: senzaTerre });

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
    expect(frontiera.motivo).toContain("terre");
  });

  it("dichiara gli allargamenti che il tema porta con sé, senza aggiungerne", () => {
    expect(costruisci().allargamentiApplicati).toEqual([]);
  });

  it("col tetto acceso non incolpa il tema delle carte che ha tolto il prezzo", () => {
    // Il guasto del ticket 52: la frase metteva accanto due popolazioni che non
    // si confrontano. Le carte distinte le contava `valutaTema`, che il prezzo
    // non lo guarda, e i posti uscivano dal pool già filtrato dal tetto — «10
    // carte, buone per 36 posti» dove quelle 10 bastavano per 40.
    //
    // Qui metà dei Goblin costa cento volte il tetto: la frase deve contare
    // **solo gli altri**, e dire a parte che le prime le ha tolte il tetto.
    // Niente nomi e niente euro scritti a mano — l'attesa si ricava dal pool.
    const TETTO = 10;
    const goblin = (carta: Carta) => carta.terra === null && carta.sottotipi.includes("Goblin");
    const rincarati = new Set(POOL.filter(goblin).filter((_, quale) => quale % 2 === 0));
    const pool = POOL.map((carta) =>
      rincarati.has(carta)
        ? { ...carta, prezzo: { ...carta.prezzo, euro: TETTO * 100 } }
        : carta,
    );
    const frontiera = costruisciMazzo(richiesta({ tettoDiSpesa: TETTO }), pool, SVELTA);
    const comprabili = pool.filter((carta) => goblin(carta) && comprabile(carta, TETTO));

    // L'attesa qui sotto legge il plurale: se un giorno il pool finto avesse
    // due o tre Goblin soli, la frase direbbe «Un'altra carta del tema» e
    // questo test fallirebbe parlando di un guasto che non c'è.
    expect(rincarati.size).toBeGreaterThan(1);

    expect(frontiera.esito).toBe("costruito-fuori-tema");
    // Il numero delle carte viene dalla stessa popolazione della capienza:
    // quelle che il tetto lascia comprare, non tutte quelle del tema.
    expect(frontiera.motivo).toContain(`${comprabili.length} carte`);
    expect(frontiera.motivo).not.toContain(`${POOL.filter(goblin).length} carte dal pool`);
    // E quel che ha tolto il tetto porta il nome di chi l'ha tolto.
    expect(frontiera.motivo).toMatch(/tetto/);
    expect(frontiera.motivo).toContain(`${rincarati.size} carte del tema`);
  });
});

describe("il determinismo, che è un vincolo non negoziabile", () => {
  it("stessa richiesta due volte, uscita identica", () => {
    expect(lista(costruisci())).toBe(lista(costruisci()));
  });

  it("il seme governa la ricerca: seme diverso, ricerca diversa", () => {
    // Non si pretende un mazzo diverso — due partenze possono convergere allo
    // stesso posto, ed è un buon segno — ma la ricerca dev'essere passata da
    // strade diverse, e le partenze provate sono quelle dichiarate.
    const uno = costruisci({ seme: 1 });
    const altro = costruisci({ seme: 2 });
    expect(uno.partenze).toBe(2);
    expect(altro.partenze).toBe(2);
    expect(uno.scambiProvati).toBeGreaterThan(0);
  });

  it("non tocca l'orologio di sistema né il caso non seminato", () => {
    const oraDiSistema = Date.now;
    const casoDiSistema = Math.random;
    const prestazioni = performance.now;
    const vietato = () => {
      throw new Error("la ricerca ha guardato fuori dalla sua richiesta");
    };
    Date.now = vietato;
    Math.random = vietato;
    performance.now = vietato;
    try {
      expect(carteTotali(costruisci())).toBe(DIMENSIONE_MAZZO);
    } finally {
      Date.now = oraDiSistema;
      Math.random = casoDiSistema;
      performance.now = prestazioni;
    }
  });
});

describe("il tetto di tempo, perché la ricerca gira sul telefono", () => {
  it("superato il tetto torna comunque un mazzo legale, e lo dichiara troncato", () => {
    // Un orologio che salta di cento millisecondi a ogni sguardo: il tetto è
    // superato prima ancora del primo scambio.
    let quando = 0;
    const frontiera = costruisci(
      { tempoMassimoMs: 50 },
      { ...SVELTA, orologio: () => (quando += 100) },
    );

    expect(frontiera.troncataPerTempo).toBe(true);
    expect(frontiera.esito).toBe("costruito");
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
  });

  it("con tempo in abbondanza non dichiara nessun troncamento", () => {
    expect(costruisci().troncataPerTempo).toBe(false);
  });

  it("un no che arriva dopo una ricerca troncata lo dichiara, invece di darsi per completo", () => {
    // Il tetto lascia passare il controllo preventivo — le sessanta carte meno
    // care ci stanno — e poi la ricerca non trova niente. È l'unica uscita che
    // arriva **dopo** che il motore ha girato, e diceva «non troncata» come
    // tutte le altre: l'app annunciava «un mazzo dentro quella cifra non c'è»
    // avendo guardato metà di quel che poteva, e la nota del tempo restava
    // nascosta proprio quando serviva.
    let quando = 0;
    const frontiera = costruisci(
      { tema: NERO, tettoDiSpesa: 4 },
      { ...SVELTA, orologio: () => (quando += 100) },
    );

    expect(frontiera.mazzi).toEqual([]);
    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.troncataPerTempo).toBe(true);
  });

  it("i contatori di una ricerca girata sono quelli veri anche quando non esce nessun mazzo", () => {
    // Sono i numeri con cui alla sosta si tara la ricerca, e i casi in cui non
    // si costruisce niente sono i più interessanti da guardare: azzerarli qui
    // li faceva sparire proprio da lì.
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 4 });

    expect(frontiera.mazzi).toEqual([]);
    expect(frontiera.partenze).toBeGreaterThan(0);
    expect(frontiera.scambiProvati).toBeGreaterThan(0);
  });

  it("le uscite che precedono la ricerca dicono zero e non troncata, perché per loro è la verità", () => {
    // Senza tema non si è mai cercato niente: dichiarare partenze o troncamenti
    // sarebbe inventarsi un lavoro che nessuno ha fatto.
    const frontiera = costruisci({ tema: TEMA_VUOTO });

    expect(frontiera.esito).toBe("tema-non-dichiarato");
    expect(frontiera.troncataPerTempo).toBe(false);
    expect(frontiera.partenze).toBe(0);
    expect(frontiera.scambiProvati).toBe(0);
    expect(frontiera.scambiTenuti).toBe(0);
  });

  it("il consiglio su quanto alzare il tetto dice se viene da una ricerca finita o interrotta", () => {
    // Sono due consigli diversi. Da una ricerca finita, «alzando fin lì può
    // bastare» è un'indicazione; da una interrotta, quel numero è il minimo di
    // metà pool, e alzare fin lì può non bastare affatto.
    const finita = costruisci({ tema: NERO, tettoDiSpesa: 4 });
    let quando = 0;
    const interrotta = costruisci(
      { tema: NERO, tettoDiSpesa: 4 },
      { ...SVELTA, orologio: () => (quando += 100) },
    );

    expect(finita.motivo).not.toMatch(/tempo/i);
    expect(interrotta.motivo).toMatch(/tempo/i);
  });

  it("racconta l'avanzamento mentre lavora, così l'interfaccia ha che dire", () => {
    const passi: number[] = [];
    costruisci({}, { ...SVELTA, avanzamento: (a) => passi.push(a.partenza) });
    expect(passi.length).toBeGreaterThan(0);
    expect(Math.max(...passi)).toBeLessThan(2);
  });
});

describe("i temi degeneri, che devono dare un esito e mai un crollo", () => {
  it("un tema che non prende nessuna carta costruisce lo stesso, e lo dice", () => {
    const inesistente = tema({
      inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Kavu"] },
    });
    const frontiera = costruisci({ tema: inesistente });

    expect(frontiera.esito).toBe("costruito-fuori-tema");
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
    expect(frontiera.mazzi[0]!.purezza).toBe(0);
    expect(frontiera.motivo).toContain("0");
  });

  it("un tema che lascia una carta sola non fa un mazzo di quella, e lo dice", () => {
    const unaSola = tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Sphinx"] } });
    const frontiera = costruisci({ tema: unaSola });

    expect(frontiera.esito).toBe("costruito-fuori-tema");
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
    for (const voce of frontiera.mazzi[0]!.carte) {
      expect(voce.copie).toBeLessThanOrEqual(COPIE_MASSIME);
    }
  });

  it("un tema che esclude tutti i colori non lascia niente da costruire, e lo dice", () => {
    const nessunColore = tema({
      inclusioni: GOBLIN.inclusioni,
      esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["W", "U", "B", "R", "G"] },
    });
    const frontiera = costruisci({ tema: nessunColore });

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
    expect(frontiera.motivo.length).toBeGreaterThan(0);
  });

  it("un pool che non fa sessanta copie non consegna un mazzo nemmeno a tetto spento", () => {
    // Il controllo gemello di quello sui posti non-terra, e per la stessa
    // ragione: «un mazzo intero oppure niente, mai un mazzo corto». Viveva
    // dentro il racconto del tetto di spesa, che a tetto spento è `null`, e da
    // quella strada la ricerca proseguiva e consegnava trentanove carte
    // chiamandole un mazzo costruito. Contare le copie non è una domanda sul
    // prezzo, e si fa sempre.
    // Dieci carte da quattro copie e una terra a due colori: quaranta posti
    // non-terra, che bastano ai trentatré del verdetto e non bastano a un
    // mazzo. Le terre base restano fuori dal pool apposta, ed è anche la
    // ragione per cui i posti di terra sono zero (ticket 39).
    const frontiera = costruisciMazzo(richiesta(), poolMinuscolo(10), SVELTA);

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
    // E non nomina un tetto che non c'è.
    expect(frontiera.spesa).toBeNull();
    expect(frontiera.motivo).not.toMatch(/Dentro|€/);
    // Né scrive «1 terre», che è la frase di nessuno.
    expect(frontiera.motivo).toContain("1 terra:");
  });

  it("i posti non-terra che avanzano non tappano il buco delle terre", () => {
    // Le copie disponibili non si sommano e basta: le due parti di un mazzo non
    // si sostituiscono a vicenda. Quattordici carte giocabili da quattro copie
    // fanno cinquantasei copie — e un mazzo non ne prende più di quaranta,
    // perché alle terre ne restano venti. Le sedici che avanzano non sono
    // terre: sommando si diceva «sessanta ci sono» sopra trentotto carte.
    //
    // Il conto si legge dal **numero nel no**, e non dall'esito: qui le terre
    // base non ci sono e i posti di terra sono zero comunque (ticket 39), così
    // l'esito da solo non distinguerebbe più quaranta da cinquantasei.
    const frontiera = costruisciMazzo(richiesta(), poolMinuscolo(14), SVELTA);

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
    expect(frontiera.motivo).toContain("40 posti non-terra");
    expect(frontiera.motivo).not.toContain("56 posti non-terra");
  });

  it("un tema che esclude tutte le terre base non consegna un mazzo senza terre", () => {
    // La guardia dei posti contava **le copie di terra che il pool concede**, e
    // le terre base non hanno tetto di copie: bastava che ne sopravvivesse una
    // perché il conto arrivasse al massimo. Ma `scegliTerre` è tutto-o-niente —
    // senza nessuna terra base esce con zero terre, mai con «meno terre» — e
    // dalle due cose insieme usciva un mazzo da trentotto carte e nessuna
    // terra, dato per costruito. Il conto dei posti deve fare la stessa domanda
    // che la base si farà dopo (ticket 39).
    const senzaBase = tema({
      inclusioni: GOBLIN.inclusioni,
      esclusioni: { ...FILTRO_TEMA_VUOTO, tipi: ["Basic"] },
    });
    const frontiera = costruisci({ tema: senzaBase });

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
    // E il no porta dentro il conto: quante terre il pool rimasto sa fare.
    expect(frontiera.motivo).toContain("0 di terre");
    // Col nome di quel che manca, se no «dodici terre buone per zero posti» si
    // legge come una contraddizione su cui non si può agire.
    expect(frontiera.motivo).toContain("terra base");
  });

  it("nessun mazzo consegnato porta meno di sessanta copie, comunque sia stato trovato", () => {
    // La rete all'uscita: `esito: "costruito"` con meno di `DIMENSIONE_MAZZO`
    // copie è una bugia a prescindere da chi l'ha prodotta, e chiude anche le
    // strade che oggi non si vedono (ticket 39).
    const temi: Tema[] = [
      GOBLIN,
      NERO,
      tema({ inclusioni: GOBLIN.inclusioni, esclusioni: { ...FILTRO_TEMA_VUOTO, tipi: ["Basic"] } }),
      tema({
        inclusioni: GOBLIN.inclusioni,
        esclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Plains", "Island", "Swamp", "Mountain", "Forest"] },
      }),
    ];

    for (const quale of temi) {
      const frontiera = costruisci({ tema: quale });
      for (const mazzo of frontiera.mazzi) {
        const copie = [...mazzo.carte, ...mazzo.terre].reduce(
          (somma, voce) => somma + voce.copie,
          0,
        );
        expect(copie).toBe(DIMENSIONE_MAZZO);
      }
    }
  });

  it("il verdetto e la frontiera non si contraddicono: a tema insufficiente l'esito lo dice", () => {
    // Il verdetto diceva «impossibile» e la frontiera consegnava quattro mazzi
    // (ticket 70). Il vincolo è morbido (Q14): quel che il tema da solo non
    // riempie lo riempiono carte fuori tema, e allora il verdetto dice quanto
    // il tema manca, non che il mazzo non esiste. Ma un tema insufficiente non
    // può dare un mazzo «costruito» col tema e basta: l'esito deve dirlo.
    // Zero, una e due carte: il tema che sta appena in piedi è l'ultimo, quello
    // che la sosta ha misurato sul pool vero con «Advisor». Qui nessun
    // sottotipo ne conta due, e i due si sommano.
    const temi: [carte: number, tema: Tema][] = [
      [0, tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Kavu"] } })],
      [1, tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Sphinx"] } })],
      [2, tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Sphinx", "Merfolk"] } })],
    ];

    for (const [carte, quale] of temi) {
      const frontiera = costruisci({ tema: quale });

      expect(frontiera.ampiezza.carteDisponibili).toBe(carte);
      expect(frontiera.ampiezza.verdetto).toBe("insufficiente");
      expect(frontiera.mazzi.length).toBeGreaterThan(0);
      expect(frontiera.esito).toBe("costruito-fuori-tema");
    }
  });

  it("senza tema non si costruisce niente, e non è un guasto", () => {
    const frontiera = costruisci({ tema: TEMA_VUOTO });
    expect(frontiera.esito).toBe("tema-non-dichiarato");
    expect(frontiera.mazzi).toHaveLength(0);
  });

  it("un pool senza carte non fa cadere niente", () => {
    const frontiera = costruisciMazzo(richiesta(), [], SVELTA);
    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
  });
});

describe("la frontiera: il tasso di cambio fra tema e potenza", () => {
  it("torna più mazzi, uno per peso della purezza, mai più dei pesi provati", () => {
    const frontiera = costruisci();
    expect(frontiera.mazzi.length).toBeGreaterThan(1);
    expect(frontiera.mazzi.length).toBeLessThanOrEqual(PESI_DELLA_PUREZZA.length);
  });

  it("si apre davvero: più mazzi distinti, purezza che cala e potenza che sale", () => {
    // Su un pool piccolo la frontiera può essere corta, e non è un guasto: dice
    // che lì il margine di scambio è piccolo. Ma **aprirsi deve poterlo**, se no
    // il fulcro del progetto non ha niente da mostrare. Il tema nero è quello
    // che nel pool finto ha più margine, e qui si guarda proprio lui.
    //
    // Su **più semi** e non su uno: quanto si apra dipende dal caso seminato, e
    // misurato sul pool finto un seme solo non dice niente — otto semi provati,
    // e la stessa frontiera va da due gradini a quattro senza che sia cambiato
    // niente se non il seme (ticket 73). Un seme solo qui dentro asserirebbe la
    // fortuna di quel seme, e cadrebbe alla prima taratura che sposta di un
    // niente la scelta delle carte. La proprietà è che **qualche volta si
    // apre**; che scenda sempre e salga sempre, invece, vale per ogni seme, e
    // si chiede per ognuno.
    const SEMI = [1, 2, 3, 4, 5, 6, 7, 8];

    let ilPiuAmpio = 0;
    for (const seme of SEMI) {
      const mazzi = costruisciMazzo(richiesta({ tema: NERO, seme }), POOL, SVELTA).mazzi;
      ilPiuAmpio = Math.max(ilPiuAmpio, mazzi.length);
      for (let i = 1; i < mazzi.length; i++) {
        expect(mazzi[i]!.purezza).toBeLessThan(mazzi[i - 1]!.purezza);
        expect(mazzi[i]!.potenza).toBeGreaterThan(mazzi[i - 1]!.potenza);
      }
    }

    expect(ilPiuAmpio).toBeGreaterThan(2);
  });

  it("nessun mazzo compare due volte: pesi diversi che danno lo stesso mazzo valgono uno", () => {
    const liste = costruisci().mazzi.map(
      (mazzo) =>
        JSON.stringify(
          [...mazzo.carte, ...mazzo.terre].map((voce) => [voce.carta.nome, voce.copie]),
        ),
    );
    expect(new Set(liste).size).toBe(liste.length);
  });

  it("è ordinata per purezza decrescente", () => {
    const purezze = costruisci().mazzi.map((mazzo) => mazzo.purezza);
    for (let i = 1; i < purezze.length; i++) {
      expect(purezze[i]!).toBeLessThan(purezze[i - 1]!);
    }
  });

  it("purezza e potenza si muovono in direzioni opposte", () => {
    // È il fulcro del progetto: scendendo lungo la frontiera si cede tema e si
    // guadagna potenza. Un mazzo che cedesse tema **senza** guadagnare niente
    // non avrebbe ragione di stare nella lista, e infatti non ci sta.
    const mazzi = costruisci().mazzi;
    for (let i = 1; i < mazzi.length; i++) {
      expect(mazzi[i]!.potenza).toBeGreaterThan(mazzi[i - 1]!.potenza);
    }
    const primo = mazzi[0]!;
    const ultimo = mazzi[mazzi.length - 1]!;
    expect(ultimo.potenza).toBeGreaterThanOrEqual(primo.potenza);
    expect(ultimo.purezza).toBeLessThanOrEqual(primo.purezza);
  });

  it("il primo mazzo è il più puro che il tema permetta", () => {
    // Nel pool finto i Goblin bastano a riempire tutti i posti non-terra: la
    // purezza massima raggiungibile è uno, e la frontiera parte da lì.
    expect(costruisci().mazzi[0]!.purezza).toBe(1);
  });

  it("quando il tema non basta, il primo mazzo è comunque il più puro possibile", () => {
    // Un sottotipo che tocca una carta sola: quattro copie, e non di più. La
    // purezza massima è quella, e il primo mazzo della frontiera la raggiunge.
    const unaSola = tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Sphinx"] } });
    const mazzo = costruisci({ tema: unaSola }).mazzi[0]!;
    const copie = mazzo.carte.reduce((somma, voce) => somma + voce.copie, 0);
    const nelTema = mazzo.carte
      .filter((voce) => voce.carta.sottotipi.includes("Sphinx"))
      .reduce((somma, voce) => somma + voce.copie, 0);

    expect(nelTema).toBe(COPIE_MASSIME);
    expect(mazzo.purezza).toBeCloseTo(COPIE_MASSIME / copie, 10);
  });

  it("ogni mazzo dice quanto costa il passo dal precedente, e il primo non ha passo", () => {
    const mazzi = costruisci().mazzi;
    expect(mazzi[0]!.passo).toBeNull();
    for (let i = 1; i < mazzi.length; i++) {
      const passo = mazzi[i]!.passo;
      expect(passo).not.toBeNull();
      expect(passo!.purezzaCeduta).toBeCloseTo(mazzi[i - 1]!.purezza - mazzi[i]!.purezza, 10);
      expect(passo!.potenzaGuadagnata).toBeCloseTo(mazzi[i]!.potenza - mazzi[i - 1]!.potenza, 10);
      expect(passo!.purezzaCeduta).toBeGreaterThan(0);
      expect(passo!.potenzaGuadagnata).toBeGreaterThan(0);
    }
  });

  it("ogni mazzo della frontiera è legale, non solo il primo", () => {
    for (const mazzo of costruisci().mazzi) {
      const voci = [...mazzo.carte, ...mazzo.terre];
      expect(voci.reduce((somma, voce) => somma + voce.copie, 0)).toBe(DIMENSIONE_MAZZO);
      expect(new Set(voci.map((voce) => voce.carta.nome)).size).toBe(voci.length);
      expect(mazzo.base.numeroTerre).toBe(mazzo.base.numeroTerreDallaCurva);
    }
  });

  it("il tetto di tempo vale per la frontiera intera, non per ogni mazzo", () => {
    // Un orologio che salta di cento millisecondi a ogni sguardo, con un tetto
    // di cinquanta: se il tetto fosse per mazzo, ogni peso ne consegnerebbe uno
    // lo stesso e la frontiera sarebbe piena. Vale per tutta la frontiera, e
    // infatti quel che torna è il primo mazzo e il troncamento dichiarato.
    let quando = 0;
    const frontiera = costruisci(
      { tempoMassimoMs: 50 },
      { ...SVELTA, orologio: () => (quando += 100) },
    );

    expect(frontiera.troncataPerTempo).toBe(true);
    expect(frontiera.mazzi).toHaveLength(1);
    expect(frontiera.mazzi.length).toBeLessThan(PESI_DELLA_PUREZZA.length);
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
  });

  it("stessa richiesta due volte, stessa frontiera intera", () => {
    const uno = costruisci();
    const altro = costruisci();
    expect(uno.mazzi.map((mazzo) => [mazzo.purezza, mazzo.potenza])).toEqual(
      altro.mazzi.map((mazzo) => [mazzo.purezza, mazzo.potenza]),
    );
  });
});

/**
 * La combo dichiarata (ticket 05 della tappa 3).
 *
 * L'app non capisce la combo: ci crede. Quel che si prova qui è esattamente
 * quel che crederci vuol dire — i pezzi entrano nel mazzo al massimo delle
 * copie e la ricerca non li scambia via, qualunque cosa il punteggio ne pensi —
 * e che il numero che ne esce sia quello esatto e non un altro.
 */
describe("la combo dichiarata", () => {
  /** Due carte fuori tema e deboli: se restano, è perché la combo le tiene. */
  const PEZZI = ["Lone Sphinx", "Iron Sentinel"];

  function copieDi(frontiera: Frontiera, nome: string): number[] {
    return frontiera.mazzi.map(
      (mazzo) => mazzo.carte.find((voce) => voce.carta.nome === nome)?.copie ?? 0,
    );
  }

  it("mette i pezzi dichiarati in ogni mazzo della frontiera, al massimo delle copie", () => {
    const frontiera = costruisci({ combo: PEZZI });

    expect(frontiera.mazzi.length).toBeGreaterThan(0);
    for (const pezzo of PEZZI) {
      for (const copie of copieDi(frontiera, pezzo)) expect(copie).toBe(COPIE_MASSIME);
    }
  });

  it("una combo che nomina una carta limitata ne ottiene una sola", () => {
    // Il caso che il ticket 08 chiede per nome. «Al massimo delle copie» non
    // vuol dire quattro: vuol dire il tetto della carta, e su una limitata il
    // tetto è uno. Il motore non fa un'eccezione per la combo — sarebbe la sola
    // strada per cui un mazzo di quest'app uscirebbe illegale.
    const limitata = POOL_DEL_MOTORE.find(
      (carta) => carta.tettoDiCopie === COPIE_DI_UNA_LIMITATA,
    );
    expect(limitata).toBeDefined();

    const frontiera = costruisci({ combo: [limitata!.nome, "Lone Sphinx"] });

    expect(frontiera.mazzi.length).toBeGreaterThan(0);
    for (const copie of copieDi(frontiera, limitata!.nome)) {
      expect(copie).toBe(COPIE_DI_UNA_LIMITATA);
    }
    // E il pezzo libero accanto ne prende quattro: le due carte della stessa
    // combo hanno due tetti diversi, ed è quel che la frase deve saper dire.
    for (const copie of copieDi(frontiera, "Lone Sphinx")) expect(copie).toBe(COPIE_MASSIME);
  });

  it("e la probabilità che ne esce è quella di una copia sola, non di quattro", () => {
    const limitata = POOL_DEL_MOTORE.find(
      (carta) => carta.tettoDiCopie === COPIE_DI_UNA_LIMITATA,
    )!;
    const mazzo = costruisci({ combo: [limitata.nome] }).mazzi[0]!;

    expect(mazzo.combo).not.toBeNull();
    expect(mazzo.combo!.pezzi).toEqual([{ nome: limitata.nome, copie: COPIE_DI_UNA_LIMITATA }]);
    expect(mazzo.combo!.probabilita).toBeCloseTo(
      probabilitaDiAssemblarne(
        mazzo.base.dimensioneMazzo,
        [COPIE_DI_UNA_LIMITATA],
        TURNO_DELLA_COMBO,
      ),
      12,
    );
  });

  it("senza dichiararli, quegli stessi pezzi il mazzo Goblin non li vuole", () => {
    // Il confronto è la prova che sopra non ci sono per caso: la combo li tiene
    // dentro **contro** il punteggio, che è quel che «crederci» vuol dire.
    for (const pezzo of PEZZI) expect(copieDi(costruisci(), pezzo)[0]).toBe(0);
  });

  it("il mazzo resta legale: sessanta carte, coi pezzi dentro", () => {
    expect(carteTotali(costruisci({ combo: PEZZI }))).toBe(DIMENSIONE_MAZZO);
  });

  it("dice la probabilità esatta di averla assemblata al turno della taratura", () => {
    const mazzo = costruisci({ combo: PEZZI }).mazzi[0]!;

    expect(mazzo.combo).not.toBeNull();
    expect(mazzo.combo!.turno).toBe(TURNO_DELLA_COMBO);
    expect(mazzo.combo!.pezzi).toEqual([
      { nome: "Lone Sphinx", copie: COPIE_MASSIME },
      { nome: "Iron Sentinel", copie: COPIE_MASSIME },
    ]);
    expect(mazzo.combo!.probabilita).toBeCloseTo(
      probabilitaDiAssemblarne(DIMENSIONE_MAZZO, [COPIE_MASSIME, COPIE_MASSIME], TURNO_DELLA_COMBO),
      12,
    );
  });

  it("senza combo dichiarata non dice niente, invece di dire zero", () => {
    expect(costruisci().mazzi[0]!.combo).toBeNull();
  });

  it("un pezzo sparito dal pool si dichiara, e il mazzo si fa lo stesso", () => {
    const frontiera = costruisci({ combo: ["Lone Sphinx", "Splendore Rotato"] });

    expect(frontiera.combo.guai).toEqual([{ nome: "Splendore Rotato", tipo: "sparita" }]);
    expect(frontiera.mazzi.length).toBeGreaterThan(0);
    // La probabilità è quella dei pezzi rimasti, non quella della combo intera:
    // fingere che sia ancora quella sarebbe la bugia che il ticket vieta.
    expect(frontiera.mazzi[0]!.combo!.pezzi).toEqual([
      { nome: "Lone Sphinx", copie: COPIE_MASSIME },
    ]);
  });

  it("una combo di sole carte sparite non fa cadere niente", () => {
    const frontiera = costruisci({ combo: ["Splendore Rotato"] });

    expect(frontiera.esito).toBe("costruito");
    expect(frontiera.combo.pezzi).toHaveLength(0);
    // Non zero e non uno: di una combo che non c'è più non esiste una
    // probabilità, e l'app non ne inventa una.
    expect(frontiera.mazzi[0]!.combo!.probabilita).toBeNull();
  });

  it("resta ripetibile: stessa richiesta, stessa lista", () => {
    expect(lista(costruisci({ combo: PEZZI }))).toBe(lista(costruisci({ combo: PEZZI })));
  });
});

describe("il tetto di spesa", () => {
  /** Quanto costa un mazzo della frontiera, terre comprese: è quel che si paga. */
  const costo = (frontiera: Frontiera, quale = 0): number => {
    const mazzo = frontiera.mazzi[quale];
    expect(mazzo).toBeDefined();
    return contoDelMazzo([...mazzo!.carte, ...mazzo!.terre]).minimo;
  };

  const nomi = (frontiera: Frontiera): string[] =>
    tutteLeVoci(frontiera).map((voce) => voce.carta.nome);

  it("spento, non dice niente della spesa e non cambia niente", () => {
    const frontiera = costruisci();

    expect(frontiera.spesa).toBeNull();
    expect(frontiera.mazzi.length).toBeGreaterThan(0);
  });

  it("spento, lascia entrare anche le carte care: è il tema a decidere, non il prezzo", () => {
    // Senza questa, il test qui sotto non proverebbe niente: bisogna sapere che
    // la carta da novecento euro nel mazzo ci finisce davvero.
    expect(nomi(costruisci({ tema: NERO }))).toContain("Onyx Chalice");
  });

  it("acceso, tiene fuori le carte che da sole lo sfondano", () => {
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 30 });

    expect(nomi(frontiera)).not.toContain("Onyx Chalice");
    expect(nomi(frontiera)).not.toContain("Duskwing Harrier");
  });

  it("acceso, nessun mazzo della frontiera costa più del tetto", () => {
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 30 });

    expect(frontiera.mazzi.length).toBeGreaterThan(0);
    for (let i = 0; i < frontiera.mazzi.length; i++) {
      // Il mezzo centesimo è dentro l'attesa perché è dentro la promessa: il
      // prezzo di un mazzo è una somma di sessanta decimali, e il tetto perdona
      // quanto un arrotondamento al centesimo può spostare, non un euro
      // (`nonSupera`). Scritto qui `30` secco, questa riga chiederebbe al motore
      // una precisione che il binario non ha.
      expect(costo(frontiera, i)).toBeLessThanOrEqual(30 + PARI_IN_EURO);
    }
  });

  it("acceso, ogni mazzo porta scritto quanto costa", () => {
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 30 });

    expect(frontiera.mazzi[0]!.spesa).toBeCloseTo(costo(frontiera), 6);
  });

  it("dice quante carte sta lasciando fuori per prezzo, e non si limita a farlo", () => {
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 30 });

    expect(frontiera.spesa?.tetto).toBe(30);
    expect(frontiera.spesa?.troppoCare).toBeGreaterThan(0);
  });

  it("dice quante di quelle non saranno mai ristampate", () => {
    // È la ragione per cui aspettare non serve: una carta in Reserved List non
    // diventerà più economica, e il giocatore ha diritto di saperlo prima di
    // alzare il tetto.
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 30 });

    expect(frontiera.spesa?.troppoCareRiservate).toBeGreaterThan(0);
    expect(frontiera.spesa!.troppoCareRiservate).toBeLessThanOrEqual(
      frontiera.spesa!.troppoCare,
    );
  });

  it("tiene fuori anche le carte che un prezzo non ce l'hanno, e lo dice", () => {
    // Col tetto acceso l'app promette un conto: una carta che non si sa quanto
    // costi non si può promettere, e contarla zero sarebbe peggio — sono
    // proprio le carte care, quelle che in inglese non esistono, a non avere
    // listino, e entrerebbero gratis in ogni mazzo.
    const senzaListino = POOL.map((carta) =>
      carta.nome === "Vile Extraction"
        ? { ...carta, prezzo: { ...carta.prezzo, euro: null, stampa: null } }
        : carta,
    );
    const frontiera = costruisciMazzo(
      richiesta({ tema: NERO, tettoDiSpesa: 30 }),
      senzaListino,
      SVELTA,
    );

    expect(frontiera.spesa?.senzaPrezzo).toBe(1);
    expect(nomi(frontiera)).not.toContain("Vile Extraction");
  });

  /**
   * Lo stesso pool con una carta a cui **nessuna copia ammessa ha listino**.
   *
   * Si fabbrica qui invece di aggiungerne una al pool finto: la carta senza
   * prezzo dev'essere una carta che il tema vuole davvero, e quale sia il tema
   * lo decide il test. Nel pool vero il caso è quello di due carte bianche che
   * una combo bianca vuole, e questa è la sua forma inventata.
   */
  const poolSenzaListinoSu = (nome: string): readonly Carta[] =>
    POOL.map((carta) =>
      carta.nome === nome
        ? { ...carta, prezzo: { ...carta.prezzo, euro: null, stampa: null } }
        : carta,
    );

  /** Il pezzo di combo che il tema nero vuole, e di cui il test toglie il prezzo. */
  const SENZA_LISTINO = "Vile Extraction";

  it("acceso su una combo che non si sa contare, non consegna niente e dice quale pezzo", () => {
    // È la strada da cui il tetto saltava: i pezzi della combo entrano senza
    // passare dal prezzo — è il patto, e resta — e un pezzo senza listino veniva
    // contato zero. Il mazzo usciva col tetto rispettato sulla carta e otto
    // copie di prezzo ignoto dentro.
    const frontiera = costruisciMazzo(
      richiesta({ tema: NERO, combo: [SENZA_LISTINO], tettoDiSpesa: 30 }),
      poolSenzaListinoSu(SENZA_LISTINO),
      SVELTA,
    );

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toEqual([]);
    // Il no dev'essere agibile: senza il nome non si sa se spegnere il tetto o
    // cambiare pezzo, che sono le due sole strade.
    expect(frontiera.motivo).toContain(SENZA_LISTINO);
  });

  it("spento, quello stesso pezzo entra e il mazzo si consegna", () => {
    // La metà che rende vera la prima: a dire di no è il **tetto**, non la
    // carta mancante né la combo. Senza questa, il test qui sopra sarebbe verde
    // anche su un motore che una combo così non la costruisce mai.
    const frontiera = costruisciMazzo(
      richiesta({ tema: NERO, combo: [SENZA_LISTINO], tettoDiSpesa: null }),
      poolSenzaListinoSu(SENZA_LISTINO),
      SVELTA,
    );

    // Quale dei due esiti «costruito» esca lo decide il tema, non il prezzo: qui
    // conta che un mazzo ci sia, e che il pezzo ci sia dentro.
    expect(frontiera.mazzi.length).toBeGreaterThan(0);
    expect(nomi(frontiera)).toContain(SENZA_LISTINO);
  });

  it("acceso, nessun mazzo consegnato contiene una carta di cui non si sa il prezzo", () => {
    // La promessa intera, letta su tutta la frontiera: `spesa` è un totale e non
    // un minimo esattamente perché questo elenco è vuoto. E con essa cade la
    // contraddizione che si leggeva nella stessa schermata — `senzaPrezzo` che
    // dichiara di aver lasciato fuori una carta che era nel mazzo consegnato.
    for (const combo of [COMBO_VUOTA, [SENZA_LISTINO]]) {
      const frontiera = costruisciMazzo(
        richiesta({ tema: NERO, combo, tettoDiSpesa: 30 }),
        poolSenzaListinoSu(SENZA_LISTINO),
        SVELTA,
      );
      const incontabili = tutteLeVoci(frontiera)
        .filter((voce) => voce.carta.prezzo.euro === null)
        .map((voce) => voce.carta.nome);
      expect({ combo, incontabili }).toEqual({ combo, incontabili: [] });
    }
  });

  it("acceso, il mazzo resta di sessanta carte: il tetto non lo lascia monco", () => {
    expect(carteTotali(costruisci({ tema: NERO, tettoDiSpesa: 30 }))).toBe(DIMENSIONE_MAZZO);
  });

  it("con un tetto che non basta non consegna un mazzo monco: dice che non si fa", () => {
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 0.5 });

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toEqual([]);
    // E dice **quanto** ci vorrebbe: un no senza numero non si può agire.
    expect(frontiera.motivo).toMatch(/\d/);
    expect(frontiera.spesa?.minimo).toBeGreaterThan(0.5);
  });

  it("il mazzo messo in mano costa quanto il motore ha detto che costa", () => {
    // La schermata del mazzo **rifà** la base di terre dalle stesse carte,
    // invece di trasportarsi dietro l’elenco che il motore ha scelto: due
    // liste di terre finirebbero prima o poi per divergere. Perché ritrovi la
    // stessa base deve però filtrare le terre con la stessa regola, tetto di
    // spesa compreso — se no rimette dentro proprio quelle che il motore aveva
    // lasciato fuori, e il mazzo esce dal tetto appena lo si prende in mano.
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 30 });
    const mazzo = frontiera.mazzi[0]!;

    const terreInMano = POOL.filter(
      (carta) => carta.terra !== null && !escluso(carta, NERO) && comprabile(carta, 30),
    );
    const rifatta = analizzaBaseDiTerre(mazzo.carte, terreInMano, {
      terreVolute: mazzo.base.numeroTerre,
      budget: Math.max(0, 30 - contoDelMazzo(mazzo.carte).minimo),
    });

    expect(contoDelMazzo([...mazzo.carte, ...rifatta.terre]).minimo).toBeCloseTo(mazzo.spesa, 6);
  });

  it("con un tetto stretto consegna un mazzo intero oppure niente, mai un mazzo corto", () => {
    // Il caso scomodo: il tetto basta a comprare **qualche** carta ma non
    // sessanta. Riempire finche i soldi bastano e poi fermarsi darebbe un mazzo
    // da quaranta carte, illegale e annunciato come se fosse a posto. Le due
    // risposte oneste sono due: un mazzo intero dentro il tetto, o un no.
    for (const tetto of [3, 3.5, 4, 5, 6, 8, 10]) {
      const frontiera = costruisci({ tema: NERO, tettoDiSpesa: tetto });
      if (frontiera.mazzi.length === 0) {
        expect(frontiera.esito).toBe("niente-da-costruire");
        continue;
      }
      for (let i = 0; i < frontiera.mazzi.length; i++) {
        const mazzo = frontiera.mazzi[i]!;
        const copie = [...mazzo.carte, ...mazzo.terre].reduce((s, v) => s + v.copie, 0);
        expect({ tetto, copie }).toEqual({ tetto, copie: DIMENSIONE_MAZZO });
        expect(mazzo.spesa).toBeLessThanOrEqual(tetto + PARI_IN_EURO);
      }
    }
  });

  it("non dichiara un pavimento quando le carte rimaste non fanno sessanta copie", () => {
    // `mazzoPiuEconomico` promette un minimo **vero**: nessun mazzo legale di
    // sessanta carte può costare meno. Se le copie rimaste non arrivano a
    // sessanta quella promessa non si può mantenere — il ciclo usciva e
    // restituiva la somma parziale, e l'app la mostrava come un pavimento. È un
    // guasto della promessa e non del calcolo: la cosa vera, e più utile, è che
    // con quelle carte un mazzo legale non esiste affatto.
    // Dieci carte da quattro copie e una terra da quattro: quarantaquattro
    // copie in tutto, che bastano ai trentatré posti non-terra e non bastano a
    // un mazzo. Le carte a copie **illimitate** restano fuori apposta: una sola
    // ne riempirebbe sessanta da sé, e il caso sparirebbe.
    const minuscolo = poolMinuscolo(10);
    const frontiera = costruisciMazzo(richiesta({ tettoDiSpesa: 1000 }), minuscolo, SVELTA);

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.spesa?.minimo).toBeNull();
    // E non nomina sessanta carte su un conto che ne ha contate meno.
    expect(frontiera.motivo).not.toMatch(/sessanta carte meno care/);
  });

  it("quando sessanta copie ci sono il pavimento resta un numero", () => {
    const frontiera = costruisci({ tema: NERO, tettoDiSpesa: 0.5 });

    expect(frontiera.spesa?.minimo).toBeGreaterThan(0.5);
  });

  it("dice quanti passi della frontiera il tetto ha lasciato senza mazzo", () => {
    // Un passo può mancare per due ragioni diverse, e l'app ne racconta una
    // sola: «cedendo tema non si guadagna potenza». Col tetto acceso l'altra
    // ragione esiste — il passo un mazzo lo avrebbe, e costa troppo — e senza
    // questo numero l'app direbbe al giocatore che un baratto non c'è quando a
    // toglierlo dal tavolo è stato il suo stesso tetto.
    // A 4,80 € sul pool finto capita esattamente quel che il ticket descrive: i
    // passi più fedeli al tema si costruiscono, e quelli che inseguono la
    // potenza — dove le carte costano — no.
    const stretto = costruisci({ tema: NERO, tettoDiSpesa: 4.8 });

    expect(stretto.mazzi.length).toBeGreaterThan(0);
    expect(stretto.mazzi.length).toBeLessThan(PESI_DELLA_PUREZZA.length);
    expect(stretto.spesa?.passiSenzaMazzo).toBeGreaterThan(0);
    expect(stretto.troncataPerTempo).toBe(false);
  });

  it("a tetto spento non c'è nessun passo tolto, perché non c'è niente che li tolga", () => {
    // Il numero vive dentro `spesa`, che a tetto spento è `null`: la frase del
    // mazzo solo non può nemmeno andare a cercarlo, ed è il modo strutturale di
    // tenere ferma la promessa che a tetto spento non cambia una parola.
    expect(costruisci({ tema: NERO }).spesa).toBeNull();
  });

  it("la riserva per le terre è il prezzo di una base vera, non della terra meno cara", () => {
    // La base non sta nella selezione: la sceglie `analizzaBaseDiTerre` dalla
    // curva, e su questo formato costa. Stimandola con la terra meno cara la
    // partenza spendeva tutto in carte e la ricerca doveva riscendere a scambi
    // singoli — quando ci arrivava. Il segno che la riserva è onesta è che i
    // tetti bassi ma sufficienti costruiscono invece di rifiutare.
    const stretti = [12, 14, 16, 18, 20].map((tetto) => ({
      tetto,
      fatto: costruisci({ tema: NERO, tettoDiSpesa: tetto }).mazzi.length > 0,
    }));

    expect(stretti.filter((prova) => prova.fatto).length).toBeGreaterThanOrEqual(4);
  });

  /** La cifra come l'app la scrive: due decimali, ed è quella che si rilegge. */
  const mostrata = (quanti: number): number => Number(quanti.toFixed(2));

  it("un tetto scritto com'è mostrato riconsegna il mazzo che quella cifra la portava", () => {
    // La manopola del ticket 09 serve a **decidere**, e una decisione che non
    // si può eseguire riscrivendo il numero che si legge non è una manopola.
    // Il mazzo costa la somma di sessanta decimali — un numero che in binario
    // non torna mai — e l'app ne mostra la cifra arrotondata al centesimo. Chi
    // la ricopia nella casella del tetto sta chiedendo quel mazzo lì, e il
    // confronto nudo gli rispondeva di no.
    let provati = 0;

    for (const tetto of [6, 18]) {
      const largo = costruisci({ tema: NERO, tettoDiSpesa: tetto });
      if (largo.mazzi.length === 0) continue;

      const speso = costo(largo);
      const scritto = mostrata(speso);
      // I conti che tornano esatti non provano niente: qui si cercano quelli
      // che in binario costano **più** della cifra con cui si mostrano, che
      // sono i soli su cui il tetto sbagliava.
      if (speso <= scritto) continue;
      provati += 1;

      const riscritto = costruisci({ tema: NERO, tettoDiSpesa: scritto });
      expect({ tetto, mazzi: riscritto.mazzi.length > 0 }).toEqual({ tetto, mazzi: true });
      expect(lista(riscritto), `tetto ${tetto} riscritto ${scritto}`).toBe(lista(largo));
    }

    // Senza questa riga il test sarebbe verde anche su un pool in cui nessuna
    // somma si discosta dalla sua cifra, cioè su un motore rotto.
    expect(provati).toBeGreaterThan(0);
  });

  it("la frase del pavimento non stampa due volte la stessa cifra", () => {
    // «Dentro 30,00 € un mazzo non si fa: le sessanta carte meno care ne
    // costano 30,00 €.» È il genere di riga che fa sembrare rotto un motore che
    // sta solo contando in binario.
    //
    // Quel che si prova qui è la **frase**, non la misura della tolleranza: lo
    // scarto che il pool finto produce è di pochi quadrilionesimi, e un
    // perdono molto più piccolo di mezzo centesimo basterebbe a farlo sparire.
    // Perché mezzo centesimo e non meno lo dicono i test di `nonSupera`, dove
    // la ragione è in euro e si può leggere.
    const pavimento = costruisci({ tema: NERO, tettoDiSpesa: 3 }).spesa?.minimo;
    expect(pavimento).toBeDefined();

    const scritto = mostrata(pavimento!);
    // La guardia: se il pavimento si mostrasse esatto non ci sarebbe niente da
    // provare, e questo test sarebbe una formalità verde.
    expect(pavimento!).toBeGreaterThan(scritto);

    const cifra = (quanti: number): string =>
      new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(quanti);
    const quanteVolte = (dove: string, quale: string): number => dove.split(quale).length - 1;

    expect(quanteVolte(costruisci({ tema: NERO, tettoDiSpesa: scritto }).motivo, cifra(scritto))).toBe(
      1,
    );

    // L'altra metà, senza la quale la prima sarebbe verde anche su un motore
    // che la frase del pavimento non la dice mai: sotto il pavimento vero il no
    // arriva subito, e porta **due cifre diverse**.
    const sotto = costruisci({ tema: NERO, tettoDiSpesa: mostrata(pavimento! / 2) });
    expect(sotto.mazzi).toHaveLength(0);
    expect(quanteVolte(sotto.motivo, cifra(pavimento!))).toBe(1);
    expect(quanteVolte(sotto.motivo, cifra(mostrata(pavimento! / 2)))).toBe(1);
  });

  it("resta ripetibile: stesso tetto e stesso seme, stessa frontiera", () => {
    const uno = costruisci({ tema: NERO, tettoDiSpesa: 30 });
    const due = costruisci({ tema: NERO, tettoDiSpesa: 30 });

    expect(lista(uno)).toBe(lista(due));
  });
});
