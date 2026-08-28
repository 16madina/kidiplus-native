package com.kidiplus.camerakit

import android.view.ViewGroup

/**
 * Lets the Expo preview view register a host FrameLayout before / while the
 * session exists. The module's [KidiCameraKitSession] reads this when attaching
 * its TextureView.
 */
object KidiCameraKitSessionHolder {
    @Volatile
    var session: KidiCameraKitSession? = null

    @Volatile
    var previewHost: ViewGroup? = null

    fun registerPreviewHost(host: ViewGroup) {
        previewHost = host
        session?.setPreviewHost(host)
    }

    fun unregisterPreviewHost(host: ViewGroup) {
        if (previewHost === host) {
            previewHost = null
            session?.setPreviewHost(null)
        }
    }
}
