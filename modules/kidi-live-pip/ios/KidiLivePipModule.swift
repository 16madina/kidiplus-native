import ExpoModulesCore
import UIKit

/// JS `{ enabled, url?, token? }` — Expo `Record` (not `[String: Any]`,
/// which breaks the ModuleDefinition result builder).
struct LivePipEnableOptions: Record {
  @Field var enabled: Bool = false
  @Field var url: String?
  @Field var token: String?
}

enum LivePipHost {
  static func keyWindowRootView() -> UIView? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let windows = scenes.flatMap(\.windows)
    let key = windows.first(where: \.isKeyWindow) ?? windows.first
    return key?.rootViewController?.view
  }
}

/// Expo bridge replacing the Capacitor `LivePipPlugin`.
/// Same surface: setEnabled({enabled, url, token}), enter, dismiss, isSupported, isActive.
public class KidiLivePipModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KidiLivePip")

    Events("onPipModeChange", "onPipPrepare")

    OnCreate {
      self.attachToRootIfPossible()
      LivePipSession.shared.setModeListener { [weak self] active in
        self?.sendEvent("onPipModeChange", ["active": active])
      }
    }

    OnDestroy {
      LivePipSession.shared.setModeListener(nil)
      Task { _ = await LivePipSession.shared.dismiss() }
    }

    AsyncFunction("setEnabled") { (options: LivePipEnableOptions) -> [String: Any] in
      self.attachToRootIfPossible()
      await LivePipSession.shared.setEligible(
        options.enabled,
        url: options.url,
        token: options.token
      )
      return ["enabled": options.enabled]
    }

    AsyncFunction("enter") { () -> Bool in
      await MainActor.run {
        LivePipSession.shared.startPipIfPossible()
        return LivePipSession.shared.isInPip
      }
    }

    AsyncFunction("dismiss") { () -> Bool in
      await LivePipSession.shared.dismiss()
    }

    Function("isSupported") {
      LivePipSession.shared.isSupported
    }

    Function("isActive") {
      LivePipSession.shared.isInPip
    }

    Function("isInPip") {
      LivePipSession.shared.isInPip
    }
  }

  private func attachToRootIfPossible() {
    guard let view = LivePipHost.keyWindowRootView() else { return }
    LivePipSession.shared.attach(to: view)
  }
}
