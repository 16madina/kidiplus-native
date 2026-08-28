package com.kidiplus.liveeffects

import android.widget.FrameLayout

object KidiLiveEffectsSessionHolder {
    var session: KidiLiveEffectsSession? = null
    var previewHost: FrameLayout? = null

    fun registerPreviewHost(host: FrameLayout) {
        previewHost = host
        session?.attachPreview(host)
    }

    fun unregisterPreviewHost(host: FrameLayout) {
        if (previewHost === host) {
            session?.detachPreview(host)
            previewHost = null
        }
    }
}
