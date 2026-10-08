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

## Démarrer

Prérequis : Node.js 22+ (aucun compilateur nécessaire : le module SQLite
chiffré est livré précompilé pour Windows, macOS et Linux).

```bash
npm install
npm run dev        # application en mode développement (rechargement à chaud)
npm test           # tests de la couche données (exécutés dans le Node d'Electron)
npm run typecheck
npm run dist       # installeurs : .exe (NSIS + portable), .dmg, AppImage / .deb
```

Variables utiles :

- `DINA_DATA_DIR=/chemin` : dossier de données personnalisé.
- La version **portable** Windows range ses données à côté de l'exécutable
  (`Dina-donnees/`) : utilisable depuis une clé USB.

## Ce qui est en place (étape 1)

- **Base de données** : schéma complet de tous les modules, migrations
  versionnées (`PRAGMA user_version`), chiffrement optionnel avec changement /
  retrait du mot de passe, sauvegarde JSON compressée et chiffrée
  (AES-256-GCM + scrypt), restauration, export et effacement RGPD par élève.
- **Cahier journal** : vues jour / semaine / mois, créneaux par matière et
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

Les modules **Préparations** et **Élèves** ont leurs tables, l'export et
l'effacement RGPD sont implémentés côté données ; leurs écrans sont la
prochaine étape.

## Documentation

- [Architecture, choix techniques et schéma de données](docs/ARCHITECTURE.md)
