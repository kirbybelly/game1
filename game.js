const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  gold: document.getElementById('gold'),
  allyBaseHp: document.getElementById('allyBaseHp'),
  enemyBaseHp: document.getElementById('enemyBaseHp'),
  wave: document.getElementById('wave'),
};

const LANE_Y = canvas.height * 0.72;
const ALLY_BASE_X = 70;
const ENEMY_BASE_X = canvas.width - 130;

const UNIT_TYPES = {
  basic: { name: '기본 냥이', cost: 50, hp: 90, atk: 14, range: 28, speed: 1.1, atkCooldown: 650, size: 21, color: '#ffffff' },
  tank: { name: '탱커 냥이', cost: 90, hp: 190, atk: 10, range: 24, speed: 0.7, atkCooldown: 850, size: 25, color: '#ffe18f' },
  fast: { name: '질주 냥이', cost: 70, hp: 65, atk: 18, range: 20, speed: 1.8, atkCooldown: 540, size: 18, color: '#8fffe6' },
};

const ENEMY_TYPES = [
  { hp: 80, atk: 10, range: 24, speed: 0.9, atkCooldown: 780, size: 20, color: '#ff918f' },
  { hp: 120, atk: 14, range: 26, speed: 0.8, atkCooldown: 830, size: 23, color: '#ffb28f' },
  { hp: 75, atk: 18, range: 18, speed: 1.5, atkCooldown: 580, size: 17, color: '#ffc7d9' },
];

let state;

function resetGame() {
  state = {
    isPaused: false,
    isOver: false,
    winnerText: '',
    time: 0,
    gold: 120,
    wave: 1,
    allyBaseHp: 2200,
    enemyBaseHp: 2200,
    units: [],
    enemies: [],
    lastGoldTick: 0,
    lastEnemySpawn: 0,
  };
  updateHud();
}

function makeCharacter(side, x, profile) {
  return {
    side,
    x,
    y: LANE_Y,
    hp: profile.hp,
    maxHp: profile.hp,
    atk: profile.atk,
    range: profile.range,
    speed: profile.speed,
    atkCooldown: profile.atkCooldown,
    cooldownLeft: 0,
    size: profile.size,
    color: profile.color,
  };
}

function summonUnit(typeKey) {
  const type = UNIT_TYPES[typeKey];
  if (!type || state.isPaused || state.isOver) return;
  if (state.gold < type.cost) return;
  state.gold -= type.cost;
  state.units.push(makeCharacter('ally', ALLY_BASE_X + 35, type));
  updateHud();
}

function spawnEnemy() {
  const roll = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
  const scaled = {
    ...roll,
    hp: Math.round(roll.hp * (1 + (state.wave - 1) * 0.15)),
    atk: Math.round(roll.atk * (1 + (state.wave - 1) * 0.12)),
  };
  state.enemies.push(makeCharacter('enemy', ENEMY_BASE_X - 35, scaled));
}

function findTarget(actor, opponents) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of opponents) {
    const dist = Math.abs(enemy.x - actor.x);
    if (dist < nearestDist) {
      nearest = enemy;
      nearestDist = dist;
    }
  }
  return nearest && nearestDist <= actor.range + actor.size + nearest.size ? nearest : null;
}

function stepActors(dt, actors, opponents, attackBaseFn) {
  for (const actor of actors) {
    if (actor.cooldownLeft > 0) actor.cooldownLeft -= dt;

    const target = findTarget(actor, opponents);
    if (target) {
      if (actor.cooldownLeft <= 0) {
        target.hp -= actor.atk;
        actor.cooldownLeft = actor.atkCooldown;
      }
      continue;
    }

    const dir = actor.side === 'ally' ? 1 : -1;
    actor.x += actor.speed * dir * (dt / 16.67);

    if (actor.side === 'ally' && actor.x + actor.size >= ENEMY_BASE_X - 20) {
      if (actor.cooldownLeft <= 0) {
        attackBaseFn('enemy', actor.atk);
        actor.cooldownLeft = actor.atkCooldown;
      }
    }

    if (actor.side === 'enemy' && actor.x - actor.size <= ALLY_BASE_X + 20) {
      if (actor.cooldownLeft <= 0) {
        attackBaseFn('ally', actor.atk);
        actor.cooldownLeft = actor.atkCooldown;
      }
    }
  }
}

function attackBase(side, damage) {
  if (side === 'enemy') {
    state.enemyBaseHp -= damage;
  } else {
    state.allyBaseHp -= damage;
  }
}

