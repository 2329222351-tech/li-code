package com.gpsroam.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.gpsroam.R
import com.gpsroam.coord.LatLng
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min

/**
 * 只读轨迹预览。
 *
 * 不接任何地图 SDK：把轨迹**自身**的经纬度范围等比铺满控件，
 * 只表达两件事 —— 形状对不对、走到哪了。不承诺与现实地理对齐。
 *
 * 起点绿、终点红、当前游标品牌色；已走段实线、未走段虚线。
 * 没有落点时显示占位文案。
 */
class TrackPreviewView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val density = resources.displayMetrics.density

    private var points: List<LatLng> = emptyList()

    /** 投影后的「米」坐标，用于等比铺满 */
    private var xs = DoubleArray(0)
    private var ys = DoubleArray(0)

    /** 投影后的屏幕坐标，交错存放 [x0,y0,x1,y1,...] */
    private var scr = FloatArray(0)

    private var midX = 0.0
    private var midY = 0.0
    private var unit = 1.0
    private var lngScale = METERS_PER_DEGREE
    private var latScale = METERS_PER_DEGREE

    private var cursor: LatLng? = null
    private var ratio = 0f

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.preview_bg)
    }
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x0F000000
        strokeWidth = 1f
        style = Paint.Style.STROKE
    }
    private val todoPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.preview_todo)
        strokeWidth = 2.5f * density
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        pathEffect = DashPathEffect(floatArrayOf(7f * density, 6f * density), 0f)
    }
    private val donePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.state_play)
        strokeWidth = 4f * density
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val startPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.preview_start)
    }
    private val endPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.preview_end)
    }
    private val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.state_play)
        alpha = 60
    }
    private val cursorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.state_play)
    }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.preview_bg)
        style = Paint.Style.STROKE
        strokeWidth = 2.5f * density
    }
    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ContextCompat.getColor(context, R.color.preview_hint)
        textSize = 13f * density
        textAlign = Paint.Align.CENTER
    }

    // ---------- 对外 ----------

    fun setTrack(list: List<LatLng>) {
        points = list
        cursor = null
        ratio = 0f
        rebuild()
        invalidate()
    }

    fun setCursor(position: LatLng?) {
        cursor = position
        invalidate()
    }

    fun setRatio(value: Float) {
        ratio = value.coerceIn(0f, 1f)
        invalidate()
    }

    // ---------- 投影 ----------

    private fun rebuild() {
        val n = points.size
        xs = DoubleArray(n)
        ys = DoubleArray(n)
        if (n == 0) {
            scr = FloatArray(0)
            return
        }

        var minLat = Double.MAX_VALUE
        var maxLat = -Double.MAX_VALUE
        for (p in points) {
            if (p.lat < minLat) minLat = p.lat
            if (p.lat > maxLat) maxLat = p.lat
        }
        // 经度方向按纬度余弦收窄，否则高纬度轨迹会被横向拉长
        val k = cos(Math.toRadians((minLat + maxLat) / 2.0)).coerceAtLeast(0.05)
        lngScale = METERS_PER_DEGREE * k
        latScale = METERS_PER_DEGREE

        for (i in 0 until n) {
            xs[i] = points[i].lng * lngScale
            ys[i] = points[i].lat * latScale
        }
        fit()
    }

    private fun fit() {
        if (xs.isEmpty() || width == 0 || height == 0) return

        var minX = Double.MAX_VALUE
        var maxX = -Double.MAX_VALUE
        var minY = Double.MAX_VALUE
        var maxY = -Double.MAX_VALUE
        for (i in xs.indices) {
            if (xs[i] < minX) minX = xs[i]
            if (xs[i] > maxX) maxX = xs[i]
            if (ys[i] < minY) minY = ys[i]
            if (ys[i] > maxY) maxY = ys[i]
        }
        midX = (minX + maxX) / 2.0
        midY = (minY + maxY) / 2.0

        val pad = 26f * density
        val availW = (width - 2f * pad).coerceAtLeast(1f)
        val availH = (height - 2f * pad).coerceAtLeast(1f)
        val rx = (maxX - minX).coerceAtLeast(1.0)
        val ry = (maxY - minY).coerceAtLeast(1.0)
        unit = min(availW / rx, availH / ry)

        val cx = width / 2f
        val cy = height / 2f
        scr = FloatArray(xs.size * 2)
        for (i in xs.indices) {
            scr[i * 2] = cx + ((xs[i] - midX) * unit).toFloat()
            scr[i * 2 + 1] = cy - ((ys[i] - midY) * unit).toFloat()
        }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        fit()
    }

    // ---------- 绘制 ----------

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val r = 18f * density
        canvas.drawRoundRect(0f, 0f, w, h, r, r, bgPaint)

        var gx = 40f * density
        while (gx < w) {
            canvas.drawLine(gx, 0f, gx, h, gridPaint)
            gx += 40f * density
        }
        var gy = 40f * density
        while (gy < h) {
            canvas.drawLine(0f, gy, w, gy, gridPaint)
            gy += 40f * density
        }

        if (points.size < 1 || scr.size < 2) {
            drawHint(canvas, w, h)
            return
        }

        if (points.size >= 2) {
            canvas.drawPath(path(0, points.size - 1), todoPaint)
            val walked = traveled()
            if (walked.size >= 4) canvas.drawPath(pathOf(walked), donePaint)

            canvas.drawCircle(scr[0], scr[1], 5.5f * density, startPaint)
            val last = (points.size - 1) * 2
            canvas.drawCircle(scr[last], scr[last + 1], 6.5f * density, endPaint)
        }

        cursor?.let { c ->
            val cx = (width / 2f) + ((c.lng * lngScale - midX) * unit).toFloat()
            val cy = (height / 2f) - ((c.lat * latScale - midY) * unit).toFloat()
            canvas.drawCircle(cx, cy, 13f * density, haloPaint)
            canvas.drawCircle(cx, cy, 7.5f * density, cursorPaint)
            canvas.drawCircle(cx, cy, 7.5f * density, ringPaint)
        }
    }

    private fun drawHint(canvas: Canvas, w: Float, h: Float) {
        val lines = context.getString(R.string.preview_empty).split('\n')
        val lh = 21f * density
        val n = lines.size
        lines.forEachIndexed { i, line ->
            val baseline = h / 2f + (i - (n - 1) / 2f) * lh + hintPaint.textSize * 0.34f
            canvas.drawText(line, w / 2f, baseline, hintPaint)
        }
    }

    private fun path(from: Int, to: Int): Path {
        val p = Path()
        p.moveTo(scr[from * 2], scr[from * 2 + 1])
        for (i in from + 1..to) p.lineTo(scr[i * 2], scr[i * 2 + 1])
        return p
    }

    private fun pathOf(flat: FloatArray): Path {
        val p = Path()
        p.moveTo(flat[0], flat[1])
        var i = 2
        while (i + 1 < flat.size) {
            p.lineTo(flat[i], flat[i + 1])
            i += 2
        }
        return p
    }

    /**
     * 已走的那一段屏幕折线。
     *
     * 投影是等比的，所以「屏幕长度比例」与「实际距离比例」一致 ——
     * 引擎给的 progress 是**按实际里程**算的（原地停留时不增长），直接拿来做裁剪即可。
     */
    private fun traveled(): FloatArray {
        if (ratio <= 0f || points.size < 2) return FloatArray(0)

        val segCount = points.size - 1
        val segLen = DoubleArray(segCount)
        var total = 0.0
        for (i in 0 until segCount) {
            val dx = (scr[(i + 1) * 2] - scr[i * 2]).toDouble()
            val dy = (scr[(i + 1) * 2 + 1] - scr[i * 2 + 1]).toDouble()
            segLen[i] = hypot(dx, dy)
            total += segLen[i]
        }
        if (total <= 0.0) return FloatArray(0)

        val target = total * ratio
        val out = ArrayList<Float>(points.size * 2)
        out.add(scr[0])
        out.add(scr[1])
        var acc = 0.0
        for (i in 0 until segCount) {
            if (acc + segLen[i] <= target) {
                out.add(scr[(i + 1) * 2])
                out.add(scr[(i + 1) * 2 + 1])
                acc += segLen[i]
                continue
            }
            val t = ((target - acc) / segLen[i]).toFloat().coerceIn(0f, 1f)
            out.add(scr[i * 2] + (scr[(i + 1) * 2] - scr[i * 2]) * t)
            out.add(scr[i * 2 + 1] + (scr[(i + 1) * 2 + 1] - scr[i * 2 + 1]) * t)
            break
        }
        return out.toFloatArray()
    }

    companion object {
        /** 纬度方向的每度米数 */
        private const val METERS_PER_DEGREE = 110540.0
    }
}
