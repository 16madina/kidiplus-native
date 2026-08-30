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

  # Snap Camera Kit — CocoaPods trunk pod name is `SCCameraKit`
  # (Swift import remains `SCSDKCameraKit`).
  s.dependency 'SCCameraKit'

  # Same as kidiplus.com iOS: Camera Kit frames → LiveKit BufferCapturer.
  # Requires the LiveKit podspecs source (see plugins/withLiveKitIos.js).
  s.dependency 'LiveKitClient', '~> 2.2'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
