// ダンジョンのクリア率を、乱数を変えて多めに測る（通常の難しさ）
const COSTC = ['r18', 'b18', 'g17', 'y19', 'y20', 'p18', 'e44', 'f30', 'f31'];
function run(label, seed, N) {
  const rng = seededRng(seed);
  const profile = newProfile(); profile.dungeon.maxTrial = 10; profile.hero.unlocked = HEROES.map(h => h.id); HEROES.forEach(h => { profile.hero.levels[h.id] = 1; });
  let clear = 0; const died = [0, 0, 0];
  for (let i = 0; i < N; i++) { const r = playRun(profile, HEROES[i % HEROES.length].id, 0, Math.floor(rng() * 4e9), autoStrongAction, rng); if (r.over === 'clear') clear++; else died[r.chapter]++; }
  print(label, 'runs', N, 'clear', Math.round(1000 * clear / N) / 10, 'died', died.map(x => Math.round(1000 * x / N) / 10).join('/'));
}
run('seed ' + SEED, SEED, 300);
