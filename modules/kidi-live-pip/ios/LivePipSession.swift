import AVFoundation
import AVKit
import UIKit
#if canImport(LiveKit)
import LiveKit
#elseif canImport(LiveKitClient)
import LiveKitClient
#endif

/**
 * Native LiveKit viewer used only to feed iOS system Picture-in-Picture.
 * React Native keeps the full live UI; this is a second viewer whose
 * frames go to AVSampleBufferDisplayLayer (LiveKit minimal-pip pattern).
 * Ported from the Capacitor app — do not rewrite the PiP / audio logic.
 */
final class LivePipSession: NSObject, @unchecked Sendable {
    static let shared = LivePipSession()

    private let room = Room()
    private let previewController = LivePipPreviewController()
    private let videoCallController = LivePipVideoCallController()
    private var pipController: AVPictureInPictureController?
    private var modeListener: ((Bool) -> Void)?
    private var eligible = false
    private var connected = false
    private var connectInFlight = false
    /// Kept for silent-drop recovery: if the room disconnects while the user
    /// browses the app (mini player), we reconnect with the same session so
    /// leaving the app doesn't open a black, silent PiP bubble.
    private var sessionUrl: String?
    private var sessionToken: String?
    private var hostTrack: VideoTrack?
    private var hasRenderedFrame = false
    private var resignObserver: NSObjectProtocol?
    private var backgroundObserver: NSObjectProtocol?
    private var activeObserver: NSObjectProtocol?
    private weak var hostView: UIView?
    private var previewConstraints: [NSLayoutConstraint] = []
    /// Cached on the main thread — LiveKit delegates must not read UIApplication.
    private var cachedAppIsActive = true

    var isInPip: Bool {
        pipController?.isPictureInPictureActive ?? false
    }

    var isSupported: Bool {
        AVPictureInPictureController.isPictureInPictureSupported()
    }

    func setModeListener(_ listener: ((Bool) -> Void)?) {
        modeListener = listener
    }

    func attach(to hostView: UIView) {
        self.hostView = hostView
        // Do NOT create AVPictureInPictureController here.
        // Creating it at launch with auto-start makes iOS open an empty PiP
        // bubble whenever the user leaves the app — even with no live open.
        observeAppLifecycle()
        print("[KiDi+] LivePipSession attached (lazy), pipSupported=\(isSupported)")
    }

    func setEligible(_ on: Bool, url: String?, token: String?) async {
        print("[KiDi+] LivePipSession setEligible=\(on) url=\(url != nil) token=\(token != nil)")
        if !on {
            eligible = false
            sessionUrl = nil
            sessionToken = nil
            await teardown()
            return
        }
        guard let url, let token, !url.isEmpty, !token.isEmpty else {
            // Never leave eligible=true without a real LiveKit session — that
            // caused empty PiP bubbles when leaving the app with no live open.
            eligible = false
            sessionUrl = nil
            sessionToken = nil
            print("[KiDi+] LivePipSession enable ignored — missing url/token (publish web JS?)")
            await teardown()
            return
        }
        if eligible, connected, sessionUrl == url {
            print("[KiDi+] LivePipSession setEligible skipped — already connected")
            return
        }
        eligible = true
        sessionUrl = url
        sessionToken = token
        await MainActor.run {
            self.ensureSourceViewsAttached()
        }
        await connect(url: url, token: token)
    }

