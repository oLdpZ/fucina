import { NoteLegali } from "./componenti/NoteLegali.js";
import {
  AMBITO_APP,
  NOME_APP,
  NOME_APP_DA_DECIDERE,
  PROMESSA_APP,
} from "./identita.js";

/**
 * La prima schermata. Per ora l'app sa dire soltanto cos'è: è la fetta più
 * sottile che attraversa compilazione, tipi, test, service worker e stili
 * (ticket 01). Le carte arrivano col ticket 02.
 */
export function App() {
  return (
    <div class="guscio">
      <header class="testata">
        <span class="marchio">{NOME_APP}</span>
        <span class="ambito">{AMBITO_APP}</span>
      </header>

      <main class="principale">
        <section class="apertura">
          <h1>{PROMESSA_APP}</h1>
          <p>
            Scegli un&rsquo;idea che ti diverte — un mazzo di Goblin, un mazzo
            che ricicla il cimitero, solo carte grosse. Al resto — quali carte
            esistono, quali sono le più forti, quante terre servono — ci pensa
            l&rsquo;app, e ti dice perché.
          </p>
        </section>

        {NOME_APP_DA_DECIDERE ? (
          <section class="avviso">
            <p>
              <strong>Lavori in corso.</strong> Il nome dell&rsquo;app e il suo
              aspetto non sono ancora stati scelti: quello che vedi in alto è un
              segnaposto. L&rsquo;app funziona già senza rete e si installa sul
              telefono.
            </p>
          </section>
        ) : null}
      </main>

      <NoteLegali />
    </div>
  );
}
