package com.gpsroam

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.text.InputType
import android.util.TypedValue
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.gpsroam.coord.GeoMath
import com.gpsroam.data.RecordedTrack
import com.gpsroam.data.TrackSample
import com.gpsroam.data.TrackStore
import com.gpsroam.databinding.ActivityMainBinding
import com.gpsroam.engine.TrackState
import com.gpsroam.mock.MockPermission
import com.gpsroam.service.WanderService
import com.gpsroam.ui.TrackLibraryActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 唯一主屏。只有两件事：
 *
 *  1. **录制路线** —— 真实走一遍，停下命名保存，进轨迹库（和运动 App 记一次运动一样）
 *  2. **模拟路线** —— 从轨迹库选一条，调倍速，按原始时间轴原样复现，
 *     同时把自己的坐标写进系统定位，盖掉真实 GPS
 *
 * 界面上只有一个「主按钮」，位置固定，内容随状态切换：
 * 空闲＝开始录制 / 已选轨迹＝开始模拟 / 录制中＝停止并保存 / 回放中＝暂停 / 已暂停＝继续。
 * 拿着手机走路时，按钮永远在同一个地方，盲按也按得准。
 */
class MainActivity : AppCompatActivity(), ServiceConnection {

    private enum class Phase { IDLE, READY, RECORDING, PLAYING, PAUSED }

    private lateinit var binding: ActivityMainBinding

    private var wanderService: WanderService? = null
    private var bound = false

    /** 从轨迹库选中的那条；非空 = 已选轨迹状态 */
    private var loadedTrack: RecordedTrack? = null

    private var recording = false
    private var replaySpeed = 1.0
    private var trackCount = 0

    /** 录制中的实时读数，由服务每次回报刷新 */
    private var recordCount = 0
    private var recordElapsedMs = 0L
    private var recordDistanceMeters = 0.0
    private var recordStalled = false

    /** 回放中最近一次位置快照，用于状态行的百分比与里程 */
    private var lastState: TrackState? = null

