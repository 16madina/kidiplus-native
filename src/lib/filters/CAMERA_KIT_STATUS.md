# Snap Camera Kit — rebuild natif (filtres AR)

Les lenses Snap AR ne marchent **pas** dans Expo Go. Il faut un binary qui
lie le module `modules/kidi-camera-kit` (SCSDKCameraKit).

## iPhone (Mac + Xcode)

```bash
cd ~/kidiplus-native
git pull
npm install
npm run rebuild:ios
```

Équivalent :

```bash
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

Choisis ton iPhone dans la liste. Si l’appareil est « busy », débranche /
rebranche, attends 30s, relance.

## Après le rebuild

1. Ouvre **Lancer un live** (setup).
2. Tu dois voir la preview Snap (pas expo-camera).
3. Tape **Filtre** → carrousel des lenses du groupe `df287f43-…`.
4. Applique une lens : AR visible sur ton visage.
5. Dans la console Xcode, tu dois voir `[KidiCameraKit] LiveKit video published frames=` avec un compteur qui monte. Les autres voient alors le filtre **dans** la vidéo (même une vieille app).

Si le carrousel dit encore « rebuild natif requis », le module n’est pas
dans le binary → refais `npm run rebuild:ios` (pas seulement `expo start`).

## Android

```bash
npm run rebuild:android
```
