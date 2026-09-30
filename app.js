const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const state = { page:'home', balance:1000, gamesPlayed:0, wins:0, angle:0 };
const app = document.getElementById('app');
const title = document.getElementById('pageTitle');
const balance = document.getElementById('balance');
const toast = document.getElementById('toast');

const money = n => new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.floor(n)));
function setBalance(){ balance.textContent = `⚡ ${money(state.balance)}`; }
function notify(text){ toast.textContent=text; toast.classList.add('show'); clearTimeout(notify.t); notify.t=setTimeout(()=>toast.classList.remove('show'),1800); }

function render(){
  setBalance();
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));
  if(state.page==='home') renderHome();
  if(state.page==='games') renderGames();
  if(state.page==='tasks') renderTasks();
  if(state.page==='profile') renderProfile();
}

function renderHome(){
  title.textContent='Главное меню';
  app.innerHTML=`
    <section class="hero">
      <div class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div>
      <h2>Energy <span class="lime">Simulator</span></h2>
      <p>Собирай энергетики, выполняй задания и улучшай свою коллекцию.</p>
    </section>
    <div class="section-title">Полка · 0/9</div>
    <section class="shelf">${Array.from({length:9},(_,i)=>`<div class="slot"><span>＋</span><small>Ячейка ${i+1}</small></div>`).join('')}</section>
    <div class="section-title">Игры</div>
    <section class="card game-card"><div style="display:flex;gap:12px;align-items:center"><div class="game-icon">↑</div><div><h3>Upgrader</h3><p>Испытай удачу и улучши энергетик.</p></div></div><button class="primary" id="openUpgrade">Играть</button></section>`;
  document.getElementById('openUpgrade').onclick=()=>{state.page='games';render();setTimeout(openUpgrader,0)};
}

function renderGames(){
  title.textContent='Игры';
  app.innerHTML=`<div class="section-title">Доступная игра</div><section class="card game-card"><div style="display:flex;gap:12px;align-items:center"><div class="game-icon">↑</div><div><h3>Upgrader</h3><p>Выбери шанс и попробуй поднять предмет на следующий уровень.</p></div></div><button class="primary" id="openUpgrade">Открыть</button></section><div id="upgradeMount"></div>`;
  document.getElementById('openUpgrade').onclick=openUpgrader;
}

function openUpgrader(){
  const mount=document.getElementById('upgradeMount'); if(!mount)return;
  mount.innerHTML=`
  <section class="card upgrader">
    <div class="upgrade-head"><b>UPGRADER</b><div class="chance" id="chanceLabel">35%</div></div>
    <div class="wheel-wrap">
      <div class="wheel" id="wheel" style="--success-angle:126deg"><div class="wheel-inner"><div class="arrows"><span>⌃</span><span>⌃</span></div></div></div>
      <div class="pointer"></div>
    </div>
    <div class="upgrade-items"><div class="item"><div class="can">🥤</div><b>Energy Basic</b><small>×1.0</small></div><div class="arrow">➜</div><div class="item"><div class="can">⚡</div><b>Energy Pro</b><small>×2.0</small></div></div>
    <div class="controls">
      <div class="amount"><span>Шанс</span><input id="chance" type="range" min="10" max="70" value="35" step="1"><b id="chanceValue">35%</b></div>
      <button class="primary" id="upgradeBtn">⚡ Апгрейд · 50</button>
      <button class="primary" id="maxBtn">MAX</button>
    </div>
    <div class="result" id="result">Готов к апгрейду</div>
  </section>`;
  const chance=document.getElementById('chance');
  const chanceValue=document.getElementById('chanceValue');
  const chanceLabel=document.getElementById('chanceLabel');
  chance.oninput=()=>{chanceValue.textContent=chance.value+'%';chanceLabel.textContent=chance.value+'%';};
  document.getElementById('maxBtn').onclick=()=>{chance.value=70;chance.oninput();};
  document.getElementById('upgradeBtn').onclick=doUpgrade;
  mount.scrollIntoView({behavior:'smooth',block:'start'});
}

function doUpgrade(){
  const btn=document.getElementById('upgradeBtn'); const wheel=document.getElementById('wheel'); const result=document.getElementById('result'); const chance=Number(document.getElementById('chance').value);
  if(state.balance<50){result.textContent='Недостаточно энергии';result.className='result danger';notify('Нужно 50 энергии');return;}
  state.balance-=50; state.gamesPlayed++; setBalance(); btn.disabled=true; btn.textContent='Крутим...'; result.className='result muted'; result.textContent='Определяем результат...';
  const success=Math.random()*100<chance;
  const successAngle=chance*3.6;
  wheel.style.setProperty('--success-angle',`${successAngle}deg`);
  // The pointer is at 0deg; stop inside success sector on win, otherwise in the red part.
  const targetDeg=success ? (Math.random()*Math.max(4,successAngle-8)+4) : (successAngle+30+Math.random()*Math.max(5,330-successAngle));
  state.angle += 1080 + (360-targetDeg);
  wheel.style.transform=`rotate(${state.angle}deg)`;
  setTimeout(()=>{
    btn.disabled=false;btn.textContent='⚡ Апгрейд · 50';
    if(success){state.wins++;result.className='result';result.textContent='↑ УСПЕХ! Предмет улучшен';notify('Апгрейд успешен! + уровень');}
    else{result.className='result danger';result.textContent='✕ НЕУДАЧА — попробуй ещё раз';notify('Апгрейд не удался');}
  },3050);
}

function renderTasks(){
  title.textContent='Задания';
  app.innerHTML=`<div class="section-title">Ежедневные задания</div><section class="tasks"><div class="card task"><div><strong>Открыть Upgrader</strong><small>Награда: ⚡ 100</small></div><button class="primary" onclick="notify('Задание выполнено')">Забрать</button></div><div class="card task"><div><strong>Сделать 3 апгрейда</strong><small>Награда: ⚡ 250</small></div><button class="primary" onclick="notify('Сначала сыграй 3 раза')">Проверить</button></div><div class="card task"><div><strong>Посетить профиль</strong><small>Награда: ⚡ 50</small></div><button class="primary" onclick="notify('Задание выполнено')">Забрать</button></div></section>`;
}
function renderProfile(){
  title.textContent='Профиль';
  app.innerHTML=`<section class="card profile-head"><div class="avatar">⚡</div><div><div class="eyebrow">ИГРОК</div><h2 style="margin:0">Energy Hunter</h2><small class="muted">Telegram Mini App</small></div></section><div class="stat-grid"><div class="stat"><b>⚡ ${money(state.balance)}</b><span>Энергия</span></div><div class="stat"><b>${state.gamesPlayed}</b><span>Апгрейдов</span></div><div class="stat"><b>${state.wins}</b><span>Успешных</span></div><div class="stat"><b>${state.gamesPlayed?Math.round(state.wins/state.gamesPlayed*100):0}%</b><span>Винрейт</span></div></div>`;
}

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{state.page=btn.dataset.page;render();}));
render();
