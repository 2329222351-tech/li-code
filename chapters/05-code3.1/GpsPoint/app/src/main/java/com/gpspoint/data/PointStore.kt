package com.gpspoint.data

import android.content.Context
import org.json.JSONArray

/**
 * 点位落盘：SharedPreferences 里一个 JSON 数组。
 *
 * 为什么不用数据库 / 文件：点位是**手工**采的，量级最多几十个，
 * 一个 JSON 字符串读写毫无压力，也不用引入 Room 那一套。
 */
object PointStore {

    private const val PREFS = "points"
    private const val KEY_LIST = "list"

    /** 全部点位，新采的在前 */
    fun list(context: Context): List<SavedPoint> {
        val raw = prefs(context).getString(KEY_LIST, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length())
                .mapNotNull { i ->
                    array.optJSONObject(i)?.let { SavedPoint.fromJson(it, i.toLong()) }
                }
                .sortedByDescending { it.createdAt }
        } catch (t: Throwable) {
            // 文件坏了就当没有，不要因此让 App 起不来
            emptyList()
        }
    }

    fun find(context: Context, id: Long): SavedPoint? = list(context).firstOrNull { it.id == id }

    fun add(context: Context, name: String, lat: Double, lng: Double, accuracy: Float): SavedPoint {
        val point = SavedPoint(
            id = System.currentTimeMillis(),
            name = name,
            lat = lat,
            lng = lng,
            accuracy = accuracy,
            createdAt = System.currentTimeMillis()
        )
        persist(context, list(context) + point)
        return point
    }

    fun rename(context: Context, id: Long, name: String): Boolean {
        val all = list(context)
        if (all.none { it.id == id }) return false
        persist(context, all.map { if (it.id == id) it.copy(name = name) else it })
        return true
    }

    fun remove(context: Context, id: Long): Boolean {
        val all = list(context)
        if (all.none { it.id == id }) return false
        persist(context, all.filterNot { it.id == id })
        return true
    }

    private fun persist(context: Context, points: List<SavedPoint>) {
        val array = JSONArray()
        points.forEach { array.put(it.toJson()) }
        prefs(context).edit().putString(KEY_LIST, array.toString()).apply()
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
