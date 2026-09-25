package com.gpsroam.service

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
import com.gpsroam.MainActivity
import com.gpsroam.R
import com.gpsroam.coord.LatLng
import com.gpsroam.data.TrackSample
import com.gpsroam.engine.RoutePlan
import com.gpsroam.engine.TrackState
import com.gpsroam.engine.WanderEngine
import com.gpsroam.mock.MockLocationInjector
import com.gpsroam.record.TrackRecorder
import java.util.Locale

/**
 * 保活层：以「已启动 + 可绑定」的服务形态持有整个模拟过程。
 *
 * 为什么必须是前台服务：录制和回放都要长时间跑，普通后台服务会被系统回收，
 * 用户会遇到「走一半就不动了」或者「录了半天一个点没记上」。
 *
 * 两种**互斥**的工作模式：
 *  - **录制 RECORD**：读真实 GPS 存成轨迹，之后可以回放复现；
 *  - **回放 INJECT**：把录下来的坐标按原时间轴写进系统，让别的 App 以为你在别处。
 *
 * ⚠️ 互斥是硬要求，不是偏好。回放会注册一个叫 `gps` 的测试 Provider 顶掉真实 GPS，
 * 一边注入一边录，录到的就是我们自己写进去的假坐标 —— 录出来一条假轨迹，
 * 回放还是假的，等于白忙。所以 [startRecording] 会先拆注入，[startWandering] 会先停录制。
 */
class WanderService : Service() {

    inner class LocalBinder : Binder() {
        fun service(): WanderService = this@WanderService
    }

    private enum class Mode { IDLE, INJECT, RECORD }

    private val binder = LocalBinder()
    private val handler = Handler(Looper.getMainLooper())

    private lateinit var injector: MockLocationInjector
    private lateinit var recorder: TrackRecorder
    private var engine: WanderEngine? = null
    private var mode = Mode.IDLE

    /** 当前回放倍速；改倍速时通知栏也要跟着刷新 */
    private var currentScale = 1.0

