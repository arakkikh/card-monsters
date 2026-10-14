// ============================================================
// 演出（エフェクト）と効果音
//   演出は #fx の上に小さな要素を出して動かす。同時に動かす数は少なく抑えている。
//   効果音は Web Audio API でその場で合成する（外部ファイルなし）。
//   設定：演出速度（1倍・2倍・スキップ）・ミュート・オートバトル・オートの強さ。localStorage に保存する。
// ============================================================

const FX_KEY = 'card-monsters-settings';
const FX = { speed: 1, mute: false, auto: false, autoLevel: 'strong' }; // speed: 1 | 2 | 'skip'　auto: オートバトル（自分の番も自動で進める）　autoLevel: オートの強さ（'normal' ふつう | 'strong' つよい）
const FX_AUTO_LEVELS = [['normal', 'ふつう'], ['strong', 'つよい']];
const FX_SPEEDS = [[1, '1倍'], [2, '2倍'], ['skip', 'スキップ']];

// 保存されていた設定（古い形でもよい）を FX に反映する。足りない項目は初期値
function fxApplySettings(s) {
  s = s || {};
  if (FX_SPEEDS.some(x => x[0] === s.speed)) FX.speed = s.speed;
  FX.mute = !!s.mute;
  FX.auto = !!s.auto;
  FX.autoLevel = s.autoLevel === 'normal' ? 'normal' : 'strong'; // 保存がなければ「つよい」
}

function fxLoadSettings() {
  try { fxApplySettings(JSON.parse(localStorage.getItem(FX_KEY))); } catch (e) { /* 保存がなければ初期値 */ }
  fxApplySpeed();
}

function fxSaveSettings() {
  try { localStorage.setItem(FX_KEY, JSON.stringify(FX)); } catch (e) { /* 保存できなくても動く */ }
  fxApplySpeed();
}

// CSS のアニメーションにも速度を伝える（--spd で割る）
function fxApplySpeed() {
  if (typeof document === 'undefined' || !document.documentElement || !document.documentElement.style) return;
  document.documentElement.style.setProperty('--spd', FX.speed === 'skip' ? 100 : FX.speed);
}

// 待ち時間・演出の長さ。2倍なら半分、スキップなら0
function fxMs(ms) { return FX.speed === 'skip' ? 0 : ms / FX.speed; }
const fxWait = ms => new Promise(r => setTimeout(r, fxMs(ms)));
// 溜めの演出の待ち時間。2倍速では、速さの分に加えてさらに半分にする
const fxCharge = ms => fxWait(FX.speed === 1 ? ms : ms * 0.5);

// 「視差効果を減らす」がオンなら、飛び道具や揺れなどの大きな動きは出さない
function fxReduced() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 演出を出せる状態か（スキップ中・画面がない環境では出さない）
function fxOn() {
  if (FX.speed === 'skip' || typeof document === 'undefined') return false;
  const layer = document.querySelector('#fx');
  return !!(layer && typeof layer.getBoundingClientRect === 'function');
}

// ダメージ数字の色：魔法=青、カオス=紫、遠隔=緑、近接=赤
function dmgClass(type) { return { magic: 't-magic', chaos: 't-chaos', ranged: 't-ranged', melee: 't-melee' }[type] || ''; }

// ---------- 要素を出す・動かす ----------

// 要素の中心（#app からの位置）
function fxCenter(el) {
  const a = document.querySelector('#app').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width, h: r.height };
}

// エフェクト用の要素を1つ出す。life ミリ秒後に消える
function fxSpawn(cls, x, y, html = '', life = 600) {
  const el = document.createElement('div');
  el.className = 'fx ' + cls;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.innerHTML = html;
  document.querySelector('#fx').appendChild(el);
  setTimeout(() => el.remove(), Math.max(60, fxMs(life)));
  return el;
}

// 要素を動かす。終わったら解決する（画面が裏にあるなどで終了が通知されなくても、時間で先へ進む）
//   delay: 始めるまでの待ち（ミリ秒）　fill: 終わったあと最後の形のままにするか
function fxAnim(el, frames, ms, easing = 'ease-out', delay = 0, fill = 'forwards') {
  if (!el.animate) return Promise.resolve();
  const anim = el.animate(frames, { duration: Math.max(1, fxMs(ms)), delay: fxMs(delay), easing, fill });
  const done = anim && anim.finished ? anim.finished.catch(() => {}) : Promise.resolve();
  return Promise.race([done, fxWait(ms + delay + 120)]);
}

