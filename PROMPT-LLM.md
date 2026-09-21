# 🤖 Le prompt à donner à un LLM pour écrire vos paroles

Donnez ce prompt à **ChatGPT, Claude, Gemini, Mistral, ou tout modèle local** : il vous rendra un
bloc **TITRE / STYLE / PAROLES** directement copiable-collable dans YueStudio, au format exact
attendu par YuE2.

> 💡 Dans YueStudio, la carte **« Préparer avec une IA »** (page Créer) génère ce prompt
> **déjà rempli** avec votre style et votre sujet : cliquez, collez dans votre LLM, recopiez les
> deux blocs dans le formulaire.
>
> ✨ **Mieux : le parolier local** (`.\\installer.ps1 -AvecParolier`, voir
> [`PAROLIER.md`](PAROLIER.md)) fait tout cela **sans quitter YueStudio** : c'est exactement
> ce prompt qui est envoyé au petit modèle, et le résultat remplit le formulaire d'un clic.

---

## 1. Le prompt maître (à copier-coller)

Remplacez les deux lignes `STYLE :` et `SUJET :` tout en bas, puis envoyez.

```text
Tu es parolier professionnel et ingénieur de prompt pour YuE2, un modèle local de génération
de chansons (paroles + style -> chanson complète avec voix et instruments).

Ta tâche : écrire une chanson prête à être générée, à partir du STYLE et du SUJET que je donne.

════════════════════════════════════════════════════════════
FORMAT DE SORTIE — respecte-le à la lettre
════════════════════════════════════════════════════════════
N'écris AUCUN commentaire, aucune introduction, aucune explication, aucun markdown.
Sors exactement ces trois blocs, séparés par une ligne "-----" :

TITRE :
<un titre court, 2 à 5 mots, tiré d'une image du refrain>
-----
STYLE :
<une seule ligne : 8 à 15 tags en ANGLAIS, séparés par des virgules>
-----
PAROLES :
<les paroles, avec les balises de structure>
-----
DURÉE ESTIMÉE : <x min yy s> — <nombre> lignes chantées

════════════════════════════════════════════════════════════
RÈGLES POUR LE BLOC « PAROLES »
════════════════════════════════════════════════════════════
1. Balises de structure, en ANGLAIS, chacune sur sa ligne seule, entre crochets.
   Autorisées : [Intro] [Verse] [Pre-Chorus] [Chorus] [Interlude] [Bridge] [Outro]
   [instrumental] [Solo]
2. [Intro] et [Interlude] doivent rester VIDES : la balise, puis une ligne vide.
   C'est ce qui déclenche un passage instrumental.
3. Le texte de chaque refrain doit être recopié MOT POUR MOT à chaque occurrence.
4. Chaque refrain = 4 lignes, immédiatement suivies de la répétition exacte de ces
   4 mêmes lignes (donc 8 lignes au total par bloc [Chorus]).
5. Une ligne = 6 à 10 syllabes. Toutes les lignes d'une même section ont à peu près
   la même longueur.
6. Rimes régulières : AABB ou ABAB. Le refrain doit rimer et fonctionner comme un hook.
7. [Outro] = 2 à 4 lignes très courtes (1 à 4 mots chacune), lâches, qui s'éteignent.
8. INTERDIT dans les paroles : didascalies, indications de jeu, parenthèses, étoiles,
   emojis, chiffres de BPM, noms d'instruments, consignes de mixage, majuscules
   décoratives, points d'exclamation en série, marques déposées, noms de personnes
   réelles, noms d'artistes, paroles de chansons existantes.
9. Langue des paroles : celle du SUJET que je donne. Les balises, elles, restent
   toujours en anglais.
10. Aucune ligne ne dépasse 10 syllabes. Pas de mots rares ou techniques : privilégie
    des mots courants et des voyelles ouvertes (le modèle chante mieux en français sur
    des mots simples).
11. Ponctuation minimale : pas de guillemets, pas de points-virgules. La virgule et le
    point sont acceptés.

════════════════════════════════════════════════════════════
LONGUEUR — le modèle chante environ 10 secondes par ligne
════════════════════════════════════════════════════════════
Choisis la structure selon la durée que je demande (défaut : standard ~3 min).

  court (~1 min 30) :
    [Intro] vide, [Verse] 4 lignes, [Chorus] 4+4, [Outro] 2 lignes

  standard (~3 min) :
    [Intro] vide, [Verse] 4, [Pre-Chorus] 2, [Chorus] 4+4, [Interlude] vide,
    [Verse] 4, [Chorus] 4+4, [Bridge] 4, [Chorus] 4+4, [Outro] 3

  long (~4 min 30) :
    [Intro] vide, [Verse] 4, [Pre-Chorus] 2, [Chorus] 4+4, [Verse] 4,
    [Pre-Chorus] 2, [Chorus] 4+4, [Interlude] vide, [Bridge] 4,
    [Chorus] 4+4, [Chorus] 4+4, [Outro] 4

Maximum absolu : 6 minutes (le modèle s'arrête de toute façon à 6 min).
Minimum : 8 secondes.

════════════════════════════════════════════════════════════
RÈGLES POUR LE BLOC « STYLE »
════════════════════════════════════════════════════════════
Une seule ligne, en anglais, 8 à 15 tags séparés par virgules, dans cet ordre :
  1. langue + genre            (ex. French pop, English indie folk)
  2. sous-genre / époque       (ex. 80s, synthwave, neo-soul)
  3. tempo / énergie           (ex. mid-tempo, upbeat, slow, driving)
  4. 2 à 4 instruments         (ex. warm analog synth, round bass, brushed drums)
  5. ambiance / décor          (ex. nostalgic night drive, rainy morning)
  6. voix                      (ex. breathy female vocal, warm male vocal, duet,
                                    raspy vocal, clear lead vocal)
  7. couleur de production     (ex. polished demo mix, analog tape, wide reverb)

Interdit dans le STYLE : phrases complètes, parenthèses, BPM chiffré, références à des
artistes existants, noms de marques, guillemets.
Si le SUJET demande un instrumental : écris « instrumental, no vocals » dans le STYLE.

════════════════════════════════════════════════════════════
FOND — ce qui fait une bonne chanson
════════════════════════════════════════════════════════════
- Raconte une histoire précise et incarnée : des images sensorielles (ce qu'on voit,
  entend, touche), des détails concrets plutôt que des généralités.
- Le refrain doit résumer l'émotion en une image forte et chantable.
- Les couplets font avancer le récit ; le pont change de perspective ou de temps.
- Évite les clichés usés et les rimes forcées qui n'apportent rien au sens.
- Reste cohérent avec le STYLE demandé : le vocabulaire doit coller à l'univers musical.

════════════════════════════════════════════════════════════
MA DEMANDE
════════════════════════════════════════════════════════════
DURÉE SOUHAITÉE : standard (~3 min)
STYLE : <décris ici l'ambiance, le genre, la voix — en français, le LLM traduira en tags anglais>
SUJET : <de quoi parle la chanson : situation, personnage, émotion, lieu, époque>
```

