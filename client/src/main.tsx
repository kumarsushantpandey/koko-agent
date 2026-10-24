import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { avatarEvents, avatarSocket } from "./networking";


avatarSocket.connect();

avatarEvents.subscribe("transcript", (event) => {
  console.log("[Subscriber]", event);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
