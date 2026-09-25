package com.gpsroam.coord

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * WGS-84 / GCJ-02 / BD-09 三向互转。
 *
 * 这是本工具最容易出错、也最要命的一环：
 *  - 地图 App 上显示、复制的坐标是 **GCJ-02**（火星坐标，国内强制加密偏移）
 *  - 系统定位服务与 GPS 芯片使用 **WGS-84**
 *  - 百度地图用 **BD-09**
 *
 * 不转换直接注入，国内位置会整体偏移几百米。
 */
object CoordinateConverter {

    private const val PI = kotlin.math.PI
    private const val AXIS = 6378245.0                   // 克拉索夫斯基椭球长半轴
    private const val EE = 0.00669342162296594323        // 偏心率平方
    private const val X_PI = PI * 3000.0 / 180.0

    /** 粗略判断是否在中国境外；境外不做偏移，否则会把正确坐标加密坏 */
    fun isOutOfChina(lat: Double, lng: Double): Boolean {
        return !(lng in 72.004..137.8347 && lat in 0.8293..55.8271)
    }

    /** WGS-84 → GCJ-02 */
    fun wgs84ToGcj02(lat: Double, lng: Double): LatLng {
        if (isOutOfChina(lat, lng)) return LatLng(lat, lng)
        val (dLat, dLng) = offset(lat, lng)
        return LatLng(lat + dLat, lng + dLng)
    }

    /**
     * GCJ-02 → WGS-84。
     * 官方未公开逆变换，这里用迭代逼近，3 次迭代后误差在厘米级，足够使用。
     */
    fun gcj02ToWgs84(lat: Double, lng: Double): LatLng {
        if (isOutOfChina(lat, lng)) return LatLng(lat, lng)
        var wgsLat = lat
        var wgsLng = lng
        repeat(3) {
            val fwd = wgs84ToGcj02(wgsLat, wgsLng)
            wgsLat += lat - fwd.lat
            wgsLng += lng - fwd.lng
        }
        return LatLng(wgsLat, wgsLng)
    }

    /** GCJ-02 → BD-09 */
    fun gcj02ToBd09(lat: Double, lng: Double): LatLng {
        val z = sqrt(lng * lng + lat * lat) + 0.00002 * sin(lat * X_PI)
        val theta = kotlin.math.atan2(lat, lng) + 0.000003 * cos(lng * X_PI)
        return LatLng(z * sin(theta) + 0.006, z * cos(theta) + 0.0065)
    }

    /** BD-09 → GCJ-02 */
    fun bd09ToGcj02(lat: Double, lng: Double): LatLng {
        val x = lng - 0.0065
        val y = lat - 0.006
        val z = sqrt(x * x + y * y) - 0.00002 * sin(y * X_PI)
        val theta = kotlin.math.atan2(y, x) - 0.000003 * cos(x * X_PI)
        return LatLng(z * sin(theta), z * cos(theta))
    }

    /** WGS-84 → BD-09 */
    fun wgs84ToBd09(lat: Double, lng: Double): LatLng {
        val g = wgs84ToGcj02(lat, lng)
        return gcj02ToBd09(g.lat, g.lng)
    }

    /** BD-09 → WGS-84 */
    fun bd09ToWgs84(lat: Double, lng: Double): LatLng {
        val g = bd09ToGcj02(lat, lng)
        return gcj02ToWgs84(g.lat, g.lng)
    }

    private fun offset(lat: Double, lng: Double): Pair<Double, Double> {
        var dLat = transformLat(lng - 105.0, lat - 35.0)
        var dLng = transformLng(lng - 105.0, lat - 35.0)
        val radLat = lat / 180.0 * PI
        var magic = sin(radLat)
        magic = 1 - EE * magic * magic
        val sqrtMagic = sqrt(magic)
        dLat = (dLat * 180.0) / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI)
        dLng = (dLng * 180.0) / (AXIS / sqrtMagic * cos(radLat) * PI)
        return dLat to dLng
    }

    private fun transformLat(x: Double, y: Double): Double {
        var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * PI) + 20.0 * sin(2.0 * x * PI)) * 2.0 / 3.0
        ret += (20.0 * sin(y * PI) + 40.0 * sin(y / 3.0 * PI)) * 2.0 / 3.0
        ret += (160.0 * sin(y / 12.0 * PI) + 320.0 * sin(y * PI / 30.0)) * 2.0 / 3.0
        return ret
    }

    private fun transformLng(x: Double, y: Double): Double {
        var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * PI) + 20.0 * sin(2.0 * x * PI)) * 2.0 / 3.0
        ret += (20.0 * sin(x * PI) + 40.0 * sin(x / 3.0 * PI)) * 2.0 / 3.0
        ret += (150.0 * sin(x / 12.0 * PI) + 300.0 * sin(x / 30.0 * PI)) * 2.0 / 3.0
        return ret
    }
}
