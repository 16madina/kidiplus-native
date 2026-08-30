import ARKit
import AVFoundation
import Foundation
#if canImport(LiveKit)
import LiveKit
#endif
import SCSDKCameraKit
import UIKit

// LiveKit et Snap exportent tous deux `Session` — on force le type Snap.
private typealias CameraKitSession = SCSDKCameraKit.Session

// MARK: - KiDi+ Camera Kit native bridge
//
// SDK Snap natif (SCSDKCameraKit) : preview + lenses.
// Publication LiveKit filtrée : via @livekit/react-native côté JS pour l’instant
// (pas d’import LiveKit Swift — évite l’échec CocoaPods `no such module LiveKit`).
//
// Plain Swift class (no Capacitor / CAPPlugin dependency) so it can be driven
// by any host — currently the ExpoModulesCore `KidiCameraKitModule`. All
// public entry points use completion handlers instead of `CAPPluginCall`, and
// events are forwarded through `onEvent` instead of `notifyListeners`.
final class KidiCameraKitSession: NSObject {
    /// Single native camera pipeline shared across module (re)instantiations.
    static let shared = KidiCameraKitSession()

    /// Forwards native events ("pluginLoaded", "status", "captureState") to
    /// whoever hosts this session (the Expo module re-emits them as JS events).
    var onEvent: ((_ name: String, _ data: [String: Any?]) -> Void)?

    private var cameraKit: CameraKitSession?
    private var captureSession: AVCaptureSession?
    private var sessionInput: AVSessionInput?
    private var previewView: PreviewView?
    private var groupIds: [String] = []
    private var isInitialized = false
    private var sessionStarted = false
    private var cameraPosition: AVCaptureDevice.Position = .front

    private var cachedLenses: [BridgeLens] = []
    private var lensByKey: [String: Lens] = [:]
    private var pendingLoadCompletion: ((Result<[BridgeLens], Error>) -> Void)?
    private var pendingLoadGroups: Set<String> = []
    private var receivedLoadGroups: Set<String> = []
    private var loadTimeoutWork: DispatchWorkItem?

    private let lensQueue = DispatchQueue(label: "com.kidiplus.camerakit.lenses")

    private var frameOutput: KidiCameraKitFrameOutput?
    private var frameCount: Int64 = 0
    private var publishEnabled = false
    private var idleStopWork: DispatchWorkItem?
    #if canImport(LiveKit)
    private var liveKitRoom: Room?
    private var liveKitVideoTrack: LocalVideoTrack?
    private var bufferCapturer: BufferCapturer?
    #endif

    /// RN `KidiCameraKitPreviewView` host. When set, PreviewView is attached
    /// here instead of behind the opaque React root (which would hide AR).
    private weak var previewHost: UIView?

    /// Public Snap client token + default lens group. Used when JS omits
    /// arguments or Info.plist keys are missing from the built binary.
    private static let embeddedApiToken =
        "eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzg0MDQzNzkxLCJzdWIiOiIxOWJhOGM5OC1jMDRhLTRlOTgtOGVkYi04YWM4ZDQyODUzMzN-UFJPRFVDVElPTn43OTRjMjZhNC02ZDg0LTQ5NGYtOGE4Ny04MmZkMmVkZDVmYTUifQ.YE50FTWYfbngNKJGigMDb-I_eVvfASwRF9NRsQ4MD_4"
    private static let embeddedGroupId = "df287f43-6646-4b01-a711-1a0e632c211a"

    private override init() {
        super.init()
        let plistToken = (Bundle.main.object(forInfoDictionaryKey: "SCCameraKitAPIToken") as? String) ?? ""
        let plistGroup = (Bundle.main.object(forInfoDictionaryKey: "SCCameraKitLensGroupID") as? String) ?? ""
        print(
            "[KidiCameraKit] session created plistToken=\(!plistToken.isEmpty) " +
            "plistGroup=\(plistGroup.isEmpty ? "MISSING" : plistGroup) " +
            "embeddedFallback=true"
        )
        let payload: [String: Any?] = [
            "ready": true,
            "plistToken": !plistToken.isEmpty,
            "plistGroup": plistGroup,
        ]
        DispatchQueue.main.async { [weak self] in
            self?.onEvent?("pluginLoaded", payload)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            self?.onEvent?("pluginLoaded", payload)
        }
    }

    // MARK: - status

