package com.kidiplus.camerakit

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.view.ViewGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.snap.camerakit.ImageProcessor
import com.snap.camerakit.Session
import com.snap.camerakit.invoke
import com.snap.camerakit.lenses.LensesComponent
import com.snap.camerakit.lenses.whenHasFirst
import com.snap.camerakit.support.camerax.CameraXImageProcessorSource
import com.snap.camerakit.supported
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.participant.VideoTrackPublishOptions
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.LocalVideoTrackOptions
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.VideoCaptureParameter
import io.livekit.android.room.track.VideoEncoding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import livekit.org.webrtc.CapturerObserver
import livekit.org.webrtc.SurfaceTextureHelper
import livekit.org.webrtc.VideoCapturer
import livekit.org.webrtc.VideoFrame
import java.io.Closeable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Snap Camera Kit (native) + LiveKit publisher for the KiDi+ Expo Android app.
 *
 * Plain Kotlin session object — no Capacitor and no Expo types leak in here
 * (besides plain Android APIs). It is owned and driven by
 * [KidiCameraKitModule], which adapts its suspend-function API to Expo's
 * `AsyncFunction`s and forwards [Listener] callbacks to `sendEvent`.
 *
 * Design rules, each one earned from a previous black-screen regression on
 * the Capacitor build this was ported from:
 *
 *  1. ONE camera pipeline: CameraX -> Camera Kit session -> outputs. Outputs
 *     are (a) a TextureView for local display and (b) a LiveKit external
 *     video capturer. The RN JS layer must never open its own camera while
 *     this session is publishing.
 *  2. Display uses a **TextureView**, not a SurfaceView: it composites inside
 *     the normal view hierarchy (inserted behind the Activity's content root,
 *     the same trick the old Capacitor build used behind the WebView), so
 *     there are no separate-window z-order fights.
 *  3. Every session/view/CameraX call runs on the MAIN thread. Expo dispatches
 *     `AsyncFunction`s on a background queue by default; binding CameraX
 *     there produced a silent zero-frame camera on the Capacitor build.
 *  4. There is no WebView to reveal/hide here (this is RN, not a hybrid
 *     WebView app): callers are notified through [Listener.onFirstFrame] and
 *     are expected to reveal their own native camera surface once it fires.
 *  5. A watchdog verifies frames keep flowing. No frames for >3s after start or
 *     after applying a lens -> clear the lens, notify JS ("fallback") so the
 *     RN layer can revert to a plain (non-filtered) camera. The live must
 *     never stay black.
 *
 * API token: read from AndroidManifest meta-data `com.snap.camerakit.api.token`
 * (JS may also pass `apiToken`, which wins if present).
 */
