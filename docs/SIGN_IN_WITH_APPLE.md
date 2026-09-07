# Configuration de Se connecter avec Apple

Le code mobile utilise la feuille Apple native et échange le jeton d'identité avec Supabase.
Lors de la suppression d'un compte Apple, l'application demande un nouveau code Apple et le
serveur révoque le jeton avant d'effacer les données.

## Apple Developer

1. Dans **Certificates, Identifiers & Profiles**, ouvrir l'App ID `com.kidiplus.app` et activer
   **Sign in with Apple**.
2. Créer une clé **Sign in with Apple**, noter son **Key ID** et télécharger le fichier `.p8`.
   Apple ne permet de télécharger ce fichier qu'une seule fois.
3. Conserver le **Team ID** `6XW2XM3NDF`.

L'entitlement `com.apple.developer.applesignin = Default` est déjà présent dans le projet Xcode.

## Supabase Auth

Dans **Authentication > Providers > Apple** :

- activer le provider Apple ;
- ajouter `com.kidiplus.app` dans **Client IDs** ;
- si la connexion Apple web reste active, conserver son **Services ID en première position**, puis
  ajouter `com.kidiplus.app`. Supabase utilise le premier identifiant pour le flux web et accepte
  tous les identifiants de la liste pour le flux natif.

## Secrets du serveur kidiplus.com

Ajouter ces secrets dans l'environnement de production qui sert `/api/account/delete` :

```text
APPLE_CLIENT_ID=com.kidiplus.app
APPLE_TEAM_ID=6XW2XM3NDF
APPLE_KEY_ID=<Key ID de la clé Apple>
APPLE_PRIVATE_KEY=<contenu complet du fichier .p8>
```

Si l'hébergeur gère mal les valeurs multilignes, utiliser à la place
`APPLE_PRIVATE_KEY_BASE64`, contenant le fichier `.p8` encodé en base64. Ne jamais placer la clé
privée dans l'application, dans Git ou dans une variable commençant par `EXPO_PUBLIC_`.

## Vérification sur un vrai iPhone

1. Accepter les conditions et la confirmation 18+.
2. Appuyer sur **Se connecter avec Apple** ou **S'inscrire avec Apple**.
3. Tester une première inscription avec partage de l'adresse, puis une autre avec
   **Masquer mon adresse e-mail**.
4. Se déconnecter puis se reconnecter : le nom doit rester présent même si Apple ne le renvoie plus.
5. Dans les paramètres, lancer la suppression du compte Apple. Si la confirmation Apple est annulée
   ou si la révocation serveur échoue, le compte ne doit pas être supprimé.

La feuille Apple native et l'état de l'autorisation doivent être testés sur un appareil physique ;
le simulateur ne reproduit pas tous les comportements du compte Apple.
