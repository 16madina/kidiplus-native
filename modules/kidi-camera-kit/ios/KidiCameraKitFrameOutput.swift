import AVFoundation
import CoreMedia
import Foundation
import SCSDKCameraKit

/// Reçoit les frames filtrées Camera Kit (CMSampleBuffer).
/// KidiCameraKitSession les envoie au BufferCapturer LiveKit.
final class KidiCameraKitFrameOutput: NSObject, Output, OutputRequiringPixelBuffer {
    var currentlyRequiresPixelBuffer: Bool = true {
        didSet {
            if currentlyRequiresPixelBuffer != oldValue {
                delegate?.outputChangedRequirements(self)
            }
        }
    }

    weak var delegate: SCCameraKitOutputRequiringPixelBufferDelegate?
    private(set) var didEmitFrame = false
    var onFirstFrame: (() -> Void)?
    var onSampleBuffer: ((CMSampleBuffer) -> Void)?

    func resetFrameFlag() {
        didEmitFrame = false
    }

    func cameraKit(_ cameraKit: CameraKitProtocol, didOutputTexture texture: Texture) {
        // PreviewView consomme les textures.
    }

    func cameraKit(_ cameraKit: CameraKitProtocol, didOutputVideoSampleBuffer sampleBuffer: CMSampleBuffer) {
        onSampleBuffer?(sampleBuffer)
        if !didEmitFrame {
            didEmitFrame = true
            onFirstFrame?()
        }
    }

    func cameraKit(_ cameraKit: CameraKitProtocol, didOutputAudioSampleBuffer sampleBuffer: CMSampleBuffer) {
        // Mic géré côté LiveKit React Native.
    }
}
