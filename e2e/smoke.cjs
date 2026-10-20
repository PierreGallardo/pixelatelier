// Test de bout en bout (« smoke test ») de Pixelatelier.
//
// Charge l'interface compilée (dossier out/, voir `npm run build`) avec le vrai preload dans
// une fenêtre Electron hors écran (invisible), puis la pilote avec de vrais événements
// souris/clavier. Les canaux IPC de fichiers sont remplacés par des doublures sans boîte de
// dialogue : les exports et projets produits sont écrits dans e2e/output/.
//
// Lancement : npm run test:e2e
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(__dirname, 'output')
fs.mkdirSync(OUT, { recursive: true })
app.setPath('userData', path.join(OUT, 'userdata'))

/** PNG de test de 1254 × 1254 (magenta, symétrique en RGBA/BGRA) généré sans dépendance. */
function bigPng() {
  const w = 1254
  const buf = Buffer.alloc(w * w * 4)
  for (let i = 0; i < w * w; i++) buf.writeUInt32BE(0xff00ffff, i * 4)
  return nativeImage.createFromBitmap(buf, { width: w, height: w }).toPNG()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** nativeImage.createFromBitmap attend l'ordre BGRA : échange rouge et bleu. */
function swapRB(buf) {
  const out = Buffer.from(buf)
  for (let i = 0; i < out.length; i += 4) {
    out[i] = buf[i + 2]
    out[i + 2] = buf[i]
  }
  return out
}
const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`)
}

// Gestionnaires IPC minimaux (pas de boîte de dialogue) : les exports et projets sont capturés ici.
const captured = {}
ipcMain.handle('file:list-recent', () => [])
ipcMain.handle('file:export', (_e, req) => {
  captured[req.kind] = Buffer.from(req.data)
  if (req.sidecarJson) captured.json = req.sidecarJson
  fs.writeFileSync(path.join(OUT, `export.${req.kind}`), Buffer.from(req.data))
  return { path: `C:/fake/export.${req.kind}`, name: `export.${req.kind}` }
})
ipcMain.handle('file:save-project', (_e, req) => {
  captured.project = req.content
  fs.writeFileSync(path.join(OUT, 'saved.pixatelier'), req.content)
  return { path: 'C:/fake/test.pixatelier', name: 'test.pixatelier' }
})
let nextOpen = null
ipcMain.handle('file:open', () => nextOpen ?? { path: 'C:/fake/test.pixatelier', name: 'test.pixatelier', kind: 'project', text: captured.project })
let confirmCalls = 0
ipcMain.handle('dialog:confirm-discard', () => {
  confirmCalls++
  return 'discard'
})
let windowState = null
ipcMain.on('window:set-state', (_e, s) => (windowState = s))
// Presse-papiers système simulé
let clipboardWrites = 0
let clipboardRead = { source: 'none' }
ipcMain.handle('clipboard:write-image', (_e, png) => {
  clipboardWrites++
  captured.clipboardPng = Buffer.from(png)
})
ipcMain.handle('clipboard:read-image', () => clipboardRead)
// Mises à jour simulées : une version 9.9.9 est « publiée »
const RELEASE_URL = 'https://github.com/PierreGallardo/pixelatelier/releases/tag/v9.9.9'
let updateResult = { status: 'available', current: '0.1.0', latest: '9.9.9', name: 'v9.9.9', url: RELEASE_URL, publishedAt: '2026-10-20T10:00:00Z' }
const updateCalls = { check: [], open: [], skip: [] }
ipcMain.handle('update:get-preferences', () => ({ autoCheck: true }))
ipcMain.handle('update:check', (_e, manual) => {
  updateCalls.check.push(manual)
  return updateResult
})
ipcMain.handle('update:open-release', (_e, url) => {
  updateCalls.open.push(url)
})
ipcMain.handle('update:skip', (_e, version) => {
  updateCalls.skip.push(version)
})
ipcMain.handle('update:set-auto-check', () => undefined)

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 880,
    show: false,
    webPreferences: {
      offscreen: true,
      preload: path.join(ROOT, 'out/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.webContents.setFrameRate(30)
  const consoleErrors = []
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 3) consoleErrors.push(e.message)
  })
  await win.loadFile(path.join(ROOT, 'out/renderer/index.html'))
  await sleep(600)

  const js = (code) => win.webContents.executeJavaScript(code, true)
  // La capture hors écran peut échouer ponctuellement (compositeur pas encore prêt) : nouvel essai.
  const shot = async (name) => {
    for (let attempt = 1; ; attempt++) {
      try {
        fs.writeFileSync(path.join(OUT, name), (await win.webContents.capturePage()).toPNG())
        return
      } catch (err) {
        if (attempt >= 4) throw err
        await sleep(400)
      }
    }
  }
  const click = async (x, y, button = 'left', modifiers = []) => {
    win.webContents.sendInputEvent({ type: 'mouseMove', x, y, modifiers })
    win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button, clickCount: 1, modifiers })
    await sleep(30)
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button, clickCount: 1, modifiers })
    await sleep(120)
  }
  const drag = async (pts, button = 'left', modifiers = []) => {
    const [x0, y0] = pts[0]
    win.webContents.sendInputEvent({ type: 'mouseMove', x: x0, y: y0, modifiers })
    win.webContents.sendInputEvent({ type: 'mouseDown', x: x0, y: y0, button, clickCount: 1, modifiers })
    for (const [x, y] of pts.slice(1)) {
      await sleep(20)
      win.webContents.sendInputEvent({ type: 'mouseMove', x, y, button, modifiers })
    }
    const [x1, y1] = pts[pts.length - 1]
    await sleep(20)
    win.webContents.sendInputEvent({ type: 'mouseUp', x: x1, y: y1, button, clickCount: 1, modifiers })
    await sleep(150)
  }
  const key = async (keyCode, modifiers = []) => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
    if (keyCode.length === 1 && modifiers.every((m) => m === 'shift')) win.webContents.sendInputEvent({ type: 'char', keyCode, modifiers })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
    await sleep(150)
  }
  const center = (sel, text) =>
    js(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => ${text ? `e.textContent.includes(${JSON.stringify(text)})` : 'true'}); if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] })()`)

  try {
    check('API du preload exposée, Node inaccessible', await js(`typeof window.pixelatelier === 'object' && typeof require === 'undefined' && typeof process === 'undefined'`))
    await shot('01-accueil.png')

    // 0. Nouvelle version disponible : bandeau au démarrage
    await sleep(3600)
    const banner = await js(`document.querySelector('.update-banner')?.textContent ?? ''`)
    check('Bandeau « nouvelle version » affiché au démarrage', updateCalls.check[0] === false && /9\.9\.9 est disponible/.test(banner), banner)
    await shot('00-mise-a-jour.png')
    await click(...(await center('.update-banner .btn', 'Télécharger')))
    check('« Télécharger » ouvre la page de la version', updateCalls.open[0] === RELEASE_URL, updateCalls.open)
    await click(...(await center('.update-banner .btn', 'Ignorer cette version')))
    check('« Ignorer cette version » mémorise la version et masque le bandeau', updateCalls.skip[0] === '9.9.9' && (await js(`!document.querySelector('.update-banner')`)))
    updateResult = { status: 'up-to-date', current: '0.1.0', latest: '0.1.0' }
    await click(...(await center('.menubar__title', 'Aide')))
    await click(...(await center('.menu__item', 'Rechercher des mises à jour')))
    await sleep(200)
    const upToDate = await js(`document.querySelector('.toast')?.textContent ?? ''`)
    check('Recherche manuelle (menu Aide) : « à jour »', updateCalls.check[1] === true && /à jour/.test(upToDate), upToDate)

    // 1. Création d'un document 32×32 depuis l'accueil
    const preset = await center('.preset', '32 × 32')
    await click(...preset)
    await sleep(400)
    const view = await js(`(() => { const r = document.querySelector('.canvas-view__canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, zoom: document.querySelector('.options__zoom').textContent } })()`)
    check('Document créé et ajusté à l’écran', view.zoom !== '100 %', view)
    const zoom = parseInt(view.zoom) / 100
    const panX = Math.round((view.w - 32 * zoom) / 2)
    const panY = Math.round((view.h - 32 * zoom) / 2)
    const at = (x, y) => [Math.round(view.x + panX + (x + 0.5) * zoom), Math.round(view.y + panY + (y + 0.5) * zoom)]
    // Lecture d'un pixel affiché (centre du pixel du document)
    const shown = (x, y) => {
      const [sx, sy] = at(x, y)
      return js(`(() => { const c = document.querySelector('.canvas-view__canvas'); const r = c.getBoundingClientRect(); const k = c.width / r.width; const d = c.getContext('2d').getImageData(Math.round((${sx} - r.x) * k), Math.round((${sy} - r.y) * k), 1, 1).data; return [d[0], d[1], d[2], d[3]] })()`)
    }
    const statusText = () => js(`document.querySelector('.statusbar').textContent`)

    // 2. Crayon : trait de (2,2) à (12,2)
    const before = await shown(5, 2)
    await drag([at(2, 2), at(6, 2), at(12, 2)])
    const after = await shown(5, 2)
    check('Le crayon dessine (pixel noir affiché)', after[0] < 30 && after[1] < 30 && after[2] < 40, { before, after })
    check('Barre d’état : position du pointeur affichée', /x 12, y 2/.test(await statusText()))

    // 3. Clic droit = couleur secondaire (blanc)
    await click(...at(4, 6), 'right')
    check('Clic droit : couleur secondaire (blanc)', (await shown(4, 6)).slice(0, 3).join() === '255,255,255')

    // 4. Rectangle (R) avec Maj
    await key('R')
    await drag([at(14, 14), at(20, 18), at(24, 20)], 'left', ['shift'])
    check('Rectangle (Maj = carré) : coin opposé à (24,24)', (await shown(24, 24))[0] < 30 && (await shown(19, 19))[3] === 255)

    // 5. Pot de peinture (G) dans le carré
    await key('G')
    await click(...at(18, 18))
    const filled = await shown(18, 18)
    check('Pot de peinture : intérieur rempli', filled[0] < 30, filled)
    const outside = await shown(28, 28)
    check('Pot de peinture : ne déborde pas du carré', outside[0] > 40 || outside[1] > 40, outside)
    await shot('02-dessin.png')

    // 6. Annuler (Ctrl+Z) puis rétablir (Ctrl+Y)
    await key('Z', ['control'])
    const undone = await shown(18, 18)
    check('Ctrl+Z annule le remplissage', undone[0] > 40 || undone[2] > 40, undone)
    await key('Y', ['control'])
    check('Ctrl+Y rétablit le remplissage', (await shown(18, 18))[0] < 30)

    // 7. Ellipse pleine (Maj+O) et ligne (L)
    await key('O', ['shift'])
    await drag([at(2, 20), at(10, 28)])
    check('Ellipse pleine dessinée', (await shown(6, 24))[0] < 30)
    await key('L')
    await drag([at(30, 0), at(20, 10)])
    check('Ligne dessinée', (await shown(25, 5))[0] < 30)

    // 8. Pipette (I) puis gomme (E)
    await key('E')
    await drag([at(2, 2), at(4, 2)])
    check('Gomme : pixel transparent', (await shown(3, 2))[0] > 40)

    // 9. Couleur : palette (clic sur la 10e case = rouge)
    const swatches = await js(`[...document.querySelectorAll('.palette__swatch')].slice(0, 12).map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.x + r.width/2), Math.round(r.y + r.height/2)] })`)
    await click(...swatches[9])
    check('Palette : couleur principale changée', (await js(`document.querySelector('.colors__hex').textContent`)) === '#c23b3b')
    await key('B')
    await click(...at(16, 2))
    const red = await shown(16, 2)
    check('Crayon avec la couleur de palette', red[0] > 180 && red[1] < 80, red)
    await key('X')
    check('X échange les couleurs', (await js(`document.querySelector('.swatch-big--primary span').style.background`)).includes('255, 255, 255'))
    await key('X')

    // 10. Calques : nouveau calque (Maj+N), dessin, masquage
    await key('N', ['shift'])
    check('Nouveau calque', (await js(`document.querySelectorAll('.layer').length`)) === 2)
    await click(...at(16, 8))
    check('Dessin sur le calque 2', (await shown(16, 8))[0] > 180)
    const eye = await js(`(() => { const r = document.querySelector('.layer.is-active .layer__eye').getBoundingClientRect(); return [Math.round(r.x + r.width/2), Math.round(r.y + r.height/2)] })()`)
    await click(...eye)
    check('Masquer le calque cache ses pixels', (await shown(16, 8))[0] < 100)
    await click(...at(16, 10))
    check('Dessin refusé sur calque masqué (message)', (await js(`document.querySelector('.toast')?.textContent ?? ''`)).includes('masqué'))
    await click(...eye)
    // Opacité 50 % via le curseur (clavier : flèches sur le curseur)
    await js(`(() => { const s = document.querySelector('.layers__opacity input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(s, '50'); s.dispatchEvent(new Event('input', { bubbles: true })); })()`)
    await sleep(150)
    const half = await shown(16, 8)
    check('Opacité du calque à 50 % appliquée', half[0] > 100 && half[0] < 160, half)
    // Renommer par double-clic
    const nameEl = await center('.layer.is-active .layer__name')
    win.webContents.sendInputEvent({ type: 'mouseDown', x: nameEl[0], y: nameEl[1], button: 'left', clickCount: 1 })
    win.webContents.sendInputEvent({ type: 'mouseUp', x: nameEl[0], y: nameEl[1], button: 'left', clickCount: 1 })
    win.webContents.sendInputEvent({ type: 'mouseDown', x: nameEl[0], y: nameEl[1], button: 'left', clickCount: 2 })
    win.webContents.sendInputEvent({ type: 'mouseUp', x: nameEl[0], y: nameEl[1], button: 'left', clickCount: 2 })
    await sleep(200)
    await js(`(() => { const i = document.querySelector('.layer__rename'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Contours'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`)
    await key('Return')
    check('Renommer un calque', (await js(`[...document.querySelectorAll('.layer__name')].map(e => e.textContent)`)).includes('Contours'))

    // 11. Animation : dupliquer (Alt+D), nouvelle image (Alt+N), pelures d'oignon (K), lecture
    await key('D', ['alt'])
    await key('N', ['alt'])
    check('Trois images dans la timeline', (await js(`document.querySelectorAll('.frame:not(.frame--add)').length`)) === 3)
    await key('K')
    const onion = await shown(6, 24)
    check('Pelure d’oignon visible sur une image vide', onion[0] > 60 && onion[0] !== onion[2], onion)
    await shot('03-animation.png')
    await key('Return')
    await sleep(900)
    check('Lecture : la barre d’état change d’image', /Image [123]\/3/.test(await statusText()))
    await key('Return')

    // 12. Export PNG, GIF, planche via les boîtes de dialogue de l'interface
    await key('E', ['control'])
    await sleep(200)
    await shot('04-export.png')
    const exportBtn = await center('.modal__footer .btn--primary')
    await click(...exportBtn)
    await sleep(500)
    check('Export PNG : fichier PNG produit', captured.png && captured.png.subarray(1, 4).toString() === 'PNG', captured.png?.length)
    await key('E', ['control', 'shift'])
    await sleep(200)
    await click(...(await center('.modal__footer .btn--primary')))
    await sleep(500)
    check('Export GIF : fichier GIF89a produit', captured.gif && captured.gif.subarray(0, 6).toString() === 'GIF89a', captured.gif?.length)
    await key('E', ['control', 'alt'])
    await sleep(200)
    await click(...(await center('.modal__footer .btn--primary')))
    await sleep(500)
    check('Export planche + JSON', captured.png && captured.json && JSON.parse(captured.json).frames.length === 3)

    // 13. Enregistrement (Ctrl+S) puis réouverture
    check('Titre marqué modifié avant enregistrement', windowState && windowState.dirty === true, windowState)
    await key('S', ['control'])
    await sleep(500)
    check('Projet enregistré (format versionné)', captured.project && JSON.parse(captured.project).version === 1)
    check('Indicateur « modifié » retiré après enregistrement', windowState && windowState.dirty === false && windowState.title.startsWith('test.pixatelier'), windowState)
    await key('W', ['control'])
    await sleep(300)
    check('Fermer le document : retour à l’accueil', (await js(`!!document.querySelector('.welcome')`)) === true)
    await key('O', ['control'])
    await sleep(600)
    check('Réouverture : 2 calques et 3 images', (await js(`[document.querySelectorAll('.layer').length, document.querySelectorAll('.frame:not(.frame--add)').length].join()`)) === '2,3')
    check('Réouverture : nom du calque conservé', (await js(`[...document.querySelectorAll('.layer__name')].map(e => e.textContent)`)).includes('Contours'))

    // 14. Menus et dialogues
    await click(...(await center('.menubar__title', 'Animation')))
    await sleep(150)
    await shot('05-menu.png')
    check('Menu Animation ouvert', (await js(`document.querySelectorAll('.menu .menu__item').length`)) > 5)
    await key('Escape')
    await key('F1')
    await sleep(200)
    await shot('06-raccourcis.png')
    check('Fenêtre des raccourcis (F1)', (await js(`document.querySelector('.modal h2')?.textContent`)) === 'Raccourcis clavier')
    await key('Escape')

    // 15. Image : rotation et taille du canevas
    await click(...(await center('.menubar__title', 'Image')))
    await click(...(await center('.menu__item', 'Taille du canevas')))
    await sleep(200)
    await js(`(() => { const [w, h] = document.querySelectorAll('.modal input[type=number]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(w, '48'); w.dispatchEvent(new Event('input', { bubbles: true })); set.call(h, '40'); h.dispatchEvent(new Event('input', { bubbles: true })); })()`)
    await sleep(100)
    await click(...(await center('.modal__footer .btn--primary')))
    await sleep(300)
    check('Taille du canevas 48 × 40', /48 × 40 px/.test(await statusText()))
    await key('Z', ['control'])
    check('Annuler la taille du canevas', /32 × 32 px/.test(await statusText()))
    await shot('07-final.png')

    // 16. Confirmation avant de perdre des modifications, puis import d'une grande image
    await click(...at(1, 1))
    const callsBefore = confirmCalls
    nextOpen = { path: 'C:/fake/big.png', name: 'big.png', kind: 'image', bytes: new Uint8Array(bigPng()) }
    await key('O', ['control'])
    await sleep(900)
    check('Confirmation demandée avant d’ouvrir (document modifié)', confirmCalls === callsBefore + 1, { confirmCalls })
    check('Image importée 1254 × 1254', /1254 × 1254 px/.test(await statusText()))
    const bigZoom = await js(`document.querySelector('.options__zoom').textContent`)
    check('Grande image ajustée à l’écran (47 %)', bigZoom === '47 %', bigZoom)
    check('Image importée marquée comme non enregistrée', windowState && windowState.dirty === true, windowState)
    await shot('08-import.png')
    // Ctrl+N avec document modifié : la boîte « Nouvelle image » puis la confirmation
    await key('N', ['control'])
    await sleep(200)
    await click(...(await center('.modal__footer .btn--primary')))
    await sleep(400)
    check('Nouveau document après confirmation', confirmCalls === callsBefore + 2 && /32 × 32 px/.test(await statusText()), { confirmCalls })

    // 17. Sélection, presse-papiers et baguette magique (document 32×32 vierge)
    const pal = await js(`[...document.querySelectorAll('.palette__swatch')].slice(0, 12).map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.x + r.width/2), Math.round(r.y + r.height/2)] })`)
    await click(...pal[9]) // rouge
    await key('R', ['shift'])
    await drag([at(2, 2), at(6, 6)])
    await key('M')
    await drag([at(2, 2), at(4, 4), at(6, 6)])
    check('Sélection rectangulaire : barre d’état 5 × 5', /Sélection 5 × 5/.test(await statusText()))
    await sleep(300)
    await shot('09-selection.png')
    await key('C', ['control'])
    await sleep(300)
    check('Copier : PNG envoyé au presse-papiers système', clipboardWrites === 1 && captured.clipboardPng.subarray(1, 4).toString() === 'PNG')
    await key('V', ['control'])
    await sleep(300)
    check('Coller : image flottante 5 × 5', /Collage 5 × 5/.test(await statusText()))
    await drag([at(4, 4), at(12, 4), at(20, 4)])
    await shot('10-collage.png')
    await key('Return')
    check('Collage déplacé puis validé (Entrée)', (await shown(20, 4))[0] > 150 && (await shown(4, 4))[0] > 150 && !/Collage/.test(await statusText()))
    await key('X', ['control'])
    await sleep(300)
    check('Couper : la zone collée est effacée', (await shown(20, 4))[0] < 100)
    await key('Z', ['control'])
    check('Annuler le « couper »', (await shown(20, 4))[0] > 150)
    await drag([at(2, 2), at(3, 3)])
    await key('Delete')
    check('Supprimer : seule la sélection est effacée', (await shown(2, 2))[0] < 100 && (await shown(5, 5))[0] > 150)
    await key('Escape')
    check('Échap désélectionne', !/Sélection \d+ × \d+/.test(await statusText()))
    // Glisser dans la sélection : déplacement du contenu
    await drag([at(18, 2), at(22, 6)])
    await drag([at(20, 4), at(20, 10), at(20, 14)])
    check('Déplacer le contenu de la sélection', (await shown(20, 14))[0] > 150 && (await shown(20, 3))[0] < 100)

    // Baguette magique : suppression de toute la couleur
    await key('W')
    await key('D', ['control']) // désélectionner
    await click(...(await center('.segmented button', 'Supprimer la couleur')))
    await js(`(() => { const s = [...document.querySelectorAll('.options select')].find(e => [...e.options].some(o => o.value === 'global')); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'global'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    await sleep(150)
    await click(...at(5, 5))
    const toast = await js(`document.querySelector('.toast')?.textContent ?? ''`)
    check('Baguette (supprimer, toute l’image) : toutes les zones rouges effacées', (await shown(5, 5))[0] < 100 && (await shown(20, 14))[0] < 100, toast)
    check('Message avec le nombre de pixels supprimés', /pixels supprimés/.test(toast), toast)
    await key('Z', ['control'])
    check('Une seule annulation restaure la couleur', (await shown(5, 5))[0] > 150 && (await shown(20, 14))[0] > 150)
    await click(...(await center('.segmented button', 'Sélectionner')))
    await click(...at(5, 5))
    check('Baguette (sélectionner) : sélection créée', /Sélection \d+ × \d+/.test(await statusText()), await statusText())
    await sleep(300)
    await shot('11-baguette.png')

    // Collage d'une image venant d'un autre logiciel
    const ext = Buffer.alloc(3 * 3 * 4)
    for (let i = 0; i < 9; i++) ext.writeUInt32BE(0x00ff00ff, i * 4) // vert opaque (RGBA)
    clipboardRead = { source: 'external', png: new Uint8Array(nativeImage.createFromBitmap(swapRB(ext), { width: 3, height: 3 }).toPNG()) }
    await key('V', ['control'])
    await sleep(400)
    check('Coller une image externe : collage 3 × 3', /Collage 3 × 3/.test(await statusText()))
    await key('Escape')
    check('Échap annule le collage', !/Collage/.test(await statusText()) && (await shown(1, 1))[1] < 150)

    check('Aucune erreur dans la console', consoleErrors.length === 0, consoleErrors)
  } catch (err) {
    check('Exception du banc de test', false, String(err && err.stack ? err.stack : err))
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies`)
  app.exit(failed ? 1 : 0)
})
