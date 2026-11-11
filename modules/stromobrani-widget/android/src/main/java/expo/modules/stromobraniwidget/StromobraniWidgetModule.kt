package expo.modules.stromobraniwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StromobraniWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StromobraniWidget")

    /** Snímek stavu z aplikace (i z úlohy na pozadí). Widget se překreslí hned. */
    Function("updateSnapshot") { props: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@Function
      fun num(key: String) = (props[key] as? Number)?.toLong() ?: 0L
      fun str(key: String) = props[key]?.toString().orEmpty()
      context.getSharedPreferences(TreeWidgetProvider.PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .putInt("streak", num("streak").toInt())
        .putString("treeName", str("treeName"))
        .putString("distance", str("distance"))
        .putLong("kod", num("kod"))
        .putString("tod", str("tod"))
        .putLong("todKod", num("todKod"))
        .putInt("visits", num("visits").toInt())
        .putLong("ts", if (num("ts") > 0) num("ts") else System.currentTimeMillis())
        .apply()

      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, TreeWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { widgetId ->
        TreeWidgetProvider.updateWidget(context, manager, widgetId)
      }
    }
  }
}