    func isAvailable() -> [String: Any] {
        let token = defaultApiToken()
        let hasToken = !token.isEmpty
        let supported = KidiCameraKitSession.deviceSupportsCameraKit()
        return [
            "available": supported && hasToken,
            "supported": supported,
            "hasToken": hasToken,
        ]
    }

    func getStatus() -> [String: Any] {
        let plistToken = (Bundle.main.object(forInfoDictionaryKey: "SCCameraKitAPIToken") as? String) ?? ""
        let plistGroup = (Bundle.main.object(forInfoDictionaryKey: "SCCameraKitLensGroupID") as? String) ?? ""
        return [
            "ready": true,
            "initialized": isInitialized,
            "sessionStarted": sessionStarted,
            "captureRunning": captureSession?.isRunning ?? false,
            "publishing": publishEnabled,
            "frameCount": frameCount,
            "plistToken": !plistToken.isEmpty,
            "plistGroup": plistGroup,
        ]
    }

    // MARK: - initialize

    func initialize(apiToken: String?, groupIds: [String]?, completion: @escaping (Result<Void, Error>) -> Void) {
        DispatchQueue.main.async {
            do {
                try self.bootstrapSession(apiToken: apiToken, groupIds: groupIds)
                self.emitStatus("initialized")
                completion(.success(()))
            } catch {
                completion(.failure(error))
            }
        }
    }

    // MARK: - loadLenses

