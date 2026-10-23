# Pixelatelier

[![Dernière version](https://img.shields.io/github/v/release/PierreGallardo/pixelatelier?label=derni%C3%A8re%20version)](https://github.com/PierreGallardo/pixelatelier/releases/latest)

Éditeur de pixel art et d'animation image par image pour Windows et macOS.
Il fonctionne hors ligne : sa seule connexion, facultative, sert à vérifier sur GitHub si une nouvelle version est sortie.

Le flux de travail s'inspire des éditeurs de pixel art comme Aseprite : calques, images d'animation, pelures d'oignon et export en GIF ou en planche de sprites. L'interface, le code, la palette, l'icône et les formats sont propres à ce projet. Aucun élément d'Aseprite n'a été repris.

Technologies : Electron, React, TypeScript, Vite (via electron-vite) et Canvas 2D.

---

## Télécharger et installer

Les installateurs de la dernière version sont sur la page **[Releases](https://github.com/PierreGallardo/pixelatelier/releases/latest)**, rubrique **Assets** en bas de la page. Aucun compte GitHub n'est nécessaire.

| Votre ordinateur | Fichier à télécharger |
| --- | --- |
| Windows 10 ou 11 (64 bits) | `Pixelatelier-Setup-X.Y.Z.exe` |
| Mac avec puce Apple (M1, M2, M3…) | `Pixelatelier-X.Y.Z-mac-arm64.dmg` |
| Mac avec processeur Intel | `Pixelatelier-X.Y.Z-mac-x64.dmg` |

`X.Y.Z` est le numéro de la version, par exemple `0.5.0`. Les fichiers « Source code (zip / tar.gz) » contiennent le code, pas l'application : ignorez-les.

> **Quel Mac avez-vous ?** Menu Pomme > **À propos de ce Mac**. Une ligne « Puce » (Apple M…) correspond au fichier `arm64`, une ligne « Processeur » (Intel) au fichier `x64`.

### Windows
1. Téléchargez `Pixelatelier-Setup-X.Y.Z.exe`, puis lancez-le.
2. L'installateur n'est pas signé (une signature nécessite un certificat payant). Windows SmartScreen peut donc afficher « Windows a protégé votre ordinateur » : cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**.
3. Suivez l'assistant. L'installation se fait pour votre compte, sans droits administrateur. Elle crée un raccourci **Pixelatelier** sur le bureau et dans le menu Démarrer, et associe les fichiers `.pixatelier` au logiciel : un double-clic sur un projet l'ouvre directement.

Pour désinstaller : **Paramètres** > **Applications** > **Applications installées** > Pixelatelier > **Désinstaller**.

### macOS
1. Téléchargez le `.dmg` qui correspond à votre Mac et ouvrez-le.
2. Glissez **Pixelatelier** dans le dossier **Applications**. Les fichiers `.pixatelier` s'ouvrent ensuite d'un double-clic dans le Finder.
3. Au premier lancement, macOS indique qu'il ne peut pas vérifier le développeur, car l'application n'est pas notarisée par Apple. Fermez ce message, puis ouvrez **Réglages Système** > **Confidentialité et sécurité**. Faites défiler jusqu'au message concernant Pixelatelier, cliquez sur **Ouvrir quand même** et confirmez. Cette étape n'est demandée qu'une seule fois.

   Autre solution, dans le Terminal :

   ```bash
   xattr -dr com.apple.quarantine /Applications/Pixelatelier.app
   ```

Pour désinstaller : glissez Pixelatelier depuis **Applications** vers la Corbeille.

### Mettre à jour
Quand une nouvelle version est publiée, Pixelatelier l'annonce par un bandeau au démarrage. Vous pouvez aussi vérifier à tout moment avec **Aide** > **Rechercher des mises à jour…**. Cliquez ensuite sur **Mettre à jour** :

- **Windows** : la nouvelle version est téléchargée dans le logiciel (avec une barre de progression), puis **Redémarrer et installer** l'installe et relance Pixelatelier. Si un dessin n'est pas enregistré, le logiciel propose d'abord de l'enregistrer. Avec **À la fermeture**, l'installation se fera quand vous quitterez le logiciel.
- **macOS** : l'installateur adapté à votre Mac est téléchargé dans « Téléchargements » puis ouvert. Glissez Pixelatelier dans **Applications** pour remplacer l'ancienne version.

Vos projets `.pixatelier` ne sont pas modifiés. La mise à jour automatique est disponible à partir de la version 0.3.0 : depuis une version plus ancienne, le bouton **Télécharger** ouvre la page de la nouvelle version, à installer comme ci-dessus.

---

## Nouveautés

### 0.5.0
- **Plusieurs documents ouverts en même temps**, dans des onglets au-dessus du dessin : on passe de l'un à l'autre d'un clic ou avec `Ctrl+Tab` / `Ctrl+Maj+Tab` (`Cmd+Option+→` / `←` sur Mac).
- Chaque document garde son historique d'annulation, son calque et son image actifs, sa sélection, sa symétrie, son zoom et sa position. Un point orange signale les documents modifiés.
- Ouvrir un projet ou créer une nouvelle image ne ferme plus le dessin en cours : un nouvel onglet s'ouvre. Un fichier déjà ouvert affiche simplement son onglet.
- Le presse-papiers est commun : on peut copier dans un projet et coller dans un autre.
- Fermer un onglet (×, clic molette ou `Ctrl+W`) propose d'enregistrer s'il est modifié ; quitter le logiciel propose d'enregistrer chaque document modifié.

### 0.4.0
- **Ouverture des projets d'un double-clic** : les fichiers `.pixatelier` sont associés à Pixelatelier (icône de document dédiée). « Ouvrir avec… » et le glisser sur l'icône du logiciel fonctionnent aussi.
- Si Pixelatelier est déjà ouvert, le fichier s'ouvre dans la fenêtre existante.

### 0.3.0
- **Mise à jour depuis le logiciel** : le bouton **Mettre à jour** du bandeau télécharge la nouvelle version. Sous Windows, elle s'installe d'un clic et le logiciel redémarre tout seul ; sous macOS, l'installateur est téléchargé puis ouvert.
- Pour passer de la 0.1.0 ou de la 0.2.0 à la 0.3.0, téléchargez une dernière fois l'installateur depuis la page des versions : les mises à jour suivantes se feront depuis le logiciel.

### 0.2.0
- **Mode pixel parfait** pour le crayon et la gomme (touche `P`) : les angles en « L » des traits à main levée sont retirés pour des lignes d'un pixel d'épaisseur.
- **Symétrie** gauche/droite et haut/bas (`Alt+Maj+X` / `Alt+Maj+Y`), avec axes réglables et affichés sur le dessin.

### 0.1.0
- Première version publiée : outils de dessin, sélection et presse-papiers, baguette magique, calques, animation avec pelures d'oignon, annuler/rétablir, format `.pixatelier`, exports PNG, GIF et planche de sprites.
- Annonce des nouvelles versions au démarrage et dans le menu Aide.

Le détail de chaque version (fichiers et liste des modifications) est sur la page [Releases](https://github.com/PierreGallardo/pixelatelier/releases).

---

## Fonctionnalités

### Documents
- Écran d'accueil avec création rapide (16×16 à 256×256), « Nouvelle image… », « Ouvrir… » et fichiers récents.
- **Plusieurs documents ouverts en même temps**, dans des onglets au-dessus du dessin. Chaque document garde son historique d'annulation, son calque et son image actifs, sa sélection, sa symétrie, son zoom et sa position. Un point orange signale les documents modifiés. On passe de l'un à l'autre d'un clic ou avec `Ctrl+Tab` / `Ctrl+Maj+Tab` (`Cmd+Option+→` / `←` sur Mac). On ferme avec ×, le clic molette ou `Ctrl+W` (enregistrement proposé si le document est modifié). Le presse-papiers est commun : on peut copier dans un projet et coller dans un autre. Ouvrir un fichier déjà ouvert affiche simplement son onglet, et quitter le logiciel propose d'enregistrer chaque document modifié.
- Dimensions libres de 1 à 4096 px, formats prédéfinis (dont 320×180 et 640×360) et fond transparent, blanc ou noir.
- Format natif versionné `.pixatelier`, qui conserve calques, images, opacités, visibilité, palette et images/s.
- **Ouverture depuis le système** : double-clic sur un fichier `.pixatelier` (icône de document dédiée), « Ouvrir avec… » sur un projet ou une image, ou glisser un fichier sur l'icône de Pixelatelier (macOS, et Windows sur le raccourci). Si Pixelatelier est déjà ouvert, le fichier s'ouvre dans la fenêtre existante, après proposition d'enregistrer le dessin en cours.
- Import de PNG, GIF (première image), JPEG, WebP et BMP comme nouveau document.
- Confirmation (Enregistrer / Ne pas enregistrer / Annuler) avant de perdre des modifications : nouveau document, ouverture, fermeture du document ou de la fenêtre.
- Écriture atomique des fichiers (fichier temporaire puis renommage).

### Dessin
- Outils : crayon, gomme, pipette, pot de peinture, ligne, rectangle vide ou plein, ellipse vide ou pleine.
- Clic gauche pour la couleur principale, clic droit pour la couleur secondaire.
- Brosse carrée de 1 à 32 px pour le crayon, la gomme, la ligne et les contours.
- **Pixel parfait** (option du crayon et de la gomme, touche `P`) : retire automatiquement les angles en « L » des traits à main levée, pour des lignes d'un pixel d'épaisseur. Actif avec une brosse de 1 px, désactivé par défaut.
- **Symétrie** gauche/droite et/ou haut/bas (barre d'options, menu Image, `Alt+Maj+X` / `Alt+Maj+Y`) : crayon, gomme, formes et pot de peinture dessinent aussi les pixels symétriques. Les axes, affichés en pointillés, sont au centre de l'image par défaut ; leur position se règle au demi-pixel près. Fonctionne avec le mode pixel parfait et la sélection.
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
  - **Mettre à jour** : télécharge la nouvelle version dans le logiciel. Sous Windows, elle s'installe ensuite d'un clic (**Redémarrer et installer**) ou à la fermeture du logiciel ; sous macOS, l'installateur téléchargé est ouvert. En développement et sous Linux, le bouton **Télécharger** ouvre la page de la version ;
  - **Ignorer cette version** : elle ne sera plus annoncée au démarrage ;
  - **Plus tard** (✕) : le bandeau revient au prochain démarrage.
- **Aide > Rechercher des mises à jour…** lance une vérification à tout moment et indique aussi si l'application est déjà à jour.
- **Aide > Rechercher les mises à jour au démarrage** désactive la vérification automatique.
- Sans connexion, ou si GitHub ne répond pas, rien n'est affiché au démarrage. La vérification manuelle, elle, signale l'erreur.
- Le téléchargement est vérifié avant l'installation (empreinte SHA-512 sous Windows, taille exacte sous macOS) et ne se fait qu'à la demande : rien n'est installé sans un clic de l'utilisateur.

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
| Pixel parfait | `P` | Symétrie gauche/droite / haut/bas | `Alt+Maj+X` / `Alt+Maj+Y` |
| Document suivant / précédent | `Ctrl+Tab` / `Ctrl+Maj+Tab` | Fermer le document | `Ctrl+W` |

---

## Développement

### Commandes

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

### Construire les installateurs soi-même
- **Windows** : `npm run dist:win` produit `release/Pixelatelier-Setup-<version>.exe`.
- **macOS** : sur un Mac uniquement. Installez Node.js 22, puis lancez `npm install` et `npm run dist:mac`. Vous obtenez `release/Pixelatelier-<version>-mac-arm64.dmg` (Apple Silicon) et `…-mac-x64.dmg` (Intel).
- **Linux** : `npm run dist` sur une machine Linux produit une AppImage. Ce paquet n'a pas été testé.
- **Sans Mac** : ouvrez l'onglet **Actions** de GitHub, puis « Installateurs » et **Run workflow**. Le workflow construit l'installateur Windows et les deux DMG sans rien publier. Les fichiers sont téléchargeables en bas de la page de l'exécution, rubrique « Artifacts ».

### Publier une nouvelle version (automatique)
La publication se déclenche toute seule à chaque mise à jour de la branche `main` :

1. Le développement se fait sur des branches `feature/…`, fusionnées dans `dev` par Pull Request.
2. Pour sortir une version, une branche `release/vX.Y.Z` est créée depuis `dev`. Seul le champ `version` de `package.json` y change (en suivant SemVer : correctif → `0.1.1`, nouvelle fonctionnalité → `0.2.0`). Elle est fusionnée dans `main` par Pull Request.
3. À la fusion, le workflow voit que la version `0.2.0` n'est pas encore publiée. Il construit les installateurs, crée l'étiquette `v0.2.0` et publie la Release, avec la liste des Pull Requests incluses. Il faut compter une dizaine de minutes.
4. Les applications déjà installées affichent alors le bandeau « nouvelle version disponible ».

Si `main` est mise à jour sans changement de version, le workflow l'indique et ne publie rien. Il n'écrase jamais une version déjà publiée.

> **Numéro de version** : c'est le champ `version` de `package.json`, intégré à l'installateur, que l'application compare à la dernière Release pour annoncer les mises à jour. Il doit donc augmenter à chaque publication.

### Signature des installateurs
Les installateurs ne sont pas signés. L'application Mac est signée « ad hoc », sans compte développeur Apple : cela suffit pour qu'elle démarre, mais macOS ne peut pas en vérifier l'auteur. D'où les avertissements décrits dans « Télécharger et installer ». Pour les supprimer, il faut un certificat de signature de code pour Windows, et un compte Apple Developer (99 $/an) pour la signature et la notarisation sur macOS.

---

## Architecture

```
src/
├── main/                  Processus principal Electron
│   ├── index.ts           Fenêtre, sécurité, boîtes de dialogue, gestionnaires IPC, confirmation à la fermeture
│   ├── fileService.ts     Lecture, écriture atomique, fichiers récents, préférences (Node pur, testé)
│   ├── updates.ts         Recherche de nouvelle version sur GitHub (comparaison SemVer, testé)
│   ├── autoUpdate.ts      Téléchargement et installation des mises à jour (electron-updater sous Windows)
│   └── downloader.ts      Téléchargement de fichier avec progression (testé)
├── preload/index.ts       Pont contextBridge minimal et typé (window.pixelatelier)
├── shared/api.ts          Contrat IPC partagé (canaux et types)
└── renderer/src/
    ├── model/             Modèle du document : bitmaps RGBA, couleurs, palette, composition, sélection, géométrie de la vue
    ├── raster/            Algorithmes de tracé : ligne, rectangle, ellipse, brosse, remplissage, baguette magique, pixel parfait, symétrie
    ├── history/           Historique : patchs de pixels et instantanés de structure
    ├── editor/            État central (Editor, onglets des documents ouverts) et sessions de modification (EditSession)
    ├── tools/             Comportement de chaque outil (appui, glisser, relâchement)
    ├── io/                Format .pixatelier, base64, compression zlib
    ├── export/            Encodeurs PNG et GIF, quantification, planche de sprites
    ├── app/actions.ts     Commandes fichiers : nouveau, ouvrir, enregistrer, exporter
    ├── platform/          Accès à la plateforme (Electron ou repli navigateur), décodage d'images
    └── ui/                Interface React : commandes et raccourcis, canevas, panneaux, boîtes de dialogue
tests/                     Tests unitaires Vitest (sans DOM)
e2e/smoke.cjs              Test de bout en bout dans Electron (fenêtre hors écran)
.github/workflows/         Construction et publication automatique des installateurs
build/icon.png             Icône de l'application (originale)
```

`model/`, `raster/`, `history/`, `editor/`, `tools/`, `io/` et `export/` ne dépendent ni de React ni du DOM. Ils sont testés directement sous Node.js.

### Modèle de données
- Un `PixelDocument` contient `width`, `height`, `fps`, `palette`, `frames[]` et `layers[]`.
- Chaque calque possède **une cellule par image** (`layers[l].cels[f]`). Une cellule est un `Bitmap` : un `Uint8ClampedArray` RGBA 8 bits non prémultiplié, organisé ligne par ligne.
- Les calques sont rangés du bas (index 0) vers le haut.

### Onglets
L'éditeur garde un seul document « déplié » dans ses champs (document, historique, calque et image actifs, sélection, symétrie…). Chaque onglet mémorise ces informations pour son document. Changer d'onglet valide d'abord une modification en cours (trait, collage), range l'état du document actif dans son onglet avec sa vue (zoom, position), puis déplie celui du document choisi. Les réglages d'outils, les couleurs et le presse-papiers sont communs à tous les documents.

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
- **Peu de dépendances** : une seule à l'exécution en dehors d'Electron, electron-updater (mises à jour). React et lucide-react (icônes, licence ISC) sont intégrés au bundle. Les encodeurs PNG et GIF, le format de projet et les algorithmes de tracé sont écrits pour le projet. Les fonctions sensibles sont ainsi entièrement testées et ne dépendent pas de bibliothèques peu maintenues (les encodeurs GIF courants ne sont plus mis à jour).
- **Mises à jour** avec **electron-updater** sous Windows : bibliothèque maintenue par le projet electron-builder, qui lit le fichier `latest.yml` publié avec chaque Release, vérifie l'empreinte SHA-512 de l'installateur et le lance en mode silencieux. La publication automatique (`installateurs.yml`) joint ce fichier à chaque Release. Sur macOS, cette mise à jour intégrée exige une application signée : l'application télécharge donc simplement le bon DMG.
- **Compression** par les flux natifs `CompressionStream` / `DecompressionStream`, disponibles dans Chromium et dans Node.js : aucune bibliothèque zlib à embarquer.
- **Pot de peinture itératif** par segments horizontaux avec une pile explicite d'entiers : pas de récursion, la mémoire reste bornée. Testé sur 2048×2048 px.
- **Ellipses** : algorithme entier de A. Zingl, valable pour les diamètres pairs comme impairs, symétrique et sans pixel hors du rectangle englobant.
- **Commandes centralisées** (`ui/commands.ts`) : une seule définition sert aux menus, aux raccourcis, aux infobulles et à la liste `F1`. Les chiffres sont lus par position physique pour que `Ctrl+0` fonctionne aussi sur un clavier AZERTY.
- **Interface utilisable sans Electron** (`npm run dev:web`) : sélecteur de fichier pour ouvrir, téléchargement pour enregistrer et exporter. C'est pratique pour travailler sur l'interface seule.

---

## Tests

- **Unitaires** (`npm test`, 146 tests) :
  - conversion des coordonnées écran ↔ document et zoom ;
  - ligne de Bresenham dans tous les octants, rectangles, ellipses, brosse ;
  - pot de peinture : bords, diagonales, formes concaves, transparence, mode non contigu, 2048×2048 ;
  - composition des calques : recouvrement, calques masqués, opacité, mélange semi-transparent, zone partielle ;
  - historique : un trait égale une entrée, aperçu des formes, annuler/rétablir, état « modifié », fusion des réglages ;
  - calques, images d'animation, rotation, taille du canevas ;
  - enregistrement et rechargement `.pixatelier`, versions futures refusées, fichiers corrompus détectés ;
  - PNG relu par un décodeur indépendant (zlib de Node), GIF relu par un décodeur LZW de test, planches de sprites ;
  - service de fichiers : écriture atomique, lecture, fichier introuvable, fichiers récents, fichiers passés en ligne de commande ;
  - sélection : rectangle, ajout, retrait, inversion, décalage, contour, extraction, effacement et pose de pixels ;
  - baguette magique : zone contiguë, toute l'image, tolérance, transparence ;
  - outil de sélection, dessin confiné, copier, couper, coller (flottant, déplacé, validé, annulé, ramené dans le document), copie fusionnée, suppression, déplacement du contenu ;
  - suppression d'une couleur en zone, dans toute l'image ou limitée à la sélection, en une seule annulation ;
  - mode pixel parfait : détection des angles en L, escaliers, mouvements rapides, couleur d'origine restaurée, brosse > 1 px, gomme ;
  - symétrie : points et rectangles reflétés (axe entre deux pixels ou au milieu d'un pixel, un ou deux axes), brosse paire, crayon, formes, gomme, pot de peinture, pixel parfait, sélection, changement de taille ;
  - téléchargement des mises à jour : choix du DMG selon le processeur, fichiers limités au dépôt officiel, progression, fichier incomplet refusé, nom de fichier libre ;
  - onglets : documents, historiques et états séparés, état « modifié » par onglet, presse-papiers commun, passage en boucle, fichier déjà ouvert, fermeture, vue mémorisée ;
  - mises à jour : lecture et comparaison des numéros de version (pré-versions comprises), réponse de GitHub (version publiée, aucune version, erreur, adresse étrangère refusée), version ignorée, absence de connexion, préférences.
- **Bout en bout** (`npm run test:e2e`, 78 vérifications) : l'application compilée et son preload tournent dans une fenêtre Electron hors écran, pilotée par de vrais événements souris et clavier. Le test dessine avec chaque outil, annule et rétablit, utilise calques, opacité, images et pelures d'oignon, lance la lecture, exporte en PNG, GIF et planche, enregistre puis rouvre, importe une image, ouvre un projet transmis par le système (double-clic), passe d’un onglet à l’autre, ferme des onglets, enregistre chaque document modifié en quittant et vérifie les confirmations. Il couvre aussi le bandeau de nouvelle version (Ignorer, recherche manuelle, téléchargement avec progression, « Redémarrer et installer »), la sélection, le copier/couper/coller (y compris une image venant d'un autre logiciel), le déplacement et la baguette magique en sélection et en suppression. Les boîtes de dialogue natives, le presse-papiers système et la réponse de GitHub sont remplacés par des doublures. Sous Linux sans affichage, lancez ce test avec `xvfb-run`.
- Pendant le développement, les PNG et GIF produits ont aussi été relus avec Pillow (Python), sans aucun pixel différent, y compris pour un GIF de 257×199 aux couleurs aléatoires qui sature le dictionnaire LZW.

---

## Limites connues

- Sélection rectangulaire et baguette magique uniquement : pas de lasso ni de sélection elliptique, pas de rotation ni de mise à l'échelle d'une sélection. La sélection elle-même ne s'annule pas avec `Ctrl+Z` (les modifications de pixels, oui).
- Pas de calques de groupe, de modes de fusion ni de calques de référence.
- Le menu Édition de macOS transmet Couper/Copier/Coller/Tout sélectionner à l'interface. Ce comportement n'a pas pu être testé ici (développement sous Windows).
- Pas de tags d'animation (plages d'images nommées). La durée est la même pour toutes les images (réglage en images/s), sans durée propre à chaque image.
- Le GIF ne connaît que la transparence tout ou rien : un pixel à moins de 50 % d'opacité devient transparent. Les navigateurs ramènent aussi les délais inférieurs à 20 ms, donc les animations au-delà de 50 images/s sont ralenties dans un GIF.
- Lors de l'import d'images, le décodeur du navigateur peut légèrement arrondir la couleur des pixels très transparents.
- Un fichier glissé directement sur la fenêtre de Pixelatelier n'est pas ouvert (passer par le double-clic, « Ouvrir avec… » ou « Ouvrir… »). Sous Windows, si vous aviez déjà choisi un autre programme pour les fichiers `.pixatelier`, Windows garde ce choix : clic droit > **Ouvrir avec** > **Choisir une autre application** > Pixelatelier, en cochant « Toujours ».
- Les confirmations à la fermeture utilisent les boîtes de dialogue natives. Elles ont été relues dans le code, mais le test de bout en bout ne peut pas les automatiser.
- Installateurs non signés : avertissement SmartScreen sous Windows, et validation manuelle au premier lancement sur macOS.
- Les installateurs Windows et macOS sont construits et publiés par GitHub Actions. L'application est testée sous Windows ; la version macOS n'a pas encore été vérifiée sur un vrai Mac.
- Mise à jour automatique complète sous Windows uniquement. Sur Mac, l'application n'étant pas signée par Apple, l'installateur est téléchargé et ouvert mais il faut glisser l'application soi-même ; ce parcours n'a pas encore été testé sur un vrai Mac.
- `npm audit` signale des vulnérabilités modérées dans des dépendances d'**electron-builder** (outil de création des installateurs, absent de l'application distribuée).
