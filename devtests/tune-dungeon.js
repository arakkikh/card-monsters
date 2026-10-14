// ダンジョンのクリア率を、条件を変えて測る（オート「つよい」＋かんたんな方針。200回ずつ）
const measure = (label, N = 200) => {
  const rng = seededRng(77);
  const profile = newProfile(); profile.dungeon.maxTrial = 10; profile.hero.unlocked = HEROES.map(h => h.id); HEROES.forEach(h => { profile.hero.levels[h.id] = 1; });
  let clear = 0; const died = [0, 0, 0];
  for (let i = 0; i < N; i++) { const r = playRun(profile, HEROES[i % HEROES.length].id, 0, Math.floor(rng() * 4e9), autoStrongAction, rng); if (r.over === 'clear') clear++; else died[r.chapter]++; }
  print(label, 'clear', 100 * clear / N, 'died', died.map(x => 100 * x / N).join('/'));
};
const boss3 = DUNGEON_CHAPTERS[2].boss;
measure('now');
boss3.bonus = -2; measure('boss3 -2');
boss3.bonus = -4; measure('boss3 -4');
boss3.bonus = -2; boss3.level = 2; measure('boss3 -2 Lv2');
