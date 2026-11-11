package expo.modules.stromobraniintegrity

import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StromobraniIntegrityModule : Module() {
  private var provider: StandardIntegrityManager.StandardIntegrityTokenProvider? = null

  override fun definition() = ModuleDefinition {
    Name("StromobraniIntegrity")

    AsyncFunction("prepare") { cloudProjectNumber: Double, promise: Promise ->
      val context = appContext.reactContext
      if (context == null || cloudProjectNumber <= 0) {
        promise.reject("INTEGRITY_CONFIG", "Chybí Google Cloud Project number.", null)
        return@AsyncFunction
      }
      val manager = IntegrityManagerFactory.createStandard(context)
      manager.prepareIntegrityToken(
        StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
          .setCloudProjectNumber(cloudProjectNumber.toLong())
          .build()
      ).addOnSuccessListener { tokenProvider ->
        provider = tokenProvider
        promise.resolve(true)
      }.addOnFailureListener { error ->
        promise.reject("INTEGRITY_PREPARE", error.message ?: "Příprava Play Integrity selhala.", error)
      }
    }

    AsyncFunction("requestToken") { requestHash: String, promise: Promise ->
      val tokenProvider = provider
      if (tokenProvider == null) {
        promise.reject("INTEGRITY_NOT_PREPARED", "Play Integrity není připravené.", null)
        return@AsyncFunction
      }
      tokenProvider.request(
        StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
          .setRequestHash(requestHash)
          .build()
      ).addOnSuccessListener { result ->
        promise.resolve(result.token())
      }.addOnFailureListener { error ->
        promise.reject("INTEGRITY_TOKEN", error.message ?: "Získání Integrity tokenu selhalo.", error)
      }
    }
  }
}
