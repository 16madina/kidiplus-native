package com.kidiplus.liveeffects

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import android.util.Size
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.Segmenter
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Native virtual-background compositor matching kidiplus.com / MediaPipe:
 * ML Kit selfie mask → EMA 0.55/0.45 → feather blur → source-over person
 * on blurred camera or replacement image + optional poster.
 *
 * Preview is an ImageView in the RN host. Publication of composed frames
 * to LiveKit is owned by the JS layer (same split as iOS Camera Kit).
 */
class KidiLiveEffectsSession(
    private val context: Context,
    private val activityProvider: () -> Activity?,
) {
    interface Listener {
        fun onUnavailable()
        fun onFirstFrame()
    }

    var listener: Listener? = null

    private val activity: Activity?
        get() = activityProvider()

    private val preview = ImageView(context).apply {
        scaleType = ImageView.ScaleType.CENTER_CROP
        setBackgroundColor(Color.BLACK)
        layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
    }

    private var previewHost: FrameLayout? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var analysisExecutor: ExecutorService? = null
    private var segmenter: Segmenter? = null

    @Volatile private var running = false
    @Volatile private var backgroundMode = "none"
    @Volatile private var posterMode = "off"
    @Volatile private var posterX = 0.5f
    @Volatile private var posterY = 0.4f
    @Volatile private var posterScale = 1f
    @Volatile private var mirror = true
    @Volatile private var facingFront = true
    @Volatile private var backgroundBmp: Bitmap? = null
    @Volatile private var posterBmp: Bitmap? = null
    private var loadedBgUrl: String? = null
    private var loadedPosterUrl: String? = null
    @Volatile private var disabled = false

    private var prevAlpha: FloatArray? = null
    private var maskW = 0
    private var maskH = 0
    private var ladderIndex = 0
    private val ladder = intArrayOf(720, 540, 400)
    private var lastTs = 0L
    private var slowFrames = 0
    private var fastFrames = 0
    private val analyzing = AtomicBoolean(false)
    private var emittedFirstFrame = false
    private var displayed: Bitmap? = null
    private var pendingRecycle: Bitmap? = null
    private var boundFacingFront: Boolean? = null
    private var bindRetries = 0

    private val filterPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val dstInPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
        isFilterBitmap = true
        isAntiAlias = true
    }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.argb(217, 232, 185, 59)
    }

    fun attachPreview(host: FrameLayout) {
        runOnUi {
            previewHost = host
            (preview.parent as? ViewGroup)?.removeView(preview)
            host.addView(
                preview,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
        }
    }

    fun detachPreview(host: FrameLayout) {
        runOnUi {
            if (previewHost === host) {
                (preview.parent as? ViewGroup)?.removeView(preview)
                previewHost = null
            }
        }
    }

    fun warmup(): Boolean {
        if (disabled) return false
        return try {
            ensureSegmenter()
            true
        } catch (e: Exception) {
            Log.w(TAG, "warmup failed", e)
            false
        }
    }

    fun start(config: Map<String, Any?>): Boolean {
        applyConfig(config)
        val act = activity ?: return false
        if (ContextCompat.checkSelfPermission(act, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "camera permission missing")
            return false
        }
        running = true
        emittedFirstFrame = false
        bindRetries = 0
        bindCamera(act)
        return true
    }

    fun setConfig(config: Map<String, Any?>) {
        val prevFacing = facingFront
        applyConfig(config)
        if (running && prevFacing != facingFront) {
            activity?.let { bindCamera(it) }
        }
    }

    fun stop() {
        running = false
        boundFacingFront = null
        runCatching { cameraProvider?.unbindAll() }
        runOnUi {
            preview.setImageBitmap(null)
            pendingRecycle?.recycle()
            pendingRecycle = null
            displayed?.recycle()
            displayed = null
        }
        prevAlpha = null
    }

    fun onHostPause() {
        if (running) runCatching { cameraProvider?.unbindAll() }
    }

    fun onHostResume() {
        if (running) activity?.let { bindCamera(it) }
    }

    fun onHostDestroy() {
        stop()
        runCatching { segmenter?.close() }
        segmenter = null
        analysisExecutor?.shutdown()
        analysisExecutor = null
        backgroundBmp?.recycle()
        posterBmp?.recycle()
        backgroundBmp = null
        posterBmp = null
    }

    private fun ensureSegmenter(): Segmenter {
        segmenter?.let { return it }
        val options = SelfieSegmenterOptions.Builder()
            .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
            .enableRawSizeMask()
            .build()
        return Segmentation.getClient(options).also { segmenter = it }
    }

    private fun bindCamera(act: Activity) {
        val owner = act as? LifecycleOwner ?: run {
            Log.e(TAG, "activity is not a LifecycleOwner")
            return
        }
        val main = ContextCompat.getMainExecutor(act)
        val future = ProcessCameraProvider.getInstance(act)
        future.addListener({
            if (!running) return@addListener
            val provider = runCatching { future.get() }.getOrNull() ?: return@addListener
            cameraProvider = provider
            provider.unbindAll()
            val executor = analysisExecutor ?: Executors.newSingleThreadExecutor().also {
                analysisExecutor = it
            }
            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .setTargetResolution(Size(720, 1280))
                .build()
            analysis.setAnalyzer(executor) { image -> analyze(image) }
            val selector = if (facingFront) {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }
            runCatching {
                provider.bindToLifecycle(owner, selector, analysis)
                boundFacingFront = facingFront
                bindRetries = 0
            }.onFailure {
                Log.e(TAG, "CameraX bind failed", it)
                if (bindRetries < 2 && running) {
                    bindRetries += 1
                    preview.postDelayed({
                        if (running) bindCamera(act)
                    }, 800)
                }
            }
        }, main)
    }

    private fun analyze(image: ImageProxy) {
        if (!running) {
            image.close()
            return
        }
        if (!analyzing.compareAndSet(false, true)) {
            image.close()
            return
        }
        val src = try {
            imageProxyToBitmap(image)
        } catch (e: Exception) {
            Log.w(TAG, "frame decode failed", e)
            null
        } finally {
            image.close()
        }
        if (src == null) {
            analyzing.set(false)
            return
        }
        val wantBg = backgroundMode != "none" && !disabled
        val hasPoster = posterBmp != null && posterMode != "off"
        if (!wantBg && !hasPoster) {
            val shown = maybeMirror(src, src.width, src.height) ?: src
            present(shown)
            if (shown !== src && !src.isRecycled) src.recycle()
            analyzing.set(false)
            return
        }
        if (wantBg) {
            trackFps()
            val seg = try {
                ensureSegmenter()
            } catch (e: Exception) {
                analyzing.set(false)
                listener?.onUnavailable()
                val shown = maybeMirror(src, src.width, src.height) ?: src
                present(shown)
                if (shown !== src && !src.isRecycled) src.recycle()
                return
            }
            val input = InputImage.fromBitmap(src, 0)
            seg.process(input)
                .addOnSuccessListener { mask ->
                    val out = try {
                        compose(src, mask.buffer, mask.width, mask.height)
                    } catch (e: Exception) {
                        Log.w(TAG, "compose failed", e)
                        maybeMirror(src, src.width, src.height) ?: src
                    }
                    present(out)
                    if (out !== src && !src.isRecycled) src.recycle()
                }
                .addOnFailureListener {
                    val fallback = maybeMirror(src, src.width, src.height) ?: src
                    present(fallback)
                    if (fallback !== src && !src.isRecycled) src.recycle()
                }
                .addOnCompleteListener { analyzing.set(false) }
        } else {
            val out = compose(src, null, 0, 0)
            present(out)
            if (out !== src && !src.isRecycled) src.recycle()
            analyzing.set(false)
        }
    }

    private fun compose(
        camera: Bitmap,
        maskBuf: java.nio.FloatBuffer?,
        rawMaskW: Int,
        rawMaskH: Int,
    ): Bitmap {
        val maxW = ladder[ladderIndex.coerceIn(0, ladder.lastIndex)]
        val scale = min(1f, maxW / camera.width.toFloat())
        val w = max(2, (camera.width * scale).roundToInt())
        val h = max(2, (camera.height * scale).roundToInt())
        val frame = if (w != camera.width || h != camera.height) {
            Bitmap.createScaledBitmap(camera, w, h, true)
        } else {
            camera
        }

        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val wantBg = backgroundMode != "none" && !disabled && maskBuf != null && rawMaskW > 0

        if (wantBg) {
            val mask = buildSoftMask(maskBuf!!, rawMaskW, rawMaskH, w, h)
            if (backgroundMode == "image") {
                val bg = backgroundBmp
                if (bg != null) {
                    drawCover(canvas, bg, 0f, 0f, w.toFloat(), h.toFloat())
                } else {
                    drawBlurredCamera(canvas, frame, w, h, mirrored = mirror)
                }
            } else {
                drawBlurredCamera(canvas, frame, w, h, mirrored = mirror)
            }
            val person = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val pc = Canvas(person)
            pc.drawBitmap(frame, null, RectF(0f, 0f, w.toFloat(), h.toFloat()), filterPaint)
            pc.drawBitmap(mask, 0f, 0f, dstInPaint)
            canvas.save()
            if (mirror) {
                canvas.translate(w.toFloat(), 0f)
                canvas.scale(-1f, 1f)
            }
            canvas.drawBitmap(person, 0f, 0f, filterPaint)
            canvas.restore()
            if (person !== out) person.recycle()
            if (mask !== out) mask.recycle()
        } else {
            canvas.save()
            if (mirror) {
                canvas.translate(w.toFloat(), 0f)
                canvas.scale(-1f, 1f)
            }
            canvas.drawBitmap(frame, null, RectF(0f, 0f, w.toFloat(), h.toFloat()), filterPaint)
            canvas.restore()
        }

        val poster = posterBmp
        if (poster != null && posterMode != "off") {
            drawPoster(canvas, poster, w, h)
        }

        if (frame !== camera && frame !== out) frame.recycle()
        return out
    }

    private fun buildSoftMask(
        buf: java.nio.FloatBuffer,
        mw: Int,
        mh: Int,
        destW: Int,
        destH: Int,
    ): Bitmap {
        val count = mw * mh
        val src = FloatArray(count)
        buf.rewind()
        val n = min(count, buf.remaining())
        buf.get(src, 0, n)

        if (prevAlpha == null || maskW != mw || maskH != mh) {
            prevAlpha = src.copyOf()
            maskW = mw
            maskH = mh
        } else {
            val prev = prevAlpha!!
            for (i in 0 until count) {
                prev[i] = prev[i] * 0.55f + src[i] * 0.45f
            }
        }
        val alpha = prevAlpha!!
        val pixels = IntArray(count)
        for (i in 0 until count) {
            val a = alpha[i]
            val v = when {
                a <= 0.35f -> 0f
                a >= 0.65f -> 1f
                else -> (a - 0.35f) / 0.3f
            }
            val ai = (v * 255f).toInt().coerceIn(0, 255)
            pixels[i] = (ai shl 24) or 0x00FFFFFF
        }
        val raw = Bitmap.createBitmap(mw, mh, Bitmap.Config.ARGB_8888)
        raw.setPixels(pixels, 0, mw, 0, 0, mw, mh)

        val scaled = Bitmap.createScaledBitmap(raw, destW, destH, true)
        if (scaled !== raw) raw.recycle()

        val feathered = Bitmap.createBitmap(destW, destH, Bitmap.Config.ARGB_8888)
        feathered.setHasAlpha(true)
        val c = Canvas(feathered)
        val radius = max(1f, mw * 0.008f * (destW.toFloat() / mw))
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            maskFilter = BlurMaskFilter(radius, BlurMaskFilter.Blur.NORMAL)
        }
        c.drawBitmap(scaled, 0f, 0f, paint)
        scaled.recycle()
        return feathered
    }

    private fun drawBlurredCamera(canvas: Canvas, frame: Bitmap, w: Int, h: Int, mirrored: Boolean) {
        canvas.save()
        if (mirrored) {
            canvas.translate(w.toFloat(), 0f)
            canvas.scale(-1f, 1f)
        }
        val bw = max(2, w / 4)
        val bh = max(2, h / 4)
        val small = Bitmap.createScaledBitmap(frame, bw, bh, true)
        canvas.drawBitmap(small, null, RectF(0f, 0f, w.toFloat(), h.toFloat()), filterPaint)
        if (small !== frame) small.recycle()
        canvas.restore()
        canvas.drawColor(Color.argb(31, 0, 0, 0))
    }

    private fun drawCover(canvas: Canvas, bmp: Bitmap, dx: Float, dy: Float, dw: Float, dh: Float) {
        val iw = bmp.width.toFloat().coerceAtLeast(1f)
        val ih = bmp.height.toFloat().coerceAtLeast(1f)
        val s = max(dw / iw, dh / ih)
        val rw = iw * s
        val rh = ih * s
        val left = dx + (dw - rw) / 2f
        val top = dy + (dh - rh) / 2f
        canvas.drawBitmap(bmp, null, RectF(left, top, left + rw, top + rh), filterPaint)
    }

    private fun drawPoster(canvas: Canvas, poster: Bitmap, w: Int, h: Int) {
        val iw = poster.width.toFloat().coerceAtLeast(1f)
        val ih = poster.height.toFloat().coerceAtLeast(1f)
        var pw = w * 0.72f * posterScale
        var ph = pw * (ih / iw)
        val maxH = h * 0.88f
        if (ph > maxH) {
            ph = maxH
            pw = ph * (iw / ih)
        }
        val px = posterX * w - pw / 2f
        val py = posterY * h - ph / 2f
        val r = max(12f, pw * 0.04f)
        canvas.save()
        val path = android.graphics.Path().apply {
            addRoundRect(RectF(px, py, px + pw, py + ph), r, r, android.graphics.Path.Direction.CW)
        }
        canvas.clipPath(path)
        drawCover(canvas, poster, px, py, pw, ph)
        canvas.restore()
        strokePaint.strokeWidth = max(2f, pw * 0.012f)
        canvas.drawRoundRect(RectF(px, py, px + pw, py + ph), r, r, strokePaint)
    }

    private fun maybeMirror(src: Bitmap, w: Int, h: Int): Bitmap? {
        if (!mirror) return src
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        c.translate(w.toFloat(), 0f)
        c.scale(-1f, 1f)
        c.drawBitmap(src, null, RectF(0f, 0f, w.toFloat(), h.toFloat()), filterPaint)
        return out
    }

    private fun trackFps() {
        val now = SystemClock.elapsedRealtime()
        if (lastTs > 0) {
            val dt = now - lastTs
            if (dt > 70) {
                slowFrames += 1
                fastFrames = 0
            } else {
                fastFrames += 1
                if (fastFrames > 30) slowFrames = 0
            }
            if (slowFrames > 45) {
                slowFrames = 0
                if (ladderIndex < ladder.lastIndex) {
                    ladderIndex += 1
                    Log.i(TAG, "downgrade width=${ladder[ladderIndex]}")
                } else if (!disabled) {
                    disabled = true
                    listener?.onUnavailable()
                }
            }
        }
        lastTs = now
    }

    private fun present(bmp: Bitmap) {
        runOnUi {
            pendingRecycle?.recycle()
            pendingRecycle = displayed
            displayed = bmp
            preview.setImageBitmap(bmp)
            if (!emittedFirstFrame) {
                emittedFirstFrame = true
                listener?.onFirstFrame()
            }
        }
    }

    private fun applyConfig(config: Map<String, Any?>) {
        backgroundMode = (config["backgroundMode"] as? String) ?: "none"
        posterMode = (config["posterMode"] as? String) ?: "off"
        posterX = num(config["posterX"], 0.5)
        posterY = num(config["posterY"], 0.4)
        posterScale = num(config["posterScale"], 1.0)
        mirror = config["mirror"] as? Boolean ?: true
        val facingStr = (config["facing"] as? String) ?: "user"
        facingFront = facingStr != "environment" && facingStr != "back"
        val bgUrl = config["backgroundUrl"] as? String
        if (bgUrl.isNullOrEmpty()) {
            loadedBgUrl = null
            backgroundBmp = null
        } else if (bgUrl != loadedBgUrl) {
            loadedBgUrl = bgUrl
            backgroundBmp = loadBitmap(bgUrl)
        }
        val posterUrl = config["posterUrl"] as? String
        if (posterUrl.isNullOrEmpty()) {
            loadedPosterUrl = null
            posterBmp = null
        } else if (posterUrl != loadedPosterUrl) {
            loadedPosterUrl = posterUrl
            posterBmp = loadBitmap(posterUrl)
        }
    }

    private fun loadBitmap(urlString: String): Bitmap? {
        return try {
            when {
                urlString.startsWith("/") -> BitmapFactory.decodeFile(urlString)
                urlString.startsWith("file:") -> {
                    val path = Uri.parse(urlString).path ?: return null
                    BitmapFactory.decodeFile(path)
                }
                urlString.startsWith("content:") -> {
                    context.contentResolver.openInputStream(Uri.parse(urlString))?.use {
                        BitmapFactory.decodeStream(it)
                    }
                }
                else -> URL(urlString).openStream().use { BitmapFactory.decodeStream(it) }
            }
        } catch (e: Exception) {
            Log.w(TAG, "image load failed $urlString", e)
            null
        }
    }

    private fun imageProxyToBitmap(image: ImageProxy): Bitmap? {
        val plane = image.planes.firstOrNull() ?: return null
        val buffer = plane.buffer
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val width = image.width
        val height = image.height
        val rowPadding = rowStride - pixelStride * width
        val bitmap = if (rowPadding == 0 && pixelStride == 4) {
            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also {
                buffer.rewind()
                it.copyPixelsFromBuffer(buffer)
            }
        } else {
            val tmp = Bitmap.createBitmap(
                width + rowPadding / pixelStride,
                height,
                Bitmap.Config.ARGB_8888,
            )
            buffer.rewind()
            tmp.copyPixelsFromBuffer(buffer)
            Bitmap.createBitmap(tmp, 0, 0, width, height)
        }
        val rot = image.imageInfo.rotationDegrees
        if (rot == 0) return bitmap
        val matrix = Matrix().apply { postRotate(rot.toFloat()) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun runOnUi(task: () -> Unit) {
        val act = activity
        if (act != null) act.runOnUiThread(task) else task()
    }

    private fun num(v: Any?, fallback: Double): Float = when (v) {
        is Number -> v.toFloat()
        else -> fallback.toFloat()
    }

    companion object {
        private const val TAG = "KidiLiveEffects"
    }
}
