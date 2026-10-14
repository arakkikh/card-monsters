// ============================================================
// 対戦ログの表示と、対戦履歴の保存
//   ログそのものは engine.js が state.log に記録する（短い配列の並び）。
//   ここでは、それを読める文に直す・重要なものを選ぶ・試合のまとめを作る・履歴として保存する。
//   文の中のカード名・スキル名には data-card / data-dict を付け、タップで詳細を開けるようにする。
// ============================================================

const LOG_BIG_DAMAGE = 5; // このダメージ以上は「重要」扱い

// ---------- 文の部品 ----------

// 同じカードが2体いるときの区別（ログの「~1」「~2」→ ①②）
const COPY_MARK = ['', '①', '②', '③', '④'];
const logCardName = id => (CARD_BY_ID[id] ? CARD_BY_ID[id].name : id);
// モンスター（'0r01' = 側＋カードid）
function logMon(ref) {
  if (!ref) return '';
  const [id, copy] = ref.slice(1).split('~');
  return `<span class="lk s${ref[0]}" data-card="${ref[0]}${id}">${logCardName(id)}${COPY_MARK[copy] || ''}</span>`;
}
const logCard = (side, id) => logMon(side + id);
function logSkillName(id) {
  if (SKILLS[id]) return `<span class="lk sk" data-dict="skill:${id}">${SKILLS[id].name}</span>`;
  if (STATUS_INFO[id]) return `<span class="lk sk" data-dict="status:${id}">${STATUS_INFO[id].name}</span>`;
  return id;
}
const logStatusName = id => (STATUS_INFO[id] ? `<span class="lk sk" data-dict="status:${id}">${STATUS_INFO[id].name}</span>` : logSkillName(id));
const logHero = id => `<span class="lk sk" data-dict="hero:${id}">${HERO_SKILL_INFO[id] ? HERO_SKILL_INFO[id].name : id}</span>`;
const logKo = o => (o.K ? ' <b class="ko">撃破</b>' : '');

// ダメージの結果（type を渡すと、ダメージ数字と同じ色になる）
function logDamage(o, type) {
  if (o.ms) return '地形の効果で外れた';
  if (o.dg) return `${logSkillName('flying')}で回避`;
  if (o.bl) return 'アーマーでブロック';
  if (o.fg) return `${logSkillName('fog')}でダメージ0`;
  if (o.rf) return '跳ね返されて、受けなかった';
  if (o.gd) return `${logSkillName('staticguard')}で防がれた`;
  const parts = [];
  if (o.d) parts.push(`<b class="${type ? 't-' + type : 'dm'}">${o.d}ダメージ</b>`);
  if (o.a) parts.push(`アーマー-${o.a}`);
  if (!o.d && !o.a) parts.push('ダメージ0');
  if (o.sh) parts.push(`盾で${o.sh}軽減`);
  return parts.join('、') + logKo(o);
}
const logHeal = o => (o.c ? `Disease-${o.c}${o.h ? `、${o.h}回復` : ''}` : `<b class="hl">${o.h || 0}回復</b>`);

