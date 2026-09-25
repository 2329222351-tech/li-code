package com.gpsroam.mock

import android.annotation.SuppressLint
import android.content.Context
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.SystemClock
import com.gpsroam.engine.TrackState

/**
 * 注入层：向系统注册一个测试用的定位 Provider，并持续写入假坐标。
 *
 * 关键点：把测试 Provider 命名为 `gps`，直接顶掉真实的 GPS Provider，
 * 这样其他应用请求 [LocationManager.GPS_PROVIDER] 时拿到的就是假位置。
 *
 * ⚠️ 必须在主线程调用 —— `addTestProvider` 需要当前线程已准备好 Looper。
 */
class MockLocationInjector(context: Context) {

    private val locationManager = context.applicationContext
        .getSystemService(Context.LOCATION_SERVICE) as LocationManager

    private var registered = false

    val isRegistered: Boolean get() = registered

    /**
     * 注册并启用测试 Provider。
     * @throws IllegalStateException 未授予「模拟位置」权限时抛出，附带给用户看的提示。
     */
    @SuppressLint("WrongConstant")
    fun start() {
        if (registered) return
        try {
            try {
                locationManager.addTestProvider(
                    PROVIDER,
                    false,                    // requiresNetwork
                    false,                    // requiresSatellite
                    false,                    // requiresCell
                    false,                    // hasMonetaryCost
                    true,                     // supportsAltitude
                    true,                     // supportsSpeed
                    true,                     // supportsBearing
                    Criteria.POWER_LOW,
                    Criteria.ACCURACY_FINE
                )
            } catch (e: IllegalArgumentException) {
                // Provider 已存在（例如上次异常退出没清理干净），继续走启用流程
            }
            locationManager.setTestProviderEnabled(PROVIDER, true)
        } catch (e: SecurityException) {
            throw IllegalStateException(
                "缺少「模拟位置」权限：请到 开发者选项 → 选择模拟位置信息应用 中选中本应用",
                e
            )
        }
        registered = true
    }

    /** 写入一次位置。字段尽量填全，否则容易暴露。 */
    fun push(state: TrackState) {
        if (!registered) return
        val loc = Location(PROVIDER).apply {
            latitude = state.position.lat
            longitude = state.position.lng
            accuracy = state.accuracyMeters
            altitude = state.altitudeMeters
            speed = state.speedMps
            bearing = state.bearingDeg
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                verticalAccuracyMeters = 5f
                speedAccuracyMetersPerSecond = 0.5f
                bearingAccuracyDegrees = 5f
            }
        }
        try {
            locationManager.setTestProviderLocation(PROVIDER, loc)
        } catch (e: SecurityException) {
            registered = false
            throw e
        }
    }

    /** 移除测试 Provider，把 GPS 交还给系统 */
    fun stop() {
        if (!registered) return
        try {
            locationManager.setTestProviderEnabled(PROVIDER, false)
            locationManager.removeTestProvider(PROVIDER)
        } catch (t: Throwable) {
            // 已经被系统回收，忽略
        }
        registered = false
    }

    companion object {
        /** 复用真实 GPS Provider 的名字，实现全局覆盖 */
        const val PROVIDER = LocationManager.GPS_PROVIDER
    }
}
