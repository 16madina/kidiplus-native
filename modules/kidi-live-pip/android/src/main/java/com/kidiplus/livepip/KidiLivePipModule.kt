package com.kidiplus.livepip

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class LivePipEnableOptions : Record {
  @Field
  var enabled: Boolean = false

  @Field
  var url: String? = null

  @Field
  var token: String? = null
}

class KidiLivePipModule : Module() {
  private val modeListener: (Boolean) -> Unit = { active ->
    sendEvent("onPipModeChange", mapOf("active" to active))
  }

  private val prepareListener: () -> Unit = {
    sendEvent("onPipPrepare", emptyMap<String, Any>())
  }

  override fun definition() = ModuleDefinition {
    Name("KidiLivePip")

    Events("onPipModeChange", "onPipPrepare")

    OnCreate {
      KidiLivePipState.addListener(modeListener)
      KidiLivePipState.addPrepareListener(prepareListener)
    }

    OnDestroy {
      KidiLivePipState.removeListener(modeListener)
      KidiLivePipState.removePrepareListener(prepareListener)
      KidiLivePipState.enabled = false
    }

    Function("setEnabled") { options: LivePipEnableOptions ->
      KidiLivePipState.enabled = options.enabled
      options.enabled
    }

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
    }

    Function("isActive") {
      KidiLivePipState.isActive(appContext.currentActivity)
    }

    AsyncFunction("enter") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      KidiLivePipState.enter(activity)
    }

    AsyncFunction("dismiss") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      KidiLivePipState.dismiss(activity)
    }
  }
}
