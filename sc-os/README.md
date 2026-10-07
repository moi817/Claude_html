# SC//OS – tableau de bord Star Citizen

Application web autonome (HTML/JS, aucune dépendance, aucun build). Données stockées dans le navigateur,
synchronisables entre appareils via un Gist GitHub secret.

## Utilisation
- **Rapide :** ouvrir `index.html` dans un navigateur (en `file://`, pas d'installation ni de notifications fiables).
- **Application installable (recommandé) :** héberger le dossier en HTTPS, par exemple avec GitHub Pages.
  1. Dépôt GitHub → *Settings* → *Pages* → *Source : Deploy from a branch*.
  2. Choisir la branche qui contient `sc-os/` et le dossier `/ (root)`.
  3. Ouvrir `https://<utilisateur>.github.io/<depot>/sc-os/`, puis installer :
     Chrome/Edge → icône « Installer » (ou menu ⋮) ; iPhone → Safari → Partager → « Sur l'écran d'accueil ».

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | toute l'application |
| `manifest.webmanifest` | métadonnées d'installation (nom, icônes, raccourcis Minage / Salvage / Raffinage) |
| `maquettes.html` | page de comparaison des styles d'interface (aperçus statiques) |
| `sw.js` | service worker : interface disponible hors ligne (réseau d'abord, cache en secours) |
| `icon*.svg`, `icon-*.png` | icônes |

## Sources de données
FleetYards (catalogue, images, hangars publics) · Star Citizen Wiki API (Comm-Link) · UEX Corp (prix)
· ntfy.sh (notifications téléphone, optionnel) · Gist GitHub (synchronisation, optionnelle).

## Alertes 24 h/24 (robot GitHub, gratuit)
`.github/workflows/sc-alerts.yml` lance toutes les ~15 minutes `.github/scripts/sc-alerts.mjs` (Node, sans dépendance) :
nouvelles promos et événements RSI, nouveaux patchs, seuils de prix UEX → notification ntfy sur le téléphone,
**application fermée et PC éteint**. Les réglages (règles de prix, cases promos/patchs, sujet ntfy) sont lus dans le Gist
de synchronisation de l'application ; la déduplication s'appuie sur l'historique ntfy des 12 dernières heures
(aucun état, aucune écriture dans le dépôt).

Activation (une fois) :
1. Dans l'application : connecter la synchronisation GitHub, activer ntfy, créer les règles (Système).
2. Dépôt → *Settings → Secrets and variables → Actions → Variables* : créer `SC_DATA_URL` avec l'adresse affichée dans l'application.
3. **Fusionner la branche dans la branche par défaut** : GitHub n'exécute les workflows planifiés que depuis celle-ci.

Limites : le déclenchement peut être retardé de quelques minutes ; GitHub désactive les workflows planifiés d'un dépôt public
après 60 jours sans activité ; `workflow_dispatch` permet un lancement manuel depuis l'onglet *Actions*.
Test local sans rien envoyer : `SC_DATA_URL=<url> node .github/scripts/sc-alerts.mjs --dry-run`.
