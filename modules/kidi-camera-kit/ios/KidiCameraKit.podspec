require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'KidiCameraKit'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license'] || 'UNLICENSED'
  s.author         = package['author'] || 'KiDi+'
  s.homepage       = package['homepage'] || 'https://kidiplus.com'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/kidiplus/app.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Snap Camera Kit (SCSDKCameraKit). The CocoaPods pod is published under the
  # name `SCCameraKit` on the main trunk (no extra spec repo needed) even
  # though the Swift import is `SCSDKCameraKit` — see
  # https://developers.snap.com/camera-kit/integrate-sdk/ios/ios-configuration.
  # If Camera Kit is instead linked via Swift Package Manager (e.g. through an
  # Expo config plugin adding
  # https://github.com/Snapchat/camera-kit-ios-sdk as a remote package), REMOVE
  # this line — do not link the SDK through both CocoaPods and SPM at once.
  s.dependency 'SCCameraKit'

  # LiveKit Swift Client SDK (the native `client-sdk-swift`, distinct from the
  # `@livekit/react-native` JS package already used elsewhere in this app —
  # KidiCameraKitSession talks to Camera Kit + LiveKit directly in Swift via
  # `import LiveKit`, bypassing the RN bridge for the live-publish path).
  #
  # NOT declared as an active `s.dependency` here — left commented out and
  # documented as SPM-only, because (unlike SCCameraKit above) it cannot be
  # resolved as a drop-in CocoaPods dependency:
  #  1. LiveKit has deprecated CocoaPods support entirely (the trunk +
  #     livekit/podspecs repos become read-only in 2027) and recommends
  #     Swift Package Manager instead:
  #     https://github.com/livekit/client-sdk-swift/blob/main/Docs/cocoapods.md
  #  2. The published CocoaPods pod is named `LiveKitClient`, not `LiveKit`.
  #     Its default Swift module name is therefore also `LiveKitClient`, so
  #     `import LiveKit` in KidiCameraKitSession.swift would NOT compile
  #     against this pod — only against the SPM package (whose product name
  #     is `LiveKit`).
  #  3. `LiveKitClient`'s own dependencies (`LiveKitWebRTC`, `LiveKitUniFFI`)
  #     are hosted in a custom spec repo. A podspec cannot declare an extra
  #     CocoaPods `source`; that must live in the *app's* root Podfile:
  #       source 'https://github.com/livekit/podspecs.git'
  #     Uncommenting the line below without that Podfile change will make
  #     `pod install` fail for the whole workspace, not just this pod.
  #
  # Add client-sdk-swift via Swift Package Manager instead (e.g. an Expo
  # config plugin patching the Xcode project to add
  # https://github.com/livekit/client-sdk-swift as a remote package — the
  # same mechanism used for Camera Kit's SPM package above).
  # s.dependency 'LiveKitClient'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
