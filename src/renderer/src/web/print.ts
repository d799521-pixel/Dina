// Impression / PDF sur iPad : le document est affiché par-dessus l'application
// (dans un Shadow DOM pour isoler ses styles) avec un bouton « Imprimer ».
// Dans la fenêtre d'impression d'iPadOS, « Enregistrer dans Fichiers » produit le PDF.

const HOST_ID = 'dina-print'

function ensureGlobalStyle(): void {
  if (document.getElementById(`${HOST_ID}-style`)) return
  const style = document.createElement('style')
  style.id = `${HOST_ID}-style`
  style.textContent = `
    #${HOST_ID} { position: fixed; inset: 0; z-index: 1000; background: #f1f5f9; overflow: auto; -webkit-overflow-scrolling: touch; }
    #${HOST_ID} .bar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: flex-end; padding: 10px 16px;
      background: #fff; border-bottom: 1px solid #e2e8f0; font: 500 15px system-ui, sans-serif; }
    #${HOST_ID} .bar button { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 8px 14px; font: inherit; }
    #${HOST_ID} .bar button.primary { background: #3b4fc4; border-color: #3b4fc4; color: #fff; }
    #${HOST_ID} .sheet { max-width: 210mm; margin: 16px auto; background: #fff; padding: 14mm; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
    @page { size: A4; margin: 12mm; }
    @media print {
      body > *:not(#${HOST_ID}) { display: none !important; }
      #${HOST_ID} { position: static; overflow: visible; background: #fff; }
      #${HOST_ID} .bar { display: none; }
      #${HOST_ID} .sheet { margin: 0; padding: 0; box-shadow: none; max-width: none; }
    }`
  document.head.appendChild(style)
}

export function showPrintable(html: string, title: string): void {
  ensureGlobalStyle()
  document.getElementById(HOST_ID)?.remove()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Le document ne contient jamais de script ; par prudence on les retire quand même.
  doc.querySelectorAll('script').forEach((s) => s.remove())

  const host = document.createElement('div')
  host.id = HOST_ID
  const bar = document.createElement('div')
  bar.className = 'bar'
  const close = document.createElement('button')
  close.textContent = 'Fermer'
  close.onclick = () => {
    host.remove()
    document.title = previousTitle
  }
  const print = document.createElement('button')
  print.className = 'primary'
  print.textContent = 'Imprimer / enregistrer en PDF'
  print.onclick = () => window.print()
  bar.append(close, print)

  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  const shadow = sheet.attachShadow({ mode: 'open' })
  doc.querySelectorAll('style').forEach((s) => shadow.appendChild(s.cloneNode(true)))
  const body = document.createElement('div')
  body.innerHTML = doc.body.innerHTML
  shadow.appendChild(body)

  host.append(bar, sheet)
  document.body.appendChild(host)
  const previousTitle = document.title
  document.title = title.replace(/\.pdf$/i, '')
}
