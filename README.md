# WikiTrack

WikiTrack compare les annonces du marché WikiMasters à vos prix moyens. L'analyse du texte est gratuite et s'effectue dans le navigateur, sans service d'IA.

## Utilisation

1. Copiez le texte du marché WikiMasters, collez-le dans la zone d'import au-dessus du tableau et cliquez sur **Analyser**. Chaque collage remplace le texte précédent et chaque analyse remplace les annonces affichées.
2. Vérifiez et corrigez si nécessaire les noms, raretés, mises et durées. Le nom situé après la rareté est utilisé ; les formats incertains sont signalés.
3. Connectez-vous par lien email pour saisir un prix moyen entier positif et cliquez sur **OK**. Une même moyenne s'applique à toutes les annonces ayant le même nom (insensible à la casse et aux espaces supplémentaires) et la même rareté. Enregistrer une nouvelle valeur pour cette carte et cette rareté remplace la précédente. L'onglet **Mes prix moyens** permet de consulter et modifier toutes les moyennes enregistrées.

Une bonne affaire est une mise de départ ou actuelle au moins 20 % sous la moyenne. Sans prix moyen enregistré, les cartes légendaires (L) utilisent une moyenne par défaut de 286 ; elle n'est pas enregistrée et un prix personnel la remplace. Pour les autres raretés, une moyenne doit être renseignée. Le type de mise peut être corrigé à côté du prix.

Cliquez sur un en-tête pour trier les annonces ou les prix moyens ; un deuxième clic inverse le tri et un troisième rétablit l'ordre par défaut. Les étiquettes indiquent la couleur des raretés du jeu. L'heure d'expiration est estimée en ajoutant la durée restante à l'heure du collage, dans le fuseau horaire du navigateur. Les expirations entre 3h inclus et 7h exclu sont signalées. La durée ne se met pas à jour : si le texte a été modifié après le collage ou saisi manuellement, recollez-le pour calculer l'expiration.

Le bouton **Copier** à côté d'un nom le place dans le presse-papiers ; le navigateur peut demander une autorisation.

Les annonces et le texte importé restent temporaires dans le navigateur et disparaissent au rechargement. Seuls les prix moyens sont enregistrés dans Supabase. L'ancienne table `market_listings` et ses données sont conservées, mais la migration désactive l'ajout de nouvelles annonces. Les lots sont limités à 1 000 annonces.

La police Poppins est distribuée sous la [SIL Open Font License](./public/fonts/OFL.txt).

## Configurer Supabase

1. Créez un projet Supabase. Dans **SQL Editor**, exécutez les migrations dans l'ordre :
   - [`supabase/migrations/20261114000000_create_market_listings.sql`](./supabase/migrations/20261114000000_create_market_listings.sql)
   - [`supabase/migrations/20261115000000_average_prices.sql`](./supabase/migrations/20261115000000_average_prices.sql)
2. Dans **Authentication → Providers**, activez la connexion par email.
3. Dans **Authentication → URL Configuration**, définissez l'URL du site et ajoutez les URL de redirection nécessaires, notamment celle de Vercel.
4. Récupérez l'URL du projet et la clé anon/publishable dans les paramètres API.

Les règles RLS limitent les prix moyens à leur propriétaire. Pour un projet existant, appliquez uniquement la nouvelle migration ; les anciennes annonces ne sont pas supprimées.

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
