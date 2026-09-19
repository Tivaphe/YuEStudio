??YueStudio - creation de musique en local (modele YuE2-3B en GGUF)
==================================================================

INSTALLATION EN 3 ETAPES
------------------------

1) Installez Python (une seule fois), dans PowerShell :

       winget install -e --id Python.Python.3.12

   puis fermez et rouvrez la fenetre PowerShell.

2) Double-cliquez sur :      1-INSTALLER.bat
   (telecharge le moteur audio.cpp et le modele YuE2, environ 5,5 Go)

   Si Windows affiche une alerte : "Informations complementaires"
   puis "Executer quand meme".

3) Double-cliquez sur :      2-LANCER.bat
   Le navigateur s'ouvre sur http://127.0.0.1:8090
   GARDEZ la fenetre noire ouverte pendant l'utilisation.

Pour arreter : FERMEZ SIMPLEMENT LA FENETRE NOIRE.
  Le modele est decharge (VRAM liberee) et le moteur est coupe automatiquement.
  Fermer l'onglet du navigateur libere aussi la VRAM (le moteur reste disponible).
  3-ARRETER.bat ne sert qu'en cas de blocage (fenetre fermee brutalement, processus
  orphelin apres un plantage).


PAS DE PAROLES ? LAISSEZ UN LLM LES ECRIRE (details dans PROMPT-LLM.md)
------------------------------------------------------------------------

  Dans la colonne de droite de la page "Creer", carte "Preparer avec une IA" :
    1. ecrivez le STYLE souhaite et le SUJET de la chanson (en francais)
    2. choisissez la duree visee
    3. cliquez sur "Copier le prompt"
    4. collez ce prompt dans ChatGPT / Claude / Gemini / Mistral
    5. le LLM renvoie trois blocs : TITRE, STYLE, PAROLES
    6. recopiez STYLE et PAROLES dans le formulaire, puis Generer

  Le prompt impose au LLM le format exact attendu par YuE2 (balises anglaises,
  refrain duplique, 6 a 10 syllabes par ligne, [Intro] et [Interlude] vides...).


CONSEILS POUR LES PAROLES (details dans GUIDE-PAROLES.md)
---------------------------------------------------------

  - Structurez avec [Verse] [Chorus] [Bridge] ; laissez [Intro] et [Interlude] VIDES
    (le modele y met de l'instrumental).
  - Repetez le refrain mot pour mot a chaque passage.
  - Visez 6 a 10 syllabes par ligne, avec des rimes regulieres.
  - La duree suit les paroles : environ 10 secondes par ligne, 6 minutes maximum.
  - Mettez les indications de production (BPM, instruments, voix) dans le STYLE,
    jamais dans les paroles.
  - Tags de style en anglais de preference, meme pour des paroles en francais.


UTILISATION
-----------

Onglet "Creer une musique" :
  - Titre de la musique
  - Style   (tags separes par virgules : genre, instruments, ambiance, voix)
  - Paroles (structurez avec [Verse] [Chorus] [Bridge] ...)
  - Bouton "Generer la musique"
  - Bouton "Exemple" pour partir d'un cas concret
  - "Reglages avances" : qualite (Q4/Q8/BF16), planification, graine, etapes

Onglet "Historique" :
  - toutes les generations, avec lecteur audio et telechargement
  - boutons "Copier" pour le style et les paroles
  - "Reutiliser" (meme graine) et "Regenerer" (nouvelle graine)
  - partition ABC composee par le modele
  - recherche, favoris, notes, renommage, suppression
  - export / import JSON de l'historique


VOTRE MATERIEL (ExpertCenter D500SC, i5-11400, 32 Go, RTX 2000 Ada 16 Go)
--------------------------------------------------------------------------

  Qualite Q4  : ~7,8 Go de VRAM   (le plus rapide)
  Qualite Q8  : ~8,9 Go de VRAM   (recommande, quasi sans perte)
  Qualite BF16: ~12,5 Go de VRAM  (le plus fidele)

  Les trois passent sur vos 16 Go.
  Duree de calcul : environ 2 a 6 minutes pour une chanson de 3 minutes.
  La premiere generation est plus lente (chargement du modele : 30 a 60 s).


DEPANNAGE RAPIDE
----------------

  Python introuvable      -> winget install -e --id Python.Python.3.12
  Erreur CUDA / DLL       -> mettre a jour le pilote NVIDIA, ou relancer
                             l'installateur avec :  .\installer.ps1 -Backend vulkan
  Manque de VRAM          -> choisir la qualite Q4, puis bouton "Liberer la VRAM"
  Le moteur ne repond pas -> lire engine\journal-moteur.log
  Telechargement coupe    -> relancer 1-INSTALLER.bat (il reprend ou il en etait)

  Diagnostic complet, sans rien telecharger :
      Set-ExecutionPolicy -Scope Process Bypass -Force
      .\installer.ps1 -Verifier


FICHIERS
--------

  Mes chansons\       vos fichiers WAV generes
  historique.json     tout l'historique (titre, style, paroles, parametres)
  engine\             moteur audio.cpp + journal-moteur.log
  models\             poids du modele YuE2 (GGUF)
  app\                code de l'interface (Python + HTML/CSS/JS)

  Le dossier entier est deplacable / copiable tel quel.
  Sauvegarde = historique.json + dossier "Mes chansons".


LICENCE
-------

  Poids YuE2-3B : CC BY-NC 4.0 -> usage personnel uniquement, PAS d'usage
  commercial (ni vente ni monetisation des morceaux generes).
  Moteur audio.cpp : MIT.

  Documentation complete : LISEZ-MOI.md
  Guide des paroles      : GUIDE-PAROLES.md
  Prompt pour un LLM     : PROMPT-LLM.md
  Presentation (GitHub)  : README.md
