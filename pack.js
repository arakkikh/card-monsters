// ============================================================
// パック開封の演出と、カードの傾き・光沢（ホログラム）
//   流れ：パックが浮かぶ → パックをタップ、または上部を横になぞって破る → 裏向きの束 → 1枚ずつタップでめくる → 一覧
//   パックの見た目（色・模様・紋章）と開封時の光の色は、パックの種類（packs.js）で変わる。
//   演出を出さない設定（スキップ）や画面のない環境では、すぐ一覧を出す（meta.js 側）。
// ============================================================

const HOLO_SCALE = { big: 2.4, small: 1.7 };

// パックの中でいちばん高いレアリティ（パックの光り方に使う）
function packBestRarity(pulls) {
  return pulls.map(p => CARD_DEFS[p.id].rarity).sort((a, b) => RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(a))[0];
}

// 大きく見せるカード。指やマウスの位置に合わせて傾き、表面の光沢が動く（レア以上で強く光る）
function holoCardHtml(card, { isNew = false, size = 'big' } = {}) {
  return `<div class="holo-card hr-${card.rarity || 'common'}" style="--k:${HOLO_SCALE[size]}">
    <div class="holo-in">
      ${cardFaceHtml(card, { cls: 'owned' })}
      <div class="holo-shine"></div>
      <div class="holo-glare"></div>
    </div>
    ${isNew ? '<span class="pk-new">NEW</span>' : ''}
  </div>`;
}

// ポインターの位置に合わせて、見えている大きなカードを傾ける
function holoMove(e) {
  if (fxReduced()) return;
  document.querySelectorAll('.holo-card').forEach(card => {
    const r = card.getBoundingClientRect();
    if (!r.width || card.closest('.pk-card:not(.flipped)')) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    card.style.setProperty('--ry', `${(nx - 0.5) * 28}deg`);
    card.style.setProperty('--rx', `${(0.5 - ny) * 22}deg`);
    card.style.setProperty('--mx', `${nx * 100}%`);
    card.style.setProperty('--my', `${ny * 100}%`);
    card.classList.add('tilting');
  });
}

function holoReset() {
  document.querySelectorAll('.holo-card.tilting').forEach(card => {
    card.classList.remove('tilting');
    ['--rx', '--ry'].forEach(v => card.style.setProperty(v, '0deg'));
    ['--mx', '--my'].forEach(v => card.style.setProperty(v, '50%'));
  });
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('pointermove', holoMove);
  document.addEventListener('pointerleave', holoReset);
  document.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') holoReset(); });
}

// カードの裏面とパックの絵
const PACK_EMBLEM = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,6 86,36 50,94 14,36" fill="#38bdf8" stroke="#e0f2fe" stroke-width="3"/><polygon points="50,6 86,36 50,40" fill="#bae6fd"/><polygon points="50,6 14,36 50,40" fill="#7dd3fc"/><polygon points="14,36 50,40 50,94" fill="#0ea5e9"/><polygon points="86,36 50,40 50,94" fill="#0369a1"/></svg>';
const CARD_BACK = `<div class="pk-back-in"><div class="pk-back-ring">${PACK_EMBLEM}</div></div>`;

// パックの絵（種類ごとに、色・模様・紋章が違う）。size: 'big'（開封画面）| 'mini'（一覧）
function packArtHtml(typeId, size = 'big', count = 0) {
  const t = packType(typeId) || packType('normal');
  const kind = t.hero ? 'hero' : t.event ? 'event' : t.color ? 'color' : t.id;
  const emblem = t.hero ? `<div class="pk-emblem hero">${heroArt(HERO_BY_ID[t.hero])}</div>`
    : t.id === 'normal' ? `<div class="pk-emblem">${PACK_EMBLEM}</div>`
      : `<div class="pk-emblem mark"><span>${t.mark}</span></div>`;
  const gems = t.id === 'premium' ? '<i class="pk-gem g1"></i><i class="pk-gem g2"></i><i class="pk-gem g3"></i>' : '';
  return `<div class="pk-pack pk-${size} pk-kind-${kind}" style="--pk1:${t.hue};--pk2:${t.hue2}">
      <div class="pk-top">${size === 'big' ? '<span>▶ なぞる ▶</span>' : ''}</div>
      <div class="pk-body">${gems}${emblem}<div class="pk-title">${size === 'big' ? t.name.replace('のパック', '<br>パック').replace(/^(通常|高級|モンスター|アイテム)パック$/, '$1<br>パック') : ''}</div>${size === 'big' && count ? `<div class="pk-count">${count}枚入り</div>` : ''}</div>
      ${size === 'big' ? '<div class="pk-trail"></div>' : ''}
    </div>`;
}

const PACK_TAP_MOVE = 10; // これ以上指が動いたら「なぞった」とみなす（タップ扱いにしない）