    func loadLenses(groupIds: [String], completion: @escaping (Result<[BridgeLens], Error>) -> Void) {
        guard isInitialized, let session = cameraKit else {
            completion(.failure(KidiCameraKitError.message("CameraKit not initialized — call initialize() first")))
            return
        }
        guard !groupIds.isEmpty else {
            completion(.failure(KidiCameraKitError.message("Missing groupIds")))
            return
        }

        DispatchQueue.main.async {
            self.groupIds = groupIds
            let existing = self.collectLenses(from: session, groupIds: groupIds)
            if !existing.isEmpty {
                completion(.success(existing))
                return
            }

            self.pendingLoadCompletion?(.failure(KidiCameraKitError.message("Superseded by a newer loadLenses call")))
            self.pendingLoadCompletion = completion
            self.pendingLoadGroups = Set(groupIds)
            self.receivedLoadGroups = []

            for groupId in groupIds {
                session.lenses.repository.addObserver(self, groupID: groupId)
            }

            self.loadTimeoutWork?.cancel()
            let timeout = DispatchWorkItem { [weak self] in
                guard let self, let pending = self.pendingLoadCompletion else { return }
                self.pendingLoadCompletion = nil
                let lenses = self.collectLenses(from: session, groupIds: groupIds)
                pending(.success(lenses))
            }
            self.loadTimeoutWork = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: timeout)
        }
    }

    // MARK: - applyLens / clearLens

    func applyLens(lensId: String, groupId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        guard isInitialized, let session = cameraKit else {
            completion(.failure(KidiCameraKitError.message("CameraKit not initialized")))
            return
        }
        guard !lensId.isEmpty else {
            completion(.failure(KidiCameraKitError.message("Missing lensId")))
            return
        }

        lensQueue.async {
            let lens =
                self.lensByKey[self.lensKey(id: lensId, groupId: groupId)]
                ?? session.lenses.repository.lens(id: lensId, groupID: groupId)

            guard let lens else {
                DispatchQueue.main.async {
                    completion(.failure(KidiCameraKitError.message("Lens not found: \(lensId)")))
                }
                return
            }

            guard let processor = session.lenses.processor else {
                DispatchQueue.main.async {
                    // Session pas encore démarrée : on démarre la preview puis on réessaie.
                    self.ensureSessionStarted(facing: self.cameraPosition == .front ? "user" : "environment") { _ in
                        session.lenses.processor?.apply(lens: lens, launchData: nil) { success in
                            if success {
                                completion(.success(()))
                            } else {
                                completion(.failure(KidiCameraKitError.message("Failed to apply lens")))
                            }
                        }
                    }
                }
                return
            }

            processor.apply(lens: lens, launchData: nil) { success in
                DispatchQueue.main.async {
                    if success {
                        print("[KidiCameraKit] applied \(lens.name ?? lensId)")
                        completion(.success(()))
                    } else {
                        completion(.failure(KidiCameraKitError.message("Failed to apply lens")))
                    }
                }
            }
        }
    }

    func clearLens(completion: @escaping (Bool) -> Void) {
        lensQueue.async {
            self.cameraKit?.lenses.processor?.clear { _ in
                DispatchQueue.main.async {
                    print("[KidiCameraKit] clearLens")
                    completion(true)
                }
            } ?? DispatchQueue.main.async {
                completion(true)
            }
        }
    }

    // MARK: - preview

    func startPreview(mirrored: Bool, facing: String, completion: @escaping (Bool) -> Void) {
        DispatchQueue.main.async {
            // Never fail here: the production JS falls back to WASM on any
            // rejection, and startRunning can block while getUserMedia releases
            // the camera. Prepare the session, resolve immediately, start
            // capture in the background.
            do {
                try self.bootstrapSession(apiToken: nil, groupIds: nil)
            } catch {
                print("[KidiCameraKit] startPreview bootstrap: \(error.localizedDescription)")
            }
            self.ensureSessionStarted(facing: facing, waitForCapture: false) { _ in
                if let preview = self.previewView {
                    preview.transform = mirrored ? CGAffineTransform(scaleX: -1, y: 1) : .identity
                }
                print("[KidiCameraKit] startPreview mirrored=\(mirrored) facing=\(facing)")
                self.emitStatus("previewStarted", extra: [
                    "mirrored": mirrored,
                    "facing": facing,
                ])
                completion(true)
            }
        }
    }

    func stopPreview(completion: @escaping (Bool) -> Void) {
        DispatchQueue.main.async {
            self.teardownPreviewOnly()
            print("[KidiCameraKit] stopPreview")
            completion(true)
        }
    }

    func flipCamera(completion: @escaping (Result<String, Error>) -> Void) {
        guard sessionStarted else {
            completion(.failure(KidiCameraKitError.message("Preview is not running")))
            return
        }
        let newFacing = cameraPosition == .front ? "environment" : "user"
        DispatchQueue.main.async {
            self.ensureSessionStarted(facing: newFacing, waitForCapture: true) { success in
                if success {
                    print("[KidiCameraKit] flipCamera facing=\(newFacing)")
                    completion(.success(newFacing))
                } else {
                    completion(.failure(KidiCameraKitError.message("Camera produced no frame after flip")))
                }
            }
        }
    }

    // MARK: - Live publish (Camera Kit frames → LiveKit, like kidiplus.com)

    func setPublishEnabled(
        enabled: Bool,
        roomUrl: String?,
        token: String?,
        completion: @escaping (Result<Bool, Error>) -> Void
    ) {
        if !enabled {
            Task { @MainActor in
                await self.stopPublishing()
                completion(.success(false))
            }
            return
        }
        let url = roomUrl ?? ""
        let tok = token ?? ""
        guard !url.isEmpty, !tok.isEmpty else {
            completion(.failure(KidiCameraKitError.message("Missing roomUrl or token")))
            return
        }
        #if canImport(LiveKit)
        Task { @MainActor in
            do {
                try await self.startPublishing(url: url, token: tok)
                completion(.success(true))
            } catch {
                await self.stopPublishing()
                completion(.failure(error))
            }
        }
        #else
        completion(.failure(KidiCameraKitError.message("LiveKit Swift not linked — rebuild iOS")))
        #endif
    }

    private func attachFrameOutputIfNeeded() {
        guard let cameraKit, frameOutput == nil else { return }
        let output = KidiCameraKitFrameOutput()
        output.onSampleBuffer = { [weak self] sample in
            guard let self else { return }
            self.frameCount += 1
            #if canImport(LiveKit)
            self.bufferCapturer?.capture(sample)
            #endif
        }
        cameraKit.add(output: output)
        frameOutput = output
    }

    #if canImport(LiveKit)
    @MainActor
    private func startPublishing(url: String, token: String) async throws {
        publishEnabled = true
        idleStopWork?.cancel()
        idleStopWork = nil
        frameCount = 0
        frameOutput?.resetFrameFlag()

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            do {
                try bootstrapSession(apiToken: nil, groupIds: nil)
            } catch {
                print("[KidiCameraKit] publish bootstrap: \(error.localizedDescription)")
            }
            ensureSessionStarted(
                facing: cameraPosition == .front ? "user" : "environment",
                waitForCapture: true
            ) { ok in
                if ok {
                    cont.resume()
                } else {
                    cont.resume(throwing: KidiCameraKitError.message("Camera preview failed to start"))
                }
            }
        }

        guard isInitialized, cameraKit != nil else {
            throw KidiCameraKitError.message("Camera Kit session missing")
        }

        attachFrameOutputIfNeeded()

        let room = liveKitRoom ?? Room()
        liveKitRoom = room
        if room.connectionState != .connected {
            try await withTimeout(seconds: 12) {
                try await room.connect(url: url, token: token)
            }
        }

        let videoTrack = LocalVideoTrack.createBufferTrack(
            name: "camera",
            source: .camera,
            options: BufferCaptureOptions()
        )
        liveKitVideoTrack = videoTrack
        bufferCapturer = videoTrack.capturer as? BufferCapturer

        let gotFrame = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            var resumed = false
            frameOutput?.onFirstFrame = {
                guard !resumed else { return }
                resumed = true
                cont.resume(returning: true)
            }
            if frameOutput?.didEmitFrame == true {
                guard !resumed else { return }
                resumed = true
                cont.resume(returning: true)
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                guard !resumed else { return }
                resumed = true
                cont.resume(returning: false)
            }
        }
        if !gotFrame && frameCount == 0 {
            throw KidiCameraKitError.message("Camera Kit produced no published frame")
        }

        try await room.localParticipant.publish(videoTrack: videoTrack)
        _ = try? await room.localParticipant.setMicrophone(enabled: true)
        print("[KidiCameraKit] LiveKit video published frames=\(frameCount)")
    }

    @MainActor
    private func stopPublishing() async {
        publishEnabled = false
        bufferCapturer = nil
        if let publication = liveKitRoom?.localParticipant.trackPublications.values
            .compactMap({ $0 as? LocalTrackPublication })
            .first(where: { $0.source == .camera })
        {
            try? await liveKitRoom?.localParticipant.unpublish(publication: publication)
        }
        liveKitVideoTrack = nil
        await liveKitRoom?.disconnect()
        liveKitRoom = nil
        if previewView?.superview == nil {
            sessionInput?.stopRunning()
        }
        print("[KidiCameraKit] LiveKit publish stopped")
    }

    private func withTimeout<T>(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw KidiCameraKitError.message("Timed out after \(Int(seconds))s")
            }
            guard let result = try await group.next() else {
                throw KidiCameraKitError.message("Timed out")
            }
            group.cancelAll()
            return result
        }
    }
    #else
    @MainActor
    private func stopPublishing() async {
        publishEnabled = false
    }
    #endif
}

