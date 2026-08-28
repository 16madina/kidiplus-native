# kidiplus-native

Version **native** de [KiDi+](https://kidiplus.com) (React Native / Expo).

Bundle ID store : `com.kidiplus.app` (même listing App Store / Play Store que Capacitor — mise à jour, pas une 2ᵉ app).

Firebase : réutiliser les configs du projet `kidiplus-a079a` (`GoogleService-Info.plist` / `google-services.json`).

## Lancer

```bash
npm install
npx expo start
```

Build device (push / LiveKit / Stripe) :

```bash
npx expo run:ios --device
```

Optionnel : copie `.env.example` vers `.env` si tu changes d’URL / clé anon.

- `npm run web` — aperçu web
- `npm run android` / `npm run ios` — Expo Go ou build natif

## Palette

- Navy `#10162B`
- Or `#E8B93B` / `#F5C34A`
