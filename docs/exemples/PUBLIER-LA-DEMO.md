# 🎧 Publier la démo audio sur la page GitHub du projet

FR — Le morceau d'exemple **« cyber »** existe dans ce dossier en trois versions :

| Fichier | Usage |
|---|---|
| `2026-09-19_135052_cyber.wav` | master original (23 Mo) — téléchargement |
| `2026-09-19_135052_cyber.mp3` | lecture web rapide (2,4 Mo) — vignette du README, page lecteur |
| `2026-09-19_135052_cyber-demo.mp4` | **lecteur intégré dans le README** (2,9 Mo, forme d'onde animée) |
| `cyber-cover.png` | vignette cliquable du README |

GitHub **supprime les balises `<audio>`** des README : il n'existe qu'une seule façon d'obtenir un
lecteur qui joue *directement dans la page du dépôt* — déposer le média depuis le navigateur de
GitHub (option A). L'option B ajoute une vraie page lecteur hébergée par GitHub Pages.
L'option A prend 30 secondes, l'option B une case à cocher : les deux sont indépendantes.

---

## Option A — Lecteur intégré dans le README (recommandée)

1. Sur github.com, ouvrez `README.md` puis cliquez sur le crayon ✏️ (**Edit this file**).
2. Glissez-déposez le fichier `docs/exemples/2026-09-19_135052_cyber-demo.mp4`
   (depuis votre clone local, ou téléchargez-le d'abord depuis le dépôt) **à l'endroit du
   commentaire `<!-- PLAYER : … -->`** de la section « 🎧 Écouter un exemple ».
   GitHub téléverse le fichier (2,9 Mo < la limite de 10 Mo des plans gratuits) et insère une URL
   du type `https://github.com/user-attachments/assets/xxxxxxxx`.
3. Si GitHub a inséré un lien markdown du style `[...](https://github.com/user-attachments/…)`,
   gardez **uniquement l'URL nue, seule sur sa ligne** : c'est la seule forme que GitHub
   transforme en lecteur natif dans un README. Supprimez le commentaire `<!-- PLAYER … -->`,
   puis **Commit changes**.

Résultat : le lecteur (lecture, volume, seeking) apparaît dans la section « 🎧 Écouter un
exemple », sur la page du projet, sans quitter GitHub. Le MP4 contient le son : pensez seulement
à monter le volume du lecteur.

> Pour remplacer la démo plus tard par un autre morceau :
> `ffmpeg -i "Mes chansons\morceau.wav" -c:a aac -b:a 128k -vn morceau.mp4`
> (un MP4 « audio seul » suffit ; le déposer comme ci-dessus).

---

## Option B — Page lecteur en ligne (GitHub Pages)

Une page lecteur complète (contrôles, téléchargements MP3/WAV, recette) est déjà dans le dépôt :
`docs/index.html`.

1. Dépôt → **Settings** → **Pages** (colonne de gauche).
2. *Source* : **Deploy from a branch** ; *Branch* : `main` → dossier **`/docs`** → **Save**.
3. Une minute plus tard, la page est en ligne :
   `https://tivaphe.github.io/YuEStudio/`
   (si vous choisissez plutôt le dossier racine `/`, l'URL devient
   `https://tivaphe.github.io/YuEStudio/docs/`).
4. Facultatif : ajoutez dans le README un lien
   `[▶️ Écouter sur la page démo](https://tivaphe.github.io/YuEStudio/)`.

La même page s'ouvre aussi en double-cliquant sur `docs/index.html` dans un clone local
(chemins relatifs : aucun serveur nécessaire).

---

## Option C — Rien à faire

Sans A ni B, la vignette du README pointe déjà vers le MP3 brut
(`raw.githubusercontent.com/…/2026-09-19_135052_cyber.mp3`) : un clic ouvre le lecteur natif du
navigateur dans un nouvel onglet. C'est le comportement actuel, immédiatement fonctionnel.

---

# 🎧 Publishing the audio demo on the project's GitHub page

EN — GitHub **strips `<audio>` tags** from READMEs. The only way to get a player that plays
*inside the repository page* is to upload the media through GitHub's own browser uploader
(option A). Option B adds a full player page hosted on GitHub Pages. Option A takes 30 seconds,
option B one checkbox; they are independent.

- **Option A — inline player in the README.** Edit `README.md` on github.com (pencil), drag & drop
  `docs/exemples/2026-09-19_135052_cyber-demo.mp4` (2.9 MB, under the 10 MB free-plan limit) where
  the `<!-- PLAYER … -->` comment sits, keep **only the bare
  `https://github.com/user-attachments/assets/…` URL on its own line** (the only form GitHub turns
  into a native player), delete the comment, commit.
- **Option B — hosted player page.** Settings → Pages → Source: *Deploy from a branch*, branch
  `main`, folder **`/docs`** → Save. The player page then lives at
  `https://tivaphe.github.io/YuEStudio/` (or `…/docs/` if you pick the root folder). It also opens
  locally by double-clicking `docs/index.html`.
- **Option C — do nothing.** The README cover already links to the raw MP3, which opens the
  browser's own player in a new tab. Works today.

To swap the demo track later:
`ffmpeg -i "Mes chansons\track.wav" -c:a aac -b:a 128k -vn track.mp4`, then upload as above.
