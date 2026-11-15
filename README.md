# WikiTrack

WikiTrack compare les annonces du marché WikiMasters à vos prix moyens. L'analyse du texte est gratuite et s'effectue dans le navigateur, sans service d'IA.

## Utilisation

1. Copiez le texte du marché WikiMasters, collez-le dans la zone d'import au-dessus du tableau et cliquez sur **Analyser**. Chaque collage remplace le texte précédent et chaque analyse remplace les annonces affichées.
2. Vérifiez et corrigez si nécessaire les noms, raretés, mises et durées. Le nom situé après la rareté est utilisé ; les formats incertains sont signalés.
3. Connectez-vous par lien email pour saisir un prix moyen entier positif et cliquez sur **OK**. Une même moyenne s'applique à toutes les annonces ayant le même nom (insensible à la casse et aux espaces supplémentaires) et la même rareté. Chaque saisie est conservée dans un historique personnel ; la dernière valeur est utilisée pour le calcul. L'onglet **Suivi de prix** permet de consulter les cartes observées, leur prix de référence et de modifier vos moyennes personnelles. Cliquez sur un nom pour afficher deux courbes et leurs détails : toutes les mises enregistrées et vos moyennes personnelles datées, même lorsqu'elles ne sont plus prises en compte dans l'estimation. Les dates sont affichées dans le fuseau local. Les points de mises correspondent à des enchères potentiellement différentes, non à des prix de vente. Pour les cartes sans moyenne personnelle, le nom apparaît sous sa forme normalisée.

Lors de l'activation de l'historique des moyennes, la dernière valeur personnelle existante est conservée avec une date inconnue : les saisies antérieures et leurs dates n'étaient pas enregistrées et ne peuvent pas être reconstituées. Cette valeur figure dans le détail, mais pas sur la courbe. Les nouvelles saisies sont horodatées et ajoutées sans effacer les précédentes.

Une bonne affaire est une mise de départ ou actuelle au moins 20 % sous le **prix de référence**. Il s'agit d'une indication, pas d'une garantie : les mises observées concernent des enchères en cours, et non des prix de vente finaux.

Lorsqu'un utilisateur connecté analyse un texte, les mises **actuelles** positives dont le nom et la rareté ont été reconnus avec certitude sont enregistrées automatiquement dans un historique partagé entre les comptes connectés. Les mises de départ, les annonces incertaines et les imports textuellement identiques sont exclus ; corriger une ligne après analyse ne modifie pas l'historique. Une analyse sans connexion ne contribue pas à l'historique. L'historique ne contient ni le texte complet ni le vendeur. Les mêmes enchères peuvent néanmoins apparaître plusieurs fois dans des imports différents : sans identifiant d'enchère, le nombre d'observations n'est pas un nombre d'enchères indépendantes.

Une carte apparaît dans **Suivi de prix** dès sa première mise actuelle enregistrée. Utilisez **Voir l'historique** pour consulter cette mise et sa date ; le seuil de 5 observations concerne uniquement l'estimation des mises, pas l'affichage de l'historique.

Pour chaque nom et rareté, l'estimation utilise au maximum les 200 dernières observations des 90 derniers jours. À partir de 5 observations, elle prend leur 75e percentile (le quartile supérieur) : les mises les plus basses ont ainsi moins d'influence, sans supposer de distribution particulière. Si un prix moyen personnel existe aussi, le prix de référence est calculé avec 75 % de la **dernière** moyenne personnelle et 25 % de l'estimation des observations. Les moyennes précédentes restent disponibles dans l'historique mais ne participent pas au calcul actuel. Avec moins de 5 observations, seul le prix personnel est utilisé. Sans prix personnel ni suffisamment d'observations, la référence est 286 pour les légendaires (L), et indisponible pour les autres raretés.

