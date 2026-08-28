package com.kidiplus.livepip

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.os.Build
import android.util.Rational
import java.util.concurrent.CopyOnWriteArrayList

object KidiLivePipState {
  @Volatile
  @JvmField
  var enabled: Boolean = false

  private val listeners = CopyOnWriteArrayList<(Boolean) -> Unit>()

  fun addListener(listener: (Boolean) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (Boolean) -> Unit) {
    listeners.remove(listener)
  }

  @JvmStatic
  fun onUserLeaveHint(activity: Activity) {
    if (!enabled) return
    enter(activity)
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