// スキルなどの効果の文。kind ごとの書き方（ここにない種類は、スキル名と対象とダメージだけを出す）
const LOG_KIND = {
  silence: (S, T, o) => `${S}の${logSkillName('silence')}：${T}を${o.x}ターン Silence 状態に`,
  menace: (S, T, o) => `${logSkillName('menace')}：位置が変わった${T}に${logDamage(o)}`,
  healingshield: (S, T, o) => `${logSkillName('healingshield')}：${T}が盾（${SKILLS[o.sd] ? SKILLS[o.sd].name : ''} ${o.x}）を得た`,
  rearguard: (S, T, o) => `${S}の${logSkillName('rearguard')}：スキルの数値+${o.x}`,
  cleanse: (S, T, o) => `${S}の${logSkillName(o.sk || 'cleanse')}：${T}のデバフを解除`,
  skip: (S, T, o) => `${S}は${logStatusName(o.rs)}状態のため${logSkillName(o.sk)}を使えない`,
  heal: (S, T, o) => `${S}の${logSkillName(o.sk || 'heal')}：${T}を${logHeal(o)}`,
  poisonhalo: (S, T) => `${S}の${logSkillName('poisonhalo')}：${T}を強化`,
  trickery: (S, T) => `${S}の${logSkillName('trickery')}：${T}のカオスダメージが最大に`,
  inspire: (S, T, o) => `${S}の${logSkillName('inspire')}：味方の近接攻撃+${o.x}`,
  shoot: (S, T, o) => `${S}の${logSkillName('shoot')}：味方の遠隔攻撃+${o.x}`,
  antimagic: (S, T, o) => `${S}の${logSkillName('antimagic')}：味方が受ける魔法ダメージ-${o.x}`,
  massbombard: (S, T, o) => `${S}の${logSkillName('massbombard')}：${T}の攻撃+${o.x}`,
  demoralize: (S, T, o) => `${S}の${logSkillName('demoralize')}：${T}の近接・遠隔攻撃-${o.x}`,
  suppress: (S, T, o) => `${S}の${logSkillName('suppress')}：${T}の魔法攻撃-${o.x}`,
  toxicfog: (S, T, o) => `${S}の${logSkillName('toxicfog')}：${T}に Disease +${o.x}`,
  fear: (S, T, o, tg) => (o.im ? `${S}の${logSkillName('fear')}：${T}は Inspire 中で効かない`
    : `${S}の${logSkillName('fear')}：${logMon(tg[0])}と${logMon(o.ot)}を入れ替えた`),
  entangle: (S, T, o) => `${S}の${logSkillName('entangle')}：${o.im ? `${T}には効かない` : o.ok ? `${T}を拘束した` : '失敗'}`,
  outbreakhalo: (S, T, o) => `${S}の${logSkillName('outbreakhalo')}：${T}に${logDamage(o, 'magic')}`,
  dive: (S, T, o) => `${T}の${logSkillName('dive')}：近接・遠隔攻撃+${o.x}`,
  outbreak: (S, T, o) => `${logSkillName('outbreak')}：${T}の Disease のぶん、${logDamage(o, 'magic')}`,
  sick: (S, T, o) => `${logSkillName('disease')}：${T}に${logDamage(o, 'magic')}`,
  burning: (S, T, o) => `燃焼：${T}に${logDamage(o, 'magic')}`,
  scorch: (S, T, o) => (o.im ? `${T}は燃焼を受けない` : `${logSkillName('scorch')}：${T}に燃焼+${o.x}`),
  vanguard: (S, T, o) => `${S}の${logSkillName('vanguard')}：スキルの数値+${o.x}`,
  steadyaim: (S, T, o) => `${S}の${logSkillName('steadyaim')}：遠隔攻撃+${o.x}`,
  jinx: (S, T, o) => `${S}の${logSkillName('jinx')}：${T}のカオス攻撃-${o.x}`,
  grudge: (S, T, o) => `${T}の${logSkillName('grudge')}：近接攻撃+${o.x}`,
  keeneye: (S, T, o) => `${T}の${logSkillName('keeneye')}：遠隔攻撃+${o.x}`,
  leech: (S, T, o) => `${T}の${logSkillName('leech')}：HPと最大HP+${o.x}`,
  harvest: (S, T, o) => `${T}の${logSkillName('harvest')}：クリスタル+${o.x}`,
  laststand: (S, T) => `${T}の${logSkillName('laststand')}：倒されずに、HPが全回復`,
  partinggift: (S, T, o) => `${S}の${logSkillName('partinggift')}：${T}を${logHeal(o)}`,
  finalbow: (S, T, o) => `${S}の${logSkillName('finalbow')}：${T}に${logDamage(o)}`,
  plagueburst: (S, T, o) => `${T}に${logDamage(o, 'magic')}`,
  backfire: (S, T, o) => `${S}の${logSkillName('backfire')}：相手の山札に${logCardName('sp1')}を${o.x}枚、自分の山札にも1枚入れた`,
  spellforge: (S, T, o) => `${S}の${logSkillName('spellforge')}：自分の山札に${logCardName('sp3')}を入れた`,
  apothecary: (S, T, o) => `${S}の${logSkillName('apothecary')}：自分の山札に${logCardName('sp4')}を入れた`,
  fortune: (S, T, o) => `${S}の${logSkillName('fortune')}：${o.it === 'sp5' ? `吉。自分の山札に${logCardName('sp5')}を入れた` : `凶。相手の山札に${logCardName('sp2')}を入れた`}`,
  tinker: (S, T, o) => `${S}の${logSkillName('tinker')}：自分の山札に${logCardName(o.it)}を入れた（コスト-${o.x}）`,
  opportunist: (S, T, o) => `${T}の${logSkillName('opportunist')}：攻撃力と最大HP+${o.x}`,
  vanguardcall: (S, T) => `${S}の${logSkillName('vanguardcall')}：前列に${T}を呼んだ`,
  sortie: (S, T) => `${S}の${logSkillName('sortie')}：${T}を呼んだ`,
  tokenend: (S, T) => `${T}が消えた`,
  burden: (S, T, o) => `${T}が倒された：持ち主のクリスタル -${o.x}`,
  evacuate: (S, T, o) => `${logSkillName('evacuate')}：${T}を山札に戻した（コスト-${o.x}）`,
  fallback: (S, T, o) => `${logSkillName('fallback')}：${T}は山札に戻った（次のコスト+${o.x}）`,
  attunement: (S, T, o) => `${logSkillName('attunement')}：このターンに回復があったので、コスト-${o.x}`,
  illomen: (S, T, o) => `${logSkillName('illomen')}：引いたカードのコスト+${o.x}`,
  disease: (S, T, o) => (o.im ? `${T}は ${logSkillName('disease')} を受けない` : `${logSkillName('disease')}：${T}にスタック+${o.x}`),
  magicblast: (S, T, o) => `${logSkillName('magicblast')}：隣の${T}に${logDamage(o, 'magic')}`,
  doublestrike: (S, T, o) => `${logSkillName('doublestrike')}：後列の${T}に${logDamage(o, 'melee')}`,
  swallow: (S, T, o) => `${T}の${logSkillName('swallow')}：攻撃力と最大HP+${o.x}`,
  phantom: (S) => `${logSkillName('phantom')}：${S}の分身が現れた`,
  phantomend: () => `${logSkillName('phantom')}：分身が消えた`,
  groupheal: (S, T, o) => `${T}を${logHeal(o)}`,
  groupdisease: (S, T, o) => (o.im ? `${T}は Disease を受けない` : `${T}に Disease +${o.x}`),
  masscorrosion: (S, T, o) => `${T}の${logCardName(o.it)}を破壊`,
  hero: (S, T, o) => `ヒーロースキル「${logHero(o.id)}」：` + ({
    heal: () => `${T}を${logHeal(o)}`,
    cleanse: () => `${T}のデバフを解除`,
    fog: () => `${T}が Fog 状態に`,
    disease: () => `${T || '敵全員'}に Disease +${o.x}`,
    gain: () => `敵を倒してクリスタル+${o.g}`,
    grant: () => `${T}が Disease 1 を得た`,
  }[o.ef] || (() => T))(),
};
// 反撃・反射の仲間は同じ書き方
['thorns', 'shieldspike', 'counter', 'crosscounter', 'magiccounter', 'magicreflect', 'opportunity', 'deflect', 'staticguard'].forEach(k => {
  LOG_KIND[k] = (S, T, o) => `${S}の${logSkillName(k)}：${T}に${logDamage(o)}`;
});

