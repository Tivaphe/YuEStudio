/* YueStudio — internationalisation (français / anglais) et thème (sombre / clair)
 *
 * Principe : le français est la langue source. Les clés du dictionnaire EN sont
 * exactement les chaînes françaises telles qu'elles apparaissent dans index.html
 * et app.js. Aucun attribut data-i18n n'est nécessaire dans le HTML : applyI18n()
 * parcourt les nœuds texte et les attributs, et les remplace à la volée.
 *
 * Cela permet de changer de langue sans recharger la page et sans perdre l'état.
 */

'use strict';

/* -------------------------------------------------------------------------- */
/* État                                                                       */
/* -------------------------------------------------------------------------- */

const I18N = {
  lang: 'fr',          // 'fr' | 'en'
  theme: 'dark',       // 'dark' | 'light' | 'system'
};

const LS_LANG = 'yuestudio.lang';
const LS_THEME = 'yuestudio.theme';

/* -------------------------------------------------------------------------- */
/* Dictionnaire : français -> anglais                                         */
/* -------------------------------------------------------------------------- */

const EN = {
  /* ---- barre supérieure ---- */
  'YueStudio — création de musique locale (YuE2-3B)': 'YueStudio — local music generation (YuE2-3B)',
  'Création de chansons en local · modèle YuE2-3B (GGUF)': 'Local song generation · YuE2-3B model (GGUF)',
  'vérification…': 'checking…',
  'État du moteur audio.cpp': 'audio.cpp engine status',
  '📁 Mes chansons': '📁 My songs',
  'Ouvrir le dossier des chansons': 'Open the songs folder',
  '🧹 Libérer la VRAM': '🧹 Free VRAM',
  'Décharger le modèle pour libérer la VRAM': 'Unload the model to free VRAM',
  '🌙 Thème': '🌙 Theme',
  'Changer de thème (sombre / clair / système)': 'Change theme (dark / light / system)',
  '🇬🇧 English': '🇫🇷 Français',
  'Passer l’interface en anglais': 'Switch the interface to French',
  'Passer l’interface en français': 'Switch the interface to English',

  /* ---- onglets ---- */
  '🎼 Créer une musique': '🎼 Create a song',
  '🕘 Historique': '🕘 History',

  /* ---- formulaire ---- */
  'Nouvelle chanson': 'New song',
  'Titre de la musique': 'Song title',
  'Ex. : Lumières sur la ville': 'e.g. Lights on the boulevard',
  'obligatoire': 'required',
  'Décrivez le genre, les instruments, l’ambiance, la voix. Les tags en anglais donnent souvent de meilleurs résultats, mais le français fonctionne.':
    'Describe the genre, instruments, mood and voice. English tags usually give better results, but French works too.',
  'Ex. : French pop, synthés années 80, basse ronde, batterie douce, voix féminine chaleureuse':
    'e.g. French pop, 80s synths, round bass, soft drums, warm female vocal',
  'Structures :': 'Structure:',
  '✨ Exemple': '✨ Example',
  '✖ Vider': '✖ Clear',
  'La longueur de la chanson suit la longueur des paroles : plus il y a de couplets, plus le morceau est long.':
    'Song length follows lyric length: the more verses, the longer the track.',
  'mots ·': 'words ·',
  'lignes': 'lines',

  /* ---- réglages avancés ---- */
  '⚙️ Réglages avancés': '⚙️ Advanced settings',
  '(optionnel)': '(optional)',
  'Qualité / modèle': 'Quality / model',
  'Planification (partition ABC)': 'Planning (ABC score)',
  'Complète — le modèle compose la partition puis chante (recommandé)':
    'Full — the model writes the score, then sings (recommended)',
  'Mélodie seule': 'Melody only',
  'Désactivée — plus rapide, moins structuré': 'Disabled — faster, less structured',
  'Graine (seed)': 'Seed',
  'aléatoire': 'random',
  'Fixer la graine': 'Lock the seed',
  'Même graine + même texte = même chanson. Laissez vide pour varier.':
    'Same seed + same text = same song. Leave empty to vary.',
  'Étapes de rendu (NAR)': 'Render steps (NAR)',
  '8 = défaut. 16 = un peu plus fin, deux fois plus lent.': '8 = default. 16 = finer, twice as slow.',
  'Guidage du style (guidance)': 'Style guidance',
  '0 = défaut du modèle': '0 = model default',
  '0 laisse le modèle choisir. 1,5–3 renforce le respect du style.':
    '0 lets the model decide. 1.5–3 enforces the style more strictly.',
  'Durée maximale (minutes)': 'Maximum duration (minutes)',
  '0 = pas de plafond': '0 = no cap',
  'Plafond dur : la chanson s’arrête là même si les paroles continuent. 6 min = maximum du modèle (9000 codes).':
    'Hard cap: the song stops there even if the lyrics continue. 6 min = model maximum (9000 codes).',
  'Expressivité du chant (température)': 'Vocal expressiveness (temperature)',
  '1.0 = défaut': '1.0 = default',
  'Plus bas = chant plus stable et articulé ; plus haut = plus de liberté (et de risques).':
    'Lower = steadier, clearer vocals; higher = more freedom (and more risk).',

  /* ---- génération ---- */
  '🎵 Générer la musique': '🎵 Generate the song',
  '⏳ Génération en cours…': '⏳ Generating…',
  'Génération en cours…': 'Generating…',
  'Envoi de la demande au moteur': 'Sending the request to the engine',
  'Chargement du modèle en VRAM (1': 'Loading the model into VRAM (first',
  're': 'st',
  'fois seulement)': 'time only)',
  'Composition de la partition (ABC) et des codes musicaux': 'Composing the score (ABC) and the music codes',
  'Rendu acoustique (flow matching) puis décodage VAE 48 kHz': 'Acoustic render (flow matching), then 48 kHz VAE decoding',
  'Enregistrement du fichier et de l’historique': 'Saving the file and the history entry',
  'La première génération est plus lente (chargement du modèle). Ensuite, comptez en général 1 à 4 minutes pour une chanson de 3 minutes sur RTX 2000 Ada.':
    'The first generation is slower (model loading). After that, expect roughly 1 to 4 minutes for a 3-minute song on an RTX 2000 Ada.',
  'Annuler l’attente': 'Cancel waiting',

  /* ---- résultat ---- */
  'Dernier résultat': 'Latest result',
  'Aucune génération pour le moment.': 'No generation yet.',
  'Remplissez le titre, le style et les paroles, puis cliquez sur « Générer ».':
    'Fill in the title, style and lyrics, then click “Generate”.',
  '⬇️ Télécharger': '⬇️ Download',
  '📋 Style': '📋 Style',
  '📋 Paroles': '📋 Lyrics',
  'Paroles': 'Lyrics',
  'PAROLES': 'LYRICS',
  'STYLE': 'STYLE',
  '🎼 Partition ABC composée par le modèle': '🎼 ABC score composed by the model',
  '📋 Copier la partition': '📋 Copy the score',

  /* ---- carte IA ---- */
  '🤖 Préparer avec une IA': '🤖 Prepare with an AI',
  'Décrivez l’idée : un prompt complet, au format exact de YuE2, est copié dans le presse-papiers. Collez-le dans ChatGPT, Claude, Gemini ou Mistral, puis recopiez ici les blocs':
    'Describe the idea: a complete prompt, in the exact YuE2 format, is copied to the clipboard. Paste it into ChatGPT, Claude, Gemini or Mistral, then copy back the',
  'et': 'and',
  'renvoyés.': 'blocks it returns.',
  'Style souhaité': 'Desired style',
  'Ex. : pop française mélancolique, synthés analogiques, voix féminine douce':
    'e.g. melancholic French pop, analog synths, soft female vocal',
  'Sujet de la chanson': 'Song subject',
  'Ex. : une femme vide son appartement la veille d’un déménagement et retrouve une boîte de photos':
    'e.g. a woman empties her apartment the night before moving out and finds a box of photos',
  'Durée visée': 'Target length',
  'Court · ~1 min 30': 'Short · ~1 min 30',
  'Standard · ~3 min': 'Standard · ~3 min',
  'Long · ~4 min 30': 'Long · ~4 min 30',
  '📋 Copier le prompt': '📋 Copy the prompt',
  'Le prompt sera complété avec votre style et votre sujet.': 'The prompt will be filled in with your style and subject.',
  '👁 Voir / copier tout le prompt': '👁 View / copy the whole prompt',

  /* ---- conseils ---- */
  'Conseils': 'Tips',
  'Le style fonctionne par': 'The style works as',
  'tags': 'tags',
  'séparés par des virgules : genre, instruments, ambiance, type de voix.':
    'separated by commas: genre, instruments, mood, voice type.',
  'Structurez les paroles avec': 'Structure the lyrics with',
  ' : le modèle s’en sert pour construire la chanson.': ': the model uses them to build the song.',
  'Pas de refrain ? Ajoutez': 'No chorus? Add',
  'dans les paroles.': 'to the lyrics.',
  'Une génération décevante ? Relancez avec la même grille mais une':
    'Disappointed with a take? Run it again with the same settings but a',
  'graine différente': 'different seed',
  'Les fichiers sont enregistrés dans': 'Files are saved in',
  'Mes chansons': 'My songs',
  '— vous pouvez les copier où vous voulez.': '— copy them wherever you like.',
  'Les 3 règles d’or des paroles': 'The 3 golden rules for lyrics',
  'Structurez': 'Structure',
  ' : ': ': ',
  ', et laissez': ', and leave',
  'vides': 'empty',
  'pour de l’instrumental.': 'for instrumental passages.',
  'Répétez le refrain mot pour mot': 'Repeat the chorus word for word',
  'à chaque passage, avec 6 à 10 syllabes par ligne.': 'every time, with 6 to 10 syllables per line.',
  'La durée suit les paroles': 'Duration follows the lyrics',
  ': ≈ 10 s par ligne, 6 minutes maximum.': ': ≈ 10 s per line, 6 minutes maximum.',
  'Guide complet, avec une chanson prête à coller :': 'Full guide, with a ready-to-paste song:',
  'dans le dossier de l’application.': 'in the application folder.',

  /* ---- historique ---- */
  '🔍 Rechercher un titre, un style, une parole…': '🔍 Search a title, style or lyric…',
  '⭐ Favoris': '⭐ Favourites',
  '⬇️ Exporter (JSON)': '⬇️ Export (JSON)',
  '⬆️ Importer': '⬆️ Import',
  '🔄 Actualiser': '🔄 Refresh',
  '🗑 Tout effacer': '🗑 Delete all',
  'Aucune génération enregistrée.': 'No saved generation.',
  'Vos chansons apparaîtront ici avec leur style et leurs paroles, copiables et réutilisables.':
    'Your songs will appear here with their style and lyrics, ready to copy and reuse.',
  'Mettre en favori': 'Add to favourites',
  'Retirer des favoris': 'Remove from favourites',
  '📋 Copier': '📋 Copy',
  '👁 Déplier': '👁 Expand',
  '👁 Replier': '👁 Collapse',
  '🎼 Partition ABC': '🎼 ABC score',
  'ℹ️ Paramètres': 'ℹ️ Settings',
  '♻️ Réutiliser': '♻️ Reuse',
  '🎲 Régénérer': '🎲 Regenerate',
  '✏️ Renommer': '✏️ Rename',
  '📝 Note': '📝 Note',
  '🗑 Supprimer': '🗑 Delete',

  /* ---- pied de page ---- */
  'YueStudio · moteur': 'YueStudio · engine',
  '· modèle': '· model',
  '(GGUF': '(GGUF',
  'Poids sous licence CC BY-NC 4.0 — usage non commercial uniquement.':
    'Weights licensed CC BY-NC 4.0 — non-commercial use only.',

  /* ---- libellés dynamiques (app.js) ---- */
  'moteur non installé': 'engine not installed',
  'moteur arrêté': 'engine stopped',
  'prêt': 'ready',
  'prêt ·': 'ready ·',
  'occupé ·': 'busy ·',
  'hors ligne': 'offline',
  'serveur inaccessible': 'server unreachable',
  'Rapide (Q4)': 'Fast (Q4)',
  'Equilibre (Q8) - recommande': 'Balanced (Q8) — recommended',
  'Maximale (BF16)': 'Maximum (BF16)',
  '~8 Go': '~8 GB',
  '~9 Go': '~9 GB',
  '~13 Go': '~13 GB',
  'Complete (le modele compose la partition puis chante)': 'Full (the model writes the score, then sings)',
  'Melodie seule': 'Melody only',
  'Desactivee (plus rapide)': 'Disabled (faster)',
  'Complète (partition + mélodie)': 'Full (score + melody)',
  'Mélodie seule (plus rapide)': 'Melody only (faster)',
  'Désactivée (plus rapide)': 'Disabled (faster)',
  'Durée': 'Duration',
  'Qualité': 'Quality',
  'Généré en': 'Generated in',
  'Fichier': 'File',
  'Date': 'Date',
  'Planification': 'Planning',
  'Graine': 'Seed',
  'Guidance': 'Guidance',
  'Étapes NAR': 'NAR steps',
  'Durée max demandée': 'Requested max duration',
  'Température chant': 'Vocal temperature',
  'Durée audio': 'Audio duration',
  'Taille du fichier': 'File size',
  'Fréquence': 'Sample rate',
  'étapes': 'steps',
  'aucune': 'none',
  'défaut': 'default',
  'défaut (1.0)': 'default (1.0)',
  'canaux': 'channels',
  'canaux': 'channels',
  'favori': 'favourite',

  /* ---- messages (app.js) ---- */
  'Rien à copier.': 'Nothing to copy.',
  'Sélectionnez le texte puis Ctrl+C.': 'Select the text, then press Ctrl+C.',
  'Fichiers « sidecars » du modèle manquants : relancez 1-INSTALLER.bat.':
    'Model sidecar files are missing: run 1-INSTALLER.bat again.',
  'Exemple chargé. Modifiez-le librement !': 'Example loaded. Edit it freely!',
  'Graine fixée : la même demande donnera la même chanson.':
    'Seed locked: the same request will give the same song.',
  'Graine libérée : chaque génération sera différente.':
    'Seed unlocked: every generation will differ.',
  'Le moteur audio.cpp ne répond pas. Relancez 2-LANCER.bat.':
    'The audio.cpp engine is not responding. Run 2-LANCER.bat again.',
  'La génération a échoué.': 'Generation failed.',
  'Suivi annulé. La génération continue en arrière-plan.':
    'Tracking cancelled. Generation continues in the background.',
  'Paramètres rechargés avec une nouvelle graine : génération lancée.':
    'Settings reloaded with a new seed: generation started.',
  'Paramètres rechargés dans le formulaire.': 'Settings reloaded into the form.',
  'Titre vide ignoré.': 'Empty title ignored.',
  'Titre mis à jour.': 'Title updated.',
  'Note enregistrée.': 'Note saved.',
  'Note effacée.': 'Note cleared.',
  'Génération supprimée.': 'Generation deleted.',
  'L’historique est déjà vide.': 'The history is already empty.',
  'Historique effacé (les fichiers WAV ont été supprimés du dossier).':
    'History cleared (the WAV files were deleted from the folder).',
  'Une génération est déjà en cours : reprise du suivi.':
    'A generation is already running: resuming tracking.',
  'VRAM libérée.': 'VRAM freed.',
  'Le moteur n’a pas répondu.': 'The engine did not respond.',
  'Actualisé.': 'Refreshed.',
  'Historique importé.': 'History imported.',
  'Fichier invalide.': 'Invalid file.',
  'Prompt pour le LLM': 'Prompt for the LLM',
  'Indiquez au moins un style ou un sujet : le prompt sera bien plus utile.':
    'Enter at least a style or a subject: the prompt will be far more useful.',
  'Le titre et les paroles sont obligatoires.': 'The title and lyrics are required.',
  'Le style et les paroles sont obligatoires.': 'Style and lyrics are required.',
  'est prête !': 'is ready!',

  /* ---- compléments (chaînes à paramètres et dialogues) ---- */
  '« {titre} » est prête !': '“{titre}” is ready!',
  'Historique illisible : {err}': 'History unreadable: {err}',
  'Effacement partiel : {err}': 'Partially cleared: {err}',
  'Import impossible : {err}': 'Import failed: {err}',
  '{n} entrée(s) importée(s). Les fichiers audio doivent être copiés dans « Mes chansons ».':
    '{n} entry/entries imported. Audio files must be copied into the “My songs” folder.',
  'Nouveau titre :': 'New title:',
  'Note personnelle (vide pour effacer) :': 'Personal note (leave empty to clear):',
  'Sans titre': 'Untitled',
  'Supprimer « {titre} » ?\nLe fichier audio sera aussi effacé du disque.':
    'Delete “{titre}”?\nThe audio file will also be erased from disk.',
  "Effacer les {n} entrées de l'historique ?\n\nLes fichiers audio restent dans « Mes chansons ».":
    'Delete all {n} history entries?\n\nThe audio files stay in the “My songs” folder.',
  'Copie automatique indisponible — copiez avec Ctrl+C :':
    'Automatic copy unavailable — copy with Ctrl+C:',
  'Le champ « Style » est obligatoire.': 'The “Style” field is required.',
  'Le champ « Paroles » est obligatoire.': 'The “Lyrics” field is required.',
  'Plafond : {tokens} codes musicaux ({sec}). 6 min = maximum du modèle (9000 codes).':
    'Cap: {tokens} music codes ({sec}). 6 min = model maximum (9000 codes).',
  '25 par seconde': '25 per second',
  'codes': 'codes',
  'Planification (cot)': 'Planning (cot)',
  'Temps de calcul': 'Compute time',
  'Identifiant': 'Identifier',
  'RTF': 'RTF',
  'Partition ABC': 'ABC score',
  'chanson.wav': 'song.wav',

  /* ---- réglages avancés : valeurs par défaut et plages ---- */
  'Par défaut': 'Default',
  'min–max': 'min–max',
  'conseillé': 'recommended',
  'aucune (aléatoire à chaque génération)': 'none (random at each generation)',
  'horodatage actuel si le champ reste vide': 'current timestamp when left empty',
  '8 (bon rendu, rapide)': '8 (good quality, fast)',
  '0 = le modèle décide': '0 = the model decides',
  '1.0 côté modèle': '1.0 on the model side',
  'aucune (la durée suit les paroles)': 'none (duration follows the lyrics)',
  '0 = pas de plafond': '0 = no cap',
  '↺ Valeurs par défaut': '↺ Default values',
  'Remettre toutes les valeurs par défaut': 'Reset every value to its default',
  'Ajouter à la suite : {style}': 'Append to the style: {style}',
  'Ajouté au style : « {tag} »': 'Added to the style: “{tag}”',
  'Style inchangé : « {tag} » était déjà présent.': 'Style unchanged: “{tag}” was already there.',
  'Ajouté au style : « {tag} » (les autres préréglages ont été ignorés, déjà présents).':
    'Added to the style: “{tag}” (the other presets were already there).',
  /* bornes et plages conseillées (mêmes chaînes que PARAM_RANGES dans app.js) */
  '0 – 4 611 686 018 427 387 904': '0 – 4,611,686,018,427,387,904',
  'toute valeur ; 🎲 pour la figer': 'any value; 🎲 to lock it',
  '1 – 64': '1 – 64',
  '8 – 16 (16 : plus fin, 2× plus lent)': '8 – 16 (16: finer, 2× slower)',
  '0 – 20': '0 – 20',
  '1.5 – 3 (au-delà : voix moins naturelle)': '1.5 – 3 (beyond that: less natural vocals)',
  '0.2 – 6 min (50 – 9000 codes à 25/s)': '0.2 – 6 min (50 – 9000 codes at 25/s)',
  '2 – 4 min pour une chanson': '2 – 4 min for a song',
  '0.1 – 2': '0.1 – 2',
  '0.8 – 1.0 (mots mieux articulés)': '0.8 – 1.0 (words better articulated)',
  'Réglages remis aux valeurs par défaut.': 'Settings reset to their default values.',
  'Valeurs par défaut rétablies : 8 étapes, guidage et expressivité laissés au modèle, aucun plafond de durée, qualité Q8.':
    'Defaults restored: 8 steps, guidance and expressiveness left to the model, no duration cap, Q8 quality.',

  /* Placeholder du champ Paroles : exemple de structure (clés normalisées,
     les retours à la ligne du HTML sont réduits à un espace). */
  '[Verse] Les néons s\'allument sur le boulevard ... [Chorus] ...':
    '[Verse]\nThe neons light up at the end of the boulevard\n...\n\n[Chorus]\n...',

  /* ---- préréglages de style (puces cliquables) ---- */
  'French pop, synthés chaleureux, batterie douce, voix féminine':
    'French pop, warm synths, soft drums, female vocal',
  'Chanson française, piano-voix, cordes légères, émotion':
    'French chanson, piano and voice, light strings, emotional',
  'Rock alternatif, guitares saturées, batterie puissante, voix masculine':
    'Alternative rock, distorted guitars, powerful drums, male vocal',
  'Synthwave années 80, basse analogique, nappes, rythme entraînant':
    '80s synthwave, analog bass, pads, driving beat',
  'Lo-fi hip-hop, piano feutré, vinyle, batterie lente, instrumental':
    'Lo-fi hip-hop, mellow piano, vinyl crackle, slow drums, instrumental',
  'Folk acoustique, guitare fingerpicking, harmonica, voix douce':
    'Acoustic folk, fingerpicked guitar, harmonica, soft vocal',
  'Electro house, synthés lumineux, drop énergique, club':
    'Electro house, bright synths, energetic drop, club',
  'Jazz funk, Rhodes, basse ronde, cuivres, batterie souple':
    'Jazz funk, Rhodes, round bass, brass, loose drums',
  'Metal mélodique, double pédale, riffs lourds, chant puissant':
    'Melodic metal, double bass drum, heavy riffs, powerful vocals',
  'Ambient cinématique, nappes, percussions épiques, instrumental':
    'Cinematic ambient, pads, epic percussion, instrumental',
  'French pop': 'French pop',
  'Chanson française': 'French chanson',
  'Rock alternatif': 'Alternative rock',
  'Synthwave années 80': '80s synthwave',
  'Lo-fi hip-hop': 'Lo-fi hip-hop',
  'Folk acoustique': 'Acoustic folk',
  'Electro house': 'Electro house',
  'Jazz funk': 'Jazz funk',
  'Metal mélodique': 'Melodic metal',
  'Ambient cinématique': 'Cinematic ambient',
  'prêt · {backend}': 'ready · {backend}',
  'Plafond dur : la chanson s\'arrête là même si les paroles continuent. 6 min = maximum du modèle (9000 codes).':
    'Hard cap: the song stops there even if the lyrics continue. 6 min = model maximum (9000 codes).',
  'Fichiers : {model} + {vae} · VRAM {vram}. Changer de qualité recharge le modèle (≈ 30 s).':
    'Files: {model} + {vae} · VRAM {vram}. Changing quality reloads the model (≈ 30 s).',
  'généré en {dur}': 'generated in {dur}',
  '{n} chanson · {musique} de musique · {taille} sur le disque':
    '{n} song · {musique} of music · {taille} on disk',
  '{n} chansons · {musique} de musique · {taille} sur le disque':
    '{n} songs · {musique} of music · {taille} on disk',
  ' · {n} affichée(s)': ' · {n} shown',
  'Prompt copié ({n} caractères). Collez-le dans ChatGPT / Claude / Gemini / Mistral, puis recopiez ici les blocs STYLE et PAROLES.':
    'Prompt copied ({n} characters). Paste it into ChatGPT / Claude / Gemini / Mistral, then copy back the STYLE and LYRICS blocks.',
  // ---------------------------------------------------- file d'attente (interface)
  '📋 File d\u2019attente': '📋 Queue',
  'Ajoutez plusieurs chansons \u00e0 la suite : elles seront g\u00e9n\u00e9r\u00e9es l\u2019une apr\u00e8s l\u2019autre, sans surveiller l\u2019\u00e9cran.':
    'Queue up several songs: they will be generated one after another, unattended.',
  '➕ Ajouter \u00e0 la file': '➕ Add to queue',
  '🗑 Vider la file': '🗑 Clear queue',
  'en attente': 'pending',
  'en cours\u2026': 'running\u2026',
  'termin\u00e9e': 'done',
  '\u00e9chec': 'failed',
  'Retirer de la file': 'Remove from queue',
  '{p} en attente \u00b7 {d} termin\u00e9e(s) \u00b7 {e} \u00e9chec(s)': '{p} pending · {d} done · {e} failed',
  '\u00ab {titre} \u00bb ajout\u00e9e \u00e0 la file.': '"{titre}" added to the queue.',
  'File : \u00ab {titre} \u00bb est pr\u00eate.': 'Queue: "{titre}" is ready.',
  'File termin\u00e9e : {n} chanson(s) g\u00e9n\u00e9r\u00e9e(s).': 'Queue finished: {n} song(s) generated.',
  'Une file est en cours d\u2019ex\u00e9cution : attendez la fin, ou ajoutez \u00e0 la file.':
    'A queue is running: wait for it to finish, or add to the queue.',
  'Une g\u00e9n\u00e9ration est en cours : ajoutez plut\u00f4t la resynth\u00e8se \u00e0 la file.':
    'A generation is running: add the re-synthesis to the queue instead.',

  // --------------------------------------- \u00e9dition de partition + resynth\u00e8se (ABC)
  '✏️ \u00c9diter la partition': '✏️ Edit score',
  '🔁 Resynth\u00e9tiser': '🔁 Re-synthesize',
  '➕ \u00c0 la file': '➕ To queue',
  'Annuler': 'Cancel',
  'Suivre :': 'Follow:',
  'la m\u00e9lodie seule': 'the melody only',
  'la partition compl\u00e8te': 'the full score',
  'Modifiez la partition puis relancez : le moteur rejoue cette partition au lieu d\u2019en planifier une nouvelle (cot = melody ou full).':
    'Edit the score, then rerun: the engine plays this score back instead of planning a new one (cot = melody or full).',
  'La partition est vide : rien \u00e0 resynth\u00e9tiser.': 'The score is empty: nothing to re-synthesize.',
  '♻️ Resynth\u00e8se termin\u00e9e : \u00ab {titre} \u00bb': '♻️ Re-synthesis done: "{titre}"',
  '♻️ resynth\u00e8se de {titre}': '♻️ re-synthesis of {titre}',
  'Partition ABC \u00e9dit\u00e9e puis rejou\u00e9e (cot = melody ou full)': 'ABC score edited then replayed (cot = melody or full)',
  'fournie (resynth\u00e8se)': 'supplied (re-synthesis)',
  'planifi\u00e9e par le mod\u00e8le': 'planned by the model',

};

