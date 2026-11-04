# feedmthiriez

Veille quotidienne — commerce, retail media, mesure, recharge, régulation, IA et contenus.

Le site est publié sur GitHub Pages : https://mthiriez.github.io/feedmthiriez/

## Principe

- **Sources** : liste de flux RSS français et anglophones dans `sources.json`, répartis en six rubriques.
- **Déduplication** : chaque article est enregistré par URL canonique et par titre normalisé. Un article déjà publié dans une édition précédente (fenêtre de 30 jours) n'est jamais republié, même s'il remonte dans un autre flux ou est repris par un autre média.
- **Langue** : un article anglophone reste en anglais, avec son titre et son résumé d'origine.
- **Résumé** : une phrase sous chaque article, factuelle, avec les chiffres clés, dans la langue de l'article.

## Structure

```
index.html        page publique (lit editions.json)
editions.json     archive des éditions publiées
feed.xml          flux RSS de la veille
sources.json      sources suivies, par rubrique et par langue
seen.json         registre des articles déjà publiés (anti-doublon)
```

## Ajouter une source

Ajouter une entrée dans `sources.json` :

```json
{ "nom": "LSA", "url": "https://...", "lang": "fr", "rubrique": "Commerce" }
```

Aucun autre changement n'est nécessaire : la source est prise en compte à l'édition suivante.

## Publication

Une édition est générée une fois par jour, du lundi au vendredi, puis publiée sur ce dépôt. Chaque édition est datée et conserve les articles de la veille ou du week-end qu'elle n'a pas encore publiés.
