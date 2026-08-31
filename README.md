# kidiplus-native

Version **native** de [KiDi+](https://kidiplus.com) (React Native / Expo).

Bundle ID store : `com.kidiplus.app` (même listing App Store / Play Store que Capacitor — mise à jour, pas une 2ᵉ app).

Firebase : réutiliser les configs du projet `kidiplus-a079a` (`GoogleService-Info.plist` / `google-services.json`).

## Lancer (iPhone — pas Expo Go)

Les lives, la caméra LiveKit et les filtres **ne marchent pas dans Expo Go**.
Il faut l’app **KiDi+** installée sur l’iPhone.

```bash
git rebase --abort
git checkout main
git fetch origin main
git reset --hard origin/main
npm run rebuild:ios
```

Xcode installe **KiDi+** sur l’iPhone. Ouvre **cette** icône — jamais Expo Go.

Ensuite, pour recharger le JS sans tout recompiler :

```bash
npm start
```

`npm start` utilise `--dev-client` : Metro parle à KiDi+, pas à Expo Go.
**Ne scanne pas le QR** avec l’appareil photo (ça rouvre Expo Go).

- `npm run web` — aperçu web
- `npm run ios` / `npm run android` — build natif sur l’appareil

Optionnel : copie `.env.example` vers `.env` si tu changes d’URL / clé anon.

## Palette

- Navy `#10162B`
- Or `#E8B93B` / `#F5C34A`
