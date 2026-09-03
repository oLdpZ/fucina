import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Carta, Pool } from "../src/dati/pool.ts";
import { costruisciMazzo, type Frontiera, type MazzoCostruito } from "../src/ricerca/costruisci.ts";
import { DENSITA_DI_SINERGIA_PIENA } from "../src/punteggio/taratura.ts";
import { spiegaFrontiera, type SpiegazioniDelMazzo } from "../src/spiegazioni/spiegazioni.ts";
import { FILTRO_TEMA_VUOTO, TEMA_VUOTO, eTerra, type Tema } from "../src/tema/tema.ts";

/**
 * Apparecchia la sosta del ticket 14.
 *
 *     node strumenti/apparecchia-la-sosta.ts
 *
 * Fa girare il motore sui **dati veri** per i temi che il ticket chiede, e ne
 * scrive un documento da leggere: le frontiere, le liste carta per carta, le
 * spiegazioni per esteso, i tempi.
 *
 * **Non giudica niente.** Il ticket 14 porta `ready-for-human` perché le
 * domande che conta sono giudizi — *questo mazzo lo porterei al negozio?*, *le
 * spiegazioni si capiscono lette a voce alta?* — e nessuno script può
 * risponderci. Questo apparecchia soltanto: mette in tavola quel che serve
 * perché una persona possa rispondere leggendo, invece di dover far girare le
 * cose da sé.
 *
 * Gira sul computer del manutentore, **mai nel browser**, e va rifatto dopo
 * ogni ritaratura: è il suo mestiere. Il seme è fisso, quindi due esecuzioni
 * a parità di codice e di pool danno lo stesso documento — e se un giorno non
 * lo danno, è cambiato qualcosa.
 */

const qui = (percorso: string) => fileURLToPath(new URL(percorso, import.meta.url));

const POOL = qui("../public/dati/pool.json");
const USCITA = qui("../.scratch/fondamenta-e-motore/la-sosta.md");

/**
 * Il seme, fisso. È la stessa scelta di tutto il resto del motore: il caso
 * arriva da fuori, e senza un seme dichiarato nessun numero qui dentro
 * sarebbe verificabile da nessuno.
 */
const SEME = 7;

/**
 * Un tetto largo, apposta. Sul telefono ce n'è uno stretto perché l'attesa si
 * sopporta solo se si vede; qui la troncatura falserebbe il giudizio, e il
 * tempo vero lo misuriamo comunque e lo scriviamo.
 */
const TEMPO_MASSIMO_MS = 300_000;

type Prova = {
  titolo: string;
  /** Perché questo tema sta nell'elenco: il ticket 14 ne chiede cinque tipi. */
  perche: string;
  tema: Tema;
};

/* -------------------------------------------------------------------------- *
 * I temi
 *
 * Due di questi si **ricavano dal pool** invece di essere scritti qui: la
 * carta-seme e il sottotipo strettissimo. Non è pignoleria — nessun nome di
 * carta va scritto nel codice come esempio, perché ruotano, ed è già costato
 * una volta (il «Goblin Chieftain» dei mockup non è in Standard).
 * -------------------------------------------------------------------------- */

const filtro = (parti: Partial<typeof FILTRO_TEMA_VUOTO>) => ({ ...FILTRO_TEMA_VUOTO, ...parti });
const tema = (parti: Partial<Tema>): Tema => ({ ...TEMA_VUOTO, ...parti });

/** Quante carte non-terra del pool prende un sottotipo. */
function quanteDelSottotipo(carte: readonly Carta[], sottotipo: string): number {
  return carte.filter((c) => !eTerra(c) && c.sottotipi.includes(sottotipo)).length;
}

/**
 * La carta-seme: la creatura con più tag di sinergia del pool, a parità di tag
 * la prima in ordine alfabetico. Scelta così perché è quella attorno a cui un
 * mazzo ha più probabilità di esistere davvero — e perché la regola è
 * deterministica, quindi il documento si rifà identico.
 */
function scegliIlSeme(carte: readonly Carta[]): Carta {
  const creature = carte.filter((c) => c.tipi.includes("Creature") && c.tag.length > 0);
  return [...creature].sort(
    (a, b) => b.tag.length - a.tag.length || a.nome.localeCompare(b.nome),
  )[0]!;
}

/**
 * Il sottotipo volutamente strettissimo: quello con **almeno due** carte e il
 * minor numero possibile. Uno con una carta sola darebbe «impossibile» e non
 * proverebbe niente che non si sappia già; il ticket chiede un tema che stia
 * appena in piedi, non uno che cada.
 */
