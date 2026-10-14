package com.kidiplus.videoexport

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.UUID

private const val OUTPUT_WIDTH = 720
private const val OUTPUT_HEIGHT = 1280
private const val VIDEO_BITRATE = 2_500_000

class VideoExportOptions : Record {
  @Field
  var uri: String = ""
}

class KidiVideoExportModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KidiVideoExport")

    AsyncFunction("exportPortrait") { options: VideoExportOptions, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      // Transformer must be created and started on a thread with a Looper.
      Handler(Looper.getMainLooper()).post {
        try {
          exportPortrait(context, options.uri, promise)
        } catch (e: Exception) {
          promise.reject("ERR_VIDEO_EXPORT", e.message ?: "Export failed", e)
        }
      }
    }
  }

  /** Center-crops any video to 9:16 and re-encodes it as 720x1280 H.264. */
  @OptIn(UnstableApi::class)
  private fun exportPortrait(context: Context, uri: String, promise: Promise) {
    val output = File(context.cacheDir, "kidi-export-${UUID.randomUUID()}.mp4")

    val edited = EditedMediaItem.Builder(MediaItem.fromUri(Uri.parse(uri)))
      .setEffects(
        Effects(
          emptyList(),
          listOf(
            Presentation.createForWidthAndHeight(
              OUTPUT_WIDTH,
              OUTPUT_HEIGHT,
              Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP,
            ),
          ),
        ),
      )
      .build()

    val encoderFactory = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(
        VideoEncoderSettings.Builder().setBitrate(VIDEO_BITRATE).build(),
      )
      .build()

    val transformer = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .setEncoderFactory(encoderFactory)
      .addListener(
        object : Transformer.Listener {
          override fun onCompleted(composition: Composition, exportResult: ExportResult) {
            promise.resolve(
              mapOf(
                "uri" to Uri.fromFile(output).toString(),
                "width" to OUTPUT_WIDTH,
                "height" to OUTPUT_HEIGHT,
                "size" to output.length().toDouble(),
              ),
            )
          }

          override fun onError(
            composition: Composition,
            exportResult: ExportResult,
            exportException: ExportException,
          ) {
            output.delete()
            promise.reject("ERR_VIDEO_EXPORT", exportException.message ?: "Export failed", exportException)
          }
        },
      )
      .build()

    transformer.start(edited, output.absolutePath)
  }
}
