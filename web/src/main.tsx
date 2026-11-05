import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// shadcn's dark theme is class-based, so follow the system setting.
const darkMode = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () =>
  document.documentElement.classList.toggle('dark', darkMode.matches)
applyTheme()
darkMode.addEventListener('change', applyTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
