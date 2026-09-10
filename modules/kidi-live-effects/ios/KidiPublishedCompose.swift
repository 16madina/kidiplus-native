import CoreMedia
import UIKit

/// Camera Kit calls this to compose green-screen / poster on the SAME
/// frames it already publishes. Returns nil to keep the original buffer.
public enum KidiPublishedCompose {
  public static func process(_ sample: CMSampleBuffer) -> CMSampleBuffer? {
    KidiLiveEffectsSession.shared.composePublished(sample)
  }

  /// Keep the host preview in the same native hierarchy as Camera Kit.
  /// A separate Expo/Fabric sibling could turn opaque during a conditional
  /// mount and cover Snap with a black surface even though LiveKit continued
  /// to receive correctly composed frames.
  public static func registerPreviewHost(_ host: UIView) {
    KidiLiveEffectsSession.shared.registerPreviewHost(host)
  }

  public static func unregisterPreviewHost(_ host: UIView) {
    KidiLiveEffectsSession.shared.unregisterPreviewHost(host)
  }

  public static func layoutPreview(in bounds: CGRect) {
    KidiLiveEffectsSession.shared.layoutPreview(in: bounds)
  }

  public static var isEnabled: Bool {
    KidiLiveEffectsSession.shared.isPublishComposeEnabled
  }
}
