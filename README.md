# kidiplus-native

Version **native** de [KiDi+](https://kidiplus.com) (React Native / Expo).

Bundle temporaire : `com.kidiplus.native`.

Cette app recrée le UI de KiDi+ avec **auth Superbase réelle** (même projet que le site : email / mot de passe, session persistée). Lives, portefeuille, commandes, studio restent **mock**.

L’app Capacitor existante (`com.kidiplus.app`, repo `16madina/kidiplus`) n’est **pas** modifiée.

## Lancer

```bash
npm install
npx expo start
```

Optionnel : copie `.env.example` vers `.env` si tu changes d’URL / clé anon.

- `npm run web` — aperçu web
- `npm run android` / `npm run ios` — Expo Go ou build natif

## Palette

- Navy `#10162B`
- Or `#E8B93B` / `#F5C34A`