    func startPipIfPossible() {
        DispatchQueue.main.async {
            guard self.eligible else {
                print("[KiDi+] startPip skipped — not eligible")
                self.destroyPipController()
                return
            }
            guard self.isSupported else {
                print("[KiDi+] startPip skipped — not supported on device")
                return
            }
            guard self.connected else {
                print("[KiDi+] startPip skipped — native LiveKit not connected")
                return
            }
            guard self.hostTrack != nil else {
                print("[KiDi+] startPip skipped — no remote video track yet")
                return
            }
            guard self.hasRenderedFrame else {
                print("[KiDi+] startPip deferred — waiting for first video frame")
                return
            }
            self.ensureSourceViewsAttached()
            self.ensurePipController(forceRebuild: false)
            guard let pip = self.pipController else {
                print("[KiDi+] startPip skipped — no pipController")
                return
            }
            if pip.isPictureInPictureActive {
                return
            }
            // Home / app-switch is handled by auto-inline. Explicit
            // startPictureInPicture() is only legal while the scene is
            // UISceneActivationStateForegroundActive (iOS 15+ video-call PiP).
            pip.canStartPictureInPictureAutomaticallyFromInline = true
            guard self.isSceneForegroundActive() else {
                print("[KiDi+] startPip skipped — scene not ForegroundActive (autoInline)")
                return
            }
            let possible: Bool
            if #available(iOS 15.0, *) {
                possible = pip.isPictureInPicturePossible
            } else {
                possible = true
            }
            print("[KiDi+] starting Picture in Picture… possible=\(possible)")
            pip.startPictureInPicture()
        }
    }

    @discardableResult
    func stopPip() -> Bool {
        guard let pip = pipController, pip.isPictureInPictureActive else { return false }
        pip.stopPictureInPicture()
        return true
    }

    func dismiss() async -> Bool {
        let wasPip = await MainActor.run {
            return self.stopPip()
        }
        eligible = false
        backgroundAudioArmed = false
        await teardown()
        return wasPip
    }

    /// True only while the app is resigning / in background / system PiP.
    /// Foreground: RN LiveKit owns audio. Native must not subscribe or activate
    /// AVAudioSession or the two rooms fight in-process (silent RN viewer).
    private var backgroundAudioArmed = false

    private var isAppInForeground: Bool {
        cachedAppIsActive && !backgroundAudioArmed
    }

    /// startPictureInPicture() asserts unless the content-source scene is
    /// ForegroundActive. Home is handled by auto-inline, not this call.
    private func isSceneForegroundActive() -> Bool {
        if !Thread.isMainThread { return cachedAppIsActive }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.contains { $0.activationState == .foregroundActive }
    }

    /// Foreground: RN webrtc owns AVAudioSession. The Swift LiveKit Room
    /// must not start AudioManager / ADM or packets are discarded (mute mini).
    private func setNativeAudioEngine(_ on: Bool, reason: String) {
        AudioManager.shared.audioSession.isAutomaticConfigurationEnabled = false
        do {
            try AudioManager.shared.setEngineAvailability(on ? .default : .none)
            print("[KiDi+] Swift audio engine \(on ? "on" : "off") (\(reason))")
        } catch {
            print("[KiDi+] Swift audio engine \(on ? "on" : "off") failed (\(reason)): \(error)")
        }
    }

    private func activatePipAudioSession(reason: String) {
        setNativeAudioEngine(true, reason: reason)
        AudioManager.shared.isSpeakerOutputPreferred = true
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .playback,
                mode: .moviePlayback,
                options: []
            )
            try session.setActive(true)
            print("[KiDi+] PiP audio session active (\(reason))")
        } catch {
            print("[KiDi+] PiP audio session failed (\(reason)): \(error)")
        }
    }

    private func setRemoteAudioSubscribed(_ on: Bool, reason: String) {
        print("[KiDi+] setRemoteAudioSubscribed=\(on) (\(reason)) remotes=\(room.remoteParticipants.count)")
        for participant in room.remoteParticipants.values {
            for publication in participant.trackPublications.values {
                guard publication.kind == .audio,
                      let remote = publication as? RemoteTrackPublication else { continue }
                Task {
                    do {
                        try await remote.set(subscribed: on)
                        print("[KiDi+] LivePipSession audio subscribed=\(on) (\(reason))")
                    } catch {
                        print("[KiDi+] LivePipSession audio subscribe=\(on) failed (\(reason)): \(error)")
                    }
                }
            }
        }
    }

    /// Video-only — safe in the foreground (does not steal the RN audio session).
    private func ensureRemoteVideoSubscribed(reason: String) {
        print("[KiDi+] ensureRemoteVideoSubscribed (\(reason)) remotes=\(room.remoteParticipants.count)")
        for participant in room.remoteParticipants.values {
            for publication in participant.trackPublications.values {
                guard publication.kind != .audio,
                      let remote = publication as? RemoteTrackPublication else { continue }
                Task {
                    do {
                        try await remote.set(subscribed: true)
                        if let track = publication.track as? VideoTrack {
                            await MainActor.run {
                                self.setHostTrack(track)
                            }
                        }
                    } catch {
                        print("[KiDi+] LivePipSession video subscribe failed (\(reason)): \(error)")
                    }
                }
            }
        }
    }

    /// Reconnect the native room if it silently dropped while the app was in
    /// the foreground (network blip / idle disconnect during the in-app mini
    /// player). Without this, `connected` went stale and leaving the app
    /// produced a black, silent PiP bubble with nothing recovering it.
    private func reconnectIfNeeded(reason: String) {
        guard eligible, !connected, !connectInFlight else { return }
        guard let url = sessionUrl, let token = sessionToken else { return }
        print("[KiDi+] LivePipSession reconnecting (\(reason))")
        Task { await self.connect(url: url, token: token) }
    }

    private func prepareForBackgroundPip(reason: String) {
        guard eligible else {
            print("[KiDi+] prepareForBackgroundPip skipped — not eligible (\(reason))")
            return
        }
        cachedAppIsActive = false
        backgroundAudioArmed = true
        activatePipAudioSession(reason: reason)
        reconnectIfNeeded(reason: reason)
        setRemoteAudioSubscribed(true, reason: reason)
        pipController?.canStartPictureInPictureAutomaticallyFromInline = true
        print("[KiDi+] prepareForBackgroundPip armed autoInline (\(reason)) controller=\(pipController != nil) frames=\(hasRenderedFrame) pipActive=\(isInPip)")
    }

    private func connect(url: String, token: String) async {
        if connectInFlight { return }
        connectInFlight = true
        defer { connectInFlight = false }
        if connected {
            await teardownRoomOnly()
        }
        // Video-only in foreground. Engine + AVAudioSession stay with RN.
        setNativeAudioEngine(false, reason: "connect-foreground")
        room.add(delegate: self)
        do {
            try await room.connect(
                url: url,
                token: token,
                connectOptions: ConnectOptions(autoSubscribe: false)
            )
            connected = true
            print("[KiDi+] LivePipSession connected, remotes=\(room.remoteParticipants.count)")
            await MainActor.run {
                self.bindExistingRemoteTracks()
            }
        } catch {
            print("[KiDi+] LivePipSession connect failed: \(error)")
            connected = false
        }
    }

    private func teardown() async {
        await MainActor.run {
            _ = self.stopPip()
            self.destroyPipController()
            if let track = self.hostTrack {
                track.remove(videoRenderer: self.previewController)
                track.remove(videoRenderer: self.videoCallController)
                self.hostTrack = nil
            }
            self.detachSourceViews()
            self.hasRenderedFrame = false
        }
        await teardownRoomOnly()
    }

    private func teardownRoomOnly() async {
        setNativeAudioEngine(false, reason: "teardown")
        room.remove(delegate: self)
        await room.disconnect()
        connected = false
    }

    private func bindExistingRemoteTracks() {
        ensureRemoteVideoSubscribed(reason: "bind-existing")
        if !isAppInForeground {
            setRemoteAudioSubscribed(true, reason: "bind-existing-background")
        }
    }

    private func setHostTrack(_ track: VideoTrack) {
        if hostTrack === track, pipController != nil {
            print("[KiDi+] LivePipSession host video track already bound")
            return
        }
        if let prev = hostTrack, prev !== track {
            prev.remove(videoRenderer: previewController)
            prev.remove(videoRenderer: videoCallController)
        }
        hostTrack = track
        hasRenderedFrame = false
        ensureSourceViewsAttached()
        track.add(videoRenderer: previewController)
        track.add(videoRenderer: videoCallController)
        ensurePipController(forceRebuild: pipController == nil)
        print("[KiDi+] LivePipSession host video track bound")
    }

    private func ensureSourceViewsAttached() {
        guard let hostView else { return }
        let preview = previewController.view!
        _ = videoCallController.view
        // Keep the source view opaque and in-hierarchy (behind the WebView).
        // Near-zero alpha makes iOS report isPictureInPicturePossible=false.
        preview.isHidden = false
        preview.alpha = 1
        preview.isUserInteractionEnabled = false
        preview.backgroundColor = .black
        if preview.superview !== hostView {
            preview.translatesAutoresizingMaskIntoConstraints = false
            hostView.insertSubview(preview, at: 0)
            previewConstraints = [
                preview.widthAnchor.constraint(equalToConstant: 118),
                preview.heightAnchor.constraint(equalToConstant: 210),
                preview.leadingAnchor.constraint(equalTo: hostView.leadingAnchor, constant: 8),
                preview.bottomAnchor.constraint(equalTo: hostView.safeAreaLayoutGuide.bottomAnchor, constant: -72),
            ]
            NSLayoutConstraint.activate(previewConstraints)
        }
        hostView.layoutIfNeeded()
    }

    private func detachSourceViews() {
        NSLayoutConstraint.deactivate(previewConstraints)
        previewConstraints.removeAll()
        previewController.view?.removeFromSuperview()
    }

    private func ensurePipController(forceRebuild: Bool) {
        if forceRebuild {
            destroyPipController()
        }
        guard eligible, isSupported, pipController == nil else { return }
        ensureSourceViewsAttached()
        let source = AVPictureInPictureController.ContentSource(
            activeVideoCallSourceView: previewController.view,
            contentViewController: videoCallController
        )
        let controller = AVPictureInPictureController(contentSource: source)
        // When a live is ready, let iOS auto-start PiP on Home (TikTok-style).
        // Controller is only created while eligible, so this won't fire empty bubbles.
        controller.canStartPictureInPictureAutomaticallyFromInline = hasRenderedFrame
        controller.delegate = self
        controller.setValue(1, forKey: "controlsStyle")
        pipController = controller
        print("[KiDi+] pipController created, autoInline=\(hasRenderedFrame)")
    }

    private func destroyPipController() {
        if let pip = pipController {
            pip.canStartPictureInPictureAutomaticallyFromInline = false
            if pip.isPictureInPictureActive {
                pip.stopPictureInPicture()
            }
            pip.delegate = nil
        }
        pipController = nil
    }

    fileprivate func noteFrameRendered() {
        let first = !hasRenderedFrame
        hasRenderedFrame = true
        if first {
            print("[KiDi+] LivePipSession first video frame received")
            if pipController == nil {
                ensurePipController(forceRebuild: false)
            }
            pipController?.canStartPictureInPictureAutomaticallyFromInline = true
            print("[KiDi+] autoInline armed, controller=\(pipController != nil)")
        }
    }

    private func observeAppLifecycle() {
        if resignObserver == nil {
            resignObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.willResignActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                self.cachedAppIsActive = false
                // Audio only. Do not startPictureInPicture() here — the scene
                // is already leaving ForegroundActive and AVKit rejects it.
                self.prepareForBackgroundPip(reason: "willResignActive")
            }
        }
        if backgroundObserver == nil {
            backgroundObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                self.prepareForBackgroundPip(reason: "didEnterBackground")
            }
        }
        if activeObserver == nil {
            activeObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                self.cachedAppIsActive = true
                self.backgroundAudioArmed = false
                self.setRemoteAudioSubscribed(false, reason: "didBecomeActive")
                self.setNativeAudioEngine(false, reason: "didBecomeActive")
                if self.isInPip {
                    self.stopPip()
                }
                // Keep the source view in-hierarchy (behind RN) so the next
                // Home gesture can auto-start PiP. Hiding it makes auto-inline
                // report isPictureInPicturePossible=false.
                self.ensureSourceViewsAttached()
            }
        }
    }

    private func emitMode(_ active: Bool) {
        modeListener?(active)
    }
}

