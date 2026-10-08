# Dina — cahier journal & tableau de classe hors-ligne

Application de bureau pour professeur·e des écoles (maternelle / élémentaire) :
cahier journal, emploi du temps, rendez-vous, préparations, fiches élèves et
mode tableau projeté avec écriture cursive sur lignage Seyès.

**100 % locale** : aucune connexion Internet, aucune télémétrie, base SQLite
chiffrée (SQLCipher / AES-256) sur le poste de l'enseignant·e.

| Cahier journal (semaine) | Journée : bilan et remarques en direct |
| --- | --- |
| ![](docs/captures/journal-semaine.png) | ![](docs/captures/journal-jour.png) |
| **Pupitre du tableau (cursive sur Seyès)** | **Écran projeté : programme du jour** |
| ![](docs/captures/tableau-consigne.png) | ![](docs/captures/projection-programme.png) |
| **Fiche de préparation** | **Fiche élève** |
| ![](docs/captures/fiche-seance.png) | ![](docs/captures/fiche-eleve.png) |

## Sur iPad (ou tout navigateur récent)

1. Dans **Safari**, ouvrez **https://d799521-pixel.github.io/Dina/**.
2. Touchez l'icône **Partager** (carré avec une flèche) → **Sur l'écran
   d'accueil** → **Ajouter**. L'icône Dina apparaît comme une application.
3. Lancez Dina depuis cette icône. Après la première ouverture, elle fonctionne
   **sans Internet**.

Vos données restent **dans l'iPad** (stockage local, chiffré par votre mot de
passe) : rien n'est envoyé sur Internet. Pour projeter, utilisez la recopie
d'écran (AirPlay vers une Apple TV ou câble USB-C/HDMI) puis le bouton
**Plein écran** du tableau.

