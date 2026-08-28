package com.kidiplus.liveeffects

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KidiLiveEffectsModule : Module() {
    private val sessionLock = Any()
    private var session: KidiLiveEffectsSession? = null

    private fun requireSession(): KidiLiveEffectsSession = synchronized(sessionLock) {
        session ?: buildSession().also { session = it }
    }

    private fun buildSession(): KidiLiveEffectsSession {
        val reactContext = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        return KidiLiveEffectsSession(
            context = reactContext,
            activityProvider = { appContext.currentActivity },
        ).also {
            it.listener = object : KidiLiveEffectsSession.Listener {
                override fun onUnavailable() {
                    sendEvent("unavailable", emptyMap<String, Any?>())
                }

                override fun onFirstFrame() {
                    sendEvent("firstFrame", emptyMap<String, Any?>())
                }
            }
            KidiLiveEffectsSessionHolder.session = it
            KidiLiveEffectsSessionHolder.previewHost?.let { host -> it.attachPreview(host) }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("KidiLiveEffects")

        Events("unavailable", "firstFrame")

        OnActivityEntersBackground {
            session?.onHostPause()
        }

        OnActivityEntersForeground {
            session?.onHostResume()
        }

        OnDestroy {
            session?.onHostDestroy()
            if (KidiLiveEffectsSessionHolder.session === session) {
                KidiLiveEffectsSessionHolder.session = null
            }
            session = null
        }

        AsyncFunction("warmup") Coroutine {
            mapOf("supported" to requireSession().warmup())
        }

        AsyncFunction("start") Coroutine { config: Map<String, Any?> ->
            mapOf("started" to requireSession().start(config))
        }

        AsyncFunction("setConfig") Coroutine { config: Map<String, Any?> ->
            requireSession().setConfig(config)
            mapOf("updated" to true)
        }

        AsyncFunction("stop") Coroutine {
            session?.stop()
            mapOf("stopped" to true)
        }

        View(KidiLiveEffectsPreviewView::class) {}
    }
}