/* -------------------------------------------------------------------------- */
/* Fonctions de traduction                                                    */
/* -------------------------------------------------------------------------- */

/** Normalise pour la comparaison : l'apostrophe typographique et l'apostrophe
 *  droite sont équivalentes, les espaces sont réduits. Indispensable : le HTML
 *  et le dictionnaire n'utilisent pas toujours la même apostrophe. */
function i18nKey(s) {
  return String(s).replace(/[\u2018\u2019\u02BC]/g, "'").replace(/\s+/g, ' ').trim();
}

const EN_NORMALIZED = (() => {
  const map = new Map();
  for (const [k, v] of Object.entries(EN)) map.set(i18nKey(k), v);
  return map;
})();

/** Anglais -> français, pour revenir en arrière sans tout recharger. */
const FR_FROM_EN = (() => {
  const map = new Map();
  for (const [k, v] of Object.entries(EN)) map.set(i18nKey(v), k);
  return map;
})();

/** Traduit une chaîne exacte, dans les deux sens. Renvoie l'original si inconnu. */
function t(s) {
  if (s == null) return s;
  const k = i18nKey(s);
  if (I18N.lang === 'en') {
    if (EN_NORMALIZED.has(k)) return EN_NORMALIZED.get(k);
    return s;
  }
  // retour au français : traduit l'anglais affiché, sinon laisse tel quel
  if (FR_FROM_EN.has(k)) return FR_FROM_EN.get(k);
  return s;
}