function scegliIlSottotipoStretto(carte: readonly Carta[]): string {
  const conto = new Map<string, number>();
  for (const carta of carte) {
    if (eTerra(carta)) continue;
    for (const sottotipo of carta.sottotipi) {
      conto.set(sottotipo, (conto.get(sottotipo) ?? 0) + 1);
    }
  }
  return [...conto.entries()]
    .filter(([, quante]) => quante >= 2)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]![0];
}

function leProve(carte: readonly Carta[]): Prova[] {
  const seme = scegliIlSeme(carte);
  const stretto = scegliIlSottotipoStretto(carte);

  return [
    {
      titolo: "Molto ampio — tutto il rosso",
      perche: "Il caso in cui il tema non stringe quasi nulla: la ricerca ha campo libero.",
      tema: tema({ inclusioni: filtro({ colori: ["R"] }) }),
    },
    {
      titolo: "Di sottotipo — i Goblin",
      perche:
        "Il tema tribale, il più comune fra quelli che una persona dichiara. Novantacinque carte nel pool.",
      tema: tema({ inclusioni: filtro({ sottotipi: ["Goblin"] }) }),
    },
    {
      titolo: `Da carta-seme — ${seme.nome}`,
      perche: `La creatura con più tag del pool (${seme.tag.join(", ")}). Scelta dal pool e non scritta nel codice: i nomi ruotano.`,
      tema: tema({ seme: seme.nome }),
    },
    {
      titolo: "Con vincoli negativi forti — bianco-blu senza creature",
      perche:
        "Il tema che dice soprattutto quel che NON vuole. Le esclusioni vincono sempre, e qui tagliano il modo in cui il motore sa vincere. Una nota sul filtro: dentro un `FiltroTema` le categorie si sommano in **and**, quindi escludere «Creature» **e** «produce-pedine» insieme escluderebbe le sole creature che fanno pedine — non le creature. Qui l'esclusione è una sola apposta.",
      tema: tema({
        inclusioni: filtro({ colori: ["W", "U"] }),
        esclusioni: filtro({ tipi: ["Creature"] }),
      }),
    },
    {
      titolo: `Volutamente strettissimo — ${stretto}`,
      perche: `Il sottotipo meno numeroso del pool con almeno due carte (${quanteDelSottotipo(carte, stretto)}). Deve dare un esito e mai un crollo.`,
      tema: tema({ inclusioni: filtro({ sottotipi: [stretto] }) }),
    },
    {
      titolo: "Che non vince con le creature — istantanei e stregonerie, e nient'altro",
      perche:
        "La casella aperta più grossa del ticket 14: la simulazione goldfish conta **solo** il danno da creature, e qui non ce ne sono. L'esclusione delle creature non è ridondante — senza, la ricerca riempie il mazzo di carte a due facce cioè magie che sono anche creature, e la misura torna a essere quella di un mazzo di creature senza che nessuno se ne accorga.",
      tema: tema({
        inclusioni: filtro({ tipi: ["Instant", "Sorcery"] }),
        esclusioni: filtro({ tipi: ["Creature"] }),
      }),
    },
  ];
}

/* -------------------------------------------------------------------------- *
 * Il documento
 * -------------------------------------------------------------------------- */

const perCento = (n: number) => `${(n * 100).toFixed(1)}%`;
const conDecimali = (n: number, quanti = 4) => n.toFixed(quanti);

function elencoCarte(voci: MazzoCostruito["carte"] | MazzoCostruito["terre"]): string {
  return voci.map((v) => `${v.copie}× ${v.carta.nome}`).join(" · ");
}

/**
 * Le cinque componenti **coi loro valori grezzi**.
 *
 * I grezzi non sono un di più: sono la ragione per cui il punteggio li tiene, e
 * senza di loro una componente satura è indistinguibile da una guadagnata. Un
 * `1,000` da solo non si può ritarare — serve sapere *quanto* sopra il tetto sta
 * il mazzo, e il tetto è precisamente ciò che la sosta deve rimettere a posto.
 */
