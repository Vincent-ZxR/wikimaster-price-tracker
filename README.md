# WikiTrack

WikiTrack compare les annonces du marché WikiMasters à vos prix moyens. L'analyse du texte est gratuite et s'effectue dans le navigateur, sans service d'IA.

## Utilisation

1. Copiez le texte du marché WikiMasters, collez-le dans la zone d'import au-dessus du tableau et cliquez sur **Analyser**. Chaque collage remplace le texte précédent et chaque analyse remplace les annonces affichées.
2. Vérifiez les noms, raretés, mises et durées. Les annonces sont affichées en lecture seule : pour les corriger, modifiez le texte importé et relancez l'analyse. Le nom situé après la rareté est utilisé ; les formats incertains sont signalés.
3. Entrez le mot de passe partagé du groupe pour saisir un prix moyen entier positif et cliquez sur **OK**. Une même moyenne s'applique à tous les membres et à toutes les annonces ayant le même nom (insensible à la casse et aux espaces supplémentaires) et la même rareté. Chaque saisie est conservée dans un historique partagé ; la dernière valeur est utilisée pour le calcul. Dans **Suivi de prix**, recherchez un nom pour afficher uniquement les cartes correspondantes, consulter leur prix de référence et modifier les moyennes communes. Cliquez sur un nom pour afficher deux courbes et leurs détails : les mises enregistrées et les moyennes partagées datées, même lorsqu'elles ne sont plus prises en compte dans l'estimation. Les dates sont affichées dans le fuseau local. Les points de mises correspondent à des enchères potentiellement différentes, non à des prix de vente. Pour les cartes sans moyenne enregistrée, le nom apparaît sous sa forme normalisée.

Lors de la migration vers les données partagées, si plusieurs comptes avaient une moyenne différente pour une carte, la dernière valeur datée est conservée. Les moyennes et historiques antérieurs sont regroupés ; les anciennes valeurs sans date ne peuvent pas être ordonnées précisément. Les nouvelles saisies sont horodatées et ajoutées sans effacer les précédentes.

Les légendaires shiny sont reconnues sous la rareté **L✦**, distincte de **L** : leurs moyennes et observations sont séparées. Les anciens imports ne peuvent pas être reclassés automatiquement.

Une bonne affaire est une mise de départ ou actuelle au moins 20 % sous le **prix de référence**, sauf si sa durée indique « Terminée ». Pour ces annonces, la colonne comparaison affiche aussi la mise maximale à 80 % du prix de référence, arrondie à l'entier inférieur. Il s'agit d'une indication, pas d'une garantie : les mises observées ne sont pas nécessairement des prix de vente finaux et le minimum autorisé par le jeu peut dépasser cette limite.

Lorsqu'un membre du groupe analyse un texte, les mises **actuelles** positives dont le nom et la rareté ont été reconnus avec certitude sont enregistrées automatiquement dans l'historique partagé, y compris pour les annonces terminées. Le nom après la rareté est utilisé même s'il diffère du premier. Les mises de départ, les annonces incertaines et les imports textuellement identiques sont exclus. Une analyse sans accès au groupe ne contribue pas à l'historique.

Pour les nouveaux imports, le vendeur et l'expiration estimée permettent de rapprocher deux annonces de même nom, rareté et vendeur dont les expirations diffèrent d'au plus une minute. La mise de la capture la plus récente remplace alors la précédente, y compris dans l'historique et l'estimation. L'expiration reste celle estimée à la première observation pour éviter les décalages cumulés. Pour « Terminée », l'expiration est supposée égale à l'heure du collage : une annonce terminée collée plus d'une minute après son expiration estimée ne sera donc pas rapprochée. Si le vendeur ou l'heure du collage manque, la mise est enregistrée sans rapprochement. Coller à nouveau le texte après toute modification pour disposer d'une heure de collage. Les anciennes observations, qui ne contiennent ni vendeur ni expiration, sont conservées mais ne peuvent pas être rapprochées. Le texte complet n'est pas conservé ; le vendeur normalisé est partagé dans le groupe. Le rapprochement reste approximatif : des doublons ou de rares regroupements incorrects sont possibles.

Une carte apparaît dans **Suivi de prix** dès sa première mise actuelle enregistrée. Utilisez **Voir l'historique** pour consulter cette mise et sa date ; le seuil de 5 observations concerne uniquement l'estimation des mises, pas l'affichage de l'historique.

Pour chaque nom et rareté, l'estimation utilise au maximum les 200 dernières observations des 90 derniers jours. À partir de 5 observations, elle prend leur 75e percentile (le quartile supérieur) : les mises les plus basses ont ainsi moins d'influence, sans supposer de distribution particulière. Si une moyenne manuelle partagée existe aussi, le prix de référence est calculé avec 75 % de la **dernière** moyenne partagée et 25 % de l'estimation des observations. Les moyennes précédentes restent disponibles dans l'historique mais ne participent pas au calcul actuel. Avec moins de 5 observations, seule la moyenne partagée est utilisée. Sans moyenne partagée ni suffisamment d'observations, la référence est 286 pour les légendaires classiques et shiny (L et L✦), et indisponible pour les autres raretés.

La colonne **Prix de référence** affiche aussi séparément la dernière moyenne manuelle et l'estimation issue des observations ; un tiret indique qu'aucune moyenne manuelle n'est enregistrée ou que le seuil de 5 observations n'est pas atteint. Le nombre principal reste le prix de référence utilisé pour le tri et les comparaisons.

