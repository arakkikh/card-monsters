// ============================================================
// 音（BGM と効果音）。Web Audio API でその場で演奏する（外部ファイルなし・オフラインで鳴る）
//   音の流れ：曲（曲ごとの音量 → パートごとの音量・左右）→ BGM の音量 → 効果音のときだけ下げる → 全体
//             効果音 → 効果音の音量 → 全体
//             どちらも一部を「残響」へ送る。全体 → リミッター（音割れ防止）→ スピーカー
//   曲のデータは music.js。設定（音量・ミュート・消音スイッチ）は fx.js の FX に入り、localStorage に保存する。
// ============================================================

const AUDIO = {
  MASTER: 1.6,        // 全体の音量（合成した音は小さめなので持ち上げ、リミッターで割れを防ぐ）
  MUSIC_LEVEL: 0.5,   // BGM のスライダーが最大のときの音量
  SFX_LEVEL: 1,       // 効果音のスライダーが最大のときの音量
  LOOKAHEAD: 0.35,    // 何秒先まで音を予約しておくか（演出で処理が重くなってもリズムがずれない）
  TICK_MS: 60,        // 予約を足していく間隔
  FADE: 1.2,          // 曲の切り替え（クロスフェード）の秒数
  DUCK: 0.7,          // 効果音が鳴っている間の BGM の音量（倍率）
  DUCK_HOLD: 0.2,     // 効果音が鳴ってから BGM を戻し始めるまでの秒数
  SFX_MAX: 8,         // 同時に鳴らす効果音の数の上限
  SFX_SAME_MS: 60,    // 同じ効果音は、この時間内に
  SFX_SAME_MAX: 2,    //   この回数まで
  MUSIC_VOICES: 24,   // BGM で同時に鳴らす音の数の上限
};
const FX_VOLUME = AUDIO.MASTER;
const FX_LATE_MS = 250;  // 音の準備がこれより遅れたら、その効果音は鳴らさない（後からまとめて鳴るのを防ぐ）

let fxAudio = null; // { ctx, master, music, duck, sfx, verb, noise, waves }

// ---------- 音の出口 ----------

function auParam(p, v) { if (p) p.value = v; }

// 残響の響き（減衰するノイズ）を作る
function auImpulse(ctx, sec) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * sec));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

// 音の出口（BGM・効果音・残響 → 全体 → リミッター → スピーカー）を作る
function fxAudioChain(ctx) {
  const master = ctx.createGain();
  master.gain.value = AUDIO.MASTER;
  let out = master;
  if (ctx.createDynamicsCompressor) {
    const lim = ctx.createDynamicsCompressor();
    auParam(lim.threshold, -8); auParam(lim.knee, 6); auParam(lim.ratio, 12);
    auParam(lim.attack, 0.002); auParam(lim.release, 0.12);
    master.connect(lim);
    out = lim;
  }
  out.connect(ctx.destination);
  const music = ctx.createGain(), duck = ctx.createGain(), sfx = ctx.createGain();
  music.connect(duck).connect(master);
  sfx.connect(master);
  let verb = null;
  if (ctx.createConvolver) {
    verb = ctx.createGain();
    verb.gain.value = 0.5;
    const conv = ctx.createConvolver();
    conv.buffer = auImpulse(ctx, 1.8);
    verb.connect(conv).connect(master);
  }
  // ノイズは一度だけ作って使い回す（毎回作るとスマホで重い）
  const len = Math.floor(ctx.sampleRate * 1.5);
  const noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
  return { master, music, duck, sfx, verb, noise };
}

function fxAudioCtx() {
  if ((FX.mute && FX.bgmMute) || typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!fxAudio) {
    auApplySession();
    const ctx = new AC();
    fxAudio = Object.assign({ ctx, waves: {}, sfxLive: [], sfxRecent: {}, voices: [] }, fxAudioChain(ctx));
    if (ctx.addEventListener) ctx.addEventListener('statechange', auOnState);
    auApplyVolumes(true);
  }
  return fxAudio;
}

// 止まっている音の出口を動かす。動いていれば null、そうでなければ Promise を返す
function fxResume() {
  const ctx = fxAudio && fxAudio.ctx;
  if (!ctx || ctx.state === 'running' || auHidden()) return null;
  try {
    const p = ctx.resume();
    return p && p.then ? p : null;
  } catch (e) { return null; }
}

// ブラウザ（特に iPhone の Safari）は、タップの「その瞬間」に始めた音しか鳴らさない。
// 最初のタップで音の出口を用意して動かし、流れるはずの曲を始める。
// 電話などで止められたあとも、次のタップでここから動き直す
function fxUnlock() {
  const a = fxAudioCtx();
  if (!a || a.ctx.state === 'running') return;
  auApplySession();
  const p = fxResume();
  if (p) p.then(() => bgmSync(), () => {});
  try { // 無音を一瞬鳴らす（古い Safari はこれで音が出るようになる）
    const src = a.ctx.createBufferSource();
    src.buffer = a.ctx.createBuffer(1, 1, a.ctx.sampleRate);
    src.connect(a.ctx.destination);
    src.start(0);
  } catch (e) { /* 鳴らせなくても続ける */ }
  bgmSync();
}

// ---------- iPhone の消音スイッチ・画面の切り替え・中断 ----------

// 消音スイッチに従うかを選べるか（iOS 17 以降の Safari にある navigator.audioSession）
function auSessionSupported() {
  return typeof navigator !== 'undefined' && !!navigator.audioSession && 'type' in navigator.audioSession;
}
// 'ambient'＝消音スイッチがオンなら鳴らさない／'playback'＝スイッチがオンでも鳴らす
function auApplySession() {
  if (!auSessionSupported()) return;
  try { navigator.audioSession.type = FX.silent === 'play' ? 'playback' : 'ambient'; } catch (e) { /* 選べなければ端末に任せる */ }
}

function auHidden() { return typeof document !== 'undefined' && !!document.hidden; }