class KidiCameraKitSession(
    private val context: Context,
    private val activityProvider: () -> Activity?,
) {
    /** Bridges native session events to [KidiCameraKitModule.sendEvent]. */
    interface Listener {
        fun onStatus(phase: String, data: Map<String, Any?>)
        fun onFallback(reason: String)
        fun onFirstFrame(frameCount: Long)
        fun onCaptureState(running: Boolean)
        fun onCaptureProfile(width: Int, height: Int, fps: Int)
    }

    var listener: Listener? = null

    private val activity: Activity?
        get() = activityProvider()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Serializes session creation / preview start. */
    private val lock = Any()

    private var session: Session? = null
    private var imageSource: CameraXImageProcessorSource? = null
    private var groupIds: List<String> = emptyList()
    private var initialized = false

    // Preview (display) state
    private var previewView: TextureView? = null
    private var previewOutput: Closeable? = null
    private var previewRequested = false
    private var previewStarted = false
    private var previewStarting = false
    private val previewCallbacks = mutableListOf<(Boolean) -> Unit>()
    private var facingFront = true
    private var mirrored = false

    // Lens state
    private var cachedLenses: List<Map<String, Any?>> = emptyList()
    private val lensByKey = mutableMapOf<String, LensesComponent.Lens>()
    private var lensObserve: Closeable? = null
    private var currentLensKey: String? = null

    // Frame health (any output: preview or LiveKit)
    private val frameCount = AtomicLong(0)
    private val lastFrameAt = AtomicLong(0)
    private var watchdog: Job? = null

    // LiveKit publication
    private var liveKitRoom: Room? = null
    private var liveKitTrack: LocalVideoTrack? = null
    private var publishCapturer: CameraKitSurfaceCapturer? = null
    private var publishOutput: Closeable? = null
    private var publishEnabled = false

    // Adaptive capture profile (Camera Kit output size + publish encoding).
    private var profileIndex = 0
    private var adaptiveJob: Job? = null

    // ---------------------------------------------------------------- status

    fun isAvailable(): Map<String, Any?> {
        val act = activity
        val isSupported = act != null && supported(act)
        val hasToken = resolveToken(null).isNotEmpty()
        return mapOf(
            "available" to (isSupported && hasToken),
            "supported" to isSupported,
            "hasToken" to hasToken,
        )
    }

    fun getStatus(): Map<String, Any?> {
        val last = lastFrameAt.get()
        return mapOf(
            "ready" to true,
            "initialized" to initialized,
            "sessionStarted" to previewStarted,
            "captureRunning" to previewStarted,
            "publishing" to publishEnabled,
            "frameCount" to frameCount.get(),
            "lastFrameAgeMs" to if (last > 0) SystemClock.elapsedRealtime() - last else 0,
            "lensId" to currentLensKey?.substringAfter('|').orEmpty(),
        )
    }

    // ------------------------------------------------------------ initialize

    suspend fun initialize(apiToken: String, groupIds: List<String>): Map<String, Any?> {
        val token = resolveToken(apiToken)
        if (token.isEmpty()) {
            throw IllegalStateException(
                "Missing Camera Kit API token (JS apiToken or manifest meta-data com.snap.camerakit.api.token)",
            )
        }
        val ids = groupIds.filter { it.isNotEmpty() }
        if (ids.isEmpty()) {
            throw IllegalStateException("Missing groupIds")
        }
        val act = activity ?: throw IllegalStateException("Activity unavailable")
        if (!supported(act)) {
            throw IllegalStateException("Camera Kit is not supported on this device")
        }

        this.groupIds = ids
        synchronized(lock) {
            if (session == null) {
                try {
                    // Session creation touches the view hierarchy internally →
                    // main thread only (CalledFromWrongThreadException otherwise).
                    runOnUiBlocking {
                        val source = CameraXImageProcessorSource(
                            context = act,
                            lifecycleOwner = act as LifecycleOwner,
                        )
                        imageSource = source
                        // No attachTo(): we own the rendering (TextureView) and
                        // the LiveKit output. Camera Kit's bundled CameraLayout
                        // uses a SurfaceView, which is what caused the
                        // separate-window black-screen composition bugs.
                        session = Session(context = act) {
                            apiToken(token)
                            imageProcessorSource(source)
                        }
                    }
                } catch (t: Throwable) {
                    Log.e(TAG, "session create failed", t)
                    cleanupSession()
                    throw IllegalStateException("Camera Kit init failed: ${t.message}", t)
                }
            }
        }
        initialized = true
        Log.i(TAG, "initialized groups=${ids.joinToString(",")}")
        emit("initialized", mapOf("groups" to ids.joinToString(",")))
        return mapOf("initialized" to true)
    }

    // ---------------------------------------------------------------- lenses

    suspend fun loadLenses(requestedGroupIds: List<String>): Map<String, Any?> {
        val s = session
        if (!initialized || s == null) {
            throw IllegalStateException("CameraKit not initialized — call initialize() first")
        }
        val ids = requestedGroupIds.filter { it.isNotEmpty() }.ifEmpty { groupIds }
        if (ids.isEmpty()) {
            throw IllegalStateException("Missing groupIds")
        }
        groupIds = ids
        lensObserve?.close()

        return suspendCancellableCoroutine { cont ->
            var resolved = false
            fun finish(list: List<Map<String, Any?>>) {
                if (resolved || !cont.isActive) return
                resolved = true
                cont.resume(mapOf("lenses" to list))
            }

            lensObserve = s.lenses.repository.observe(
                LensesComponent.Repository.QueryCriteria.Available(ids.toSet()),
            ) { result ->
                if (result is LensesComponent.Repository.Result.Some) {
                    cachedLenses = result.lenses.map { lens ->
                        lensByKey[key(lens.id, lens.groupId)] = lens
                        lens.toMap()
                    }
                    finish(cachedLenses)
                }
            }
            // Never hang the carousel: resolve with whatever we have after 8s.
            val timeoutJob = scope.launch {
                delay(LOAD_LENSES_TIMEOUT_MS)
                finish(cachedLenses)
            }
            cont.invokeOnCancellation { timeoutJob.cancel() }
        }
    }

    suspend fun applyLens(lensId: String, groupId: String): Map<String, Any?> {
        val s = session
        if (!initialized || s == null) {
            throw IllegalStateException("CameraKit not initialized")
        }
        if (lensId.isEmpty()) {
            throw IllegalStateException("Missing lensId")
        }
        val resolvedGroupId = groupId.ifEmpty { groupIds.firstOrNull().orEmpty() }

        previewRequested = true
        if (!ensurePreviewSuspend()) {
            throw IllegalStateException("Camera preview failed to start")
        }

        val baseline = frameCount.get()
        val lens = lensByKey[key(lensId, resolvedGroupId)]
            ?: awaitLensById(s, lensId, resolvedGroupId)

        val applied = applyLensToProcessor(s, lens)
        if (!applied) {
            Log.w(TAG, "lens apply rejected id=$lensId")
            throw IllegalStateException("Failed to apply lens")
        }
        currentLensKey = key(lens.id, lens.groupId)

        // Only report success once real frames come out of the lens.
        if (!awaitFrames(baseline, LENS_FRAME_TIMEOUT_MS)) {
            Log.e(TAG, "lens produced no frame — reverting")
            revertToRawCamera("lens_no_frame")
            throw IllegalStateException("Lens produced no video frame")
        }
        return mapOf("applied" to true, "frameCount" to frameCount.get())
    }

    private suspend fun awaitLensById(
        s: Session,
        lensId: String,
        groupId: String,
    ): LensesComponent.Lens {
        val lens = withTimeoutOrNull(LENS_LOOKUP_TIMEOUT_MS) {
            suspendCancellableCoroutine<LensesComponent.Lens> { cont ->
                val closeable = s.lenses.repository.observe(
                    LensesComponent.Repository.QueryCriteria.ById(lensId, groupId),
                ) { result ->
                    result.whenHasFirst { lens ->
                        lensByKey[key(lens.id, lens.groupId)] = lens
                        if (cont.isActive) cont.resume(lens)
                    }
                }
                cont.invokeOnCancellation { closeable.close() }
            }
        }
        return lens ?: throw IllegalStateException("Lens not found: $lensId")
    }

    private suspend fun applyLensToProcessor(s: Session, lens: LensesComponent.Lens): Boolean =
        suspendCancellableCoroutine { cont ->
            s.lenses.processor.apply(lens) { applied ->
                if (cont.isActive) cont.resume(applied)
            }
        }

    suspend fun clearLens(): Map<String, Any?> {
        currentLensKey = null
        val processor = session?.lenses?.processor ?: return mapOf("cleared" to true)
        return suspendCancellableCoroutine { cont ->
            processor.clear {
                if (cont.isActive) cont.resume(mapOf("cleared" to true))
            }
        }
    }

    // --------------------------------------------------------------- preview

    suspend fun startPreview(mirrored: Boolean, facing: String): Map<String, Any?> {
        facingFront = facing != "environment"
        this.mirrored = mirrored
        previewRequested = true
        if (!ensurePreviewSuspend()) {
            throw IllegalStateException("Camera preview failed to start")
        }
        applyMirrorState()
        emit("previewStarted", mapOf("facingFront" to facingFront, "mirrored" to mirrored))
        listener?.onCaptureState(true)
        return mapOf("started" to true)
    }

    suspend fun stopPreview(): Map<String, Any?> {
        if (publishEnabled) {
            // The preview surface is also the publisher's input; report honestly
            // instead of pretending the camera was released.
            return mapOf("stopped" to false, "reason" to "publishing")
        }
        previewRequested = false
        teardownPreviewSuspend()
        return mapOf("stopped" to true)
    }

    suspend fun flipCamera(): Map<String, Any?> {
        if (!previewStarted) {
            throw IllegalStateException("Preview is not running")
        }
        facingFront = !facingFront
        val source = imageSource ?: throw IllegalStateException("Camera source unavailable")
        val baseline = frameCount.get()

        return suspendCancellableCoroutine { cont ->
            runOnUi {
                try {
                    // Same pipeline, different CameraX selector.
                    source.startPreview(facingFront)
                } catch (e: Exception) {
                    Log.e(TAG, "flipCamera failed", e)
                    if (cont.isActive) cont.resumeWithException(IllegalStateException("Flip failed: ${e.message}", e))
                    return@runOnUi
                }
                scope.launch {
                    val ok = awaitFrames(baseline, START_FRAME_TIMEOUT_MS)
                    if (!ok) revertToRawCamera("flip_no_frame")
                    if (cont.isActive) {
                        if (ok) {
                            cont.resume(
                                mapOf(
                                    "flipped" to true,
                                    "facing" to if (facingFront) "user" else "environment",
                                ),
                            )
                        } else {
                            cont.resumeWithException(IllegalStateException("Camera produced no frame after flip"))
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------ publishing

    suspend fun setPublishEnabled(enabled: Boolean, roomUrl: String?, token: String?): Map<String, Any?> {
        if (!enabled) {
            stopPublishing()
            return mapOf("enabled" to false)
        }
        val url = roomUrl.orEmpty()
        val tok = token.orEmpty()
        if (url.isEmpty() || tok.isEmpty()) {
            throw IllegalStateException("Missing roomUrl or token")
        }
        return try {
            startPublishing(url, tok)
            mapOf("enabled" to true)
        } catch (e: Exception) {
            Log.e(TAG, "setPublishEnabled failed", e)
            stopPublishing()
            throw IllegalStateException("Publish failed: ${e.message}", e)
        }
    }

    private suspend fun startPublishing(url: String, token: String) {
        publishEnabled = true
        previewRequested = true
        val act = activity ?: throw IllegalStateException("no activity")
        val s = session ?: throw IllegalStateException("Camera Kit session missing")

        // Go-live speed: the LiveKit room connect (signalling + ICE, ~0.5-1.5s)
        // runs CONCURRENTLY with CameraX + Camera Kit warmup instead of after
        // it. By the time the first filtered frame exists, the room is joined.
        val room = liveKitRoom ?: LiveKit.create(act.applicationContext)
        liveKitRoom = room
        val connecting = scope.async { runCatching { room.connect(url, token) } }

        val ok = ensurePreviewSuspend()
        if (!ok) {
            publishEnabled = false
            connecting.cancel()
            throw IllegalStateException("Camera preview failed to start — refusing to publish black frames")
        }
        connecting.await().getOrThrow()

        val baseline = frameCount.get()
        val profile = currentProfile()
        val capturer = CameraKitSurfaceCapturer(
            session = s,
            width = profile.width,
            height = profile.height,
            fps = profile.fps,
            onConnected = { handle -> publishOutput = handle },
            onFrame = { onFrame() },
        )
        publishCapturer = capturer
        val track = room.localParticipant.createVideoTrack(
            name = "camera",
            capturer = capturer,
            // adaptOutputToDimensions = false: our capturer already emits the
            // exact target size, so LiveKit must not insert a per-frame
            // scale/crop processor on top of the Camera Kit output.
            options = LocalVideoTrackOptions(
                isScreencast = false,
                captureParams = VideoCaptureParameter(
                    profile.width,
                    profile.height,
                    profile.fps,
                    adaptOutputToDimensions = false,
                ),
            ),
        )
        liveKitTrack = track
        // publishVideoTrack() does not start an external capturer; without this
        // no frame ever reaches LiveKit ("no video frame within 5000ms").
        track.startCapture()
        room.localParticipant.publishVideoTrack(
            track,
            VideoTrackPublishOptions(
                videoEncoding = VideoEncoding(profile.bitrate, profile.fps),
                // Simulcast on a custom (texture) source means 2-3 extra
                // encoder instances on the same GPU/CPU that Camera Kit is
                // already using — the main cause of slow-motion video on
                // mid-range Android. One stream only.
                simulcast = false,
                source = Track.Source.CAMERA,
            ),
        )
        Log.i(TAG, "publish profile ${profile.width}x${profile.height}@${profile.fps} ${profile.bitrate}bps simulcast=false")
        if (!awaitFrames(baseline, PUBLISH_FRAME_TIMEOUT_MS)) {
            throw IllegalStateException("Camera Kit produced no published frame")
        }
        startAdaptiveMonitor()
        try {
            room.localParticipant.setMicrophoneEnabled(true)
        } catch (e: Exception) {
            Log.w(TAG, "mic publish failed", e)
        }
        Log.i(TAG, "LiveKit video published")
    }

    private suspend fun stopPublishing() {
        publishEnabled = false
        stopAdaptiveMonitor()
        publishOutput?.close()
        publishOutput = null
        runCatching { liveKitTrack?.stopCapture() }
        runCatching { liveKitTrack?.stop() }
        liveKitTrack = null
        publishCapturer = null
        runCatching { liveKitRoom?.disconnect() }
        liveKitRoom = null
        if (!previewRequested) teardownPreviewSuspend()
        Log.i(TAG, "LiveKit publish stopped")
    }

    // ------------------------------------------------- adaptive quality ladder

    private fun currentProfile(): CaptureProfile =
        CAPTURE_PROFILES[profileIndex.coerceIn(0, CAPTURE_PROFILES.lastIndex)]

    /**
     * Watches the fps actually delivered to LiveKit. If the device cannot hold
     * the current profile (<20fps sustained over two windows), step DOWN once
     * per window: a smooth 540p/480p beats a stuttering 720p. Stepping is
     * one-way — we never oscillate.
     */
    private fun startAdaptiveMonitor() {
        stopAdaptiveMonitor()
        adaptiveJob = scope.launch {
            var lowWindows = 0
            var last = publishCapturer?.deliveredFrames() ?: 0L
            var lastAt = SystemClock.elapsedRealtime()
            // Ignore the first seconds: camera + encoder are still ramping up.
            delay(ADAPT_WARMUP_MS)
            last = publishCapturer?.deliveredFrames() ?: last
            lastAt = SystemClock.elapsedRealtime()
            while (publishEnabled) {
                delay(ADAPT_WINDOW_MS)
                val capturer = publishCapturer ?: continue
                val now = SystemClock.elapsedRealtime()
                val frames = capturer.deliveredFrames()
                val elapsed = (now - lastAt).coerceAtLeast(1)
                val fps = (frames - last) * 1000.0 / elapsed
                last = frames
                lastAt = now
                if (fps < ADAPT_MIN_FPS && profileIndex < CAPTURE_PROFILES.lastIndex) {
                    lowWindows++
                    if (lowWindows >= 2) {
                        lowWindows = 0
                        profileIndex++
                        val p = currentProfile()
                        Log.w(
                            TAG,
                            "delivered fps=${"%.1f".format(fps)} — stepping down to ${p.width}x${p.height}@${p.fps}",
                        )
                        runCatching { capturer.changeCaptureFormat(p.width, p.height, p.fps) }
                        listener?.onCaptureProfile(p.width, p.height, p.fps)
                    }
                } else {
                    lowWindows = 0
                }
            }
        }
    }

    private fun stopAdaptiveMonitor() {
        adaptiveJob?.cancel()
        adaptiveJob = null
    }

    // ------------------------------------------------------------- lifecycle

    /** Call from the module's `OnActivityEntersBackground` hook. */
    fun onHostPause() {
        if (!previewRequested && !publishEnabled) return
        // CameraX is lifecycle-bound: use-cases are dropped when the activity
        // stops. Drop `previewStarted` so resume rebinds instead of trusting a
        // frozen frame.
        previewStarted = false
        previewStarting = false
        stopWatchdog()
        runOnUi { runCatching { imageSource?.stopPreview() } }
        Log.i(TAG, "activity stopped; preview marked for rebind")
    }

    /** Call from the module's `OnActivityEntersForeground` hook. */
    fun onHostResume() {
        if (!initialized || (!previewRequested && !publishEnabled)) return
        Log.i(TAG, "activity resumed; rebinding preview")
        ensurePreview { ok ->
            if (ok) emit("previewResumed") else revertToRawCamera("resume_failed")
        }
    }

    /** Call from the module's `OnDestroy` hook. */
    fun onHostDestroy() {
        lensObserve?.close()
        lensObserve = null
        stopWatchdog()
        runCatching { runBlocking { stopPublishing() } }
        teardownPreviewSync()
        cleanupSession()
        scope.cancel()
    }

    private fun cleanupSession() {
        runCatching { session?.close() }
        session = null
        imageSource = null
        initialized = false
    }

    // ------------------------------------------------------- preview plumbing

    private suspend fun ensurePreviewSuspend(): Boolean = suspendCancellableCoroutine { cont ->
        ensurePreview { ok -> if (cont.isActive) cont.resume(ok) }
    }

    private suspend fun teardownPreviewSuspend() {
        suspendCancellableCoroutine<Unit> { cont ->
            teardownPreview { if (cont.isActive) cont.resume(Unit) }
        }
    }

    private fun ensurePreview(done: (ok: Boolean) -> Unit) {
        val act = activity
        val source = imageSource
        if (act == null || source == null) {
            done(false)
            return
        }
        synchronized(lock) {
            if (previewStarted) {
                done(true)
                return
            }
            previewCallbacks.add(done)
            if (previewStarting) return
            previewStarting = true
        }

        val start = {
            runOnUi {
                if (previewStarted) {
                    finishPreview(true)
                    return@runOnUi
                }
                attachPreviewView()
                // CameraXImageProcessorSource can leave stale use-cases bound;
                // unbind and let the camera service close before rebinding.
                forceReleaseCameraX {
                    try {
                        source.startPreview(facingFront)
                        previewStarted = true
                        startWatchdog()
                        finishPreview(true)
                    } catch (e: Exception) {
                        Log.e(TAG, "startPreview failed", e)
                        finishPreview(false)
                    }
                }
            }
        }

        if (ContextCompat.checkSelfPermission(act, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            start()
        } else {
            ActivityCompat.requestPermissions(
                act,
                arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
                REQ_CAMERA,
            )
            postDelayed(500) { start() }
        }
    }

    private fun finishPreview(ok: Boolean) {
        val callbacks = synchronized(lock) {
            previewStarted = ok
            previewStarting = false
            previewCallbacks.toList().also { previewCallbacks.clear() }
        }
        callbacks.forEach { cb -> runCatching { cb(ok) } }
    }

    /** Inserts the TextureView BEHIND the Activity's content root (index 0)
     * and connects it as a Camera Kit preview output as soon as its
     * SurfaceTexture exists. There is no WebView to hide here: the RN layer
     * is expected to keep its own background transparent where the camera
     * should show through, and to reveal it once [Listener.onFirstFrame]
     * fires. */
    private fun attachPreviewView() {
        if (previewView != null) return
        val act = activity ?: return
        val parent = act.findViewById<ViewGroup>(android.R.id.content) ?: return
        val view = TextureView(act).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            isOpaque = true
            scaleX = if (mirrored) -1f else 1f
            surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) {
                    connectPreviewOutput(st)
                }

                override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) = Unit

                override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
                    previewOutput?.close()
                    previewOutput = null
                    return true
                }

                override fun onSurfaceTextureUpdated(st: SurfaceTexture) {
                    onFrame()
                }
            }
        }
        previewView = view
        parent.addView(view, 0)
    }

    private fun connectPreviewOutput(texture: SurfaceTexture) {
        val s = session ?: return
        previewOutput?.close()
        val surface = Surface(texture)
        previewOutput = runCatching {
            s.processor.connectOutput(
                object : ImageProcessor.Output.BackedBySurface(
                    surface,
                    ImageProcessor.Output.Purpose.PREVIEW,
                ) {
                    override fun writeFrame(): ImageProcessor.Output.Frame =
                        object : ImageProcessor.Output.Frame {
                            override val timestamp: Long = SystemClock.elapsedRealtimeNanos()
                            override fun recycle() = Unit
                        }
                },
            )
        }.onFailure { Log.e(TAG, "preview output connect failed", it) }.getOrNull()
        Log.i(TAG, "preview output connected=${previewOutput != null}")
    }

    private fun applyMirrorState() {
        runOnUi { previewView?.scaleX = if (mirrored) -1f else 1f }
    }

    private fun teardownPreview(done: () -> Unit) {
        previewStarted = false
        previewStarting = false
        stopWatchdog()
        runOnUi {
            teardownPreviewSync()
            forceReleaseCameraX { done() }
        }
    }

    private fun teardownPreviewSync() {
        runCatching { imageSource?.stopPreview() }
        previewOutput?.close()
        previewOutput = null
        runOnUi {
            previewView?.let { view ->
                (view.parent as? ViewGroup)?.removeView(view)
            }
            previewView = null
        }
    }

    // --------------------------------------------------------- frame watchdog

    private fun onFrame() {
        val count = frameCount.incrementAndGet()
        lastFrameAt.set(SystemClock.elapsedRealtime())
        // Fired exactly once per session lifetime: the signal callers use to
        // know the native preview surface has real pixels and is safe to
        // reveal (equivalent to the old WebView-reveal moment on Capacitor).
        if (count == 1L) {
            Log.i(TAG, "Camera Kit first frame flowing")
            listener?.onFirstFrame(count)
        }
    }

    private fun startWatchdog() {
        stopWatchdog()
        lastFrameAt.set(SystemClock.elapsedRealtime())
        watchdog = scope.launch {
            // Grace period for the first frame after a (re)bind.
            delay(START_FRAME_TIMEOUT_MS)
            while (previewStarted || publishEnabled) {
                val age = SystemClock.elapsedRealtime() - lastFrameAt.get()
                if (age > STALL_TIMEOUT_MS) {
                    Log.e(TAG, "no Camera Kit frame for ${age}ms — falling back")
                    revertToRawCamera("stalled")
                    return@launch
                }
                delay(1_000)
            }
        }
    }

    private fun stopWatchdog() {
        watchdog?.cancel()
        watchdog = null
    }

    /** Clears the lens and tells the RN layer to fall back to a plain camera.
     * Never leaves the host on a black screen. */
    private fun revertToRawCamera(reason: String) {
        Log.w(TAG, "revertToRawCamera reason=$reason")
        currentLensKey = null
        runCatching { session?.lenses?.processor?.clear {} }
        stopWatchdog()
        listener?.onFallback(reason)
    }

    // --------------------------------------------------------- view utilities

    private fun forceReleaseCameraX(done: () -> Unit) {
        val act = activity
        if (act == null) {
            done()
            return
        }
        runOnUi {
            try {
                val future = ProcessCameraProvider.getInstance(act)
                future.addListener({
                    runCatching { future.get().unbindAll() }
                        .onFailure { Log.w(TAG, "CameraX unbindAll failed", it) }
                    postDelayed(CAMERA_X_RELEASE_DELAY_MS) { done() }
                }, ContextCompat.getMainExecutor(act))
            } catch (e: Exception) {
                Log.w(TAG, "CameraX provider unavailable", e)
                postDelayed(CAMERA_X_RELEASE_DELAY_MS) { done() }
            }
        }
    }

    private fun runOnUi(task: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) task() else activity?.runOnUiThread(task)
    }

    private fun <T> runOnUiBlocking(task: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) return task()
        val act = activity ?: throw IllegalStateException("no activity")
        val latch = CountDownLatch(1)
        var result: Result<T>? = null
        act.runOnUiThread {
            result = runCatching(task)
            latch.countDown()
        }
        latch.await(10, TimeUnit.SECONDS)
        return result?.getOrThrow()
            ?: throw IllegalStateException("UI thread did not run Camera Kit task in time")
    }

    private fun postDelayed(delayMs: Long, task: () -> Unit) {
        activity?.window?.decorView?.postDelayed(task, delayMs)
    }

    private suspend fun awaitFrames(baseline: Long, timeoutMs: Long): Boolean {
        val deadline = SystemClock.elapsedRealtime() + timeoutMs
        while (SystemClock.elapsedRealtime() < deadline) {
            if (frameCount.get() > baseline) return true
            delay(50)
        }
        return false
    }

    /** JS token wins; otherwise the manifest meta-data value. */
    private fun resolveToken(fromJs: String?): String {
        if (!fromJs.isNullOrBlank()) return fromJs
        return try {
            val info = context.packageManager.getApplicationInfo(
                context.packageName,
                PackageManager.GET_META_DATA,
            )
            info.metaData?.getString(META_TOKEN)?.trim().orEmpty()
        } catch (e: Exception) {
            Log.w(TAG, "manifest token lookup failed", e)
            ""
        }
    }

    private fun key(id: String, groupId: String) = "$groupId|$id"

    private fun LensesComponent.Lens.toMap(): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>(
            "id" to id,
            "groupId" to groupId,
            "name" to name.orEmpty().ifBlank { "Lens" },
        )
        icons.firstOrNull()?.uri?.toString()?.takeIf { it.isNotEmpty() }?.let { map["iconUrl"] = it }
        return map
    }

    private fun emit(phase: String, extra: Map<String, Any?> = emptyMap()) {
        val data = mutableMapOf<String, Any?>(
            "phase" to phase,
            "initialized" to initialized,
            "sessionStarted" to previewStarted,
            "captureRunning" to previewStarted,
        )
        data.putAll(extra)
        listener?.onStatus(phase, data)
    }

    companion object {
        private const val TAG = "KidiCameraKit"
        private const val META_TOKEN = "com.snap.camerakit.api.token"
        private const val REQ_CAMERA = 4921
        private const val CAMERA_X_RELEASE_DELAY_MS = 700L
        private const val START_FRAME_TIMEOUT_MS = 3_000L
        private const val LENS_FRAME_TIMEOUT_MS = 3_000L
        private const val LENS_LOOKUP_TIMEOUT_MS = 6_000L
        private const val LOAD_LENSES_TIMEOUT_MS = 8_000L
        private const val PUBLISH_FRAME_TIMEOUT_MS = 5_000L
        private const val STALL_TIMEOUT_MS = 3_000L
        private const val ADAPT_WARMUP_MS = 4_000L
        private const val ADAPT_WINDOW_MS = 2_000L
        private const val ADAPT_MIN_FPS = 20.0

        /**
         * Capture/publish ladder used when Camera Kit owns the camera. 720p30 is
         * the cap (never higher: a live-selling stream gains nothing from 1080p
         * and the lens shader + encoder share the same GPU). Steps down only.
         */
        val CAPTURE_PROFILES = listOf(
            CaptureProfile(1280, 720, 30, 1_600_000),
            CaptureProfile(960, 540, 24, 900_000),
            CaptureProfile(854, 480, 24, 650_000),
        )
    }
}

