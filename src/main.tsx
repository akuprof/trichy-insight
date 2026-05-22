import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  navigator.serviceWorker
    .register(`${base}/sw.js`, { scope: `${base}/` })
    .catch(() => {});
}
