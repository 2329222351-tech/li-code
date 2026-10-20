package com.gpspoint.mock

import android.annotation.SuppressLint
import android.content.Context
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.SystemClock

/**
 * 注入层：向系统注册一个测试定位 Provider，把假坐标写进去。
 *
 * 关键点：Provider 名字直接复用 `gps`，顶掉真实 GPS。
 * 这样任何走 `LocationManager` 或融合定位取位置的应用，读到的都是我们的坐标。
 *
 * ⚠️ 必须在主线程调用 —— `addTestProvider` 要求当前线程已准备好 Looper。
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
                    false,                  // requiresNetwork
                    false,                  // requiresSatellite
                    false,                  // requiresCell
                    false,                  // hasMonetaryCost
                    true,                   // supportsAltitude
                    true,                   // supportsSpeed
                    true,                   // supportsBearing
                    Criteria.POWER_LOW,
                    Criteria.ACCURACY_FINE
                )
            } catch (e: IllegalArgumentException) {
                // Provider 已存在（上次异常退出没清干净），继续走启用流程
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

    /**
     * 写入一次固定坐标。
     *
     * 定点不需要移动，所以 speed / bearing 都是 0 —— 这是「站着不动」的真实样子。
     * 精度用采集时的实测值，别硬编码成 0 或 5，那个更容易看出问题。
     */
    fun push(lat: Double, lng: Double, accuracyMeters: Float) {
        if (!registered) return
        val accuracy = if (accuracyMeters > 0f) accuracyMeters.coerceIn(3f, 50f) else 8f
        val location = Location(PROVIDER).apply {
            latitude = lat
            longitude = lng
            this.accuracy = accuracy
            altitude = 0.0
            speed = 0f
            bearing = 0f
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                verticalAccuracyMeters = 5f
                speedAccuracyMetersPerSecond = 0.2f
                bearingAccuracyDegrees = 5f
            }
        }
        try {
            locationManager.setTestProviderLocation(PROVIDER, location)
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
