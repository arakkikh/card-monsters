// ============================================================
// ダンジョンの画面（しくみは dungeon.js）
//   1歩ごとにセーブするので、途中で閉じても続きから再開できる（戦闘中なら、その戦闘の最初から）。
// ============================================================

let dgSel = { hero: null, skill: 0, trial: 0 }; // 開始前に選んでいるヒーロー・スキル・試練
let dgReplace = null;                            // 枠がいっぱいのとき：入れ替える相手を選んでいる { from: 'step' | 'shop', id, index }

const dgRun = () => profile.dungeon.run;
const dgSave = () => { saveProfile(profile); };
const dgCard = (run, id) => cardAt(id, run ? runLevel(run, id) : 1);
const dgCardHtml = (run, id, attrs = '', extra = '') => cardFaceHtml(dgCard(run, id), { attrs: `data-id="${id}" data-lv="${run ? runLevel(run, id) : 1}" ${attrs}`, extra });
const charmChipHtml = (id, attrs = '') => `<span class="charm" ${attrs} data-charm="${id}" title="${CHARM_BY_ID[id].name}：${CHARM_BY_ID[id].desc}">${CHARM_BY_ID[id].icon}</span>`;
const livesHtml = run => '❤️'.repeat(run.lives) + '🖤'.repeat(Math.max(0, run.maxLives - run.lives));

function dungeonButtonText() {
  const d = profile.dungeon;
  if (d.run) { const pl = runPlace(d.run); return `ダンジョン（挑戦中：${pl.chapter}章　命${d.run.lives}）`; }
  return `ダンジョン${d.clears ? `（クリア${d.clears}回　試練${d.maxTrial}まで解放）` : d.best.floor ? `（最高 ${d.best.floor}マス）` : ''}`;
}

function openDungeon() {
  hideOverlay();
  dgReplace = null;
  showScreen('dungeon');
  renderDungeon();
}

// ---------- 開始前 ----------

