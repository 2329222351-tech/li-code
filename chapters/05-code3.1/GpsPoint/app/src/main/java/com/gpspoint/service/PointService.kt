package com.gpspoint.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.gpspoint.MainActivity
import com.gpspoint.R
import com.gpspoint.data.SavedPoint
import com.gpspoint.mock.MockLocationInjector

/**
 * 保活层：前台服务持有「当前定在哪个点」，并以 1Hz 持续把坐标写进系统定位。
 *
 * 为什么必须要前台服务：模拟定位要长时间挂着，普通后台服务会被系统回收，
 * 用户会遇到「定着定着就回到真实位置了」。常驻通知同时提供「停止」按钮，
 * 手机揣兜里时不用掏出来开 App。
 *
 * 为什么是 1Hz 而不是只写一次：系统定位有「新鲜度」概念，
 * 只写一次的 fix 过一会儿就会被其它应用当成过期数据。持续上报才是「一直定在那」。
 */
class PointService : Service() {

    inner class LocalBinder : Binder() {
        fun service(): PointService = this@PointService
    }

    private val binder = LocalBinder()
    private val handler = Handler(Looper.getMainLooper())

    private lateinit var injector: MockLocationInjector

    /** 当前生效的点位；null = 没在注入 */
    private var point: SavedPoint? = null

    var onError: ((String) -> Unit)? = null

    /** 被通知栏的「停止」这类外部入口停掉时回调，让界面别停在旧状态 */
    var onStopped: (() -> Unit)? = null

    val activePoint: SavedPoint? get() = point

    fun isRunning(): Boolean = point != null

    override fun onCreate() {
        super.onCreate()
        injector = MockLocationInjector(this)
        createChannel()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopInjecting()
            stopSelf()
        }
        return START_NOT_STICKY
    }

    // ---------- 对外命令 ----------

    /**
     * 定到某个点。
     *
     * 已经在注入时再调用 = **切换点位**：Provider 不动、心跳不断，只换坐标，
     * 不会出现「拆了重建」那一瞬间漏回真实定位。
     */
    fun startAt(target: SavedPoint) {
        if (point == null) {
            try {
                injector.start()
            } catch (t: Throwable) {
                onError?.invoke(t.message ?: getString(R.string.msg_apply_failed))
                return
            }
            try {
                startAsForeground(target)
            } catch (t: Throwable) {
                // 例如 Android 14 上没拿到精确定位权限就起 location 型前台服务
                injector.stop()
                onError?.invoke(t.message ?: getString(R.string.msg_apply_failed))
                return
            }
            handler.removeCallbacks(ticker)
            handler.post(ticker)
        }
        point = target
        tickNow()
        notify(buildNotification(target))
    }

    /** 停止注入，把 GPS 交还给系统 */
    fun stopInjecting() {
        val wasRunning = point != null
        handler.removeCallbacks(ticker)
        if (::injector.isInitialized) injector.stop()
        point = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        if (wasRunning) onStopped?.invoke()
    }

    // ---------- 心跳 ----------

    private val ticker = object : Runnable {
        override fun run() {
            if (point == null) return
            tickNow()
            // 出错时 tickNow 会 stopInjecting，point 变 null，这里就不再续了
            if (point != null) handler.postDelayed(this, TICK_MS)
        }
    }

    private fun tickNow() {
        val current = point ?: return
        try {
            injector.push(current.lat, current.lng, current.accuracy)
        } catch (t: Throwable) {
            stopInjecting()
            onError?.invoke(getString(R.string.msg_push_failed))
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        if (::injector.isInitialized) injector.stop()
        point = null
        super.onDestroy()
    }

    // ---------- 通知 ----------

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notif_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notif_channel_desc)
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(target: SavedPoint): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, PointService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notif_running, target.name))
            .setSmallIcon(R.drawable.ic_stat_pin)
            .setOngoing(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentIntent)
            .addAction(0, getString(R.string.notif_stop), stopIntent)
            .build()
    }

    private fun startAsForeground(target: SavedPoint) {
        val notification = buildNotification(target)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun notify(notification: Notification) {
        try {
            getSystemService(NotificationManager::class.java)
                .notify(NOTIFICATION_ID, notification)
        } catch (t: Throwable) {
            // 通知权限被拒时忽略，服务本身照常跑
        }
    }

    companion object {
        /** 1Hz，与真实 GPS 上报频率一致 */
        private const val TICK_MS = 1000L

        private const val CHANNEL_ID = "mock_location"
        private const val NOTIFICATION_ID = 2001

        const val ACTION_STOP = "com.gpspoint.action.STOP"
    }
}
