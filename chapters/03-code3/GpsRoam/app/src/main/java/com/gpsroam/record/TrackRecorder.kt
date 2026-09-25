package com.gpsroam.record

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.os.SystemClock
import com.gpsroam.coord.GeoMath
import com.gpsroam.coord.LatLng
import com.gpsroam.data.TrackSample

/**
 * 采集真实 GPS 轨迹。
 *
 * ⚠️ **录制与注入必须互斥。**
 * 注入层会注册一个叫 `gps` 的测试 Provider 顶掉真实 GPS，
 * 只要它还在，`requestLocationUpdates(GPS_PROVIDER)` 拿到的就是我们自己写进去的假坐标
 * —— 录出来一条假轨迹，回放还是一样，白忙一场。
 * 所以 [com.gpsroam.service.WanderService] 在开始录制前一定会先把注入拆掉。
 *
 * 三道数据清洗：
 *  1. 跳过被系统标记为 mock 的采样点；
 *  2. 精度差于 [MAX_ACCURACY_M] 的丢掉，基本是漂移；
 *  3. 抽稀 —— 相邻点距离不足 [MIN_DISTANCE_M] 的不记。静止时 GPS 会持续抖出几米的漂移，
 *     不抽稀的话站着不动十分钟能记出上千个点。
 *
 * 但抽稀有个副作用必须补掉：**原地停留会完全没有采样点**，
 * 时间轴上就出现一段空白，回放时会被插值成「缓慢前进」——
 * 等一个红灯就一路漂过去。所以静止时按 [DWELL_INTERVAL_MS] 补一个位置不变的采样点，
 * 让「停住」这件事在时间轴上是明确记录下来的。
 */
class TrackRecorder(private val context: Context) {

    private val samples = ArrayList<TrackSample>()
    private val locationManager =
        context.applicationContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    private var startedAtMs = 0L
    private var listening = false

    /** 最后一次被采纳的位置；静止补点时沿用它，避免把 GPS 漂移记进去 */
    private var lastAccepted: LatLng? = null

    /** 最后一次写出采样的时间偏移 */
    private var lastSampleAtMs = 0L

    val isRecording: Boolean get() = listening
    val sampleCount: Int get() = samples.size

    var distanceMeters: Double = 0.0
        private set

    /** 上一次真正收到定位的时刻，用来看定位是不是卡住了 */
    var lastFixAtMs: Long = 0L
        private set

    /** 供主屏画「实时轨迹」用 */
    fun points(): List<LatLng> = samples.map { it.point }

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) = onSample(location)

        @Suppress("UNUSED_PARAMETER")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

        override fun onProviderEnabled(provider: String) = Unit

        override fun onProviderDisabled(provider: String) = Unit
    }

    @SuppressLint("MissingPermission")
    fun start() {
        if (listening) return
        samples.clear()
        lastAccepted = null
        lastSampleAtMs = 0L
        distanceMeters = 0.0
        lastFixAtMs = 0L
        startedAtMs = SystemClock.elapsedRealtime()
        locationManager.requestLocationUpdates(
            LocationManager.GPS_PROVIDER,
            SAMPLE_INTERVAL_MS,
            0f,
            listener,
            Looper.getMainLooper()
        )
        listening = true
    }

    /** 停止并交出采到的点（可能不足 2 个） */
    fun stop(): List<TrackSample> {
        if (listening) {
            try {
                locationManager.removeUpdates(listener)
            } catch (t: Throwable) {
                // 忽略
            }
            listening = false
        }
        return samples.toList()
    }

    fun elapsedMs(): Long =
        if (startedAtMs == 0L) 0L else SystemClock.elapsedRealtime() - startedAtMs

    private fun onSample(location: Location) {
        if (isMock(location)) return
        if (location.accuracy > MAX_ACCURACY_M) return

        val point = LatLng(location.latitude, location.longitude)
        if (!point.isValid()) return

        val offset = SystemClock.elapsedRealtime() - startedAtMs
        lastFixAtMs = SystemClock.elapsedRealtime()

        val last = lastAccepted
        if (last == null) {
            accept(point, offset)
            return
        }

        if (GeoMath.distanceMeters(last, point) >= MIN_DISTANCE_M) {
            accept(point, offset)
            return
        }

        // 没挪动，但已经过了补点间隔 —— 记一个「还在这里」的点
        if (offset - lastSampleAtMs >= DWELL_INTERVAL_MS) {
            accept(last, offset)
        }
    }

    private fun accept(point: LatLng, offsetMs: Long) {
        samples.lastOrNull()?.let {
            distanceMeters += GeoMath.distanceMeters(it.point, point)
        }
        samples.add(TrackSample(point, offsetMs))
        lastAccepted = point
        lastSampleAtMs = offsetMs
    }

    private fun isMock(location: Location): Boolean = try {
        @Suppress("DEPRECATION")
        location.isFromMockProvider
    } catch (t: Throwable) {
        false
    }

    companion object {
        /** 1Hz，与真实 GPS 上报频率一致 */
        private const val SAMPLE_INTERVAL_MS = 1000L

        /** 抽稀阈值：不到 4 米就不记 */
        private const val MIN_DISTANCE_M = 4.0

        /** 精度比这还差的定位直接丢掉，基本是漂移 */
        private const val MAX_ACCURACY_M = 60f

        /** 原地不动时每隔这么久补一个采样点，保证时间轴上的停顿不被插值抹平 */
        private const val DWELL_INTERVAL_MS = 10_000L
    }
}
