import ExpoModulesCore
import UIKit

public final class KidiLiveEffectsPreviewView: ExpoView {
  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    clipsToBounds = true
    KidiLiveEffectsSession.shared.registerPreviewHost(self)
  }

  deinit {
    KidiLiveEffectsSession.shared.unregisterPreviewHost(self)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    KidiLiveEffectsSession.shared.layoutPreview(in: bounds)
  }
}