function componenti(mazzo: MazzoCostruito): string[] {
  const p = mazzo.punteggio;
  const v = p.velocita.grezzi;
  const c = p.curva.grezzi;
  const col = p.colori.grezzi;
  const s = p.sinergia.grezzi;
  const q = p.qualita.grezzi;

  const tetto = (valore: number, grezzo: number, soglia: number) =>
    valore >= 1 ? ` ⚠️ **al tetto** (${conDecimali(grezzo, 3)} contro una soglia di ${soglia})` : "";

  return [
    `- **velocità ${conDecimali(p.velocita.valore, 3)}** — voto di chiusura ${conDecimali(v.votoDiChiusura, 3)}; mani tenibili ${perCento(v.quotaManiTenibili)}; partenze impiantate ${perCento(v.quotaPartenzeImpiantate)}`,
    `- **curva ${conDecimali(p.curva.valore, 3)}** — distanza dalla forma attesa ${conDecimali(c.distanza, 3)}, presa sul turno di riferimento ${c.turnoDiRiferimento.toFixed(1)}`,
    `  - quote vere:   ${c.caselle.map((casella, i) => `${casella} ${perCento(c.quote[i] ?? 0)}`).join(" · ")}`,
    `  - quote attese: ${c.caselle.map((casella, i) => `${casella} ${perCento(c.quoteAttese[i] ?? 0)}`).join(" · ")}`,
    `- **colori ${conDecimali(p.colori.valore, 3)}** — ${col.carteDifficili} carte che questa base non regge, su ${col.numeroTerre} terre`,
    `- **sinergia ${conDecimali(p.sinergia.valore, 3)}** — densità **${conDecimali(s.densita, 4)}** (${s.coppieAttive} coppie attive su ${s.coppieDiCopie})${tetto(p.sinergia.valore, s.densita, DENSITA_DI_SINERGIA_PIENA)}`,
    ...(s.perCoppiaDiTag.length > 0
      ? [`  - da: ${s.perCoppiaDiTag.map((c) => `${c.uno}+${c.altro} (${c.coppie})`).join(" · ")}`]
      : []),
    `- **qualità ${conDecimali(p.qualita.valore, 3)}** — efficienza media delle creature ${conDecimali(q.efficienzaMedia, 3)}; rimozioni ${q.rimozioniIncondizionate} incondizionate e ${q.rimozioniCondizionali} condizionali; ${q.carteDiVantaggio} copie di vantaggio in carte`,
  ];
}

function scriviMazzo(
  mazzo: MazzoCostruito,
  spiegazioni: SpiegazioniDelMazzo,
  indice: number,
): string[] {
  const righe: string[] = [];
  const sim = mazzo.simulazione;

  righe.push(`### Mazzo ${indice + 1} — purezza ${conDecimali(mazzo.purezza)}, potenza ${conDecimali(mazzo.potenza)}`);
  righe.push("");
  righe.push(`- peso della purezza con cui è stato cercato: **${mazzo.peso}**`);
  righe.push(
    `- simulazione: chiude al turno **${sim.turnoMedioDiChiusura === null ? "mai" : sim.turnoMedioDiChiusura.toFixed(1)}** nel ${perCento(sim.quotaPartiteChiuse)} delle ${sim.partite} partite`,
  );
  righe.push("");
  righe.push("**Le cinque componenti, coi numeri che le giustificano**");
  righe.push("");
  righe.push(...componenti(mazzo));
  righe.push("");

  if (mazzo.passo !== null) {
    righe.push(
      `- **il passo**: cede ${perCento(mazzo.passo.purezzaCeduta)} di tema, guadagna ${conDecimali(mazzo.passo.potenzaGuadagnata)} di potenza`,
    );
  }

  righe.push("");
  righe.push(`**Le carte** (${mazzo.carte.reduce((s, v) => s + v.copie, 0)} copie non-terra)`);
  righe.push("");
  righe.push(elencoCarte(mazzo.carte));
  righe.push("");
  righe.push(`**Le terre** (${mazzo.terre.reduce((s, v) => s + v.copie, 0)})`);
  righe.push("");
  righe.push(elencoCarte(mazzo.terre));
  righe.push("");

  if (spiegazioni.passo !== null) {
    righe.push("**Che cosa si è comprato cedendo tema**");
    righe.push("");
    righe.push(`> ${spiegazioni.passo.frase}`);
    righe.push("");
  }

  righe.push("**Perché ogni carta è lì** — da leggere a voce alta, è la prova del ticket 13");
  righe.push("");
  for (const carta of spiegazioni.carte) {
    righe.push(`- **${carta.copie}× ${carta.nome}** — ${carta.perche.frase} ${carta.quante.frase}`);
  }
  righe.push("");

  righe.push("**Le terre, come sono state scelte**");
  righe.push("");
  righe.push(`> ${spiegazioni.terre.frase}`);
  righe.push("");

  if (spiegazioni.esclusioni.length > 0) {
    righe.push("**Le carte del tema rimaste fuori**");
    righe.push("");
    for (const esclusa of spiegazioni.esclusioni) righe.push(`- ${esclusa.frase}`);
    righe.push("");
  }

  return righe;
}