// モンスターの色（カードの色）。光の弾や破片の色に使う
function fxColorOf(el) {
  try { return getComputedStyle(el).getPropertyValue('--c').trim() || '#60a5fa'; } catch (e) { return '#60a5fa'; }
}

// 光の粒が、まわりから中心に集まる（溜めの演出）
function fxGather(x, y, n, color, radius = 44, ms = 300) {
  if (fxReduced()) return;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const p = fxSpawn('fx-dot glow', x, y, '', ms + 200);
    p.style.setProperty('--oc', color);
    fxAnim(p, [
      { transform: `translate(calc(-50% + ${Math.cos(ang) * radius}px), calc(-50% + ${Math.sin(ang) * radius}px)) scale(1.1)`, opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 },
    ], ms, 'ease-in', i * 14);
  }
}

// 弧を描いて飛ぶ軌道。向きは軌道の接線に合わせる（自分の矢でも相手の矢でも、進む方向を向く）
//   dx, dy: 行き先までの差　bow: 弧のふくらみ
function fxArcFrames(dx, dy, bow, steps = 8) {
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;             // 進行方向に垂直な向き
  if (ny > 0) { nx = -nx; ny = -ny; }            // ふくらみは画面の上側へ（真上・真下に撃つときは横へ）
  const frames = [];
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, k = 4 * t * (1 - t), dk = 4 * (1 - 2 * t);
    const x = dx * t + nx * bow * k, y = dy * t + ny * bow * k;
    let ang = Math.atan2(dy + ny * bow * dk, dx + nx * bow * dk) * 180 / Math.PI;
    if (prev !== null) { while (ang - prev > 180) ang -= 360; while (ang - prev < -180) ang += 360; } // 途中でくるっと回らないように
    prev = ang;
    frames.push({ transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px)) rotate(${ang.toFixed(1)}deg)`, offset: t, x, y, ang });
  }
  return frames;
}

// 小さな粒を n 個、まわりに飛ばす
function fxParticles(x, y, n, cls, spread = 34, rise = 0) {
  if (fxReduced()) return;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const d = spread * (0.6 + Math.random() * 0.6);
    const p = fxSpawn('fx-dot ' + cls, x, y, '', 700);
    fxAnim(p, [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d - rise}px)) scale(0.3)`, opacity: 0 },
    ], 520 + Math.random() * 160);
  }
}

const FX_BOLT = '<svg viewBox="0 0 40 100"><path d="M24 0 L6 46 H18 L10 100 L34 40 H22Z" fill="#f5d0fe" stroke="#a21caf" stroke-width="3" stroke-linejoin="round"/></svg>';
// 矢：右が前。前に鏃（やじり）、後ろに矢羽根。後ろへ光の軌跡が伸びる
const FX_ARROW = '<svg viewBox="0 0 120 16"><defs><linearGradient id="fx-trail" x1="0" x2="1"><stop offset="0" stop-color="#fef9c3" stop-opacity="0"/><stop offset="1" stop-color="#fef9c3" stop-opacity=".85"/></linearGradient></defs>'
  + '<rect x="0" y="6.6" width="66" height="2.8" rx="1.4" fill="url(#fx-trail)"/>'
  + '<path d="M64 8 H108" stroke="#a16207" stroke-width="3" stroke-linecap="round"/>'
  + '<path d="M62 8 L57 2 H66 L71 8Z M62 8 L57 14 H66 L71 8Z" fill="#f8fafc" stroke="#64748b" stroke-width=".8" stroke-linejoin="round"/>'
  + '<path d="M70 8 L65 3.5 H72 L77 8Z M70 8 L65 12.5 H72 L77 8Z" fill="#fca5a5" stroke="#b91c1c" stroke-width=".6" stroke-linejoin="round"/>'
  + '<path d="M105 2.5 L119 8 L105 13.5 L108 8Z" fill="#e2e8f0" stroke="#1e293b" stroke-width="1" stroke-linejoin="round"/></svg>';
