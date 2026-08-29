package com.kidiplus.livepip

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Rational
import java.util.concurrent.CopyOnWriteArrayList

object KidiLivePipState {
  const val PREPARE_DELAY_MS: Long = 180

  @Volatile
  @JvmField
  var enabled: Boolean = false

  private val listeners = CopyOnWriteArrayList<(Boolean) -> Unit>()
  private val prepareListeners = CopyOnWriteArrayList<() -> Unit>()
  private val handler = Handler(Looper.getMainLooper())

  fun addListener(listener: (Boolean) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (Boolean) -> Unit) {
    listeners.remove(listener)
  }

  fun addPrepareListener(listener: () -> Unit) {
    prepareListeners.add(listener)
  }

  fun removePrepareListener(listener: () -> Unit) {
    prepareListeners.remove(listener)
  }

  @JvmStatic
  fun onUserLeaveHint(activity: Activity) {
    if (!enabled) return
    if (isSupported() && activity.isInPictureInPictureMode) return
    notifyPrepare()
    handler.removeCallbacksAndMessages(null)
    handler.postDelayed({
      if (!enabled) return@postDelayed
      if (activity.isFinishing) return@postDelayed
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed) {
        return@postDelayed
      }
      if (isSupported() && activity.isInPictureInPictureMode) return@postDelayed
      enter(activity)
    }, PREPARE_DELAY_MS)
  }

  @JvmStatic
  fun notifyMode(active: Boolean) {
    for (listener in listeners) {
      try {
        listener(active)
      } catch (_: Exception) {
      }
    }
  }

  fun notifyPrepare() {
    for (listener in prepareListeners) {
      try {
        listener()
      } catch (_: Exception) {
      }
    }
  }

  fun isSupported(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

  fun isActive(activity: Activity?): Boolean {
    if (activity == null || !isSupported()) return false
    return activity.isInPictureInPictureMode
  }

  fun enter(activity: Activity): Boolean {
    if (!isSupported()) return false
    return try {
      val params = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(9, 16))
        .build()
      activity.enterPictureInPictureMode(params)
    } catch (_: Exception) {
      false
    }
  }

  fun dismiss(activity: Activity): Boolean {
    if (!isSupported() || !activity.isInPictureInPictureMode) return false
    return try {
      val intent = Intent(activity, activity.javaClass)
      intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      activity.startActivity(intent)
      true
    } catch (_: Exception) {
      false
    }
  }
}
