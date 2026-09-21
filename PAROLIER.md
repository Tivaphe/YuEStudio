# ✨ Le parolier local — écrire titre, style et paroles hors ligne

Le **parolier** est un petit modèle de langage (LLM) qui tourne **sur votre PC**,
sans cloud ni abonnement : vous saisissez un **style** et un **sujet** dans la carte
« 🤖 Préparer avec une IA », vous cliquez **✨ Écrire les paroles**, et il produit
le **TITRE**, le **STYLE** et les **PAROLES** au format exact attendu par YuE2.
Un clic sur **⬆ Utiliser** remplit le formulaire, puis 🎵 Générer.

C'est le même prompt que la version « copier vers ChatGPT » (lire
[`PROMPT-LLM.md`](PROMPT-LLM.md)) : le gabarit est lu dans `app/index.html`,
il n'existe qu'en un seul exemplaire, sans dérive possible entre les deux usages.

---

## 1. Installation (une seule fois)

Dans PowerShell, depuis le dossier de l'application :

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force

.\installer.ps1 -AvecParolier              # parolier 9B recommandé (+ ~6 Go)
.\installer.ps1 -AvecParolier -Parolier 4b # parolier 4B léger, GPU 8 Go (+ ~2,5 Go)
.\installer.ps1 -AvecParolier -Parolier 12b   # parolier 12B Heretic, créativité max (+ ~7,5 Go)
.\installer.ps1 -AvecParolier -Parolier 8b    # valeur sûre 2025 (+ ~5 Go)
```

L'option télécharge le serveur [llama.cpp](https://github.com/ggml-org/llama.cpp)
(binaires Windows officiels, même backend que le moteur musical : CUDA, Vulkan ou CPU)
dans `engine/llm/`, plus le modèle GGUF dans `models/Parolier-GGUF/`.
Besoin de plusieurs modèles ? Relancez la commande avec un autre `-Parolier` :
l'interface affiche alors un **menu de choix** (votre préférence est mémorisée).
Comme toujours : reprise automatique en cas de coupure, et `.\\installer.ps1 -Verifier`
pour diagnostiquer.

Sans l'option, YueStudio fonctionne exactement comme avant — le bouton affiche
simplement la commande à lancer.

## 2. Utilisation

1. Renseignez **Style souhaité** et **Sujet de la chanson**, choisissez la **durée visée**.
2. Cliquez **✨ Écrire les paroles** : la première fois, le modèle se charge
   (~20 s), puis l'écriture prend **30 à 60 s**.
3. Relisez le résultat affiché sous le bouton, cliquez **⬆ Utiliser** :
   le titre, le style et les paroles remplissent le formulaire.
4. Relisez encore (un petit modèle fait parfois une rime bancale ou oublie de
   dupliquer un refrain), ajustez, puis 🎵 **Générer la musique**.

Chaque clic utilise une **graine différente** : relancez pour obtenir une autre
version du même sujet. La température est réglée à **1,0** (créatif) ; les
modèles proposés sont **abliterated** (voir § 4), donc sans refus ni moralisation
sur les thèmes sombres (rupture, nuit, révolte…).

## 3. La VRAM : qui cohabite avec qui

Le parolier et le moteur musical partagent le GPU. Règle automatique appliquée
par YueStudio : **la musique est prioritaire** — le parolier s'arrête dès qu'une
génération musicale commence (il redémarre tout seul en ~15 s à la demande
suivante), et après **15 minutes** sans écrire. Le bouton 🧹 *Libérer la VRAM*
et `3-ARRETER.bat` coupent aussi le parolier.

| Votre GPU | Combinaison conseillée | Total VRAM | Avis |
|---|---|---|---|
| 16 Go (ex. RTX 2000 Ada) | YuE2 **Q8** (~9 Go) + Parolier **9B** (~6 Go) | ~15 Go | ✅ cohabitation directe |
| 16 Go | YuE2 **Q8** (~9 Go) + Parolier **12B** (~8 Go) | ~17 Go | 🔄 à tour de rôle : cliquez 🧹 *Libérer la VRAM*, écrivez, puis régénérez la musique (le parolier s'efface tout seul) |
| 12 Go | YuE2 **Q4** (~8 Go) + Parolier **9B** (~6 Go) | ~14 Go | ⚠️ limite : préférez le **4B** (~3 Go), ou libérez la VRAM avant d'écrire |
| 12 Go | YuE2 **Q4** (~8 Go) + Parolier **4B** (~3 Go) | ~11 Go | ✅ confortable |
| 8 Go | YuE2 **Q4** (~8 Go) **ou** Parolier **4B** (~3 Go) | — | 🔄 un seul à la fois : cliquez 🧹 *Libérer la VRAM* avant d'écrire des paroles |

En cas de mémoire insuffisante, le serveur LLM s'arrête avec un message explicite
(détails dans `engine/journal-parolier.log`) : libérez la VRAM et/ou passez au 4B.

## 4. Les modèles : ce que dit Hugging Face (sept. 2026)

> **Abliterated ? Heretic ?** L'*abliteration* retire à un modèle ses refus
> intégrés (la « censure » d'alignement) en effaçant chirurgicalement une direction
> dans ses poids — sans réentraînement, donc sans perdre ses capacités.
> *Heretic* (outil de p-e-w) est une méthode d'abliteration parmi d'autres ;
> huihui-ai utilise la méthode classique (orthogonalisation). En pratique, pour
> écrire des chansons : **aucun refus sur les thèmes difficiles, et un modèle
> plus spontané et créatif** — exactement ce qu'on veut pour des paroles.

### ✅ Les quatre modèles proposés

| | Parolier 9B ⭐ | Parolier 12B Heretic 🎭 | Parolier 8B | Parolier 4B |
|---|---|---|---|---|
| Modèle source | [huihui-ai/Huihui-Qwen3.5-9B-abliterated](https://huggingface.co/huihui-ai/Huihui-Qwen3.5-9B-abliterated) | [igorls/gemma-4-12B-it-heretic](https://huggingface.co/igorls/gemma-4-12B-it-heretic-GGUF) (méthode Heretic p-e-w) | [huihui-ai/Huihui-Qwen3-8B-abliterated-v2](https://huggingface.co/huihui-ai/Huihui-Qwen3-8B-abliterated-v2) | [huihui-ai/Huihui-Qwen3-4B-Instruct-2507-abliterated](https://huggingface.co/huihui-ai/Huihui-Qwen3-4B-Instruct-2507-abliterated) |
| Fichier GGUF `Q4_K_M` | [mradermacher/…-GGUF](https://huggingface.co/mradermacher/Huihui-Qwen3.5-9B-abliterated-GGUF) | [igorls/…-GGUF](https://huggingface.co/igorls/gemma-4-12B-it-heretic-GGUF) | [mradermacher/…v2-GGUF](https://huggingface.co/mradermacher/Huihui-Qwen3-8B-abliterated-v2-GGUF) | [mradermacher/…-GGUF](https://huggingface.co/mradermacher/Huihui-Qwen3-4B-Instruct-2507-abliterated-GGUF) |
| Poids | 5,2 Gio | 6,9 Gio | 4,7 Gio | 2,3 Gio |
| VRAM (Q4 + contexte 8k) | ~6 Go | ~8 Go | ~6 Go | ~3 Go |
| Licence | **Apache 2.0** ✅ | **Gemma** ✅ (commercial autorisé) | **Apache 2.0** ✅ | **Apache 2.0** ✅ |
| Idéal pour | tous les usages | créativité max, GPU 16 Go et + | repli éprouvé | GPU 8 Go |

**Pourquoi Qwen3.5-9B abliterated (défaut) ?** Qwen3.5 (début 2026) est la meilleure
base ouverte pour le **français** dans cette taille ; la version abliterated de
huihui-ai (l'auteur de référence des abliterations propres, 320/320 au test de
non-refus) garde toute la qualité d'instruction — indispensable pour respecter un
format contraint (TITRE / STYLE / PAROLES, refrain dupliqué, syllabes).
La quantification Q4_K_M de mradermacher (quantificateur communautaire de
référence) est le meilleur compromis taille/qualité. Et la licence Apache 2.0
autorise l'usage commercial des paroles produites — contrairement aux poids YuE2
(CC BY-NC, voir § 7).

**Pourquoi Gemma 4 12B Heretic (option créative) ?** C'est une vraie abliteration
*Heretic* (outil de p-e-w) : 0 refus sur 100 tests, modèle mesuré comme plus
spontané — la plume la plus libre du lot, avec l'excellent français de Gemma 4.
Revers : ~8 Go de VRAM (GPU 16 Go conseillé) et licence Gemma (usage commercial
autorisé, voir les conditions Google). Le 8B reste proposé en repli : même
famille et même auteur que le 9B, mais d'architecture 2025 plus longuement
éprouvée sous llama.cpp.

### ❌ Les candidats écartés (et pourquoi)

| Modèle | Motif |
|---|---|
| Dolphin 3.0 Llama 8B abliterated | Très créatif en **anglais**, mais le français est en retrait face à Qwen3. |
| Autres séries *Heretic* 2025 (DavidAU, DreamFast…) | Belles plumes, mais versions expérimentales et changeantes : moins stables qu'un Heretic 2026 mesuré (0/100 refus) sur un format strict. |
| Gemma 3 12B abliterated | Belle plume, mais distribuée en **Q8 uniquement** (~13 Go de VRAM) : ne cohabite avec YuE2 sur aucun GPU courant. |
| Qwen3-14B abliterated | Le meilleur 14B (~9 Go VRAM), mais incompatible avec YuE2 sauf GPU 24 Go. |
| Qwen3.5-9B « HauhauCS » et dérivés précoces | Remplacés : même base 2026, mais la version abliterated de huihui-ai est plus propre et mieux testée — c'est elle qui est proposée. |
| Mistral Small 3.x abliterated (24B) | Le roi du roleplay créatif… et 15 Go de VRAM en Q4 : hors catégorie. |
| Modèles 1-3B (Llama-3.2-3B-Heretic…) | Trop petits : ils ne tiennent pas un format à 11 règles sur 30 lignes. |

### Changer de modèle à la main

Avancé : vous pouvez poser **n'importe quel GGUF instruct** récent dans
`models/Parolier-GGUF/` et ajuster `LLM_MODELS` dans `app/server.py`
(`repo` / `file` / `size`, `no_think: false` si ce n'est pas un Qwen3).
Un serveur llama.cpp (ou compatible OpenAI) déjà lancé sur le port 8081 est
**réutilisé tel quel** — pratique pour tester un modèle sans toucher à YueStudio.

## 5. Détails techniques

- **Serveur** : `llama-server` officiel (build `b10964`, sept. 2026 — variable
  `$LlamaBuild` dans `installer.ps1`), sur `127.0.0.1:8081`, contexte 8192 tokens,
  tout sur GPU sauf backend CPU.
- **Appel** : `POST /v1/chat/completions` (API compatible OpenAI),
  `temperature 1.0`, `top_p 0.95`, `max_tokens 2048`, `enable_thinking: false`,
  graine aléatoire à chaque fois.
  Pas de pénalité de répétition (elle casserait la duplication exigée du refrain).
- **Pas de raisonnement visible** : YueStudio ajoute `/no_think` pour Qwen3 et
  `enable_thinking: false` pour Qwen3.5/Gemma, et filtre les éventuels blocs
  `<think>…</think>` ou canaux `<|channel>thought…` résiduels.
- **Découpage** : le serveur extrait TITRE / STYLE / PAROLES / DURÉE ESTIMÉE même
  si le modèle ajoute du markdown (`**TITRE :**`, `#`…). Si le format est vraiment
  méconnaissable, le texte brut est affiché : rien n'est perdu, régénérez ou copiez
  les bons passages.
