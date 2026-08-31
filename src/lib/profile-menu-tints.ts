/** Same menu-icon tints as kidiplus.com (oklch → sRGB hex). */
export const PROFILE_MENU_TINT = {
  shop: "#DE3E2D",
  delivery: "#00878F",
  certify: "#CB8A00",
  wallet: "#CA8A10",
  earnings: "#009C50",
  payouts: "#009C50",
  orders: "#0081F1",
  address: "#009C50",
  referral: "#E65F2A",
  admin: "#1F2D4C",
  edit: "#0081F1",
  settings: "#70707D",
  discover: "#CD7A00",
  darkMode: "#393945",
  help: "#8156C0",
  signOut: "#EE0F1F",
} as const;

export type ProfileMenuTint = (typeof PROFILE_MENU_TINT)[keyof typeof PROFILE_MENU_TINT];