const LOG_TERRAIN = { burn: (r, n) => `${logMon(r)}に${n}ダメージ`, storm: (r, n) => `${logMon(r)}に落雷（${n}ダメージ）`, regen: (r, n) => `${logMon(r)}を${n}回復` };
const LOG_SKIP = { entangle: 'Entangle 状態', silence: 'Silence 状態', suppress: 'Suppress Magic で攻撃力0', demoralize: 'Demoralize で攻撃力0', jinx: 'Jinx で攻撃力0', stall: 'Stall 状態' };
const LOG_REASON = { wipeout: 'モンスターがすべていなくなった', both: '両者のモンスターが同時にいなくなった（手番側の勝ち）', surrender: '降参' };

// ---------- 1行ぶんの表示 ----------
// オート（つよい）の判断理由の文。['N', 側, 種類, …] の「種類」ごとの書き方（記録するのは autoai.js）
const LOG_THINK_FLASH = {
  kill: (C, T) => `${C}で${T}にとどめ`,
  terminate: (C, T) => `${C}：最も脅威の大きい${T}を破壊する`,
  unsummon: (C, T) => `${C}：${T}を山札に戻して、攻撃を止める`,
  smite: (C, T) => `${C}：${T}を削って、このターンに倒しやすくする`,
  lightning: (C, T) => `${C}：${T}を削って、このターンに倒しやすくする`,
  heal: (C, T) => `${C}：${T}を回復して、次の攻撃に耐えさせる`,
  groupheal: C => `${C}：味方をまとめて回復して、次の攻撃に耐えさせる`,
  retreat: (C, T) => `${C}：倒されそうな${T}を山札に逃がす`,
  lingeringfog: (C, T) => `${C}：${T}が受ける次のダメージを0にする`,
  corrosion: (C, T) => `${C}：${T}の装備を壊す`,
  masscorrosion: C => `${C}：相手の装備をまとめて壊す`,
  reinforcement: C => `${C}：クリスタルを増やす`,
  groupdisease: C => `${C}：相手全員を Disease 状態にする`,
  phantom: (C, T) => `${C}：${T}の分身を出して、攻撃を増やす`,
};
const LOG_THINK = {
  open: (s, a) => `${logCard(s, a)}を出す：場を空にしないため`,
  tank: (s, a) => `前列に${logCard(s, a)}を配置：相手の攻撃をアーマーで受けるため`,
  front: (s, a) => `前列に${logCard(s, a)}を配置：${CARD_BY_ID[a.split('~')[0]] && CARD_BY_ID[a.split('~')[0]].type === 'melee' ? '近接攻撃を当てるため' : '前に立って、後ろの味方を守るため'}`,
  avoid: (s, a, b, c) => `${logCard(s, a)}を後列に配置：${logMon(b)}の${logSkillName(c)}を受けないため`,
  wait: (s, a) => `${logCard(s, a)}を後列に控えさせる：前列が倒れたら、前に詰めて戦うため`,
  back: (s, a, b) => `後列に${logCard(s, a)}を配置：後ろから${ATTACK_TYPES[b] ? ATTACK_TYPES[b].name : ''}攻撃をするため`,
  silence: (s, a) => `${logCard(s, a)}を出す：相手の魔法と回復を${logSkillName('silence')}で止めるため`,
  eqatk: (s, a, b) => `${logMon(b)}に${logCard(s, a)}を装備：今のスロットで使える攻撃を強くするため`,
  eqdef: (s, a, b) => `${logMon(b)}に${logCard(s, a)}を装備：倒されにくくするため`,
  eqskill: (s, a, b) => `${logMon(b)}に${logCard(s, a)}を装備：スキルを得るため`,
  swap: (s, a, b, c) => `${logMon(b)}の装備を${logCard(s, a)}に付け替え：${c ? logCard(s, c) : '今の装備'}より強いため`,
  flash: (s, a, b, c) => (LOG_THINK_FLASH[c] || (C => `${C}を使う`))(logCard(s, a), logMon(b)),
  sac: (s, a, b) => `${logCard(s, a)}を生贄：${b ? `${logCard(s, b)}を使うクリスタルを作るため` : '次のターンのクリスタルを増やすため'}`,
  sacf: (s, a, b) => `場の${logCard(s, a)}を生贄：${b ? `${logCard(s, b)}を使うクリスタルを作るため` : '並びを詰め直して、攻撃できるようにするため'}`,
  win: () => 'このターンで勝ちきれる見込み：攻めを優先',
  save: (s, a, b, c) => `クリスタルを${a}個温存：次のターンに${logCard(s, b)}（コスト${c}）を出すため`,
  hold: (s, a) => `${logCard(s, a)}を温存：試算では、今は使わないほうが有利`,
};

