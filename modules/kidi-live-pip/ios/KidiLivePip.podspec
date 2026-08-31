require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'KidiLivePip'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license'] || 'UNLICENSED'
  s.author         = package['author'] || 'KiDi+'
  s.homepage       = package['homepage'] || 'https://kidiplus.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/kidiplus/app.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # CocoaPods module name is LiveKitClient (Swift `import LiveKitClient`).
  # Requires source https://github.com/livekit/podspecs.git (plugins/withLiveKitIos.js).
  s.dependency 'LiveKitClient', '~> 2.6'

  s.frameworks = 'AVKit', 'AVFoundation', 'UIKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