const FX_RUNES = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4"/><path d="M50 6 L88 72 H12Z M50 94 L12 28 H88Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const FX_SLASH = '<svg viewBox="0 0 100 100"><path d="M12 80 Q40 10 90 18 Q52 30 30 86Z" fill="#fff" opacity=".95"/><path d="M12 80 Q46 26 90 18" fill="none" stroke="#fca5a5" stroke-width="4" stroke-linecap="round"/></svg>';
const FX_VINE = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="vine" d="M6 86 Q30 60 12 44 Q-4 26 30 20 Q64 14 54 40 Q46 62 76 58 Q100 54 92 78 Q84 96 60 90" fill="none" stroke="#65a30d" stroke-width="6" stroke-linecap="round"/><path d="M30 20 l-6 -9 l10 3z M76 58 l8 -8 l2 10z M12 44 l-9 -4 l6 9z" fill="#bef264"/></svg>';

// ---------- 攻撃の演出（種類ごと）。着弾の瞬間に終わる ----------
// 溜め → 放つ → 着弾、の順。着弾したあとの演出（火花・揺れなど）は fxImpact が受け持つ。
async function fxAttack(type, aEl, tEl, ev) {
  sfx(type);
  if (!fxOn() || !aEl || !tEl) return;
  const A = fxCenter(aEl), T = fxCenter(tEl);
  if (fxReduced()) { aEl.classList.add('attacking'); await fxWait(260); return; }
  const dx = T.x - A.x, dy = T.y - A.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;

  if (type === 'magic') {
    // 足元に回る魔法陣 → 光の粒が集まる → 尾を引く光の弾。色はモンスターの色。アーマーは素通りする
    const color = fxColorOf(aEl);
    const ring = fxSpawn('fx-circle', A.x, A.y + A.h * 0.32, `<div class="fx-runes">${FX_RUNES}</div>`, 950);
    ring.style.setProperty('--oc', color);
    aEl.classList.add('casting');
    fxGather(A.x, A.y, 7, color);
    await fxCharge(340);
    if (ev.target.armor > 0) fxSpawn('fx-ghost-shield', T.x, T.y, ICON.shield, 620);
    const path = [
      { transform: 'translate(-50%, -50%) scale(0.5)' },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.15)` },
    ];
    for (let i = 3; i >= 1; i--) { // 尾：少し遅れて同じ道を追いかける、薄い光
      const tail = fxSpawn('fx-orb tail', A.x, A.y, '', 520);
      tail.style.setProperty('--oc', color);
      tail.style.opacity = 0.5 - i * 0.12;
      fxAnim(tail, path, 320, 'ease-in', i * 34);
    }
    const orb = fxSpawn('fx-orb', A.x, A.y, '', 520);
    orb.style.setProperty('--oc', color);
    await fxAnim(orb, path, 320, 'ease-in');
    orb.remove();
  } else if (type === 'chaos') {
    // 紫の渦 → ランダムな対象に雷が落ちる
    fxSpawn('fx-vortex', A.x, A.y, '', 760);
    aEl.classList.add('casting');
    fxGather(A.x, A.y, 5, '#e879f9', 38);
    await fxCharge(330);
    fxSpawn('fx-bolt', T.x, T.y - T.h * 0.2, FX_BOLT, 380);
    fxSpawn('fx-flash', T.x, T.y, '', 300);
    await fxWait(120);
  } else if (type === 'ranged') {
    // 弓を引き絞る（後ろへ下がって溜める）→ 矢が弧を描いて飛ぶ。矢は進む方向を向き、後ろに光の軌跡を引く
    fxAnim(aEl, [
      { transform: 'none' },
      { transform: `translate(${-ux * 9}px, ${-uy * 9}px) scale(0.96)`, filter: 'brightness(1.25)', offset: 0.7 },
      { transform: `translate(${ux * 5}px, ${uy * 5}px)`, offset: 0.86 },
      { transform: 'none' },
    ], FX.speed === 1 ? 420 : 260, 'ease-out', 0, 'none');
    const bowEl = fxSpawn('fx-bow', A.x + ux * 14, A.y + uy * 14, '', 420);
    bowEl.style.setProperty('--rot', `${Math.atan2(uy, ux) * 180 / Math.PI}deg`);
    await fxCharge(300);
    const frames = fxArcFrames(dx, dy, Math.min(56, len * 0.22));
    const arrow = fxSpawn('fx-arrow', A.x, A.y, FX_ARROW, 1400);
    await fxAnim(arrow, frames.map(f => ({ transform: f.transform, offset: f.offset })), 360, 'linear');
    const end = frames[frames.length - 1];
    const at = (x, y, ang) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${ang}deg)`;
    if (ev.blocked) {
      // 盾に弾かれて、回転しながら落ちる
      fxSpawn('fx-shield-flash', T.x, T.y, ICON.shield, 480);
      fxAnim(arrow, [
        { transform: at(end.x, end.y, end.ang), opacity: 1 },
        { transform: at(end.x - ux * 30, end.y - uy * 30 - 18, end.ang + 260), opacity: 1, offset: 0.45 },
        { transform: at(end.x - ux * 40, end.y - uy * 40 + 58, end.ang + 620), opacity: 0 },
      ], 520, 'ease-in');
    } else if (ev.dodged) {
      // かわされた矢は、そのまま通り過ぎて消える
      fxAnim(arrow, [{ transform: at(end.x, end.y, end.ang), opacity: 1 }, { transform: at(end.x + ux * 70, end.y + uy * 70, end.ang), opacity: 0 }], 200, 'linear');
    } else {
      // 刺さって、少し震えてから消える
      arrow.classList.add('stuck');
      fxAnim(arrow, [
        { transform: at(end.x, end.y, end.ang), opacity: 1 },
        { transform: at(end.x, end.y, end.ang + 7), opacity: 1, offset: 0.15 },
        { transform: at(end.x, end.y, end.ang - 5), opacity: 1, offset: 0.3 },
        { transform: at(end.x, end.y, end.ang), opacity: 1, offset: 0.45 },
        { transform: at(end.x, end.y, end.ang), opacity: 1, offset: 0.75 },
        { transform: at(end.x, end.y, end.ang), opacity: 0 },
      ], 460, 'ease-out');
    }
  } else {
    // 近接：少し引いてから大きく踏み込み、斬撃の光の弧を描く。大ダメージは弧が大きい
    const reach = Math.min(64, len * 0.42);
    const big = fxBigHit(ev);
    aEl.classList.add('striking');
    fxAnim(aEl, [
      { transform: 'none' },
      { transform: `translate(${-ux * 12}px, ${-uy * 12}px) scale(0.97)`, offset: 0.22 },
      { transform: `translate(${ux * reach}px, ${uy * reach}px) scale(1.16)`, offset: 0.5 },
      { transform: `translate(${ux * reach * 0.9}px, ${uy * reach * 0.9}px) scale(1.12)`, offset: 0.68 },
      { transform: 'none' },
    ], FX.speed === 1 ? 520 : 420, 'ease-in-out', 0, 'none');
    await fxCharge(250);
    const slash = fxSpawn('fx-slash' + (big ? ' big' : ''), T.x, T.y, FX_SLASH, 360);
    slash.style.setProperty('--rot', `${Math.atan2(uy, ux) * 180 / Math.PI + 90}deg`);
    await fxWait(40);
  }
}