    /** UI 回调 */
    var onState: ((TrackState) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onFinished: (() -> Unit)? = null

    /** 被「通知栏的停止」这类外部入口停掉时回调，让界面别停在旧状态 */
    var onStopped: (() -> Unit)? = null

    /** 录制中定期回报：点数 + 已录时长 + 已走里程 + 当前轨迹（供主屏实时画） */
    var onRecordProgress: ((Int, Long, Double, List<LatLng>) -> Unit)? = null

    var paused = false
        private set

    fun isRunning(): Boolean = engine != null

    fun isRecording(): Boolean = mode == Mode.RECORD

    // ---------- 回放 ----------

    private val ticker = object : Runnable {
        override fun run() {
            val e = engine ?: return
            if (paused) {
                handler.postDelayed(this, TICK_MS)
                return
            }
            try {
                val state = e.tick(System.currentTimeMillis())
                injector.push(state)
                onState?.invoke(state)
                if (state.finished) {
                    teardown()
                    onFinished?.invoke()
                    return
                }
            } catch (t: Throwable) {
                teardown()
                onError?.invoke(t.message ?: "写入位置失败")
                return
            }
            handler.postDelayed(this, TICK_MS)
        }
    }

    // ---------- 录制 ----------

    private val recordTicker = object : Runnable {
        override fun run() {
            if (mode != Mode.RECORD) return
            val count = recorder.sampleCount
            val elapsed = recorder.elapsedMs()
            val distance = recorder.distanceMeters
            onRecordProgress?.invoke(count, elapsed, distance, recorder.points())
            notify(buildNotification(activeText()))
            handler.postDelayed(this, RECORD_NOTIFY_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        injector = MockLocationInjector(this)
        recorder = TrackRecorder(this)
        createChannel()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            // 通知栏的「暂停 / 继续」与「停止」，用户揣着手机走路时不用掏出来开 App
            ACTION_TOGGLE_PAUSE -> {
                if (engine != null) {
                    if (paused) resume() else pause()
                }
            }

            ACTION_STOP -> {
                stopWandering()
                stopSelf()
            }
        }
        return START_STICKY
    }

    // ---------- 对外命令 ----------

    /**
     * 开始回放并注入。
     *
     * @param offsetsMs 录制轨迹的时间轴。合法时就按真实时间复现快慢与停顿；
     *                  万一不合法，[RoutePlan] 会退回匀速模式，用 [fallbackSpeedMps] 兜底。
     * @param replaySpeed 回放倍速，1.0 = 原速。运行中还能用 [setReplaySpeed] 改。
     */
    fun startWandering(
        points: List<LatLng>,
        offsetsMs: LongArray?,
        fallbackSpeedMps: Double,
        replaySpeed: Double
    ) {
        if (mode == Mode.RECORD) stopRecordingQuietly()
        if (engine != null) stopWandering()

        try {
            injector.start()
        } catch (t: Throwable) {
            onError?.invoke(t.message ?: "无法启动模拟定位")
            return
        }

        engine = WanderEngine(
            plan = RoutePlan(points, loop = false, offsetsMs = offsetsMs),
            baseSpeedMps = fallbackSpeedMps,
            realistic = true,
            replaySpeed = replaySpeed
        )
        currentScale = replaySpeed
        paused = false
        mode = Mode.INJECT
        try {
            startAsForeground(activeText())
        } catch (t: Throwable) {
            // 比如 Android 14 上没拿到精确定位权限就起 location 型前台服务
            teardown()
            onError?.invoke(t.message ?: "无法启动前台服务")
            return
        }
        handler.removeCallbacks(ticker)
        handler.post(ticker)
    }

    /**
     * 运行中动态调整回放倍速。
     *
     * 只改变之后推进的快慢 —— 当前位置、已走距离、航向都不重置，
     * 注入是连续的一条流，不会跳点。这是「动态调速」的关键性质。
     */
    fun setReplaySpeed(scale: Double) {
        engine?.replaySpeed = scale
        currentScale = scale
        if (mode == Mode.INJECT && !paused) refreshNotification()
    }

    fun pause() {
        paused = true
        refreshNotification()
    }

    fun resume() {
        paused = false
        engine?.resync()
        refreshNotification()
    }

    fun stopWandering() {
        teardown()
    }

    // ---------- 录制 ----------

    /** 开始录制真实 GPS。会先拆掉注入，否则录到的是我们自己写的假坐标。 */
    fun startRecording() {
        if (mode == Mode.RECORD) return
        if (engine != null) stopWandering()

        try {
            recorder.start()
        } catch (t: Throwable) {
            onError?.invoke(t.message ?: "无法启动录制")
            return
        }
        mode = Mode.RECORD
        try {
            startAsForeground(activeText())
        } catch (t: Throwable) {
            if (::recorder.isInitialized && recorder.isRecording) recorder.stop()
            mode = Mode.IDLE
            onError?.invoke(t.message ?: "无法启动前台服务")
            return
        }
        handler.removeCallbacks(recordTicker)
        handler.post(recordTicker)
    }

    fun stopRecording(): List<TrackSample> = stopRecordingQuietly()

    private fun stopRecordingQuietly(): List<TrackSample> {
        handler.removeCallbacks(recordTicker)
        val samples = if (::recorder.isInitialized) recorder.stop() else emptyList()
        if (mode == Mode.RECORD) mode = Mode.IDLE
        stopForeground(STOP_FOREGROUND_REMOVE)
        return samples
    }

    // ---------- 收尾 ----------

    /** 停 ticker、摘测试 Provider、停录制、撤前台通知 */
    private fun teardown() {
        val had = engine != null || mode == Mode.RECORD
        handler.removeCallbacks(ticker)
        handler.removeCallbacks(recordTicker)
        if (::injector.isInitialized) injector.stop()
        if (::recorder.isInitialized && recorder.isRecording) recorder.stop()
        engine = null
        paused = false
        mode = Mode.IDLE
        stopForeground(STOP_FOREGROUND_REMOVE)
        if (had) onStopped?.invoke()
    }

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        handler.removeCallbacks(recordTicker)
        if (::injector.isInitialized) injector.stop()
        if (::recorder.isInitialized && recorder.isRecording) recorder.stop()
        engine = null
        super.onDestroy()
    }

    // ---------- 通知 ----------

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notif_channel),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notif_channel_desc)
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun activeText(): String = when (mode) {
        Mode.INJECT -> getString(R.string.notif_playing, scaleText(currentScale))
        Mode.RECORD -> getString(
            R.string.notif_recording,
            if (::recorder.isInitialized) recorder.sampleCount else 0
        )
        Mode.IDLE -> getString(R.string.app_name)
    }

    private fun buildNotification(text: String): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_wander)
            .setOngoing(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentIntent)

        // 只在回放时给动作按钮：这时候手机多半在兜里，暂停/停止不该逼用户开 App
        if (mode == Mode.INJECT) {
            builder.addAction(
                0,
                getString(if (paused) R.string.btn_resume else R.string.btn_pause),
                actionIntent(ACTION_TOGGLE_PAUSE, 1)
            )
            builder.addAction(0, getString(R.string.btn_stop), actionIntent(ACTION_STOP, 2))
        }
        return builder.build()
    }

    private fun actionIntent(action: String, requestCode: Int): PendingIntent =
        PendingIntent.getService(
            this,
            requestCode,
            Intent(this, WanderService::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    private fun startAsForeground(text: String) {
        val notification = buildNotification(text)
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

    private fun refreshNotification() {
        if (mode == Mode.IDLE) return
        val text = if (paused) {
            getString(R.string.notif_paused, scaleText(currentScale))
        } else {
            activeText()
        }
        notify(buildNotification(text))
    }

    private fun notify(notification: Notification) {
        try {
            getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification)
        } catch (t: Throwable) {
            // 通知权限被拒时忽略，服务本身照常跑
        }
    }

    private fun scaleText(scale: Double): String =
        String.format(Locale.US, "%.1f×", scale)

    companion object {
        /** 1Hz，与真实 GPS 上报频率一致 */
        private const val TICK_MS = 1000L

        /** 录制时的刷新间隔：1 秒一次，主屏的实时轨迹才跟得上 */
        private const val RECORD_NOTIFY_MS = 1000L

        private const val CHANNEL_ID = "wander"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_TOGGLE_PAUSE = "com.gpsroam.action.TOGGLE_PAUSE"
        const val ACTION_STOP = "com.gpsroam.action.STOP"
    }
}
