# KiDi+ — checklist App Store Connect

Ce document accompagne chaque build iOS. Il ne remplace pas les réponses à saisir manuellement dans App Store Connect.

## Confidentialité et ATT

- Répondre **Non** à « Utilisez-vous les données à des fins de suivi ? » tant qu'aucune donnée n'est reliée à des données tierces pour de la publicité, du courtage de données ou du ciblage inter-apps.
- Ne pas déclarer ATT et ne pas afficher de demande ATT dans cette configuration. Le projet définit `NSPrivacyTracking` à `false` et ne contient plus `NSUserTrackingUsageDescription`.
- Déclarer comme **liées à l'utilisateur**, **non utilisées pour le suivi**, selon les fonctions réellement actives :
  - coordonnées : nom, courriel, téléphone, adresse postale ;
  - identifiants : identifiant utilisateur et jeton/appareil de notification ;
  - achats : historique des achats, ventes, retraits et portefeuille ;
  - contenu utilisateur : photos, vidéos, audio de live, messages, commentaires et demandes au support ;
  - utilisation : interactions avec le produit, pour le fonctionnement et les statistiques internes ;
  - localisation approximative : pays du compte ou région dérivée de l'adresse IP, sans GPS précis.
- Vérifier à chaque mise à jour les pratiques propres à Supabase, LiveKit, Stripe, Firebase/APNs et Snap Camera Kit. Si l'un de ces fournisseurs commence à suivre l'utilisateur, mettre à jour le manifeste, la politique et App Store Connect avant le build.
- Vérifier que la politique publique accessible depuis la fiche App Store décrit les mêmes catégories, finalités, durées et sous-traitants.

## Capacités iOS

- `Sign in with Apple` doit être activé pour l'identifiant `com.kidiplus.app` et pour le profil de signature.
- Les modes d'arrière-plan attendus sont uniquement `audio` et `remote-notification`. Ne pas réactiver `voip` sans fonctionnalité VoIP conforme.
- Vérifier caméra, microphone, photothèque, Face ID et notifications sur un iPhone physique avec un build Release.
- Vérifier que Picture in Picture continue de fonctionner avec l'app en arrière-plan, après appel entrant, verrouillage/déverrouillage et retour dans le live.

## Comptes et contenu utilisateur

- Fournir à Apple un compte de démonstration fonctionnel et des instructions permettant de tester un live hôte et un live viewer.
- La suppression du compte doit être accessible dans l'app, sans contacter le support, sauf lorsqu'un solde, un retrait, une commande ou un live actif doit d'abord être résolu.
- Vérifier avant soumission : signaler un contenu, bloquer/débloquer un utilisateur, filtrage préventif du texte, action administrateur et adresse de support valide.
- Ne pas déclarer que les images, vidéos ou lives sont modérés automatiquement tant qu'un service de modération média n'est pas déployé.

## Paiements et backend

- Le secret `STRIPE_WEBHOOK_SECRET` doit être défini dans l'environnement Supabase de production.
- Le endpoint Stripe doit pointer vers la fonction `connect-webhook` de production et écouter `account.updated`.
- Déployer les migrations avant les fonctions Edge afin que `reject_payout_and_refund` existe lors d'un remboursement.
- Exécuter un événement Stripe signé de test, puis un événement sans signature : le premier doit être accepté, le second rejeté avec HTTP 400.
- Tester un retrait réussi, un retrait refusé et deux requêtes simultanées sur le même retrait. Un seul remboursement doit être crédité.

## Validation finale du build

1. `npm ci`
2. `npm run lint`
3. `npx expo-doctor`
4. Exécuter tous les fichiers `*.test.ts`.
5. Construire un archive Release dans Xcode avec le scheme `KiDi`.
6. Tester sur iPhone : inscription, Apple/Google, suppression de compte, live hôte/viewer, PiP, achat physique, retrait, signalement et blocage.
7. Envoyer d'abord à TestFlight interne et vérifier les crashs, blocages réseau et journaux backend.

## Références officielles

- Apple App Review Guidelines : https://developer.apple.com/app-store/review/guidelines/
- Apple Privacy Details : https://developer.apple.com/app-store/app-privacy-details/
- Apple privacy manifests : https://developer.apple.com/documentation/bundleresources/privacy_manifest_files
- Suppression de compte : https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Révocation Sign in with Apple : https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple
