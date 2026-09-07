# KiDi+ — procédure de modération

## Protection actuellement intégrée

Le client bloque avant envoi les textes à risque élevé dans les profils, lives, produits, publications Vitrine, commentaires, messages privés et chats de live. Une migration Supabase applique les mêmes contrôles côté base afin qu'un client modifié ne puisse pas contourner le filtre.

Les catégories bloquées sont : exploitation sexuelle de mineurs, contenu sexuel explicite à forte confiance, haine ciblée, menaces violentes, incitation au suicide, vente d'armes/drogues/documents illicites et fraude explicite.

Le filtre est volontairement limité aux cas à forte confiance. Il complète les outils existants de signalement, blocage, suspension et retrait administratif ; il ne remplace pas l'examen humain.

## Procédure opérateur

1. Accuser réception immédiatement dans l'app lorsqu'un signalement est créé.
2. Prioriser les menaces imminentes, l'exploitation de mineurs et le risque suicidaire. Interrompre le live ou masquer le contenu sans attendre lorsque le risque est crédible.
3. Examiner les autres signalements dans un délai cible de 24 heures.
4. Conserver une trace interne : contenu visé, motif, décision, modérateur, heure, sanction et éventuel appel.
5. Permettre à l'utilisateur sanctionné de contacter `support@kidiplus.com` pour contester la décision.
6. Signaler aux autorités ou services d'urgence lorsque la loi ou un danger immédiat l'exige. Ne jamais promettre une intervention d'urgence par le support KiDi+.
7. Supprimer les copies de modération à l'expiration de la durée légale/interne annoncée.

## Tests obligatoires

- Un message normal en français et en anglais est publié.
- Une menace explicite est bloquée avant envoi et par la base.
- Un nom de produit proposant une drogue ou un document volé est bloqué.
- Un utilisateur peut signaler un live, un profil, un message et une publication.
- Un utilisateur bloqué disparaît immédiatement des surfaces concernées.
- Un administrateur peut retrouver le signalement, masquer le contenu et suspendre le compte.
- Le support reçoit réellement les courriels envoyés à `support@kidiplus.com`.

## Limite à fermer avant de revendiquer une modération complète

La prévention automatique ajoutée ici couvre le **texte**. Les photos, vidéos, miniatures et flux live nécessitent encore un fournisseur de détection média et/ou une équipe humaine en temps réel. Jusqu'à ce dispositif, la fiche App Store, les CGU et les réponses aux reviewers doivent décrire honnêtement une modération média par signalement et intervention humaine, pas un filtrage automatique préalable.
