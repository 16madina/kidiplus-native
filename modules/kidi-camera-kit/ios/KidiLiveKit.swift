#if canImport(LiveKit)
import LiveKit
#elseif canImport(LiveKitClient)
import LiveKitClient
#else
#error("KidiCameraKit needs the LiveKit Swift SDK. CocoaPods module name is LiveKitClient (pod LiveKitClient), not LiveKit. Add source https://github.com/livekit/podspecs.git and the LiveKitClient dependency.")
#endif

/// Compile-time proof that BufferCapturer / Room are available.
enum KidiLiveKit {
    static let linked = true
}
