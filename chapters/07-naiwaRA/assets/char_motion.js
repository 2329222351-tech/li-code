/* =========================================================================
 * 奶蛙：午夜奶厂 — 角色运动逻辑 CHAR_MOTION v1
 * -------------------------------------------------------------------------
 * 纯视觉动效层：只改部件的 position / rotation / scale，不碰材质、碰撞、
 * 交互与剧情判定。状态由外部功能层通过 ctx.state 传入，本模块只负责
 * "在这个状态下角色怎么动"。
 *
 * 依赖：全局 THREE
 * 接入：
 *   const m = CharMotion.create('spider', gltf.scene);
 *   // 每帧（t 秒，dt 秒）：
 *   m.update(t, dt, { state: 'chase', player: camera.position, speed: 1 });
 *
 * 可用角色 kind：
 *   slime | spider | vending | pigeon | clones | frogGod
 * 状态名见《角色运动逻辑.md》。
 * ========================================================================= */
(function (global) {
  'use strict';
  var T = global.THREE;
  if (!T) { console.error('[CharMotion] 需要全局 THREE'); return; }

  /* ---------- 数学小工具 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1); return t * t * (3 - 2 * t); }
  function wave(t, rate, phase) { return Math.sin(t * rate + (phase || 0)); }

  /* ---------- 运动基类 ---------- */
  function Motion(kind, root) {
    this.kind = kind;
    this.root = root;
    this.all = [];
    this.mesh = {};
    var self = this;
    root.traverse(function (o) {
      if (!o.isMesh) return;
      o.userData._mb = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() };
      self.all.push(o);
      if (o.name) self.mesh[o.name] = o;
    });
    this.state = 'idle';
    this.since = 0;
    this.speed = 0;
    this.player = new T.Vector3(0, 1, 3);
    this.local = new T.Vector3();
    this.seed = (kind.length * 0.37) % 6.28;
  }

  Motion.prototype.find = function (n) { return this.mesh[n] || null; };
  Motion.prototype.re = function (rx) {
    var self = this, out = [];
    Object.keys(this.mesh).forEach(function (n) { if (rx.test(n)) out.push(self.mesh[n]); });
    return out;
  };
  Motion.prototype.setState = function (s, t) {
    if (s && s !== this.state) { this.state = s; this.since = t; }
  };
  Motion.prototype.ease = function (t) { return smooth(0, 0.4, t - this.since); };  // 状态淡入

  Motion.prototype.begin = function (t, dt, ctx) {
    dt = clamp(dt || 0.016, 0.001, 0.05);
    if (ctx) {
      if (ctx.state) this.setState(ctx.state, t);
      if (ctx.player) this.player.copy(ctx.player);
      if (ctx.speed !== undefined) this.speed = ctx.speed;
    }
    // 每帧从基准姿态重算，避免逐帧累积漂移
    for (var i = 0; i < this.all.length; i++) {
      var o = this.all[i], b = o.userData._mb;
      o.position.copy(b.p); o.rotation.copy(b.r); o.scale.copy(b.s);
    }
    this.root.updateMatrixWorld(true);
    this.local.copy(this.player);
    this.root.worldToLocal(this.local);   // 玩家在角色局部空间的坐标
    return dt;
  };

  /* ---------- 通用子运动（都作用于单个 mesh，基于其基准值） ---------- */
  Motion.prototype.breath = function (o, t, amp, rate, phase) {
    if (!o) return;
    var b = o.userData._mb, k = 1 + wave(t, rate || 1.6, phase || 0) * (amp || 0.03);
    o.scale.set(b.s.x * k, b.s.y * k, b.s.z * k);
  };
  Motion.prototype.bob = function (o, t, amp, rate, phase) {
    if (!o) return;
    var b = o.userData._mb;
    o.position.y = b.p.y + wave(t, rate || 2, phase || 0) * (amp || 0.04);
  };
  Motion.prototype.sway = function (o, t, amp, rate, phase) {
    if (!o) return;
    var b = o.userData._mb;
    o.rotation.z = b.r.z + wave(t, rate || 1.2, phase || 0) * (amp || 0.08);
  };
  Motion.prototype.jitter = function (o, t, amt, rate) {
    if (!o) return;
    var b = o.userData._mb, r = rate || 31, a = amt || 0.01;
    o.position.x = b.p.x + wave(t, r, 0.3) * a;
    o.position.y = b.p.y + wave(t, r * 1.17, 1.7) * a;
    o.position.z = b.p.z + wave(t, r * 0.83, 2.9) * a;
  };
  Motion.prototype.offsetAll = function (dx, dy, dz) {
    for (var i = 0; i < this.all.length; i++) {
      var o = this.all[i];
      o.position.x += dx; o.position.y += dy; o.position.z += dz;
    }
  };
  Motion.prototype.gaze = function (names, amount) {
    var self = this, lx = clamp(this.local.x * 0.12, -amount, amount);
    var ly = clamp((this.local.y - 0.5) * 0.08, -amount * 0.6, amount * 0.6);
    names.forEach(function (n) {
      var o = self.find(n); if (!o) return;
      var b = o.userData._mb;
      o.position.x = b.p.x + lx; o.position.y = b.p.y + ly;
    });
  };
  Motion.prototype.drips = function (t, rx, rate, hang) {
    rate = rate || 0.65; hang = hang || 0.3;
    this.re(rx).forEach(function (o, i) {
      var b = o.userData._mb;
      var ph = ((t * rate + i * 0.29) % 1 + 1) % 1;
      var st = ph < 0.82 ? smooth(0, 0.82, ph) : 0;   // 慢慢拉长，到点"啪"地滴落复位
      o.scale.x = b.s.x * (1 - st * 0.22);
      o.scale.y = b.s.y * (1 + st * 2.4);
      o.scale.z = b.s.z * (1 - st * 0.22);
      o.position.y = b.p.y - st * hang;
    });
  };
  Motion.prototype.blink = function (t, period, offset) {
    var p = ((t + (offset || 0)) % period) / period;
    return p < 0.09 ? 1 - Math.sin(p / 0.09 * Math.PI) * 0.92 : 1;   // 1→0.08→1
  };

  /* =====================================================================
   * 奶渍怪：无眼追击者。靠身体朝向与形变表达"它知道你在看它"
   * 状态：idle / lurk / notice / chase / spit
   * =================================================================== */
  function Slime(kind, root) { Motion.call(this, kind, root); }
  Slime.prototype = Object.create(Motion.prototype);
  Slime.prototype.constructor = Slime;
  Slime.prototype.update = function (t, dt, ctx) {
    dt = this.begin(t, dt, ctx);
    var st = this.state, e = this.ease(t), body = this.find('Slime_Blob'), puddle = this.find('Slime_Puddle');
    this.drips(t, /Slime_Drip|ROT_.*Slime_(Drip|Bead|String)/, 0.7, 0.26);

    if (st === 'chase') {
      // 拖行追击：身体拉长、左右扭动、脚交替，轻微前倾朝玩家
      var w = wave(t, 7.5), sp = 0.5 + clamp(this.speed, 0, 1) * 0.5;
      this.breath(body, t, 0.09, 6.0);
      if (body) { var b = body.userData._mb; body.scale.z = b.s.z * (1 + 0.22 * sp); body.rotation.z = b.r.z + w * 0.13 * e; }
      this.bob(body, t, 0.06 * sp, 7.5);
      var legs = this.re(/^Slime_Leg/);
      legs.forEach(function (o, i) { o.position.y += (Math.sin(t * 9 + i * Math.PI) * 0.5 + 0.5) * 0.07 * e; });
      if (body) body.rotation.y = wave(t, 1.6) * 0.25 * e + clamp(this.local.x * 0.05, -0.5, 0.5);
      this.jitter(puddle, t, 0.008, 28);
    } else if (st === 'notice' || st === 'spit') {
      this.breath(body, t, 0.06, 3.4);
      this.bob(body, t, 0.03, 3);
      this.jitter(body, t, 0.012 * e, 34);
      if (body) body.rotation.y = clamp(this.local.x * 0.09, -0.7, 0.7);   // 无眼，用转向"看你"
      if (st === 'spit') {
        var ph = (t - this.since) % 1.1;
        var sq = ph < 0.25 ? smooth(0, 0.25, ph) : (ph < 0.45 ? 1 - smooth(0.25, 0.45, ph) : 0);
        if (body) { var bb = body.userData._mb; body.scale.y = bb.s.y * (1 - sq * 0.4); body.scale.x = bb.s.x * (1 + sq * 0.3); }
      }
    } else {
      // idle / lurk：贴地缓慢蠕动
      this.breath(body, t, 0.035, 1.4);
      this.breath(puddle, t, 0.02, 0.9, 1.1);
      this.sway(puddle, t, 0.03, 0.7);
      if (body && st === 'lurk') this.bob(body, t, 0.015, 1.1);
    }
    return this;
  };

  /* =====================================================================
   * 挤奶机蜘蛛：八腿对角步态 + 红传感器扫描/锁定 + 扑击
   * 状态：idle / alert / chase / lunge
   * =================================================================== */
  function Spider(kind, root) { Motion.call(this, kind, root); }
  Spider.prototype = Object.create(Motion.prototype);
  Spider.prototype.constructor = Spider;
  Spider.prototype.update = function (t, dt, ctx) {
    dt = this.begin(t, dt, ctx);
    var st = this.state, e = this.ease(t);
    var body = this.find('Spider_Body'), eye = this.find('Spider_Eye'), hump = this.find('Spider_Hump');
    var legsA = this.re(/^Spider_LegA_\d+$/), legsB = this.re(/^Spider_LegB_\d+$/);
    this.drips(t, /ROT_.*Spider_(Drip|Bead|String)/, 0.8, 0.24);
    this.breath(hump, t, 0.03, 2.2);

    if (st === 'chase' || st === 'lunge') {
      var rate = (st === 'lunge' ? 12 : 8.5) * (0.6 + clamp(this.speed, 0, 1) * 0.6);
      // 对角相位：A/B 两组错开半拍，每条腿再依次偏移，形成波浪式爬动
      legsA.forEach(function (o, i) {
        var b = o.userData._mb, ph = t * rate + i * 0.85;
        o.rotation.z = b.r.z + Math.sin(ph) * 0.34 * e;
        o.rotation.x = b.r.x + Math.cos(ph) * 0.10 * e;
      });
      legsB.forEach(function (o, i) {
        var b = o.userData._mb, ph = t * rate + i * 0.85 + Math.PI;
        o.rotation.z = b.r.z + Math.sin(ph) * 0.34 * e;
        o.rotation.x = b.r.x + Math.cos(ph) * 0.10 * e;
      });
      this.bob(body, t, 0.05, rate);
      if (body) { var bb = body.userData._mb; body.rotation.x = bb.r.x - 0.12 * e; }   // 前倾
      if (st === 'lunge') {
        var ph2 = (t - this.since) % 1.2;
        var crouch = ph2 < 0.35 ? smooth(0, 0.35, ph2) : (ph2 < 0.55 ? 1 - smooth(0.35, 0.55, ph2) : 0);
        if (body) body.position.y += -crouch * 0.22;
        legsA.concat(legsB).forEach(function (o) { o.rotation.z *= (1 - crouch * 0.5); });
      }
    } else {
      // idle / alert：腿高频微抖，传感器扫描
      legsA.concat(legsB).forEach(function (o, i) {
        var b = o.userData._mb;
        o.rotation.z = b.r.z + Math.sin(t * 13 + i) * 0.035;
      });
      this.jitter(body, t, 0.006, 26);
    }
    // 红眼：idle 左右扫描，alert/chase 锁定玩家，scale 脉动
    if (eye) {
      var b = eye.userData._mb;
      eye.scale.setScalar(b.s.x * (1 + wave(t, 5) * 0.12));
      if (st === 'idle') eye.position.x = b.p.x + Math.sin(t * 1.3) * 0.05;
      else eye.position.x = b.p.x + clamp(this.local.x * 0.06, -0.09, 0.09);
    }
    return this;
  };

  /* =====================================================================
   * 哞哞酱售货机：醉态轻晃 + 眨眼 + 故障卡帧
   * 状态：idle / talk / glitch
   * =================================================================== */
  function Vending(kind, root) { Motion.call(this, kind, root); }
  Vending.prototype = Object.create(Motion.prototype);
  Vending.prototype.constructor = Vending;
  Vending.prototype.update = function (t, dt, ctx) {
    dt = this.begin(t, dt, ctx);
    var st = this.state, e = this.ease(t);
    var body = this.find('V_Body'), face = this.find('V_Face');
    var e1 = this.find('V_Eye1'), e2 = this.find('V_Eye2');
    var nose = this.find('V_Nose'), buttons = this.re(/^V_Button_\d+$/);
    this.drips(t, /ROT_.*Vending_(Drip|Bead|String)/, 0.9, 0.3);

    if (st === 'glitch') {
      // 量化高频抖动 + 眼睛卡住 + 屏幕缩放突变
      var q = function (v) { return Math.round(v * 3) / 3; };
      this.jitter(body, t, 0.02, 22);
      if (body) { var b = body.userData._mb; body.rotation.z = b.r.z + q(Math.sin(t * 16)) * 0.06; }
      if (face) { var bf = face.userData._mb; var s = (Math.floor(t * 7) % 5 === 0) ? 0.92 : 1; face.scale.set(bf.s.x * s, bf.s.y, bf.s.z); }
      if (e1) e1.scale.y = e1.userData._mb.s.y;   // 卡住不眨
      if (e2) e2.scale.y = e2.userData._mb.s.y;
    } else {
      // 醉汉般的缓慢歪晃
      this.sway(body, t, 0.045, 0.9);
      if (body) { var bb = body.userData._mb; body.rotation.x = bb.r.x + Math.sin(t * 0.7) * 0.02; }
      this.breath(face, t, 0.015, 2.6);
      var period = (st === 'talk') ? 1.6 : 3.4;
      if (e1) e1.scale.y = e1.userData._mb.s.y * this.blink(t, period, 0);
      if (e2) e2.scale.y = e2.userData._mb.s.y * this.blink(t, period, 0.05);
      if (st === 'talk') {
        if (nose) this.bob(nose, t, 0.012, 9);
        buttons.forEach(function (o, i) { o.position.y += (Math.sin(t * 7 + i * 1.3) * 0.5 + 0.5) * 0.02 * e; });
        if (face) face.rotation.z = face.userData._mb.r.z + Math.sin(t * 4) * 0.02 * e;
      }
    }
    return this;
  };

  /* =====================================================================
   * 鸽子：被缠住的无力扑腾 / 吐钥匙 / 飞走
   * 状态：trapped / givekey / flyaway
   * =================================================================== */
  function Pigeon(kind, root) { Motion.call(this, kind, root); }
  Pigeon.prototype = Object.create(Motion.prototype);
  Pigeon.prototype.constructor = Pigeon;
  Pigeon.prototype.update = function (t, dt, ctx) {
    dt = this.begin(t, dt, ctx);
    var st = this.state, e = this.ease(t);
    var body = this.find('P_Body'), head = this.find('P_Head'), beak = this.find('P_Beak');
    var wl = this.find('P_Wing_-1'), wr = this.find('P_Wing_1');
    var kb = this.find('P_KeyBow'), ks = this.find('P_KeyShaft');
    this.drips(t, /ROT_.*Pigeon_(Drip|Bead|String)/, 1.1, 0.2);

    if (st === 'flyaway') {
      var f = 18;
      if (wl) wl.rotation.z = wl.userData._mb.r.z + Math.sin(t * f) * 0.9;
      if (wr) wr.rotation.z = wr.userData._mb.r.z - Math.sin(t * f) * 0.9;
      this.offsetAll(0, (t - this.since) * 0.9, dt * 1.8);   // 上浮 + 逐渐飞远
      this.breath(body, t, 0.04, 6);
    } else if (st === 'givekey') {
      var ph = (t - this.since) % 2.0;
      var nod = smooth(0.2, 0.6, ph) * (1 - smooth(1.0, 1.5, ph));
      if (head) { head.rotation.x = head.userData._mb.r.x - nod * 0.35; head.position.y += nod * 0.03; }
      if (beak) { var bk = beak.userData._mb; beak.scale.z = bk.s.z * (1 + nod * 0.6); }
      var reach = smooth(0.5, 1.0, ph) * (1 - smooth(1.4, 1.9, ph));
      if (kb) kb.position.z = kb.userData._mb.p.z - reach * 0.15;
      if (ks) ks.position.z = ks.userData._mb.p.z - reach * 0.15;
      if (wl) this.jitter(wl, t, 0.006, 20);
      if (wr) this.jitter(wr, t, 0.006, 20);
    } else {
      // trapped：被吸管缠住，扑腾不规律、无力
      var flap = (Math.sin(t * 11) * 0.5 + 0.5) * (Math.sin(t * 2.3) * 0.5 + 0.5);
      if (wl) wl.rotation.z = wl.userData._mb.r.z + flap * 0.28;
      if (wr) wr.rotation.z = wr.userData._mb.r.z - flap * 0.16;   // 两翅幅度不同
      this.jitter(body, t, 0.008, 24);
      if (head) head.rotation.x = head.userData._mb.r.x + 0.12;    // 低头，眼神空洞
      if (kb) this.jitter(kb, t, 0.004, 17);
      if (ks) this.jitter(ks, t, 0.004, 17);
    }
    return this;
  };

  /* =====================================================================
   * 克隆奶蛙群：三只各自相位的呼吸 / 排队走 / 齐刷刷注视 / 列队离开
   * 状态：idle / line / stare / leave
   * =================================================================== */
  function Clones(kind, root) { Motion.call(this, kind, root); }
  Clones.prototype = Object.create(Motion.prototype);
  Clones.prototype.constructor = Clones;
  Clones.prototype.update = function (t, dt, ctx) {
    dt = this.begin(t, dt, ctx);
    var st = this.state, e = this.ease(t), self = this;
    this.drips(t, /ROT_.*CloneFrogs_(Drip|Bead|String)/, 0.6, 0.2);
    [1, 2, 3].forEach(function (i) {
      var ph = i * 1.9, body = self.find('C' + i + '_Body');
      var tag = self.find('C' + i + '_Tag'), cord = self.find('C' + i + '_Cord');
      var eyes = [self.find('C' + i + '_Eye_1'), self.find('C' + i + '_Eye_-1')];
      var pupils = [self.find('C' + i + '_Pupil_1'), self.find('C' + i + '_Pupil_-1')];
      var fl = self.find('C' + i + '_Foot_-1'), fr = self.find('C' + i + '_Foot_1');

      if (st === 'line' || st === 'leave') {
        // 依次错开的踉跄步态
        var rate = 5 + clamp(self.speed, 0, 1) * 3;
        self.bob(body, t, 0.05, rate, ph);
        self.sway(body, t, 0.09, rate * 0.5, ph);
        if (fl) fl.position.y += (Math.sin(t * rate + ph) * 0.5 + 0.5) * 0.07 * e;
        if (fr) fr.position.y += (Math.sin(t * rate + ph + Math.PI) * 0.5 + 0.5) * 0.07 * e;
        if (st === 'leave') {
          var d = smooth(0.2, 1.6 + i * 0.3, t - self.since);   // 一只接一只走开
          self.offsetAll(0, 0, d * dt * 1.4);
          if (body) body.rotation.y = body.userData._mb.r.y + Math.PI * d;   // 转身不回头
        }
      } else if (st === 'stare') {
        // 齐刷刷转向玩家、瞳孔聚焦、呼吸压住——集体注视的压迫感
        if (body) { body.rotation.y = body.userData._mb.r.y + clamp(self.local.x * 0.12, -0.6, 0.6); body.rotation.x = body.userData._mb.r.x - 0.06; }
        pupils.forEach(function (o) { if (o) o.position.x = o.userData._mb.p.x + clamp(self.local.x * 0.02, -0.03, 0.03); });
        self.breath(body, t, 0.008, 1.2, ph);   // 几乎静止
      } else {
        self.breath(body, t, 0.035, 1.5, ph);
        self.bob(body, t, 0.012, 1.1, ph);
        eyes.forEach(function (o) { if (o) o.scale.y = o.userData._mb.s.y * self.blink(t, 4.2, ph); });
      }
      // 吊牌和绳子永远轻轻晃
      self.sway(tag, t, 0.1, 2.1, ph);
      if (cord) cord.rotation.z = cord.userData._mb.r.z + Math.sin(t * 2.1 + ph) * 0.1;
    });
    return this;
  };

  /* =====================================================================
   * 蛙神：降临 / 踩踏 / 说话 / 飞走 —— 动作慢、幅度大、有重量感
   * 状态：descend / stomp / speak / depart
   * =================================================================== */
  function FrogGod(kind, root) { Motion.call(this, kind, root); }
  FrogGod.prototype = Object.create(Motion.prototype);
  FrogGod.prototype.constructor = FrogGod;
  FrogGod.prototype.update = function (t, dt, ctx) {
    dt = this.begin(t, dt, ctx);
    var st = this.state, e = this.ease(t), self = this;
    var body = this.find('G_Body'), head = this.find('G_Head'), mouth = this.find('G_Mouth');
    var crown = this.find('G_Crown'), rim = this.find('G_CrownRim');
    var eyes = [this.find('G_Eye_-1'), this.find('G_Eye_1')];
    var footR = this.find('G_Foot_1'), footL = this.find('G_Foot_-1');
    var clouds = this.re(/^G_Cloud_\d+$/), teeth = this.re(/^G_CrownTooth_\d+$/);
    this.drips(t, /ROT_.*FrogGod_(Drip|Bead|String)/, 0.5, 0.5);

    // 云披风始终翻涌，各块错相
    clouds.forEach(function (o, i) {
      self.bob(o, t, 0.09, 0.8, i * 1.1);
      self.sway(o, t, 0.06, 0.6, i * 0.9);
    });
    // 王冠轻微晃动
    [crown, rim].forEach(function (o) { if (o) self.sway(o, t, 0.03, 1.1); });
    teeth.forEach(function (o) { if (o) self.breath(o, t, 0.02, 1.4); });

    if (st === 'descend' || st === 'depart') {
      var dir = (st === 'descend') ? -1 : 1;
      var d = smooth(0, 3.5, t - this.since);
      this.offsetAll(0, dir * d * dt * 1.1, 0);
      this.breath(body, t, 0.02, 0.9);
      if (st === 'depart') clouds.forEach(function (o, i) { self.bob(o, t, 0.16, 1.6, i); });
    } else if (st === 'stomp') {
      var ph = (t - this.since) % 1.8;
      var lift = ph < 0.5 ? smooth(0, 0.5, ph) : 0;           // 缓缓抬脚
      var drop = ph >= 0.5 && ph < 0.62 ? 1 - smooth(0.5, 0.62, ph) : 0;  // 猛地踩下
      if (footR) { footR.position.y += lift * 0.7 - drop * 0.15; footR.rotation.z = footR.userData._mb.r.z - lift * 0.3; }
      var shock = ph >= 0.62 ? Math.max(0, 1 - (ph - 0.62) * 5) : 0;
      this.jitter(body, t, 0.03 * shock, 30);
      if (body) body.position.y -= shock * 0.12;
      clouds.forEach(function (o) { self.jitter(o, t, 0.02 * shock, 26); });
    } else if (st === 'speak') {
      if (head) { head.rotation.x = head.userData._mb.r.x + 0.14 * e; head.position.y -= 0.06 * e; }  // 低头看你
      if (mouth) { var bm = mouth.userData._mb; mouth.scale.x = bm.s.x * (1 + (Math.sin(t * 3) * 0.5 + 0.5) * 0.4); }
      eyes.forEach(function (o) { if (o) o.scale.multiplyScalar(1.06); });   // 眼睛亮起
      this.breath(body, t, 0.015, 0.8);
    } else {
      this.breath(body, t, 0.022, 0.9);
      this.bob(body, t, 0.02, 0.7);
    }
    // 眼睛始终温柔地追着玩家
    eyes.forEach(function (o) { if (o) { var b = o.userData._mb; o.position.x = b.p.x + clamp(self.local.x * 0.03, -0.06, 0.06); } });
    return this;
  };

  /* ---------- 工厂 ---------- */
  var REG = {
    slime: Slime, spider: Spider, vending: Vending,
    pigeon: Pigeon, clones: Clones, frogGod: FrogGod
  };

  global.CharMotion = {
    version: '1.0',
    create: function (kind, root) {
      var C = REG[kind];
      if (!C) throw new Error('[CharMotion] 未知角色类型: ' + kind);
      if (!root) throw new Error('[CharMotion] 缺少 root Object3D');
      return new C(kind, root);
    },
    kinds: Object.keys(REG)
  };
})(window);