// ログ1つを { html, side, cls, sub, important, turn } にする
//   ctx: { names: [自分の名前, 相手の名前], terrain: 地形のid }
function logLine(e, ctx = {}) {
  const names = ctx.names || ['あなた', '相手'];
  const [code, a, b, c, d, f] = e;
  const line = (side, html, more = {}) => ({ side, html, cls: '', sub: false, important: false, ...more });
  switch (code) {
    case 'C': return line(a, `コイントス：${names[a]}が先攻${CONFIG.SECOND_PLAYER_BONUS ? `（${names[1 - a]}は後攻ボーナス：クリスタル+${CONFIG.SECOND_PLAYER_BONUS}${CONFIG.SECOND_PLAYER_LATE && CONFIG.SECOND_PLAYER_LATE.bonus ? `、ターン${CONFIG.SECOND_PLAYER_LATE.turn}にも+${CONFIG.SECOND_PLAYER_LATE.bonus}` : ''}）` : ''}`, { cls: 'sys coin', important: true });
    case 'T': return line(b, `ターン${a}　${names[b]}`, { cls: 'turn', turn: a, important: true });
    case 'P': return line(a, `${logCard(a, b)}をスロット${c + 1}に出した${d.length ? `（${d.map(logMon).join('・')}が後ろへ）` : ''}`, { cls: 'play' });
    case 'E': return line(a, `${logMon(c)}に${logCard(a, b)}を装備${d ? `（${logCard(a, d)}は外れた）` : ''}`, { cls: 'play' });
    case 'S': return line(a, `${f ? '場の' : ''}${logCard(a, b)}を生贄にした（クリスタル+${c}）`, { cls: 'play' });
    case 'F': {
      const o = d || {};
      const res = [];
      if (o.d || o.a || o.fg) res.push(logDamage(o, CARD_BY_ID[b] && CARD_BY_ID[b].skills[0].id === 'lightning' ? 'magic' : ''));
      else if (o.K) res.push('<b class="ko">撃破</b>');
      if (o.h || o.c) res.push(logHeal(o));
      if (o.g) res.push(`クリスタル+${o.g}`);
      if (o.u) res.push('山札に戻した');
      if (o.sm) res.push(`${logCardName(o.sm)}を${o.sn}体呼んだ`);
      if (o.pg != null) res.push(`足されたカードを${o.pg}枚取り除いた`);
      if (o.tx != null) res.push(`相手の手札のアイテム${o.tx}枚のコスト+${o.x}`);
      if (o.ds) res.push(`${logCardName(o.ds)}を破壊`);
      return line(a, `フラッシュ ${logCard(a, b)}${c ? ` → ${logMon(c)}` : ''}${res.length ? '：' + res.join('、') : ''}`, { cls: 'play', important: !!o.K });
    }
    case 'A': {
      const o = f || {};
      const src = o.src ? `（${SKILLS[o.src] ? logSkillName(o.src) : o.src === 'weapon' ? '装備の攻撃' : o.src}）` : '';
      const notes = [o.tr && 'Trickery で最大値', o.st && 'See-through', o.hb && `ヒーロースキル+${o.hb}`].filter(x => x);
      return line(a, `${logMon(b)}の<b class="t-${c}">${ATTACK_TYPES[c].name}攻撃</b>${src} → ${logMon(d)}：${logDamage(o, c)}${notes.length ? `（${notes.join('、')}）` : ''}`,
        { cls: 'atk t-' + c, important: !!o.K || (o.d || 0) + (o.a || 0) >= LOG_BIG_DAMAGE });
    }
    case 's': return line(a, `${logMon(b)}は${LOG_SKIP[c] || c}のため${d ? ATTACK_TYPES[d].name : ''}攻撃できない`, { cls: 'skill' });
    case 'k': case 'x': {
      const o = f || {};
      const fn = LOG_KIND[b] || ((S, T, oo) => `${S ? S + 'の' : ''}${logSkillName(b)}：${T}${oo.d || oo.a ? 'に' + logDamage(oo) : ''}`);
      return line(a, fn(logMon(c), d.map(logMon).join('・'), o, d), { cls: b === 'hero' ? 'hero' : 'skill', sub: code === 'x', important: b === 'hero' || !!o.K });
    }
    case 'B': return line(-1, `🔥 <span class="lk sk" data-dict="rule:attrition">消耗ダメージ</span> ${a}：場のモンスター全員に${a}ダメージ${logFallen(b.filter(x => x[1]).map(x => x[0]))}`, { cls: 'sys', important: true });
    case 'L': {
      const t = TERRAIN_BY_ID[ctx.terrain];
      const name = t ? `<span class="lk sk" data-dict="terrain:${t.id}">${t.icon} ${t.name}</span>` : '地形';
      return line(a, `${name}：${c.map(x => LOG_TERRAIN[b](x[0], x[1])).join('、')}${logFallen(c.filter(x => x[2]).map(x => x[0]))}`, { cls: 'sys', important: c.some(x => x[2]) });
    }
    case 'M': return line(a, `${b.map(logMon).join('・')}が前に詰めた`, { cls: 'move', sub: true });
    case 'X': return line(a, `${logMon(b)}の${logStatusName(c)}状態が解けた`, { cls: 'skill' });
    case 'Y': return line(a, `<span class="lk sk" data-dict="rule:penalty">場が空のペナルティ</span>：${c === 'hand' ? '手札' : '山札'}の${logCard(a, b)}が捨てられた`, { cls: 'sys', important: true });
    case 'R': return line(a, `決着：${names[a]}の勝ち（${LOG_REASON[b] || b}）`, { cls: 'result', important: true });
    case 'W': return line(a, `後攻ボーナス：${names[a]}のクリスタル +${b}`, { cls: 'gain' });
    case 'G': return line(a, `${logMon(b)}が倒された：${names[a]}の<span class="lk sk" data-dict="rule:fallen">クリスタル +${c}</span>`, { cls: 'gain', sub: true });
    case 'N': return line(a, `💭 オートの判断　${(LOG_THINK[b] || (() => b))(a, c, d, f)}`, { cls: 'think', important: true });
    default: return line(-1, String(code));
  }
}
const logFallen = refs => (refs.length ? `　${refs.map(logMon).join('・')}が<b class="ko">倒れた</b>` : '');

