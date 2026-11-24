import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Analytics } from '@vercel/analytics/react'
import { track } from './lib/track'
import { clearMagoLink, parseMagoLink } from './lib/magoLink'
import { useStore } from './store'

track('app_open')

// Ouverture depuis Mago-stat : la bataille est créée directement, puis le lien est retiré de l'adresse
const mago = parseMagoLink(location.search, location.hash)
if (mago) {
  useStore.getState().openFromLink(mago)
  clearMagoLink()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