---

## 2. Version courte (si vous êtes pressé)

```text
Écris une chanson au format YuE2 (modèle local de génération musicale).

Sortie : 3 blocs séparés par "-----", sans aucun commentaire autour.
  TITRE : 2 à 5 mots
  STYLE : une ligne, 8 à 15 tags ANGLAIS séparés par virgules (langue+genre, tempo,
          2-4 instruments, ambiance, type de voix, production)
  PAROLES : avec balises anglaises [Intro] [Verse] [Pre-Chorus] [Chorus] [Interlude]
          [Bridge] [Outro], chacune sur sa ligne seule.

Règles impératives :
- [Intro] et [Interlude] VIDES (balise puis ligne vide) = passages instrumentaux
- chaque refrain = 4 lignes suivies de la répétition exacte des 4 mêmes lignes
- refrain recopié mot pour mot à chaque occurrence
- 6 à 10 syllabes par ligne, longueur homogène dans une section, rimes AABB ou ABAB
- [Outro] : 2 à 4 lignes très courtes (1 à 4 mots)
- aucune didascalie, parenthèse, emoji, nom d'instrument, BPM, nom d'artiste
- ~10 secondes chantées par ligne ; structure standard ≈ 3 min :
  Intro / Verse 4 / Pre-Chorus 2 / Chorus 4+4 / Interlude / Verse 4 / Chorus 4+4 /
  Bridge 4 / Chorus 4+4 / Outro 3

STYLE : <votre style>
SUJET : <votre sujet>
```