// アプリを閉じた・別のアプリに切り替えた：音を小さくしてから止める（電池も減らさない）
function auPause() {
  const a = fxAudio;
  if (!a || a.ctx.state !== 'running') return;
  const t = a.ctx.currentTime;
  auRamp(a.master.gain, 0.0001, t, 0.06);
  setTimeout(() => { if (auHidden() && fxAudio === a) { try { const p = a.ctx.suspend(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 止められなくても続ける */ } } }, 250);
}
// 戻ってきた：動かし直して、音量を戻す。動かせなければ次のタップで動かす（fxUnlock）
function auWake() {
  const a = fxAudio;
  if (!a || auHidden()) return;
  const back = () => { auRamp(a.master.gain, AUDIO.MASTER, a.ctx.currentTime, 0.15); bgmSync(); };
  if (a.ctx.state === 'running') { back(); return; }
  const p = fxResume();
  if (p) p.then(back, () => {});
}
// 電話などで音が止められた（Safari では 'interrupted'）。見えている間なら少し待って動かし直す
function auOnState() {
  const a = fxAudio;
  if (!a || a.ctx.state === 'running' || a.ctx.state === 'closed' || auHidden()) return;
  setTimeout(auWake, 400);
}

if (typeof document !== 'undefined' && document.addEventListener) {
  for (const ev of ['pointerdown', 'mousedown', 'touchend', 'keydown', 'click']) document.addEventListener(ev, fxUnlock, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) auPause(); else auWake(); });
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', auPause);
    window.addEventListener('pageshow', auWake);
    window.addEventListener('focus', auWake);
  }
}

// ---------- 音量 ----------

// スライダー（0〜1）を耳で感じる大きさに近づける
function auCurve(v) { v = Math.max(0, Math.min(1, Number(v) || 0)); return v * v; }
function auMusicGain() { return FX.bgmMute ? 0 : auCurve(FX.bgm) * AUDIO.MUSIC_LEVEL; }
function auSfxGain() { return FX.mute ? 0 : auCurve(FX.sfx) * AUDIO.SFX_LEVEL; }

function auRamp(param, v, t, tc) {
  if (!param) return;
  if (param.cancelScheduledValues) param.cancelScheduledValues(t);
  if (param.setTargetAtTime) param.setTargetAtTime(v, t, tc); else param.value = v;
}

// 設定の音量を音の出口に反映する（スライダーを動かしている最中も呼ぶ）
function auApplyVolumes(now) {
  const a = fxAudio;
  if (!a) return;
  const t = a.ctx.currentTime;
  if (now) { a.music.gain.value = auMusicGain(); a.sfx.gain.value = auSfxGain(); }
  else { auRamp(a.music.gain, auMusicGain(), t, 0.05); auRamp(a.sfx.gain, auSfxGain(), t, 0.05); }
  bgmSync();
}

// 効果音の間だけ BGM を少し下げる
function auDuck() {
  const a = fxAudio;
  if (!a || !BGM.cur) return;
  const t = a.ctx.currentTime, g = a.duck.gain;
  if (g.cancelScheduledValues) g.cancelScheduledValues(t);
  if (g.setTargetAtTime) { g.setTargetAtTime(AUDIO.DUCK, t, 0.02); g.setTargetAtTime(1, t + AUDIO.DUCK_HOLD, 0.25); }
}

// ---------- 音を作る部品 ----------

const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

// 波形（倍音の強さ）。1つの発振器で、木管・オルガンなどの音色を出す
const AU_WAVES = {
  flute: [0, 1, 0.28, 0.08, 0.03],
  reed:  [0, 1, 0.05, 0.55, 0.04, 0.32, 0.03, 0.18, 0, 0.08],
  organ: [0, 1, 0.9, 0.35, 0.6, 0, 0.25, 0, 0.3],
  brass: [0, 1, 0.8, 0.62, 0.48, 0.36, 0.27, 0.2, 0.14, 0.1, 0.07],
  warm:  [0, 1, 0.5, 0.3, 0.2, 0.13, 0.08, 0.05],
  keys:  [0, 1, 0.12, 0.2, 0.02, 0.05],
};
function auWave(name) {
  const a = fxAudio;
  if (!AU_WAVES[name]) return null;
  if (!a.waves[name] && a.ctx.createPeriodicWave) {
    const h = AU_WAVES[name], re = new Float32Array(h.length), im = new Float32Array(h);
    a.waves[name] = a.ctx.createPeriodicWave(re, im);
  }
  return a.waves[name] || null;
}

// 音程のある音を1つ鳴らす。終わりの時刻を返す
//   wave：sine/triangle/square/sawtooth か AU_WAVES の名前　vol：大きさ　a/d/s/r：立ち上がり・減衰・持続の大きさ・余韻
//   glide：終わりの周波数（音程を滑らせる）　lp：ローパスフィルター {f, to, time, q}　vib：ビブラート {rate, depth(セント), delay}
function auOsc(dest, t, dur, freq, { wave = 'sine', vol = 0.2, a = 0.005, d = 0.1, s = 1, r = 0.08, glide = 0, glideTime = 0, detune = 0, lp = null, vib = null } = {}) {
  const A = fxAudio, ctx = A.ctx;
  const o = ctx.createOscillator(), g = ctx.createGain();
  const pw = auWave(wave);
  if (pw && o.setPeriodicWave) o.setPeriodicWave(pw); else o.type = AU_WAVES[wave] ? 'triangle' : wave;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + (glideTime || dur));
  if (detune && o.detune) o.detune.value = detune;
  let head = o;
  if (lp) {
    const f = ctx.createBiquadFilter();
    f.type = lp.type || 'lowpass';
    auParam(f.Q, lp.q || 0.7);
    f.frequency.setValueAtTime(lp.f, t);
    if (lp.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, lp.to), t + (lp.time || dur));
    head.connect(f); head = f;
  }
  const end = t + dur + r;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  if (s < 1) g.gain.setTargetAtTime(Math.max(0.0001, vol * s), t + a, d / 3 + 0.001);
  g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), r / 4 + 0.001);
  head.connect(g).connect(dest);
  let lfo = null;
  if (vib && o.detune) {
    lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = vib.rate || 5;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(vib.depth || 12, t + (vib.delay || 0.2) + 0.15);
    lfo.connect(lg).connect(o.detune);
    lfo.start(t); lfo.stop(end + 0.05);
  }
  o.start(t);
  o.stop(end + 0.05);
  return end;
}

