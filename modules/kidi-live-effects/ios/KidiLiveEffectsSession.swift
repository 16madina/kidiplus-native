import AVFoundation
import CoreImage
import CoreVideo
import ExpoModulesCore
import UIKit
import Vision

/// Native virtual-background compositor matching kidiplus.com:
/// Vision person mask → EMA 0.55/0.45 → feather blur → source-over person
/// on blurred camera or replacement image + optional poster.
final class KidiLiveEffectsSession: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
  static let shared = KidiLiveEffectsSession()

  private let session = AVCaptureSession()
  private let videoOut = AVCaptureVideoDataOutput()
  private let queue = DispatchQueue(label: "com.kidiplus.liveeffects.capture")
  private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

  private var deviceInput: AVCaptureDeviceInput?
  private var previewHost: UIView?
  private let preview = UIImageView()
  private var running = false

  private var backgroundMode = "none"
  private var backgroundImage: CIImage?
  private var backgroundUrl: String?
  private var posterImage: CIImage?
  private var posterUrl: String?
  private var posterMode = "off"
  private var posterX: CGFloat = 0.5
  private var posterY: CGFloat = 0.4
  private var posterScale: CGFloat = 1
  private var mirror = true
  private var facing: AVCaptureDevice.Position = .front

  private var prevAlpha: [Float]?
  private var maskW = 0
  private var maskH = 0
  private var ladderIndex = 0
  private let ladder: [CGFloat] = [720, 540, 400]
  private var lastTs: CFTimeInterval = 0
  private var slowFrames = 0
  private var fastFrames = 0
  private var disabled = false
  var onUnavailable: (() -> Void)?
  var onFirstFrame: (() -> Void)?
  private var didEmitFirstFrame = false

  private override init() {
    super.init()
    preview.contentMode = .scaleAspectFill
    preview.backgroundColor = .black
    preview.clipsToBounds = true
    videoOut.alwaysDiscardsLateVideoFrames = true
    videoOut.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ]
    videoOut.setSampleBufferDelegate(self, queue: queue)
  }

  func registerPreviewHost(_ host: UIView) {
    DispatchQueue.main.async {
      self.previewHost = host
      self.preview.removeFromSuperview()
      host.addSubview(self.preview)
      self.preview.frame = host.bounds
      self.preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    }
  }

  func unregisterPreviewHost(_ host: UIView) {
    DispatchQueue.main.async {
      if self.previewHost === host {
        self.preview.removeFromSuperview()
        self.previewHost = nil
      }
    }
  }

  func layoutPreview(in bounds: CGRect) {
    preview.frame = bounds
  }

  private static func mirrorImage(_ image: CIImage) -> CIImage {
    let extent = image.extent
    return image
      .transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -extent.width, y: 0))
      .cropped(to: extent)
  }

  func warmup(completion: @escaping (Bool) -> Void) {
    DispatchQueue.main.async { completion(!self.disabled) }
  }

  func start(config: [String: Any], completion: @escaping (Bool) -> Void) {
    applyConfig(config)
    didEmitFirstFrame = false
    queue.async {
      self.configureSession()
      if !self.session.isRunning {
        self.session.startRunning()
      }
      self.running = true
      DispatchQueue.main.async { completion(true) }
    }
  }

  func setConfig(_ config: [String: Any], completion: @escaping () -> Void) {
    let previousFacing = facing
    applyConfig(config)
    if running, previousFacing != facing {
      queue.async { self.configureSession() }
    }
    completion()
  }

  func stop(completion: @escaping () -> Void) {
    queue.async {
      self.running = false
      if self.session.isRunning {
        self.session.stopRunning()
      }
      DispatchQueue.main.async { completion() }
    }
  }

  private func applyConfig(_ config: [String: Any]) {
    backgroundMode = (config["backgroundMode"] as? String) ?? "none"
    posterMode = (config["posterMode"] as? String) ?? "off"
    posterX = CGFloat((config["posterX"] as? Double) ?? 0.5)
    posterY = CGFloat((config["posterY"] as? Double) ?? 0.4)
    posterScale = CGFloat((config["posterScale"] as? Double) ?? 1)
    mirror = (config["mirror"] as? Bool) ?? true
    let facingStr = (config["facing"] as? String) ?? "user"
    facing = (facingStr == "environment" || facingStr == "back") ? .back : .front
    if let url = config["backgroundUrl"] as? String, !url.isEmpty {
      if url != backgroundUrl {
        backgroundUrl = url
        backgroundImage = Self.loadCIImage(url)
      }
    } else {
      backgroundUrl = nil
      backgroundImage = nil
    }
    if let url = config["posterUrl"] as? String, !url.isEmpty {
      if url != posterUrl {
        posterUrl = url
        posterImage = Self.loadCIImage(url)
      }
    } else {
      posterUrl = nil
      posterImage = nil
    }
  }

  private static func loadCIImage(_ urlString: String) -> CIImage? {
    let url: URL?
    if urlString.hasPrefix("/") {
      url = URL(fileURLWithPath: urlString)
    } else if urlString.hasPrefix("file:") {
      url = URL(string: urlString)
    } else {
      url = URL(string: urlString)
    }
    guard let url, let data = try? Data(contentsOf: url), let ui = UIImage(data: data) else {
      return nil
    }
    return CIImage(image: ui)
  }

  private func configureSession() {
    session.beginConfiguration()
    session.sessionPreset = .hd1280x720
    if let current = deviceInput {
      session.removeInput(current)
      deviceInput = nil
    }
    let device =
      AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: facing)
      ?? AVCaptureDevice.default(for: .video)
    if let device, let input = try? AVCaptureDeviceInput(device: device) {
      if session.canAddInput(input) {
        session.addInput(input)
        deviceInput = input
      }
    }
    if session.outputs.isEmpty, session.canAddOutput(videoOut) {
      session.addOutput(videoOut)
    }
    if let conn = videoOut.connection(with: .video) {
      conn.videoOrientation = .portrait
      if conn.isVideoMirroringSupported {
        conn.isVideoMirrored = false
      }
    }
    session.commitConfiguration()
  }

  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    guard running else { return }
    guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    var ci = CIImage(cvPixelBuffer: pb)
    let wantFx = (backgroundMode != "none" && !disabled) || (posterImage != nil && posterMode != "off")
    if !wantFx {
      present(mirror ? Self.mirrorImage(ci) : ci)
      return
    }
    trackFps()
    let maxW = ladder[min(ladderIndex, ladder.count - 1)]
    let scale = min(1, maxW / ci.extent.width)
    if scale < 0.999 {
      ci = ci.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    }
    let composed = compose(ci)
    present(composed)
  }

  private func compose(_ camera: CIImage) -> CIImage {
    let extent = camera.extent
    let wantBg = backgroundMode != "none" && !disabled
    var out: CIImage
    if wantBg, let mask = personMask(for: camera) {
      let bg: CIImage
      if backgroundMode == "image", let img = backgroundImage {
        bg = Self.cover(img, in: extent)
      } else {
        let blurred = blur(camera, radius: max(6, extent.width * 0.02)).cropped(to: extent)
        let dim = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0.12)).cropped(to: extent)
        bg = dim.composited(over: blurred)
      }
      let person = camera.applyingFilter("CIBlendWithMask", parameters: [
        kCIInputBackgroundImageKey: CIImage.empty().cropped(to: extent),
        kCIInputMaskImageKey: mask,
      ])
      out = person.composited(over: bg)
    } else {
      out = camera
    }
    if mirror {
      out = out.transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -extent.width, y: 0))
        .cropped(to: extent)
    }
    if posterMode != "off", let poster = posterImage {
      out = drawPoster(poster, over: out, extent: extent)
    }
    return out.cropped(to: extent)
  }

  private func personMask(for image: CIImage) -> CIImage? {
    let handler = VNImageRequestHandler(ciImage: image, options: [:])
    let req = VNGeneratePersonSegmentationRequest()
    req.qualityLevel = .balanced
    req.outputPixelFormat = kCVPixelFormatType_OneComponent8
    do {
      try handler.perform([req])
    } catch {
      return nil
    }
    guard let pb = req.results?.first?.pixelBuffer else { return nil }
    let w = CVPixelBufferGetWidth(pb)
    let h = CVPixelBufferGetHeight(pb)
    CVPixelBufferLockBaseAddress(pb, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pb, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(pb) else { return nil }
    let bytes = CVPixelBufferGetBytesPerRow(pb)
    let count = w * h
    var alpha = [Float](repeating: 0, count: count)
    for y in 0..<h {
      let row = base.advanced(by: y * bytes).assumingMemoryBound(to: UInt8.self)
      for x in 0..<w {
        alpha[y * w + x] = Float(row[x]) / 255
      }
    }
    if prevAlpha == nil || maskW != w || maskH != h {
      prevAlpha = alpha
      maskW = w
      maskH = h
    } else if var prev = prevAlpha {
      for i in 0..<count {
        prev[i] = prev[i] * 0.55 + alpha[i] * 0.45
      }
      prevAlpha = prev
      alpha = prev
    }
    var pixels = [UInt8](repeating: 0, count: count * 4)
    for i in 0..<count {
      let a = alpha[i]
      let v: Float = a <= 0.35 ? 0 : a >= 0.65 ? 1 : (a - 0.35) / 0.3
      let o = i * 4
      pixels[o] = 255
      pixels[o + 1] = 255
      pixels[o + 2] = 255
      pixels[o + 3] = UInt8(max(0, min(255, v * 255)))
    }
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
      data: &pixels,
      width: w,
      height: h,
      bitsPerComponent: 8,
      bytesPerRow: w * 4,
      space: cs,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ), let cg = ctx.makeImage() else { return nil }
    var mask = CIImage(cgImage: cg)
    let radius = max(1, CGFloat(w) * 0.008)
    mask = mask.applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: radius])
    let scaleX = image.extent.width / CGFloat(w)
    let scaleY = image.extent.height / CGFloat(h)
    return mask.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
  }

  private func blur(_ image: CIImage, radius: CGFloat) -> CIImage {
    image.applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: radius])
  }

  private static func cover(_ img: CIImage, in extent: CGRect) -> CIImage {
    let iw = img.extent.width
    let ih = img.extent.height
    guard iw > 0, ih > 0 else { return img.cropped(to: extent) }
    let scale = max(extent.width / iw, extent.height / ih)
    let dw = iw * scale
    let dh = ih * scale
    let tx = extent.minX + (extent.width - dw) / 2 - img.extent.minX * scale
    let ty = extent.minY + (extent.height - dh) / 2 - img.extent.minY * scale
    return img.transformed(by: CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: tx / scale, y: ty / scale))
      .cropped(to: extent)
  }

  private func drawPoster(_ poster: CIImage, over base: CIImage, extent: CGRect) -> CIImage {
    let iw = max(1, poster.extent.width)
    let ih = max(1, poster.extent.height)
    var pw = extent.width * 0.72 * posterScale
    var ph = pw * (ih / iw)
    let maxH = extent.height * 0.88
    if ph > maxH {
      ph = maxH
      pw = ph * (iw / ih)
    }
    let px = posterX * extent.width - pw / 2
    let py = (1 - posterY) * extent.height - ph / 2
    let placed = Self.cover(poster, in: CGRect(x: px, y: py, width: pw, height: ph))
    return placed.composited(over: base)
  }

  private func trackFps() {
    let now = CACurrentMediaTime()
    if lastTs > 0 {
      let dt = (now - lastTs) * 1000
      if dt > 70 {
        slowFrames += 1
        fastFrames = 0
      } else {
        fastFrames += 1
        if fastFrames > 30 { slowFrames = 0 }
      }
      if slowFrames > 45 {
        slowFrames = 0
        if ladderIndex < ladder.count - 1 {
          ladderIndex += 1
        } else if !disabled {
          disabled = true
          DispatchQueue.main.async { self.onUnavailable?() }
        }
      }
    }
    lastTs = now
  }

  private func present(_ image: CIImage) {
    let extent = image.extent.integral
    guard extent.width > 2, extent.height > 2,
          let cg = ciContext.createCGImage(image, from: extent) else { return }
    let ui = UIImage(cgImage: cg)
    DispatchQueue.main.async {
      self.preview.image = ui
      if !self.didEmitFirstFrame {
        self.didEmitFirstFrame = true
        self.onFirstFrame?()
      }
    }
  }
}