// 大ダメージ（5以上）かどうか。揺れやエフェクトを大きくする
function fxBigHit(ev) { return (ev.dmg || 0) + (ev.armorDmg || 0) >= 5 || !!ev.killed; }

// 命中した瞬間の演出。近接はヒットストップ（一瞬だけ止める）の時間を待ってから返る
async function fxImpact(type, aEl, tEl, ev) {
  if (!fxOn() || !tEl) return;
  const T = fxCenter(tEl);
  const big = fxBigHit(ev);
  if (fxReduced()) return;
  const A = aEl ? fxCenter(aEl) : { x: T.x, y: T.y + 1 };
  const len = Math.hypot(T.x - A.x, T.y - A.y) || 1;
  const ux = (T.x - A.x) / len, uy = (T.y - A.y) / len;
  if (type === 'magic') {
    // 光が大きく弾け、波紋が広がる
    const color = aEl ? fxColorOf(aEl) : '#60a5fa';
    for (const [cls, delay] of [['fx-burst magic', 0], ['fx-ripple', 0], ['fx-ripple', 130]]) {
      const el = fxSpawn(cls, T.x, T.y, '', 620 + delay);
      el.style.setProperty('--oc', color);
      el.style.animationDelay = `${fxMs(delay)}ms`;
    }
    fxParticles(T.x, T.y, big ? 10 : 7, 'magic', big ? 52 : 40);
  } else if (type === 'ranged') {
    // 火花が散り、カードが少し後ろに押される
    fxParticles(T.x, T.y, big ? 9 : 6, 'spark', big ? 46 : 34);
    fxAnim(tEl, [{ transform: 'none' }, { transform: `translate(${ux * 10}px, ${uy * 10}px)`, offset: 0.3 }, { transform: 'none' }], 260, 'ease-out', 0, 'none');
  } else if (type === 'melee') {
    // 画面が一瞬白く光って揺れる。大ダメージは大きく
    const a = document.querySelector('#app').getBoundingClientRect();
    fxSpawn('fx-white' + (big ? ' big' : ''), a.width / 2, a.height / 2, '', 260);
    fxShake(big);
    fxParticles(T.x, T.y, big ? 9 : 5, 'spark', big ? 50 : 34);
    await fxWait(big ? 110 : 60); // ヒットストップ
  }
}