// ログ全体のHTML。onlyImportant: 重要なものだけ（撃破・ヒーロースキル・大ダメージ・ペナルティなど）
function logHtml(log, ctx = {}, onlyImportant = false) {
  const out = [];
  for (const e of log) {
    const l = logLine(e, ctx);
    if (onlyImportant && !l.important) continue;
    out.push(`<li class="lg ${l.cls}${l.side === 0 ? ' mine' : l.side === 1 ? ' foe' : ''}${l.sub ? ' sub' : ''}${l.important && l.cls !== 'turn' ? ' imp' : ''}">${l.html}</li>`);
  }
  return out.length ? `<ul class="blog">${out.join('')}</ul>` : '<p class="blog-empty">まだ何も起きていません</p>';
}

// ---------- 対戦履歴 ----------

const HISTORY = {
  KEY: 'card-monsters-history-v1', // セーブデータ（プロフィール）とは別のキーに保存する
  MAX: 50,      // 保存する試合の数
  MAX_FAV: 10,  // 「保存」マークを付けられる数（自動で消されない）
};
const HISTORY_MODES = { s: 'ステージ', f: 'フリー', e: 'イベント' };

// デッキを短い形にする（Lv1 や未選択は書かない）
function packDeck(deck) {
  const lv = {}, op = {};
  for (const id of [...deck.monsters, ...deck.items]) {
    if ((deck.levels || {})[id] > 1) lv[id] = deck.levels[id];
    if ((deck.options || {})[id] != null) op[id] = deck.options[id];
  }
  return { m: deck.monsters.slice(), i: deck.items.slice(), lv, op, h: deck.hero ? deck.hero.skill : null, hn: deck.hero ? deck.hero.name : null };
}

