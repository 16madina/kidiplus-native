package com.kidiplus.liveeffects

import android.content.Context
import android.graphics.Bitmap
import android.os.SystemClock
import android.util.Log
import livekit.org.webrtc.CapturerObserver
import livekit.org.webrtc.JavaI420Buffer
import livekit.org.webrtc.SurfaceTextureHelper
import livekit.org.webrtc.VideoCapturer
import livekit.org.webrtc.VideoFrame
import livekit.org.webrtc.YuvHelper
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.max

/** Publishes the exact Bitmap painted by the ML Kit compositor. */
internal class BitmapVideoCapturer : VideoCapturer {
    @Volatile private var observer: CapturerObserver? = null
    @Volatile private var surfaceTextureHelper: SurfaceTextureHelper? = null
    @Volatile private var running = false
    @Volatile private var minIntervalNs = 1_000_000_000L / 15
    @Volatile private var targetWidth = 540
    @Volatile private var targetHeight = 960
    private var lastFrameNs = 0L
    private val delivered = AtomicLong(0)
    private val deliveryPending = AtomicBoolean(false)
    private var rgbaBuffer: ByteBuffer? = null

    override fun initialize(
        surfaceTextureHelper: SurfaceTextureHelper,
        context: Context,
        capturerObserver: CapturerObserver,
    ) {
        this.surfaceTextureHelper = surfaceTextureHelper
        observer = capturerObserver
    }

    override fun startCapture(width: Int, height: Int, framerate: Int) {
        if (width > 0 && height > 0) {
            targetWidth = width and -2
            targetHeight = height and -2
        }
        minIntervalNs = 1_000_000_000L / max(1, framerate.coerceAtMost(20))
        running = true
        Log.i(TAG, "startCapture ${targetWidth}x${targetHeight}@$framerate")
        observer?.onCapturerStarted(true)
    }

    override fun stopCapture() {
        running = false
        lastFrameNs = 0L
        Log.i(TAG, "stopCapture after ${delivered.get()} frames")
        observer?.onCapturerStopped()
    }

    override fun changeCaptureFormat(width: Int, height: Int, framerate: Int) {
        if (width > 0 && height > 0) {
            targetWidth = width and -2
            targetHeight = height and -2
        }
        minIntervalNs = 1_000_000_000L / max(1, framerate.coerceAtMost(20))
    }

    override fun dispose() {
        stopCapture()
        observer = null
        surfaceTextureHelper = null
        rgbaBuffer = null
    }

    override fun isScreencast(): Boolean = false

    fun frameCount(): Long = delivered.get()

    fun push(bitmap: Bitmap) {
        if (!running || bitmap.isRecycled) return
        val now = SystemClock.elapsedRealtimeNanos()
        if (lastFrameNs != 0L && now - lastFrameNs < minIntervalNs) return
        if (!deliveryPending.compareAndSet(false, true)) return
        lastFrameNs = now
        val buffer = try {
            bitmapToI420(bitmap, targetWidth, targetHeight)
        } catch (error: Throwable) {
            deliveryPending.set(false)
            Log.e(TAG, "bitmap conversion failed", error)
            return
        }
        val frame = VideoFrame(buffer, 0, now)
        val handler = surfaceTextureHelper?.handler
        if (handler == null || !handler.post {
                try {
                    if (running) {
                        observer?.onFrameCaptured(frame)
                        val count = delivered.incrementAndGet()
                        if (count == 1L || count % 150L == 0L) {
                            Log.i(TAG, "delivered $count frames")
                        }
                    }
                } finally {
                    frame.release()
                    deliveryPending.set(false)
                }
            }
        ) {
            frame.release()
            deliveryPending.set(false)
        }
    }

    private fun bitmapToI420(bitmap: Bitmap, width: Int, height: Int): JavaI420Buffer {
        val source = if (bitmap.width == width && bitmap.height == height) {
            bitmap
        } else {
            Bitmap.createScaledBitmap(bitmap, width, height, true)
        }
        val byteCount = width * height * 4
        val rgba = rgbaBuffer?.takeIf { it.capacity() >= byteCount }
            ?: ByteBuffer.allocateDirect(byteCount)
                .order(ByteOrder.nativeOrder())
                .also { rgbaBuffer = it }
        rgba.clear()
        source.copyPixelsToBuffer(rgba)
        rgba.rewind()
        val out = JavaI420Buffer.allocate(width, height)
        try {
            YuvHelper.ABGRToI420(
                rgba,
                width * 4,
                out.dataY,
                out.strideY,
                out.dataU,
                out.strideU,
                out.dataV,
                out.strideV,
                width,
                height,
            )
        } catch (error: Throwable) {
            out.release()
            throw error
        } finally {
            if (source !== bitmap) source.recycle()
        }
        return out
    }

    companion object {
        private const val TAG = "KidiLiveEffects"
    }
}
