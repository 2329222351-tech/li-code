package com.gpspoint.locate

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat

/**
 * 采集一次**真实的**定位。
 *
 * 四条规则：
 * 1. **不拿系统缓存坐标冒充** —— `getLastKnownLocation` 可能是几小时前的，
 *    更糟的是可能就是我们自己刚注入的假点。所以只等新上报的 fix。
 * 2. **取最好的一次，而不是第一次** —— 冷启动第一个 fix 常有几十米误差，
 *    会立刻改善。精度好到 [ACCURACY_EXCELLENT_M] 就收；否则再听 [SETTLE_MS]，
 *    用这段时间里最好的一次（有更好的就继续更新，最后取最优）。
 * 3. **超时必失败** —— 拿不到就说拿不到，不编一个坐标出来。
 * 4. **实时回报精度** —— 界面上显示「正在取定位… ±23 m」，用户知道在等什么。
 */
class RealLocationFetcher(context: Context) {

    sealed class Result {
        data class Ok(val fix: Fix) : Result()
        object NoPermission : Result()
        object NoProvider : Result()
        object Timeout : Result()
    }

    data class Fix(val lat: Double, val lng: Double, val accuracy: Float)

    private val appContext = context.applicationContext
    private val manager = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val handler = Handler(Looper.getMainLooper())

    private var listener: LocationListener? = null
    private var callback: ((Result) -> Unit)? = null
    private var onProgress: ((Float) -> Unit)? = null
    private var best: Location? = null
    private var finished = false
    private var settleScheduled = false

    private val settleRunnable = Runnable { finishWithBest() }

    private val timeoutRunnable = Runnable { finishWithBest() }

    fun isActive(): Boolean = listener != null

    @SuppressLint("MissingPermission")
    fun fetch(
        timeoutMs: Long,
        onProgress: (accuracyMeters: Float) -> Unit = {},
        onResult: (Result) -> Unit
    ) {
        if (listener != null) return
        if (ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            onResult(Result.NoPermission)
            return
        }

        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { provider ->
                try {
                    manager.isProviderEnabled(provider)
                } catch (t: Throwable) {
                    false
                }
            }
        if (providers.isEmpty()) {
            onResult(Result.NoProvider)
            return
        }

        finished = false
        best = null
        settleScheduled = false
        this.onProgress = onProgress
        callback = onResult

        val newListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (finished || location.accuracy <= 0f) return

                val current = best
                if (current == null || location.accuracy < current.accuracy) {
                    best = location
                    onProgress.invoke(location.accuracy)
                }
                val candidate = best ?: return

                // 已经够准了，不用再等
                if (candidate.accuracy <= ACCURACY_EXCELLENT_M) {
                    finish(Result.Ok(fixOf(candidate)))
                    return
                }
                // 能用但不够准：再听 3 秒，期间有更好的就换
                if (candidate.accuracy <= ACCURACY_ACCEPT_M && !settleScheduled) {
                    settleScheduled = true
                    handler.postDelayed(settleRunnable, SETTLE_MS)
                }
            }

            override fun onProviderEnabled(provider: String) {}

            override fun onProviderDisabled(provider: String) {}

            @Deprecated("API 29 起废弃；旧系统仍会回调，必须实现")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }
        listener = newListener

        try {
            providers.forEach { provider ->
                manager.requestLocationUpdates(
                    provider,
                    0L,
                    0f,
                    newListener,
                    Looper.getMainLooper()
                )
            }
        } catch (t: Throwable) {
            finish(Result.NoProvider)
            return
        }
        handler.postDelayed(timeoutRunnable, timeoutMs)
    }

    /** 页面退出时取消，回调不会再触发 */
    fun cancel() {
        finished = true
        handler.removeCallbacks(settleRunnable)
        handler.removeCallbacks(timeoutRunnable)
        detach()
        callback = null
        onProgress = null
    }

    /** 收尾：有能用的就给出最好的那个，否则算超时 */
    private fun finishWithBest() {
        if (finished) return
        val candidate = best
        if (candidate != null && candidate.accuracy <= ACCURACY_ACCEPT_M) {
            finish(Result.Ok(fixOf(candidate)))
        } else {
            finish(Result.Timeout)
        }
    }

    private fun finish(result: Result) {
        if (finished) return
        finished = true
        handler.removeCallbacks(settleRunnable)
        handler.removeCallbacks(timeoutRunnable)
        detach()
        val cb = callback
        callback = null
        onProgress = null
        cb?.invoke(result)
    }

    private fun detach() {
        val current = listener ?: return
        listener = null
        try {
            manager.removeUpdates(current)
        } catch (t: Throwable) {
            // 已经没了，忽略
        }
    }

    private fun fixOf(location: Location) =
        Fix(location.latitude, location.longitude, location.accuracy)

    companion object {
        /** 精度好到这个程度就不用再等了（真实 GPS 室外通常 3~15 m） */
        private const val ACCURACY_EXCELLENT_M = 12f

        /** 差于此值的不算「准点位」，宁可报失败也不保存 */
        private const val ACCURACY_ACCEPT_M = 100f

        /** 第一个能用的 fix 之后，再听这么久，取最好的那一次 */
        private const val SETTLE_MS = 3_000L
    }
}
