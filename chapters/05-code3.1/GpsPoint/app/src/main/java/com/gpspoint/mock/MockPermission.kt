package com.gpspoint.mock

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import android.os.Process

/**
 * 「模拟位置」授权检测。
 *
 * 这项授权不在运行时权限里，只能由用户在
 * **设置 → 开发者选项 → 选择模拟位置信息应用** 里手动选中本应用。
 * 每次重装、每次重启手机都会失效。
 */
object MockPermission {

    fun isAllowed(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
            ?: return false
        val mode = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_MOCK_LOCATION,
                    Process.myUid(),
                    context.packageName
                )
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_MOCK_LOCATION,
                    Process.myUid(),
                    context.packageName
                )
            }
        } catch (t: Throwable) {
            return false
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}