    private val pickTrack = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val id = result.data?.getLongExtra(TrackLibraryActivity.EXTRA_TRACK_ID, -1L) ?: -1L
            if (id > 0L) loadTrack(id)
        }
        refreshTrackCount()
        renderAll()
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        renderAll()
    }

    private val notificationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 旋转屏幕后activity重建：把选中的轨迹恢复回来，
        // 否则界面会假装「空闲」而服务其实还在跑
        val restoredId = savedInstanceState?.getLong(KEY_TRACK_ID, -1L) ?: -1L
        replaySpeed = savedInstanceState?.getDouble(KEY_SPEED, 1.0) ?: 1.0
        if (restoredId > 0L) loadedTrack = TrackStore.load(this, restoredId)

        bindClicks()
        binding.preview.setTrack(loadedTrack?.points() ?: emptyList())
        refreshTrackCount()
        renderAll()
    }

    override fun onStart() {
        super.onStart()
        bound = bindService(
            Intent(this, WanderService::class.java),
            this,
            Context.BIND_AUTO_CREATE
        )
    }

    override fun onResume() {
        super.onResume()
        refreshTrackCount()
        renderAll()
    }

    override fun onStop() {
        super.onStop()
        // 服务可能继续在后台跑，先摘掉回调，避免持有已销毁的 Activity
        wanderService?.let {
            it.onState = null
            it.onError = null
            it.onFinished = null
            it.onStopped = null
            it.onRecordProgress = null
        }
        if (bound) {
            unbindService(this)
            bound = false
        }
        wanderService = null
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putLong(KEY_TRACK_ID, loadedTrack?.id ?: -1L)
        outState.putDouble(KEY_SPEED, replaySpeed)
    }

    // ---------- 服务 ----------

    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
        val s = (service as? WanderService.LocalBinder)?.service() ?: return
        wanderService = s

        s.onState = { state ->
            runOnUiThread {
                lastState = state
                binding.preview.setCursor(state.position)
                binding.preview.setRatio(state.progress)
                renderAll()
            }
        }
        s.onError = { msg ->
            runOnUiThread {
                toast(msg)
                recording = s.isRecording()
                renderAll()
            }
        }
        s.onFinished = {
            runOnUiThread {
                lastState = null
                binding.preview.setCursor(null)
                binding.preview.setRatio(1f)
                toast(getString(R.string.msg_finished))
                renderAll()
            }
        }
        s.onStopped = {
            runOnUiThread {
                lastState = null
                binding.preview.setCursor(null)
                binding.preview.setRatio(0f)
                renderAll()
            }
        }
        s.onRecordProgress = { count, elapsedMs, distance, points ->
            runOnUiThread {
                recordCount = count
                recordElapsedMs = elapsedMs
                recordDistanceMeters = distance
                recordStalled = count == 0 && elapsedMs > STALL_HINT_MS
                if (points.isNotEmpty()) binding.preview.setTrack(points)
                renderAll()
            }
        }

        recording = s.isRecording()
        renderAll()
    }

    override fun onServiceDisconnected(name: ComponentName?) {
        wanderService = null
    }

    // ---------- 状态渲染 ----------

    private fun phase(): Phase {
        val s = wanderService
        val running = s?.isRunning() == true
        return when {
            recording -> Phase.RECORDING
            running && s?.paused == true -> Phase.PAUSED
            running -> Phase.PLAYING
            loadedTrack != null -> Phase.READY
            else -> Phase.IDLE
        }
    }

    private fun renderAll() {
        val p = phase()

        // 状态名 + 状态色
        val phaseRes = when (p) {
            Phase.IDLE -> R.string.phase_idle
            Phase.READY -> R.string.phase_ready
            Phase.RECORDING -> R.string.phase_recording
            Phase.PLAYING -> R.string.phase_playing
            Phase.PAUSED -> R.string.phase_paused
        }
        val phaseColor = when (p) {
            Phase.RECORDING -> R.color.state_record
            Phase.PLAYING -> R.color.state_play
            Phase.PAUSED -> R.color.state_pause
            else -> R.color.text_primary
        }
        binding.tvPhase.setText(phaseRes)
        binding.tvPhase.setTextColor(color(phaseColor))

        // 状态行
        binding.tvLine.text = when (p) {
            Phase.IDLE -> getString(R.string.line_idle)

            Phase.RECORDING -> if (recordStalled) {
                getString(R.string.msg_no_gps)
            } else {
                getString(
                    R.string.line_recording,
                    TrackStore.formatDuration(recordElapsedMs),
                    recordCount,
                    TrackStore.formatDistance(recordDistanceMeters)
                )
            }

            Phase.READY -> {
                val t = loadedTrack!!
                val avg = if (t.durationMs > 0L) {
                    GeoMath.mpsToKmh(t.distanceMeters / (t.durationMs / 1000.0))
                } else 0.0
                getString(
                    R.string.line_ready,
                    t.name,
                    TrackStore.formatDistance(t.distanceMeters),
                    TrackStore.formatDuration(t.durationMs),
                    String.format(Locale.US, "%.1f", avg)
                )
            }

            Phase.PLAYING, Phase.PAUSED -> {
                val t = loadedTrack
                if (t == null) {
                    getString(R.string.line_idle)
                } else {
                    // 刚旋转完或刚启动时还没有 tick 过，按 0% 显示，一秒内就会补上真实值
                    val pr = lastState?.progress ?: 0f
                    val pct = (pr * 100f).toInt()
                    val done = t.distanceMeters * pr
                    if (p == Phase.PAUSED) {
                        getString(
                            R.string.line_paused, pct,
                            TrackStore.formatDistance(done),
                            TrackStore.formatDistance(t.distanceMeters)
                        )
                    } else {
                        getString(
                            R.string.line_playing, pct,
                            TrackStore.formatDistance(done),
                            TrackStore.formatDistance(t.distanceMeters)
                        )
                    }
                }
            }
        }

        // 主按钮：文案 + 底色
        val primaryText = when (p) {
            Phase.IDLE -> R.string.btn_start_record
            Phase.READY -> R.string.btn_start_sim
            Phase.RECORDING -> R.string.btn_stop_save
            Phase.PLAYING -> R.string.btn_pause
            Phase.PAUSED -> R.string.btn_resume
        }
        val primaryColor = if (p == Phase.RECORDING) R.color.state_record else R.color.brand
        binding.btnPrimary.setText(primaryText)
        binding.btnPrimary.backgroundTintList = ColorStateList.valueOf(color(primaryColor))

        // 次按钮：回放/暂停时是「停止」；空闲是「去轨迹库选一条」；
        // 已选轨迹是「重新录制」—— 选中一条轨迹后必须还能回到录制，
        // 否则除了杀进程没有任何路能再录一条（轨迹库入口在底部常驻，不必占用次按钮）。
        // 录制中整块隐藏 —— 正在录的时候，什么都不该能点
        binding.btnSecondary.setText(
            when (p) {
                Phase.PLAYING, Phase.PAUSED -> R.string.btn_stop
                Phase.READY -> R.string.btn_change_track
                else -> R.string.btn_pick_track
            }
        )
        val secondaryVisible = p == Phase.PLAYING || p == Phase.PAUSED ||
            (p != Phase.RECORDING && trackCount > 0)
        binding.btnSecondary.visibility = if (secondaryVisible) View.VISIBLE else View.GONE

        // 倍速：已选轨迹时就能先调好，回放中随时改
        val speedVisible = p == Phase.READY || p == Phase.PLAYING || p == Phase.PAUSED
        binding.groupSpeed.visibility = if (speedVisible) View.VISIBLE else View.GONE
        if (speedVisible) renderSpeedButtons()

        // 轨迹库入口：跑着的时候不让进，避免半路把轨迹换掉
        binding.btnLibrary.isEnabled = p == Phase.IDLE || p == Phase.READY
        binding.btnLibrary.text = if (trackCount > 0) {
            getString(R.string.btn_library, trackCount)
        } else {
            getString(R.string.btn_library_empty)
        }

        renderPermission()
    }

    private fun renderSpeedButtons() {
        listOf(
            binding.spd1x to 1.0,
            binding.spd2x to 2.0,
            binding.spd5x to 5.0,
            binding.spd10x to 10.0
        ).forEach { (button, value) ->
            val on = kotlin.math.abs(replaySpeed - value) < 0.01
            button.backgroundTintList = ColorStateList.valueOf(
                color(if (on) R.color.seg_on else R.color.seg_off)
            )
            button.setTextColor(color(if (on) android.R.color.white else R.color.seg_off_text))
        }
    }

    private fun renderPermission() {
        val mockOk = MockPermission.isAllowed(this)
        val locOk = hasFineLocation()
        if (mockOk && locOk) {
            binding.barPermission.visibility = View.GONE
            return
        }
        binding.barPermission.visibility = View.VISIBLE
        binding.tvPermission.setText(
            when {
                !mockOk && !locOk -> R.string.permission_both_missing
                !mockOk -> R.string.permission_mock_missing
                else -> R.string.permission_loc_missing
            }
        )
    }

    // ---------- 交互 ----------

    private fun bindClicks() {
        binding.btnPrimary.setOnClickListener { onPrimary() }
        binding.btnSecondary.setOnClickListener { onSecondary() }
        binding.btnLibrary.setOnClickListener { openLibrary() }
        binding.btnPermission.setOnClickListener { onPermissionClick() }

        binding.spd1x.setOnClickListener { setSpeed(1.0) }
        binding.spd2x.setOnClickListener { setSpeed(2.0) }
        binding.spd5x.setOnClickListener { setSpeed(5.0) }
        binding.spd10x.setOnClickListener { setSpeed(10.0) }
    }

    private fun onPrimary() {
        when (phase()) {
            Phase.IDLE -> startRecording()
            Phase.READY -> startSimulation()
            Phase.RECORDING -> stopRecordingAndSave()
            Phase.PLAYING, Phase.PAUSED -> togglePause()
        }
    }

    private fun onSecondary() {
        when (phase()) {
            Phase.PLAYING, Phase.PAUSED -> stopSimulation()
            // 已选轨迹：次按钮是「重新录制」，直接开录（startRecording 会放掉选中的轨迹）
            Phase.READY -> startRecording()
            else -> openLibrary()
        }
    }

    private fun openLibrary() {
        pickTrack.launch(Intent(this, TrackLibraryActivity::class.java))
    }

    private fun onPermissionClick() {
        if (!hasFineLocation()) requestLocation() else openDevOptions()
    }

    // ---------- 录制 ----------

    private fun startRecording() {
        val s = wanderService ?: return toast(getString(R.string.msg_service))
        if (!hasFineLocation()) {
            toast(getString(R.string.msg_need_loc))
            requestLocation()
            return
        }
        ensureNotificationPermission()
        if (s.isRunning()) stopSimulation()

        // 从「已选轨迹」直接开录，就把选中的轨迹放掉，避免状态打架
        loadedTrack = null
        recordCount = 0
        recordElapsedMs = 0L
        recordDistanceMeters = 0.0
        recordStalled = false
        lastState = null
        binding.preview.setTrack(emptyList())

        startService(Intent(this, WanderService::class.java))
        s.startRecording()
        // 以服务为准：录制真正起来了才算进入录制态
        recording = s.isRecording()
        if (recording) toast(getString(R.string.msg_recording))
        renderAll()
    }

    private fun stopRecordingAndSave() {
        val s = wanderService ?: return
        val samples = s.stopRecording()
        recording = false
        recordStalled = false
        stopService(Intent(this, WanderService::class.java))
        renderAll()

        if (samples.size < 2) {
            toast(getString(R.string.msg_record_short))
            binding.preview.setTrack(emptyList())
            return
        }
        askNameAndSave(samples)
    }

    private fun askNameAndSave(samples: List<TrackSample>) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT
            hint = getString(R.string.dialog_save_hint)
            setText(defaultTrackName())
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.dialog_save_title)
            .setView(wrapInPadding(input))
            .setPositiveButton(R.string.btn_save) { _, _ ->
                val typed = input.text.toString().trim()
                val name = typed.ifEmpty { defaultTrackName() }
                val saved = TrackStore.save(this, name, samples)
                if (saved == null) {
                    toast(getString(R.string.msg_record_short))
                    binding.preview.setTrack(emptyList())
                } else {
                    toast(getString(R.string.msg_saved, saved.name))
                    // 存完直接选中，方便马上试跑一次
                    loadedTrack = saved
                    binding.preview.setTrack(saved.points())
                }
                refreshTrackCount()
                renderAll()
            }
            .setNegativeButton(R.string.btn_discard) { _, _ ->
                toast(getString(R.string.msg_discarded))
                binding.preview.setTrack(emptyList())
                renderAll()
            }
            .setCancelable(false)
            .show()
    }

    // ---------- 回放 ----------

    private fun loadTrack(id: Long) {
        val t = TrackStore.load(this, id)
        if (t == null) {
            toast(getString(R.string.msg_record_short))
            return
        }
        loadedTrack = t
        lastState = null
        binding.preview.setTrack(t.points())
        toast(getString(R.string.msg_loaded))
        renderAll()
    }

    private fun startSimulation() {
        val t = loadedTrack ?: return toast(getString(R.string.msg_no_track))
        val s = wanderService ?: return toast(getString(R.string.msg_service))

        if (!MockPermission.isAllowed(this)) {
            toast(getString(R.string.msg_need_mock))
            openDevOptions()
            return
        }
        // Android 14 起，location 类型的前台服务强制要求已持有精确定位权限，
        // 缺了会直接抛 SecurityException。这里必须先挡住。
        if (!hasFineLocation()) {
            toast(getString(R.string.msg_need_loc))
            requestLocation()
            return
        }
        ensureNotificationPermission()

        lastState = null
        binding.preview.setCursor(null)
        binding.preview.setRatio(0f)

        // 轨迹文件的长度或时间轴万一不合法，引擎会退回匀速模式，
        // 这时候用这条轨迹的平均速度兜底，至少不是站着不动
        val fallback = if (t.durationMs > 0L) {
            (t.distanceMeters / (t.durationMs / 1000.0)).coerceAtLeast(0.5)
        } else 1.4

        startService(Intent(this, WanderService::class.java))
        s.startWandering(t.points(), t.offsetsMs(), fallback, replaySpeed)
        renderAll()
    }

    private fun togglePause() {
        val s = wanderService ?: return
        if (s.paused) s.resume() else s.pause()
        renderAll()
    }

    private fun stopSimulation() {
        wanderService?.stopWandering()
        stopService(Intent(this, WanderService::class.java))
        lastState = null
        binding.preview.setCursor(null)
        binding.preview.setRatio(0f)
        renderAll()
    }

    /** 倍速改动立即生效，不打断回放：只有按钮高亮变化，不弹提示、不弹确认 */
    private fun setSpeed(value: Double) {
        replaySpeed = value
        wanderService?.setReplaySpeed(value)
        renderAll()
    }

    // ---------- 权限 ----------

    private fun hasFineLocation(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun requestLocation() {
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    /** Android 13+ 通知要运行时授权，不给的话前台服务通知看不到（服务本身照常跑） */
    private fun ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) return
        notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun openDevOptions() {
        val candidates = listOf(
            Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS),
            Intent(Settings.ACTION_SETTINGS)
        )
        for (intent in candidates) {
            try {
                startActivity(intent)
                return
            } catch (t: Throwable) {
                // 换下一个
            }
        }
        toast("请手动进入：设置 → 关于手机 → 连点版本号 → 开发者选项")
    }

    // ---------- 小工具 ----------

    private fun refreshTrackCount() {
        trackCount = TrackStore.list(this).size
    }

    private fun color(id: Int): Int = ContextCompat.getColor(this, id)

    private fun defaultTrackName(): String =
        getString(R.string.default_track_name, SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date()))

    private fun wrapInPadding(view: EditText): FrameLayout {
        val pad = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, 20f, resources.displayMetrics
        ).toInt()
        return FrameLayout(this).apply {
            setPadding(pad, pad / 2, pad, 0)
            addView(
                view,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    companion object {
        private const val KEY_TRACK_ID = "loaded_track_id"
        private const val KEY_SPEED = "replay_speed"

        /** 录了这么久还是一个点都没有，基本就是没收到 GPS */
        private const val STALL_HINT_MS = 20_000L
    }
}
