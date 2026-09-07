# KiDi+ — état des corrections de l'audit

Date technique : 2026-09-07

## Corrigé dans le dépôt

- Modération préventive des textes dans les profils, lives, produits, Vitrine, commentaires, messages privés et chats, avec garde-fou SQL.
- Confirmation d'âge 18+ avant l'accès invité ou l'authentification.
- Webhook Stripe fermé par défaut : méthode POST, secret obligatoire, signature obligatoire et vérification cryptographique systématique.
- Remboursement de retrait atomique en base, protégé contre les doubles crédits concurrents.
- Expo Doctor : suppression de l'ancienne configuration splash et ajout de `react-native-worklets`.
- ATT et confidentialité : suppression de la demande ATT injustifiée, `NSPrivacyTracking=false`, manifeste de données, retrait du mode `voip`.
- Sign in with Apple : capacité iOS et bouton Apple natif.
- Suppression de compte : contrôle préalable obligatoire, bouton bloqué si le contrôle échoue, aide pour les blocages et procédure de révocation Apple.
- Profils EAS development/preview/production.

## À déployer/configurer avant production

- Appliquer `supabase/migrations/20260906120000_content_moderation_and_payout_safety.sql`.
- Déployer `connect-webhook` et `connect-payout` après la migration.
- Définir `STRIPE_WEBHOOK_SECRET` dans Supabase et vérifier l'URL/signature depuis Stripe Dashboard.
- Saisir manuellement les réponses de confidentialité dans App Store Connect selon `APP_STORE_SUBMISSION_CHECKLIST.md`.
- Confirmer dans Apple Developer que Sign in with Apple est actif sur l'App ID et le profil de distribution.

## Blocages externes ou validation humaine

- La révocation Apple automatique complète exige que le backend obtienne et conserve de façon sécurisée un jeton Apple révocable. Le flux OAuth actuel ne fournit pas cette garantie au client ; l'app affiche donc la procédure manuelle après suppression. Le backend web doit être étendu avec les secrets Apple avant de pouvoir annoncer une révocation automatique.
- La modération préventive automatique couvre le texte, pas encore les images, vidéos et le flux audiovisuel live. Ces médias reposent sur le signalement et l'intervention humaine jusqu'au déploiement d'un fournisseur spécialisé.
- Les CGU, la politique de confidentialité et le modèle portefeuille/séquestre doivent être validés par un juriste et par le prestataire de paiement. Stripe Connect ne doit pas être décrit comme un séquestre réglementé sans confirmation écrite.
- App Store Connect, Apple Developer, Stripe et Supabase sont des environnements externes : les modifications du dépôt ne les configurent pas automatiquement.

## Vérifications exécutées

- TypeScript : réussi.
- Expo Doctor : 21/21 contrôles réussis.
- Tests automatisés : 47/47 réussis.
- Export JavaScript iOS : réussi.
- CocoaPods : 150 pods installés.
- Build Xcode `KiDi` sur la destination `iPhone deena` : réussi.
- Audit npm production : aucune vulnérabilité haute ou critique ; 13 alertes modérées transitives liées principalement à la chaîne Expo/Xcode. Ne pas appliquer `npm audit fix --force`, qui rétrograderait des dépendances Expo incompatibles.