extension LivePipSession: RoomDelegate {
    func room(_ room: Room, didUpdateConnectionState connectionState: ConnectionState, from oldConnectionState: ConnectionState) {
        print("[KiDi+] LivePipSession connectionState \(oldConnectionState) → \(connectionState)")
        switch connectionState {
        case .connected:
            connected = true
        case .disconnected:
            connected = false
            if eligible {
                DispatchQueue.main.async {
                    self.reconnectIfNeeded(reason: "state-disconnected")
                }
            }
        default:
            // connecting / reconnecting — LiveKit is handling it, don't stomp.
            break
        }
    }

    func room(_ room: Room, participant: RemoteParticipant, didPublishTrack publication: RemoteTrackPublication) {
        if publication.kind == .audio {
            if self.isAppInForeground { return }
            Task {
                do {
                    try await publication.set(subscribed: true)
                } catch {
                    print("[KiDi+] LivePipSession audio publish-subscribe failed: \(error)")
                }
            }
            return
        }
        Task {
            do {
                try await publication.set(subscribed: true)
            } catch {
                print("[KiDi+] LivePipSession video publish-subscribe failed: \(error)")
            }
        }
    }

    func room(_ room: Room, participant: RemoteParticipant, didSubscribeTrack publication: RemoteTrackPublication) {
        if publication.kind == .audio {
            if self.isAppInForeground {
                Task {
                    do {
                        try await publication.set(subscribed: false)
                        print("[KiDi+] LivePipSession audio dropped in foreground")
                    } catch {
                        print("[KiDi+] LivePipSession audio drop failed: \(error)")
                    }
                }
                return
            }
            print("[KiDi+] LivePipSession remote audio subscribed")
            Task { @MainActor in
                self.activatePipAudioSession(reason: "audio-subscribed")
            }
            return
        }
        guard let track = publication.track as? VideoTrack else { return }
        Task { @MainActor in
            self.setHostTrack(track)
        }
    }