// ---------- 命中・状態の演出 ----------

// 強い攻撃で画面が少し揺れる
//   big: 大ダメージのときは大きく揺れる
function fxShake(big) {
  if (!fxOn() || fxReduced()) return;
  const el = document.querySelector('#screen-battle');
  el.classList.remove('shake', 'shake-big');
  void el.offsetWidth; // アニメーションをやり直す
  el.classList.add(big === true ? 'shake-big' : 'shake');
  setTimeout(() => el.classList.remove('shake', 'shake-big'), fxMs(big === true ? 420 : 320) + 40);
}

// アーマー破壊：盾が割れて破片が飛ぶ
function fxShieldBreak(el) {
  sfx('break');
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  // 盾が左右に割れて、破片が飛ぶ。「BREAK」の文字
  fxSpawn('fx-shield-crack left', c.x, c.y + c.h * 0.1, ICON.shield, 520);
  fxSpawn('fx-shield-crack right', c.x, c.y + c.h * 0.1, ICON.shield, 520);
  fxParticles(c.x, c.y + c.h * 0.1, 7, 'shard', 44);
  fxSpawn('fx-text break', c.x, c.y - c.h * 0.28, 'BREAK', 900);
}

// Flying の回避：ひらりとかわして残像と「MISS」
function fxMiss(el) {
  sfx('dodge');
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  if (!fxReduced()) {
    el.classList.add('dodging');
    fxSpawn('fx-afterimage', c.x, c.y, '', 380).style.cssText += `width:${c.w}px;height:${c.h}px;`;
  }
  fxSpawn('fx-text miss', c.x, c.y - c.h * 0.1, 'MISS', 800);
}

// Thorns：トゲが光る
function fxThorns(el) {
  sfx('thorns');
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  fxSpawn('fx-thorns', c.x, c.y, '', 420);
}

// Heal：緑の光の粒が上に昇る
function fxHeal(el) {
  sfx('heal');
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  fxSpawn('fx-burst heal', c.x, c.y, '', 520);
  fxParticles(c.x, c.y + c.h * 0.2, 6, 'heal', 26, 46);
}

// Disease：紫の泡がまとわりつく
function fxDisease(el) {
  sfx('disease');
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  fxParticles(c.x, c.y, 5, 'bubble', 30, 18);
}

// Outbreak：泡が弾ける
function fxOutbreak(el) {
  sfx('outbreak');
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  fxSpawn('fx-burst outbreak', c.x, c.y, '', 460);
  fxParticles(c.x, c.y, 8, 'bubble', 48);
}

// Entangle：ツタが巻き付く
function fxEntangle(el, success) {
  sfx(success ? 'entangle' : 'dodge');
  if (!fxOn() || !el || !success) return;
  const c = fxCenter(el);
  fxSpawn('fx-vine', c.x, c.y, FX_VINE, 900).style.cssText += `width:${c.w}px;height:${c.h}px;`;
}

// Silence：口元に×印
function fxSilence(el) {
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  fxSpawn('fx-mute', c.x, c.y - c.h * 0.12, '×', 900);
}

// Inspire・Shoot Command など：全員が一瞬光る
function fxGlow(els, kind) {
  if (!fxOn()) return;
  els.forEach(el => {
    if (!el) return;
    const c = fxCenter(el);
    fxSpawn('fx-glow ' + kind, c.x, c.y, '', 620).style.cssText += `width:${c.w}px;height:${c.h}px;`;
  });
}

