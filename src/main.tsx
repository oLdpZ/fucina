import { render } from "preact";

import { App } from "./App.js";
import "./stili/globale.css";

// La direzione visiva è già sull'elemento <html>, scritta dalla compilazione:
// applicarla da qui vorrebbe dire mostrare per un istante il tema sbagliato.
const radice = document.getElementById("app");
if (!radice) throw new Error("Manca il nodo #app in index.html");
render(<App />, radice);

// Il service worker serve solo all'app pubblicata: in sviluppo darebbe una
// cache vecchia a ogni salvataggio.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js", { scope: "./" });
  });
}