/** Traduit une chaîne à paramètres : tf('clé {n}', {n: 3}). */
function tf(key, params) {
  let out = t(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.split('{' + k + '}').join(String(v));
    }
  }
  return out;
}

/** Traduit un texte brut en préservant les espaces de début et de fin. */
function tPreserveSpace(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const translated = t(trimmed);
  if (translated === trimmed) return null;          // rien à changer
  const head = raw.slice(0, raw.indexOf(trimmed));
  const tail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
  return head + translated + tail;
}

/* Registre du texte français d'origine, par nœud. Permet de revenir au français
   même après plusieurs allers-retours, sans jamais deviner. */
const I18N_FR_TEXT = new WeakMap();

/* Éléments gérés explicitement par applyTheme() / applyLang() : jamais balayés. */
const I18N_MANUAL = '#btn-lang, #btn-theme, .status-text, #history-summary, #quality-hint, #max-duration-hint, #ai-hint, #ai-preview';

const I18N_ATTRS = ['placeholder', 'title', 'aria-label'];
/* Nœuds texte jamais traduits : contenu utilisateur ou généré. */
const I18N_SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'CODE', 'AUDIO', 'VIDEO', 'CANVAS', 'SVG']);
/* Attributs jamais traduits : uniquement le code et les feuilles de style.
   Un <textarea> garde son texte, mais son placeholder est un texte d'interface. */
