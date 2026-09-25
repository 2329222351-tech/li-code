package com.gpsroam.engine

import com.gpsroam.coord.GeoMath
import com.gpsroam.coord.LatLng
import kotlin.random.Random

/**
 * 引擎每 tick 输出的一次「位置快照」，对应真实 GPS 的一次上报。
 * 字段齐全才能骗过有校验的目标应用 —— 只写经纬度会暴露出速度=0、精度=0 之类的破绽。
 */
data class TrackState(
    val position: LatLng,
    val speedMps: Float,
    val bearingDeg: Float,
    val accuracyMeters: Float,
    val altitudeMeters: Double,
    val finished: Boolean,
    /** 已走比例 0~1（按实际里程算，原地停留时不增长），供进度显示与轨迹高亮 */
    val progress: Float = 0f
)

/**
 * 轨迹引擎：纯逻辑，不依赖 Android 框架，可单独写单元测试。
 *
 * 两种驱动方式，见 [RoutePlan] 的说明：
 *  - **录制路线**（主路径）：按真实时间轴推进，速度由相邻两帧的真实位移算出来，
 *    **不做速度抖动** —— 数据本来就是真的，抖动只会把它毁掉。
 *  - 合成路线（兜底）：按给定速度匀速推进，叠加速度抖动。
 *
 * 时间调度由外部（前台服务）驱动，本类只负责状态推进。
 */
class WanderEngine(
    private val plan: RoutePlan,
    /** 兜底速度，米/秒（仅时间轴不合法、退回匀速模式时使用） */
    private val baseSpeedMps: Double,
    /** 是否叠加拟真抖动（加速度随机波动；速度抖动只作用于兜底的匀速模式） */
    private val realistic: Boolean,
    /** 录制轨迹的回放倍速：1.0 = 原速 */
    replaySpeed: Double = 1.0
) {

    /**
     * 回放倍速。**运行中随时可改**，这正是「动态调速」要的效果：
     * 只改变之后推进的快慢，当前位置、已走距离、航向都不重置。
     */
    var replaySpeed: Double = replaySpeed.coerceIn(MIN_REPLAY_SPEED, MAX_REPLAY_SPEED)
        set(value) {
            field = value.coerceIn(MIN_REPLAY_SPEED, MAX_REPLAY_SPEED)
        }

    private var traveled = 0.0
    private var elapsedMs = 0.0
    private var lastTickMs = 0L
    private var finished = false
    private var currentSpeed = 0.0

    /** 已走比例 0~1 */
    val progressRatio: Double
        get() = when {
            // 按「实际里程」而不是「时间比例」：等红灯站着不动时进度不该涨
            plan.isTimed -> if (plan.totalMeters <= 0.0) {
                0.0
            } else {
                (plan.distanceAtTime(elapsedMs) / plan.totalMeters).coerceIn(0.0, 1.0)
            }

            plan.isStatic || plan.totalMeters <= 0.0 -> 0.0
            else -> (traveled / plan.totalMeters).coerceIn(0.0, 1.0)
        }

    /**
     * 暂停后恢复时调用。
     * 不重置的话，恢复的那一 tick 会把暂停时长当成一次位移，位置会瞬移。
     */
    fun resync() {
        lastTickMs = 0L
    }

    fun tick(nowMs: Long): TrackState {
        if (lastTickMs == 0L) lastTickMs = nowMs
        var dt = (nowMs - lastTickMs) / 1000.0
        lastTickMs = nowMs
        if (dt <= 0.0) dt = 0.001
        // 前台服务被系统挂起后可能积压很久，限幅避免一次跳出去几公里
        if (dt > 5.0) dt = 5.0

        return if (plan.isTimed) tickTimed(dt) else tickSynthetic(dt)
    }

    /** 录制路线：走真实时间轴，快慢停顿都原样复现 */
    private fun tickTimed(dtSec: Double): TrackState {
        val total = plan.totalDurationMs
        if (plan.isStatic || total <= 0.0) {
            finished = false
            currentSpeed = 0.0
            return stateOf(plan.points.first(), 0.0)
        }

        // 本 tick 的增量和回看用同一个倍速，避免用户恰好在这一刻改了倍速导致速度读数跳变
        val scale = replaySpeed

        if (!finished) {
            elapsedMs += dtSec * 1000.0 * scale
            if (plan.loop) {
                if (elapsedMs >= total) elapsedMs %= total
            } else if (elapsedMs >= total) {
                elapsedMs = total
                finished = true
            }
        }

        val position = plan.pointAtTime(elapsedMs)
        currentSpeed = if (finished) {
            0.0
        } else {
            // 注意这里是「墙钟 dt」而不是「时间轴 dt」：
            // 所以倍速 2× 时上报出去的速度也会是原来的两倍，位置和速度自洽。
            // 原地停留时前后两点重合，算出来自然是 0，正好对上「站着不动」。
            val previous = plan.pointAtTime(elapsedMs - dtSec * 1000.0 * scale)
            GeoMath.distanceMeters(previous, position) / dtSec
        }
        return stateOf(position, plan.bearingAtTime(elapsedMs))
    }

    /** 兜底模式：只在时间轴不合法时才会走到 */
    private fun tickSynthetic(dtSec: Double): TrackState {
        if (plan.isStatic) {
            finished = false
            currentSpeed = 0.0
        } else if (!finished) {
            // 速度抖动 ±8%：真实 GPS 速度不会恒定
            val jitter = if (realistic) 1.0 + (Random.nextDouble() - 0.5) * 0.16 else 1.0
            currentSpeed = baseSpeedMps * jitter
            traveled += currentSpeed * dtSec
            if (plan.loop) {
                if (traveled >= plan.totalMeters) traveled %= plan.totalMeters
            } else if (traveled >= plan.totalMeters) {
                traveled = plan.totalMeters
                finished = true
                currentSpeed = 0.0
            }
        } else {
            currentSpeed = 0.0
        }
        return stateOf(plan.pointAt(traveled), plan.bearingAt(traveled))
    }

    private fun stateOf(position: LatLng, bearing: Double): TrackState {
        // 精度抖动：真实 GPS 的 accuracy 会在一个区间里浮动，恒定值很可疑
        val accuracy = if (realistic) (6.0 + Random.nextDouble() * 8.0).toFloat() else 5.0f
        return TrackState(
            position = position,
            speedMps = currentSpeed.toFloat(),
            bearingDeg = bearing.toFloat(),
            accuracyMeters = accuracy,
            altitudeMeters = ALTITUDE_METERS,
            finished = finished,
            progress = progressRatio.toFloat()
        )
    }

    companion object {
        private const val MIN_REPLAY_SPEED = 0.1
        private const val MAX_REPLAY_SPEED = 20.0

        /** 录制轨迹没有海拔，给一个固定值；比 0 更像真的 */
        private const val ALTITUDE_METERS = 30.0
    }
}
