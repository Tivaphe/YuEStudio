# 🚀 Premiers pas avec YueStudio (2 minutes)

## 1. Installez Python (une seule fois)

Ouvrez **PowerShell** (menu Démarrer → « PowerShell ») et collez :

```powershell
winget install -e --id Python.Python.3.12
```

Puis **fermez la fenêtre PowerShell**.

> Python déjà installé ? Passez à l'étape 2. Vérifiez avec `python --version` (3.8 ou + requis).

## 2. Installez YueStudio

Double-cliquez sur **`1-INSTALLER.bat`**

- Appuyez sur une touche quand on vous le demande.
- Si Windows affiche *« a protégé votre ordinateur »* → **Informations complémentaires** → **Exécuter quand même**.
- Laissez tourner : ~1 Go de moteur + ~4,6 Go de modèle. La progression est affichée.
- Coupure internet ? Relancez `1-INSTALLER.bat`, ça **reprend** où ça s'est arrêté.

## 3. Créez votre première chanson

Double-cliquez sur **`2-LANCER.bat`** → le navigateur s'ouvre sur <http://127.0.0.1:8090>.

1. Cliquez sur **✨ Exemple** (le formulaire se remplit tout seul).
2. Modifiez le **Titre**, le **Style** et les **Paroles**.
3. Cliquez sur **🎵 Générer la musique**.
4. Attendez : la 1<sup>re</sup> fois, le modèle se charge en VRAM (30 à 60 s),
   puis la chanson se compose (**2 à 6 minutes** pour ~3 minutes de musique).
5. Le morceau apparaît dans **🕘 Historique** et dans le dossier **📁 Mes chansons**.

**Gardez la fenêtre noire ouverte** pendant toute la session.
**Pour arrêter : fermez-la.** Le modèle est déchargé (VRAM libérée) et le moteur coupé
automatiquement. `3-ARRETER.bat` ne sert qu'en cas de blocage.

---

## ✍️ Trois réflexes pour de bonnes paroles

1. **Structurez** avec `[Verse]`, `[Chorus]`, `[Bridge]` — et laissez `[Intro]` / `[Interlude]` **vides** (instrumental).
2. **Répétez le refrain mot pour mot** à chaque passage, et visez 6 à 10 syllabes par ligne.
3. **La durée suit les paroles** : ~10 s par ligne, 6 minutes maximum.

👉 Guide complet (avec un modèle de chanson prêt à coller) : **`GUIDE-PAROLES.md`**

## 🤖 Vous n'avez pas de paroles ?

Dans la colonne de droite, carte **« Préparer avec une IA »** :
décrivez le **style** et le **sujet** en une phrase, puis au choix :

- **✨ Écrire les paroles** : le parolier local (option `.\\installer.ps1 -AvecParolier`,
  100 % hors ligne) écrit tout et **⬆ Utiliser** remplit le formulaire — voir `PAROLIER.md` ;
- **📋 Copier le prompt** → collez dans ChatGPT / Claude / Gemini → recopiez les blocs
  `STYLE` et `PAROLES` renvoyés — voir `PROMPT-LLM.md`.

## 🌗 Deux boutons en haut à droite

**🌙** change le thème (sombre → clair → système) et **🇬🇧 English** traduit toute l'interface.
Les deux choix sont mémorisés, et la traduction se fait sans recharger la page.

## ⚡ Les 4 réflexes utiles

| Je veux… | Je clique sur |
|---|---|
| Réutiliser un style qui marche | 📋 **Copier** à côté du style, dans l'Historique |
| Refaire la même chanson en mieux | 🎲 **Régénérer** (mêmes réglages, nouvelle graine) |
| Repartir d'un ancien morceau | ♻️ **Réutiliser** (tout est rechargé dans le formulaire) |
| Jouer ou lancer un autre logiciel 3D | 🧹 **Libérer la VRAM** en haut à droite |

---

## ❓ Si ça ne marche pas

1. Double-cliquez sur `1-INSTALLER.bat` avec l'option diagnostic, dans PowerShell :
   ```powershell
   cd "CHEMIN\VERS\YueStudio"
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\installer.ps1 -Verifier
   ```
2. Ouvrez `engine\journal-moteur.log` : la vraie erreur technique s'y trouve.
3. Consultez la section **Dépannage** de `LISEZ-MOI.md`.

> ⚠️ Rappel licence : les poids YuE2 sont en **CC BY-NC 4.0** → usage personnel
> et recherche uniquement, **pas d'usage commercial** des morceaux générés.