function renderDungeonStart() {
  const d = profile.dungeon;
  if (!dgSel.hero || !heroSkillUnlocked(profile, dgSel.hero, dgSel.skill)) dgSel = { hero: profile.hero.selected, skill: profile.hero.skill, trial: Math.min(dgSel.trial || 0, d.maxTrial) };
  dgSel.trial = Math.min(dgSel.trial, d.maxTrial);
  $('#dg-title').textContent = 'ダンジョン';
  $('#btn-dg-quit').classList.toggle('gone', true);
  $('#dg-status').innerHTML = '';
  const heroes = HEROES.filter(h => profile.hero.unlocked.includes(h.id)).map(h => {
    const skills = h.skills.map((k, i) => {
      const open = heroSkillUnlocked(profile, h.id, i);
      const on = dgSel.hero === h.id && dgSel.skill === i;
      return `<button class="btn${on ? ' on' : ''}" data-dg="hero" data-hero="${h.id}" data-skill="${i}" ${open ? '' : 'disabled'}><b>${k.name}</b><small>${open ? k.desc : `ヒーローLv${HERO_RULES.SKILL_LEVELS[i]}で解放`}</small></button>`;
    }).join('');
    return `<div class="dk-hero-row"><div class="dk-hero-head"><span class="dk-hero">${heroArt(h)}</span><b>${h.name}</b><small class="c-${h.color} color-name">${COLORS[h.color].name}</small></div>${skills}</div>`;
  }).join('');
  const trials = [...Array(d.maxTrial + 1)].map((x, t) => `<button class="btn small${dgSel.trial === t ? ' on' : ''}" data-dg="trial" data-trial="${t}">${t ? `試練${t}` : '通常'}</button>`).join('');
  const trialNote = dgSel.trial ? `<ul class="dg-list">${DUNGEON_TRIALS.slice(0, dgSel.trial).map(t => `<li>${t.desc}</li>`).join('')}</ul><p class="dk-hint">持ち帰れる報酬 +${Math.round(100 * DUNGEON.REWARD.trialBonus * dgSel.trial)}%</p>` : '';
  const last = d.lastClear;
  $('#dg-body').innerHTML = `
    <div class="dg-panel">
      <p>全${DUNGEON.CHAPTERS}章のダンジョンを、<b>ダンジョンの中だけのデッキ</b>で進みます。手持ちのカードは使いません。最初はモンスター${DUNGEON.START_MONSTERS}枚＋アイテム${DUNGEON.START_ITEMS}枚で、勝つたびにカードが増えます。</p>
      <p>命は${DUNGEON.LIVES}つ。戦闘に負けると1つ減り、0になると終わりです。終わったときに、進んだマスの数に応じてゴールドと魔石を持ち帰れます（カードは持ち帰れません）。</p>
      <p class="dg-record">最高記録：${d.best.floor ? `${d.best.floor} / ${DUNGEON.CHAPTERS * DUNGEON.ROWS} マス${d.best.cleared ? '（クリア）' : ''}${d.best.trial ? `・試練${d.best.trial}` : ''}` : 'なし'}　クリア ${d.clears}回</p>
      ${last ? `<details class="dg-last"><summary>前回クリアしたデッキ（${HERO_BY_ID[last.hero].name}${last.trial ? `・試練${last.trial}` : ''}）</summary><div class="deck-grid">${[...last.deck.monsters, ...last.deck.items].map(id => cardFaceHtml(cardAt(id, last.deck.levels[id] || 1), { attrs: `data-id="${id}" data-lv="${last.deck.levels[id] || 1}"` })).join('')}</div><div class="charm-row">${last.charms.map(c => charmChipHtml(c)).join('')}</div></details>` : ''}
    </div>
    <h2>難しさ</h2>
    <div class="dg-panel"><div class="chip-row">${trials}</div>${d.maxTrial ? trialNote : '<p class="dk-hint">クリアすると「試練」（より難しい挑戦）が解放されます。</p>'}</div>
    <h2>ヒーローを選ぶ</h2>
    <div class="dg-panel">${heroes}<p class="dk-hint">最初のデッキは、選んだヒーローの色が中心になります。</p></div>
    <button class="btn primary big dg-go" data-dg="start">${HERO_BY_ID[dgSel.hero].name}で挑戦する</button>`;
}

// ---------- 挑戦中 ----------

function renderDungeon() {
  const run = dgRun();
  if (!run) { renderDungeonStart(); return; }
  if (run.over) { finishDungeon(); return; }
  const ch = DUNGEON_CHAPTERS[run.chapter];
  $('#dg-title').textContent = `${run.chapter + 1}章　${ch.name}${run.trial ? `（試練${run.trial}）` : ''}`;
  $('#btn-dg-quit').classList.toggle('gone', false);
  $('#dg-status').innerHTML = `<div class="dg-bar"><span class="dg-lives" title="命">${livesHtml(run)}</span><span>🪙 ${run.coins}</span>
    <button class="btn small" data-dg="deck">デッキ ${run.deck.monsters.length}+${run.deck.items.length}</button>
    <span class="charm-row">${run.charms.map(c => charmChipHtml(c)).join('') || '<small>お守りなし</small>'}</span></div>`;
  $('#dg-body').innerHTML = run.pending ? nodeHtml(run) : mapHtml(run);
}

