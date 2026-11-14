# WikiTrack

WikiTrack compare les annonces du marché WikiMasters à vos prix moyens. L'analyse du texte est gratuite et s'effectue dans le navigateur, sans service d'IA.

## Utilisation

1. Copiez le texte du marché WikiMasters, collez-le dans la zone d'import et cliquez sur **Analyser**.
2. Vérifiez et corrigez si nécessaire les noms, raretés, mises et durées. Le nom situé après la rareté est utilisé ; les formats incertains sont signalés.
3. Connectez-vous par lien email pour saisir un prix moyen entier positif et cliquez sur **OK**. Une même moyenne s'applique à toutes les annonces ayant le même nom (insensible à la casse et aux espaces supplémentaires) et la même rareté. Les moyennes enregistrées peuvent être modifiées sur les annonces ou dans **Mes prix moyens**.

Une bonne affaire est une mise de départ au moins 20 % sous la moyenne, ou une mise actuelle au moins 30 % sous la moyenne. Si les deux mises sont renseignées, la mise actuelle est utilisée. Les annonces sans moyenne ne sont pas classées. La durée est celle affichée au moment de la copie, elle ne se met pas à jour.

Les annonces et le texte importé restent temporaires dans le navigateur et disparaissent au rechargement. Seuls les prix moyens sont enregistrés dans Supabase. L'ancienne table `market_listings` et ses données sont conservées, mais la migration désactive l'ajout de nouvelles annonces. Les lots sont limités à 100 annonces.

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
