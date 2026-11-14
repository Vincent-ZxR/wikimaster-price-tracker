# WikiTrack

WikiTrack transforme le texte copié du marché WikiMasters en annonces modifiables, puis les enregistre dans Supabase. L'analyse est effectuée dans le navigateur, sans OpenAI ni service d'IA payant.

## Utilisation

1. Sur le marché WikiMasters en français, sélectionnez et copiez le texte des annonces.
2. Collez-le dans WikiTrack et cliquez sur **Analyser le texte**.
3. Vérifiez et corrigez les noms, descriptions, types, mises, durées et vendeurs. Les éléments du texte sont parfois collés : l'analyse peut se tromper ou laisser des champs vides. Les formats et descriptions non reconnus nécessitent une correction manuelle.
4. Connectez-vous et enregistrez les annonces. La durée est celle affichée lors de la copie ; la date sauvegardée correspond au moment où le texte a été collé, pas nécessairement au moment où la page a été affichée.

L'analyse fonctionne sans configuration ni connexion. Les enregistrements nécessitent Supabase. Les lots sont limités à 100 annonces.

## Configurer Supabase

1. Créez un projet Supabase.
2. Dans **SQL Editor**, exécutez [`supabase/migrations/20261114000000_create_market_listings.sql`](./supabase/migrations/20261114000000_create_market_listings.sql).
3. Dans **Authentication → Providers**, activez la connexion par email.
4. Dans **Authentication → URL Configuration**, définissez l'URL du site à `http://localhost:3000` pour le développement local. Ajoutez également l'URL de votre site Vercel à la liste des redirections autorisées après déploiement.
5. Récupérez l'URL du projet et la clé anon/publishable dans les paramètres API du projet.

La migration active les règles de sécurité : chaque utilisateur ne peut lire et ajouter que ses propres annonces.

## Configurer l'application

Copiez `.env.example` vers `.env.local` et renseignez :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon-ou-publishable
ALLOWED_EMAILS=votre-adresse@example.com
```

La clé Supabase anon/publishable est destinée au navigateur ; l'accès aux données est limité par les règles de sécurité de Supabase. `ALLOWED_EMAILS` est une liste d'adresses autorisées, séparées par des virgules, pour l'enregistrement via l'application. Après création de votre compte, désactivez les inscriptions publiques dans Supabase Auth pour limiter la création de comptes.

## Exécution locale

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000). Pour enregistrer, connectez-vous avec le lien reçu par email.

Pour vérifier l'analyse : `npm test`.

## Déploiement Vercel

Importez le dépôt dans Vercel, ajoutez les trois variables d'environnement ci-dessus et déployez. Ajoutez l'URL du site déployé à la liste des redirections autorisées de Supabase.

L'analyse est gratuite et ne nécessite aucune clé OpenAI. Vercel et Supabase proposent des offres gratuites soumises à leurs conditions et limites respectives.
