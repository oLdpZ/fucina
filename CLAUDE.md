# Progetto — Costruttore di mazzi fuori meta

App web installabile (PWA), interamente lato browser, che costruisce mazzi
Magic: The Gathering ottimizzando la potenza dentro un vincolo tematico scelto
dall'utente e un tetto di spesa in euro.

Il formato è **Old School su stampe italiane** dal 2026-09-06: prima era lo
Standard cartaceo. Il perché sta in
[ADR-0005](docs/adr/0005-da-standard-a-old-school-su-stampe-italiane.md), e
quali decisioni decadono in `PROGETTO.md` §7.

Il documento d'intesa è `PROGETTO.md` — leggerlo prima di qualunque lavoro,
partendo dalla §7, che vince sulle sezioni precedenti dove le contraddice.

## Vincoli non negoziabili

- **Nessuna IA a runtime.** Nessuna chiamata a modelli linguistici durante l'uso
  dell'app: nessuna chiave API, comportamento deterministico e verificabile.
- **Nessun server.** Tutti i calcoli avvengono nel browser. Nessun account,
  nessun database, nessun costo ricorrente.
- **Gratuita e senza scopo di lucro** — è la condizione che rende legittimo
  l'uso dei dati delle carte.
- **Nessuna verità di formato vive nel sorgente.** Quali edizioni sono ammesse,
  quali carte sono limitate, quali bandite, e come si chiama il formato: sono
  dati che si aprono e si correggono senza toccare il codice. Nessuna data,
  nessun nome di carta, nessun codice di edizione scritti nel sorgente. È la
  riformulazione — nella lettera, non nella sostanza — di «la legalità si legge
  dai dati»; il perché sta in
  [ADR-0004](docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md).
- Le spiegazioni all'utente sono generate da modelli di frase su numeri reali,
  mai inventate.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/issues/`.
See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root.
See `docs/agents/domain.md`.
