package com.gpsroam.coord

import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/** 球面几何计算：距离、航向、插值。 */
object GeoMath {

    private const val EARTH_RADIUS = 6371008.8

    /** Haversine 距离，单位米 */
    fun distanceMeters(a: LatLng, b: LatLng): Double {
        val lat1 = Math.toRadians(a.lat)
        val lat2 = Math.toRadians(b.lat)
        val dLat = lat2 - lat1
        val dLng = Math.toRadians(b.lng - a.lng)
        val h = sin(dLat / 2).pow(2) + cos(lat1) * cos(lat2) * sin(dLng / 2).pow(2)
        return 2 * EARTH_RADIUS * asin(min(1.0, sqrt(h)))
    }

    /** a → b 的初始航向，0~360 度，正北为 0 */
    fun bearingDegrees(a: LatLng, b: LatLng): Double {
        val lat1 = Math.toRadians(a.lat)
        val lat2 = Math.toRadians(b.lat)
        val dLng = Math.toRadians(b.lng - a.lng)
        val y = sin(dLng) * cos(lat2)
        val x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLng)
        var brng = Math.toDegrees(atan2(y, x))
        if (brng < 0) brng += 360.0
        return brng
    }

    /** 在短距离内按比例线性插值（公里级距离误差可忽略） */
    fun lerp(a: LatLng, b: LatLng, t: Double): LatLng {
        val k = t.coerceIn(0.0, 1.0)
        return LatLng(a.lat + (b.lat - a.lat) * k, a.lng + (b.lng - a.lng) * k)
    }

    /** 米/秒 → 公里/小时 */
    fun mpsToKmh(mps: Double): Double = mps * 3.6

    /** 公里/小时 → 米/秒 */
    fun kmhToMps(kmh: Double): Double = kmh / 3.6
}
