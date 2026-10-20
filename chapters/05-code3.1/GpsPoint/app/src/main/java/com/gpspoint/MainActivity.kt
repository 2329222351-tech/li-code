package com.gpspoint

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
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.gpspoint.data.PointStore
import com.gpspoint.data.SavedPoint
import com.gpspoint.databinding.ActivityMainBinding
import com.gpspoint.databinding.ItemPointBinding
import com.gpspoint.locate.RealLocationFetcher
import com.gpspoint.mock.MockPermission
import com.gpspoint.service.PointService
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/**
 * 唯一界面。
 *
 * 只做两件事：
 *  1. **采集** —— 用手机真实 GPS 采一个点，起个名字存下来；
 *  2. **应用** —— 点列表里的某一行，把系统定位定到那个点，直到手动停止。
 *
 * 界面只有一个主按钮、一份列表、一个状态区，没有第二个页面。
 * 采集与应用**互斥**：注入会注册名为 `gps` 的测试 Provider 顶掉真实 GPS，
 * 这时去采集只会采到自己写的假坐标，所以定位中不提供采集入口，要先停止。
 */
class MainActivity : AppCompatActivity(), ServiceConnection {

    private lateinit var binding: ActivityMainBinding
    private lateinit var fetcher: RealLocationFetcher

    private var service: PointService? = null
    private var bound = false

    private var points: List<SavedPoint> = emptyList()

