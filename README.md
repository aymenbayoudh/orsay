# Orsay · De salle en salle

Guide indépendant des œuvres exposées au musée d’Orsay. Site statique sans dépendances : navigation par étage et salle, recherche d’artiste ou d’œuvre, favoris dans localStorage, liens vers le catalogue officiel.

Les localisations sont issues des pages publiques du musée, avec date de collecte affichée. Un accrochage peut changer après cette date. Les favoris restent privés dans le navigateur et ne sont pas envoyés à un serveur.

`python scripts/update.py` actualise les œuvres exposées et leurs localisations à partir du catalogue (nécessite Python 3 et curl). La collecte vérifie la couverture du catalogue avant de remplacer les données. Le workflow GitHub Pages publie les quatre fichiers statiques à chaque push sur main.

Collecte du 10 octobre 2026 : 2 059 résultats du catalogue, dont une fiche signalée non exposée dans sa propre notice, exclue du guide. Le site contient donc 2 058 œuvres localisées.