Les historiques bruts sont conservés sans limite de 90 jours et pourront servir à modifier ou comparer la méthode d'estimation. Ils ne permettent toutefois pas de retrouver les prix de vente finaux, les identifiants d'enchères ou les informations non enregistrées lors de l'import ; la date d'une mise est celle de son enregistrement, pas nécessairement celle de la capture.

La fiabilité est **indicative** : elle est dite modérée à partir de 20 observations si le 75e percentile ne dépasse pas deux fois le 25e ; sinon elle est faible. Ce n'est ni une probabilité ni un intervalle de confiance, notamment à cause des enchères inachevées et des doublons possibles. Le type de mise affiché peut être corrigé à côté du prix.

Cliquez sur un en-tête pour trier les annonces ou les prix moyens ; un deuxième clic inverse le tri et un troisième rétablit l'ordre par défaut. Les étiquettes indiquent la couleur des raretés du jeu. L'heure d'expiration est estimée en ajoutant la durée restante à l'heure du collage, dans le fuseau horaire du navigateur. Les expirations entre 3h inclus et 7h exclu sont signalées. La durée ne se met pas à jour : si le texte a été modifié après le collage ou saisi manuellement, recollez-le pour calculer l'expiration.

Le bouton **Copier** à côté d'un nom le place dans le presse-papiers ; le navigateur peut demander une autorisation.

Les annonces affichées et le texte importé restent temporaires dans le navigateur et disparaissent au rechargement. Les prix moyens personnels et les observations de mises actuelles partagées sont enregistrés dans Supabase. L'ancienne table `market_listings` et ses données sont conservées, mais la migration désactive l'ajout de nouvelles annonces. Les lots sont limités à 1 000 annonces.

La police Poppins est distribuée sous la [SIL Open Font License](./public/fonts/OFL.txt).

## Configurer Supabase

1. Créez un projet Supabase. Dans **SQL Editor**, exécutez les migrations dans l'ordre :
   - [`supabase/migrations/20261114000000_create_market_listings.sql`](./supabase/migrations/20261114000000_create_market_listings.sql)
   - [`supabase/migrations/20261115000000_average_prices.sql`](./supabase/migrations/20261115000000_average_prices.sql)
   - [`supabase/migrations/20261116000000_price_observations.sql`](./supabase/migrations/20261116000000_price_observations.sql)
   - [`supabase/migrations/20261116010000_price_tracking.sql`](./supabase/migrations/20261116010000_price_tracking.sql)
   - [`supabase/migrations/20261116020000_average_price_history.sql`](./supabase/migrations/20261116020000_average_price_history.sql)
2. Dans **Authentication → Providers**, activez la connexion par email.
3. Dans **Authentication → URL Configuration**, définissez l'URL du site et ajoutez les URL de redirection nécessaires, notamment celle de Vercel.
4. Récupérez l'URL du projet et la clé anon/publishable dans les paramètres API.

Les règles RLS limitent les prix moyens et leur historique à leur propriétaire et rendent les observations de mises accessibles aux utilisateurs authentifiés. Pour un projet existant, appliquez les migrations manquantes dans l'ordre ; les anciennes annonces ne sont pas supprimées. La conservation des moyennes successives nécessite `20261116020000_average_price_history.sql`.

## Configurer et exécuter l'application

Copiez `.env.example` vers `.env.local` et renseignez :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon-ou-publishable
ALLOWED_EMAILS=votre-adresse@example.com
```

`ALLOWED_EMAILS` est une liste d'adresses autorisées, séparées par des virgules. Après création de votre compte, désactivez les inscriptions publiques dans Supabase Auth. La clé anon/publishable est destinée au navigateur ; les règles RLS protègent les données.

```bash
npm install
npm run dev
npm test
```

Ouvrez [http://localhost:3000](http://localhost:3000). Pour Vercel, importez le dépôt, ajoutez les trois variables d'environnement et configurez l'URL de redirection Supabase. Les offres gratuites de Vercel et Supabase sont soumises à leurs conditions et limites respectives.
