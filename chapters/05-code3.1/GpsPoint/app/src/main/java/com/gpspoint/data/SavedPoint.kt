package com.gpspoint.data

import org.json.JSONObject

/**
 * 一个采下来的定点。
 *
 * 坐标一律按 **WGS-84** 处理（手机 GPS 与系统定位用的就是它）。
 * 不要往里塞高德/百度的 GCJ-02、BD-09 坐标 —— 会偏几百米。
 */
data class SavedPoint(
    val id: Long,
    val name: String,
    val lat: Double,
    val lng: Double,
    /** 采集时的定位精度（米）；0 表示未知 */
    val accuracy: Float,
    /** 采集时间（毫秒时间戳） */
    val createdAt: Long
) {

    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("name", name)
        put("lat", lat)
        put("lng", lng)
        put("acc", accuracy.toDouble())
        put("at", createdAt)
    }

    companion object {
        fun fromJson(json: JSONObject, fallbackId: Long): SavedPoint = SavedPoint(
            id = json.optLong("id", fallbackId),
            name = json.optString("name", "点位"),
            lat = json.optDouble("lat", 0.0),
            lng = json.optDouble("lng", 0.0),
            accuracy = json.optDouble("acc", 0.0).toFloat(),
            createdAt = json.optLong("at", 0L)
        )
    }
}
