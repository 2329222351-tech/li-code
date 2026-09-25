package com.gpsroam.engine

import com.gpsroam.coord.GeoMath
import com.gpsroam.coord.LatLng

/**
 * 一条待行走的路线。坐标系：WGS-84。
 *
 * 主路径是**录制路线**：每个采样点都带时间偏移，按「已过时间」推进。
 * 当时走得快就走得快，路口等灯就停在原地，中途坐下来歇十分钟也照实复现 ——
 * 这正是它比任何手画路线都真实的原因。
 *
 * 同时保留**合成路线**（只按距离匀速推进）作为兜底：
 * 万一某个轨迹文件的时间轴坏了（长度对不上、非递增、全为 0），
 * 就退回这个模式，至少还能按平均速度走完，而不是直接不动。
 *
 * 只有 1 个点时为定点模式。
 */
class RoutePlan(
    val points: List<LatLng>,
    val loop: Boolean,
    /** 录制轨迹才有：offsetsMs[i] 是 points[i] 距开始的时间偏移（毫秒，单调递增） */
    offsetsMs: LongArray? = null
) {

    private val cumulative = DoubleArray(points.size)

    /** 校验通过的时间轴；不合法时置空，退回匀速模式 */
    private val offsets: LongArray?

    val totalMeters: Double
    val isStatic: Boolean

    /** 录制路线的总时长（毫秒）；非录制路线为 0 */
    val totalDurationMs: Double

    val isTimed: Boolean get() = offsets != null

    init {
        require(points.isNotEmpty()) { "路线至少需要 1 个点" }

        var acc = 0.0
        for (i in 1 until points.size) {
            acc += GeoMath.distanceMeters(points[i - 1], points[i])
            cumulative[i] = acc
        }
        totalMeters = acc
        isStatic = points.size == 1 || acc <= 0.0

        val candidate = offsetsMs
        offsets = if (candidate != null &&
            candidate.size == points.size &&
            points.size >= 2 &&
            candidate.last() > 0L
        ) candidate else null
        totalDurationMs = offsets?.last()?.toDouble() ?: 0.0
    }

    // ---------- 按时间（录制路线，主路径） ----------

    /** 已播放 elapsedMs 毫秒后的位置 */
    fun pointAtTime(elapsedMs: Double): LatLng {
        val axis = offsets ?: return points.first()
        val t = normalizeTime(elapsedMs)
        val seg = segmentIndexByTime(axis, t)
        val segStart = axis[seg].toDouble()
        val segLen = (axis[seg + 1] - axis[seg]).toDouble()
        val k = if (segLen <= 0.0) 0.0 else (t - segStart) / segLen
        return GeoMath.lerp(points[seg], points[seg + 1], k)
    }

    fun bearingAtTime(elapsedMs: Double): Double {
        val axis = offsets ?: return 0.0
        return bearingNear(segmentIndexByTime(axis, normalizeTime(elapsedMs)))
    }

    /**
     * 已播放 elapsedMs 毫秒时，沿路线**实际走出**的距离（米）。
     *
     * 用它而不是时间比例来做进度，是为了让「等红灯站着不动」期间进度不涨 ——
     * 时间在走、路没走，进度就不该动。
     */
    fun distanceAtTime(elapsedMs: Double): Double {
        val axis = offsets ?: return 0.0
        val t = normalizeTime(elapsedMs)
        val seg = segmentIndexByTime(axis, t)
        val segStart = axis[seg].toDouble()
        val segLen = (axis[seg + 1] - axis[seg]).toDouble()
        val k = if (segLen <= 0.0) 0.0 else ((t - segStart) / segLen).coerceIn(0.0, 1.0)
        val segMeters = cumulative[seg + 1] - cumulative[seg]
        return cumulative[seg] + segMeters * k
    }

    // ---------- 按距离（兜底：时间轴不合法时） ----------

    /** 沿路线推进 distance 米后的位置 */
    fun pointAt(distance: Double): LatLng {
        if (isStatic) return points.first()
        val d = normalizeDistance(distance)
        val seg = segmentIndexOf(d)
        val segStart = cumulative[seg]
        val segLen = cumulative[seg + 1] - segStart
        val t = if (segLen <= 0.0) 0.0 else (d - segStart) / segLen
        return GeoMath.lerp(points[seg], points[seg + 1], t)
    }

    fun bearingAt(distance: Double): Double {
        if (isStatic) return 0.0
        return bearingNear(segmentIndexOf(normalizeDistance(distance)))
    }

    // ---------- 内部 ----------

    /**
     * 找 seg 附近第一个有真实位移的段来算航向。
     *
     * 原地停留会写出位置完全相同的相邻点，那段长度是 0，
     * 直接拿去算航向会得到 0°（正北），表现为停顿期间航向突然抖一下。
     * 所以优先往回找（最近一次真实移动的方向），找不到再往前。
     */
    private fun bearingNear(seg: Int): Double {
        var i = seg
        var guard = 0
        while (i in 0 until points.size - 1 && guard < MAX_BEARING_SCAN) {
            if (GeoMath.distanceMeters(points[i], points[i + 1]) > MIN_BEARING_SEGMENT_M) {
                return GeoMath.bearingDegrees(points[i], points[i + 1])
            }
            i--
            guard++
        }
        i = seg + 1
        guard = 0
        while (i in 0 until points.size - 1 && guard < MAX_BEARING_SCAN) {
            if (GeoMath.distanceMeters(points[i], points[i + 1]) > MIN_BEARING_SEGMENT_M) {
                return GeoMath.bearingDegrees(points[i], points[i + 1])
            }
            i++
            guard++
        }
        return 0.0
    }

    private fun normalizeDistance(distance: Double): Double {
        if (!loop) return distance.coerceIn(0.0, totalMeters)
        var d = distance % totalMeters
        if (d < 0) d += totalMeters
        return d
    }

    private fun normalizeTime(elapsedMs: Double): Double {
        if (totalDurationMs <= 0.0) return 0.0
        if (!loop) return elapsedMs.coerceIn(0.0, totalDurationMs)
        var t = elapsedMs % totalDurationMs
        if (t < 0) t += totalDurationMs
        return t
    }

    /** 二分查找距离落在哪一段（返回段起始点下标） */
    private fun segmentIndexOf(d: Double): Int {
        var lo = 0
        var hi = points.size - 2
        while (lo < hi) {
            val mid = (lo + hi) / 2
            if (cumulative[mid + 1] < d) lo = mid + 1 else hi = mid
        }
        return lo
    }

    /** 二分查找时间落在哪一段（返回段起始点下标） */
    private fun segmentIndexByTime(axis: LongArray, t: Double): Int {
        var lo = 0
        var hi = points.size - 2
        while (lo < hi) {
            val mid = (lo + hi) / 2
            if (axis[mid + 1].toDouble() < t) lo = mid + 1 else hi = mid
        }
        return lo
    }

    companion object {
        /** 短于这个长度的段不参与航向计算（视为原地停留） */
        private const val MIN_BEARING_SEGMENT_M = 0.5

        /** 航向搜寻的最多跨越段数，避免极端情况下退化成整表扫描 */
        private const val MAX_BEARING_SCAN = 512
    }
}
