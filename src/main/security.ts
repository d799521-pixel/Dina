import { app, session, shell, type WebContents } from 'electron'

/**
 * Durcissement « zéro réseau » :
 *  - toute requête sortante (http, https, ws…) est annulée, sauf le serveur
 *    de développement local ;
 *  - aucune permission navigateur (caméra, micro, géolocalisation, notifications…) ;
 *  - aucune navigation ni ouverture de fenêtre vers une page externe.
 */
export function hardenSession(devServerUrl: string | undefined): void {
  const devOrigin = devServerUrl ? new URL(devServerUrl).host : null
  const ses = session.defaultSession

  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url)
    const local =
      ['file:', 'data:', 'blob:', 'devtools:', 'chrome-extension:'].includes(url.protocol) ||
      (devOrigin !== null && url.host === devOrigin)
    if (!local) console.warn('[réseau bloqué]', details.url)
    callback({ cancel: !local })
  })

  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write'])
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)))
  ses.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))

  // Le correcteur orthographique de Chromium télécharge ses dictionnaires : désactivé.
  ses.setSpellCheckerEnabled(false)

  app.on('web-contents-created', (_e, contents: WebContents) => {
    contents.on('will-navigate', (event, url) => {
      if (url !== contents.getURL()) event.preventDefault()
    })
    contents.setWindowOpenHandler(({ url }) => {
      // Les seuls liens externes autorisés sont des courriels, ouverts par le système.
      if (url.startsWith('mailto:')) void shell.openExternal(url)
      return { action: 'deny' }
    })
  })
}