const I18N_SKIP_ATTR = new Set(['SCRIPT', 'STYLE']);
const I18N_SKIP = I18N_SKIP_TEXT;   // conservé pour compatibilité

/* Contenu généré par l'utilisateur ou par le modèle : jamais traduit. */
const I18N_SKIP_SELECTORS = [
  'script', 'style', 'textarea', 'pre',
  '.score', '.htext', '.h-lyrics', '.h-style', '.h-note-text', '.h-title',
  '.result-title', '.ai-preview', '.h-quality', '.h-duration', '.h-date', '.mono',
  '#btn-lang', '#btn-theme', '.status-text', '#history-summary', '#quality-hint',
  '#max-duration-hint', '#ai-hint', '.range',
].join(', ');

/* Titre de l'onglet : mémorisé en français au premier passage. */
const I18N_TITLES = {
  fr: '',
  en: 'YueStudio — local music generation (YuE2-3B)',
};

/** Reconstruit un texte traduit en conservant les espaces d'origine. */
function tPreserveSpaceFrom(source, translated) {
  const trimmed = source.trim();
  if (!trimmed || translated === trimmed) return null;
  const head = source.slice(0, source.indexOf(trimmed));
  const tail = source.slice(source.indexOf(trimmed) + trimmed.length);
  return head + translated + tail;
}