    /** 正在向 GPS 要一次真实定位 */
    private var capturing = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        render()
    }

    private val notificationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        fetcher = RealLocationFetcher(this)

        binding.list.adapter = PointAdapter()
        binding.list.setOnItemClickListener { _, _, position, _ ->
            if (position in points.indices) applyPoint(points[position])
        }
        binding.list.setOnItemLongClickListener { _, _, position, _ ->
            if (position in points.indices) showRowMenu(points[position])
            true
        }
        binding.btnPrimary.setOnClickListener { onPrimary() }
        binding.btnPermission.setOnClickListener { onPermissionClick() }

        render()
    }

    override fun onStart() {
        super.onStart()
        bound = bindService(
            Intent(this, PointService::class.java),
            this,
            Context.BIND_AUTO_CREATE
        )
    }

    override fun onResume() {
        super.onResume()
        reload()
        render()
    }

    override fun onStop() {
        super.onStop()
        // 服务可能还在跑，先摘掉回调，避免持有已销毁的 Activity
        service?.onError = null
        service?.onStopped = null
        if (bound) {
            unbindService(this)
            bound = false
        }
        service = null

        // 离开页面就别继续要定位了，等回来再重采
        if (fetcher.isActive()) {
            fetcher.cancel()
            capturing = false
        }
    }

    // ---------- 服务 ----------

    override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
        val connected = (binder as? PointService.LocalBinder)?.service() ?: return
        service = connected

        connected.onError = { message ->
            runOnUiThread {
                toast(message)
                render()
            }
        }
        connected.onStopped = {
            runOnUiThread { render() }
        }
        render()
    }

    override fun onServiceDisconnected(name: ComponentName?) {
        service = null
    }

    /** 当前真正在注入的点；null = 空闲 */
    private fun runningPoint(): SavedPoint? {
        val running = service ?: return null
        return if (running.isRunning()) running.activePoint else null
    }

    // ---------- 渲染 ----------

    private fun render() {
        val active = runningPoint()

        // 状态名：空闲=墨色，定位中=主色
        binding.tvPhase.setText(if (active != null) R.string.phase_running else R.string.phase_idle)
        binding.tvPhase.setTextColor(color(if (active != null) R.color.brand else R.color.ink))

        // 状态行：等宽，切换时不左右抖
        binding.tvLine.text = when {
            active != null -> {
                val base = getString(
                    R.string.line_running,
                    active.name,
                    formatCoord(active.lat, active.lng)
                )
                val accuracy = accuracyText(active.accuracy)
                if (accuracy != null) "$base · $accuracy" else base
            }
            capturing -> getString(R.string.line_capturing)
            points.isEmpty() -> getString(R.string.line_empty)
            else -> getString(R.string.line_idle)
        }

        binding.tvCount.text = getString(R.string.count_points, points.size)
        binding.tvHint.setText(
            if (active != null) R.string.hint_switch else R.string.hint_long_press
        )
        // 空列表时「长按改名 / 删除」没有对象，直接不显示
        binding.tvHint.visibility = if (points.isEmpty()) View.GONE else View.VISIBLE

        // 列表 / 空态
        val empty = points.isEmpty()
        binding.emptyState.visibility = if (empty) View.VISIBLE else View.GONE
        binding.list.visibility = if (empty) View.GONE else View.VISIBLE

        // 主按钮：位置固定，只有文案和颜色变
        when {
            active != null -> {
                binding.btnPrimary.setText(R.string.btn_stop)
                binding.btnPrimary.isEnabled = true
                binding.btnPrimary.backgroundTintList =
                    ColorStateList.valueOf(color(R.color.stop))
            }
            else -> {
                binding.btnPrimary.setText(R.string.btn_capture)
                binding.btnPrimary.isEnabled = !capturing
                binding.btnPrimary.backgroundTintList =
                    ColorStateList.valueOf(color(R.color.brand))
            }
        }

        // 脚注：一句话说清当前状态下的注意事项
        binding.tvFoot.setText(
            when {
                active != null -> R.string.foot_running
                capturing -> R.string.foot_capturing
                empty -> R.string.foot_empty
                else -> R.string.foot_idle
            }
        )

        (binding.list.adapter as? BaseAdapter)?.notifyDataSetChanged()
        renderPermission()
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
                !mockOk && !locOk -> R.string.banner_both
                !mockOk -> R.string.banner_mock
                else -> R.string.banner_loc
            }
        )
    }

    // ---------- 交互 ----------

    private fun onPrimary() {
        if (runningPoint() != null) stopInjecting() else startCapture()
    }

    private fun stopInjecting() {
        service?.stopInjecting()
        stopService(Intent(this, PointService::class.java))
        render()
    }

    private fun startCapture() {
        if (capturing) return
        if (!hasFineLocation()) {
            toast(getString(R.string.msg_need_loc))
            requestLocation()
            return
        }
        capturing = true
        render()

        fetcher.fetch(
            timeoutMs = CAPTURE_TIMEOUT_MS,
            onProgress = { accuracy ->
                // 边等边把当前精度显示出来，让用户看得到「在变准」
                if (capturing) {
                    binding.tvLine.text = getString(
                        R.string.line_capturing_accuracy,
                        accuracy.roundToInt().coerceAtLeast(1)
                    )
                }
            }
        ) { result ->
            capturing = false
            when (result) {
                is RealLocationFetcher.Result.Ok -> askSave(result.fix)
                RealLocationFetcher.Result.NoPermission -> {
                    toast(getString(R.string.msg_need_loc))
                    requestLocation()
                }
                RealLocationFetcher.Result.NoProvider -> toast(getString(R.string.msg_no_provider))
                RealLocationFetcher.Result.Timeout -> toast(getString(R.string.msg_fix_timeout))
            }
            render()
        }
    }

    private fun askSave(fix: RealLocationFetcher.Fix) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT
            hint = getString(R.string.dialog_save_hint)
            setText(defaultPointName())
            setSelection(text.length)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.dialog_save_title)
            .setMessage(
                getString(
                    R.string.dialog_save_msg,
                    formatCoord(fix.lat, fix.lng),
                    fix.accuracy.roundToInt()
                )
            )
            .setView(pad(input))
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_save) { _, _ ->
                // 名字可以不改，回车直接存
                val name = input.text.toString().trim().ifEmpty { defaultPointName() }
                val saved = PointStore.add(this, name, fix.lat, fix.lng, fix.accuracy)
                toast(getString(R.string.msg_saved, saved.name))
                reload()
                render()
            }
            .setCancelable(false)
            .show()
    }

    /** 点一行 = 立刻定过去；已经在定位时点是**切换**，不闪回真实位置 */
    private fun applyPoint(target: SavedPoint) {
        if (capturing) {
            toast(getString(R.string.msg_capturing))
            return
        }
        if (runningPoint()?.id == target.id) return

        if (!MockPermission.isAllowed(this)) {
            toast(getString(R.string.msg_need_mock))
            openDevOptions()
            return
        }
        // Android 14 起，location 型前台服务强制要求已持有精确定位权限
        if (!hasFineLocation()) {
            toast(getString(R.string.msg_need_loc))
            requestLocation()
            return
        }
        ensureNotificationPermission()

        val connected = service
        if (connected == null) {
            toast(getString(R.string.msg_service))
            return
        }

        val wasRunning = connected.isRunning()
        startService(Intent(this, PointService::class.java))
        connected.startAt(target)
        if (wasRunning) toast(getString(R.string.msg_switched, target.name))
        render()
    }

    private fun showRowMenu(target: SavedPoint) {
        val options = arrayOf(getString(R.string.btn_rename), getString(R.string.btn_delete))
        AlertDialog.Builder(this)
            .setTitle(target.name)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> askRename(target)
                    1 -> askDelete(target)
                }
            }
            .show()
    }

    private fun askRename(target: SavedPoint) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT
            hint = getString(R.string.dialog_rename_hint)
            setText(target.name)
            setSelection(text.length)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.btn_rename)
            .setView(pad(input))
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_save) { _, _ ->
                val name = input.text.toString().trim()
                if (name.isEmpty()) return@setPositiveButton
                if (!PointStore.rename(this, target.id, name)) return@setPositiveButton
                toast(getString(R.string.msg_renamed))
                // 正在用这个点：把服务里的对象一起换掉，通知栏才不会显示旧名字
                if (runningPoint()?.id == target.id) {
                    PointStore.find(this, target.id)?.let { service?.startAt(it) }
                }
                reload()
                render()
            }
            .show()
    }

    private fun askDelete(target: SavedPoint) {
        AlertDialog.Builder(this)
            .setTitle(target.name)
            .setMessage(R.string.msg_delete_confirm)
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_delete) { _, _ ->
                // 删的是正在用的点：先停，别挂着一个已经不存在的点位
                if (runningPoint()?.id == target.id) stopInjecting()
                PointStore.remove(this, target.id)
                toast(getString(R.string.msg_deleted))
                reload()
                render()
            }
            .show()
    }

    private fun onPermissionClick() {
        if (!hasFineLocation()) requestLocation() else openDevOptions()
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
        ) {
            return
        }
        notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /**
     * 开发者选项没打开时，`ACTION_APPLICATION_DEVELOPMENT_SETTINGS` 只会弹一句
     * 「不可用」再退回 App，用户会以为按钮坏了。所以先判断一下，直接送到「关于手机」，
     * 并告诉用户要连点版本号。
     */
    private fun openDevOptions() {
        if (!devOptionsEnabled()) {
            toast(getString(R.string.msg_enable_dev_first))
            if (startActivitySafely(Intent(Settings.ACTION_DEVICE_INFO_SETTINGS))) return
        } else if (startActivitySafely(Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS))) {
            return
        }
        if (startActivitySafely(Intent(Settings.ACTION_SETTINGS))) return
        toast("请手动进入：设置 → 关于手机 → 连点版本号 → 开发者选项")
    }

    private fun devOptionsEnabled(): Boolean = try {
        Settings.Global.getInt(
            contentResolver,
            Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
            0
        ) == 1
    } catch (t: Throwable) {
        // 读不到就按「已开启」处理，交给系统页面自己判断
        true
    }

    private fun startActivitySafely(intent: Intent): Boolean = try {
        startActivity(intent)
        true
    } catch (t: Throwable) {
        false
    }

    // ---------- 列表 ----------

    private fun reload() {
        points = PointStore.list(this)
        (binding.list.adapter as? BaseAdapter)?.notifyDataSetChanged()
    }

    private inner class PointAdapter : BaseAdapter() {
        override fun getCount(): Int = points.size

        override fun getItem(position: Int): Any = points[position]

        override fun getItemId(position: Int): Long = points[position].id

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val item = if (convertView == null) {
                ItemPointBinding.inflate(layoutInflater, parent, false)
                    .also { it.root.tag = it }
            } else {
                convertView.tag as ItemPointBinding
            }

            val point = points[position]
            val active = runningPoint()?.id == point.id

            item.tvName.text = point.name
            item.tvName.setTextColor(color(if (active) R.color.brand else R.color.ink))
            item.tvCoord.text = formatCoord(point.lat, point.lng)
            item.tvMeta.text = getString(
                R.string.point_meta,
                accuracyText(point.accuracy) ?: getString(R.string.accuracy_unknown),
                formatTime(point.createdAt)
            )
            item.card.setBackgroundResource(
                if (active) R.drawable.bg_point_row_active else R.drawable.bg_point_row
            )
            item.tvPill.visibility = if (active) View.VISIBLE else View.GONE
            item.tvChev.visibility = if (active) View.GONE else View.VISIBLE
            return item.root
        }
    }

    // ---------- 小工具 ----------

    private fun formatCoord(lat: Double, lng: Double): String =
        String.format(Locale.US, "%.6f, %.6f", lat, lng)

    private fun accuracyText(accuracy: Float): String? =
        if (accuracy > 0f) getString(R.string.accuracy_value, accuracy.roundToInt()) else null

    private fun formatTime(millis: Long): String =
        SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(millis))

    private fun defaultPointName(): String =
        getString(R.string.default_point_name, formatTime(System.currentTimeMillis()))

    private fun color(id: Int): Int = ContextCompat.getColor(this, id)

    private fun pad(view: EditText): FrameLayout {
        val padding = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, 20f, resources.displayMetrics
        ).toInt()
        return FrameLayout(this).apply {
            setPadding(padding, padding / 2, padding, 0)
            addView(
                view,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    companion object {
        /** 采集最长等 15 秒；超时宁可报错，也不拿缓存坐标凑数 */
        private const val CAPTURE_TIMEOUT_MS = 15_000L
    }
}