// 終わった対戦から、履歴の1件を作る
//   info: { mode: 's'/'f'/'e', label: ステージidやイベント名, win, foe: 相手の名前, event: イベントid, now }
function makeHistoryRecord(state, info) {
  const mvp = Object.entries(state.tally[0].by).sort((x, y) => y[1] - x[1])[0];
  return {
    t: (info.now || new Date()).getTime(), m: info.mode, lb: info.label || '', w: info.win ? 1 : 0,
    rs: state.result ? state.result.reason : '', n: state.turn, fn: info.foe || 'CPU',
    land: state.terrain ? state.terrain.id : null, ev: info.event || null,
    dk: state.decks.map(packDeck), dn: info.deck || '', // dn: 自分が使ったデッキの名前
    sum: { d: state.tally.map(t => t.dmg), k: state.tally.map(t => t.kills), mvp: mvp ? [mvp[0], mvp[1]] : null },
    log: state.log, fav: false,
  };
}

// 履歴に足す（新しい順）。50試合を超えたら、保存マークのない古いものから消す
function addHistory(list, rec) {
  list.unshift(rec);
  while (list.length > HISTORY.MAX) {
    let i = list.length - 1;
    while (i > 0 && list[i].fav) i--;
    list.splice(i, 1);
  }
  return list;
}

