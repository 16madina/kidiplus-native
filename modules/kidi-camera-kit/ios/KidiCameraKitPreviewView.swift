import ExpoModulesCore
import UIKit

/// React Native host for Snap Camera Kit's `PreviewView`.
/// The session moves its PreviewView into this ExpoView so AR lenses are
/// visible inside the RN tree (unlike Capacitor, where the WebView is punched
/// through to reveal a window-backed preview).
public final class KidiCameraKitPreviewView: ExpoView {
  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    clipsToBounds = true
    isUserInteractionEnabled = true
    KidiCameraKitSession.shared.registerPreviewHost(self)
  }

  deinit {
    KidiCameraKitSession.shared.unregisterPreviewHost(self)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    KidiCameraKitSession.shared.layoutPreview(in: bounds)
  }
}
