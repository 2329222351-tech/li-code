package com.gpsroam.coord

import java.util.Locale

/**
 * 统一坐标载体。
 *
 * 约定：项目内部所有 [LatLng] 一律按 **WGS-84** 处理，禁止裸 double 传参。
 * 地图上看到的坐标是 GCJ-02，必须先经 [CoordinateConverter.gcj02ToWgs84] 转换后再构造本对象。
 */
data class LatLng(val lat: Double, val lng: Double) {

    fun isValid(): Boolean = lat in -90.0..90.0 && lng in -180.0..180.0

    override fun toString(): String = String.format(Locale.US, "%.6f, %.6f", lat, lng)
}