// マップ：上がボス、下がスタート。進めるマスが光る
function mapHtml(run) {
  const nodes = run.map.nodes;
  const open = dungeonChoices(run);
  const path = run.path || [];
  const X = col => 50 + col * 100, Y = row => (DUNGEON.ROWS - 1 - row) * 64 + 36;
  const lines = nodes.flatMap(n => n.next.map(t => {
    const to = nodes[t];
    const walked = path.includes(n.id) && path.includes(to.id);
    const next = n.id === run.at && open.includes(to.id);
    return `<line x1="${X(n.col)}" y1="${Y(n.row)}" x2="${X(to.col)}" y2="${Y(to.row)}" class="${walked ? 'walked' : next ? 'next' : ''}"/>`;
  })).join('');
  const dots = nodes.map(n => {
    const t = DUNGEON_NODES[n.type];
    const cls = open.includes(n.id) ? 'open' : path.includes(n.id) ? 'done' : n.id === run.at ? 'here' : '';
    return `<button class="dg-node t-${n.type} ${cls}" style="left:${X(n.col) / 3}%;top:${Y(n.row)}px" data-dg="node" data-node="${n.id}" ${open.includes(n.id) ? '' : 'disabled'}><i>${t.icon}</i><small>${t.name}</small></button>`;
  }).join('');
  const h = DUNGEON.ROWS * 64 + 16;
  return `<p class="dk-hint">光っているマスから、次に進むマスを選びます（下から上へ）。${run.at == null ? '最初のマスを選んでください。' : ''}</p>
    <div class="dg-map" style="height:${h}px"><svg viewBox="0 0 300 ${h}" preserveAspectRatio="none">${lines}</svg>${dots}</div>
    <div class="dg-legend">${Object.keys(DUNGEON_NODES).map(k => `<span>${DUNGEON_NODES[k].icon} ${DUNGEON_NODES[k].name}</span>`).join('')}</div>`;
}

// マスに入る前の確認
function showNodeInfo(id) {
  const run = dgRun();
  const n = run.map.nodes[id];
  const t = DUNGEON_NODES[n.type];
  const boss = n.type === 'boss' ? `<p class="boss-note"><b>${DUNGEON_CHAPTERS[run.chapter].boss.name}</b>：${DUNGEON_CHAPTERS[run.chapter].boss.feature}</p>` : '';
  showOverlay(`<div class="result detail dk-panel">
    <div class="result-icon">${t.icon}</div><h2>${t.name}</h2><p>${t.desc}</p>${boss}
    <button class="btn primary" data-dg="enter" data-node="${id}">ここへ進む</button>
    <button class="btn" data-act="close-detail">やめる</button>
  </div>`);
}

function foeHtml(run, foe) {
  const d = foe.deck;
  const hero = d.hero ? `<p class="hero-note">相手のヒーロースキル「${HERO_SKILL_INFO[d.hero.skill].name}」：${HERO_SKILL_INFO[d.hero.skill].desc}</p>` : '';
  const lv = Math.max(...Object.values(d.levels));
  return `<p><b>${foe.name}</b></p>
    <p class="land-note">${terrainHtml(TERRAIN_BY_ID[foe.terrain])}</p>
    <p>相手のデッキ：モンスター${d.monsters.length}枚・アイテム${d.items.length}枚（カードLv${lv}）</p>${hero}
    ${foe.bonus ? `<p class="boss-note">相手は最初からクリスタルを${foe.bonus}個多く持っている</p>` : ''}
    ${foe.income ? `<p class="boss-note">相手は毎ターンもらえるクリスタルが${foe.income}個多い</p>` : ''}`;
}