// ノイズ（打楽器・風切り・破片など）。type：フィルターの種類　f→to：フィルターの周波数を動かす
function auNoise(dest, t, dur, { vol = 0.25, type = 'bandpass', f = 1200, to = 0, q = 1, a = 0.002, time = 0 } = {}) {
  const A = fxAudio, ctx = A.ctx;
  const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = A.noise;
  flt.type = type; auParam(flt.Q, q);
  flt.frequency.setValueAtTime(f, t);
  if (to) flt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + (time || dur));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setTargetAtTime(0.0001, t + a, dur / 4 + 0.001);
  src.connect(flt).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.1);
  return t + dur;
}

// 楽器。play(出口, 時刻, 長さ(秒), 周波数, 強さ0〜1)
const INSTRUMENTS = {
  // 木管（フルート風）：息の音つき・遅れてかかるビブラート
  flute: (o, t, d, f, v) => {
    auNoise(o, t, 0.08, { vol: 0.05 * v, type: 'bandpass', f: f * 2, q: 2 });
    return auOsc(o, t, d, f, { wave: 'flute', vol: 0.22 * v, a: 0.04, d: 0.2, s: 0.8, r: 0.12, vib: { rate: 5, depth: 10, delay: 0.25 } });
  },
  // 木管（クラリネット風）：こもった音
  reed: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'reed', vol: 0.2 * v, a: 0.03, d: 0.2, s: 0.75, r: 0.1, lp: { f: 2200 }, vib: { rate: 4.5, depth: 8, delay: 0.3 } }),
  // ハープ：はじいてすぐ減っていく、明るい音
  harp: (o, t, d, f, v) => {
    auOsc(o, t, 0.02, f * 2, { wave: 'sine', vol: 0.05 * v, a: 0.002, d: 0.3, s: 0, r: 0.6 });
    return auOsc(o, t, 0.05, f, { wave: 'triangle', vol: 0.2 * v, a: 0.003, d: 0.8, s: 0, r: 1.4, lp: { f: Math.min(9000, f * 8), to: f * 2, time: 1.2 } });
  },
  // ギター風のはじく音
  pluck: (o, t, d, f, v) => auOsc(o, t, Math.min(d, 0.12), f, { wave: 'sawtooth', vol: 0.12 * v, a: 0.003, d: 0.25, s: 0.15, r: 0.25, lp: { f: Math.min(8000, f * 7), to: f * 1.5, time: 0.35 } }),
  // エレピ風の柔らかい鍵盤
  keys: (o, t, d, f, v) => {
    auOsc(o, t, 0.02, f * 4, { wave: 'sine', vol: 0.03 * v, a: 0.002, d: 0.15, s: 0, r: 0.2 });
    return auOsc(o, t, d, f, { wave: 'keys', vol: 0.16 * v, a: 0.006, d: 0.6, s: 0.35, r: 0.35 });
  },
  // ベル・チェレスタ：きらきらした金属の響き
  bell: (o, t, d, f, v) => {
    auOsc(o, t, 0.02, f * 2.76, { wave: 'sine', vol: 0.05 * v, a: 0.002, d: 0.4, s: 0, r: 0.5 });
    return auOsc(o, t, 0.03, f, { wave: 'sine', vol: 0.17 * v, a: 0.002, d: 1, s: 0, r: 1.3 });
  },
  // オルガン：減らずに鳴り続ける
  organ: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'organ', vol: 0.11 * v, a: 0.03, s: 1, r: 0.18, lp: { f: 3500 } }),
  // ストリングス（伸ばす和音）：ゆっくり立ち上がる
  pad: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'warm', vol: 0.07 * v, a: 0.35, d: 0.5, s: 0.85, r: 0.6, detune: (Math.random() - 0.5) * 12, lp: { f: 1800 } }),
  // 不気味な声（毒沼）：ゆらぐ音程
  choir: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'flute', vol: 0.08 * v, a: 0.6, d: 0.5, s: 0.9, r: 0.8, vib: { rate: 0.7, depth: 22, delay: 0 } }),
  // ブラス：立ち上がりで明るくなる
  brass: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'brass', vol: 0.15 * v, a: 0.03, d: 0.25, s: 0.8, r: 0.12, lp: { f: 700, to: Math.min(6000, f * 6), time: 0.08 }, vib: { rate: 5.5, depth: 6, delay: 0.3 } }),
  // ベース：丸い低音
  bass: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'warm', vol: 0.32 * v, a: 0.006, d: 0.3, s: 0.6, r: 0.08, lp: { f: 700 } }),
  // うなるベース（火山）：鋸歯状波をフィルターで開け閉めする
  growl: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'sawtooth', vol: 0.22 * v, a: 0.005, d: 0.2, s: 0.7, r: 0.06, lp: { f: 1400, to: 260, time: Math.max(0.12, d), q: 6 } }),
  // うねるベース（毒沼）：音程がわずかに揺れる
  wobble: (o, t, d, f, v) => auOsc(o, t, d, f, { wave: 'sawtooth', vol: 0.2 * v, a: 0.02, d: 0.3, s: 0.8, r: 0.1, lp: { f: 900, to: 240, time: d, q: 8 }, vib: { rate: 3, depth: 25, delay: 0 } }),
  // 打楽器
  kick: (o, t, d, f, v) => {
    auNoise(o, t, 0.012, { vol: 0.12 * v, type: 'lowpass', f: 3500 }); // 小さなスピーカーでも聞こえる「アタック」
    return auOsc(o, t, 0.02, 140, { wave: 'sine', vol: 0.55 * v, a: 0.002, d: 0.25, s: 0, r: 0.3, glide: 42, glideTime: 0.2 });
  },
  snare: (o, t, d, f, v) => {
    auOsc(o, t, 0.02, 190, { wave: 'triangle', vol: 0.18 * v, a: 0.001, d: 0.08, s: 0, r: 0.08, glide: 150, glideTime: 0.08 });
    return auNoise(o, t, 0.18, { vol: 0.24 * v, type: 'highpass', f: 1500, q: 0.7 });
  },
  clap: (o, t, d, f, v) => {
    for (let i = 0; i < 3; i++) auNoise(o, t + i * 0.012, 0.03, { vol: 0.16 * v, type: 'bandpass', f: 1400, q: 1.2 });
    return auNoise(o, t + 0.036, 0.16, { vol: 0.16 * v, type: 'bandpass', f: 1300, q: 1 });
  },
  hat: (o, t, d, f, v) => auNoise(o, t, 0.04, { vol: 0.08 * v, type: 'highpass', f: 7500, q: 0.8 }),
  ohat: (o, t, d, f, v) => auNoise(o, t, 0.22, { vol: 0.07 * v, type: 'highpass', f: 6500, q: 0.8 }),
  shaker: (o, t, d, f, v) => auNoise(o, t, 0.06, { vol: 0.06 * v, type: 'bandpass', f: 6000, q: 1.5, a: 0.015 }),
  rim: (o, t, d, f, v) => auOsc(o, t, 0.01, 1700, { wave: 'square', vol: 0.05 * v, a: 0.001, d: 0.03, s: 0, r: 0.03, lp: { f: 3000, type: 'bandpass', q: 3 } }),
  tom: (o, t, d, f, v) => auOsc(o, t, 0.02, f || 180, { wave: 'sine', vol: 0.32 * v, a: 0.002, d: 0.25, s: 0, r: 0.3, glide: (f || 180) * 0.6, glideTime: 0.25 }),
  // 和太鼓風の大きな太鼓：低い胴鳴りと皮の音
  taiko: (o, t, d, f, v) => {
    auNoise(o, t, 0.12, { vol: 0.18 * v, type: 'lowpass', f: 900, to: 200 });
    return auOsc(o, t, 0.05, 95, { wave: 'sine', vol: 0.6 * v, a: 0.003, d: 0.5, s: 0, r: 0.6, glide: 52, glideTime: 0.45 });
  },
  timpani: (o, t, d, f, v) => {
    auNoise(o, t, 0.05, { vol: 0.06 * v, type: 'lowpass', f: 1200 });
    return auOsc(o, t, 0.05, f || 98, { wave: 'sine', vol: 0.4 * v, a: 0.004, d: 1, s: 0, r: 1.2, glide: (f || 98) * 0.97, glideTime: 1 });
  },
  crash: (o, t, d, f, v) => auNoise(o, t, 1.6, { vol: 0.09 * v, type: 'highpass', f: 5000, q: 0.5, a: 0.005 }),
};