    func room(_ room: Room, participant: RemoteParticipant, didUnpublishTrack publication: RemoteTrackPublication) {
        // no-op — keep PiP session alive if host briefly republishes
    }
}

extension LivePipSession: AVPictureInPictureControllerDelegate {
    func pictureInPictureControllerDidStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        print("[KiDi+] PiP did start")
        activatePipAudioSession(reason: "pip-did-start")
        setRemoteAudioSubscribed(true, reason: "pip-did-start")
        emitMode(true)
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        print("[KiDi+] PiP did stop")
        emitMode(false)
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        failedToStartPictureInPictureWithError error: Error
    ) {
        // Do NOT emitMode(false): JS treats that as "user closed PiP" and kills the live.
        print("[KiDi+] PiP failed to start: \(error)")
    }
}

// MARK: - Renderers

private final class LivePipSampleView: UIView {
    override class var layerClass: AnyClass { AVSampleBufferDisplayLayer.self }
    var sampleBufferDisplayLayer: AVSampleBufferDisplayLayer {
        layer as! AVSampleBufferDisplayLayer
    }

    private var lastRotation: VideoRotation = ._0

    func enqueue(_ sampleBuffer: CMSampleBuffer) {
        if #available(iOS 17.0, *) {
            sampleBufferDisplayLayer.sampleBufferRenderer.enqueue(sampleBuffer)
        } else {
            sampleBufferDisplayLayer.enqueue(sampleBuffer)
        }
    }

    /// Drop stale/black frames so PiP gets a fresh keyframe stream.
    func flushForPipHandoff() {
        if #available(iOS 17.0, *) {
            sampleBufferDisplayLayer.sampleBufferRenderer.flush()
        } else {
            sampleBufferDisplayLayer.flushAndRemoveImage()
        }
    }

    /// Match LiveKit's SampleBufferVideoRenderer: CATransform3D rotation,
    /// never mirrored for a remote viewer (mirroring caused the "selfie" look).
    func applyRotationIfNeeded(_ rotation: VideoRotation) {
        guard rotation != lastRotation else { return }
        lastRotation = rotation
        sampleBufferDisplayLayer.transform = CATransform3D.from(rotation: rotation)
        sampleBufferDisplayLayer.frame = bounds
        sampleBufferDisplayLayer.removeAllAnimations()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        sampleBufferDisplayLayer.transform = CATransform3D.from(rotation: lastRotation)
        sampleBufferDisplayLayer.frame = bounds
        sampleBufferDisplayLayer.removeAllAnimations()
    }
}