// MARK: - Preview host (accessed from KidiCameraKitPreviewView)

extension KidiCameraKitSession {
    func registerPreviewHost(_ host: UIView) {
        previewHost = host
        if let preview = previewView {
            attachPreview(preview)
        }
    }

    func unregisterPreviewHost(_ host: UIView) {
        guard previewHost === host else { return }
        previewHost = nil
        previewView?.removeFromSuperview()
    }

    func layoutPreview(in bounds: CGRect) {
        previewView?.frame = bounds
    }
}

// MARK: - Session lifecycle

private extension KidiCameraKitSession {
    func defaultApiToken() -> String {
        let plist = (Bundle.main.object(forInfoDictionaryKey: "SCCameraKitAPIToken") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return plist.isEmpty ? Self.embeddedApiToken : plist
    }

    func defaultGroupIds() -> [String] {
        let id = (Bundle.main.object(forInfoDictionaryKey: "SCCameraKitLensGroupID") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let resolved = id.isEmpty ? Self.embeddedGroupId : id
        return resolved.isEmpty ? [] : [resolved]
    }

    /// Rough on-device capability check (no Capacitor/CAPPlugin `bridge` to
    /// query anymore): a physical camera plus the deployment target's minimum
    /// iOS version is a good enough proxy for "Camera Kit can run here".
    static func deviceSupportsCameraKit() -> Bool {
        AVCaptureDevice.default(for: .video) != nil
    }

    func bootstrapSession(apiToken: String?, groupIds: [String]?) throws {
        let token = (apiToken?.isEmpty == false ? apiToken : nil) ?? defaultApiToken()
        let groups = (groupIds?.isEmpty == false ? groupIds : nil) ?? defaultGroupIds()
        print(
            "[KidiCameraKit] bootstrap jsToken=\(apiToken?.isEmpty == false) " +
            "jsGroups=\(groupIds?.count ?? 0) usingTokenLen=\(token.count) groups=\(groups)"
        )
        guard !token.isEmpty else {
            throw KidiCameraKitError.message("Missing apiToken")
        }
        guard !groups.isEmpty else {
            throw KidiCameraKitError.message("Missing groupIds")
        }

        self.groupIds = groups
        if cameraKit == nil {
            let lensesConfig = LensesConfig(
                cacheConfig: CacheConfig(lensContentMaxSize: 150 * 1024 * 1024)
            )
            cameraKit = CameraKitSession(
                sessionConfig: SessionConfig(apiToken: token),
                lensesConfig: lensesConfig,
                errorHandler: nil
            )
        }
        guard let session = cameraKit else {
            throw KidiCameraKitError.message("Failed to create Camera Kit session")
        }
        for groupId in groups {
            session.lenses.repository.addObserver(self, groupID: groupId)
        }
        isInitialized = true
        print("[KidiCameraKit] initialized groups=\(groups.joined(separator: ","))")
        emitStatus("bootstrapped", extra: ["groups": groups.joined(separator: ",")])
    }

    func emitStatus(_ phase: String, extra: [String: Any] = [:]) {
        var data: [String: Any?] = [
            "phase": phase,
            "initialized": isInitialized,
            "sessionStarted": sessionStarted,
            "captureRunning": captureSession?.isRunning ?? false,
        ]
        extra.forEach { data[$0.key] = $0.value }
        onEvent?("status", data)
    }

    func ensureSessionStarted(facing: String, waitForCapture: Bool = true, completion: @escaping (Bool) -> Void) {
        cameraPosition = facing == "environment" ? .back : .front
        idleStopWork?.cancel()
        idleStopWork = nil

        guard let cameraKit else {
            print("[KidiCameraKit] ensureSessionStarted: session missing (call initialize first)")
            completion(false)
            return
        }

        requestCameraAccess { [weak self] granted in
            guard let self else { return }
            guard granted else {
                print("[KidiCameraKit] camera permission denied")
                completion(false)
                return
            }

            let captureSession = self.captureSession ?? AVCaptureSession()
            self.captureSession = captureSession

            captureSession.beginConfiguration()
            // Reset video inputs when flipping.
            for input in captureSession.inputs {
                if let deviceInput = input as? AVCaptureDeviceInput,
                   deviceInput.device.hasMediaType(.video)
                {
                    captureSession.removeInput(deviceInput)
                }
            }
            if let device = AVCaptureDevice.default(
                .builtInWideAngleCamera,
                for: .video,
                position: self.cameraPosition
            ),
                let deviceInput = try? AVCaptureDeviceInput(device: device),
                captureSession.canAddInput(deviceInput)
            {
                captureSession.addInput(deviceInput)
            }
            captureSession.commitConfiguration()

            let input = self.sessionInput ?? AVSessionInput(session: captureSession)
            self.sessionInput = input
            let arInput = ARSessionInput()

            if !self.sessionStarted {
                // Prefer Snap's default start (front + portrait). Avoids passing
                // AVCaptureVideoOrientation, which Apple deprecated in iOS 17 —
                // Snap's longer overloads still require that type in their headers.
                cameraKit.start(input: input, arInput: arInput)
                cameraKit.cameraPosition = self.cameraPosition
                self.sessionStarted = true
            } else {
                cameraKit.cameraPosition = self.cameraPosition
            }

            let preview = self.previewView ?? PreviewView()
            preview.automaticallyConfiguresTouchHandler = true
            preview.translatesAutoresizingMaskIntoConstraints = true
            preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            if self.previewView == nil {
                cameraKit.add(output: preview)
                self.previewView = preview
            }
            self.attachPreview(preview)
            self.attachFrameOutputIfNeeded()

            if waitForCapture {
                self.startCaptureWithRetry(input: input, attempt: 0, completion: completion)
            } else {
                self.startCaptureWithRetry(input: input, attempt: 0) { running in
                    print("[KidiCameraKit] capture running=\(running)")
                }
                completion(true)
            }
        }
    }

    func startCaptureWithRetry(
        input: AVSessionInput,
        attempt: Int,
        completion: @escaping (Bool) -> Void
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            input.startRunning()
            let running = self.captureSession?.isRunning == true
            if !running && attempt < 5 {
                print("[KidiCameraKit] camera not running yet, retry \(attempt + 1)")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    self.startCaptureWithRetry(input: input, attempt: attempt + 1, completion: completion)
                }
                return
            }
            DispatchQueue.main.async {
                print("[KidiCameraKit] capture running=\(running) attempt=\(attempt)")
                self.onEvent?("captureState", ["running": running])
                if !running {
                    print("[KidiCameraKit] camera failed to start after retries")
                }
                completion(running)
            }
        }
    }