// 今いるマスの画面
function nodeHtml(run) {
  const p = run.pending;
  const t = DUNGEON_NODES[p.type];
  const head = `<div class="dg-panel dg-node-panel"><div class="result-icon">${t.icon}</div><h2>${t.name}</h2>`;
  const leave = text => `<button class="btn big dg-go" data-dg="leave">${text}</button>`;
  if (dgReplace) return head + replaceHtml(run) + '</div>';
  if (p.phase === 'battle') {
    return `${head}${foeHtml(run, p.foe)}<p class="dk-hint">負けると命が1つ減ります（今 ${run.lives}）。</p>
      <button class="btn primary big dg-go" data-dg="fight">戦う</button></div>`;
  }
  if (p.phase === 'lost') {
    return `${head}<p class="dk-missing">負けました。命が1つ減りました（残り ${run.lives}）。</p>${foeHtml(run, p.foe)}
      <button class="btn primary big dg-go" data-dg="retry">同じ相手ともう一度戦う</button>
      ${p.type === 'boss' ? '<p class="dk-hint">ボスは避けて進めません。</p>' : '<button class="btn big dg-go" data-dg="skip">戦わずに次へ進む（報酬なし）</button>'}</div>`;
  }
  const notes = (p.coins ? `<p>🪙 コイン +${p.coins}</p>` : '')
    + p.notes.map(n => (n[0] === 'charm' ? `<p>お守り「<b>${CHARM_BY_ID[n[1]].icon} ${CHARM_BY_ID[n[1]].name}</b>」を手に入れた：${CHARM_BY_ID[n[1]].desc}</p>` : '')).join('');
  const step = p.steps[0];
  if (step) {
    const title = p.type === 'mystery' && p.result ? `<p>${p.result}</p>` : p.phase === 'reward' ? '<p class="lvup">勝利！</p>' : '';
    if (step.kind === 'card') {
      const cards = step.offers.map(id => dgCardHtml(run, id, `data-dg="take" data-card="${id}"`, runFull(run, id) ? '<span class="card-miss">入れ替え</span>' : '')).join('');
      return `${head}${title}${notes}<p>カードを1枚選んで、デッキに加えます（長押し・カーソルで説明）。</p>
        <div class="deck-grid dg-offers">${cards || '<p>選べるカードがありません</p>'}</div>
        <p class="dk-hint">今のデッキ：モンスター${run.deck.monsters.length}/${CONFIG.DECK_MONSTERS}・アイテム${run.deck.items.length}/${CONFIG.DECK_ITEMS}。枠がいっぱいの種類は、入れ替えになります。</p>
        <button class="btn big dg-go" data-dg="pass">取らない</button></div>`;
    }
    const charms = step.offers.map(id => `<button class="btn dg-charm" data-dg="take" data-card="${id}"><b>${CHARM_BY_ID[id].icon} ${CHARM_BY_ID[id].name}</b><small>${CHARM_BY_ID[id].desc}</small></button>`).join('');
    return `${head}${title}${notes}<p>お守りを1つ選びます。挑戦が終わるまで、ずっと効きます。</p>${charms}</div>`;
  }
  if (p.type === 'smith') {
    const list = runUpgradable(run).map(id => dgCardHtml(run, id, `data-dg="smith" data-card="${id}"`, `<span class="card-count">Lv${runLevel(run, id)}→${runLevel(run, id) + 1}</span>`)).join('');
    return `${head}<p>${p.left > 0 ? `レベルアップするカードを選びます（あと${p.left}枚）。同じカードが2枚あれば、2枚とも上がります。` : 'レベルアップしました。'}</p>
      ${p.left > 0 ? `<div class="deck-grid dg-offers">${list || '<p>レベルアップできるカードがありません</p>'}</div>` : ''}${leave(p.left > 0 ? '何もせず先へ進む' : '先へ進む')}</div>`;
  }
  if (p.type === 'shrine') {
    if (p.used) return `${head}<p>祠の光が消えていった。</p>${leave('先へ進む')}</div>`;
    if (p.removing) {
      const cards = ['monsters', 'items'].map(key => run.deck[key].map((id, i) => dgCardHtml(run, id, `data-dg="remove" data-key="${key}" data-index="${i}"`)).join('')).join('');
      return `${head}<p>取り除くカードを選びます（モンスターの最後の1体は取り除けません）。</p><div class="deck-grid dg-offers">${cards}</div>
        <button class="btn big dg-go" data-dg="shrine-back">もどる</button></div>`;
    }
    const noHeal = trialMods(run.trial).noHeal;
    return `${head}<p>どちらか1つを選べます。</p>
      <button class="btn primary big dg-go" data-dg="heal" ${shrineCanHeal(run) ? '' : 'disabled'}>命を1つ回復する${noHeal ? '（試練の効果で回復できない）' : run.lives >= run.maxLives ? '（命は減っていない）' : ''}</button>
      <button class="btn big dg-go" data-dg="shrine-remove">デッキからカードを1枚取り除く</button>${leave('何もせず先へ進む')}</div>`;
  }
  if (p.type === 'shop') {
    const rows = p.stock.map((it, i) => {
      const price = shopPrice(run, it);
      const can = !it.sold && run.coins >= price && (it.kind === 'charm' ? !run.charms.includes(it.id) : runCanHold(run, it.id));
      const body = it.kind === 'card' ? dgCardHtml(run, it.id) : `<span class="dg-shop-charm">${CHARM_BY_ID[it.id].icon}<b>${CHARM_BY_ID[it.id].name}</b><small>${CHARM_BY_ID[it.id].desc}</small></span>`;
      return `<div class="dg-shop-item${it.sold ? ' sold' : ''}">${body}<button class="btn small${can ? ' primary' : ''}" data-dg="buy" data-index="${i}" ${can ? '' : 'disabled'}>${it.sold ? '売り切れ' : `🪙 ${price}`}</button></div>`;
    }).join('');
    return `${head}<p>コインで買えます（持っているコイン：🪙 ${run.coins}）。</p><div class="dg-shop">${rows}</div>${leave('店を出て先へ進む')}</div>`;
  }
  if (p.type === 'mystery') {
    const ev = DUNGEON_EVENT_BY_ID[p.event];
    if (p.result != null) return `${head.replace(t.icon, ev.icon).replace(`<h2>${t.name}</h2>`, `<h2>${ev.name}</h2>`)}<p>${p.result}</p>${leave('先へ進む')}</div>`;
    const opts = ev.options.map((o, i) => `<button class="btn big dg-go${i === 0 ? ' primary' : ''}" data-dg="event" data-index="${i}" ${o.can && !o.can(run) ? 'disabled' : ''}>${o.text}</button>`).join('');
    return `${head.replace(t.icon, ev.icon).replace(`<h2>${t.name}</h2>`, `<h2>${ev.name}</h2>`)}<p>${ev.text}</p>${opts}</div>`;
  }
  // 報酬を受け取り終わった
  return `${head}${p.phase === 'reward' ? '<p class="lvup">勝利！</p>' : ''}${notes}${leave(p.type === 'boss' ? (run.chapter >= DUNGEON.CHAPTERS - 1 ? 'ダンジョンを制覇する' : '次の章へ進む') : '先へ進む')}</div>`;
}