private final class LivePipPreviewController: UIViewController, VideoRenderer, @unchecked Sendable {
    private lazy var renderingView = LivePipSampleView()

    override func loadView() {
        renderingView.sampleBufferDisplayLayer.videoGravity = .resizeAspectFill
        if #available(iOS 15.0, *) {
            renderingView.sampleBufferDisplayLayer.preventsDisplaySleepDuringVideoPlayback = true
        }
        view = renderingView
    }

    func flushForPipHandoff() {
        renderingView.flushForPipHandoff()
    }

    // Keep frames flowing even when the source view is tiny / briefly hidden —
    // adaptive stream was pausing video before Home→PiP could start.
    var isAdaptiveStreamEnabled: Bool { false }
    var adaptiveStreamSize: CGSize { CGSize(width: 270, height: 480) }

    func render(frame: VideoFrame) {
        guard let sampleBuffer = frame.toCMSampleBuffer() else { return }
        Task { @MainActor in
            renderingView.applyRotationIfNeeded(frame.rotation)
            renderingView.enqueue(sampleBuffer)
            LivePipSession.shared.noteFrameRendered()
        }
    }
}

private final class LivePipVideoCallController: AVPictureInPictureVideoCallViewController, VideoRenderer, @unchecked Sendable {
    private lazy var renderingView = LivePipSampleView()