function cleanup() {
  state.units = state.units.filter((u) => u.hp > 0 && u.x < canvas.width + 50 && u.x > -50);
  state.enemies = state.enemies.filter((e) => e.hp > 0 && e.x < canvas.width + 50 && e.x > -50);
}

function update(dt) {
  if (state.isPaused || state.isOver) return;
  state.time += dt;

  if (state.time - state.lastGoldTick >= 700) {
    state.lastGoldTick = state.time;
    state.gold += 10;
  }

  const spawnInterval = Math.max(450, 1650 - state.wave * 45);
  if (state.time - state.lastEnemySpawn >= spawnInterval) {
    state.lastEnemySpawn = state.time;
    spawnEnemy();
  }

  if (state.time > state.wave * 18000) {
    state.wave += 1;
  }

  stepActors(dt, state.units, state.enemies, attackBase);
  stepActors(dt, state.enemies, state.units, attackBase);

  cleanup();

  if (state.allyBaseHp <= 0) {
    state.isOver = true;
    state.winnerText = '패배... 적이 기지를 파괴했습니다.';
  } else if (state.enemyBaseHp <= 0) {
    state.isOver = true;
    state.winnerText = '승리! 적 기지를 파괴했습니다!';
  }

  updateHud();
}

function drawBase(x, hp, maxHp, label, color) {
  const width = 70;
  const height = 140;
  const y = LANE_Y - height;

  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width, height);

  const hpRatio = Math.max(0, hp / maxHp);
  ctx.fillStyle = '#222';
  ctx.fillRect(x - 45, y - 18, 90, 10);
  ctx.fillStyle = hpRatio > 0.3 ? '#5de48e' : '#ff5f76';
  ctx.fillRect(x - 45, y - 18, 90 * hpRatio, 10);

  ctx.fillStyle = '#111';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(label, x - 28, y - 26);
}

function drawActor(actor) {
  ctx.beginPath();
  ctx.fillStyle = actor.color;
  ctx.arc(actor.x, actor.y, actor.size, 0, Math.PI * 2);
  ctx.fill();

  const barW = actor.size * 2;
  const ratio = Math.max(0, actor.hp / actor.maxHp);
  ctx.fillStyle = '#1c2233';
  ctx.fillRect(actor.x - actor.size, actor.y - actor.size - 12, barW, 6);
  ctx.fillStyle = '#66df8e';
  ctx.fillRect(actor.x - actor.size, actor.y - actor.size - 12, barW * ratio, 6);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#4f6f38';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, LANE_Y + 26);
  ctx.lineTo(canvas.width, LANE_Y + 26);
  ctx.stroke();

  drawBase(ALLY_BASE_X, state.allyBaseHp, 2200, '아군기지', '#d9f5ff');
  drawBase(ENEMY_BASE_X, state.enemyBaseHp, 2200, '적기지', '#ffd4d1');

  for (const unit of state.units) drawActor(unit);
  for (const enemy of state.enemies) drawActor(enemy);

  if (state.isPaused && !state.isOver) {
    ctx.fillStyle = 'rgba(10, 10, 20, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PAUSED', canvas.width / 2 - 120, canvas.height / 2);
  }

  if (state.isOver) {
    ctx.fillStyle = 'rgba(10, 10, 20, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(state.winnerText, canvas.width / 2 - 260, canvas.height / 2);
  }
}

function updateHud() {
  hud.gold.textContent = `${state.gold}`;
  hud.allyBaseHp.textContent = `${Math.max(0, Math.round(state.allyBaseHp))}`;
  hud.enemyBaseHp.textContent = `${Math.max(0, Math.round(state.enemyBaseHp))}`;
  hud.wave.textContent = `${state.wave}`;

  document.querySelectorAll('[data-unit]').forEach((btn) => {
    const t = UNIT_TYPES[btn.dataset.unit];
    btn.disabled = state.gold < t.cost || state.isPaused || state.isOver;
  });
}

let lastTs = performance.now();
function loop(ts) {
  const dt = ts - lastTs;
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

for (const btn of document.querySelectorAll('[data-unit]')) {
  btn.addEventListener('click', () => summonUnit(btn.dataset.unit));
}

document.getElementById('pauseBtn').addEventListener('click', () => {
  if (state.isOver) return;
  state.isPaused = !state.isPaused;
  document.getElementById('pauseBtn').textContent = state.isPaused ? '재개' : '일시정지';
  updateHud();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  resetGame();
  document.getElementById('pauseBtn').textContent = '일시정지';
});

resetGame();
requestAnimationFrame(loop);