    /// Prefer the Expo RN preview host; fall back to key-window root.
    func attachPreview(_ preview: UIView) {
        guard let host = previewHost ?? Self.keyWindowRootView() else { return }
        if preview.superview !== host {
            preview.removeFromSuperview()
            preview.frame = host.bounds
            host.insertSubview(preview, at: 0)
        } else {
            preview.frame = host.bounds
        }
    }

    static func keyWindowRootView() -> UIView? {
        let windowScenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let keyWindow = windowScenes
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? windowScenes.first?.windows.first
        return keyWindow?.rootViewController?.view
    }

    func teardownPreviewOnly() {
        previewView?.removeFromSuperview()
        // Delay stopping capture so setup → live does not kill the session
        // (CameraKitPreview unmounts and calls stopPreview first).
        idleStopWork?.cancel()
        guard !publishEnabled else { return }
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.publishEnabled else { return }
            self.sessionInput?.stopRunning()
            print("[KidiCameraKit] idle camera stopped")
        }
        idleStopWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: work)
    }

    func requestCameraAccess(completion: @escaping (Bool) -> Void) {
        let finish: (Bool) -> Void = { granted in
            if Thread.isMainThread {
                completion(granted)
            } else {
                DispatchQueue.main.async { completion(granted) }
            }
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            finish(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                finish(granted)
            }
        default:
            finish(false)
        }
    }
}


