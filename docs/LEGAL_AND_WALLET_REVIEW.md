# KiDi+ — dossier à faire valider par un juriste

Les CGU, la politique de confidentialité et les directives de communauté sont déjà intégrées dans `src/lib/legal-content.ts`. Elles restent des modèles techniques et ne doivent pas être présentées comme un avis juridique validé.

## Informations société à confirmer

- raison sociale exacte de l'exploitant, forme juridique et numéro d'entreprise ;
- adresse officielle et pays d'établissement ;
- nom ou fonction du responsable de la protection des renseignements ;
- adresses `legal@kidiplus.com`, `privacy@kidiplus.com` et `support@kidiplus.com` actives et surveillées ;
- pays réellement desservis, langues contractuelles et règles de consommation applicables.

## Portefeuille, fonds retenus et retraits

Le juriste et le prestataire de paiement doivent confirmer par écrit :

- si le « portefeuille » est un simple registre interne, de la monnaie électronique, un service de paiement ou une activité réglementée dans chaque pays ciblé ;
- qui détient juridiquement les fonds et sur quel compte ;
- si le mot « séquestre/escrow » peut être employé. Stripe Connect n'est pas automatiquement un service d'escrow ; ne pas utiliser cette promesse si le montage n'est pas autorisé ;
- les règles de remboursement, chargeback, réserve, gel, retrait, solde non réclamé et décès/incapacité ;
- les obligations KYC/KYB, AML/CFT, sanctions, limites et déclarations fiscales ;
- la cohérence entre les taux de commission affichés, le code de production et les CGU ;
- les pays/devise autorisés et les entités Stripe correspondantes.

## Contenu et commerce

- valider la liste des produits interdits et réglementés ;
- valider les règles d'enchères, annulation, livraison, retours et protection du consommateur ;
- valider les durées de conservation des vidéos, chats, signalements, pièces KYC et transactions ;
- définir une procédure écrite de retrait de contenu et de recours ;
- vérifier les droits musicaux et audiovisuels pour les lives, replays et restreams.

## Preuves de validation à archiver

- version du document relu et date ;
- nom et coordonnées du professionnel ;
- pays couverts et réserves formulées ;
- décisions prises et modifications appliquées ;
- nouvelle valeur de `TERMS_VERSION` lorsque le texte contractuel change.