// 撃破：カードが光の粒になって消える
function fxDeath(el) {
  sfx('death');
  if (!el) return;
  el.classList.add('dying');
  fxFallenCrystal(el);
  if (!fxOn()) return;
  const c = fxCenter(el);
  if (fxReduced()) return;
  // カードが割れて破片が飛び、光の粒になって昇っていく
  const color = fxColorOf(el);
  for (let i = 0; i < 7; i++) {
    const ang = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
    const d = 30 + Math.random() * 34;
    const piece = fxSpawn('fx-piece', c.x + Math.cos(ang) * c.w * 0.18, c.y + Math.sin(ang) * c.h * 0.18, '', 760);
    piece.style.setProperty('--oc', color);
    fxAnim(piece, [
      { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d + 26}px)) rotate(${(Math.random() - 0.5) * 420}deg) scale(0.5)`, opacity: 0 },
    ], 560 + Math.random() * 140, 'ease-out');
  }
  fxParticles(c.x, c.y, 9, 'light', 44, 52);
}

// 消耗ダメージ：画面の端が赤く燃える
function fxAttrition() {
  sfx('burn');
  if (!fxOn()) return;
  const a = document.querySelector('#app').getBoundingClientRect();
  fxSpawn('fx-burn', a.width / 2, a.height / 2, '', 1000);
}

// 生贄：カードが炎に包まれて消える
async function fxSacrifice(el) {
  sfx('sacrifice');
  if (!fxOn() || !el) return;
  const c = fxCenter(el);
  fxSpawn('fx-flame', c.x, c.y, '', 620).style.cssText += `width:${c.w}px;height:${c.h}px;`;
  el.classList.add('burning');
  fxParticles(c.x, c.y, 6, 'ember', 30, 50);
  await fxWait(520);
}

// クリスタルが増えた表示（プレイヤー情報の宝石のそば）
// 倒されたモンスターから、持ち主のクリスタル表示へクリスタルが飛んでいき、「+1」が出る
//   el: 倒されたモンスターの要素（どちらの場にいるかで持ち主を決める。Phantom の分身は対象外）
function fxFallenCrystal(el) {
  const n = typeof CONFIG === 'undefined' ? 0 : CONFIG.FALLEN_CRYSTAL;
  const field = n && el.closest ? el.closest('#field-0, #field-1') : null;
  if (!field || (el.classList.contains && el.classList.contains('phantom'))) return;
  const info = document.querySelector(field.id === 'field-0' ? '#info-0' : '#info-1');
  const gem = info && info.querySelector('.crystal');
  if (!gem) return;
  if (!fxOn() || fxReduced()) { fxCrystalGain(info, n); return; }
  const from = fxCenter(el), to = fxCenter(gem);
  const fly = fxSpawn('fx-gem', from.x, from.y, '💎', 900);
  fxAnim(fly, [
    { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
    { transform: 'translate(-50%, -90%) scale(1.25)', opacity: 1, offset: 0.25 },
    { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(0.7)`, opacity: 1 },
  ], 620, 'cubic-bezier(.5,0,.3,1)', 180);
  setTimeout(() => fxCrystalGain(info, n), fxMs(800));
}

function fxCrystalGain(infoEl, n) {
  sfx('gem');
  if (!fxOn() || !infoEl) return;
  const gem = infoEl.querySelector('.crystal');
  if (!gem) return;
  const c = fxCenter(gem);
  fxSpawn('fx-text gain', c.x, c.y - 6, `+${n}`, 900);
  gem.classList.add('pop');
  setTimeout(() => gem.classList.remove('pop'), fxMs(400) + 40);
}

// ダメージ数字がスロットのように回ってから止まる（カオス用）
function fxSpinNumber(el, finalText) {
  if (!fxOn() || fxReduced()) { el.textContent = finalText; return; }
  let n = 0;
  const timer = setInterval(() => {
    el.textContent = '-' + (1 + Math.floor(Math.random() * 9));
    if (++n >= 7) { clearInterval(timer); el.textContent = finalText; el.classList.add('settle'); }
  }, Math.max(20, fxMs(55)));
}

// ---------- 効果音（Web Audio API で合成） ----------

let fxAudio = null;
const FX_VOLUME = 1.8;   // 全体の音量。合成した音は小さめなので持ち上げ、下のリミッターで割れを防ぐ
const FX_LATE_MS = 250;  // 音の準備がこれより遅れたら、その音は鳴らさない（後からまとめて鳴るのを防ぐ）

