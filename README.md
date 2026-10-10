# Orsay · De salle en salle

Guide indépendant des œuvres exposées au musée d’Orsay. Site statique sans dépendances : navigation par étage et salle, recherche d’artiste ou d’œuvre, vues liste et grille avec images officielles, tirage au hasard, favoris dans localStorage et liens vers le catalogue officiel.

Les localisations sont issues des pages publiques du musée, avec date de collecte affichée. Un accrochage peut changer après cette date. Les favoris restent privés dans le navigateur et ne sont pas envoyés à un serveur.

`python scripts/update.py` actualise les œuvres exposées et leurs localisations à partir du catalogue (nécessite Python 3 et curl). La collecte vérifie la couverture du catalogue avant de remplacer les données. Le workflow GitHub Pages publie les quatre fichiers statiques à chaque push sur main.

Collecte du 10 octobre 2026 : 2 059 résultats du catalogue, dont une fiche signalée non exposée dans sa propre notice, exclue du guide. Le site contient donc 2 058 œuvres localisées.


Le registre des salles reprend le plan officiel de printemps 2026 et distingue les niveaux 0, 2, 3, 4 et 5. Les localisations regroupées du catalogue (10a/10b, 41/42, 43/44/45, 46/47, 69a/69b et passerelles) restent signalées comme communes. Les salles sans œuvre localisée sont accessibles avec un état vide explicite. Les images sont chargées directement depuis les liens publics du musée ; une image absente est indiquée sans remplacement inventé.
