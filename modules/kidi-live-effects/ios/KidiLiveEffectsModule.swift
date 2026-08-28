import ExpoModulesCore
import UIKit

/// JS config object for start / setConfig (Expo `Record`, not `[String: Any]` —
/// the latter makes the ModuleDefinition result builder fail to type-check).
struct LiveEffectsNativeConfig: Record {
  @Field var backgroundUrl: String?
  @Field var backgroundMode: String = "none"
  @Field var posterUrl: String?
  @Field var posterMode: String = "off"
  @Field var posterX: Double = 0.5
  @Field var posterY: Double = 0.4
  @Field var posterScale: Double = 1
  @Field var mirror: Bool = true
  @Field var facing: String = "user"

  func asDictionary() -> [String: Any] {
    var d: [String: Any] = [
      "backgroundMode": backgroundMode,
      "posterMode": posterMode,
      "posterX": posterX,
      "posterY": posterY,
      "posterScale": posterScale,
      "mirror": mirror,
      "facing": facing,
    ]
    if let backgroundUrl { d["backgroundUrl"] = backgroundUrl }
    if let posterUrl { d["posterUrl"] = posterUrl }
    return d
  }
}

public class KidiLiveEffectsModule: Module {
  private let session = KidiLiveEffectsSession.shared

  public func definition() -> ModuleDefinition {
    Name("KidiLiveEffects")

    Events("unavailable", "firstFrame")

    OnCreate {
      self.session.onUnavailable = { [weak self] in
        let payload: [String: Any?] = [:]
        self?.sendEvent("unavailable", payload)
      }
      self.session.onFirstFrame = { [weak self] in
        let payload: [String: Any?] = [:]
        self?.sendEvent("firstFrame", payload)
      }
    }

    OnDestroy {
      self.session.onUnavailable = nil
      self.session.onFirstFrame = nil
    }

    AsyncFunction("warmup") { (promise: Promise) in
      self.session.warmup { ok in
        promise.resolve(["supported": ok])
      }
    }

    AsyncFunction("start") { (config: LiveEffectsNativeConfig, promise: Promise) in
      self.session.start(config: config.asDictionary()) { started in
        promise.resolve(["started": started])
      }
    }

    AsyncFunction("setConfig") { (config: LiveEffectsNativeConfig, promise: Promise) in
      self.session.setConfig(config.asDictionary()) {
        promise.resolve(["updated": true])
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      self.session.stop {
        promise.resolve(["stopped": true])
      }
    }

    View(KidiLiveEffectsPreviewView.self) {}
  }
}