// ---------- 曲のデータを、演奏する音の並びにする ----------

const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'C#5' → MIDI の番号
function noteMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('音の名前が読めない: ' + name);
  return 12 * (Number(m[3]) + 1) + NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const CHORD_TYPES = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], dim: [0, 3, 6], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], 5: [0, 7],
};
// 'D/F#' → { root: 2, tones: [0,4,7], bass: 6 }
function parseChord(sym) {
  const [main, slash] = sym.split('/');
  const m = /^([A-G])([#b]?)(.*)$/.exec(main);
  if (!m || !CHORD_TYPES[m[3]]) throw new Error('和音が読めない: ' + sym);
  const pc = s => (NOTE_PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
  const root = pc(m[1] + m[2]);
  return { sym, root, tones: CHORD_TYPES[m[3]], bass: slash ? pc(slash) : root };
}

// 曲の構成（セクションの並び）を、1回分のループの音の並びにする
//   返す値：{ steps（ループの長さ・16分音符の数）, stepSec, events: [{ s（何番目の16分音符か）, p（パート）, m（MIDI）, d（長さ・16分音符）, v（強さ） }] }
function bgmCompile(song) {
  const bar = song.bar || 16, events = [], chordsAt = [];
  let base = 0;
  const sections = song.order.map(name => {
    let sec = song.sections[name];
    if (!sec) throw new Error(`${song.id}: セクション ${name} がない`);
    if (sec.like) sec = Object.assign({}, song.sections[sec.like], sec, { pat: Object.assign({}, song.sections[sec.like].pat, sec.pat) });
    return { name, ...sec };
  });
  for (const sec of sections) {
    const chords = sec.chords.trim().split(/\s+/);
    const bars = chords.length;
    // 和音：1小節に1つ。'C,G' なら半分ずつ
    chords.forEach((tok, b) => {
      const parts = tok.split(',');
      parts.forEach((c, i) => { chordsAt.push({ s: base + b * bar + i * bar / parts.length, len: bar / parts.length, ch: parseChord(c) }); });
    });
    // メロディ：'E5:4 r:2 …'（音:長さ）
    if (sec.mel) {
      let s = 0;
      for (const tok of sec.mel.trim().split(/\s+/)) {
        if (tok === '|') { // 小節の区切り：ずれていないか確かめる
          if (s % bar) throw new Error(`${song.id} ${sec.name}: 小節の区切りがずれている（${s}）`);
          continue;
        }
        const [n, len] = tok.split(':');
        const d = Number(len);
        if (!(d > 0)) throw new Error(`${song.id} ${sec.name}: 長さが読めない ${tok}`);
        if (n !== 'r') events.push({ s: base + s, p: sec.melPart || 'mel', m: noteMidi(n), d, v: 0.9 + ((s % 8) === 0 ? 0.1 : 0) });
        s += d;
      }
      if (s !== bars * bar) throw new Error(`${song.id} ${sec.name}: メロディの長さが小節と合わない（${s} / ${bars * bar}）`);
    }
    // 伴奏・ベース・打楽器：1小節（またはその倍数）の型をくり返す
    for (const [pid, part] of Object.entries(song.parts)) {
      if (part.kind === 'mel') continue;
      const pat = sec.pat && pid in sec.pat ? sec.pat[pid] : part.pat;
      if (!pat) continue;
      const plen = pat.length;
      for (let i = 0; i < bars * bar; i++) {
        const c = pat[i % plen];
        if (c === '.' || c === ' ') continue;
        const s = base + i;
        const v = (c === 'X' ? 1 : c === 'g' ? 0.45 : 0.8) * ((i % 4) === 0 ? 1 : 0.85);
        if (part.kind === 'drum') { events.push({ s, p: pid, m: part.m || 0, d: 1, v }); continue; }
        const ch = chordAtStep(chordsAt, s);
        const notes = part.kind === 'bass' ? [bassNote(ch, c, part.oct || 2)] : chordNotes(ch, c, part.oct || 4);
        const d = part.len || (part.kind === 'bass' ? 2 : 2);
        for (const m of notes) if (m != null) events.push({ s, p: pid, m, d: part.hold ? Math.max(d, holdLen(pat, i % plen, bars * bar - i)) : d, v: 0.85 });
      }
    }
    base += bars * bar;
  }
  events.sort((x, y) => x.s - y.s);
  return { steps: base, stepSec: 60 / song.bpm / 4, events, chords: chordsAt, sections: sections.map(s => s.name) };
}
function chordAtStep(list, s) {
  let found = list[0];
  for (const c of list) { if (c.s <= s) found = c; else break; }
  return found.ch;
}
// 伸ばす型：次の音までの長さ
function holdLen(pat, i, left) {
  let n = 1;
  while (n < left && pat[(i + n) % pat.length] === '.') n++;
  return n;
}
// 伴奏：'0'〜'9' は和音の何番目の音か（上の音域へ続く）、'c' は和音全部
function chordNotes(ch, c, oct) {
  const low = 12 * (oct + 1) + ch.root - (ch.root > 6 ? 12 : 0);
  const n = ch.tones.length;
  const at = i => low + ch.tones[i % n] + 12 * Math.floor(i / n);
  if (c === 'c') return ch.tones.map((x, i) => at(i));
  const i = Number(c);
  return Number.isInteger(i) ? [at(i)] : [];
}
// ベース：R＝根音（分数和音なら下の音）、3・5・7＝和音の3度・5度・7度、O＝1オクターブ上、L＝1オクターブ下
function bassNote(ch, c, oct) {
  const low = 12 * (oct + 1) + ch.bass - (ch.bass > 4 ? 12 : 0);
  const rootLow = low + ((ch.root - ch.bass + 12) % 12);
  const t = ch.tones;
  if (c === 'R' || c === 'x' || c === 'X') return low;
  if (c === 'O') return low + 12;
  if (c === 'L') return low - 12;
  if (c === '3') return rootLow + t[1];
  if (c === '5') return rootLow + (t.includes(7) ? 7 : t[2] || 7);
  if (c === '7') return rootLow + (t[3] && t[3] < 12 ? t[3] : 10);
  return null;
}

// ---------- BGM の演奏 ----------

const BGM = {
  want: null,     // 流したい曲（場面から決まる）
  preview: null,  // 試聴中の曲（試聴画面だけ）
  cur: null,      // いま流れている曲 { id, song, plan, out, parts, base, idx }
  fading: [],     // 小さくしている途中の曲
  timer: null,
};
const bgmCache = {};
function bgmPlan(id) { return bgmCache[id] || (bgmCache[id] = bgmCompile(Object.assign({ id }, MUSIC[id]))); }

// 場面の曲を決める（流れていれば切り替える）。曲がなければ止める
function bgmPlay(id) {
  BGM.want = id && MUSIC[id] ? id : null;
  bgmSync();
}
function bgmTarget() { return BGM.preview || BGM.want; }

// 流したい曲と、いま流れている曲をそろえる
function bgmSync() {
  const a = fxAudio;
  const id = FX.bgmMute ? null : bgmTarget();
  if (!a || a.ctx.state !== 'running') { if (!id && BGM.cur) bgmStop(0.05); return; }
  if (BGM.cur && BGM.cur.id === id) return;
  bgmStop(AUDIO.FADE);
  if (id) bgmStart(id);
}

function bgmStart(id) {
  const a = fxAudio, ctx = a.ctx, song = MUSIC[id], plan = bgmPlan(id);
  const out = ctx.createGain();
  const t0 = ctx.currentTime + 0.08;
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.linearRampToValueAtTime(1, t0 + AUDIO.FADE);
  out.connect(a.music);
  const parts = {};
  for (const [pid, p] of Object.entries(song.parts)) {
    const g = ctx.createGain();
    g.gain.value = p.vol == null ? 1 : p.vol;
    let head = g;
    if (p.pan && ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = p.pan; g.connect(pan); head = pan; }
    head.connect(out);
    if (a.verb && p.rev) { const send = ctx.createGain(); send.gain.value = p.rev; head.connect(send).connect(a.verb); }
    parts[pid] = g;
  }
  BGM.cur = { id, song, plan, out, parts, base: t0, idx: 0 };
  bgmTick();
  if (!BGM.timer) BGM.timer = setInterval(bgmTick, AUDIO.TICK_MS);
}

function bgmStop(fade) {
  const cur = BGM.cur;
  if (!cur) return;
  BGM.cur = null;
  const a = fxAudio, t = a.ctx.currentTime;
  auRamp(cur.out.gain, 0.0001, t, fade / 4);
  cur.end = t + fade;
  BGM.fading.push(cur);
  setTimeout(() => {
    BGM.fading = BGM.fading.filter(x => x !== cur);
    try { cur.out.disconnect(); } catch (e) { /* もう外れている */ }
  }, fade * 1000 + 600);
}

// 先の音を予約していく。ループの終わりまで来たら、最初に戻ってすき間なく続ける。
// 小さくしている途中の曲も、消えるまで演奏を続ける（クロスフェード）
function bgmTick() {
  const a = fxAudio;
  if (!a || (!BGM.cur && !BGM.fading.length)) { if (BGM.timer) { clearInterval(BGM.timer); BGM.timer = null; } return; }
  if (a.ctx.state !== 'running') return;
  for (const inst of [BGM.cur, ...BGM.fading]) if (inst) bgmTickOne(a, inst);
}
function bgmTickOne(a, cur) {
  const now = a.ctx.currentTime, plan = cur.plan, st = plan.stepSec;
  const until = Math.min(now + AUDIO.LOOKAHEAD, cur.end || Infinity);
  const loopSec = plan.steps * st;
  // 長く止まっていた（ループ1回分以上遅れた）ときは、今の時刻から続ける
  if (cur.base + loopSec < now) { cur.base = now + 0.05; cur.idx = 0; }
  let guard = 0;
  while (guard++ < 400) {
    if (cur.idx >= plan.events.length) { cur.idx = 0; cur.base += loopSec; continue; }
    const ev = plan.events[cur.idx], t = cur.base + ev.s * st;
    if (t > until) break;
    cur.idx++;
    if (t < now - 0.01) continue; // 間に合わなかった音は鳴らさない
    bgmNote(cur, ev, t, st);
  }
}

// 同時に鳴る音の数をおさえる：上限を超えたら、伴奏から先に省く
function bgmNote(cur, ev, t, st) {
  const a = fxAudio, part = cur.song.parts[ev.p];
  a.voices = a.voices.filter(e => e > t);
  if (a.voices.length >= AUDIO.MUSIC_VOICES && part.kind !== 'mel' && part.kind !== 'bass') return;
  const inst = INSTRUMENTS[part.inst];
  const swing = cur.song.swing && ev.s % 4 === 2 ? cur.song.swing * st : 0;
  const end = inst(cur.parts[ev.p], t + swing, ev.d * st * (part.gate || 0.92), part.kind === 'drum' ? (part.f || 0) : midiFreq(ev.m + (part.shift || 0)), ev.v * (0.94 + Math.random() * 0.06));
  a.voices.push(end || t + ev.d * st);
}

// ---------- 効果音 ----------

// 音ごとの大きさの補正（書き出して測った大きさを、だいたいそろえる）
const SFX_GAIN = { tap: 4, thorns: 3, equip: 3, dodge: 2.2, flash: 2, turn: 2, buff: 1.6, hit: 1.6, block: 1.6, break: 1.4, disease: 1.4, outbreak: 1.4, entangle: 1.3, debuff: 1.3, gem: 1.3, ranged: 1.2 };
let sfxBoost = 1;

// 効果音の出口：音量（効果音の音量へ）と、残響への送り
function sfxOut(rev = 0.2, pan = 0) {
  const a = fxAudio, ctx = a.ctx, g = ctx.createGain();
  g.gain.value = sfxBoost;
  let head = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); head = p; }
  head.connect(a.sfx);
  if (rev && a.verb) { const s = ctx.createGain(); s.gain.value = rev; head.connect(s).connect(a.verb); }
  return g;
}
const sfxNow = () => fxAudio.ctx.currentTime + 0.005;

// 音の一覧。どの音も「当たる瞬間」「本体」「低音の重み」を重ねて厚みを出す
const SFX = {
  // 近接：風切り → 打撃（低い衝撃と金属のきらめき）
  melee: () => {
    const o = sfxOut(0.18), t = sfxNow();
    auNoise(o, t, 0.12, { vol: 0.3, type: 'bandpass', f: 700, to: 3200, q: 1.5, a: 0.03 });
    auNoise(o, t + 0.1, 0.08, { vol: 0.5, type: 'lowpass', f: 3000, to: 600 });
    auOsc(o, t + 0.1, 0.03, 150, { vol: 0.5, a: 0.002, d: 0.15, s: 0, r: 0.2, glide: 48, glideTime: 0.18 });
    auOsc(o, t + 0.1, 0.01, 2400, { wave: 'square', vol: 0.04, a: 0.001, d: 0.08, s: 0, r: 0.12, lp: { f: 4000, type: 'bandpass', q: 6 } });
  },
  // 遠隔：弦の音 → 飛んでいく音 → 刺さる音
  ranged: () => {
    const o = sfxOut(0.15), t = sfxNow();
    auOsc(o, t, 0.02, 240, { wave: 'sawtooth', vol: 0.14, a: 0.002, d: 0.12, s: 0, r: 0.15, glide: 190, lp: { f: 2500, to: 500 } });
    auNoise(o, t + 0.04, 0.24, { vol: 0.2, type: 'bandpass', f: 4500, to: 1200, q: 3, a: 0.05 });
    auOsc(o, t + 0.3, 0.02, 320, { wave: 'triangle', vol: 0.3, a: 0.001, d: 0.08, s: 0, r: 0.1, glide: 110, glideTime: 0.08 });
    auNoise(o, t + 0.3, 0.04, { vol: 0.25, type: 'highpass', f: 2500 });
  },
  // 魔法：きらめく和音と、ふくらむ低い響き
  magic: () => {
    const o = sfxOut(0.5), t = sfxNow();
    [72, 76, 79, 84].forEach((m, i) => INSTRUMENTS.bell(o, t + i * 0.055, 0.1, midiFreq(m), 0.9));
    auOsc(o, t, 0.4, midiFreq(60), { wave: 'warm', vol: 0.1, a: 0.12, d: 0.3, s: 0.6, r: 0.3, lp: { f: 2200 } });
    auNoise(o, t + 0.2, 0.35, { vol: 0.07, type: 'highpass', f: 6000, a: 0.08 });
    auOsc(o, t + 0.42, 0.03, midiFreq(91), { vol: 0.08, a: 0.002, d: 0.5, s: 0, r: 0.6, glide: midiFreq(84), glideTime: 0.5 });
  },
  // カオス：うなる不協和音と、沈み込む衝撃
  chaos: () => {
    const o = sfxOut(0.3), t = sfxNow();
    auOsc(o, t, 0.34, 82, { wave: 'sawtooth', vol: 0.16, a: 0.02, s: 1, r: 0.1, glide: 140, lp: { f: 300, to: 1800, q: 5 } });
    auOsc(o, t, 0.34, 87, { wave: 'sawtooth', vol: 0.16, a: 0.02, s: 1, r: 0.1, glide: 125, lp: { f: 300, to: 1600, q: 5 } });
    auOsc(o, t + 0.05, 0.25, 466, { wave: 'square', vol: 0.03, a: 0.05, s: 1, r: 0.1, lp: { f: 1500 } });
    auNoise(o, t + 0.3, 0.3, { vol: 0.35, type: 'lowpass', f: 2500, to: 200 });
    auOsc(o, t + 0.3, 0.03, 120, { vol: 0.5, a: 0.002, d: 0.3, s: 0, r: 0.4, glide: 36, glideTime: 0.4 });
  },
  // ダメージが入った
  hit: () => {
    const o = sfxOut(0.08), t = sfxNow();
    auNoise(o, t, 0.07, { vol: 0.42, type: 'lowpass', f: 2200, to: 500 });
    auOsc(o, t, 0.02, 180, { vol: 0.3, a: 0.001, d: 0.1, s: 0, r: 0.12, glide: 60, glideTime: 0.12 });
  },
  // ブロック：金属に当たって止まる
  block: () => {
    const o = sfxOut(0.3), t = sfxNow();
    auNoise(o, t, 0.03, { vol: 0.3, type: 'highpass', f: 3000 });
    auOsc(o, t, 0.01, 1480, { vol: 0.09, a: 0.001, d: 0.25, s: 0, r: 0.3 });
    auOsc(o, t, 0.01, 2260, { vol: 0.06, a: 0.001, d: 0.2, s: 0, r: 0.25 });
    auOsc(o, t, 0.02, 130, { vol: 0.3, a: 0.001, d: 0.1, s: 0, r: 0.12, glide: 80, glideTime: 0.1 });
  },
  // アーマー破壊：割れる音と飛び散る破片
  break: () => {
    const o = sfxOut(0.25), t = sfxNow();
    auNoise(o, t, 0.06, { vol: 0.45, type: 'highpass', f: 2500 });
    auNoise(o, t + 0.02, 0.3, { vol: 0.18, type: 'bandpass', f: 5000, to: 2000, q: 2 });
    [3100, 2500, 3700, 2100].forEach((f, i) => auOsc(o, t + 0.03 + i * 0.035, 0.01, f, { vol: 0.05, a: 0.001, d: 0.08, s: 0, r: 0.1 }));
    auOsc(o, t, 0.02, 110, { vol: 0.38, a: 0.001, d: 0.15, s: 0, r: 0.2, glide: 50, glideTime: 0.2 });
  },
  // 回避：ひらりとかわす風
  dodge: () => {
    const o = sfxOut(0.2, 0.3), t = sfxNow();
    auNoise(o, t, 0.22, { vol: 0.32, type: 'bandpass', f: 500, to: 3800, q: 2, a: 0.06 });
    auOsc(o, t, 0.16, 420, { wave: 'triangle', vol: 0.06, a: 0.04, s: 1, r: 0.08, glide: 950 });
  },
  thorns: () => {
    const o = sfxOut(0.15), t = sfxNow();
    auOsc(o, t, 0.01, 1760, { wave: 'square', vol: 0.05, a: 0.001, d: 0.06, s: 0, r: 0.06, lp: { f: 3500 } });
    auOsc(o, t + 0.05, 0.01, 1320, { wave: 'square', vol: 0.05, a: 0.001, d: 0.08, s: 0, r: 0.08, lp: { f: 3000 } });
    auNoise(o, t, 0.05, { vol: 0.15, type: 'highpass', f: 3000 });
  },
  // 回復：あたたかい和音と、のぼっていく鈴
  heal: () => {
    const o = sfxOut(0.45), t = sfxNow();
    auOsc(o, t, 0.45, midiFreq(72), { wave: 'warm', vol: 0.08, a: 0.1, s: 1, r: 0.3, lp: { f: 2000 } });
    auOsc(o, t, 0.45, midiFreq(76), { wave: 'warm', vol: 0.07, a: 0.1, s: 1, r: 0.3, lp: { f: 2000 } });
    [84, 88, 91, 96].forEach((m, i) => INSTRUMENTS.bell(o, t + 0.05 + i * 0.07, 0.1, midiFreq(m), 0.55));
  },
  buff: () => {
    const o = sfxOut(0.3), t = sfxNow();
    [67, 71, 74].forEach((m, i) => auOsc(o, t + i * 0.03, 0.22, midiFreq(m), { wave: 'brass', vol: 0.06, a: 0.02, d: 0.1, s: 0.7, r: 0.15, lp: { f: 900, to: 3000, time: 0.1 } }));
    auOsc(o, t + 0.1, 0.25, midiFreq(79), { wave: 'triangle', vol: 0.05, a: 0.02, s: 1, r: 0.2 });
  },
  debuff: () => {
    const o = sfxOut(0.25), t = sfxNow();
    auOsc(o, t, 0.3, 320, { wave: 'sawtooth', vol: 0.1, a: 0.01, s: 1, r: 0.1, glide: 150, lp: { f: 1500, to: 400 } });
    auOsc(o, t, 0.3, 338, { wave: 'sawtooth', vol: 0.06, a: 0.01, s: 1, r: 0.1, glide: 160, lp: { f: 1500, to: 400 } });
  },
  disease: () => {
    const o = sfxOut(0.25), t = sfxNow();
    [300, 420, 360].forEach((f, i) => auOsc(o, t + i * 0.07, 0.06, f, { wave: 'reed', vol: 0.12, a: 0.01, s: 1, r: 0.06, glide: f + 160 }));
    auNoise(o, t, 0.25, { vol: 0.06, type: 'bandpass', f: 600, q: 5 });
  },
  outbreak: () => {
    const o = sfxOut(0.3), t = sfxNow();
    auNoise(o, t, 0.25, { vol: 0.3, type: 'lowpass', f: 400, to: 2200 });
    auOsc(o, t, 0.22, 200, { wave: 'sawtooth', vol: 0.12, a: 0.01, s: 1, r: 0.1, glide: 80, lp: { f: 1200 } });
  },
  entangle: () => {
    const o = sfxOut(0.25), t = sfxNow();
    auOsc(o, t, 0.3, 140, { wave: 'sawtooth', vol: 0.12, a: 0.03, s: 1, r: 0.1, glide: 260, lp: { f: 900, q: 4 } });
    auNoise(o, t, 0.28, { vol: 0.1, type: 'bandpass', f: 900, q: 6 });
  },
  silence: () => {
    const o = sfxOut(0.4), t = sfxNow();
    auOsc(o, t, 0.3, 330, { wave: 'flute', vol: 0.14, a: 0.01, s: 1, r: 0.25, glide: 180 });
    auNoise(o, t, 0.3, { vol: 0.06, type: 'lowpass', f: 1500, to: 300 });
  },
  // 撃破：沈む音と、低い衝撃
  death: () => {
    const o = sfxOut(0.35), t = sfxNow();
    auOsc(o, t, 0.4, 520, { wave: 'triangle', vol: 0.15, a: 0.005, s: 1, r: 0.15, glide: 110 });
    auNoise(o, t, 0.45, { vol: 0.2, type: 'lowpass', f: 3000, to: 250 });
    auOsc(o, t + 0.05, 0.03, 90, { vol: 0.45, a: 0.002, d: 0.4, s: 0, r: 0.5, glide: 32, glideTime: 0.5 });
  },
  burn: () => {
    const o = sfxOut(0.2), t = sfxNow();
    auNoise(o, t, 0.7, { vol: 0.25, type: 'lowpass', f: 500, to: 1600, a: 0.05 });
    auNoise(o, t + 0.1, 0.4, { vol: 0.08, type: 'highpass', f: 5000, a: 0.02 });
    auOsc(o, t, 0.6, 70, { wave: 'sawtooth', vol: 0.12, a: 0.05, s: 1, r: 0.2, lp: { f: 400 } });
  },
  // 生贄：暗くふくらんで、吸いこまれる
  sacrifice: () => {
    const o = sfxOut(0.5), t = sfxNow();
    auNoise(o, t, 0.45, { vol: 0.32, type: 'lowpass', f: 300, to: 2600, a: 0.2 });
    auOsc(o, t, 0.5, 110, { wave: 'sawtooth', vol: 0.12, a: 0.15, s: 1, r: 0.2, glide: 55, lp: { f: 700 } });
    INSTRUMENTS.bell(o, t + 0.35, 0.1, 220, 0.9);
  },
  // クリスタル獲得：澄んだ2つの鈴
  gem: () => {
    const o = sfxOut(0.4, 0.2), t = sfxNow();
    INSTRUMENTS.bell(o, t, 0.1, midiFreq(91), 0.7);
    INSTRUMENTS.bell(o, t + 0.07, 0.1, midiFreq(96), 0.8);
    auNoise(o, t + 0.05, 0.2, { vol: 0.04, type: 'highpass', f: 8000 });
  },
  // カードを出す：カードが滑って、場に置かれる
  summon: () => {
    const o = sfxOut(0.25), t = sfxNow();
    auNoise(o, t, 0.09, { vol: 0.18, type: 'bandpass', f: 1200, to: 2600, q: 1.2, a: 0.03 });
    auOsc(o, t + 0.08, 0.02, 170, { vol: 0.32, a: 0.002, d: 0.12, s: 0, r: 0.15, glide: 70, glideTime: 0.12 });
    INSTRUMENTS.harp(o, t + 0.1, 0.1, midiFreq(55), 0.6);
    INSTRUMENTS.harp(o, t + 0.14, 0.1, midiFreq(62), 0.5);
  },
  equip: () => {
    const o = sfxOut(0.25), t = sfxNow();
    auNoise(o, t, 0.02, { vol: 0.18, type: 'highpass', f: 3500 });
    auOsc(o, t, 0.01, 1320, { vol: 0.07, a: 0.001, d: 0.12, s: 0, r: 0.15 });
    auOsc(o, t + 0.06, 0.01, 1760, { vol: 0.07, a: 0.001, d: 0.15, s: 0, r: 0.2 });
  },
  flash: () => {
    const o = sfxOut(0.35), t = sfxNow();
    auNoise(o, t, 0.2, { vol: 0.16, type: 'bandpass', f: 1500, to: 6000, q: 1.5, a: 0.05 });
    auOsc(o, t, 0.2, 880, { wave: 'triangle', vol: 0.08, a: 0.02, s: 1, r: 0.15, glide: 1400 });
  },
  turn: () => {
    const o = sfxOut(0.35), t = sfxNow();
    auOsc(o, t, 0.16, midiFreq(67), { wave: 'brass', vol: 0.08, a: 0.02, d: 0.1, s: 0.7, r: 0.15, lp: { f: 800, to: 2500, time: 0.08 } });
    auOsc(o, t + 0.12, 0.28, midiFreq(72), { wave: 'brass', vol: 0.08, a: 0.02, d: 0.1, s: 0.7, r: 0.2, lp: { f: 800, to: 2500, time: 0.08 } });
  },
  // ボタン：小さく短いクリック
  tap: () => {
    const o = sfxOut(0.05), t = sfxNow();
    auOsc(o, t, 0.01, 1150, { wave: 'triangle', vol: 0.1, a: 0.001, d: 0.03, s: 0, r: 0.04, glide: 820, glideTime: 0.04 });
  },
  win: () => {
    const o = sfxOut(0.35), t = sfxNow();
    [[72, 0], [76, 0.11], [79, 0.22], [84, 0.33]].forEach(([m, d]) => INSTRUMENTS.brass(o, t + d, d === 0.33 ? 0.6 : 0.1, midiFreq(m), 0.9));
    INSTRUMENTS.timpani(o, t + 0.33, 0, 98, 0.8);
    INSTRUMENTS.crash(o, t + 0.33, 0, 0, 0.8);
  },
  lose: () => {
    const o = sfxOut(0.4), t = sfxNow();
    [[67, 0], [66, 0.22], [65, 0.44], [64, 0.66]].forEach(([m, d], i) => INSTRUMENTS.reed(o, t + d, i === 3 ? 0.7 : 0.18, midiFreq(m), 0.9));
    INSTRUMENTS.timpani(o, t + 0.66, 0, 73, 0.6);
  },
};

// 同じ音が短い時間に重なりすぎないように・同時に鳴る数が多すぎないようにする
function sfxAllowed(a, name) {
  const now = Date.now();
  a.sfxLive = a.sfxLive.filter(x => x > now);
  if (a.sfxLive.length >= AUDIO.SFX_MAX) return false;
  const recent = (a.sfxRecent[name] || []).filter(x => now - x < AUDIO.SFX_SAME_MS);
  if (recent.length >= AUDIO.SFX_SAME_MAX) { a.sfxRecent[name] = recent; return false; }
  recent.push(now);
  a.sfxRecent[name] = recent;
  a.sfxLive.push(now + 450);
  return true;
}

function sfx(name) {
  if (FX.mute || !SFX[name]) return;
  const a = fxAudioCtx();
  if (!a) return;
  const play = () => {
    if (!sfxAllowed(a, name)) return;
    sfxBoost = SFX_GAIN[name] || 1;
    try { SFX[name](); auDuck(); } catch (e) { /* 音が出せない環境では黙って続ける */ }
  };
  if (a.ctx.state === 'running') { play(); return; }
  // まだ音の出口が動いていない：動かしてから鳴らす。遅れすぎた音は捨てる
  const at = Date.now();
  const p = fxResume();
  if (p) p.then(() => { if (a.ctx.state === 'running' && Date.now() - at < FX_LATE_MS) play(); bgmSync(); }, () => {});
}

// ---------- 場面と曲 ----------

// 地形の景色 → 曲
const BGM_OF_SCENE = { meadow: 'plain', forest: 'forest', volcano: 'volcano', sky: 'sky', swamp: 'swamp', castle: 'castle', lake: 'lake' };

// いまの画面から、流す曲を決める
function bgmForScene() {
  const scr = typeof currentScreen !== 'undefined' ? currentScreen : 'title';
  if (scr === 'battle' && typeof state !== 'undefined' && state) {
    const scene = state.terrain ? state.terrain.scene : null;
    const id = BGM_OF_SCENE[scene];
    return MUSIC[id] ? id : 'plain';
  }
  return 'home';
}
function bgmRefresh() { bgmPlay(bgmForScene()); }