Les observations sont conservées sans limite de 90 jours, mais les mises précédentes d'une même annonce rapprochée sont remplacées. Elles ne permettent pas de retrouver les prix de vente finaux, les identifiants d'enchères ou les informations non enregistrées lors de l'import ; la date d'une mise est celle de son dernier enregistrement, pas nécessairement celle de la capture.

La fiabilité est **indicative** : elle est dite modérée à partir de 20 observations si le 75e percentile ne dépasse pas deux fois le 25e ; sinon elle est faible. Ce n'est ni une probabilité ni un intervalle de confiance, notamment à cause des enchères inachevées et des doublons possibles.

Cliquez sur un en-tête pour trier les annonces ou les prix moyens ; un deuxième clic inverse le tri et un troisième rétablit l'ordre par défaut. Les étiquettes indiquent la couleur des raretés du jeu. L'heure d'expiration est estimée en ajoutant la durée restante à l'heure du collage, dans le fuseau horaire du navigateur. Les expirations entre 3h inclus et 7h exclu sont signalées. La durée ne se met pas à jour : si le texte a été modifié après le collage ou saisi manuellement, recollez-le pour calculer l'expiration.

Le bouton **Copier** à côté d'un nom le place dans le presse-papiers ; le navigateur peut demander une autorisation.

Dans l'onglet **Mots-clés**, chaque membre du groupe peut consulter la liste, ajouter une expression d'un ou plusieurs mots (200 caractères maximum) et la copier. La liste est rechargée à l'ouverture de l'onglet ou avec **Actualiser**.

Les annonces affichées et le texte importé restent temporaires dans le navigateur et disparaissent au rechargement. Les mots-clés, prix moyens et observations de mises actuelles partagés sont enregistrés dans Supabase. L'ancienne table `market_listings` et ses données sont conservées, mais la migration désactive l'ajout de nouvelles annonces. Les lots sont limités à 1 000 annonces.

La police Poppins est distribuée sous la [SIL Open Font License](./public/fonts/OFL.txt).

## Configurer Supabase

1. Créez un projet Supabase. Dans **SQL Editor**, exécutez les migrations dans l'ordre :
   - [`supabase/migrations/20261114000000_create_market_listings.sql`](./supabase/migrations/20261114000000_create_market_listings.sql)
   - [`supabase/migrations/20261115000000_average_prices.sql`](./supabase/migrations/20261115000000_average_prices.sql)
   - [`supabase/migrations/20261116000000_price_observations.sql`](./supabase/migrations/20261116000000_price_observations.sql)
   - [`supabase/migrations/20261116010000_price_tracking.sql`](./supabase/migrations/20261116010000_price_tracking.sql)
   - [`supabase/migrations/20261116020000_average_price_history.sql`](./supabase/migrations/20261116020000_average_price_history.sql)
   - [`supabase/migrations/20261116030000_match_price_observations.sql`](./supabase/migrations/20261116030000_match_price_observations.sql)
   - [`supabase/migrations/20261116040000_legendary_shiny.sql`](./supabase/migrations/20261116040000_legendary_shiny.sql)
   - [`supabase/migrations/20261117000000_shared_access.sql`](./supabase/migrations/20261117000000_shared_access.sql)
   - [`supabase/migrations/20261118000000_keywords.sql`](./supabase/migrations/20261118000000_keywords.sql)
2. Récupérez l'URL du projet et la clé **service_role** dans les paramètres API. Cette clé reste exclusivement côté serveur.

La migration d'accès partagé regroupe les moyennes et leurs historiques de tous les comptes : en cas de conflit, la valeur actuelle la plus récemment datée est retenue. Les historiques existants restent conservés. Les règles RLS et les privilèges SQL interdisent l'accès direct aux données ; seule l'application, après vérification du mot de passe partagé, utilise la clé serveur. Pour un projet utilisant encore les comptes individuels, mettez l'ancienne application en pause, appliquez les migrations manquantes dans l'ordre, puis déployez cette version avant de rouvrir l'accès : la migration d'accès partagé change le schéma et les anciennes versions ne sont plus compatibles. Les anciennes annonces ne sont pas supprimées. Pour ajouter les mots-clés à un projet déjà partagé, appliquez la migration correspondante avant le déploiement.

## Configurer et exécuter l'application

Copiez `.env.example` vers `.env.local` et renseignez :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service_role
SHARED_ACCESS_PASSWORD=un-mot-de-passe-long-a-partager-avec-vos-amis
APP_SESSION_SECRET=une-cle-aleatoire-de-64-caracteres-hexadecimaux
```

Générez une valeur aléatoire pour `APP_SESSION_SECRET` avec `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Choisissez un mot de passe partagé d'au moins 16 caractères et transmettez-le uniquement à vos amis. La clé `service_role` contourne les règles RLS : ne la préfixez jamais par `NEXT_PUBLIC_` et ne la communiquez pas aux membres du groupe. L'accès reste déverrouillé dans le navigateur pendant 30 jours ; le bouton **Verrouiller** met fin à la session sur l'appareil actuel. Modifier le mot de passe invalide aussi les sessions existantes.

```bash
npm install
npm run dev
npm test
```

Ouvrez [http://localhost:3000](http://localhost:3000). Pour Vercel, importez le dépôt et ajoutez les quatre variables d'environnement. Les offres gratuites de Vercel et Supabase sont soumises à leurs conditions et limites respectives.
