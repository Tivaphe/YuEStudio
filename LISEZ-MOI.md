# 🎵 YueStudio — créer de la musique en local avec YuE2-3B

Application simple pour générer des chansons complètes (voix + instruments, 48 kHz stéréo)
**entièrement sur votre PC**, avec le modèle ouvert [m-a-p/YuE2-3B](https://huggingface.co/m-a-p/YuE2-3B)
en version GGUF, propulsée par le moteur [audio.cpp](https://github.com/0xShug0/audio.cpp).

Vous remplissez **Titre + Paroles + Style**, vous cliquez sur **Générer**, et l'**Historique**
conserve toutes vos générations avec leur style et leurs paroles **copiables et réutilisables**.

---

## 🖥️ Votre configuration

| Élément | Valeur | Verdict |
|---|---|---|
| PC | ASUS ExpertCenter D500SC | ✅ |
| CPU | Intel i5-11400 (6 cœurs / 12 threads) | ✅ |
| RAM | 32 Go | ✅ largement suffisant |
| GPU | **NVIDIA RTX 2000 Ada — 16 Go** | ✅ compatible (CUDA, compute 8.9) |
| OS | Windows 11 | ✅ |

**Consommation VRAM mesurée par audio.cpp** (chanson de ~3 min 30) :

| Qualité | Fichiers | VRAM de pointe | Vitesse relative |
|---|---|---|---|
| Q4_0 + VAE F16 | 2,7 Go + 0,3 Go | **~7,8 Go** | la plus rapide |
| **Q8_0 + VAE F16** *(recommandé)* | 4,3 Go + 0,3 Go | **~8,9 Go** | rapide, quasi sans perte |
| BF16 + VAE F32 | 7,3 Go + 0,5 Go | **~12,5 Go** | la plus fidèle, plus lente |

👉 Vos 16 Go de VRAM passent **les trois qualités**, y compris la BF16.
Ordre de grandeur du temps de calcul : environ **2 à 6 minutes pour une chanson de 3 minutes**
sur une RTX 2000 Ada (une RTX 4090 met ~71 s). La première génération est plus lente
(chargement du modèle en VRAM : 30 à 60 s).

> ⚠️ **Pourquoi la version GGUF et pas le modèle de base ?**
> Le dépôt officiel `m-a-p/YuE2-3B` (7,3 Go en BF16) s'installe via une roue Python
> `yue2_infer` conçue pour **Linux + GPU 24 Go**. Sur Windows 11 + 16 Go, la voie GGUF
> (moteur C++ natif `audio.cpp`, binaires Windows précompilés, quantification Q8/Q4) est
> **plus simple à installer, plus légère et plus rapide**. C'est ce que fait cet installateur.
> Les poids proviennent du même modèle officiel, convertis en GGUF
> par [audio-cpp/Yue2-3B-GGUF](https://huggingface.co/audio-cpp/Yue2-3B-GGUF).

---

## 🚀 Installation (3 étapes)

### Étape 0 — Python (une seule fois, 30 secondes)
L'interface utilise Python (uniquement la bibliothèque standard, **aucun paquet à installer**).
Dans PowerShell :

```powershell
winget install -e --id Python.Python.3.12
```

Puis **fermez et rouvrez** la fenêtre PowerShell / l'explorateur.
(Si Python est déjà installé en version 3.8 ou plus, passez cette étape.)

### Étape 1 — Installer
Double-cliquez sur **`1-INSTALLER.bat`**
→ télécharge le moteur audio.cpp (~1 Go avec CUDA, 58 Mo avec Vulkan) et le modèle YuE2 (~4,6 Go en Q8).

* Si Windows SmartScreen affiche « a protégé votre ordinateur » : **Informations complémentaires → Exécuter quand même**.
  Les fichiers viennent de `github.com` et `huggingface.co` (le binaire n'est pas signé numériquement).
* Le téléchargement **reprend automatiquement** en cas de coupure : relancez simplement `1-INSTALLER.bat`.

### Étape 2 — Lancer
Double-cliquez sur **`2-LANCER.bat`**
→ le moteur démarre, le navigateur s'ouvre sur <http://127.0.0.1:8090>. **Gardez la fenêtre noire ouverte.**

### Étape 3 — Créer
Remplissez **Titre**, **Style**, **Paroles**, cliquez **🎵 Générer la musique**.
Bouton **✨ Exemple** pour partir d'un cas concret modifiable.

**Pour tout arrêter : fermez simplement la fenêtre noire.** Le modèle est déchargé
(la VRAM est libérée) et le moteur est coupé automatiquement — voir
[Arrêter YueStudio](#-arrêter-yuestudio-fermez-la-fenêtre).

---

## 📦 Options d'installation

Dans PowerShell, depuis le dossier de l'application :

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force

.\installer.ps1                                  # défaut : CUDA + qualité Q8
.\installer.ps1 -ToutesQualites                  # Q4 + Q8 + BF16 (~12 Go de modèles)
.\installer.ps1 -Qualite q4                      # le plus léger (~3 Go)
.\installer.ps1 -Backend vulkan                  # si CUDA pose problème (58 Mo de moteur)
.\installer.ps1 -Verifier                        # diagnostic complet, sans rien télécharger
```

Le choix du backend est automatique : **CUDA 13.3** si le pilote NVIDIA ≥ 580,
sinon **CUDA 12.4**, sinon **Vulkan** s'il n'y a pas de carte NVIDIA.

---

## 🧭 Utilisation

### Onglet « 🎼 Créer une musique »
| Champ | Ce qu'il faut savoir |
|---|---|
| **Titre** | Sert au nom du fichier et à l'historique. Vide → déduit de la première ligne de paroles. |
| **Style** | Tags séparés par virgules : genre, instruments, ambiance, voix. Ex. `French pop, synthés chaleureux, basse ronde, batterie douce, voix féminine`. Des puces de présélection sont proposées. |
| **Paroles** | Structurez avec `[Verse]`, `[Chorus]`, `[Bridge]`, `[Intro]`, `[Outro]` (boutons d'insertion). **La durée de la chanson suit la longueur des paroles.** Pour un instrumental : `[instrumental]`. |

**Réglages avancés** (facultatif, déroulant) :
- **Qualité / modèle** : Q4, Q8 ou BF16 (changer de qualité recharge le modèle, ~30 s).
- **Planification (cot)** : `full` = le modèle compose d'abord une partition ABC lisible puis chante
  (meilleure structure, recommandé) · `melody` = mélodie seule · `off` = direct, plus rapide.
- **Graine (seed)** : même graine + même texte = **même chanson**. Laissez vide pour varier,
  notez la graine d'un résultat qui vous plaît pour le reproduire.
- **Étapes de rendu** : 8 par défaut ; 16 affine légèrement le rendu (2× plus lent).
- **Guidage du style** : 0 = défaut du modèle ; 1,5–3 renforce le respect du style.
- **Durée maximale (minutes)** : plafond dur (0 = pas de plafond). 6 min = maximum du modèle
  (9 000 codes musicaux à 25 codes/seconde). Utile pour éviter qu'un morceau ne s'étire.
- **Expressivité du chant** : température d'échantillonnage des codes musicaux.
  0,8–0,9 = chant plus stable et mieux articulé ; > 1 = plus de liberté, plus de risques.

> 🤖 **Besoin d'un parolier ?** La carte « Préparer avec une IA » génère un prompt prêt
> à coller dans ChatGPT / Claude / Gemini : voir `PROMPT-LLM.md`.

> ✍️ **Pour bien écrire vos paroles** (balises de structure, durée, français, méthodes d'itération,
> modèle prêt à coller) : lisez **`GUIDE-PAROLES.md`**.

> 💡 YuE2 a été entraîné principalement sur l'**anglais** et le **mandarin**.
> Les paroles en français fonctionnent, mais l'accent peut être approximatif.
> Astuce : gardez les **tags de style en anglais** pour un meilleur respect du genre.

### Carte « 🤖 Préparer avec une IA » (colonne de droite)

Vous avez une idée mais pas le temps d'écrire 30 lignes de paroles structurées ?

1. Renseignez **Style souhaité** et **Sujet de la chanson** (en français, avec vos mots),
   et choisissez la **durée visée**.
2. Cliquez **📋 Copier le prompt** : un prompt de ~5 300 caractères, au format exact attendu
   par YuE2, est copié dans le presse-papiers.
3. Collez-le dans **ChatGPT, Claude, Gemini, Mistral** ou un modèle local.
4. Le LLM répond avec trois blocs : **TITRE / STYLE / PAROLES** (+ la durée estimée).
5. Recopiez le bloc STYLE dans le champ *Style*, le bloc PAROLES dans *Paroles*, le TITRE
   dans *Titre*, puis 🎵 Générer.

Le prompt impose au LLM toutes les contraintes du modèle : balises anglaises, `[Intro]` et
`[Interlude]` vides, refrain dupliqué mot pour mot, 6 à 10 syllabes par ligne, rimes régulières,
structure adaptée à la durée, et aucun mot de production dans les paroles.
Déroulez **👁 Voir / copier tout le prompt** pour le lire ou l'ajuster.

📄 Le même prompt, avec sa version courte et des exemples de relances utiles, se trouve dans
**`PROMPT-LLM.md`**.

### Onglet « 🕘 Historique »
Chaque génération est conservée avec :
- ▶️ lecteur audio intégré + ⬇️ **Télécharger** le WAV ;
- 📋 **Copier le style** et 📋 **Copier les paroles** (un clic, pour les réutiliser ailleurs) ;
- ♻️ **Réutiliser** (recharge tout dans le formulaire, même graine) et 🎲 **Régénérer** (mêmes réglages, nouvelle graine) ;
- 🎼 **Partition ABC** composée par le modèle, copiable (si `cot` = full/melody) ;
- ℹ️ **Paramètres** complets (qualité, seed, étapes, temps de calcul, RTF, taille) ;
- ★ favori, ✏️ renommer, 📝 note personnelle, 🗑 supprimer ;
- 🔍 recherche plein texte, ⬇️ **Exporter (JSON)** / ⬆️ **Importer** (sauvegarde de l'historique).

### Barre supérieure
- **État du moteur** : vert = prêt, rouge = arrêté (relancez `2-LANCER.bat`).
- **📁 Mes chansons** : ouvre le dossier des fichiers audio dans l'explorateur.
- **🧹 Libérer la VRAM** : décharge le modèle du GPU (il se rechargera à la génération suivante).
  Utile avant de lancer un jeu ou un autre logiciel gourmand. Le modèle se décharge aussi tout seul après 30 min d'inactivité.

### Raccourcis clavier
- `Ctrl + Entrée` : lancer la génération
- `Ctrl + H` : basculer Créer / Historique

---

## 📁 Contenu du dossier

```
YueStudio/
├─ 1-INSTALLER.bat        télécharge moteur + modèle
├─ 2-LANCER.bat           démarre l'application (à utiliser au quotidien)
├─ 3-ARRETER.bat          arrêt forcé de secours (normalement inutile)
├─ README.md              page de présentation (format GitHub)
├─ installer.ps1          le vrai installateur (appelé par 1-INSTALLER.bat)
├─ app/
│  ├─ server.py           interface + serveur local (Python standard, sans dépendance)
│  ├─ index.html          l'application web
│  ├─ app.js  style.css  favicon.svg
├─ engine/                moteur audio.cpp (audiocpp_server.exe + DLL)
│  ├─ server.json         configuration générée automatiquement
│  └─ journal-moteur.log  ← à lire en cas de problème
├─ models/Yue2-3B-GGUF/   poids du modèle (GGUF + sidecars)
├─ Mes chansons/          🎧 vos fichiers WAV générés
└─ historique.json        🗂️ tout l'historique (titre, style, paroles, paramètres…)
```

Vous pouvez **déplacer ou copier tout le dossier** où vous voulez (y compris sur une autre
machine) : rien n'est écrit dans le registre ni dans les dossiers système.
Une sauvegarde = `historique.json` + dossier `Mes chansons`.

---

## 🩺 Dépannage

| Symptôme | Solution |
|---|---|
| `Python est introuvable` | `winget install -e --id Python.Python.3.12`, puis **rouvrez** la fenêtre. Sinon [python.org](https://www.python.org/downloads/windows/) en cochant *Add python.exe to PATH*. |
| SmartScreen bloque | Informations complémentaires → Exécuter quand même. |
| Téléchargement coupé | Relancez `1-INSTALLER.bat` : il **reprend** là où il s'est arrêté (taille vérifiée). |
| `ggml-cuda.dll` / erreur CUDA au démarrage | Pilote NVIDIA trop ancien : mettez-le à jour ([GeForce](https://www.nvidia.fr/france/drivers/)), ou relancez `.\installer.ps1 -Backend vulkan`. |
| Moteur muet, rien ne se passe | Ouvrez `engine\journal-moteur.log` : la vraie erreur y est écrite. |
| `insufficient memory` / plantage GPU | Choisissez la qualité **Q4** dans Réglages avancés, fermez les autres applis GPU, puis cliquez 🧹 *Libérer la VRAM*. |
| Port 8080 ou 8090 déjà utilisé | L'application cherche automatiquement un port libre ; l'URL affichée dans la fenêtre noire fait foi. |
| Génération très longue | Normal si la chanson est longue : la durée suit les paroles. Réduisez les couplets, passez `cot` sur `off` et les étapes à 8. |
| Chanson coupée / répétitive | Raccourcissez les paroles, augmentez **Durée maximale** dans Réglages avancés, ou changez de graine. |
| Page blanche dans le navigateur | Rechargez (F5). Vérifiez que la fenêtre noire est toujours ouverte. |
| Antivirus qui supprime `audiocpp_server.exe` | Faux positif classique sur les binaires ggml non signés : ajoutez le dossier `YueStudio` aux exclusions. |

Réglages fins : les options déjà exposées dans l'interface (**Durée maximale** =
`semantic_max_tokens`, **Expressivité du chant** = `semantic_temperature`) sont documentées dans
`GUIDE-PAROLES.md`. Les autres options du modèle se trouvent dans `engine/model_specs/yue2.json`
et peuvent être ajoutées dans `app/server.py` (dictionnaire `options` de `run_generation`).

**Réinitialiser complètement** : fermez l'application, supprimez `engine`, `models` et
`historique.json`, puis relancez `1-INSTALLER.bat`.

---

## ⏻ Arrêter YueStudio : fermez la fenêtre

**Il n'y a rien d'autre à faire.** Fermer la fenêtre noire déclenche, dans l'ordre :

1. **déchargement du modèle** → la VRAM est libérée proprement ;
2. **arrêt du moteur audio.cpp** (c'est un sous-processus caché de l'interface, il n'a pas
   de fenêtre à lui) ;
3. **suppression de `yuestudio.pid`**.

Tous les cas de figure sont couverts :

| Action | Résultat |
|---|---|
| Croix de la fenêtre | arrêt complet, modèle déchargé |
| `Ctrl+C` dans la fenêtre | idem |
| Fermeture de session Windows / extinction du PC | idem (gestionnaire `SetConsoleCtrlHandler`) |
| Fermeture de l'**onglet du navigateur** | la VRAM est libérée, le moteur reste chaud (rechargement immédiat si vous revenez) |
| 30 minutes sans générer | le moteur décharge le modèle tout seul (`idle_unload_ms`) |
| Bouton 🧹 *Libérer la VRAM* | déchargement à la demande, sans rien fermer |

`3-ARRETER.bat` ne sert plus que de **secours** : fenêtre fermée brutalement, processus orphelin
après un plantage, ou moteur lancé à la main. Il force l'arrêt de l'interface et de
`audiocpp_server.exe`.

Vérifié en conditions réelles : à la fermeture, le journal affiche
`Dechargement du modele (liberation de la VRAM)...` puis `[OK] Modele decharge`, le processus
moteur disparaît et le port est libéré.

---

## 🔄 Mettre à jour

Le modèle YuE2 et le moteur audio.cpp évoluent vite.
Modifiez la variable `$Version` en haut de `installer.ps1` (ex. `v0.8.2`),
puis relancez `1-INSTALLER.bat`. Les modèles déjà téléchargés ne sont pas re-téléchargés.

---

## ⚖️ Licence

- **Poids du modèle YuE2-3B** : [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) —
  **usage personnel et recherche uniquement, pas d'usage commercial** (ni vente, ni monétisation
  des morceaux générés). Les fichiers GGUF d'`audio-cpp/Yue2-3B-GGUF` sont redistribués aux mêmes conditions.
- **Moteur audio.cpp** : licence MIT.
- **YueStudio** (ce petit code d'interface) : faites-en ce que vous voulez.

---

## 🙏 Crédits

- YuE2 : Multimodal Art Projection (M-A-P) & OpenMOSS — [m-a-p/YuE2-3B](https://huggingface.co/m-a-p/YuE2-3B) · [démos](https://map-yue2.github.io/)
- Conversion GGUF : [audio-cpp/Yue2-3B-GGUF](https://huggingface.co/audio-cpp/Yue2-3B-GGUF)
- Moteur : [0xShug0/audio.cpp](https://github.com/0xShug0/audio.cpp) (v0.8.1)
- Article de référence : *YuE: Scaling Open Foundation Models for Long-Form Music Generation* (arXiv:2503.08638)
