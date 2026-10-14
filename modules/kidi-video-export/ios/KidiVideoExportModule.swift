import AVFoundation
import ExpoModulesCore

struct VideoExportOptions: Record {
  @Field var uri: String = ""
}

enum VideoExportError: LocalizedError {
  case badUri
  case noVideoTrack
  case sessionUnavailable
  case failed(String)

  var errorDescription: String? {
    switch self {
    case .badUri: return "Invalid video uri"
    case .noVideoTrack: return "No video track"
    case .sessionUnavailable: return "Export session unavailable"
    case .failed(let reason): return reason
    }
  }
}

/// Center-crops any video to 9:16 and re-encodes it as 720x1280 H.264.
enum PortraitVideoExporter {
  static let outputSize = CGSize(width: 720, height: 1280)
  static let targetBitsPerSecond = 2_500_000 + 128_000

  static func export(uri: String) async throws -> [String: Any] {
    guard let url = URL(string: uri) ?? URL(string: "file://" + uri) else {
      throw VideoExportError.badUri
    }
    let asset = AVURLAsset(url: url)
    guard let track = try await asset.loadTracks(withMediaType: .video).first else {
      throw VideoExportError.noVideoTrack
    }
    let naturalSize = try await track.load(.naturalSize)
    let preferred = try await track.load(.preferredTransform)
    let duration = try await asset.load(.duration)
    let fps = try await track.load(.nominalFrameRate)

    // Frame as displayed (rotation applied), moved back to the origin.
    let oriented = CGRect(origin: .zero, size: naturalSize).applying(preferred)
    let sourceW = abs(oriented.width)
    let sourceH = abs(oriented.height)
    guard sourceW > 0, sourceH > 0 else { throw VideoExportError.noVideoTrack }

    // "Cover": fill the 9:16 frame, cropping what overflows, centered.
    let scale = max(outputSize.width / sourceW, outputSize.height / sourceH)
    let transform = preferred
      .concatenating(CGAffineTransform(translationX: -oriented.minX, y: -oriented.minY))
      .concatenating(CGAffineTransform(scaleX: scale, y: scale))
      .concatenating(
        CGAffineTransform(
          translationX: (outputSize.width - sourceW * scale) / 2,
          y: (outputSize.height - sourceH * scale) / 2
        )
      )

    let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
    layer.setTransform(transform, at: .zero)
    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
    instruction.layerInstructions = [layer]

    let composition = AVMutableVideoComposition()
    composition.renderSize = outputSize
    composition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(min(max(fps.rounded(), 24), 30)))
    composition.instructions = [instruction]

    guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else {
      throw VideoExportError.sessionUnavailable
    }
    let output = FileManager.default.temporaryDirectory
      .appendingPathComponent("kidi-export-\(UUID().uuidString).mp4")
    session.videoComposition = composition
    session.outputURL = output
    session.outputFileType = .mp4
    session.shouldOptimizeForNetworkUse = true
    // The preset alone can reach ~8 Mbps on busy footage; cap the file at ~2.5 Mbps video + audio.
    session.fileLengthLimit = Int64(max(1, duration.seconds) * Double(targetBitsPerSecond) / 8)

    await session.export()
    guard session.status == .completed else {
      try? FileManager.default.removeItem(at: output)
      throw VideoExportError.failed(session.error?.localizedDescription ?? "Export failed")
    }
    let attributes = try? FileManager.default.attributesOfItem(atPath: output.path)
    let size = (attributes?[.size] as? NSNumber)?.intValue ?? 0
    return [
      "uri": output.absoluteString,
      "width": Int(outputSize.width),
      "height": Int(outputSize.height),
      "size": size,
    ]
  }
}

public class KidiVideoExportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KidiVideoExport")

    AsyncFunction("exportPortrait") { (options: VideoExportOptions, promise: Promise) in
      Task {
        do {
          promise.resolve(try await PortraitVideoExporter.export(uri: options.uri))
        } catch {
          promise.reject("ERR_VIDEO_EXPORT", error.localizedDescription)
        }
      }
    }
  }
}