function scriviProva(prova: Prova, frontiera: Frontiera, ms: number, pool: readonly Carta[]): string[] {
  const righe: string[] = [];
  const a = frontiera.ampiezza;

  righe.push(`## ${prova.titolo}`);
  righe.push("");
  righe.push(`*${prova.perche}*`);
  righe.push("");
  righe.push(
    `- **verdetto sul tema**: ${a.verdetto} — ${a.carteDisponibili} carte distinte, ${a.copieDisponibili} copie possibili, ${a.postiNonTerra} posti da riempire (soglia di «comodo»: ${a.carteComode})`,
  );
  righe.push(`- **esito**: ${frontiera.esito} — ${frontiera.motivo}`);
  righe.push(
    `- **frontiera**: ${frontiera.mazzi.length} mazzi in **${(ms / 1000).toFixed(1)} s**${frontiera.troncataPerTempo ? " ⚠️ **troncata per tempo**" : ""}`,
  );
  righe.push(
    `- ricerca: ${frontiera.scambiProvati} scambi provati, ${frontiera.scambiTenuti} tenuti, ${frontiera.partenze} partenze per passo`,
  );
  if (a.allargamenti.length > 0) {
    righe.push(`- allargamenti proposti: ${a.allargamenti.length} (nessuno applicato — qui non c'è nessuno che possa accettarli)`);
  }
  righe.push("");

  if (frontiera.mazzi.length === 0) {
    righe.push("Nessun mazzo. Il motivo è la frase qui sopra, e non è per forza un guasto.");
    righe.push("");
    return righe;
  }

  const spiegazioni = spiegaFrontiera(frontiera, prova.tema, pool);
  frontiera.mazzi.forEach((mazzo, i) => righe.push(...scriviMazzo(mazzo, spiegazioni[i]!, i)));

  return righe;
}

/* -------------------------------------------------------------------------- */

function main(): void {
  const pool = JSON.parse(readFileSync(POOL, "utf8")) as Pool;
  const carte = pool.carte;

  const intestazione: string[] = [
    "# La sosta — le frontiere sui dati veri",
    "",
    "**Documento generato**, non scritto a mano: `node strumenti/apparecchia-la-sosta.ts`.",
    "Va rifatto dopo ogni ritaratura, ed è il suo mestiere.",
    "",
    "Questo file **apparecchia** il ticket 14, non lo risolve. Le domande che",
    "contano sono giudizi e vogliono una persona:",
    "",
    "- questo mazzo lo porterei al negozio?",
    "- la differenza fra il primo e l'ultimo mazzo è un compromesso vero o è rumore?",
    "- le spiegazioni si capiscono lette **a voce alta**, senza già sapere le cose?",
    "",
    `- pool del **${pool.generatoIl}**, ${carte.length} carte`,
    `- seme **${SEME}**, fisso: due esecuzioni a parità di codice danno lo stesso documento`,
    `- tetto di tempo **${TEMPO_MASSIMO_MS / 1000} s** per tema, largo apposta — sul telefono è molto più stretto, e la troncatura falserebbe il giudizio`,
    "",
    "> ⚠️ I tempi qui sotto sono di un computer da tavolo. **Quanto ci metta un",
    "> telefono vero resta da misurare**, ed è una casella aperta del ticket 14.",
    "",
    "---",
    "",
  ];

  const corpo: string[] = [];
  const riassunto: string[] = [
    "## Il riassunto, per chi legge una riga sola",
    "",
    "| tema | verdetto | mazzi | tempo | purezza | potenza | chiude al turno |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const prova of leProve(carte)) {
    process.stdout.write(`  ${prova.titolo}… `);
    const inizio = Date.now();
    const frontiera = costruisciMazzo(
      { tema: prova.tema, seme: SEME, tempoMassimoMs: TEMPO_MASSIMO_MS, formato: "standard" },
      carte,
    );
    const ms = Date.now() - inizio;
    process.stdout.write(`${frontiera.mazzi.length} mazzi in ${(ms / 1000).toFixed(1)} s\n`);

    corpo.push(...scriviProva(prova, frontiera, ms, carte));

    const primo = frontiera.mazzi[0];
    const ultimo = frontiera.mazzi[frontiera.mazzi.length - 1];
    const arco = (leggi: (m: MazzoCostruito) => string) =>
      primo === undefined
        ? "—"
        : primo === ultimo
          ? leggi(primo)
          : `${leggi(primo)} → ${leggi(ultimo!)}`;

    riassunto.push(
      `| ${prova.titolo.split(" — ")[0]} | ${frontiera.ampiezza.verdetto} | ${frontiera.mazzi.length} | ${(ms / 1000).toFixed(1)} s | ${arco((m) => conDecimali(m.purezza, 3))} | ${arco((m) => conDecimali(m.potenza, 3))} | ${arco((m) => (m.simulazione.turnoMedioDiChiusura === null ? "mai" : m.simulazione.turnoMedioDiChiusura.toFixed(1)))} |`,
    );
  }

  riassunto.push("");
  riassunto.push("---");
  riassunto.push("");

  writeFileSync(USCITA, [...intestazione, ...riassunto, ...corpo].join("\n"), "utf8");
  console.log(`\nScritto ${USCITA}`);
}

main();
