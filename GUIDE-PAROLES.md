# ✍️ Bien écrire ses paroles pour YuE2

Guide pratique, basé sur le **fonctionnement réel du modèle** (format de prompt vérifié dans le
code du moteur) et sur l'**exemple officiel** des auteurs
([`tonight-awake.json`](https://huggingface.co/m-a-p/YuE2-3B/blob/main/examples/tonight-awake.json),
la chanson 今晚不眠).

---

## 1. Ce que le modèle voit réellement

Vos deux champs sont concaténés dans un prompt unique, **sans aucune modification** :

```
Generate a chord-annotated ABC transcription, then generate music with codec tokens…
[Tags]
<votre champ STYLE>
[Lyrics]
<votre champ PAROLES>
```

Conséquences concrètes :

- Le texte est envoyé **tel quel** : le modèle ne « comprend » pas une consigne, il **reconnaît un
  format** vu à l'entraînement. Respectez les conventions ci-dessous, elles font toute la différence.
- Tout ce qui n'est pas une parole chantée **doit aller dans le champ Style**, jamais dans les paroles.
  Écrire `BPM 120, tempo rapide` dans les paroles ne fait que perturber le modèle.
- Les balises de structure s'écrivent **en anglais, entre crochets, sur leur propre ligne**.

---

## 2. Les balises de structure

### Celles de l'exemple officiel (les plus sûres)

| Balise | Rôle | Astuce |
|---|---|---|
| `[Intro]` | Ouverture instrumentale | **Laissez-la vide** (aucune parole dessous) |
| `[Verse]` | Couplet, narration | 4 lignes en général |
| `[Pre-Chorus]` | Montée vers le refrain | 2 à 4 lignes, plus courtes que le couplet |
| `[Chorus]` | Refrain, le « hook » | À **répéter mot pour mot** à chaque passage |
| `[Interlude]` | Pause instrumentale | **Laissez-la vide** |
| `[Bridge]` | Rupture, autre couleur | 2 à 4 lignes |
| `[Outro]` | Fin | Peut contenir des mots très courts, répétés |

### Celles de l'écosystème YuE (fonctionnent aussi)

`[instrumental]` · `[Solo]` · `[Break]` · `[Hook]`

En cas de doute, restez sur les balises de l'exemple officiel : ce sont celles que le modèle a le plus certainement vues à l'entraînement. **Écrivez toujours les balises en anglais** (`[Chorus]`, pas `[Refrain]`), même si les paroles sont en français.

### Squelette officiel (à recopier)

```
[Intro]

[Verse]
…4 lignes…

[Pre-Chorus]
…4 lignes…

[Chorus]
…4 lignes…

…4 lignes identiques répétées…

[Interlude]

[Verse]
…4 lignes…

[Chorus]
…les MÊMES 4 lignes…

…4 lignes identiques répétées…

[Bridge]
…4 lignes…

[Chorus]
…les MÊMES 4 lignes…

…4 lignes identiques répétées…

[Outro]
…2 ou 3 mots courts…
```

> 🔑 **Les 3 règles d'or de l'exemple officiel**
> 1. Une **ligne vide** juste après `[Intro]` et `[Interlude]` → le modèle y place de l'instrumental.
> 2. Le **refrain est dupliqué** (8 lignes = 2×4) à chaque occurrence, mot pour mot.
> 3. L'**outro est court et lâche** : quelques mots isolés, pas des phrases complètes.

---

## 3. La durée : le nerf de la guerre

Le modèle chante **25 « codes musicaux » par seconde** (une trame de 40 ms). Il s'arrête quand il a
fini vos paroles — ou quand il atteint un plafond.

| Réglage | Valeur | Effet |
|---|---|---|
| `semantic_min_tokens` | 200 | **Plancher de 8 secondes** : impossible de faire plus court |
| `semantic_max_tokens` | 9000 | **Plafond absolu de 6 minutes** |
| Contexte total | 24 576 jetons | Ne limite pas une chanson de 6 min |

### Ordres de grandeur (mesurés sur les exemples)

| Structure | Durée obtenue |
|---|---|
| 1 couplet + 1 refrain (8 lignes) | ~40 s |
| Intro + 2 couplets + 2 refrains + pont | **~2 min 30** |
| Le squelette officiel complet (celui de 今晚不眠) | **~3 min 45** |
| Le même + un couplet et un refrain de plus | ~5 min |

**Compter juste :**
- ≈ **6 à 10 secondes par ligne** chantée (6 à 10 syllabes).
- Une balise vide (`[Intro]`, `[Interlude]`) ≈ **10 à 20 secondes** d'instrumental.
- Pour **raccourcir** : supprimez une section entière, pas des mots à l'intérieur d'une ligne.

### Le réglage « Durée maximale » de l'app

Dans **⚙️ Réglages avancés → Durée maximale (minutes)**, vous fixez un plafond dur
(l'app le convertit en codes : 2,5 min → 3 750 codes). Utile pour :
- **éviter les débordements** (le modèle qui répète et s'étire) ;
- **gagner du temps et de la VRAM** sur un test rapide.

⚠️ C'est un **plafond, pas une cible** : laissez `0` si vous voulez que la chanson suive
naturellement vos paroles. Un plafond trop court **coupe la chanson en plein milieu d'une phrase**.

---

## 4. Écrire en français : ce qu'il faut savoir

YuE2 a été entraîné sur l'**anglais** et le **mandarin**. Le français fonctionne, mais la diction
est le point faible (c'est exactement ce que mesure le score *PER — phoneme error rate* du
benchmark officiel).

**Ce qui aide :**
- ✅ Des **mots courts et courants**, des voyelles ouvertes (*a, o, é, i*).
- ✅ Des **rimes régulières** (AABB ou ABAB) : le modèle cale sa prosodie dessus.
- ✅ Un **nombre de syllabes constant** d'une ligne à l'autre dans une même section.
- ✅ Des **tags de style en anglais**, même pour des paroles françaises :
  `French pop, female vocal, warm analog synth…` — le mot *French* suffit à orienter la langue chantée.

**Ce qui nuit :**
- ❌ Les mots rares, techniques, les anglicismes empilés.
- ❌ Les vers très longs (12 syllabes et plus) qui font débiter le chant.
- ❌ Les élisions complexes et les jeux de mots typographiques.
- ❌ Mélanger trois langues dans la même ligne.

> 💡 Si la diction française déçoit sur un morceau auquel vous tenez : écrivez-le en anglais,
> ou testez la même grille avec des paroles anglaises puis françaises, à **graine identique**.

---

## 5. Prosodie : la checklist avant de générer

- [ ] Chaque ligne fait **6 à 10 syllabes** (pas 15).
- [ ] Les lignes d'une même section ont à peu près la **même longueur**.
- [ ] Le refrain rime et **tient en 4 lignes**.
- [ ] Le refrain est **recopié à l'identique** à chaque occurrence.
- [ ] Il y a au moins **2 couplets** (sinon la chanson est trop courte).
- [ ] `[Intro]` et `[Interlude]` sont **vides**.
- [ ] Aucune **didascalie** (`(soupir)`, `*guitare*`), aucun emoji, aucune majuscule décorative.
- [ ] Aucun **mots de production** dans les paroles (BPM, tonalité, instrument, « fondu final ») →
      tout cela va dans le **Style**.

---

## 6. Le champ Style (rappel express)

L'exemple officiel : `City Pop, upbeat, danceable, groovy bass, electric guitar, synth, energetic,
joyful, neon city night`

**La formule qui marche :**
`langue/genre` → `tempo/énergie` → `2-4 instruments` → `ambiance` → `type de voix` → `couleur de production`

```
French pop, mid-tempo, warm analog synth, round bass, soft drums,
nostalgic night drive, breathy female vocal, polished demo mix
```

- 8 à 15 tags, **séparés par des virgules**, pas de phrases complètes.
- Le **type de voix** est décisif : `female vocal` / `male vocal` / `duet` / `raspy`, `breathy`, `clear`.
- Pour un **instrumental** : mettez `instrumental` dans le style **et** `[instrumental]` dans les paroles.

---

## 7. Itérer efficacement (la méthode)

1. **Verrouillez la grille** : écrivez paroles + style une bonne fois.
2. **Tirez 3 fois au sort** : bouton 🎲 **Régénérer** (mêmes paroles, nouvelle graine).
   → Si une des trois est bonne, le texte est bon : c'était de la chance.
   → Si les trois sont mauvaises, le problème est dans le texte.
3. **Ne changez qu'une chose à la fois** (une section, un tag de style, la graine).
4. **Notez la graine** gagnante dans le champ 📝 Note de l'historique.
5. **Consultez la partition ABC** dans l'historique : si la mélodie est plate ou la grille d'accords
   bancale, le problème vient souvent de paroles trop régulières ou trop longues.

### Symptômes → remèdes

| J'entends… | Je fais… |
|---|---|
| Le refrain ne ressort pas | Je le **répète 2×** dans la section et je raccourcis les couplets |
| La chanson s'arrête trop tôt | J'ajoute une section complète (`[Bridge]` + `[Chorus]`) |
| La chanson s'étire / boucle | Je mets une **Durée maximale** et je supprime une répétition |
| Des mots sont mangés | **Expressivité du chant** → 0,85 ; je simplifie le mot ; style en anglais |
| Le chant est faux / instable | **Expressivité du chant** → 0,8 ; je régularise le nombre de syllabes |
| C'est trop mou | Tags `upbeat, driving drums, energetic` + `[Pre-Chorus]` avant le refrain |
| Ça sonne « karaoké » | Tags de production : `polished mix, warm master, analog tape` |
| Je veux un solo | `[Interlude]` vide + `guitar solo` dans le style |
| Coupure nette à la fin | `[Outro]` avec 2–3 mots courts + `fade out` dans le style |

---

## 8. Modèle prêt à coller (≈ 3 min, français)

Collez ceci dans **Paroles**, puis remplacez le texte en gardant la structure :

```
[Intro]

[Verse]
Les néons s'allument au bout du boulevard
La ville respire encore il n'est pas trop tard
Je garde tes mots pliés dans ma poche
Comme un ticket de train pour une autre époque

[Pre-Chorus]
Et le tempo monte doucement
Comme une promesse dans le vent

[Chorus]
On ira voir la mer au petit matin
On dira que c'est nous on dira que c'est bien
Et si la nuit nous rattrape en chemin
On allumera nos propres matins

On ira voir la mer au petit matin
On dira que c'est nous on dira que c'est bien
Et si la nuit nous rattrape en chemin
On allumera nos propres matins

[Interlude]

[Verse]
Le périphérique déroule ses lumières
On compte les sorties comme des prières
Tu chantes faux et ça me fait du bien
Je retiens l'instant je ne retiens rien

[Chorus]
On ira voir la mer au petit matin
On dira que c'est nous on dira que c'est bien
Et si la nuit nous rattrape en chemin
On allumera nos propres matins

On ira voir la mer au petit matin
On dira que c'est nous on dira que c'est bien
Et si la nuit nous rattrape en chemin
On allumera nos propres matins

[Bridge]
Et quand le jour se lèvera sur l'eau
On n'aura plus besoin de dire un mot

[Chorus]
On ira voir la mer au petit matin
On dira que c'est nous on dira que c'est bien

[Outro]
On ira
Voir la mer
Oui
```

**Style assorti :**
```
French pop, mid-tempo, warm analog synth, round bass, soft drums, nostalgic night drive, breathy female vocal, polished demo mix
```

**Réglages :** Planification `Complète` · Graine vide · Étapes 8 · Durée maximale `0` · Expressivité `0` (défaut)

---

## 9. Cas particuliers

| Je veux… | Paroles | Style |
|---|---|---|
| Un **instrumental** | `[instrumental]` seul (ou `[Intro]` vide + `[Interlude]` vide) | `instrumental, no vocals` + vos instruments |
| Une **chanson très courte** (jingle) | 1 couplet de 4 lignes | ce que vous voulez — **8 s minimum** de toute façon |
| Un **morceau long** (5-6 min) | 3 couplets + 3 refrains + pont + outro | — |
| Un **duo** | alternez les lignes, éventuellement 2 `[Verse]` distincts | `duet, male and female vocal` |
| Du **rap** | lignes plus longues, débit dense | `hip-hop, trap drums, 808 bass, male rap vocal` |
| Une **reprise / cover** | recopiez les paroles de la chanson originale | votre nouveau style — avec `cot = melody` si vous avez la partition ABC |

---

### Pour aller plus loin

- Exemple officiel complet : <https://huggingface.co/m-a-p/YuE2-3B/blob/main/examples/tonight-awake.json>
- Démos audio des auteurs : <https://map-yue2.github.io/>
- Tous les paramètres du modèle : `engine/model_specs/yue2.json` (dans votre dossier d'installation)
- Présentation du projet (GitHub) : `README.md`
- Faire écrire les paroles par un LLM : `PROMPT-LLM.md` (ou la carte « 🤖 Préparer avec une IA » dans l'app)
- Documentation de l'app : `LISEZ-MOI.md`