// 枠がいっぱいのとき：入れ替えるカードを選ぶ
function replaceHtml(run) {
  const id = dgReplace.id;
  const key = runKey(id);
  const cards = run.deck[key].map((x, i) => dgCardHtml(run, x, `data-dg="replace" data-index="${i}"`)).join('');
  return `<p>${key === 'monsters' ? 'モンスター' : 'アイテム'}の枠がいっぱいです。<b>${CARD_DEFS[id].name}</b>と入れ替えるカードを選んでください。</p>
    <div class="deck-grid dg-offers">${dgCardHtml(run, id, 'disabled', '<span class="card-count">新しいカード</span>')}</div>
    <p>↓ 外すカード</p><div class="deck-grid dg-offers">${cards}</div>
    <button class="btn big dg-go" data-dg="replace-cancel">やめる</button>`;
}

function showDungeonDeck() {
  const run = dgRun();
  const cards = key => deckGroups(run.deck[key]).map(([id, n]) => dgCardHtml(run, id, '', n > 1 ? `<span class="card-count">×${n}</span>` : '')).join('');
  const hero = HERO_BY_ID[run.hero];
  showOverlay(`<div class="result detail dk-panel dg-deck">
    <h2>ダンジョンのデッキ</h2>
    <p>${hero.name}「${hero.skills[run.skill].name}」：${hero.skills[run.skill].desc}</p>
    <div class="tip-sub">モンスター ${run.deck.monsters.length}/${CONFIG.DECK_MONSTERS}</div><div class="deck-grid">${cards('monsters')}</div>
    <div class="tip-sub">アイテム ${run.deck.items.length}/${CONFIG.DECK_ITEMS}</div><div class="deck-grid">${cards('items')}</div>
    <div class="tip-sub">お守り ${run.charms.length}個</div>
    ${run.charms.map(c => `<p class="dg-charm-line"><b>${CHARM_BY_ID[c].icon} ${CHARM_BY_ID[c].name}</b>：${CHARM_BY_ID[c].desc}</p>`).join('') || '<p>まだ持っていません</p>'}
    <button class="btn primary" data-act="close-detail">とじる</button>
  </div>`);
}

