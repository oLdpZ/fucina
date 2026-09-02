import { NOTE_LEGALI } from "../note-legali.js";

/**
 * Le note richieste da `PROGETTO.md` §5, sempre raggiungibili senza aprire
 * niente: sono la condizione di legittimità dell'app, non una pagina nascosta.
 */
export function NoteLegali() {
  return (
    <footer class="note-legali">
      <h2>Note legali</h2>
      <ul>
        {NOTE_LEGALI.map((nota) => (
          <li key={nota.id}>
            {nota.testo}
            {nota.collegamento ? (
              <>
                {" "}
                <a
                  href={nota.collegamento.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {nota.collegamento.etichetta}
                </a>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </footer>
  );
}