/** Parcourt le DOM et traduit ce qui peut l'être. Idempotent. */
function applyI18n(root) {
  const scope = root || document;
  // Toujours passer par la portée demandée : applyI18n peut recevoir un élément
  // (une carte d'historique, le panneau de résultat…) et non le document entier.
  const base = scope.nodeType === 9 ? scope : (scope.ownerDocument || document);
  const queryRoot = scope.nodeType === 9 ? (scope.body || scope) : scope;

  // 1. nœuds texte
  const walker = base.createTreeWalker(queryRoot, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (I18N_SKIP.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(I18N_SKIP_SELECTORS)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    // Le texte français d'origine est mémorisé la première fois : c'est lui qui
    // sert de référence à chaque bascule, dans les deux sens. Sans cela, un
    // retour au français ne pourrait pas restaurer le texte.
    if (!I18N_FR_TEXT.has(node)) I18N_FR_TEXT.set(node, node.nodeValue);
    const source = I18N_FR_TEXT.get(node);
    const translated = t(source.trim());
    if (translated === source.trim()) {
      if (node.nodeValue !== source) node.nodeValue = source;
      continue;
    }
    const idx = source.indexOf(source.trim());
    const nouveau = source.slice(0, idx) + translated + source.slice(idx + source.trim().length);
    if (node.nodeValue !== nouveau) node.nodeValue = nouveau;
  }

  // 2. attributs : la valeur française d'origine est conservée dans data-i18n-*
  const cibles = queryRoot.nodeType === 1 ? [queryRoot] : [];
  for (const el of queryRoot.querySelectorAll('*')) cibles.push(el);
  for (const el of cibles) {
    if (I18N_SKIP_ATTR.has(el.tagName)) continue;
    for (const attr of I18N_ATTRS) {
      const stock = 'i18n' + attr.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      if (!el.hasAttribute('data-' + stock)) {
        const value = el.getAttribute(attr);
        if (value) el.setAttribute('data-' + stock, value);
      }
      const source = el.getAttribute('data-' + stock);
      if (!source) continue;
      const translated = t(source.trim());
      if (translated !== el.getAttribute(attr)) el.setAttribute(attr, translated);
    }
  }

  // 3. <html lang> et titre de l'onglet
  base.documentElement.lang = I18N.lang;
  const title = base.querySelector('title');
  if (title) {
    if (!I18N_TITLES.fr) I18N_TITLES.fr = title.textContent;
    title.textContent = I18N.lang === 'en' ? I18N_TITLES.en : I18N_TITLES.fr;
  }
}

/* -------------------------------------------------------------------------- */
/* Thème                                                                      */
/* -------------------------------------------------------------------------- */

function resolveTheme() {
  if (I18N.theme !== 'system') return I18N.theme;
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch (e) {
    return 'dark';
  }
}

function applyTheme() {
  const effective = resolveTheme();
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.style.colorScheme = effective;
  const btn = document.getElementById('btn-theme');
  if (btn) {
    const icones = { dark: '🌙', light: '☀️', system: '🖥️' };
    const noms = { dark: 'Sombre', light: 'Clair', system: 'Système' };
    const nomsEn = { dark: 'Dark', light: 'Light', system: 'System' };
    const nom = I18N.lang === 'en' ? nomsEn[I18N.theme] : noms[I18N.theme];
    btn.textContent = `${icones[I18N.theme]} ${nom}`;
    btn.setAttribute('title', I18N.lang === 'en'
      ? 'Change theme (dark / light / system)'
      : 'Changer de thème (sombre / clair / système)');
    btn.setAttribute('aria-label', nom);
  }
}

function cycleTheme() {
  const ordre = ['dark', 'light', 'system'];
  I18N.theme = ordre[(ordre.indexOf(I18N.theme) + 1) % ordre.length];
  try { localStorage.setItem(LS_THEME, I18N.theme); } catch (e) { /* privé */ }
  applyTheme();
}

/* -------------------------------------------------------------------------- */
/* Langue                                                                     */
/* -------------------------------------------------------------------------- */

function applyLang() {
  applyI18n(document);
  if (typeof refreshDynamicStrings === 'function') refreshDynamicStrings();
  const btn = document.getElementById('btn-lang');
  if (btn) {
    // Le bouton propose toujours l'autre langue. Il est exclu du balayage
    // automatique : son libellé ne suit pas la langue courante.
    btn.textContent = I18N.lang === 'fr' ? '\ud83c\uddec\ud83c\udde7 English' : '\ud83c\uddeb\ud83c\uddf7 Fran\u00e7ais';
    btn.setAttribute('title', I18N.lang === 'fr'
      ? 'Passer l\u2019interface en anglais'
      : 'Switch the interface to French');
    btn.setAttribute('lang', I18N.lang === 'fr' ? 'en' : 'fr');
  }
  // Le gabarit de prompt pour LLM dépend de la langue : on rafraîchit l'aperçu.
  if (typeof buildAiPrompt === 'function') {
    const preview = document.getElementById('ai-preview');
    if (preview) preview.textContent = buildAiPrompt();
  }
  // Les cartes d'historique et le sélecteur de qualité sont reconstruits.
  if (typeof refreshHistory === 'function' && typeof STATE !== 'undefined' && STATE.history) {
    refreshHistory();
  }
  if (typeof renderQualityOptions === 'function') renderQualityOptions();
}

function toggleLang() {
  I18N.lang = I18N.lang === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem(LS_LANG, I18N.lang); } catch (e) { /* privé */ }
  applyLang();
}

/* -------------------------------------------------------------------------- */
/* Initialisation                                                             */
/* -------------------------------------------------------------------------- */

function initI18n() {
  try {
    const lang = localStorage.getItem(LS_LANG);
    if (lang === 'fr' || lang === 'en') I18N.lang = lang;
    const theme = localStorage.getItem(LS_THEME);
    if (theme === 'dark' || theme === 'light' || theme === 'system') I18N.theme = theme;
  } catch (e) { /* mode privé */ }

  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) btnTheme.addEventListener('click', cycleTheme);
  const btnLang = document.getElementById('btn-lang');
  if (btnLang) btnLang.addEventListener('click', toggleLang);

  // Un seul point d'entrée : thème + langue + libellés des deux boutons.
  applyTheme();
  applyLang();

  // Suit le thème du système quand le réglage est sur « Système ».
  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (I18N.theme === 'system') applyTheme();
    });
  } catch (e) { /* anciens navigateurs */ }

  applyTheme();
}
