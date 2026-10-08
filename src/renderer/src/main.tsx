import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'

async function start(): Promise<void> {
  // Sans Electron (iPad, navigateur), la base et les services tournent dans la page.
  if (!window.dina) {
    const { installWebBridge } = await import('./web/bridge')
    await installWebBridge()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

start().catch((err: unknown) => {
  document.getElementById('root')!.textContent = `Dina n’a pas pu démarrer : ${err instanceof Error ? err.message : String(err)}`
})
