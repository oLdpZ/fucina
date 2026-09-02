# Progetto — Costruttore di mazzi Standard fuori meta

App web installabile (PWA), interamente lato browser, che costruisce mazzi
Magic: The Gathering per il formato Standard cartaceo ottimizzando la potenza
dentro un vincolo tematico scelto dall'utente e un tetto di spesa in euro.

Il documento d'intesa è `PROGETTO.md` — leggerlo prima di qualunque lavoro.

## Vincoli non negoziabili

- **Nessuna IA a runtime.** Nessuna chiamata a modelli linguistici durante l'uso
  dell'app: nessuna chiave API, comportamento deterministico e verificabile.
- **Nessun server.** Tutti i calcoli avvengono nel browser. Nessun account,
  nessun database, nessun costo ricorrente.
- **Gratuita e senza scopo di lucro** — è la condizione che rende legittimo
  l'uso dei dati delle carte.
- **La legalità delle carte si legge dai dati**, mai da date scritte nel codice.
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