/** One rung of the adaptive capture ladder. */
data class CaptureProfile(
    val width: Int,
    val height: Int,
    val fps: Int,
    val bitrate: Int,
)

/**
 * Pushes Camera Kit's filtered frames into LiveKit as an external video track.
 * Mirrors the iOS bridge (KidiCameraKitLiveKitOutput.swift): Camera Kit output
 * surface -> WebRTC SurfaceTextureHelper -> LiveKit capturer observer.
 */
private class CameraKitSurfaceCapturer(
    private val session: Session,
    width: Int,
    height: Int,
    fps: Int,
    private val onConnected: (Closeable) -> Unit,
    private val onFrame: () -> Unit,
) : VideoCapturer {
    private var helper: SurfaceTextureHelper? = null
    private var observer: CapturerObserver? = null
    private var surface: Surface? = null
    private var output: Closeable? = null
    private val framesSeen = AtomicLong(0)
    @Volatile private var targetWidth = width
    @Volatile private var targetHeight = height
    /** Minimum spacing between delivered frames; extra frames are dropped
     * before they reach the encoder (cheap: no copy, just a release). */
    @Volatile private var minIntervalNs = 1_000_000_000L / fps.coerceAtLeast(1) - 2_000_000L
    private var lastDeliveredNs = 0L

    fun deliveredFrames(): Long = framesSeen.get()

    override fun initialize(
        helper: SurfaceTextureHelper,
        context: android.content.Context,
        observer: CapturerObserver,
    ) {
        this.helper = helper
        this.observer = observer
    }

    override fun startCapture(width: Int, height: Int, framerate: Int) {
        val helper = this.helper
        if (helper == null) {
            Log.e("KidiCameraKit", "capturer startCapture before initialize()")
            observer?.onCapturerStarted(false)
            return
        }
        if (width > 0 && height > 0) {
            targetWidth = width
            targetHeight = height
        }
        if (framerate > 0) minIntervalNs = 1_000_000_000L / framerate - 2_000_000L
        Log.i("KidiCameraKit", "capturer startCapture ${targetWidth}x${targetHeight}@$framerate")
        // Texture size == published size: no scaling stage, no bitmap copies.
        // The whole path stays on the GPU (Camera Kit surface -> texture frame
        // -> hardware encoder) on the SurfaceTextureHelper thread, never on the
        // UI thread.
        helper.setTextureSize(targetWidth, targetHeight)
        helper.startListening { frame: VideoFrame ->
            val now = frame.timestampNs
            if (lastDeliveredNs != 0L && now - lastDeliveredNs < minIntervalNs) {
                frame.release()
                return@startListening
            }
            lastDeliveredNs = now
            val count = framesSeen.incrementAndGet()
            if (count == 1L) Log.i("KidiCameraKit", "first frame delivered to LiveKit")
            onFrame()
            observer?.onFrameCaptured(frame)
        }
        val surface = Surface(helper.surfaceTexture)
        this.surface = surface
        val connected = session.processor.connectOutput(
            object : ImageProcessor.Output.BackedBySurface(
                surface,
                ImageProcessor.Output.Purpose.RECORDING,
            ) {
                override fun writeFrame(): ImageProcessor.Output.Frame =
                    object : ImageProcessor.Output.Frame {
                        override val timestamp: Long = SystemClock.elapsedRealtimeNanos()
                        override fun recycle() = Unit
                    }
            },
        )
        output = connected
        onConnected(connected)
        observer?.onCapturerStarted(true)
    }

    override fun stopCapture() {
        Log.i("KidiCameraKit", "capturer stopCapture after ${framesSeen.get()} frames")
        framesSeen.set(0)
        lastDeliveredNs = 0L
        output?.close()
        output = null
        surface?.release()
        surface = null
        helper?.stopListening()
        observer?.onCapturerStopped()
    }

    /** Live step-down: resize the shared texture and re-throttle. No republish,
     * no camera restart — the encoder simply receives smaller frames. */
    override fun changeCaptureFormat(width: Int, height: Int, framerate: Int) {
        if (width > 0 && height > 0) {
            targetWidth = width
            targetHeight = height
            runCatching { helper?.setTextureSize(width, height) }
        }
        if (framerate > 0) minIntervalNs = 1_000_000_000L / framerate - 2_000_000L
        Log.i("KidiCameraKit", "capturer changeCaptureFormat ${width}x${height}@$framerate")
    }

    override fun dispose() {
        stopCapture()
    }

    override fun isScreencast(): Boolean = false
}