// 保存マークを付ける・外す。上限（10試合）を超えるときは付けられない
function setHistoryFav(list, t, on) {
  const rec = list.find(r => r.t === t);
  if (!rec) return false;
  if (on && !rec.fav && list.filter(r => r.fav).length >= HISTORY.MAX_FAV) return false;
  rec.fav = !!on;
  return true;
}

// 絞り込み。mode: 's'/'f'/'e'/null、result: 'win'/'lose'/null
function filterHistory(list, mode, result) {
  return list.filter(r => (!mode || r.m === mode) && (!result || (result === 'win') === !!r.w));
}

function loadHistory(storage = localStorage) {
  try {
    const list = JSON.parse(storage.getItem(HISTORY.KEY));
    return Array.isArray(list) ? list.filter(r => r && Number.isFinite(r.t) && Array.isArray(r.log) && Array.isArray(r.dk)) : [];
  } catch (e) { return []; }
}

// 保存する。容量が足りなければ、保存マークのない古いものを消してやり直す。保存できたら true
function saveHistory(list, storage = localStorage) {
  for (;;) {
    try { storage.setItem(HISTORY.KEY, JSON.stringify(list)); return true; } catch (e) {
      let i = list.length - 1;
      while (i >= 0 && list[i].fav) i--;
      if (i < 0) return false;
      list.splice(i, 1);
    }
  }
}

// 保存に使っている文字数の目安
function historyBytes(list) { return JSON.stringify(list).length; }