// 音の出口（音量 → リミッター → スピーカー）を作って、音量のノードを返す
function fxAudioChain(ctx) {
  const master = ctx.createGain();
  master.gain.value = FX_VOLUME;
  let out = master;
  if (ctx.createDynamicsCompressor) {
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12;
    lim.attack.value = 0.002; lim.release.value = 0.12;
    master.connect(lim);
    out = lim;
  }
  out.connect(ctx.destination);
  return master;
}

function fxAudioCtx() {
  if (FX.mute || typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!fxAudio) {
    const ctx = new AC();
    fxAudio = { ctx, master: fxAudioChain(ctx) };
  }
  return fxAudio;
}

// 止まっている音の出口を動かす。動いていれば null、そうでなければ Promise を返す
function fxResume() {
  const ctx = fxAudio && fxAudio.ctx;
  if (!ctx || ctx.state === 'running') return null;
  try {
    const p = ctx.resume();
    return p && p.then ? p : null;
  } catch (e) { return null; }
}

// ブラウザ（特に Safari）は、クリックやキー操作の「その瞬間」に始めた音しか鳴らさない。
// 対戦中の音は演出の途中（操作の瞬間ではない）で鳴るので、最初の操作で音の出口を用意して動かしておく
function fxUnlock() {
  const a = fxAudioCtx();
  if (!a || a.ctx.state === 'running') return;
  const p = fxResume();
  if (p) p.catch(() => {});
  try { // 無音を一瞬鳴らす（古い Safari はこれで音が出るようになる）
    const src = a.ctx.createBufferSource();
    src.buffer = a.ctx.createBuffer(1, 1, a.ctx.sampleRate);
    src.connect(a.ctx.destination);
    src.start(0);
  } catch (e) { /* 鳴らせなくても続ける */ }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  for (const ev of ['pointerdown', 'mousedown', 'touchend', 'keydown', 'click']) document.addEventListener(ev, fxUnlock, true);
  // 別のタブやアプリから戻ったとき、止められた音を動かし直す
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { const p = fxResume(); if (p) p.catch(() => {}); } });
}

// 音程のある音。slide は終わりの周波数との差
function fxTone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0 } = {}) {
  const a = fxAudio, t = a.ctx.currentTime + delay;
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ノイズ（風切り・打撃・破片など）。フィルターの周波数を動かして表情を付ける
function fxNoise(dur, { vol = 0.25, freq = 1200, slide = 0, q = 1, type = 'bandpass', delay = 0 } = {}) {
  const a = fxAudio, t = a.ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(a.ctx.sampleRate * dur));
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource(), f = a.ctx.createBiquadFilter(), g = a.ctx.createGain();
  src.buffer = buf;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.master);
  src.start(t);
}