- **Journal** : `engine/journal-parolier.log` (erreurs de chargement, manque de VRAM).

### API locale

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/lyrics` | écrit une chanson (`prompt` complet, ou `style` + `sujet` + `duration` + `lang`, `model` optionnel : `9b`, `12b`, `8b`, `4b`) ; renvoie `title`, `style`, `lyrics`, `duration_estimate`, `raw`, `model`, `seed`, `gen_seconds` |
| POST | `/api/lyrics/unload` | arrête le parolier (libère la VRAM) |
| GET | `/api/state` | le bloc `llm` donne modèles installés, modèle actif et état du serveur |

```bash
curl -X POST http://127.0.0.1:8090/api/lyrics \
     -H "Content-Type: application/json" \
     -d '{"style":"pop française mélancolique, voix féminine douce","subject":"un déménagement nocturne","duration":"standard (~3 min)","lang":"fr"}'
```

## 6. Dépannage

| Symptôme | Solution |
|---|---|
| `Parolier local non installé` | `.\\installer.ps1 -AvecParolier` (une seule fois). |
| Le serveur LLM s'arrête aussitôt | VRAM insuffisante : 🧹 *Libérer la VRAM*, puis modèle plus petit (`-Parolier 9b` ou `4b` à la place du 12B). Détails dans `engine/journal-parolier.log`. |
| Réponse hors format (texte brut) | Cliquez à nouveau : une autre graine donne une autre version. Les petits modèles respectent le format ~9 fois sur 10. |
| Paroles en anglais alors que le sujet est français | Précisez la langue dans le sujet (« paroles en français ») ou passez l'interface en français. |
| Antivirus supprime `llama-server.exe` | Même faux positif que pour `audiocpp_server.exe` (binaires ggml non signés) : excluez le dossier. |

## 7. Licence des paroles produites

Les modèles Qwen (9B, 8B, 4B) sont sous **Apache 2.0** et le 12B Heretic sous
**licence Gemma** (usage commercial autorisé, voir les conditions Google) : les
paroles qu'ils écrivent vous appartiennent, y compris pour un usage commercial.
⚠️ Mais attention : dès qu'elles sont chantées par YuE2, le **morceau** relève de
la licence des poids YuE2 (**CC BY-NC 4.0 — usage non commercial**). Les paroles
seules restent libres.
