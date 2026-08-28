# Camera Kit (Snap) — état d'intégration Expo native
#
# Config déjà en place (parité tokens avec kidiplus.com Capacitor) :
# - EXPO_PUBLIC_SNAP_CAMERA_KIT_API_TOKEN (+ fallback production embarqué)
# - EXPO_PUBLIC_SNAP_LENS_GROUP_ID = df287f43-6646-4b01-a711-1a0e632c211a
# - Info.plist SCCameraKitAPIToken / SCCameraKitLensGroupID via app.json + withCameraKitPlist
# - FilterProvider, FiltersCarousel (setup + HUD live), bridge JS → NativeModules.KidiCameraKit
#
# Encore à faire pour les vrais filtres AR publiés sur LiveKit :
# 1. Module Expo natif `KidiCameraKit` (porter ios/.../KidiCameraKitPlugin.swift
#    et android/.../KidiCameraKitPlugin.kt depuis kidiplus Capacitor)
# 2. Lier SCSDKCameraKit (SPM) + camerakit Android 1.50+
# 3. Capturer LiveKit custom (BufferCapturer / VideoCapturer) à la place de setCameraEnabled
# 4. `npx expo prebuild` + build appareil physique (pas simulateur)
#
# Jusqu'à ce module, le carrousel charge les styles locaux et affiche
# « rebuild natif requis » pour les lenses Snap.