⚠️ Supprimer l'icône Dina ou effacer les données de Safari efface la base :
faites régulièrement **Paramètres → Sauvegarde → Exporter** (le fichier
arrive dans l'app Fichiers). Une sauvegarde faite sur iPad se restaure sur
l'ordinateur, et inversement.

## Installer Dina sur un ordinateur (sans rien de technique)

1. Sur GitHub, ouvrez l'onglet **Actions**, cliquez sur la dernière exécution
   « Installeurs » marquée d'une coche verte.
2. En bas de la page, section **Artifacts**, téléchargez :
   - **Dina-Windows** : contient `Dina-Installation-….exe` (installation
     classique) et `Dina-Portable-….exe` (aucune installation, fonctionne depuis
     une clé USB, données rangées à côté du fichier) ;
   - **Dina-Mac** : `Dina-…-arm64.dmg` (Mac M1/M2/M3/M4) ou `Dina-…-x64.dmg`
     (Mac Intel) ;
   - **Dina-Linux** : `Dina-….AppImage`.
3. Décompressez le fichier `.zip` téléchargé puis lancez l'installeur.

Les installeurs ne sont pas signés (un certificat coûte plusieurs centaines
d'euros par an) ; le système affiche donc un avertissement la première fois :

- **Windows** : « Windows a protégé votre ordinateur » → *Informations
  complémentaires* → *Exécuter quand même*.
- **Mac** : clic droit sur Dina → *Ouvrir* → *Ouvrir* ; ou *Réglages système →
  Confidentialité et sécurité → Ouvrir quand même*.
- **Linux** : clic droit sur le fichier → *Propriétés* → autoriser l'exécution.

## Développement

Prérequis : Node.js 22+ (aucun compilateur nécessaire : le module SQLite
chiffré est livré précompilé pour Windows, macOS et Linux).

```bash
npm install
npm run dev        # application en mode développement (rechargement à chaud)
npm test           # tests de la couche données (exécutés dans le Node d'Electron)
npm run typecheck
npm run dist       # installeurs : .exe (NSIS + portable), .dmg, AppImage
npm run dev:web    # version navigateur / iPad en développement
npm run build:web  # version navigateur / iPad (PWA) dans dist-web/
```

Variables utiles :

- `DINA_DATA_DIR=/chemin` : dossier de données personnalisé.
- La version **portable** Windows range ses données à côté de l'exécutable
  (`Dina-donnees/`) : utilisable depuis une clé USB.

## Fonctionnalités

- **Base de données** : schéma complet de tous les modules, migrations
  versionnées (`PRAGMA user_version`), chiffrement optionnel avec changement /
  retrait du mot de passe, sauvegarde JSON compressée et chiffrée
  (AES-256-GCM + scrypt), restauration, export et effacement RGPD par élève.
- **Maternelle** : domaines du programme 2024-2026, temps propres à la
  maternelle (regroupement, sieste, pause méridienne, multi-domaine) et
  **référentiel des 403 objectifs d'apprentissage officiels** par âge
  (PS / MS / GS), à associer aux séquences et aux séances.
- **Cahier journal** : vues jour / semaine / mois, créneaux par groupe
  (PS, GS, groupe 1…) affichés **en colonnes** quand ils sont simultanés
  (ateliers, sieste des PS pendant la phonologie des GS), texte
  « Activités » et **photos** par créneau, **impression de la journée**
  au format cahier journal, créneaux par matière et
  domaine du socle, lien en un clic vers une fiche de séance, statut de séance
  (fait, partiel, reporté, annulé), remarques rapides (retard, imprévu,
  différenciation…), bilan, note du jour, rendez-vous (parents, RASED, équipe,
  ESS, conseil d'école) avec compte rendu, emploi du temps type
  (enregistrer une semaine / l'appliquer à une autre).
- **Mode tableau** : fenêtre de projection ouverte automatiquement sur l'écran
  secondaire, pilotée depuis un pupitre avec aperçu fidèle. Scènes : date du
  jour, consigne, programme en pictogrammes, minuteur visuel (disque qui se
  vide + carillon synthétisé), écran noir. Lignage Seyès ou double ligne,
  minuscules sur 1 ou 2 interlignes, polices cursive (Playwrite FR Moderne),
  script (Andika), capitales, OpenDyslexic, ou **police personnelle importée**
  (ex. Belle Allure, dont la licence interdit la redistribution).

- **Préparations** : programmation annuelle (matières × périodes P1 à P5,
  ordre = progression, dates des périodes), transformation d'une ligne de
  programmation en séquence, fiches séquence (objectifs, prérequis, critères de
  réussite, évaluation), fiches de préparation avec déroulement étape par étape
  (durée, modalité individuel / binôme / groupes / collectif, rôle de
  l'enseignant·e, activité des élèves, matériel), différenciation,
  institutionnalisation, duplication et **export PDF**.
- **Élèves** : fiche de renseignements (identité, contacts et responsables,
  autorisations photo / sorties / transport…, allergies et PAI, aménagements
  PAP / PPRE / PPS / tiers-temps), observations datées, historique des
  rendez-vous, alertes santé dans la liste, **export PDF** et **JSON** (droit
  d'accès) et **effacement définitif** (droit à l'effacement).

## Modèles importables

**Paramètres → Importer un modèle** accepte un fichier `.json` décrivant un
emploi du temps type, des jours de classe et des éléments de programmation :

```json
{
  "format": "dina-modele", "version": 1,
  "settings": { "school_days": [5], "day_start": "08:20", "day_end": "16:30" },
  "timetable": [
    { "weekday": 5, "start_time": "09:00", "end_time": "09:30",
      "subject": "Multi-domaine", "label": "Atelier dirigé", "audience": "GS" }
  ],
  "programming": [
    { "subject": "Langage", "period": 1, "title": "Segmenter une phrase en mots",
      "description": "Activités, pages du manuel…" }
  ]
}
```

## Documentation

- [Architecture, choix techniques et schéma de données](docs/ARCHITECTURE.md)
