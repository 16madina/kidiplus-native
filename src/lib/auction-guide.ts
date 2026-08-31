/** Buyer tutorial: how to bid on a KiDi+ live (Découvrir). */

export type AuctionGuideStep = {
  id: string;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
};

export const AUCTION_GUIDE_STEPS: AuctionGuideStep[] = [
  {
    id: "open",
    titleFr: "Ouvre un live",
    titleEn: "Open a live",
    bodyFr:
      "Dans Accueil, tape sur une carte EN DIRECT. Tu vois le vendeur, le chat, et le produit en vedette.",
    bodyEn:
      "On Home, tap a LIVE card. You see the seller, the chat, and the featured product.",
  },
  {
    id: "wallet",
    titleFr: "Recharge ton portefeuille",
    titleEn: "Top up your wallet",
    bodyFr:
      "Les enchères se paient avec le portefeuille KiDi+ (carte). Ajoute de l’argent avant d’enchérir — pas de paiement hors app.",
    bodyEn:
      "Bids are paid from the KiDi+ wallet (card). Add money before bidding — never pay outside the app.",
  },
  {
    id: "address",
    titleFr: "Ajoute une adresse",
    titleEn: "Add a delivery address",
    bodyFr:
      "Sans adresse de livraison, tu ne peux pas enchérir. Vérifie aussi que le vendeur livre dans ton pays.",
    bodyEn:
      "Without a delivery address you cannot bid. Also check that the seller ships to your country.",
  },
  {
    id: "bid",
    titleFr: "Tape le bouton or",
    titleEn: "Tap the gold button",
    bodyFr:
      "Quand une enchère tourne, le bouton or propose le prochain prix. Un tap = une enchère. Tu peux aussi choisir un montant.",
    bodyEn:
      "When an auction is live, the gold button shows the next price. One tap = one bid. You can also pick an amount.",
  },
  {
    id: "snipe",
    titleFr: "Les 10 dernières secondes",
    titleEn: "The last 10 seconds",
    bodyFr:
      "Une enchère dans les 10 dernières secondes relance le chrono (mort subite). Le dernier à enchérir gagne.",
    bodyEn:
      "A bid in the last 10 seconds resets the timer (sudden death). The last bidder wins.",
  },
  {
    id: "win",
    titleFr: "Si tu gagnes",
    titleEn: "If you win",
    bodyFr:
      "Le montant est débité de ton portefeuille. Le vendeur reçoit 90 %, KiDi+ 10 %. Tu suis la commande dans Commandes.",
    bodyEn:
      "The amount is taken from your wallet. The seller gets 90%, KiDi+ 10%. Track the order in Orders.",
  },
];

export function auctionGuideCopy(step: AuctionGuideStep, lang: string): { title: string; body: string } {
  const en = lang.toLowerCase().startsWith("en");
  return {
    title: en ? step.titleEn : step.titleFr,
    body: en ? step.bodyEn : step.bodyFr,
  };
}