// 音の一覧。攻撃の種類ごとに、はっきり違う音にしている
const SFX = {
  melee:  () => { fxNoise(0.14, { freq: 2400, slide: -1900, vol: 0.3 }); fxTone(120, 0.2, { type: 'triangle', vol: 0.35, slide: -70, delay: 0.1 }); },
  ranged: () => { fxTone(520, 0.07, { type: 'triangle', vol: 0.2, slide: 260 }); fxNoise(0.26, { freq: 3200, slide: -2200, q: 4, vol: 0.18, delay: 0.04 }); fxTone(180, 0.08, { type: 'square', vol: 0.12, delay: 0.36 }); },
  magic:  () => { [523, 659, 784, 1047].forEach((f, i) => fxTone(f, 0.16, { vol: 0.14, delay: i * 0.06 })); fxTone(1568, 0.3, { vol: 0.1, delay: 0.5, slide: -600 }); },
  chaos:  () => { fxTone(90, 0.34, { type: 'sawtooth', vol: 0.16, slide: 160 }); fxTone(97, 0.34, { type: 'sawtooth', vol: 0.16, slide: 120 }); fxNoise(0.3, { freq: 500, slide: 2400, vol: 0.3, delay: 0.3, type: 'lowpass' }); },
  hit:    () => { fxNoise(0.08, { freq: 700, vol: 0.5 }); fxTone(160, 0.08, { type: 'triangle', vol: 0.2, slide: -80 }); },
  block:  () => { fxTone(1400, 0.1, { type: 'square', vol: 0.12 }); fxTone(2100, 0.16, { type: 'triangle', vol: 0.12, delay: 0.02 }); },
  break:  () => { fxNoise(0.22, { freq: 3800, slide: -1500, q: 2, vol: 0.3 }); fxTone(900, 0.12, { type: 'square', vol: 0.1, slide: -500 }); },
  dodge:  () => { fxNoise(0.2, { freq: 600, slide: 2600, q: 3, vol: 0.5 }); fxTone(500, 0.16, { vol: 0.08, slide: 700 }); },
  thorns: () => { fxTone(880, 0.06, { type: 'square', vol: 0.12 }); fxTone(660, 0.1, { type: 'square', vol: 0.12, delay: 0.05 }); },
  heal:   () => { [660, 880, 1320].forEach((f, i) => fxTone(f, 0.22, { vol: 0.12, delay: i * 0.08 })); },
  buff:   () => { [392, 494, 587].forEach(f => fxTone(f, 0.3, { type: 'triangle', vol: 0.1 })); },
  debuff: () => { fxTone(300, 0.3, { type: 'sawtooth', vol: 0.1, slide: -160 }); },
  disease: () => { [300, 420, 360].forEach((f, i) => fxTone(f, 0.07, { vol: 0.14, slide: 200, delay: i * 0.07 })); },
  outbreak: () => { fxNoise(0.2, { freq: 400, slide: 1600, vol: 0.28, type: 'lowpass' }); fxTone(200, 0.2, { type: 'sawtooth', vol: 0.14, slide: -120 }); },
  entangle: () => { fxTone(140, 0.3, { type: 'sawtooth', vol: 0.12, slide: 120 }); fxNoise(0.25, { freq: 900, q: 6, vol: 0.1 }); },
  silence: () => { fxTone(220, 0.25, { vol: 0.16, slide: -140 }); },
  death:  () => { fxTone(440, 0.4, { type: 'triangle', vol: 0.16, slide: -330 }); fxNoise(0.3, { freq: 2000, slide: -1500, vol: 0.12 }); },
  burn:   () => { fxNoise(0.7, { freq: 500, slide: 900, vol: 0.25, type: 'lowpass' }); fxTone(70, 0.6, { type: 'sawtooth', vol: 0.14 }); },
  sacrifice: () => { fxNoise(0.4, { freq: 700, slide: 2400, vol: 0.4, type: 'lowpass' }); },
  gem:    () => { fxTone(1320, 0.08, { vol: 0.14 }); fxTone(1760, 0.14, { vol: 0.14, delay: 0.07 }); },
  summon: () => { fxTone(196, 0.14, { type: 'triangle', vol: 0.2 }); fxTone(294, 0.2, { type: 'triangle', vol: 0.16, delay: 0.06 }); },
  equip:  () => { fxTone(700, 0.05, { type: 'square', vol: 0.1 }); fxTone(1050, 0.1, { type: 'square', vol: 0.1, delay: 0.05 }); },
  flash:  () => { fxNoise(0.18, { freq: 1500, slide: 2500, vol: 0.14 }); fxTone(880, 0.2, { vol: 0.12, slide: 400 }); },
  turn:   () => { fxTone(330, 0.3, { type: 'triangle', vol: 0.14 }); fxTone(440, 0.4, { type: 'triangle', vol: 0.12, delay: 0.1 }); },
  tap:    () => { fxTone(900, 0.05, { type: 'triangle', vol: 0.12 }); },
  win:    () => { [523, 659, 784, 1047, 1319].forEach((f, i) => fxTone(f, 0.3, { type: 'triangle', vol: 0.16, delay: i * 0.11 })); },
  lose:   () => { [392, 330, 262, 196].forEach((f, i) => fxTone(f, 0.36, { type: 'triangle', vol: 0.16, delay: i * 0.16 })); },
};

function sfx(name) {
  const a = SFX[name] ? fxAudioCtx() : null;
  if (!a) return;
  const play = () => { try { SFX[name](); } catch (e) { /* 音が出せない環境では黙って続ける */ } };
  if (a.ctx.state === 'running') { play(); return; }
  // まだ音の出口が動いていない：動かしてから鳴らす。遅れすぎた音は捨てる
  const at = Date.now();
  const p = fxResume();
  if (p) p.then(() => { if (a.ctx.state === 'running' && Date.now() - at < FX_LATE_MS) play(); }, () => {});
}

fxLoadSettings();
