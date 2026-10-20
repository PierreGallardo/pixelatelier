# Pixelatelier

Éditeur de pixel art et d'animation image par image pour Windows, macOS et Linux.
Il fonctionne hors ligne : sa seule connexion, facultative, sert à vérifier sur GitHub si une nouvelle version est sortie.

Le flux de travail s'inspire des éditeurs de pixel art comme Aseprite : calques, images d'animation, pelures d'oignon et export en GIF ou en planche de sprites. L'interface, le code, la palette, l'icône et les formats sont propres à ce projet. Aucun élément d'Aseprite n'a été repris.

Technologies : Electron, React, TypeScript, Vite (via electron-vite) et Canvas 2D.

---

## Commandes

Il faut Node.js 22.12 ou plus récent.

| Action | Commande |
| --- | --- |
| Installer les dépendances | `npm install` |
| Lancer en développement (rechargement à chaud) | `npm run dev` |
| Lancer la version compilée | `npm start` |
| Vérifier les types | `npm run typecheck` |
| Tests unitaires (Vitest) | `npm test` |
| Test de bout en bout (Electron hors écran) | `npm run test:e2e` |
| Compiler (vérification des types + build) | `npm run build` |
| Créer l'installateur de la plateforme courante | `npm run dist` |
| Installateur Windows / macOS | `npm run dist:win` / `npm run dist:mac` |
| Créer l'application sans installateur (`release/*-unpacked`) | `npm run dist:dir` |
| Interface seule dans un navigateur (développement) | `npm run dev:web` (http://localhost:5199) |

> Le binaire d'Electron est téléchargé au premier lancement s'il manque. Pour le faire à l'avance :
> `node node_modules/electron/install.js`.

`npm run dist` produit un installateur NSIS sous Windows, un DMG sous macOS et une AppImage sous Linux, dans `release/`. Chaque installateur se construit sur sa propre plateforme. Les paquets ne sont pas signés (voir ci-dessous).

---

## Installer sur plusieurs machines

Un dépôt Git n'est **pas obligatoire** : il sert seulement à construire automatiquement la version macOS depuis un PC Windows.

### Windows
1. `npm run dist:win` produit `release/Pixelatelier-Setup-<version>.exe`.
2. Copiez ce fichier sur chaque PC (clé USB, cloud…) et lancez-le. L'installation se fait pour l'utilisateur courant, sans droits administrateur. Elle crée un raccourci **Pixelatelier** sur le bureau et dans le menu Démarrer, et l'application se désinstalle depuis « Applications installées ».
3. L'installateur n'est pas signé : Windows SmartScreen peut afficher « Windows a protégé votre ordinateur ». Cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.

### macOS
Un `.dmg` ne peut être construit que sur un Mac. Deux possibilités :

- **Sur un Mac, sans Git** : copiez le dossier du projet (sans `node_modules`, `out` ni `release`), installez Node.js 22, puis lancez `npm install` et `npm run dist:mac`. Vous obtenez `release/Pixelatelier-<version>-mac-arm64.dmg` pour les Mac Apple Silicon (M1 et suivants) et `…-mac-x64.dmg` pour les Mac Intel. Ouvrez le DMG et glissez Pixelatelier dans **Applications**.
- **Sans Mac, avec GitHub** : le fichier `.github/workflows/installateurs.yml` construit l'installateur Windows et les deux DMG sur les serveurs de GitHub.
  1. Créez un dépôt (privé si vous le souhaitez) et poussez-y le projet.
  2. Dans l'onglet **Actions**, ouvrez « Installateurs », puis cliquez sur **Run workflow**. Les fichiers sont téléchargeables en bas de la page de l'exécution, rubrique « Artifacts ».
  3. Pour publier une version, poussez une étiquette, par exemple `git tag v0.1.0` puis `git push --tags`. Une page « Release » est alors créée avec les installateurs.

> **Numéro de version** : l'étiquette doit correspondre au champ `version` de `package.json` (étiquette `v0.2.0` pour la version `0.2.0`). C'est ce numéro, intégré à l'installateur, que l'application compare à la dernière Release pour annoncer les mises à jour.

L'application Mac est signée « ad hoc » (sans compte développeur Apple), ce qui suffit pour qu'elle démarre, mais macOS ne peut pas en vérifier l'auteur. Si le DMG a été téléchargé, le premier lancement est bloqué. Ouvrez alors **Réglages Système** > **Confidentialité et sécurité** et cliquez sur **Ouvrir quand même**. Vous pouvez aussi retirer l'attribut de quarantaine dans le Terminal :

```bash
xattr -dr com.apple.quarantine /Applications/Pixelatelier.app
```

Pour supprimer ces avertissements, il faut signer les installateurs : un certificat de signature de code pour Windows, et un compte Apple Developer (99 $/an) pour la signature et la notarisation sur macOS.

---

## Fonctionnalités

### Documents
- Écran d'accueil avec création rapide (16×16 à 256×256), « Nouvelle image… », « Ouvrir… » et fichiers récents.
- Dimensions libres de 1 à 4096 px, formats prédéfinis (dont 320×180 et 640×360) et fond transparent, blanc ou noir.
- Format natif versionné `.pixatelier`, qui conserve calques, images, opacités, visibilité, palette et images/s.
- Import de PNG, GIF (première image), JPEG, WebP et BMP comme nouveau document.
- Confirmation (Enregistrer / Ne pas enregistrer / Annuler) avant de perdre des modifications : nouveau document, ouverture, fermeture du document ou de la fenêtre.
- Écriture atomique des fichiers (fichier temporaire puis renommage).

### Dessin
- Outils : crayon, gomme, pipette, pot de peinture, ligne, rectangle vide ou plein, ellipse vide ou pleine.
- Clic gauche pour la couleur principale, clic droit pour la couleur secondaire.
- Brosse carrée de 1 à 32 px pour le crayon, la gomme, la ligne et les contours.
- Maj pendant une forme : carré, cercle ou ligne à 45°. Maj+clic au crayon : ligne depuis le dernier point. Alt+clic : pipette temporaire.
- Pot de peinture en zone contiguë (4-voisinage) ou sur toutes les occurrences de la couleur.
- Pipette sur l'image visible ou sur le calque actif.
- Aucun anticrénelage : tous les tracés sont calculés sur la grille entière et les pixels sont remplacés, jamais mélangés.
- Damier de transparence, grille de pixels (visible à partir d'un zoom de 600 %), aperçu de la brosse sous le pointeur.
- Zoom de 12,5 % à 12 800 % (molette centrée sur le pointeur, `+` / `-`), « Ajuster à l'écran », « Taille réelle ». Déplacement de la vue avec Espace+glisser ou le bouton du milieu.
- Affichage sans lissage (`imageSmoothingEnabled = false`), aligné sur les pixels physiques.

### Sélection et presse-papiers
- **Sélection rectangulaire** (`M`) : glisser pour sélectionner. Maj ajoute à la sélection, Alt en retire, un clic simple désélectionne. Le contour animé suit la forme exacte de la sélection.
- **Déplacer** : glisser à l'intérieur de la sélection déplace son contenu (une seule annulation).
- **Couper / Copier / Coller / Supprimer** (`Ctrl+X`, `Ctrl+C`, `Ctrl+V`, `Suppr`). « Copier tous les calques visibles » (`Ctrl+Maj+C`) copie l'image composée.
- **Collage flottant** : l'image collée reste déplaçable (souris, ou flèches par pas de 1 px, 10 px avec Maj). `Entrée` la valide, `Échap` l'annule. Toute autre action la valide aussi (outil, image, calque, enregistrement…). Elle est collée à la même position que l'original, ce qui est pratique pour reporter un élément d'une image d'animation à l'autre.
- Le presse-papiers interne conserve la copie exacte, transparence comprise. La copie est aussi placée en PNG dans le presse-papiers du système : on peut coller dans un autre logiciel, ou coller dans Pixelatelier une image copiée ailleurs. Sans document ouvert, `Ctrl+V` crée un document à la taille de l'image.
- Tout sélectionner (`Ctrl+A`), désélectionner (`Ctrl+D` ou `Échap`), inverser la sélection (`Ctrl+Maj+I`).
- Tant qu'une sélection existe, le dessin, la gomme, les formes et le pot de peinture restent confinés à son intérieur.

### Baguette magique
- **Baguette magique** (`W`) : agit sur les pixels de la couleur cliquée dans le calque actif.
- **Portée** : « Zone contiguë » (pixels reliés au point cliqué) ou « Toute l'image » (toutes les occurrences de la couleur).
- **Tolérance** de 0 à 255 : accepte aussi les couleurs proches, utile pour les images importées.
- **Action « Sélectionner »** : crée la sélection (Maj ajoute, Alt retire), qu'on peut ensuite copier, déplacer ou supprimer.
- **Action « Supprimer la couleur »** : un clic rend la couleur transparente, en une seule annulation, et affiche le nombre de pixels supprimés. Si une sélection existe, la suppression se limite à cette zone.

### Couleurs
- Couleurs principale et secondaire, échange avec `X`.
- Sélecteur TSV avec canal alpha et saisie hexadécimale ou R, G, B, A.
- Palette du document (32 couleurs par défaut, 256 au maximum) : ajouter, remplacer, retirer, rétablir. Les modifications de palette s'annulent comme les autres.

### Calques
- Ajouter, dupliquer, supprimer, renommer (double-clic), masquer ou afficher.
- Réordonner avec les boutons, les raccourcis ou par glisser-déposer.
- Opacité de 0 à 100 %. Fusion avec le calque inférieur.
- Le dessin est refusé sur un calque masqué, avec un message.

### Animation
- Créer, dupliquer, supprimer, sélectionner et déplacer des images.
- Timeline avec miniatures, compteur, lecture et pause, première, précédente, suivante et dernière image.
- Images par seconde de 1 à 60.
- Pelures d'oignon : 0 à 3 images avant (teinte rouge) et après (teinte bleue), opacité réglable.

### Historique
- Annuler et rétablir pour toutes les actions : dessin, calques, images, palette, transformations.
- Un trait complet compte pour une seule entrée, de l'appui au relâchement.
- Annuler ramène sur le calque et l'image concernés.
- Les réglages continus (opacité, images/s) sont regroupés en une seule entrée.

### Image
- Taille du canevas avec ancrage (9 positions), redimensionnement au plus proche voisin.
- Retournement horizontal ou vertical, rotation de 90° dans les deux sens.

### Export
- **PNG** : image courante avec les calques visibles et la transparence, agrandissement ×1 à ×32 sans lissage.
- **GIF animé** : toutes les images en boucle, à la vitesse du document. Palette exacte jusqu'à 255 couleurs plus la transparence, réduction « median cut » au-delà.
- **Planche de sprites** : disposition horizontale, verticale ou en grille, espacement, agrandissement, et fichier JSON optionnel décrivant la position de chaque image.

### Mises à jour
- Quelques secondes après le démarrage, l'application consulte la dernière version publiée sur la page « Releases » du dépôt GitHub. Si elle est plus récente, un bandeau propose :
  - **Télécharger** : ouvre la page de la version dans le navigateur ;
  - **Ignorer cette version** : elle ne sera plus annoncée au démarrage ;
  - **Plus tard** (✕) : le bandeau revient au prochain démarrage.
- **Aide > Rechercher des mises à jour…** lance une vérification à tout moment et indique aussi si l'application est déjà à jour.
- **Aide > Rechercher les mises à jour au démarrage** désactive la vérification automatique.
- Sans connexion, ou si GitHub ne répond pas, rien n'est affiché au démarrage. La vérification manuelle, elle, signale l'erreur.
- Rien n'est téléchargé ni installé automatiquement : on télécharge l'installateur depuis la page, puis on le lance pour remplacer l'ancienne version.

### Interface
- Barre de menus Fichier, Édition, Image, Calques, Animation et Aide, navigable au clavier.
- Outils à gauche, canevas au centre, couleurs, palette et calques à droite, timeline en bas.
- Barre d'options de l'outil actif, zoom et grille.
- Barre d'état : outil, dimensions, position du pointeur, calque, image, zoom et état « modifié ».
- Infobulles avec raccourcis sur tous les boutons, et liste complète des raccourcis avec `F1`.
- Titre de la fenêtre avec le nom du fichier et un point « • » quand le document est modifié.

---

## Raccourcis principaux

`Ctrl` correspond à `Cmd` sous macOS. La liste complète s'affiche avec `F1`.

| Action | Raccourci | Action | Raccourci |
| --- | --- | --- | --- |
| Nouveau | `Ctrl+N` | Crayon | `B` |
| Ouvrir | `Ctrl+O` | Gomme | `E` |
| Enregistrer / sous | `Ctrl+S` / `Ctrl+Maj+S` | Pipette | `I` |
| Exporter PNG / GIF / planche | `Ctrl+E` / `Ctrl+Maj+E` / `Ctrl+Alt+E` | Pot de peinture | `G` |
| Annuler | `Ctrl+Z` | Ligne | `L` |
| Rétablir | `Ctrl+Y` ou `Ctrl+Maj+Z` | Rectangle / plein | `R` / `Maj+R` |
| Échanger les couleurs | `X` | Ellipse / pleine | `O` / `Maj+O` |
| Taille de brosse | `[` / `]` | Lecture / pause | `Entrée` |
| Zoom + / − | `+` / `-` | Image précédente / suivante | `←` / `→` |
| Ajuster / 100 % | `Ctrl+0` / `Ctrl+1` | Nouvelle image / dupliquer | `Alt+N` / `Alt+D` |
| Grille | `Ctrl+G` | Nouveau calque | `Maj+N` |
| Supprimer (sélection ou image du calque) | `Suppr` | Pelures d'oignon | `K` |
| Sélection rectangulaire | `M` | Baguette magique | `W` |
| Couper / Copier / Coller | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | Tout sélectionner / désélectionner | `Ctrl+A` / `Ctrl+D` |
| Copier tous les calques | `Ctrl+Maj+C` | Inverser la sélection | `Ctrl+Maj+I` |

---

## Architecture

```
src/
├── main/                  Processus principal Electron
│   ├── index.ts           Fenêtre, sécurité, boîtes de dialogue, gestionnaires IPC, confirmation à la fermeture
│   └── fileService.ts     Lecture, écriture atomique, fichiers récents (Node pur, testé)
├── preload/index.ts       Pont contextBridge minimal et typé (window.pixelatelier)
├── shared/api.ts          Contrat IPC partagé (canaux et types)
└── renderer/src/
    ├── model/             Modèle du document : bitmaps RGBA, couleurs, palette, composition, géométrie de la vue
    ├── raster/            Algorithmes de tracé : ligne, rectangle, ellipse, brosse, remplissage
    ├── history/           Historique : patchs de pixels et instantanés de structure
    ├── editor/            État central (Editor) et sessions de modification (EditSession)
    ├── tools/             Comportement de chaque outil (appui, glisser, relâchement)
    ├── io/                Format .pixatelier, base64, compression zlib
    ├── export/            Encodeurs PNG et GIF, quantification, planche de sprites
    ├── app/actions.ts     Commandes fichiers : nouveau, ouvrir, enregistrer, exporter
    ├── platform/          Accès à la plateforme (Electron ou repli navigateur), décodage d'images
    └── ui/                Interface React : commandes et raccourcis, canevas, panneaux, boîtes de dialogue
tests/                     Tests unitaires Vitest (sans DOM)
e2e/smoke.cjs              Test de bout en bout dans Electron (fenêtre hors écran)
build/icon.png             Icône de l'application (originale)
```

`model/`, `raster/`, `history/`, `editor/`, `tools/`, `io/` et `export/` ne dépendent ni de React ni du DOM. Ils sont testés directement sous Node.js.

### Modèle de données
- Un `PixelDocument` contient `width`, `height`, `fps`, `palette`, `frames[]` et `layers[]`.
- Chaque calque possède **une cellule par image** (`layers[l].cels[f]`). Une cellule est un `Bitmap` : un `Uint8ClampedArray` RGBA 8 bits non prémultiplié, organisé ligne par ligne.
- Les calques sont rangés du bas (index 0) vers le haut.

### Rendu
- `CanvasRenderer` compose les calques visibles de l'image active en TypeScript (`composeFrame`, opérateur « source-over » avec opacité du calque).
- Le résultat va dans un canevas hors écran à la taille du document. Seule la zone modifiée est recalculée pendant un trait.
- Ce canevas est ensuite agrandi à l'écran avec `imageSmoothingEnabled = false`.
- Les pelures d'oignon sont mises en cache par image et ne sont recalculées que si l'image change.
- La même fonction `composeFrame` sert à l'affichage, aux miniatures, à la pipette et à tous les exports. Ce qui est exporté est donc exactement ce qui est affiché.

### Historique
Deux types d'entrées :
- **Patch de pixels** : rectangle modifié dans une cellule, avec les pixels avant et après. Un outil ouvre une `EditSession` à l'appui et garde une copie de la cellule. Au relâchement, `commit()` calcule le rectangle réellement modifié et crée une seule entrée pour tout le trait. Pendant le glisser, les formes s'affichent en aperçu en restaurant la copie à chaque mouvement.
- **Instantané de structure** : propriétés des calques, ordre, images, dimensions, palette, images/s. Les cellules sont gardées par référence, ce qui rend l'instantané peu coûteux. Règle à respecter : une opération structurelle qui transforme des pixels (rotation, redimensionnement…) crée de nouveaux tampons au lieu de modifier les anciens.

L'état « modifié » compare l'entrée au sommet de la pile avec celle du dernier enregistrement. Annuler jusqu'à l'état enregistré retire donc l'indicateur.

### Sélection
- Une sélection est un masque d'un octet par pixel, à la taille du document, avec son rectangle englobant (`model/selection.ts`). Elle n'est pas enregistrée dans le fichier ni dans l'historique : seules les modifications de pixels qu'elle permet le sont.
- Une session de modification ouverte avec une sélection rétablit, à chaque étape, les pixels situés hors du masque. Le dessin reste ainsi confiné, y compris pendant l'aperçu des formes.
- Le collage flottant est une session encore ouverte : l'image est reposée à chaque déplacement, comme l'aperçu d'une forme. Une seule entrée d'historique est créée à la validation.
- La baguette magique (`raster/wand.ts`) réutilise le remplissage itératif par segments du pot de peinture. Tous les pixels totalement transparents comptent comme une seule couleur.
- Presse-papiers système : le processus principal garde l'empreinte (taille et hachage des pixels) de la dernière image copiée par l'application. Au collage, si l'image du système correspond à cette empreinte, c'est la copie interne exacte qui est utilisée. Sinon, l'image vient d'un autre logiciel et elle est décodée.

### Format `.pixatelier` (version 1)
JSON UTF-8 :

```jsonc
{
  "format": "pixelatelier-project",
  "version": 1,
  "width": 32, "height": 32, "fps": 8,
  "palette": ["#rrggbbaa", "..."],
  "frames": [{ "id": "…" }],
  "layers": [{ "id": "…", "name": "…", "visible": true, "opacity": 1,
               "cels": ["<base64 des pixels RGBA compressés en zlib>", null] }]
}
```

- Une cellule vide vaut `null`.
- Un fichier d'une version plus récente est refusé avec un message clair. La fonction `migrate()` est prévue pour les versions futures.
- Le chargement valide tout le contenu : dimensions, taille décompressée de chaque cellule, une cellule par image. Il répare les valeurs secondaires (opacité hors limites, identifiants dupliqués, couleurs invalides).

---

## Choix techniques

- **electron-vite** pour un seul outil de build (Vite) couvrant le processus principal, le preload et l'interface, avec rechargement à chaud.
- **Sécurité d'Electron** :
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`.
  - L'interface n'accède aux fichiers et au presse-papiers qu'au travers de canaux IPC précis, définis dans `shared/api.ts`.
  - Le processus principal vérifie l'expéditeur de chaque message et valide les arguments (types, tailles).
  - Navigation et nouvelles fenêtres interdites, aucune permission accordée (caméra, notifications…).
  - **Mises à jour** : seul le processus principal accède au réseau, avec une unique requête vers l'API publique de GitHub (sans compte et sans données personnelles). L'interface ne peut faire ouvrir dans le navigateur que les pages de versions du dépôt officiel.
  - Politique de sécurité du contenu (CSP) stricte dans la version compilée.
  - Un fichier « récent » ne peut être rouvert sans boîte de dialogue que s'il figure dans la liste tenue par le processus principal.
- **Peu de dépendances** : aucune à l'exécution en dehors d'Electron. React et lucide-react (icônes, licence ISC) sont intégrés au bundle. Les encodeurs PNG et GIF, le format de projet et les algorithmes de tracé sont écrits pour le projet. Les fonctions sensibles sont ainsi entièrement testées et ne dépendent pas de bibliothèques peu maintenues (les encodeurs GIF courants ne sont plus mis à jour).
- **Compression** par les flux natifs `CompressionStream` / `DecompressionStream`, disponibles dans Chromium et dans Node.js : aucune bibliothèque zlib à embarquer.
- **Pot de peinture itératif** par segments horizontaux avec une pile explicite d'entiers : pas de récursion, la mémoire reste bornée. Testé sur 2048×2048 px.
- **Ellipses** : algorithme entier de A. Zingl, valable pour les diamètres pairs comme impairs, symétrique et sans pixel hors du rectangle englobant.
- **Commandes centralisées** (`ui/commands.ts`) : une seule définition sert aux menus, aux raccourcis, aux infobulles et à la liste `F1`. Les chiffres sont lus par position physique pour que `Ctrl+0` fonctionne aussi sur un clavier AZERTY.
- **Interface utilisable sans Electron** (`npm run dev:web`) : sélecteur de fichier pour ouvrir, téléchargement pour enregistrer et exporter. C'est pratique pour travailler sur l'interface seule.

---

## Tests

- **Unitaires** (`npm test`, 104 tests) :
  - conversion des coordonnées écran ↔ document et zoom ;
  - ligne de Bresenham dans tous les octants, rectangles, ellipses, brosse ;
  - pot de peinture : bords, diagonales, formes concaves, transparence, mode non contigu, 2048×2048 ;
  - composition des calques : recouvrement, calques masqués, opacité, mélange semi-transparent, zone partielle ;
  - historique : un trait égale une entrée, aperçu des formes, annuler/rétablir, état « modifié », fusion des réglages ;
  - calques, images d'animation, rotation, taille du canevas ;
  - enregistrement et rechargement `.pixatelier`, versions futures refusées, fichiers corrompus détectés ;
  - PNG relu par un décodeur indépendant (zlib de Node), GIF relu par un décodeur LZW de test, planches de sprites ;
  - service de fichiers : écriture atomique, lecture, fichiers récents ;
  - sélection : rectangle, ajout, retrait, inversion, décalage, contour, extraction, effacement et pose de pixels ;
  - baguette magique : zone contiguë, toute l'image, tolérance, transparence ;
  - outil de sélection, dessin confiné, copier, couper, coller (flottant, déplacé, validé, annulé, ramené dans le document), copie fusionnée, suppression, déplacement du contenu ;
  - suppression d'une couleur en zone, dans toute l'image ou limitée à la sélection, en une seule annulation ;
  - mises à jour : lecture et comparaison des numéros de version (pré-versions comprises), réponse de GitHub (version publiée, aucune version, erreur, adresse étrangère refusée), version ignorée, absence de connexion, préférences.
- **Bout en bout** (`npm run test:e2e`, 63 vérifications) : l'application compilée et son preload tournent dans une fenêtre Electron hors écran, pilotée par de vrais événements souris et clavier. Le test dessine avec chaque outil, annule et rétablit, utilise calques, opacité, images et pelures d'oignon, lance la lecture, exporte en PNG, GIF et planche, enregistre puis rouvre, importe une image et vérifie les confirmations. Il couvre aussi le bandeau de nouvelle version (Télécharger, Ignorer, recherche manuelle), la sélection, le copier/couper/coller (y compris une image venant d'un autre logiciel), le déplacement et la baguette magique en sélection et en suppression. Les boîtes de dialogue natives, le presse-papiers système et la réponse de GitHub sont remplacés par des doublures. Sous Linux sans affichage, lancez ce test avec `xvfb-run`.
- Pendant le développement, les PNG et GIF produits ont aussi été relus avec Pillow (Python), sans aucun pixel différent, y compris pour un GIF de 257×199 aux couleurs aléatoires qui sature le dictionnaire LZW.

---

## Limites connues

- Sélection rectangulaire et baguette magique uniquement : pas de lasso ni de sélection elliptique, pas de rotation ni de mise à l'échelle d'une sélection. La sélection elle-même ne s'annule pas avec `Ctrl+Z` (les modifications de pixels, oui).
- Pas de calques de groupe, de modes de fusion ni de calques de référence.
- Le menu Édition de macOS transmet Couper/Copier/Coller/Tout sélectionner à l'interface. Ce comportement n'a pas pu être testé ici (développement sous Windows).
- La durée est la même pour toutes les images (réglage en images/s), sans durée propre à chaque image.
- Le GIF ne connaît que la transparence tout ou rien : un pixel à moins de 50 % d'opacité devient transparent. Les navigateurs ramènent aussi les délais inférieurs à 20 ms, donc les animations au-delà de 50 images/s sont ralenties dans un GIF.
- Lors de l'import d'images, le décodeur du navigateur peut légèrement arrondir la couleur des pixels très transparents.
- Pas d'association de fichiers ni d'ouverture d'un fichier passé en argument ou déposé sur la fenêtre. On ouvre un fichier par « Ouvrir… » ou par les fichiers récents.
- Les confirmations à la fermeture utilisent les boîtes de dialogue natives. Elles ont été relues dans le code, mais le test de bout en bout ne peut pas les automatiser.
- Installateurs non signés : avertissement SmartScreen sous Windows, et validation manuelle au premier lancement sur macOS.
- L'installateur Windows a été construit, installé et lancé sur ce PC. La version macOS et le workflow GitHub n'ont pas pu être exécutés depuis cet environnement Windows. Le code n'utilise rien de propre à Windows.
- Les mises à jour sont annoncées mais pas installées automatiquement : il faut télécharger puis lancer le nouvel installateur, qui remplace l'ancienne version.
- `npm audit` signale des vulnérabilités modérées dans des dépendances d'**electron-builder** (outil de création des installateurs, absent de l'application distribuée).