// パック開封の演出を最後まで流す。終わったら（またはスキップで）解決する。typeId: パックの種類（見た目と光の色）
function runPackOpening(pulls, typeId = 'normal') {
  const type = packType(typeId) || packType('normal');
  return new Promise(resolve => {
    const stage = document.querySelector('#pack-stage');
    const best = packBestRarity(pulls);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      stage.className = '';
      stage.innerHTML = '';
      resolve();
    };

    // ---- 1. パックが中央に浮かんで、ゆっくり回る ----
    stage.className = 'show';
    stage.style.setProperty('--pk-glow', type.hue); // 開封時の光の色は、パックの種類に合わせる
    stage.innerHTML = `
      <div class="pk-rays"></div>
      <div class="pk-hint">タップ または なぞって開封</div>
      <div class="pk-area">${packArtHtml(type.id, 'big', pulls.length)}</div>
      <div class="pk-foot">
        <button class="btn small" data-pk="skip">スキップ</button>
      </div>`;
    const pack = stage.querySelector('.pk-pack');
    const trail = stage.querySelector('.pk-trail');
    const hint = stage.querySelector('.pk-hint');
    let swipe = null, torn = false;
    let press = null;   // 押し始めた位置（タップかどうかの判定用）
    let swiped = false; // その押下のあいだに、なぞる動きがあったか

    // ---- 2. 上部を横になぞると、線に沿って光が走り、パックが破れる ----
    //   how: 'swipe'（なぞった：今までどおり）| 'tap'（タップした：光って震えてから破れる。短め）
    const tear = (how = 'swipe') => {
      if (torn) return;
      torn = true;
      stage.classList.add('glow-' + best); // 中に高レアリティがあると、光が強くなる（金や虹色）
      hint.textContent = '';
      if (how === 'tap') {
        pack.classList.add('tapped'); // 光って震える
        sfx('flash');
        setTimeout(() => { sfx('break'); pack.classList.add('torn', 'quick'); }, fxMs(240));
        setTimeout(showPile, fxMs(240 + 380));
        return;
      }
      sfx('break'); sfx('flash');
      pack.classList.add('torn');
      setTimeout(showPile, fxMs(620));
    };
    pack.addEventListener('pointerdown', e => {
      if (torn) return;
      press = { x: e.clientX, y: e.clientY };
      swiped = false;
      const r = pack.getBoundingClientRect();
      if (e.clientY - r.top > r.height * 0.45) return; // 上のほうだけ
      swipe = { x: e.clientX, left: r.left, width: r.width };
      pack.classList.add('held');
      if (pack.setPointerCapture) { try { pack.setPointerCapture(e.pointerId); } catch (err) { /* 対応していなくても続ける */ } }
    });
    pack.addEventListener('pointermove', e => {
      if (!swipe || torn) return;
      const dx = e.clientX - swipe.x;
      if (Math.abs(dx) > PACK_TAP_MOVE) swiped = true;
      const from = Math.min(swipe.x, e.clientX) - swipe.left;
      trail.style.left = Math.max(0, from) + 'px';
      trail.style.width = Math.min(swipe.width, Math.abs(dx)) + 'px';
      trail.style.opacity = 1;
      if (Math.abs(dx) >= swipe.width * 0.55) tear();
    });
    const release = () => {
      if (torn) return;
      swipe = null;
      pack.classList.remove('held');
      trail.style.opacity = 0;
      trail.style.width = '0px';
    };
    pack.addEventListener('pointerup', release);
    pack.addEventListener('pointercancel', release);
    // パックの絵をタップ（クリック）でも開ける。なぞる途中で指を離したときは、タップ扱いにしない
    pack.addEventListener('click', e => {
      if (torn) return;
      const moved = press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > PACK_TAP_MOVE;
      const wasSwipe = swiped || moved;
      press = null; swiped = false;
      if (!wasSwipe) tear('tap');
    });

    // ---- 3. カードが裏向きで重なって出てくる。めくる前から、レアリティに応じて縁が光る ----
    let top = 0; // いちばん上のカード
    function showPile() {
      if (done) return;
      const cards = pulls.map((p, i) => {
        const c = ownedCard(profile, p.id);
        return `<div class="pk-card hr-${c.rarity}" data-i="${i}" style="--i:${i}">
          <div class="pk-flip">
            <div class="pk-back">${CARD_BACK}</div>
            <div class="pk-front">${holoCardHtml(c, { isNew: p.isNew })}</div>
          </div>
        </div>`;
      }).join('');
      stage.querySelector('.pk-area').innerHTML = `<div class="pk-pile">${cards}</div>`;
      hint.textContent = 'タップでめくる';
      stage.classList.add('pile');
      sfx('summon');
    }

    // ---- 4. 1枚ずつタップでめくる。もう一度タップで次のカードへ ----
    function tapPile() {
      const el = stage.querySelector(`.pk-card[data-i="${top}"]`);
      if (!el) return;
      if (!el.classList.contains('flipped')) {
        const rarity = CARD_DEFS[pulls[top].id].rarity;
        el.classList.add('flipped');
        stage.classList.remove('rev-epic', 'rev-legend');
        void stage.offsetWidth;
        // 高レアリティは特別演出：エピックは金の光が広がり、レジェンドは暗転して虹色の光とともに登場
        if (rarity === 'legend') { stage.classList.add('rev-legend'); sfx('win'); }
        else if (rarity === 'epic') { stage.classList.add('rev-epic'); sfx('buff'); }
        else sfx(rarity === 'rare' ? 'gem' : 'equip');
        hint.textContent = top === pulls.length - 1 ? 'タップで一覧へ' : 'タップで次のカードへ';
      } else {
        el.classList.add('gone');
        holoReset();
        stage.classList.remove('rev-epic', 'rev-legend');
        top++;
        if (top >= pulls.length) setTimeout(finish, fxMs(260));
        else { hint.textContent = 'タップでめくる'; sfx('tap'); }
      }
    }

    stage.onclick = e => {
      const btn = e.target.closest('[data-pk]');
      if (btn && btn.dataset.pk === 'skip') { finish(); return; } // 一気にめくって一覧へ
      if (stage.classList.contains('pile') && e.target.closest('.pk-pile')) tapPile();
    };
  });
}
