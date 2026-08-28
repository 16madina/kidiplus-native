import ExpoModulesCore
import UIKit

public class KidiLiveEffectsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KidiLiveEffects")

    Events("unavailable", "firstFrame")

    OnCreate {
      KidiLiveEffectsSession.shared.onUnavailable = { [weak self] in
        self?.sendEvent("unavailable", [:])
      }
      KidiLiveEffectsSession.shared.onFirstFrame = { [weak self] in
        self?.sendEvent("firstFrame", [:])
      }
    }

    OnDestroy {
      KidiLiveEffectsSession.shared.onUnavailable = nil
      KidiLiveEffectsSession.shared.onFirstFrame = nil
    }

    View(KidiLiveEffectsPreviewView.self)

    AsyncFunction("warmup") { (promise: Promise) in
      KidiLiveEffectsSession.shared.warmup { ok in
        promise.resolve(["supported": ok])
      }
    }

    AsyncFunction("start") { (config: [String: Any], promise: Promise) in
      KidiLiveEffectsSession.shared.start(config: config) { started in
        promise.resolve(["started": started])
      }
    }

    AsyncFunction("setConfig") { (config: [String: Any], promise: Promise) in
      KidiLiveEffectsSession.shared.setConfig(config) {
        promise.resolve(["updated": true])
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      KidiLiveEffectsSession.shared.stop {
        promise.resolve(["stopped": true])
      }
    }
  }
}