---

## 3. Exemple d'utilisation

**Vous envoyez** (fin du prompt maître) :

```
DURÉE SOUHAITÉE : standard (~3 min)
STYLE : pop française mélancolique, synthés analogiques, voix féminine douce, ambiance nocturne
SUJET : une femme vide son appartement la veille d'un déménagement ; elle retrouve une
        boîte de photos et un ticket de train daté de dix ans
```

**Le LLM vous rend** (extrait) :

```text
TITRE :
Le Dernier Carton
-----
STYLE :
French pop, melancholic, mid-tempo, warm analog synth, soft electric piano, round bass,
brushed drums, quiet night apartment, breathy female vocal, intimate close vocal,
polished demo mix, wide reverb
-----
PAROLES :
[Intro]

[Verse]
Les murs ont gardé la forme des cadres
Le parquet craint encore sous mes pas
Je plie dix ans de papier dans un carton
La ville s'éteint en bas

[Pre-Chorus]
Et la clé pèse lourd soudain
Comme un mot qu'on ne dit pas

[Chorus]
Je ferme la porte sans me retourner
La nuit garde ce qu'on lui laisse
Un ticket de train pour une autre année
Et ta voix qui dort dans la pièce

Je ferme la porte sans me tourner
La nuit garde ce qu'on lui laisse
Un ticket de train pour une autre année
Et ta voix qui dort dans la pièce

[Interlude]

...

[Outro]
La clé
Le carton
La nuit
-----
DURÉE ESTIMÉE : 3 min 10 — 32 lignes chantées
```

**Dans YueStudio :** le bloc STYLE → champ *Style*, le bloc PAROLES → champ *Paroles*,
le TITRE → champ *Titre*. Bouton 🎵 Générer.

---

## 4. Les variantes utiles à demander au LLM

Une fois la première version obtenue, enchaînez dans la même conversation :

| Demande | Effet |
|---|---|
| « Refais le refrain avec une image plus forte, garde le reste » | Améliore le hook sans tout réécrire |
| « Donne-moi 3 blocs STYLE différents pour ces mêmes paroles » | Trois couleurs sonores à tester, même graine |
| « Version courte (~1 min 30) des mêmes paroles » | Pour un test rapide (2× moins de temps de calcul) |
| « Réduis chaque ligne à 8 syllabes maximum » | Corrige un chant trop débité |
| « Passe ces paroles en anglais, garde la structure et les rimes » | Meilleure diction si le français déçoit |
| « Ajoute un [Solo] après le deuxième refrain » | Place un solo instrumental |
| « Rends le pont plus contrasté : change de point de vue » | Renforce la structure narrative |
| « Même sujet, mais en version instrumentale » | Paroles `[instrumental]` + style adapté |

---

## 5. Trois pièges à surveiller dans la réponse du LLM

1. **Il a mis des commentaires autour des blocs** (« Voici ta chanson : ») → ne copiez que
   l'intérieur des blocs STYLE et PAROLES.
2. **Il a écrit les balises en français** (`[Couplet]`, `[Refrain]`) → faites-les remplacer par
   `[Verse]` et `[Chorus]`, c'est non négociable pour le modèle.
3. **Il a oublié de dupliquer le refrain** (4 lignes au lieu de 8) → la chanson sera trop courte
   et le hook ne s'installera pas. Demandez : « duplique chaque refrain comme demandé ».

---

## 6. Chaîne de production recommandée

```
1. Idée (style + sujet en une phrase)
        ↓
2. LLM  →  TITRE / STYLE / PAROLES
        ↓
3. YueStudio : coller, vérifier la checklist (GUIDE-PAROLES.md §5)
        ↓
4. Générer 3 fois (🎲 Régénérer) → garder la meilleure prise, noter la graine
        ↓
5. Insatisfait ? → retour au LLM avec une consigne ciblée (§4), pas de réécriture complète
```

**Documents associés :** `GUIDE-PAROLES.md` (règles détaillées, durée, français, dépannage) ·
`LISEZ-MOI.md` (installation et référence complète de l'app).
