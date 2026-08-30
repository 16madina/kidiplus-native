import CoreMedia

/// Camera Kit calls this to compose green-screen / poster on the SAME
/// frames it already publishes. Returns nil to keep the original buffer.
public enum KidiPublishedCompose {
  public static func process(_ sample: CMSampleBuffer) -> CMSampleBuffer? {
    KidiLiveEffectsSession.shared.composePublished(sample)
  }

  public static var isEnabled: Bool {
    KidiLiveEffectsSession.shared.isPublishComposeEnabled
  }
}
