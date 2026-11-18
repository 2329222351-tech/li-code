# -*- coding: utf-8 -*-
"""
《奶蛙：午夜奶厂》恐怖游戏音效生成器
纯标准库合成：振荡器 / 噪声 / 滤波 / 包络 / 延迟混响。
输出 WAV + manifest.js 供试听页读取。可复现（固定随机种子）。
"""
import math, random, struct, wave, os, json

SR = 32000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "audio")
random.seed(1313)


def clamp(x, lo=-1.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x


# ---------------- 包络工厂：输入 u=i/(n-1)∈[0,1]，输出 0..1 ----------------
def env_ad(a=0.05, d=0.95, curve=3.0):
    def e(u):
        if u < a:
            return u / a if a > 0 else 1.0
        return max(0.0, 1.0 - (u - a) / d) ** curve
    return e


def env_adsr(a, d, sus, r):
    def e(u):
        if u < a:
            return u / a if a > 0 else 1.0
        if u < a + d:
            return 1.0 - (1.0 - sus) * (u - a) / d
        if u < 1.0 - r:
            return sus
        return sus * max(0.0, (1.0 - u) / r)
    return e


def env_hold(fi=0.02, fo=0.08):
    def e(u):
        fi_ = fi; fo_ = fo
        if u < fi_:
            return u / fi_ if fi_ > 0 else 1.0
        if u > 1.0 - fo_:
            return max(0.0, (1.0 - u) / fo_) if fo_ > 0 else 1.0
        return 1.0
    return e


def env_pulses(freq, duty=0.5):
    def e(u):
        return 1.0 if (u * freq) % 1.0 < duty else 0.0
    return e


def env_const(u):
    return 1.0


# ---------------- 合成器 ----------------
class Synth:
    def __init__(self, dur):
        self.n = max(1, int(dur * SR))
        self.buf = [0.0] * self.n
        self.dur = self.n / SR

    def _env(self, env):
        e = env or env_const
        return [e(i / (self.n - 1)) for i in range(self.n)]

    def tone(self, f0, f1=None, amp=1.0, shape='sine', env=None, phase=0.0, exp=False):
        buf = self.buf; n = self.n; ev = self._env(env)
        step0 = f0 / SR
        step1 = (f1 if f1 is not None else f0) / SR
        ph = phase
        if shape == 'sine':
            fn = math.sin
            for i in range(n):
                step = step0 + (step1 - step0) * i / n
                ph += step
                buf[i] += amp * ev[i] * math.sin(ph * 6.283185307179586)
        elif shape == 'saw':
            for i in range(n):
                step = step0 + (step1 - step0) * i / n
                ph += step
                buf[i] += amp * ev[i] * (2.0 * (ph % 1.0) - 1.0)
        elif shape == 'square':
            for i in range(n):
                step = step0 + (step1 - step0) * i / n
                ph += step
                buf[i] += amp * ev[i] * (1.0 if (ph % 1.0) < 0.5 else -1.0)
        elif shape == 'triangle':
            for i in range(n):
                step = step0 + (step1 - step0) * i / n
                ph += step
                f = ph % 1.0
                buf[i] += amp * ev[i] * (4.0 * f - 1.0 if f < 0.5 else 3.0 - 4.0 * f)
        return self

    def noise(self, amp=1.0, color='white', env=None, seed=None):
        rng = random.Random(seed) if seed is not None else random
        buf = self.buf; n = self.n; ev = self._env(env)
        if color == 'white':
            for i in range(n):
                buf[i] += amp * ev[i] * (rng.random() * 2.0 - 1.0)
        elif color == 'brown':
            last = 0.0
            for i in range(n):
                last = (last + 0.02 * (rng.random() * 2.0 - 1.0)) / 1.02
                buf[i] += amp * ev[i] * last * 3.5
        elif color == 'pink':
            b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0
            for i in range(n):
                w = rng.random() * 2.0 - 1.0
                b0 = 0.99886 * b0 + w * 0.0555179
                b1 = 0.99332 * b1 + w * 0.0750759
                b2 = 0.96900 * b2 + w * 0.1538520
                b3 = 0.86650 * b3 + w * 0.3104856
                b4 = 0.55000 * b4 + w * 0.5329522
                b5 = -0.7616 * b5 - w * 0.0168980
                v = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
                b6 = w * 0.115926
                buf[i] += amp * ev[i] * v
        return self

    def lp(self, cutoff):
        a = 1.0 - math.exp(-2.0 * math.pi * cutoff / SR)
        y = 0.0; buf = self.buf
        for i in range(len(buf)):
            y += a * (buf[i] - y)
            buf[i] = y
        return self

    def hp(self, cutoff):
        a = 1.0 / (1.0 + 2.0 * math.pi * cutoff / SR)
        buf = self.buf; prevx = 0.0; prevy = 0.0
        for i in range(len(buf)):
            x = buf[i]
            prevy = a * (prevy + x - prevx)
            prevx = x
            buf[i] = prevy
        return self

    def bandpass(self, f, q=5.0, mix=1.0):
        """状态变量滤波器带通输出，替换缓冲（用于共振峰/含混语音）。"""
        buf = self.buf; F = 2.0 * math.sin(math.pi * f / SR); Q = 1.0 / q
        low = 0.0; band = 0.0
        for i in range(len(buf)):
            x = buf[i]
            high = x - low - Q * band
            band += F * high
            low += F * band
            buf[i] = band * mix
        return self

    def am(self, rate=5.0, depth=0.5, env=None):
        buf = self.buf; n = self.n
        for i in range(n):
            buf[i] *= (1.0 - depth) + depth * (0.5 + 0.5 * math.sin(2 * math.pi * rate * i / SR))
        return self

    def reverb(self, mix=0.25, delay=0.03, feedback=0.45):
        buf = self.buf; n = self.n
        d = max(1, int(delay * SR))
        tmp = list(buf)
        for i in range(d, n):
            tmp[i] += feedback * tmp[i - d]
        d2 = int(d * 1.7)
        for i in range(d2, n):
            tmp[i] += feedback * 0.6 * tmp[i - d2]
        # 阻尼并限制增益
        peak = max(0.0001, max(abs(v) for v in tmp))
        scale = min(3.0, 1.0 / peak)
        for i in range(n):
            buf[i] = (1.0 - mix) * buf[i] + mix * tmp[i] * scale
        return self

    def distort(self, drive=3.0):
        buf = self.buf
        for i in range(len(buf)):
            buf[i] = math.tanh(buf[i] * drive)
        return self

    def normalize(self, peak=0.92):
        buf = self.buf
        m = max((abs(v) for v in buf), default=0.0)
        if m > 0.0001:
            g = peak / m
            for i in range(len(buf)):
                buf[i] *= g
        return self

    def fade(self, fi=0.005, fo=0.05):
        buf = self.buf; n = self.n
        ni = max(1, int(fi * SR)); no = max(1, int(fo * SR))
        for i in range(min(ni, n)):
            buf[i] *= i / ni
        for i in range(max(0, n - no), n):
            buf[i] *= (n - 1 - i) / no
        return self

    def write(self, path):
        with wave.open(path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(b''.join(struct.pack('<h', int(clamp(v) * 32767)) for v in self.buf))
        return self


# ================= 配方 =================
RECIPES = []


def add(name, zh, cat, dur, desc, fn):
    RECIPES.append(dict(name=name, zh=zh, cat=cat, dur=dur, desc=desc, fn=fn))


# ---------- 环境氛围 ambience ----------
def r_factory_drone(s):
    s.noise(0.35, 'brown').noise(0.12, 'pink').lp(220)
    s.tone(48, 47, 0.5, 'sine').tone(72, 71, 0.22, 'sine').tone(96, 95, 0.14, 'saw').lp(300)
    s.am(0.23, 0.25).reverb(0.3, 0.08, 0.5).normalize(0.7)


def r_fluorescent(s):
    s.tone(100, 100, 0.35, 'saw').tone(200, 199, 0.12)
    s.noise(0.18, 'white').hp(1500)
    # 不规则闪烁：多个频率的振幅调制叠加
    for i in range(s.n):
        u = i / s.n
        flick = 0.5 + 0.5 * math.sin(2 * math.pi * 7.3 * u * s.dur) * math.sin(2 * math.pi * 2.1 * u * s.dur)
        s.buf[i] *= (0.35 + 0.65 * abs(flick))
    s.reverb(0.2, 0.02, 0.3).normalize(0.6)


def r_conveyor(s):
    s.noise(0.4, 'brown').lp(500)
    # 滚轮周期性咔哒
    s.noise(0.25, 'white', env_pulses(6.0, 0.06)).lp(2000)
    s.tone(60, 60, 0.18, 'saw').lp(180)
    s.am(1.7, 0.1).normalize(0.65)


def r_pump(s):
    # 缓慢搏动：低频双拍（lub-dub）
    beat = 0.0
    for i in range(s.n):
        u = (i / SR) % 2.6
        v = 0.0
        if u < 0.22:
            v = math.sin(2 * math.pi * 46 * u) * math.exp(-u * 16)
        elif 0.32 < u < 0.5:
            v = 0.65 * math.sin(2 * math.pi * 40 * (u - 0.32)) * math.exp(-(u - 0.32) * 18)
        s.buf[i] += v * 0.9
    s.noise(0.08, 'brown').lp(120).reverb(0.3, 0.09, 0.45).normalize(0.8)


def r_ventilation(s):
    s.noise(0.55, 'pink').lp(900).hp(80)
    for i in range(s.n):
        u = i / s.n
        s.buf[i] *= 0.7 + 0.3 * math.sin(2 * math.pi * 0.7 * u + math.sin(2 * math.pi * 0.23 * u) * 2)
    s.tone(58, 55, 0.12).reverb(0.35, 0.11, 0.5).normalize(0.6)


def r_whispers(s):
    # 用共振峰滤波的噪声模拟远处含混低语
    for k, (f, amp, ph) in enumerate([(520, 0.6, 0.0), (1180, 0.45, 1.7), (2400, 0.3, 3.1)]):
        t = Synth(s.dur)
        t.noise(amp, 'pink', seed=40 + k)
        # 断续音节包络
        for i in range(t.n):
            u = i / t.n
            syl = max(0.0, math.sin(2 * math.pi * (1.3 + k * 0.4) * u + ph)) ** 1.5
            t.buf[i] *= syl
        t.bandpass(f, 6.0)
        for i in range(s.n):
            s.buf[i] += t.buf[i] * (0.55 + 0.45 * math.sin(2 * math.pi * 0.19 * i / s.n))
    s.lp(3200).reverb(0.5, 0.07, 0.6).normalize(0.5)


def r_pipe_drip(s):
    # 稀疏水滴：随机时刻的短促正弦下滑 + 混响
    n = s.n
    t = Synth(s.dur)
    for _ in range(9):
        start = random.randint(0, max(0, n - int(0.3 * SR)))
        f = random.uniform(700, 1500)
        for j in range(int(0.22 * SR)):
            if start + j >= n:
                break
            env = math.exp(-j / SR * 22)
            t.buf[start + j] += 0.7 * env * math.sin(2 * math.pi * (f - 500 * j / SR) * j / SR)
    for i in range(n):
        s.buf[i] = t.buf[i]
    s.noise(0.03, 'brown').lp(200)
    s.reverb(0.55, 0.06, 0.6).normalize(0.7)


def r_ferment(s):
    s.noise(0.45, 'pink').lp(700)
    for i in range(s.n):
        u = i / s.n
        gurgle = 0.5 + 0.5 * math.sin(2 * math.pi * 1.1 * u + 2 * math.sin(2 * math.pi * 0.4 * u))
        s.buf[i] *= gurgle
    s.tone(70, 52, 0.16, 'sine').lp(200)
    s.reverb(0.3, 0.05, 0.45).normalize(0.62)


add('amb_factory_drone', '工厂低频轰鸣', 'ambience', 10.0, '奶厂持续运转的低频底噪，压迫感铺底', r_factory_drone)
add('amb_fluorescent_buzz', '荧光灯电流滋滋', 'ambience', 8.0, '不规则闪烁的灯管电流声', r_fluorescent)
add('amb_conveyor', '传送带运转', 'ambience', 8.0, '橡胶滚轮一格一格滚动', r_conveyor)
add('amb_pump_breath', '主奶泵搏动', 'ambience', 10.4, '巨大器官般的缓慢心跳搏动', r_pump)
add('amb_ventilation', '通风管道风声', 'ambience', 10.0, '低沉呼啸的管道气流', r_ventilation)
add('amb_distant_whispers', '雾中低语', 'ambience', 10.0, '远处含混不清的耳语，雾里有东西在动', r_whispers)
add('amb_pipe_drip', '管道滴水', 'ambience', 9.0, '空旷走廊里稀疏的水滴回声', r_pipe_drip)
add('amb_fermentation', '发酵罐翻涌', 'ambience', 9.0, '黏稠液体在罐内翻滚咕嘟', r_ferment)

# ---------- 怪物 creatures ----------
def r_sludge_drag(s):
    s.noise(0.5, 'pink', env=env_ad(0.15, 0.85, 1.4)).lp(900)
    s.noise(0.3, 'brown', env=env_ad(0.2, 0.8, 2.0)).lp(300)
    s.tone(90, 60, 0.2, 'saw', env=env_ad(0.1, 0.9, 2.0)).lp(250)
    s.am(5.5, 0.4).reverb(0.3, 0.04, 0.4).normalize(0.85)


def r_sludge_spit(s):
    s.noise(0.7, 'white', env=env_ad(0.02, 0.98, 5.0)).hp(700)
    s.tone(220, 90, 0.35, 'saw', env=env_ad(0.01, 0.99, 6.0)).lp(1200)
    s.distort(2.0).normalize(0.9)


def r_spider_hiss(s):
    s.noise(0.6, 'white', env=env_adsr(0.25, 0.2, 0.8, 0.35)).hp(1800)
    s.tone(1800, 2600, 0.15, 'sine', env=env_adsr(0.3, 0.2, 0.7, 0.3))
    s.am(13.0, 0.25).reverb(0.25, 0.025, 0.35).normalize(0.8)


def r_spider_legs(s):
    n = s.n
    t = Synth(s.dur)
    for k in range(16):
        start = int(k * n / 16) + random.randint(0, 300)
        f = random.uniform(300, 700)
        for j in range(int(0.06 * SR)):
            if start + j >= n:
                break
            t.buf[start + j] += 0.8 * math.exp(-j / SR * 55) * (
                math.sin(2 * math.pi * f * j / SR) + 0.4 * (random.random() * 2 - 1))
    for i in range(n):
        s.buf[i] = t.buf[i]
    s.lp(3500).reverb(0.3, 0.03, 0.4).normalize(0.85)


def r_robot_creak(s):
    s.noise(0.4, 'white', env=env_adsr(0.2, 0.3, 0.7, 0.3)).bandpass(900, 18.0)
    s.tone(320, 210, 0.3, 'saw', env=env_adsr(0.2, 0.3, 0.6, 0.3))
    s.noise(0.2, 'pink', env=env_adsr(0.25, 0.3, 0.6, 0.25)).lp(500)
    s.am(6.0, 0.3).distort(1.5).reverb(0.3, 0.04, 0.45).normalize(0.8)


def r_jelly_drop(s):
    s.noise(0.5, 'pink', env=env_ad(0.05, 0.95, 2.5)).lp(600)
    s.tone(160, 55, 0.45, 'sine', env=env_ad(0.03, 0.97, 3.0))
    s.reverb(0.25, 0.03, 0.35).normalize(0.85)


def r_godfrog_stomp(s):
    s.tone(70, 30, 0.8, 'sine', env=env_ad(0.005, 0.995, 4.0))
    s.noise(0.5, 'white', env=env_ad(0.005, 0.995, 8.0)).lp(2500)
    s.noise(0.3, 'brown', env=env_ad(0.01, 0.99, 3.0))
    s.reverb(0.4, 0.06, 0.5).normalize(0.95)


add('sfx_sludge_drag', '奶渍怪拖行', 'creatures', 2.2, '湿漉漉的怪物从雾里拖行逼近', r_sludge_drag)
add('sfx_sludge_spit', '奶渍怪呸', 'creatures', 0.8, '嫌弃地吐了一口，转身离开', r_sludge_spit)
add('sfx_spider_hiss', '挤奶机蜘蛛嘶', 'creatures', 1.8, '红色传感器眼锁定目标时的高频嘶鸣', r_spider_hiss)
add('sfx_spider_legs', '蜘蛛管腿敲地', 'creatures', 2.0, '八条管子腿急促敲打地面', r_spider_legs)
add('sfx_robot_arm_creak', '机械臂吱嘎', 'creatures', 1.6, '头顶机械臂缓慢转动的金属摩擦', r_robot_creak)
add('sfx_jelly_drop', '装死变奶冻', 'creatures', 1.2, '身体塌下去变成半透明奶冻的软塌声', r_jelly_drop)
add('sfx_godfrog_stomp', '巨蛙降临一踩', 'creatures', 2.5, '像踩扁纸盒般温柔又致命的一声咔', r_godfrog_stomp)

# ---------- 玩家 player ----------
def r_flipper_steps(s):
    # 湿脚蹼拍在冰凉地砖上：偏闷、低频、软包络，去掉清脆的高频与薄亮正弦
    n = s.n
    t = Synth(s.dur)
    rng = random.Random(2026)
    for k in range(8):
        start = int(k * n / 8)
        # 每步噪声成分不同，制造"啪嗒"里带黏滞感的质感
        for j in range(int(0.13 * SR)):
            if start + j >= n:
                break
            tt = j / SR
            e = math.exp(-tt * 17)  # 更软的衰减，不干脆
            thud = 0.55 * math.sin(2 * math.pi * 96 * tt) * math.exp(-tt * 22)  # 低频闷响
            squelch = 0.45 * (rng.random() * 2 - 1) * math.exp(-tt * 30)       # 湿黏噪声
            t.buf[start + j] += 0.85 * e * (thud + squelch)
    for i in range(n):
        s.buf[i] = t.buf[i]
    s.lp(680).hp(45).normalize(0.78)  # 低通压掉脆响，保留闷啪嗒


def r_sticky_step(s):
    s.tone(300, 120, 0.6, 'sine', env=env_ad(0.01, 0.99, 4.0))
    s.noise(0.3, 'pink', env=env_ad(0.01, 0.99, 4.5)).lp(1000)
    s.normalize(0.85)


def r_swallow(s):
    for k, (f0, f1, st) in enumerate([(400, 180, 0.0), (320, 130, 0.28)]):
        off = int(st * SR)
        for j in range(int(0.3 * SR)):
            if off + j >= s.n:
                break
            e = math.exp(-j / SR * 14)
            s.buf[off + j] += 0.5 * e * math.sin(2 * math.pi * (f0 + (f1 - f0) * j / (0.3 * SR)) * j / SR)
    s.lp(1800).normalize(0.7)


def r_breath(s):
    s.noise(0.5, 'pink', env=env_adsr(0.3, 0.2, 0.7, 0.35)).hp(400).lp(2600)
    s.am(0.9, 0.35).normalize(0.7)


def r_heartbeat(s):
    s.tone(58, 44, 0.8, 'sine', env=env_ad(0.005, 0.995, 5.0))
    for k in range(4):
        off = int((0.16 + k * 0.38) * SR)
        for j in range(int(0.16 * SR)):
            if off + j >= s.n:
                break
            s.buf[off + j] += 0.5 * math.exp(-j / SR * 20) * math.sin(2 * math.pi * 52 * j / SR)
    s.normalize(0.9)


def r_flashlight(s):
    s.noise(0.5, 'white', env=env_ad(0.005, 0.995, 10.0)).hp(2500)
    s.tone(1400, 900, 0.3, 'square', env=env_ad(0.005, 0.995, 12.0))
    s.normalize(0.8)


add('sfx_flipper_steps', '脚蹼啪嗒脚步', 'player', 1.8, '湿脚蹼拍打冰凉地砖，啪嗒啪嗒', r_flipper_steps)
add('sfx_sticky_step', '踩布丁啵', 'player', 0.8, '发酵区每一步像踩在布丁上的啵声', r_sticky_step)
add('sfx_swallow', '吞咽', 'player', 0.7, '听见自己吞咽的声音', r_swallow)
add('sfx_breath', '紧张呼吸', 'player', 2.0, '屏息后压抑的呼吸', r_breath)
add('sfx_heartbeat', '心跳加速', 'player', 2.0, '奔跑后擂鼓般的心跳', r_heartbeat)
add('sfx_flashlight', '手电筒开关', 'player', 0.4, '手电筒咔哒亮起，电量刻度亮了', r_flashlight)

# ---------- 道具事件 objects ----------
def r_pa_static(s):
    s.noise(0.5, 'white').hp(300).lp(5000)
    s.tone(120, 118, 0.2, 'saw')
    s.am(4.3, 0.3).distort(2.5).normalize(0.6)


def r_pa_voice(s):
    # 含混的广播女声：基频锯齿 + 三共振峰 + 电流底噪，做成断续音节
    s.tone(210, 190, 0.4, 'saw')
    for i in range(s.n):
        u = i / (s.n - 1)
        syl = max(0.0, math.sin(2 * math.pi * 2.4 * u))
        syl = syl ** 0.8 if syl > 0.25 else 0.0
        s.buf[i] *= syl
    # 共振峰近似 /a/ /e/ 交替
    t = Synth(s.dur)
    for i in range(s.n):
        t.buf[i] = s.buf[i]
    t.bandpass(720, 5.0)
    for i in range(s.n):
        s.buf[i] = 0.7 * t.buf[i]
    s.noise(0.18, 'white').hp(1000).lp(4000)
    s.distort(3.0).reverb(0.25, 0.02, 0.35).normalize(0.7)


def r_crt(s):
    s.noise(0.7, 'white').hp(200)
    s.tone(15700, 15700, 0.06)
    s.tone(60, 60, 0.12, 'saw')
    s.reverb(0.15, 0.01, 0.25).normalize(0.6)


def r_blackout(s):
    s.noise(0.9, 'white', env=env_ad(0.002, 0.998, 14.0)).lp(4000)
    s.tone(240, 40, 0.5, 'sine', env=env_ad(0.002, 0.998, 10.0))
    s.normalize(0.9)


def r_coin(s):
    for f, a in [(2600, 0.5), (3700, 0.35), (5100, 0.22)]:
        s.tone(f, f * 0.98, a, 'sine', env=env_ad(0.001, 0.999, 6.0))
    s.reverb(0.2, 0.02, 0.3).normalize(0.85)


def r_vending(s):
    for k, (f, st) in enumerate([(660, 0.0), (880, 0.12), (990, 0.26)]):
        off = int(st * SR)
        for j in range(int(0.14 * SR)):
            if off + j >= s.n:
                break
            e = 1.0 if j < int(0.1 * SR) else 0.0
            s.buf[off + j] += 0.4 * e * math.sin(2 * math.pi * f * j / SR)
    s.normalize(0.8)


def r_tape_click(s):
    s.noise(0.8, 'white', env=env_ad(0.002, 0.998, 16.0)).bandpass(1600, 3.0)
    s.tone(180, 90, 0.4, 'square', env=env_ad(0.002, 0.998, 14.0))
    s.normalize(0.9)


def r_tape_hiss(s):
    s.noise(0.5, 'pink').hp(500).lp(6000)
    s.tone(60, 60, 0.08).normalize(0.45)


def r_valve(s):
    s.noise(0.5, 'pink', env=env_adsr(0.15, 0.2, 0.7, 0.25)).lp(800)
    s.tone(140, 90, 0.3, 'sine', env=env_adsr(0.15, 0.2, 0.7, 0.25))
    s.am(7.0, 0.45).reverb(0.25, 0.03, 0.35).normalize(0.8)


def r_blender(s):
    s.noise(0.5, 'white', env=env_adsr(0.2, 0.15, 0.8, 0.3)).lp(3000).hp(200)
    s.tone(110, 130, 0.35, 'saw', env=env_adsr(0.2, 0.15, 0.8, 0.3))
    s.am(24.0, 0.3).reverb(0.2, 0.02, 0.3).normalize(0.8)


def r_door(s):
    s.noise(0.45, 'white', env=env_adsr(0.25, 0.3, 0.6, 0.25)).bandpass(1100, 14.0)
    s.tone(280, 170, 0.28, 'saw', env=env_adsr(0.25, 0.3, 0.6, 0.25))
    s.am(4.0, 0.35).reverb(0.35, 0.05, 0.5).normalize(0.8)


def r_lock(s):
    for k in range(3):
        off = int(k * 0.09 * SR)
        for j in range(int(0.08 * SR)):
            if off + j >= s.n:
                break
            e = math.exp(-j / SR * 40)
            s.buf[off + j] += 0.6 * e * ((random.random() * 2 - 1) + 0.5 * math.sin(2 * math.pi * 900 * j / SR))
    s.lp(3500).normalize(0.85)


def r_flicker(s):
    s.noise(0.6, 'white', env=env_pulses(3.0, 0.12)).hp(1800)
    s.tone(120, 120, 0.3, 'saw', env=env_pulses(3.0, 0.12))
    s.normalize(0.75)


add('sfx_pa_static', '广播电流杂音', 'objects', 1.5, '生锈喇叭里挤出的电流噪声', r_pa_static)
add('sfx_pa_voice', '广播含混女声', 'objects', 2.6, '带电流杂音的含糊广播音节', r_pa_voice)
add('sfx_crt_static', 'CRT 雪花', 'objects', 1.5, '监控屏幕的雪花噪点与行频', r_crt)
add('sfx_screen_blackout', '屏幕啪地黑了', 'objects', 0.7, '噪声里一张脸闪过，屏幕骤黑', r_blackout)
add('sfx_coin_drop', '投币叮', 'objects', 0.7, '一枚硬币投进售货机', r_coin)
add('sfx_vending_beep', '售货机电子音', 'objects', 0.7, '像素奶牛脸冲你眨眼的提示音', r_vending)
add('sfx_tape_click', '磁带咔', 'objects', 0.5, '录音机卡带的一声咔', r_tape_click)
add('sfx_tape_hiss', '磁带播放底噪', 'objects', 2.0, '老磁带转动的嘶嘶底噪', r_tape_hiss)
add('sfx_valve_squelch', '阀门肉乎乎转动', 'objects', 1.5, '像拧活物关节般的湿润转动', r_valve)
add('sfx_blender', '搅拌机旋转', 'objects', 2.0, '刀片缓慢转动的电机嗡鸣', r_blender)
add('sfx_door_creak', '后门吱呀', 'objects', 2.0, '金属后门缓缓打开', r_door)
add('sfx_lock_turn', '钥匙拧锁', 'objects', 0.6, '钥匙插进锁孔拧开', r_lock)
add('sfx_flicker_zap', '灯管闪烁滋', 'objects', 1.2, '一盏荧光灯以不规则频率闪烁', r_flicker)

# ---------- 结局 events ----------
def r_stinger(s):
    s.noise(1.0, 'white', env=env_ad(0.004, 0.996, 5.0)).lp(6000)
    s.tone(220, 55, 0.5, 'saw', env=env_ad(0.004, 0.996, 4.0))
    s.tone(311, 77, 0.4, 'square', env=env_ad(0.004, 0.996, 4.0))  # 不协和音程
    s.distort(4.0).reverb(0.3, 0.02, 0.4).normalize(0.98)


def r_bubble(s):
    n = s.n
    t = Synth(s.dur)
    for _ in range(14):
        start = random.randint(0, max(0, n - int(0.12 * SR)))
        f = random.uniform(400, 1400)
        for j in range(int(0.1 * SR)):
            if start + j >= n:
                break
            e = math.exp(-j / SR * 40)
            t.buf[start + j] += 0.6 * e * math.sin(2 * math.pi * (f + 600 * j / SR) * j / SR)
    for i in range(n):
        s.buf[i] = t.buf[i]
    s.reverb(0.4, 0.03, 0.5).normalize(0.85)


def r_factory_death(s):
    s.noise(0.4, 'pink', env=env_ad(0.1, 0.9, 1.5)).lp(600)
    s.tone(120, 38, 0.5, 'sine', env=env_ad(0.05, 0.95, 2.0))
    s.tone(180, 55, 0.25, 'saw', env=env_ad(0.05, 0.95, 2.5)).lp(400)
    s.reverb(0.5, 0.09, 0.6).normalize(0.8)


def r_textbeep(s):
    s.tone(1200, 1200, 0.6, 'sine', env=env_ad(0.001, 0.999, 8.0))
    s.normalize(0.8)


def r_soda(s):
    s.noise(0.5, 'white', env=env_ad(0.1, 0.9, 0.8)).hp(2000)
    n = s.n
    for _ in range(30):
        start = random.randint(0, max(0, n - int(0.05 * SR)))
        f = random.uniform(1500, 4000)
        for j in range(int(0.04 * SR)):
            if start + j >= n:
                break
            s.buf[start + j] += 0.08 * math.exp(-j / SR * 90) * math.sin(2 * math.pi * f * j / SR)
    s.normalize(0.7)


def r_dance(s):
    # 走调的奶蛙舞曲：简单进行 + 故意跑调的第二个声部
    notes = [261.6, 329.6, 392.0, 329.6, 293.7, 349.2, 440.0, 349.2]
    seg = s.n / len(notes)
    for k, f in enumerate(notes):
        off = int(k * seg)
        ln = int(seg * 0.8)
        for j in range(ln):
            if off + j >= s.n:
                break
            e = 0.7 * (1.0 - j / ln)
            s.buf[off + j] += e * 0.35 * (math.sin(2 * math.pi * f * j / SR) + 0.3 * math.sin(2 * math.pi * f * 1.06 * j / SR))
            if j % int(SR / 8) < int(SR / 40):
                s.buf[off + j] += 0.2 * (random.random() * 2 - 1) * e
    s.lp(2500).reverb(0.2, 0.04, 0.3).normalize(0.75)


def r_moo(s):
    s.tone(120, 82, 0.5, 'saw', env=env_adsr(0.15, 0.2, 0.7, 0.3))
    s.tone(61, 45, 0.35, 'sine', env=env_adsr(0.15, 0.2, 0.7, 0.3))
    for i in range(s.n):
        s.buf[i] *= 0.8 + 0.2 * math.sin(2 * math.pi * 5.5 * i / SR)
    s.bandpass_lpf = None
    s.lp(900).distort(2.0).reverb(0.3, 0.05, 0.45).normalize(0.85)


def r_glitch(s):
    n = s.n
    for i in range(n):
        block = (i // 400) % 5
        g = 1.0 if block in (0, 2) else (0.2 if block == 3 else 0.0)
        s.buf[i] = g * (random.random() * 2 - 1)
    s.lp(5000).normalize(0.8)


add('sfx_stinger', '惊吓音 Stinger', 'events', 1.6, '突然的不协和冲击，Jump scare 用', r_stinger)
add('sfx_bubble_pop', '气泡破裂啵啵', 'events', 2.0, '工厂像气泡一样一连串温柔地破裂', r_bubble)
add('sfx_factory_death', '工厂崩塌叹息', 'events', 3.0, '管道停止搏动，一声长长的叹息', r_factory_death)
add('sfx_text_beep', '逐字出现滴', 'events', 0.2, '字幕逐字浮现的滴声', r_textbeep)
add('sfx_soda_fizz', '汽水气泡', 'events', 2.0, '天亮后那瓶汽水的气泡声', r_soda)
add('sfx_frog_dance', '走调奶蛙舞曲', 'events', 4.0, '角落录音机播放的走调舞曲', r_dance)
add('sfx_moo', '合成哞', 'events', 1.8, '广播里那声金属质感的哞', r_moo)
add('sfx_glitch', '画面故障', 'events', 1.2, '隐藏结局里画面撕裂的故障音', r_glitch)


def r_frog_laugh(s):
    # "八级哥"式魔性大笑：老水牛变声器质感——齿锯基波+方波、重失真压扁、
    # 不稳定的喉部颤音、连续下滑的"齁齁齁"爆发，尾音堕落成一声含糊的哞。
    rng = random.Random(808)
    n = s.n
    buf = s.buf
    # 6 声爆发，间隔先密后疏、音高逐次下滑、时长递减
    onsets = [0.05, 0.42, 0.78, 1.16, 1.58, 2.02]
    for k, t0 in enumerate(onsets):
        f0 = 168 - k * 11 + rng.uniform(-5, 5)
        dur = 0.40 - k * 0.03
        ph = 0.0
        start = int(t0 * SR)
        for j in range(int(dur * SR)):
            if start + j >= n:
                break
            u = j / (dur * SR)
            t = j / SR
            # 音高：起音略上扬之后一路下滑（"齁↘"的坠落感）
            f = f0 * (1.0 + 0.10 * math.sin(math.pi * min(1.0, u * 4)) * (1 - u) - 0.28 * u)
            ph += f / SR
            ph_mod = ph + 0.02 * math.sin(2 * math.pi * 33 * t)  # 喉部粗糙颤动
            frac = ph_mod % 1.0
            saw = 2.0 * frac - 1.0
            sq = 1.0 if frac < 0.48 else -1.0
            wave = 0.6 * saw + 0.4 * sq
            env = math.sin(math.pi * u) ** 0.6 * math.exp(-u * 1.4)
            v = wave * env
            # 起音"齁"的气擦辅音（短促带通噪声），给每声爆发咬字感
            if u < 0.22:
                attack = math.exp(-u * 26)
                breath = rng.random() * 2 - 1
                # 用一阶差分近似高通，模拟"h/齁"的送气
                v += 0.30 * attack * (breath - (getattr(s, '_pb', [0.0])[0] if getattr(s, '_pb', None) else breath))
                if not hasattr(s, '_pb'):
                    s._pb = [0.0]
                s._pb[0] = breath
            # 气流/破音噪声
            v += 0.12 * (rng.random() * 2 - 1) * env
            buf[start + j] += v
    # 尾音：一声含糊下滑的哞，收住整段笑
    tn = 2.45
    ph = 0.0
    for j in range(int(0.9 * SR)):
        if int(tn * SR) + j >= n:
            break
        t = j / SR
        u = j / (0.9 * SR)
        f = 92 - 38 * u
        ph += f / SR
        env = math.sin(math.pi * u) ** 0.8
        sbuf = 0.7 * (2 * (ph % 1.0) - 1) + 0.3 * math.sin(2 * math.pi * ph)
        buf[int(tn * SR) + j] += 0.8 * env * sbuf
    # 老水牛变声器：重失真压扁 + 低通去亮 + 鼻腔共振峰
    dry = list(buf)

    def bondpass_copy(freq, q, mix):
        tmp = Synth(s.dur)
        tmp.buf = list(dry)
        tmp.bandpass(freq, q)
        for i in range(n):
            buf[i] += mix * tmp.buf[i]

    for i in range(n):
        buf[i] = math.tanh(buf[i] * 3.2)
    dry = list(buf)  # 共振峰基于失真后的信号再次取样
    bondpass_copy(720, 3.0, 0.42)   # 第一共振峰：口腔/鼻腔厚度
    bondpass_copy(1650, 5.0, 0.34)  # 第二共振峰："齁"的辨识度
    s.lp(3000).hp(70)
    s.reverb(0.18, 0.02, 0.3).normalize(0.93)


# 原声版：直接引用从 B 站视频提取的原始音轨（未经任何合成/改动）
RECIPES.append(dict(
    name='sfx_frog_laugh_raw', zh='奶蛙魔性大笑·八级哥原声', cat='events',
    dur=0, desc='八级哥本人笑声，B站视频原始音轨原封不动提取（70秒纯享版）',
    fn=None, external='sfx_frog_laugh_raw.m4a',
))


# ================= 生成 =================
CATEGORY_ZH = {
    'ambience': '环境氛围', 'creatures': '怪物威胁', 'player': '玩家动作',
    'objects': '道具事件', 'events': '结局演出',
}

def m4a_duration(path):
    """从 MP4/M4A 的 mvhd box 读取时长（秒），纯标准库。"""
    with open(path, 'rb') as f:
        data = f.read()
    i = data.find(b'mvhd')
    if i < 0:
        return 0.0
    ver = data[i + 4]
    if ver == 0:
        ts = struct.unpack('>I', data[i + 16:i + 20])[0]
        dur = struct.unpack('>I', data[i + 20:i + 24])[0]
    else:
        ts = struct.unpack('>I', data[i + 24:i + 28])[0]
        dur = struct.unpack('>Q', data[i + 28:i + 36])[0]
    return dur / ts if ts else 0.0


os.makedirs(ROOT, exist_ok=True)
manifest = []
for r in RECIPES:
    # 外部原始音频：不合成，直接登记
    if r.get('external'):
        ext = r['external']
        src_path = os.path.join(ROOT, ext)
        if os.path.exists(src_path):
            dur = round(m4a_duration(src_path), 2)
            size = os.path.getsize(src_path)
            manifest.append({
                'id': r['name'], 'zh': r['zh'], 'cat': r['cat'],
                'catZh': CATEGORY_ZH[r['cat']], 'desc': r['desc'],
                'dur': dur, 'src': ext, 'kb': round(size / 1024),
            })
            print('EXT %-28s %5.2fs %6dKB (原始音频,未改动)' % (ext, dur, size // 1024))
        continue
    s = Synth(r['dur'])
    r['fn'](s)
    s.normalize(0.9)
    s.fade(0.005 if r['cat'] == 'ambience' else 0.002, 0.05 if r['cat'] == 'ambience' else 0.02)
    rel = os.path.join(r['cat'], r['name'] + '.wav')
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s.write(path)
    size = os.path.getsize(path)
    manifest.append({
        'id': r['name'], 'zh': r['zh'], 'cat': r['cat'],
        'catZh': CATEGORY_ZH[r['cat']], 'desc': r['desc'],
        'dur': round(s.dur, 2), 'src': rel.replace('\\', '/'), 'kb': round(size / 1024),
    })
    print('OK %-28s %5.2fs %6dKB' % (rel, s.dur, size // 1024))

with open(os.path.join(ROOT, 'manifest.js'), 'w', encoding='utf-8') as f:
    f.write('window.SFX_DATA = ')
    json.dump(manifest, f, ensure_ascii=False, indent=2)
    f.write(';\n')

print('\nTOTAL', len(manifest), 'sfx ->', ROOT)
