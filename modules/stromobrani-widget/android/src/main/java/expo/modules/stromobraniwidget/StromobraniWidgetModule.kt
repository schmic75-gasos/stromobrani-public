package expo.modules.stromobraniwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StromobraniWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StromobraniWidget")

    Function("updateSnapshot") { props: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@Function
      val streak = (props["streak"] as? Number)?.toInt() ?: 0
      val treeName = props["treeName"]?.toString().orEmpty()
      val distance = props["distance"]?.toString().orEmpty()
      context.getSharedPreferences(TreeWidgetProvider.PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .putInt("streak", streak)
        .putString("treeName", treeName)
        .putString("distance", distance)
        .apply()

      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, TreeWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { widgetId ->
        TreeWidgetProvider.updateWidget(context, manager, widgetId)
      }
    }
  }
}
