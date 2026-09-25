package com.gpsroam.ui

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.gpsroam.R
import com.gpsroam.data.TrackMeta
import com.gpsroam.data.TrackStore
import com.gpsroam.databinding.ActivityTrackLibraryBinding

/**
 * 轨迹库：录制下来的轨迹都在这。
 *
 * 点一行 = 选中并回主屏（主屏会载入它，接着就能调倍速开跑）；
 * 长按 = 重命名 / 删除。
 *
 * 只存本机（`filesDir/tracks/`），不联网、不要存储权限。
 */
class TrackLibraryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTrackLibraryBinding
    private var items: List<TrackMeta> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTrackLibraryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnGoRecord.setOnClickListener { finish() }
        binding.list.setOnItemClickListener { _, _, position, _ ->
            setResult(
                Activity.RESULT_OK,
                Intent().putExtra(EXTRA_TRACK_ID, items[position].id)
            )
            finish()
        }
        binding.list.setOnItemLongClickListener { _, _, position, _ ->
            showRowMenu(items[position])
            true
        }
    }

    override fun onResume() {
        super.onResume()
        reload()
    }

    private fun reload() {
        items = TrackStore.list(this)
        binding.list.adapter = RowAdapter()
        val empty = items.isEmpty()
        binding.empty.visibility = if (empty) View.VISIBLE else View.GONE
        binding.list.visibility = if (empty) View.GONE else View.VISIBLE
    }

    private fun showRowMenu(meta: TrackMeta) {
        val options = arrayOf(getString(R.string.btn_rename), getString(R.string.btn_delete))
        AlertDialog.Builder(this)
            .setTitle(meta.name)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> askRename(meta)
                    1 -> askDelete(meta)
                }
            }
            .show()
    }

    private fun askRename(meta: TrackMeta) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT
            hint = getString(R.string.dialog_rename_hint)
            setText(meta.name)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.btn_rename)
            .setView(pad(input))
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_save) { _, _ ->
                val name = input.text.toString().trim()
                if (name.isEmpty()) return@setPositiveButton
                TrackStore.rename(this, meta.id, name)
                toast(getString(R.string.msg_renamed))
                reload()
            }
            .show()
    }

    private fun askDelete(meta: TrackMeta) {
        AlertDialog.Builder(this)
            .setTitle(meta.name)
            .setMessage(R.string.msg_delete_confirm)
            .setNegativeButton(R.string.btn_cancel, null)
            .setPositiveButton(R.string.btn_delete) { _, _ ->
                TrackStore.remove(this, meta.id)
                toast(getString(R.string.msg_deleted))
                reload()
            }
            .show()
    }

    private inner class RowAdapter : BaseAdapter() {
        override fun getCount(): Int = items.size
        override fun getItem(position: Int): Any = items[position]
        override fun getItemId(position: Int): Long = items[position].id

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: layoutInflater.inflate(R.layout.item_track, parent, false)
            val meta = items[position]
            view.findViewById<TextView>(R.id.tvName).text = meta.name
            view.findViewById<TextView>(R.id.tvSub).text = getString(
                R.string.track_item_sub,
                meta.pointCount,
                TrackStore.formatDistance(meta.distanceMeters),
                TrackStore.formatDuration(meta.durationMs)
            )
            return view
        }
    }

    private fun pad(view: EditText): FrameLayout {
        val p = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, 20f, resources.displayMetrics
        ).toInt()
        return FrameLayout(this).apply {
            setPadding(p, p / 2, p, 0)
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
        const val EXTRA_TRACK_ID = "track_id"
    }
}
