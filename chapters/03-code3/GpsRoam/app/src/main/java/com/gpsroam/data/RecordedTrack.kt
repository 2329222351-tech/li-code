package com.gpsroam.data

import com.gpsroam.coord.LatLng

/** 一次 GPS 采样：位置 + 距录制开始的时间偏移 */
data class TrackSample(val point: LatLng, val offsetMs: Long)

/**
 * 一条录制下来的**真实**轨迹。
 *
 * 和手动画的路线最大的区别是「带时间」：时间戳让回放能原样还原
 * 当时的加速、减速、路口等灯、甚至停下来歇了十分钟。
 * 这也是「复现我真实走过的路线」这个需求的核心价值。
 */
data class RecordedTrack(
    val id: Long,
    val name: String,
    val createdAt: Long,
    val samples: List<TrackSample>,
    val distanceMeters: Double,
    val durationMs: Long
) {
    val pointCount: Int get() = samples.size

    fun points(): List<LatLng> = samples.map { it.point }

    fun offsetsMs(): LongArray = LongArray(samples.size) { samples[it].offsetMs }
}

/** 列表页用的轻量元信息，避免为了显示一行就把几万个坐标读进内存 */
data class TrackMeta(
    val id: Long,
    val name: String,
    val createdAt: Long,
    val pointCount: Int,
    val distanceMeters: Double,
    val durationMs: Long
)
