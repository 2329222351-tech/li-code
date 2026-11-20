/* 一页一条背景音乐；页面负责在开始按钮中调用 start，并自行绑定 M 键。 */
(function () {
  'use strict';
  if (window.NightMusic) return;

  var script = document.currentScript;
  var source = new URL('audio/night_piano.mp3', script && script.src
    ? script.src : new URL('assets/night_music.js', document.baseURI).href).href;
  var audio = new Audio(), sourceReady = null, sourceLoaded = false;
  var normalVolume = 0.16, duckedVolume = 0.045;
  var muted = false, savedTime = 0, restorePending = false, restoreSeeking = false;
  var requested = false, started = false, playing = false;
  var ducked = false, suspended = false, handedOff = false;
  var blocked = false, lastError = '', pending = null, generation = 0, lastSave = 0;
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = normalVolume;

  function readSaved() {
    try {
      var data = JSON.parse(sessionStorage.getItem('mf_music') || 'null');
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        muted = data.muted === true;
        savedTime = typeof data.time === 'number' && Number.isFinite(data.time)
          ? Math.max(0, data.time) : 0;
        restorePending = true; // 0 也是有效交接点，包含浏览器后退缓存恢复。
      }
    } catch (error) { /* 禁用存储时仍可在本页播放。 */ }
    audio.muted = muted;
  }
  function time() {
    return restorePending ? savedTime : (Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
  }
  function save() {
    try { sessionStorage.setItem('mf_music', JSON.stringify({ muted: muted, time: time() })); }
    catch (error) { /* file:// 或隐私设置可能不允许 sessionStorage。 */ }
  }
  function restoreTime() {
    if (!restorePending || restoreSeeking || audio.readyState < 3) return;
    var target = Number.isFinite(audio.duration) && audio.duration > 0
      ? savedTime % audio.duration : savedTime;
    if (Math.abs(audio.currentTime - target) < 0.2) { restorePending = false; return; }
    var seekable = false;
    for (var i = 0; i < audio.seekable.length; i++) {
      if (target >= audio.seekable.start(i) && target <= audio.seekable.end(i)) seekable = true;
    }
    if (!seekable) return;
    restoreSeeking = true;
    try { audio.currentTime = target; }
    catch (error) { restoreSeeking = false; }
  }
  function canPlay() {
    return requested && !suspended && !document.hidden && !handedOff;
  }
  function status() {
    return {
      started: started, playing: playing && !audio.paused && !audio.ended && canPlay(),
      muted: muted, ducked: ducked, suspended: suspended, hidden: document.hidden,
      handedOff: handedOff, pending: !!pending, blocked: blocked,
      error: lastError, time: time(), playbackTime: audio.currentTime, restoring: restorePending,
      seekable: audio.seekable.length ? audio.seekable.end(audio.seekable.length - 1) : 0, volume: audio.volume
    };
  }
  function notify() {
    window.dispatchEvent(new CustomEvent('nightmusicchange', { detail: status() }));
  }
  function pause() {
    generation++;
    pending = null;
    playing = false;
    audio.pause();
    save();
    notify();
  }
  function fail(error) {
    playing = false;
    blocked = true;
    lastError = error && (error.message || error.name) || '背景音乐未能播放';
    notify();
    return false;
  }
  function play() {
    if (!canPlay()) return Promise.resolve(false);
    if (!sourceLoaded) return sourceReady.then(function (ok) { return ok ? play() : false; });
    if (pending) return pending;
    if (playing && !audio.paused) return Promise.resolve(true);
    restoreTime();
    var token = ++generation, result;
    try { result = audio.play(); }
    catch (error) { return Promise.resolve(fail(error)); }
    pending = Promise.resolve(result).then(function () {
      if (token !== generation || !canPlay()) return false;
      playing = !audio.paused && !audio.ended;
      if (!playing) return fail({ message: '背景音乐尚未开始播放' });
      started = true;
      blocked = false;
      lastError = '';
      save();
      return true;
    }, function (error) {
      return token === generation ? fail(error) : false;
    }).finally(function () {
      if (token === generation) { pending = null; notify(); }
    });
    notify();
    return pending;
  }

  readSaved();
  audio.addEventListener('loadedmetadata', restoreTime);
  audio.addEventListener('durationchange', restoreTime);
  audio.addEventListener('canplay', restoreTime);
  audio.addEventListener('progress', restoreTime);
  audio.addEventListener('seeked', function () { restoreSeeking = false; restoreTime(); });
  audio.addEventListener('timeupdate', function () {
    restoreTime();
    if (started && !restorePending && Date.now() - lastSave > 2000) { lastSave = Date.now(); save(); }
  });
  audio.addEventListener('pause', function () { playing = false; notify(); });
  audio.addEventListener('error', function () {
    fail({ message: '背景音乐加载失败，请检查 assets/audio/night_piano.mp3' });
  });

  if (location.protocol === 'file:') {
    audio.src = source; sourceLoaded = true;
  } else {
    // 完整本地 Blob 可寻址，避免不支持 Range 的预览服务器把续播位置重置为 0。
    sourceReady = fetch(source).then(function (response) {
      if (!response.ok) throw new Error('背景音乐读取失败：' + response.status);
      return response.blob();
    }).then(function (blob) {
      audio.src = URL.createObjectURL(blob); sourceLoaded = true; return true;
    }).catch(fail);
  }

  window.NightMusic = {
    // Promise<boolean>：只有 play() 真正成功才返回 true；拒绝可在下次手势重试。
    start: function () { requested = true; return play(); },
    setMuted: function (value) {
      muted = !!value;
      audio.muted = muted;
      save(); notify();
      return muted;
    },
    toggleMute: function () { return this.setMuted(!muted); },
    setDucked: function (value) {
      if (ducked === !!value) return ducked;
      ducked = !!value;
      audio.volume = ducked ? duckedVolume : normalVolume;
      notify();
      return ducked;
    },
    suspend: function (value) {
      if (suspended === !!value) return Promise.resolve(status().playing);
      suspended = !!value;
      if (suspended) { pause(); return Promise.resolve(false); }
      notify();
      return play();
    },
    status: status,
    handoff: function () { handedOff = true; pause(); return status(); }
  };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    else { notify(); if (started) play(); }
  });
  window.addEventListener('pagehide', function () { window.NightMusic.handoff(); });
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    handedOff = false;
    readSaved(); restoreTime(); notify();
    if (started) play();
  });
})();
