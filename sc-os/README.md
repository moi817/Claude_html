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
