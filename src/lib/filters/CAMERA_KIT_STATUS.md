# Camera Kit (Snap) — module Expo natif

## Présent
- Module local `modules/kidi-camera-kit` (iOS Swift + Android Kotlin)
- Token / Lens Group production (Info.plist + Android meta-data)
- JS : `FilterProvider`, `FiltersCarousel`, bridge `kidi-camera-kit`
- Autolinking via `"kidi-camera-kit": "file:./modules/kidi-camera-kit"`

## Rebuild requis (appareil physique)
```bash
npx expo prebuild
npx expo run:ios --device
# ou
npx expo run:android --device
```

## iOS deps
- CocoaPods : `SCCameraKit` (via podspec du module)
- LiveKit Swift (`import LiveKit`) : à lier via SPM
  `https://github.com/livekit/client-sdk-swift` (product `LiveKit`)
  — pas encore auto-injecté ; ajouter dans Xcode ou un config plugin SPM
  si `pod install` / build échoue sur `import LiveKit`.

## Android deps (Gradle module)
- `com.snap.camerakit:camerakit:1.50.0` + `support-camerax`
- `io.livekit:livekit-android:2.28.0`
- JitPack (config plugin `withCameraKit.js`)

## Live publish
Le module peut publier via `setPublishEnabled(roomUrl, token)` (salle LiveKit
native dédiée, comme Capacitor). Le host Expo utilise encore
`setCameraEnabled` pour la caméra brute — brancher `setBridgePublishEnabled`
dans `BroadcastLiveHost` une fois le rebuild validé (désactiver la caméra RN
pendant que Camera Kit publie).
