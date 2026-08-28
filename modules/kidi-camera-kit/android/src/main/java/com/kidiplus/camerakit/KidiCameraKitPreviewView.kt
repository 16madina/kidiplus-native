package com.kidiplus.camerakit

import android.content.Context
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * RN host for the Camera Kit TextureView preview.
 * Registers itself on the shared session so [KidiCameraKitSession] attaches
 * the TextureView here (visible in the RN tree) instead of behind an opaque
 * React root.
 */
class KidiCameraKitPreviewView(context: Context, appContext: AppContext) :
    ExpoView(context, appContext) {

    private val host = FrameLayout(context).also {
        it.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        addView(it)
    }

    init {
        setBackgroundColor(0xFF000000.toInt())
        KidiCameraKitSessionHolder.registerPreviewHost(host)
    }

    override fun onDetachedFromWindow() {
        KidiCameraKitSessionHolder.unregisterPreviewHost(host)
        super.onDetachedFromWindow()
    }
}