// 挑戦の終わり：報酬を渡して、結果を見せる
function finishDungeon(reason) {
  const sum = endDungeon(profile, reason);
  if (!sum) return;
  dgSave();
  renderTitle();
  sfx(sum.result === 'clear' ? 'win' : 'lose');
  const title = { clear: '🏆 ダンジョン制覇！', dead: '💀 命が尽きた…', quit: '挑戦をあきらめた' }[sum.result];
  showOverlay(`<div class="result ${sum.result === 'clear' ? 'win' : 'lose'}">
    <h2>${title}</h2>
    <p>到達：${sum.floor} / ${DUNGEON.CHAPTERS * DUNGEON.ROWS} マス（${sum.chapter}章）${sum.trial ? `　試練${sum.trial}` : ''}</p>
    <p>戦闘：${sum.wins}勝 ${sum.losses}敗</p>
    <div class="rewards">持ち帰った報酬：💰 ゴールド +${sum.reward.gold}　🔷 魔石 +${sum.reward.stones}</div>
    ${sum.record ? '<p class="lvup">最高記録を更新！</p>' : ''}
    ${sum.unlocked ? `<p class="lvup">「試練${sum.unlocked}」が解放されました：${DUNGEON_TRIALS[sum.unlocked - 1].desc}</p>` : ''}
    <button class="btn primary big" data-dg="again">もう一度挑戦する</button>
    <button class="btn big" data-act="title">タイトルへ</button>
  </div>`);
  renderDungeon();
}

// 対戦が終わったとき（ui.js の結果画面から呼ばれる）：結果を挑戦に反映してセーブする
function dungeonAfterBattle(win) {
  const run = dgRun();
  if (!run) return;
  dungeonBattleEnd(run, win);
  dgSave();
}

// 対戦画面に出す、お守りの一覧
function battleCharmsHtml() {
  const run = dgRun();
  if (!run || !run.charms.length) return '';
  return `<div class="tb-row charms"><b>お守り</b><span class="charm-row">${run.charms.map(c => charmChipHtml(c)).join('')}</span></div>`;
}

// ---------- 操作 ----------

function dgTake(run, id) {
  const step = run.pending.steps[0];
  if (step.kind === 'card' && runFull(run, id)) { dgReplace = { from: 'step', id }; return; }
  if (dungeonChoose(run, id)) sfx(step.kind === 'charm' ? 'win' : 'equip');
}

