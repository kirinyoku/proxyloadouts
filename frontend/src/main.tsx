import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import { applyCornerStyle, getCornerStyle } from './lib/corner-style'
import { applyBgAnimationMode, getBgAnimationMode } from './lib/bg-animation'
import { registerServiceWorker } from './lib/register-service-worker'
import { initErrorReporter } from './lib/error-reporter'
import App from './App.tsx'

initErrorReporter()

// Ensure corner geometry matches user's saved preference in localStorage (default: 'rounded')
applyCornerStyle(getCornerStyle())
applyBgAnimationMode(getBgAnimationMode())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
