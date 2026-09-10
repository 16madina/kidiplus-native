import AVFoundation
import CoreImage
import CoreVideo
import ExpoModulesCore
import UIKit
import Vision

/// Native virtual-background compositor matching kidiplus.com:
/// Vision person mask → edge cleanup → feather blur → source-over person on
/// blurred camera or replacement image + optional poster.
final class KidiLiveEffectsSession: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
  static let shared = KidiLiveEffectsSession()

  private let session = AVCaptureSession()
  private let videoOut = AVCaptureVideoDataOutput()
  private let queue = DispatchQueue(label: "com.kidiplus.liveeffects.capture")
  /// Vision must never run on Camera Kit's frame callback. Camera Kit may call
  /// us on its UI-sensitive delivery queue, so a synchronous segmentation pass
  /// freezes the whole host studio (including every button).
  private let visionQueue = DispatchQueue(
    label: "com.kidiplus.liveeffects.vision",
    qos: .userInitiated
  )
  private let ciContext = CIContext(options: [.useSoftwareRenderer: false])
  private let maskLock = NSLock()

  private var deviceInput: AVCaptureDeviceInput?
  private weak var previewHost: UIView?
  private let preview: UIImageView
  private var running = false
  /// When true, compose incoming Camera Kit frames for LiveKit. Never open
  /// a second AVCaptureSession — that steals the camera and blacks out viewers.
  private var composeIntoPublish = false

  var isPublishComposeEnabled: Bool { composeIntoPublish }

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

  private var ladderIndex = 0
  private let ladder: [CGFloat] = [720, 540, 400]
  private var lastTs: CFTimeInterval = 0
  private var slowFrames = 0
  private var fastFrames = 0
  private var disabled = false
  private var pixelPool: CVPixelBufferPool?
  private var poolWidth = 0
  private var poolHeight = 0
  private var cachedMask: CIImage?
  private var cachedMaskExtent = CGRect.null
  private var visionHold = 0
  private var visionInFlight = false
  private var maskGeneration = 0
  /// Run the next segmentation pass as soon as the previous asynchronous pass
  /// finishes. Deliberately adding skipped frames here created a visible stale
  /// silhouette behind a moving presenter.
  private let visionEvery = 0
  private let visionInputWidth: CGFloat = 400
  private var previewTick = 0
  var onUnavailable: (() -> Void)?
  var onFirstFrame: (() -> Void)?
  private var didEmitFirstFrame = false

  private override init() {
    preview = Self.makePreview()
    super.init()
    videoOut.alwaysDiscardsLateVideoFrames = true
    videoOut.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ]
    videoOut.setSampleBufferDelegate(self, queue: queue)
  }

  /// UIKit views must be created on the main thread. Expo can first
  /// touch this singleton off-main when the module loads.
  private static func makePreview() -> UIImageView {
    let create = {
      let view = UIImageView()
      view.contentMode = .scaleAspectFill
      // Never hide Camera Kit with an empty black surface. Until the first
      // composed host frame arrives, the transparent view reveals Snap below.
      view.backgroundColor = .clear
      view.isOpaque = false
      view.isHidden = true
      view.clipsToBounds = true
      return view
    }
    if Thread.isMainThread {
      return create()
    }
    return DispatchQueue.main.sync(execute: create)
  }

  func registerPreviewHost(_ host: UIView) {
    let install = { [weak self, weak host] in
      guard let self, let host else { return }
      self.previewHost = host
      self.preview.removeFromSuperview()
      self.preview.image = nil
      self.preview.isHidden = true
      host.addSubview(self.preview)
      self.preview.frame = host.bounds
      self.preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    }
    if Thread.isMainThread { install() }
    else { DispatchQueue.main.async(execute: install) }
  }

  func unregisterPreviewHost(_ host: UIView) {
    // `deinit` calls this method. Capturing `host` in an async closure retains
    // an object that is already deallocating and caused EXC_BAD_ACCESS. Keep
    // only its value-type identity before hopping to the main queue.
    let hostID = ObjectIdentifier(host)
    let uninstall = { [weak self] in
      guard let self else { return }
      if let current = self.previewHost, ObjectIdentifier(current) == hostID {
        self.preview.removeFromSuperview()
        self.preview.image = nil
        self.previewHost = nil
      }
    }
    if Thread.isMainThread { uninstall() }
    else { DispatchQueue.main.async(execute: uninstall) }
  }

  func layoutPreview(in bounds: CGRect) {
    DispatchQueue.main.async {
      self.preview.frame = bounds
    }
  }

  private static func mirrorImage(_ image: CIImage) -> CIImage {
    let extent = image.extent
    return image
      .transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -extent.width, y: 0))
      .cropped(to: extent)
  }

  func warmup(completion: @escaping (Bool) -> Void) {
    DispatchQueue.main.async { completion(true) }
  }

  func start(config: [String: Any], completion: @escaping (Bool) -> Void) {
    applyConfig(config)
    didEmitFirstFrame = false
    disabled = false
    ladderIndex = 0
    slowFrames = 0
    fastFrames = 0
    lastTs = 0
    resetMaskCache()
    // Live already owns Camera Kit — never open a 2nd capture session.
    if composeIntoPublish {
      running = true
      DispatchQueue.main.async { completion(true) }
      return
    }
    composeIntoPublish = false
    queue.async {
      self.configureSession()
      if !self.session.isRunning {
        self.session.startRunning()
      }
      self.running = true
      DispatchQueue.main.async { completion(true) }
    }
  }

  func preloadBackground(url: String?, completion: @escaping (Bool) -> Void) {
    guard let url, !url.isEmpty else {
      completion(false)
      return
    }
    if url == backgroundUrl, backgroundImage != nil {
      completion(true)
      return
    }
    backgroundUrl = url
    let captured = url
    DispatchQueue.global(qos: .userInitiated).async {
      let img = Self.loadCIImage(captured)
      self.queue.async {
        if self.backgroundUrl == captured {
          self.backgroundImage = img
        }
        DispatchQueue.main.async { completion(img != nil) }
      }
    }
  }

  /// Compose on Camera Kit frames already heading to LiveKit. Stops any
  /// local capture session so iOS does not hand the camera to a 2nd owner.
  func attachPublished(config: [String: Any], completion: @escaping (Bool) -> Void) {
    applyConfig(config)
    didEmitFirstFrame = false
    disabled = false
    ladderIndex = 0
    slowFrames = 0
    fastFrames = 0
    lastTs = 0
    resetMaskCache()
    composeIntoPublish = true
    running = true
    queue.async {
      if self.session.isRunning {
        self.session.stopRunning()
      }
      DispatchQueue.main.async { completion(true) }
    }
  }

  func detachPublished(completion: @escaping () -> Void) {
    composeIntoPublish = false
    DispatchQueue.main.async {
      self.preview.image = nil
      self.preview.isHidden = true
      completion()
    }
  }

  func setConfig(_ config: [String: Any], completion: @escaping () -> Void) {
    let previousFacing = facing
    applyConfig(config)
    if running, !composeIntoPublish, previousFacing != facing {
      queue.async { self.configureSession() }
    }
    completion()
  }

  func stop(completion: @escaping () -> Void) {
    queue.async {
      self.running = false
      self.composeIntoPublish = false
      self.disabled = false
      self.ladderIndex = 0
      self.slowFrames = 0
      self.resetMaskCache()
      if self.session.isRunning {
        self.session.stopRunning()
      }
      DispatchQueue.main.async {
        self.preview.image = nil
        self.preview.isHidden = true
        completion()
      }
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
        let captured = url
        DispatchQueue.global(qos: .userInitiated).async {
          let img = Self.loadCIImage(captured)
          self.queue.async {
            guard self.backgroundUrl == captured else { return }
            self.backgroundImage = img
          }
        }
      }
    } else {
      backgroundUrl = nil
      backgroundImage = nil
    }
    if let url = config["posterUrl"] as? String, !url.isEmpty {
      if url != posterUrl {
        posterUrl = url
        let captured = url
        DispatchQueue.global(qos: .userInitiated).async {
          let img = Self.loadCIImage(captured)
          self.queue.async {
            guard self.posterUrl == captured else { return }
            self.posterImage = img
          }
        }
      }
    } else {
      posterUrl = nil
      posterImage = nil
    }
  }

  private static let maxImageEdge: CGFloat = 1280

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
    return CIImage(image: Self.downsampled(ui, maxEdge: maxImageEdge))
  }

  private static func downsampled(_ image: UIImage, maxEdge: CGFloat) -> UIImage {
    let w = image.size.width
    let h = image.size.height
    let edge = max(w, h)
    guard w > 0, h > 0 else { return image }
    let scale = min(1, maxEdge / max(1, edge))
    let size = CGSize(width: w * scale, height: h * scale)
    // Photos from the iPhone library may be 16-bpc / wide-gamut. Normalizing
    // every picked image to standard 8-bit sRGB prevents repeated CoreGraphics
    // decode failures while the live compositor is running.
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    format.preferredRange = .standard
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
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
    let composed = compose(ci, includePoster: true, applyMirror: mirror)
    present(composed)
  }

  /// Camera Kit already applied the Snap filter. Compose every enabled effect
  /// on that same frame so web and native viewers receive identical pixels.
  func composePublished(_ sample: CMSampleBuffer) -> CMSampleBuffer? {
    // A slow segmentation pass may disable only the virtual background. A
    // poster is a cheap Core Image overlay and must keep publishing alongside
    // the Snap lens even when Vision has stepped down or become unavailable.
    let wantsBackground = backgroundMode != "none" && !disabled
    let wantsPoster = posterMode != "off" && posterImage != nil
    guard composeIntoPublish, wantsBackground || wantsPoster else { return nil }
    if backgroundMode == "image", backgroundImage == nil, !wantsPoster { return nil }
    guard let pb = CMSampleBufferGetImageBuffer(sample) else { return nil }
    let nativeW = CVPixelBufferGetWidth(pb)
    let nativeH = CVPixelBufferGetHeight(pb)
    guard nativeW > 2, nativeH > 2 else { return nil }
    let camera = CIImage(cvPixelBuffer: pb)
    if wantsBackground { trackFps() }
    var composed = camera
    if wantsBackground, !disabled, let mask = personMask(for: camera) {
      composed = applyBackground(camera, mask: mask)
    }
    if wantsPoster, let poster = posterImage {
      composed = drawPoster(poster, over: composed, extent: camera.extent)
    }
    guard let outgoing = makeOutgoingSample(
      from: composed,
      width: nativeW,
      height: nativeH,
      prototype: sample
    ) else { return nil }
    if let rendered = CMSampleBufferGetImageBuffer(outgoing) {
      presentRendered(rendered)
    }
    return outgoing
  }

  private func resetMaskCache() {
    maskLock.lock()
    cachedMask = nil
    cachedMaskExtent = .null
    visionHold = 0
    visionInFlight = false
    maskGeneration += 1
    maskLock.unlock()
    previewTick = 0
  }

  private func ensurePool(width: Int, height: Int) -> CVPixelBufferPool? {
    if let pixelPool, poolWidth == width, poolHeight == height {
      return pixelPool
    }
    pixelPool = nil
    poolWidth = width
    poolHeight = height
    let pbAttrs: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
      kCVPixelBufferIOSurfacePropertiesKey as String: [:] as [String: Any],
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ]
    let poolAttrs: [String: Any] = [
      kCVPixelBufferPoolMinimumBufferCountKey as String: 3,
    ]
    var pool: CVPixelBufferPool?
    let status = CVPixelBufferPoolCreate(
      kCFAllocatorDefault,
      poolAttrs as CFDictionary,
      pbAttrs as CFDictionary,
      &pool
    )
    guard status == kCVReturnSuccess else { return nil }
    pixelPool = pool
    return pool
  }

  private func makeOutgoingSample(
    from image: CIImage,
    width: Int,
    height: Int,
    prototype: CMSampleBuffer
  ) -> CMSampleBuffer? {
    guard let pool = ensurePool(width: width, height: height) else { return nil }
    var pixelBuffer: CVPixelBuffer?
    let rent = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixelBuffer)
    guard rent == kCVReturnSuccess, let pixelBuffer else { return nil }

    let size = CGSize(width: width, height: height)
    let normalized = Self.originZero(image, size: size)
    ciContext.render(
      normalized,
      to: pixelBuffer,
      bounds: CGRect(origin: .zero, size: size),
      colorSpace: CGColorSpaceCreateDeviceRGB()
    )

    var format: CMVideoFormatDescription?
    let fmtStatus = CMVideoFormatDescriptionCreateForImageBuffer(
      allocator: kCFAllocatorDefault,
      imageBuffer: pixelBuffer,
      formatDescriptionOut: &format
    )
    guard fmtStatus == noErr, let format else { return nil }

    var timing = CMSampleTimingInfo()
    var timingCount: CMItemCount = 1
    CMSampleBufferGetSampleTimingInfoArray(
      prototype,
      entryCount: 1,
      arrayToFill: &timing,
      entriesNeededOut: &timingCount
    )
    if timing.duration == .invalid {
      timing.duration = CMSampleBufferGetDuration(prototype)
    }
    if timing.presentationTimeStamp == .invalid {
      timing.presentationTimeStamp = CMSampleBufferGetPresentationTimeStamp(prototype)
    }
    if timing.decodeTimeStamp == .invalid {
      timing.decodeTimeStamp = CMSampleBufferGetDecodeTimeStamp(prototype)
    }

    var outgoing: CMSampleBuffer?
    let createStatus = CMSampleBufferCreateForImageBuffer(
      allocator: kCFAllocatorDefault,
      imageBuffer: pixelBuffer,
      dataReady: true,
      makeDataReadyCallback: nil,
      refcon: nil,
      formatDescription: format,
      sampleTiming: &timing,
      sampleBufferOut: &outgoing
    )
    guard createStatus == noErr else { return nil }
    return outgoing
  }

  private static func originZero(_ image: CIImage, size: CGSize) -> CIImage {
    image
      .transformed(by: CGAffineTransform(translationX: -image.extent.origin.x, y: -image.extent.origin.y))
      .cropped(to: CGRect(origin: .zero, size: size))
  }

  private func compose(_ camera: CIImage, includePoster: Bool, applyMirror: Bool) -> CIImage {
    let extent = camera.extent
    var out = camera
    if backgroundMode != "none", !disabled, let mask = personMask(for: camera) {
      out = applyBackground(camera, mask: mask)
    }
    if applyMirror {
      out = out.transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -extent.width, y: 0))
        .cropped(to: extent)
    }
    if includePoster, posterMode != "off", let poster = posterImage {
      out = drawPoster(poster, over: out, extent: extent)
    }
    return out.cropped(to: extent)
  }

  private func applyBackground(_ camera: CIImage, mask: CIImage) -> CIImage {
    let extent = camera.extent
    let bg: CIImage
    if backgroundMode == "image", let img = backgroundImage {
      bg = Self.cover(img, in: extent)
    } else {
      let blurred = blur(camera, radius: max(6, extent.width * 0.02)).cropped(to: extent)
      let dim = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0.12)).cropped(to: extent)
      bg = dim.composited(over: blurred)
    }
    // `mask` is an explicit black/white luminance matte: white always keeps
    // the presenter and black always selects the replacement background.
    // Do not use the alpha-mask variant here; a one-component Vision image has
    // an opaque storage alpha even when its person confidence is nearly zero.
    return camera.applyingFilter("CIBlendWithMask", parameters: [
      kCIInputBackgroundImageKey: bg,
      kCIInputMaskImageKey: mask,
    ]).cropped(to: extent)
  }

  /// Returns the most recent mask immediately and refreshes it asynchronously.
  /// No Vision request or per-pixel Swift loop is allowed on the video callback.
  private func personMask(for image: CIImage) -> CIImage? {
    let target = image.extent
    maskLock.lock()
    let previous = cachedMaskExtent == target ? cachedMask : nil
    if previous != nil, visionHold < visionEvery {
      visionHold += 1
      maskLock.unlock()
      return previous
    }
    if visionInFlight {
      maskLock.unlock()
      return previous
    }
    visionHold = 0
    visionInFlight = true
    let generation = maskGeneration
    maskLock.unlock()

    // Snapshot only a small GPU-rendered frame. The sample buffer can then be
    // released by Camera Kit while Vision works independently.
    var work = image
    let scale = min(1, visionInputWidth / max(1, image.extent.width))
    if scale < 0.999 {
      work = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    }
    let workSize = work.extent.size
    let normalized = Self.originZero(work, size: workSize)
    let workRect = CGRect(origin: .zero, size: workSize)
    guard let snapshot = ciContext.createCGImage(normalized, from: workRect) else {
      finishVision(mask: nil, target: target, generation: generation)
      return previous
    }

    visionQueue.async { [weak self] in
      self?.refreshPersonMask(from: snapshot, target: target, generation: generation)
    }
    return previous
  }

  private func refreshPersonMask(
    from snapshot: CGImage,
    target: CGRect,
    generation: Int
  ) {
    let handler = VNImageRequestHandler(cgImage: snapshot, options: [:])
    let req = VNGeneratePersonSegmentationRequest()
    req.qualityLevel = .balanced
    req.outputPixelFormat = kCVPixelFormatType_OneComponent8
    do {
      try handler.perform([req])
    } catch {
      finishVision(mask: nil, target: target, generation: generation)
      return
    }
    guard let pb = req.results?.first?.pixelBuffer else {
      finishVision(mask: nil, target: target, generation: generation)
      return
    }
    let w = CVPixelBufferGetWidth(pb)
    let h = CVPixelBufferGetHeight(pb)
    // Vision produces an 8-bit confidence map, not a finished compositing
    // matte. Convert it to real black/white pixels while the request still owns
    // the buffer. This guarantees that the presenter's interior is 100% opaque
    // instead of being blended into the replacement image.
    CVPixelBufferLockBaseAddress(pb, .readOnly)
    guard let base = CVPixelBufferGetBaseAddress(pb) else {
      CVPixelBufferUnlockBaseAddress(pb, .readOnly)
      finishVision(mask: nil, target: target, generation: generation)
      return
    }
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pb)
    var matte = [UInt8](repeating: 0, count: w * h)
    for y in 0..<h {
      let source = base.advanced(by: y * bytesPerRow).assumingMemoryBound(to: UInt8.self)
      let destinationOffset = y * w
      for x in 0..<w {
        // Keep uncertain hair/finger pixels, then let the very small feather
        // below soften only their outer contour. Every retained pixel is white.
        matte[destinationOffset + x] = source[x] >= 96 ? 255 : 0
      }
    }
    CVPixelBufferUnlockBaseAddress(pb, .readOnly)

    guard
      let provider = CGDataProvider(data: Data(matte) as CFData),
      let stableCG = CGImage(
        width: w,
        height: h,
        bitsPerComponent: 8,
        bitsPerPixel: 8,
        bytesPerRow: w,
        space: CGColorSpaceCreateDeviceGray(),
        bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
        provider: provider,
        decode: nil,
        shouldInterpolate: true,
        intent: .defaultIntent
      )
    else {
      finishVision(mask: nil, target: target, generation: generation)
      return
    }
    var mask = CIImage(cgImage: stableCG)
      // A half-pixel expansion preserves fine hair without producing a bright
      // outline outside the person when the mask follows quick movement.
      .applyingFilter("CIMorphologyMaximum", parameters: [kCIInputRadiusKey: 0.5])
    let scaleX = target.width / CGFloat(w)
    let scaleY = target.height / CGFloat(h)
    mask = mask.transformed(
      by: CGAffineTransform(scaleX: scaleX, y: scaleY).translatedBy(x: target.minX, y: target.minY)
    )
    // Feather in output pixels for a stable, natural edge at every resolution.
    let result = mask
      // Only this narrow contour may contain intermediate gray values. The
      // entire detected body remains solid white and therefore fully opaque.
      .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 1.0])
      .cropped(to: target)
    finishVision(mask: result, target: target, generation: generation)
  }

  private func finishVision(mask: CIImage?, target: CGRect, generation: Int) {
    maskLock.lock()
    defer { maskLock.unlock() }
    guard generation == maskGeneration else { return }
    if let mask {
      cachedMask = mask
      cachedMaskExtent = target
    }
    visionInFlight = false
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

  /// Local-only preview (setup screen). Live publish uses `presentRendered`.
  private func present(_ image: CIImage) {
    let size = image.extent.size
    guard size.width > 2, size.height > 2 else { return }
    let normalized = Self.originZero(image, size: size)
    let dest = CGRect(origin: .zero, size: size)
    guard let cg = ciContext.createCGImage(normalized, from: dest) else { return }
    pushPreview(UIImage(cgImage: cg))
  }

  /// Host preview = the same origin-zero buffer sent to LiveKit. Small copy
  /// only — never `createCGImage` on the raw composed CIImage (infinite extent).
  private func presentRendered(_ buffer: CVPixelBuffer) {
    if previewHost == nil {
      emitFirstFrameIfNeeded()
      return
    }
    previewTick += 1
    // The host only needs a responsive visual preview, not a second 30-fps
    // encode path. Ten UI updates per second avoid flooding the main thread.
    if previewTick % 3 != 1 { return }
    let w = CVPixelBufferGetWidth(buffer)
    let h = CVPixelBufferGetHeight(buffer)
    guard w > 2, h > 2 else { return }
    let published = CIImage(cvPixelBuffer: buffer)
    // LiveKit must publish the natural (unmirrored) camera image, while the
    // presenter expects a selfie-style preview. Keep that mirror local to this
    // UIImageView so viewers and text/logos in the broadcast remain correct.
    let src = facing == .front ? Self.mirrorImage(published) : published
    let scale = min(1, 360 / CGFloat(max(w, h)))
    let dest = CGRect(
      origin: .zero,
      size: CGSize(width: (CGFloat(w) * scale).rounded(.down), height: (CGFloat(h) * scale).rounded(.down))
    )
    let scaled = src.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    guard let cg = ciContext.createCGImage(scaled, from: dest) else { return }
    pushPreview(UIImage(cgImage: cg))
  }

  private func pushPreview(_ ui: UIImage) {
    DispatchQueue.main.async {
      self.preview.image = ui
      self.preview.isHidden = false
      self.emitFirstFrameIfNeeded()
    }
  }

  private func emitFirstFrameIfNeeded() {
    guard !didEmitFirstFrame else { return }
    didEmitFirstFrame = true
    if Thread.isMainThread {
      onFirstFrame?()
    } else {
      DispatchQueue.main.async { self.onFirstFrame?() }
    }
  }
}
