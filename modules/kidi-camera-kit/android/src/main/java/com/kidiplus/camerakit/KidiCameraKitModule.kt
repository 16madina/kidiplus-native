package com.kidiplus.camerakit

import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "KidiCameraKit"

/**
 * Expo Module wrapper around [KidiCameraKitSession].
 *
 * This class only adapts Expo's `AsyncFunction`/`sendEvent` surface to the
 * plain-Kotlin session below — all Camera Kit / CameraX / LiveKit logic lives
 * in [KidiCameraKitSession] so it stays testable and framework-agnostic.
 */
class KidiCameraKitModule : Module() {
    private val sessionLock = Any()
    private var cameraKitSession: KidiCameraKitSession? = null

    /** Lazily creates the session on first use (mirrors the old Capacitor
     * plugin, which was instantiated once per bridge but only touched the
     * camera on the first real JS call). */
    private fun requireSession(): KidiCameraKitSession = synchronized(sessionLock) {
        cameraKitSession ?: buildSession().also { cameraKitSession = it }
    }

    private fun buildSession(): KidiCameraKitSession {
        val reactContext = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        return KidiCameraKitSession(
            context = reactContext,
            activityProvider = { appContext.currentActivity },
        ).also {
            it.listener = SessionEventBridge()
            KidiCameraKitSessionHolder.session = it
            KidiCameraKitSessionHolder.previewHost?.let { host -> it.setPreviewHost(host) }
        }
    }

    /** Forwards [KidiCameraKitSession.Listener] callbacks to `sendEvent`. */
    private inner class SessionEventBridge : KidiCameraKitSession.Listener {
        override fun onStatus(phase: String, data: Map<String, Any?>) {
            sendEvent("status", data)
        }

        override fun onFallback(reason: String) {
            sendEvent("fallback", mapOf("reason" to reason))
        }

        override fun onFirstFrame(frameCount: Long) {
            sendEvent("firstFrame", mapOf("frameCount" to frameCount))
        }

        override fun onCaptureState(running: Boolean) {
            sendEvent("captureState", mapOf("running" to running))
        }

        override fun onCaptureProfile(width: Int, height: Int, fps: Int) {
            sendEvent(
                "captureProfile",
                mapOf("width" to width, "height" to height, "fps" to fps),
            )
        }
    }

    override fun definition() = ModuleDefinition {
        Name("KidiCameraKit")

        Events("pluginLoaded", "status", "fallback", "firstFrame", "captureState", "captureProfile")

        OnCreate {
            Log.i(TAG, "module loaded")
            sendEvent("pluginLoaded", mapOf("ready" to true))
        }

        OnActivityEntersBackground {
            cameraKitSession?.onHostPause()
        }

        OnActivityEntersForeground {
            cameraKitSession?.onHostResume()
        }

        OnDestroy {
            cameraKitSession?.onHostDestroy()
            if (KidiCameraKitSessionHolder.session === cameraKitSession) {
                KidiCameraKitSessionHolder.session = null
            }
            cameraKitSession = null
        }

        // ---------------------------------------------------------- status

        AsyncFunction("isAvailable") {
            requireSession().isAvailable()
        }

        AsyncFunction("getStatus") {
            requireSession().getStatus()
        }

        // ------------------------------------------------------- lifecycle

        AsyncFunction("initialize") Coroutine { apiToken: String, groupIds: List<String> ->
            requireSession().initialize(apiToken, groupIds)
        }

        AsyncFunction("loadLenses") Coroutine { groupIds: List<String> ->
            requireSession().loadLenses(groupIds)
        }

        AsyncFunction("applyLens") Coroutine { lensId: String, groupId: String ->
            requireSession().applyLens(lensId, groupId)
        }

        AsyncFunction("clearLens") Coroutine {
            requireSession().clearLens()
        }

        AsyncFunction("startPreview") Coroutine { mirrored: Boolean, facing: String ->
            requireSession().startPreview(mirrored, facing)
        }

        AsyncFunction("stopPreview") Coroutine {
            requireSession().stopPreview()
        }

        AsyncFunction("flipCamera") Coroutine {
            requireSession().flipCamera()
        }

        AsyncFunction("setPublishEnabled") Coroutine { enabled: Boolean, roomUrl: String?, token: String? ->
            requireSession().setPublishEnabled(enabled, roomUrl, token)
        }

        View(KidiCameraKitPreviewView::class) {}
    }
}
