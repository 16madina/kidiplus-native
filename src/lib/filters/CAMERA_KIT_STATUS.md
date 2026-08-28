# Camera Kit (Snap) — module Expo natif

## Présent
- Module local `modules/kidi-camera-kit` (iOS Swift + Android Kotlin)
- Token / Lens Group production (Info.plist + Android meta-data)
- JS : `FilterProvider`, `FiltersCarousel`, bridge `kidi-camera-kit`
- Autolinking via `"kidi-camera-kit": "file:./modules/kidi-camera-kit"`
- **iOS** : pas d’`import LiveKit` Swift (évite l’erreur CocoaPods). Preview + lenses Snap OK ; la vidéo live reste publiée par `@livekit/react-native`.

## Rebuild requis (appareil physique)
```bash
git pull
npx expo prebuild --clean
npx expo run:ios --device
```

## iOS deps
- CocoaPods : `SCCameraKit` (via podspec)
- LiveKit Swift SPM **non** requis pour compiler

## Android deps
- `com.snap.camerakit:camerakit:1.50.0` + `support-camerax`
- `io.livekit:livekit-android` (publish natif Android encore dans le module)
- JitPack (config plugin `withCameraKit.js`)
