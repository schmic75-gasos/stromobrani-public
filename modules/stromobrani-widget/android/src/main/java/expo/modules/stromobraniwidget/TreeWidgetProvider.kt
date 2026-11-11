package expo.modules.stromobraniwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class TreeWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
    widgetIds.forEach { updateWidget(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, widgetId: Int, newOptions: Bundle?) {
    updateWidget(context, manager, widgetId)
  }

  companion object {
    const val PREFERENCES = "stromobrani_widget"

    private fun open(context: Context, deepLink: String?, code: Int): PendingIntent {
      val intent = if (deepLink != null) {
        Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).setPackage(context.packageName)
      } else {
        context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun days(n: Int) = when (n) { 1 -> "den"; 2, 3, 4 -> "dny"; else -> "dní" }

    fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val prefs = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      val views = RemoteViews(context.packageName, R.layout.tree_widget_v2)
      val streak = prefs.getInt("streak", 0)
      val name = prefs.getString("treeName", null)?.takeIf { it.isNotBlank() }
      val kod = prefs.getLong("kod", 0)
      val tod = prefs.getString("tod", null)?.takeIf { it.isNotBlank() }
      val todKod = prefs.getLong("todKod", 0)
      val visits = prefs.getInt("visits", 0)
      val ts = prefs.getLong("ts", 0)

      views.setTextViewText(R.id.tw2_streak, "🔥 $streak ${days(streak)}")
      views.setTextViewText(R.id.tw2_name, name ?: "Žádný strom poblíž")
      views.setTextViewText(R.id.tw2_distance, prefs.getString("distance", null).orEmpty())
      views.setTextViewText(R.id.tw2_tod, if (tod != null) "🌟 Strom dne: $tod (+10 b)" else "")
      views.setViewVisibility(R.id.tw2_tod, if (tod != null) View.VISIBLE else View.GONE)
      val stale = ts > 0 && System.currentTimeMillis() - ts > 3 * 3600_000L
      val time = if (ts > 0) SimpleDateFormat("H:mm", Locale.getDefault()).format(Date(ts)) else "—"
      views.setTextViewText(R.id.tw2_footer, "$visits stromů · ${if (stale) "naposledy" else "aktualizováno"} $time")

      views.setOnClickPendingIntent(R.id.tw2_root, open(context, null, 1))
      if (kod > 0) views.setOnClickPendingIntent(R.id.tw2_tree, open(context, "stromobrani://strom/$kod", 2))
      if (todKod > 0) views.setOnClickPendingIntent(R.id.tw2_tod, open(context, "stromobrani://strom/$todKod", 3))
      manager.updateAppWidget(widgetId, views)
    }
  }
}