// MARK: - Lens repository

extension KidiCameraKitSession: LensRepositoryGroupObserver {
    func repository(
        _ repository: LensRepository,
        didUpdateLenses lenses: [Lens],
        forGroupID groupID: String
    ) {
        DispatchQueue.main.async {
            for lens in lenses {
                self.lensByKey[self.lensKey(id: lens.id, groupId: lens.groupId)] = lens
            }
            _ = self.cameraKit?.lenses.prefetcher.prefetch(lenses: lenses, completion: nil)

            guard self.pendingLoadCompletion != nil else { return }
            self.receivedLoadGroups.insert(groupID)
            if self.receivedLoadGroups.isSuperset(of: self.pendingLoadGroups) {
                self.finishPendingLoad()
            }
        }
    }

    func repository(
        _ repository: LensRepository,
        didFailToUpdateLensesForGroupID groupID: String,
        error: Error?
    ) {
        DispatchQueue.main.async {
            print("[KidiCameraKit] lens group \(groupID) failed: \(error?.localizedDescription ?? "unknown")")
            guard self.pendingLoadCompletion != nil else { return }
            self.receivedLoadGroups.insert(groupID)
            if self.receivedLoadGroups.isSuperset(of: self.pendingLoadGroups) {
                self.finishPendingLoad()
            }
        }
    }

    private func finishPendingLoad() {
        loadTimeoutWork?.cancel()
        loadTimeoutWork = nil
        guard let completion = pendingLoadCompletion, let session = cameraKit else { return }
        pendingLoadCompletion = nil
        let lenses = collectLenses(from: session, groupIds: Array(pendingLoadGroups))
        completion(.success(lenses))
    }

    private func collectLenses(from session: CameraKitSession, groupIds: [String]) -> [BridgeLens] {
        var result: [BridgeLens] = []
        for groupId in groupIds {
            for lens in session.lenses.repository.lenses(groupID: groupId) {
                lensByKey[lensKey(id: lens.id, groupId: lens.groupId)] = lens
                result.append(
                    BridgeLens(
                        id: lens.id,
                        groupId: lens.groupId,
                        name: lens.name ?? "Lens",
                        iconUrl: lens.iconUrl?.absoluteString,
                        previewUrl: nil
                    )
                )
            }
        }
        cachedLenses = result
        return result
    }

    private func lensKey(id: String, groupId: String) -> String {
        "\(groupId)|\(id)"
    }
}

// MARK: - Helpers

struct BridgeLens {
    let id: String
    let groupId: String
    let name: String
    let iconUrl: String?
    let previewUrl: String?

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "id": id,
            "groupId": groupId,
            "name": name,
        ]
        if let iconUrl { dict["iconUrl"] = iconUrl }
        if let previewUrl { dict["previewUrl"] = previewUrl }
        return dict
    }
}

enum KidiCameraKitError: LocalizedError {
    case message(String)

    var errorDescription: String? {
        switch self {
        case .message(let text):
            return text
        }
    }
}
