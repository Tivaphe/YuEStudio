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
.\installer.ps1 -AvecParolier                    # + parolier local 8B (paroles hors ligne, ~5 Go)
.\installer.ps1 -AvecParolier -Parolier 4b       # parolier léger, GPU 8 Go (~2,5 Go)
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
| **Style** | Tags séparés par virgules : genre, instruments, ambiance, voix. Ex. `French pop, synthés chaleureux, basse ronde, batterie douce, voix féminine`. Les puces de présélection **s'ajoutent à la suite** de ce que vous avez déjà écrit — elles n'effacent jamais le champ, et un tag déjà présent n'est pas doublé. |
| **Paroles** | Structurez avec `[Verse]`, `[Chorus]`, `[Bridge]`, `[Intro]`, `[Outro]` (boutons d'insertion). **La durée de la chanson suit la longueur des paroles.** Pour un instrumental : `[instrumental]`. |

**Réglages avancés** (facultatif, déroulant). Chaque réglage affiche sous son champ
sa **valeur par défaut**, ses **bornes réelles** et sa **plage conseillée** — ce sont les
valeurs vraiment appliquées par le serveur, pas des indications approximatives :

| Réglage | Par défaut | Min – Max | Plage conseillée |
|---|---|---|---|
| **Qualité / modèle** | Q8 | Q4 · Q8 · BF16 | Q8 si 12 Go de VRAM, Q4 si 8 Go |
| **Planification (cot)** | `Complète` | complète · mélodie · désactivée | `Complète` (meilleure structure) |
| **Graine (seed)** | aucune (aléatoire) | 0 – 4 611 686 018 427 387 904 | toute valeur ; 🎲 pour la figer |
| **Étapes de rendu (NAR)** | 8 | 1 – 64 | 8 – 16 (16 : plus fin, 2× plus lent) |
| **Guidage du style** | 0 = le modèle décide | 0 – 20 | 1,5 – 3 (au-delà : voix moins naturelle) |
| **Durée maximale** | aucune (suit les paroles) | 0,2 – 6 min (50 – 9 000 codes à 25/s) | 2 – 4 min pour une chanson |
| **Expressivité du chant** | 1,0 côté modèle | 0,1 – 2 | 0,8 – 1,0 (mots mieux articulés) |

- **Graine** : même graine + même texte = **même chanson**. Laissez vide pour varier, notez la
  graine d'un résultat qui vous plaît pour le reproduire.
- **Durée maximale** : plafond dur, la chanson s'arrête là même si les paroles continuent.
  Laissez 0 en temps normal — la durée suit naturellement la longueur des paroles.
- **Expressivité** : température d'échantillonnage des codes musicaux. C'est le premier levier
  si des mots sont mangés : descendez vers 0,8.

**↺ Valeurs par défaut** (en haut du volet) remet tout d'un coup : 8 étapes, guidage et
expressivité rendus au modèle, aucun plafond de durée, planification complète, qualité Q8,
graine aléatoire. Les paroles, le style et le titre ne sont pas touchés.

> 🤖 **Besoin d'un parolier ?** La carte « Préparer avec une IA » génère un prompt prêt
> à coller dans ChatGPT / Claude / Gemini : voir `PROMPT-LLM.md`.

> ✍️ **Pour bien écrire vos paroles** (balises de structure, durée, français, méthodes d'itération,
> modèle prêt à coller) : lisez **`GUIDE-PAROLES.md`**.

> 💡 YuE2 a été entraîné principalement sur l'**anglais** et le **mandarin**.
> Les paroles en français fonctionnent, mais l'accent peut être approximatif.
> Astuce : gardez les **tags de style en anglais** pour un meilleur respect du genre.

### 📋 File d'attente : plusieurs morceaux d'affilée

Sous le bouton Générer, la carte **« 📋 File d'attente »** permet de préparer plusieurs
chansons à l'avance :

- **➕ Ajouter à la file** y dépose le formulaire tel quel (titre, style, paroles, réglages) ;
- chaque ligne affiche son état : ⏳ en attente, 🎬 en cours, ✅ terminée, ❌ échec ;
- la file se déroule **toute seule, un morceau à la fois** (le moteur ne sait faire qu'une
  génération à la fois) ; vous pouvez fermer les yeux, l'historique se remplit ;
- ✖ retire une ligne encore en attente ; **🗑 Vider la file** nettoie tout ce qui n'est pas
  en cours ; le compteur récapitule attente / terminées / échecs.

Pendant qu'une file tourne, le bouton Générer est verrouillé (un seul morceau à la fois) :
le message propose d'ajouter à la file plutôt. La file vit dans l'onglet du navigateur :
elle n'est pas conservée si vous fermez YueStudio — c'est pourquoi le navigateur demande
confirmation avant un rechargement ou une fermeture tant qu'une génération ou une file attend.

### Carte « 🤖 Préparer avec une IA » (colonne de droite)

Vous avez une idée mais pas le temps d'écrire 30 lignes de paroles structurées ?
Renseignez **Style souhaité** et **Sujet de la chanson** (en français, avec vos mots),
choisissez la **durée visée**, puis au choix :

**✨ Parolier local (100 % hors ligne, recommandé).** Si vous avez installé l'option
(`.\installer.ps1 -AvecParolier`, voir [`PAROLIER.md`](PAROLIER.md)), cliquez
**✨ Écrire les paroles** : le petit modèle abliterated écrit le **TITRE**, le **STYLE**
et les **PAROLES** directement dans YueStudio, puis **⬆ Utiliser** remplit le
formulaire. Chaque clic donne une autre version (graine différente).

**📋 Copier le prompt (LLM externe).** Sans l'option parolier :

1. Cliquez **📋 Copier le prompt** : un prompt de ~5 300 caractères, au format exact
   attendu par YuE2, est copié dans le presse-papiers.
2. Collez-le dans **ChatGPT, Claude, Gemini, Mistral** ou un modèle local.
3. Le LLM répond avec trois blocs : **TITRE / STYLE / PAROLES** (+ la durée estimée).
4. Recopiez le bloc STYLE dans le champ *Style*, le bloc PAROLES dans *Paroles*, le TITRE
   dans *Titre*, puis 🎵 Générer.

Dans les deux cas, le prompt impose au LLM toutes les contraintes du modèle : balises
anglaises, `[Intro]` et `[Interlude]` vides, refrain dupliqué mot pour mot, 6 à 10
syllabes par ligne, rimes régulières, structure adaptée à la durée, et aucun mot de
production dans les paroles. Déroulez **👁 Voir / copier tout le prompt** pour le lire
ou l'ajuster.

📄 Le même prompt, avec sa version courte et des exemples de relances utiles, se trouve
dans **`PROMPT-LLM.md`**. Le parolier local est documenté dans **`PAROLIER.md`**
(modèles, partage de la VRAM avec YuE2, dépannage).

### Onglet « 🕘 Historique »
Chaque génération est conservée avec :
- ▶️ lecteur audio intégré + ⬇️ **Télécharger** le WAV ;
- 📋 **Copier le style** et 📋 **Copier les paroles** (un clic, pour les réutiliser ailleurs) ;
- ♻️ **Réutiliser** (recharge tout dans le formulaire, même graine) et 🎲 **Régénérer** (mêmes réglages, nouvelle graine) ;
- 🎼 **Partition ABC** composée par le modèle, copiable **et modifiable** (si `cot` = full/melody) ;
- ℹ️ **Paramètres** complets (qualité, seed, étapes, temps de calcul, RTF, taille) ;
- ★ favori, ✏️ renommer, 📝 note personnelle, 🗑 supprimer ;
- 🔍 recherche plein texte, ⬇️ **Exporter (JSON)** / ⬆️ **Importer** (sauvegarde de l'historique).

### ✏️ Éditer la partition ABC, puis la resynthétiser

Dans chaque carte de l'historique, le volet **🎼 Partition ABC** cache un bouton
**✏️ Éditer la partition** : la partition s'ouvre dans une zone de texte modifiable.
Corrigez une ligne mélodique, ajoutez un `[Chorus]`, simplifiez un passage… puis :

- choisissez ce que le moteur doit suivre : **la mélodie seule** (`cot = melody`, le modèle
  réinvente l'accompagnement) ou **la partition complète** (`cot = full`, tout est rejoué) ;
- **🔁 Resynthétiser** relance immédiatement la synthèse audio depuis cette partition
  (le modèle ne replanifie rien : il joue votre partition avec le style et les paroles
  d'origine) ;
- **➕ À la file** fait la même chose mais dans la file d'attente, pour enchaîner les prises.

La nouvelle chanson apparaît dans l'historique avec un badge **♻️ resynthèse de …** et la
mention « Partition ABC : fournie (resynthèse) » dans ses paramètres.

> 🎧 **Workflow cover (audio de référence)** : rejouer la mélodie d'un enregistrement
> existant exige de transcrire cet enregistrement en partition (modèle SheetSage2).
> audio.cpp ne l'intègre pas encore en version stable : dès qu'il le fera, YueStudio
> ajoutera l'import audio ici même. En attendant, collez vous-même une partition ABC
> (ou récupérez celle d'une génération précédente) : le moteur suit exactement le
> même chemin (`cot = melody` + partition fournie).

### Thème et langue

En haut à droite, deux boutons mémorisés entre les sessions :

| Bouton | États | Effet |
|---|---|---|
| 🌙 **Sombre** | sombre → clair → système | Change les couleurs de toute l'interface. *Système* suit le réglage de Windows. |
| 🇬🇧 **English** | français ↔ anglais | Traduit l'interface **sans rechargement** : formulaire, génération en cours et onglet affiché sont conservés. |

Le choix est enregistré dans le navigateur (`localStorage`) et appliqué avant le premier rendu :
aucun scintillement au démarrage. Le prompt pour LLM de la carte « Préparer avec une IA » est
fourni dans les deux langues, ainsi que l'exemple de paroles inséré par le bouton ✨ **Exemple**
(et les textes d'aide affichés dans les champs).

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
│  ├─ journal-moteur.log  ← à lire en cas de problème
│  └─ llm/                option -AvecParolier : serveur llama.cpp + journal-parolier.log
├─ models/Yue2-3B-GGUF/   poids du modèle (GGUF + sidecars)
├─ models/Parolier-GGUF/  option -AvecParolier : petit LLM abliterated (GGUF)
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
| Parolier : `non installé` | Normal sans l'option : `.\\installer.ps1 -AvecParolier` (voir `PAROLIER.md`). |
| Parolier qui s'arrête aussitôt | VRAM insuffisante : 🧹 *Libérer la VRAM*, modèle **4B**, détails dans `engine\\journal-parolier.log`. |

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
| Fermeture de l'**onglet du navigateur** | la VRAM est libérée après un délai de grâce de 5 s, le moteur reste chaud (rechargement immédiat si vous revenez) — un simple **F5** annule le déchargement, et rien n'est déchargé pendant une génération |
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
Même principe pour le parolier : variable `$LlamaBuild` (ex. build llama.cpp plus récent),
puis `.\\installer.ps1 -AvecParolier` (le modèle GGUF, lui, n'est pas re-téléchargé).

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
- Parolier local (optionnel) : serveur [llama.cpp](https://github.com/ggml-org/llama.cpp)
  + [Huihui-Qwen3.5-9B-abliterated](https://huggingface.co/huihui-ai/Huihui-Qwen3.5-9B-abliterated)
  (GGUF [mradermacher](https://huggingface.co/mradermacher/Huihui-Qwen3.5-9B-abliterated-GGUF),
  ou [Gemma-4-12B Heretic](https://huggingface.co/igorls/gemma-4-12B-it-heretic-GGUF))
- Article de référence : *YuE: Scaling Open Foundation Models for Long-Form Music Generation* (arXiv:2503.08638)
