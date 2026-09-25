package com.gpsroam.data

import android.content.Context
import com.gpsroam.coord.GeoMath
import com.gpsroam.coord.LatLng
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale

/**
 * 录制轨迹的本地持久化。
 *
 * 单独一套、不用 SharedPreferences，是因为量级差太多：
 * 一条录制轨迹动辄几千个采样点，全塞进 SharedPreferences 每次读写都要整体序列化，很难受。
 *
 * 所以走内部存储文件：
 *  - `filesDir/tracks/index.json`   只存元信息，列表页读它，不必把几万个坐标读进内存
 *  - `filesDir/tracks/<id>.json`    单条轨迹的完整采样点
 *
 * 采样点用 `[纬度, 经度, 时间偏移]` 三元组紧凑存，不冗余字段。
 * **不联网、不上传、不需要存储权限。**
 */
object TrackStore {

    private const val DIR = "tracks"
    private const val INDEX = "index.json"

    private fun dir(context: Context): File =
        File(context.filesDir, DIR).apply { if (!exists()) mkdirs() }

    private fun indexFile(context: Context) = File(dir(context), INDEX)

    private fun trackFile(context: Context, id: Long) = File(dir(context), "$id.json")

    // ---------- 列表 ----------

    fun list(context: Context): List<TrackMeta> {
        val file = indexFile(context)
        if (!file.exists()) return emptyList()
        return try {
            val arr = JSONArray(file.readText())
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                TrackMeta(
                    id = o.optLong("id"),
                    name = o.optString("name", "未命名轨迹"),
                    createdAt = o.optLong("createdAt"),
                    pointCount = o.optInt("pointCount"),
                    distanceMeters = o.optDouble("distance", 0.0),
                    durationMs = o.optLong("duration")
                )
            }
        } catch (t: Throwable) {
            // 索引坏了当空库，不要让 App 起不来
            emptyList()
        }
    }

    // ---------- 读一条 ----------

    fun load(context: Context, id: Long): RecordedTrack? {
        val file = trackFile(context, id)
        if (!file.exists()) return null
        return try {
            val o = JSONObject(file.readText())
            val arr = o.optJSONArray("samples") ?: JSONArray()
            val samples = ArrayList<TrackSample>(arr.length())
            for (i in 0 until arr.length()) {
                val triple = arr.getJSONArray(i)
                samples.add(
                    TrackSample(
                        LatLng(triple.getDouble(0), triple.getDouble(1)),
                        triple.getLong(2)
                    )
                )
            }
            if (samples.isEmpty()) return null
            RecordedTrack(
                id = o.optLong("id", id),
                name = o.optString("name", "未命名轨迹"),
                createdAt = o.optLong("createdAt"),
                samples = samples,
                distanceMeters = o.optDouble("distance", distanceOf(samples)),
                durationMs = o.optLong("duration", samples.last().offsetMs)
            )
        } catch (t: Throwable) {
            null
        }
    }

    // ---------- 写一条 ----------

    fun save(context: Context, name: String, samples: List<TrackSample>): RecordedTrack? {
        if (samples.size < 2) return null

        // 第一个采样点之前那段没有位置数据 —— GPS 冷启动可能几十秒才出第一个 fix。
        // 直接把时间轴平移成从 0 开始，否则回放一开始会原地干等那段空白，
        // 而且列表里显示的时长也会被算多。
        val base = samples.first().offsetMs
        val norm = samples.map { TrackSample(it.point, (it.offsetMs - base).coerceAtLeast(0L)) }
        if (norm.last().offsetMs <= 0L) return null

        val id = System.currentTimeMillis()
        val createdAt = id
        val distance = distanceOf(norm)
        val duration = norm.last().offsetMs
        val track = RecordedTrack(id, name, createdAt, norm, distance, duration)

        try {
            val arr = JSONArray()
            norm.forEach { s ->
                arr.put(
                    JSONArray()
                        .put(round6(s.point.lat))
                        .put(round6(s.point.lng))
                        .put(s.offsetMs)
                )
            }
            val obj = JSONObject()
                .put("id", id)
                .put("name", name)
                .put("createdAt", createdAt)
                .put("distance", distance)
                .put("duration", duration)
                .put("samples", arr)
            trackFile(context, id).writeText(obj.toString())
        } catch (t: Throwable) {
            return null
        }

        // 最新录的排最前
        writeIndex(context, listOf(track.toMeta()) + list(context))
        return track
    }

    fun remove(context: Context, id: Long) {
        try {
            trackFile(context, id).delete()
        } catch (t: Throwable) {
            // 忽略
        }
        writeIndex(context, list(context).filterNot { it.id == id })
    }

    fun rename(context: Context, id: Long, newName: String) {
        val file = trackFile(context, id)
        if (file.exists()) {
            try {
                val o = JSONObject(file.readText()).put("name", newName)
                file.writeText(o.toString())
            } catch (t: Throwable) {
                return
            }
        }
        writeIndex(
            context,
            list(context).map { if (it.id == id) it.copy(name = newName) else it }
        )
    }

    // ---------- 内部 ----------

    private fun writeIndex(context: Context, metas: List<TrackMeta>) {
        try {
            val arr = JSONArray()
            metas.forEach { m ->
                arr.put(
                    JSONObject()
                        .put("id", m.id)
                        .put("name", m.name)
                        .put("createdAt", m.createdAt)
                        .put("pointCount", m.pointCount)
                        .put("distance", m.distanceMeters)
                        .put("duration", m.durationMs)
                )
            }
            indexFile(context).writeText(arr.toString())
        } catch (t: Throwable) {
            // 写失败不影响已经落盘的单条轨迹
        }
    }

    private fun distanceOf(samples: List<TrackSample>): Double {
        var total = 0.0
        for (i in 1 until samples.size) {
            total += GeoMath.distanceMeters(samples[i - 1].point, samples[i].point)
        }
        return total
    }

    /** 保留 6 位小数，约 0.1m 精度，够用又能压掉一半体积 */
    private fun round6(v: Double): Double = Math.round(v * 1_000_000.0) / 1_000_000.0

    /** 把毫秒格式化成 12:34 或 1:02:03 */
    fun formatDuration(ms: Long): String {
        val totalSec = (ms / 1000).toInt()
        val h = totalSec / 3600
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60
        return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, s)
        else String.format(Locale.US, "%d:%02d", m, s)
    }

    /** 不足 1 公里用米表示，更直观 */
    fun formatDistance(meters: Double): String =
        if (meters >= 1000.0) String.format(Locale.US, "%.2f km", meters / 1000.0)
        else String.format(Locale.US, "%.0f m", meters)

    private fun RecordedTrack.toMeta() = TrackMeta(
        id = id,
        name = name,
        createdAt = createdAt,
        pointCount = pointCount,
        distanceMeters = distanceMeters,
        durationMs = durationMs
    )
}
