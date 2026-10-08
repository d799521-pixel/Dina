import { useEffect, useState } from 'react'
import type { DbStatus } from '@shared/types'
import { call } from './lib/api'
import { Toaster } from './lib/toast'
import { ProjectionScreen } from './features/projection/ProjectionScreen'
import { WelcomeScreen } from './features/setup/WelcomeScreen'
import { Shell } from './features/shell/Shell'

export function App(): React.JSX.Element {
  // La fenêtre de projection est chargée avec l'ancre #/projection.
  if (window.location.hash.startsWith('#/projection')) return <ProjectionScreen />
  return <MainWindow />
}

function MainWindow(): React.JSX.Element {
  const [status, setStatus] = useState<DbStatus>()

  useEffect(() => {
    void call('db:status').then(setStatus)
  }, [])

  return (
    <>
      {!status ? null : status.state === 'open' && status.current_class ? (
        <Shell status={status} onStatusChange={setStatus} />
      ) : (
        <WelcomeScreen status={status} onReady={setStatus} />
      )}
      <Toaster />
    </>
  )
}