function dungeonClick(e) {
  const el = e.target.closest ? e.target.closest('[data-dg]') : null;
  if (!el || el.disabled) return;
  const act = el.dataset.dg;
  const run = dgRun();
  if (act === 'hero') { dgSel.hero = el.dataset.hero; dgSel.skill = Number(el.dataset.skill); renderDungeon(); return; }
  if (act === 'trial') { dgSel.trial = Number(el.dataset.trial); renderDungeon(); return; }
  if (act === 'start' || act === 'again') {
    hideOverlay();
    if (act === 'again') { renderDungeon(); return; }
    if (startDungeon(profile, dgSel.hero, dgSel.skill, dgSel.trial)) { dgSave(); renderTitle(); sfx('summon'); }
    renderDungeon();
    return;
  }
  if (!run) return;
  if (act === 'deck') { showDungeonDeck(); return; }
  if (act === 'node') { showNodeInfo(Number(el.dataset.node)); return; }
  if (act === 'enter') { hideOverlay(); enterNode(run, Number(el.dataset.node)); sfx('tap'); }
  if (act === 'fight' && run.pending && run.pending.phase === 'battle') { dgSave(); startBattle({ type: 'dungeon' }); return; }
  if (act === 'retry') dungeonRetry(run);
  if (act === 'skip') dungeonSkip(run);
  if (act === 'take') dgTake(run, el.dataset.card);
  if (act === 'pass') dungeonChoose(run, null);
  if (act === 'replace') {
    const i = Number(el.dataset.index);
    const ok = dgReplace.from === 'shop' ? shopBuy(run, dgReplace.index, i) : dungeonChoose(run, dgReplace.id, i);
    if (ok) { sfx('equip'); dgReplace = null; }
  }
  if (act === 'replace-cancel') dgReplace = null;
  if (act === 'smith' && smithUpgrade(run, el.dataset.card)) sfx('gem');
  if (act === 'heal' && shrineHeal(run)) sfx('heal');
  if (act === 'shrine-remove') run.pending.removing = true;
  if (act === 'shrine-back') run.pending.removing = false;
  if (act === 'remove' && shrineRemove(run, el.dataset.key, Number(el.dataset.index))) { run.pending.removing = false; sfx('sacrifice'); }
  if (act === 'buy') {
    const i = Number(el.dataset.index);
    const it = run.pending.stock[i];
    if (it.kind === 'card' && runFull(run, it.id)) dgReplace = { from: 'shop', id: it.id, index: i };
    else if (shopBuy(run, i)) sfx('gem');
  }
  if (act === 'event' && mysteryChoose(run, Number(el.dataset.index))) sfx('tap');
  if (act === 'leave') { dgReplace = null; if (leaveNode(run)) sfx('tap'); }
  dgSave();
  renderTitle();
  renderDungeon();
}

$('#btn-dungeon').addEventListener('click', openDungeon);
$('#btn-dg-back').addEventListener('click', () => { showScreen('title'); renderTitle(); });
$('#btn-dg-quit').addEventListener('click', () => {
  const run = dgRun();
  if (!run) return;
  const r = dungeonReward({ ...run, over: 'quit' });
  showOverlay(`<div class="result detail dk-panel">
    <h2>挑戦をあきらめますか？</h2>
    <p>ここまでの挑戦は終わりになり、続きからは遊べなくなります。</p>
    <p>今あきらめると持ち帰れる報酬：💰 ${r.gold}　🔷 ${r.stones}</p>
    <button class="btn danger" data-dg="quit-ok">あきらめる</button>
    <button class="btn primary" data-act="close-detail">つづける</button>
  </div>`);
});
$('#screen-dungeon').addEventListener('click', dungeonClick);
$('#overlay').addEventListener('click', e => {
  const el = e.target.closest ? e.target.closest('[data-dg]') : null;
  if (!el) return;
  if (el.dataset.dg === 'quit-ok') { hideOverlay(); finishDungeon('quit'); return; }
  if (el.dataset.dg === 'return') { openDungeon(); return; }
  dungeonClick(e);
});
// お守りをタップすると説明を出す（対戦画面ではメッセージ欄に、ダンジョンの画面では小窓に）
$('#terrain-bar').addEventListener('click', e => {
  const c = e.target.closest ? e.target.closest('[data-charm]') : null;
  if (c) say(`${CHARM_BY_ID[c.dataset.charm].icon} ${CHARM_BY_ID[c.dataset.charm].name}：${CHARM_BY_ID[c.dataset.charm].desc}`);
});
$('#dg-status').addEventListener('click', e => {
  const c = e.target.closest ? e.target.closest('[data-charm]') : null;
  if (c) showDungeonDeck();
});
