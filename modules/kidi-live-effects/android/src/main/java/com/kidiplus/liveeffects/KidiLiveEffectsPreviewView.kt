package com.kidiplus.liveeffects

import android.content.Context
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class KidiLiveEffectsPreviewView(context: Context, appContext: AppContext) :
    ExpoView(context, appContext) {

    private val host = FrameLayout(context).also {
        it.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        addView(it)
    }

    init {
        setBackgroundColor(0xFF000000.toInt())
        KidiLiveEffectsSessionHolder.registerPreviewHost(host)
    }

    override fun onDetachedFromWindow() {
        KidiLiveEffectsSessionHolder.unregisterPreviewHost(host)
        super.onDetachedFromWindow()
    }
}