    override func loadView() {
        renderingView.sampleBufferDisplayLayer.videoGravity = .resizeAspectFill
        if #available(iOS 15.0, *) {
            renderingView.sampleBufferDisplayLayer.preventsDisplaySleepDuringVideoPlayback = true
        }
        view = renderingView
        // Real landscape-ish portrait size — 9×16 pts made iOS open an empty black bubble.
        preferredContentSize = CGSize(width: 270, height: 480)
    }

    func flushForPipHandoff() {
        renderingView.flushForPipHandoff()
    }

    var isAdaptiveStreamEnabled: Bool { false }
    var adaptiveStreamSize: CGSize { CGSize(width: 270, height: 480) }

    func render(frame: VideoFrame) {
        guard let sampleBuffer = frame.toCMSampleBuffer() else { return }
        Task { @MainActor in
            renderingView.applyRotationIfNeeded(frame.rotation)
            renderingView.enqueue(sampleBuffer)
            preferredContentSize = frame.rotatedSize
            LivePipSession.shared.noteFrameRendered()
        }
    }
}

private extension CATransform3D {
    /// Same mapping as LiveKit `SampleBufferVideoRenderer` (no mirroring).
    static func from(rotation: VideoRotation) -> CATransform3D {
        switch rotation {
        case ._0:
            return CATransform3DIdentity
        case ._90:
            return CATransform3DMakeRotation(.pi / 2.0, 0, 0, 1)
        case ._180:
            return CATransform3DMakeRotation(.pi, 0, 0, 1)
        case ._270:
            return CATransform3DMakeRotation(-.pi / 2.0, 0, 0, 1)
        @unknown default:
            return CATransform3DIdentity
        }
    }
}

private extension VideoFrame {
    var rotatedSize: CGSize {
        switch rotation {
        case ._90, ._270:
            return CGSize(width: Int(dimensions.height), height: Int(dimensions.width))
        default:
            return CGSize(width: Int(dimensions.width), height: Int(dimensions.height))
        }
    }
}
