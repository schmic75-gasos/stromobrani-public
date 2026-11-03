package expo.modules.stromobraniwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

class TreeWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
    widgetIds.forEach { updateWidget(context, manager, it) }
  }

  companion object {
    const val PREFERENCES = "stromobrani_widget"

    fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val prefs = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      val views = RemoteViews(context.packageName, R.layout.tree_widget).apply {
        setTextViewText(R.id.tree_widget_streak, "${prefs.getInt("streak", 0)} dní v sérii")
        setTextViewText(R.id.tree_widget_name, prefs.getString("treeName", null)?.takeIf { it.isNotBlank() } ?: "Žádný strom poblíž")
        setTextViewText(R.id.tree_widget_distance, prefs.getString("distance", null).orEmpty())
      }
      manager.updateAppWidget(widgetId, views)
    }
  }
}
