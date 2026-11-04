# feedmthiriez

Veille personnelle commerce, retail media, mesure, recharge, régulation, IA et contenus.
Page publique : https://mthiriez.github.io/feedmthiriez/

## Fonctionnement

- **Collecte** : 35 flux RSS français et anglophones (`sources.json`).
- **Dédoublonnage** : URL canonique et titre normalisé, sur 30 jours.
- **Analyse** : chaque article reçoit sept attributs (thème, sous-thème, secteur, nature, profondeur, utilité, nouveauté, qualité de source).
- **Classement** : score = 55 % affinité apprise + 25 % qualité intrinsèque + 20 % fraîcheur.
- **Apprentissage** : chaque 👍 ou 👎 met à jour des poids par attribut, immédiatement et sans réentraînement.
- **Explication** : la ligne « pour vous » donne les deux attributs qui ont le plus pesé.
- **Découverte** : les sujets peu explorés restent visibles, le tri ne se referme pas sur les habitudes.

## Interface

`index.html` (structure et styles), `app.js` (moteur et interactions), `config.js` (paramètres de synchronisation).
Votes et favoris sont enregistrés dans le navigateur, puis synchronisés entre appareils dès que Supabase est configuré.

## Synchronisation Supabase (gratuit)

1. Créer un projet sur supabase.com (offre gratuite).
2. SQL Editor : coller le contenu de `supabase/schema.sql` et exécuter.
3. Authentication > Providers : garder Email activé (lien magique).
4. Project Settings > API : copier `Project URL` et la clé `anon public` dans `config.js`.

La clé `anon` est publique par nature : les règles RLS garantissent qu'un utilisateur ne lit et n'écrit que ses propres lignes. Aucune clé `service_role` n'est utilisée dans le site.

## Limites de l'offre gratuite

Supabase gratuit : 500 Mo de base et authentification par email incluse. Le volume de votes attendu (quelques milliers de lignes) reste très en dessous.

## Ajouter une source

Ajouter une entrée dans `sources.json` : nom, url, lang, rubrique. Aucun autre changement.
