const tg=window.Telegram?.WebApp;
const API_BASE=(window.ENERGY_BACKEND_URL||localStorage.getItem('energy_backend_url')||'').replace(/\/$/,'');
if(tg){tg.ready();tg.expand();tg.setHeaderColor?.('#070b07');tg.setBackgroundColor?.('#050805')}
const ADMIN_ID=8179254915;
const state={
  page:'home', balance:0, gamesPlayed:0, wins:0, depositsTotal:0, withdrawalsTotal:0, provider:'xrocket',
  chance:70, multiplier:2, stake:10, rotation:0, amount:10,
  chancePresets:{2:70,5:30,10:10,custom:50},
  items:[],
  user:(tg?.initDataUnsafe?.user)||null
};
try{const saved=JSON.parse(localStorage.getItem('energy_upgrader_settings')||'null');if(saved?.chancePresets)state.chancePresets={...state.chancePresets,...saved.chancePresets};}catch{}
const app=document.getElementById('app'), balanceEl=document.getElementById('balance'), toast=document.getElementById('toast');
const money=n=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:6}).format(Math.max(0,Number(n)||0));
const displayName=u=>[u?.first_name,u?.last_name].filter(Boolean).join(' ').trim()||'Игрок';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function notify(t){toast.textContent=t;toast.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),1800)}
function setBalance(){balanceEl.textContent=money(state.balance)}
function head(t,s){return `<div class="page-head"><h1>${t}</h1><p>${s}</p></div>`}
async function api(path,opts={}){
  if(!tg?.initData) throw new Error('Открой приложение через Telegram');
  const url=API_BASE+path;
  const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json','X-Telegram-Init-Data':tg.initData,...(opts.headers||{})}});
  if(!r.ok){let x={};try{x=await r.json()}catch{};throw new Error(x.error||'Ошибка сервера')}
  return r.json();
}
async function syncUser(){
  if(!tg?.initData) return;
  try{const d=await api('/api/me',{method:'POST',body:JSON.stringify({})});state.balance=d.user.balance||0;state.gamesPlayed=d.user.gamesPlayed||0;state.wins=d.user.wins||0;state.depositsTotal=d.user.depositsTotal||0;state.withdrawalsTotal=d.user.withdrawalsTotal||0;state.items=d.user.inventory||[];state.user=d.user;state.chancePresets={...state.chancePresets};setBalance()}catch(e){}
}
function nav(){document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page))}
function render(){nav();setBalance();({home,games,tasks,catalog,profile}[state.page]||home)()}
function home(){
  const rows=[0,1,2].map(()=>`<div class="shelf-level"><div class="shelf-board"></div>${[0,1,2].map(()=>`<div class="slot empty"></div>`).join('')}</div>`).join('');
  app.innerHTML=`${head('Главное меню','Твоя коллекция энергетиков')}
  <div class="section-title"><span>Моя витрина</span><em>0 / 9</em></div>
  <section class="display-shelf"><div class="shelf-frame"></div><div class="shelf-crown"></div>${rows}
  <div class="shelf-feet"><span></span><span></span></div><div class="shelf-caption">DESIGNER ENERGY DISPLAY</div></section>`;
}
function games(){
  app.innerHTML=`${head('Игры','Доступная игра')}
  <section class="card game-card"><div class="game-left"><div class="game-icon icon-upgrade">${icon('upgrade')}</div><div><h3>Upgrader</h3><p>Введи сумму и выбери множитель. Шанс подставится автоматически.</p></div></div>
  <button class="primary" id="openUpgrade">Играть</button></section><div id="upgradeMount"></div>`;
  document.getElementById('openUpgrade').onclick=openUpgrader;
}
function icon(name){
  const icons={
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.2a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z"/></svg>',
    games:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 5-4 5 4 4 5-4 5-5 4-5-4-4-5z"/><path d="m9 12 3-3 3 3-3 3z"/></svg>',
    tasks:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 8 1.5 1.5L12 7m-4 6 1.5 1.5L12 12m3-4h2m-2 4h2"/></svg>',
    catalog:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h2v2H8zm6 0h2v2h-2zM8 12h2v2H8zm6 0h2v2h-2zM8 16h2v2H8zm6 0h2v2h-2z"/></svg>',
    profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-4 2.9-6 6.5-6s5.8 2 6.5 6"/></svg>',
    upgrade:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7m0 0H9m8 0v8"/></svg>',
    gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 3.7.6-1.2h3.8l.6 1.2 1.6.8 1.3-.2 2.7 2.7-.2 1.3.8 1.6 1.2.6v3.8l-1.2.6-.8 1.6.2 1.3-2.7 2.7-1.3-.2-1.6.8-.6 1.2h-3.8l-.6-1.2-1.6-.8-1.3.2-2.7-2.7.2-1.3-.8-1.6-1.2-.6v-3.8l1.2-.6.8-1.6-.2-1.3 2.7-2.7 1.3.2z"/><circle cx="12" cy="12" r="3"/></svg>'
  }; return icons[name]||'';
}
function openUpgrader(){
  const m=document.getElementById('upgradeMount');
  const presets=state.chancePresets;
  m.innerHTML=`<section class="card upgrader">
  <div class="upgrade-head"><div><b>UPGRADER</b><div class="muted" style="font-size:9px;margin-top:4px">Сумма в USDT · шанс выбирается кнопкой</div></div>
  <button class="gear" id="gear" aria-label="Настройки">${icon('gear')}</button></div>
  <div class="upgrade-summary"><span>Шанс <b id="chanceLabel">${state.chance}%</b></span><span>Множитель <b id="multiplierLabel">X${state.multiplier}</b></span></div>
  <div class="wheel-wrap"><div class="wheel" id="wheel" style="--success-angle:${state.chance*3.6}deg"><div class="wheel-inner"><div class="wheel-core"><div class="arrows"><span>⌃</span><span>⌃</span></div></div></div></div><div class="pointer"></div></div>
  <div class="upgrade-items"><div class="item"><div class="can lime">E</div><b>Energy Basic</b><small>Ставка в USDT</small></div><div class="arrow">➜</div>
  <div class="item empty-result" id="targetItem"><div class="can">?</div><b>Результат</b><small>пусто</small></div></div>
  <div class="controls"><div class="amount-input"><label>Сумма</label><div class="usdt-input"><input id="stake" type="number" min="0.01" step="0.01" value="${state.stake}"><span>USDT</span></div></div>
  <div class="chance-buttons" id="chanceButtons">
    <button class="chance-btn ${state.multiplier===2?'active':''}" data-mult="2">X2 <small>${presets[2]}%</small></button>
    <button class="chance-btn ${state.multiplier===5?'active':''}" data-mult="5">X5 <small>${presets[5]}%</small></button>
    <button class="chance-btn ${state.multiplier===10?'active':''}" data-mult="10">X10 <small>${presets[10]}%</small></button>
    <button class="chance-btn ${state.multiplier==='custom'?'active':''}" data-mult="custom">% <small>${presets.custom}%</small></button>
  </div>
  <button class="primary upgrade-action" id="upgradeBtn">⚡ Апгрейд · ${state.stake.toFixed(2)} USDT</button></div>
  <div class="settings-panel" id="settings"><div class="settings-title">Настройки шансов</div><div class="settings-grid">
    <div class="field"><label>X2 — шанс %</label><input id="chance2" type="number" min="1" max="95" step="1" value="${presets[2]}"></div>
    <div class="field"><label>X5 — шанс %</label><input id="chance5" type="number" min="1" max="95" step="1" value="${presets[5]}"></div>
    <div class="field"><label>X10 — шанс %</label><input id="chance10" type="number" min="1" max="95" step="1" value="${presets[10]}"></div>
    <div class="field"><label>% — свой шанс</label><input id="chanceCustom" type="number" min="1" max="95" step="1" value="${presets.custom}"></div>
  </div><button class="primary" id="saveSettings" style="width:100%;margin-top:9px">Сохранить</button></div>
  <div class="result muted" id="result">Готов к апгрейду</div></section>`;
  const chanceLabel=document.getElementById('chanceLabel'), multiplierLabel=document.getElementById('multiplierLabel'), wheel=document.getElementById('wheel'), stake=document.getElementById('stake');
  const applyChoice=(mult)=>{state.multiplier=mult;state.chance=Number(state.chancePresets[mult]);multiplierLabel.textContent=mult==='custom'?'CUSTOM':'X'+mult;chanceLabel.textContent=state.chance+'%';wheel.style.setProperty('--success-angle',state.chance*3.6+'deg');document.querySelectorAll('.chance-btn').forEach(b=>b.classList.toggle('active',b.dataset.mult===String(mult)))};
  document.querySelectorAll('.chance-btn').forEach(b=>b.onclick=()=>applyChoice(b.dataset.mult==='custom'?'custom':Number(b.dataset.mult)));
  stake.oninput=()=>{state.stake=Math.max(0.01,Math.min(1000000,Number(stake.value)||0.01));document.getElementById('upgradeBtn').textContent=`⚡ Апгрейд · ${state.stake.toFixed(2)} USDT`};
  document.getElementById('gear').onclick=()=>document.getElementById('settings').classList.toggle('open');
  document.getElementById('saveSettings').onclick=()=>{state.chancePresets={2:clampChance(document.getElementById('chance2').value),5:clampChance(document.getElementById('chance5').value),10:clampChance(document.getElementById('chance10').value),custom:clampChance(document.getElementById('chanceCustom').value)};localStorage.setItem('energy_upgrader_settings',JSON.stringify({chancePresets:state.chancePresets}));applyChoice(state.multiplier);openUpgrader();notify('Шансы сохранены')};
  document.getElementById('upgradeBtn').onclick=doUpgrade;
  m.scrollIntoView({behavior:'smooth',block:'start'});
}
function clampChance(v){return Math.max(1,Math.min(95,Number(v)||1))}
async function doUpgrade(){
  const btn=document.getElementById('upgradeBtn'),wheel=document.getElementById('wheel'),result=document.getElementById('result'),target=document.getElementById('targetItem');
  const stake=Math.max(0.01,Number(document.getElementById('stake')?.value)||0);
  state.stake=stake;
  if(state.balance<stake){result.className='result gray';result.textContent=`Нужно ${stake.toFixed(2)} USDT для апгрейда`;notify('Недостаточно баланса');return}
  const chance=state.chance,multiplier=state.multiplier;
  btn.disabled=true;btn.textContent='Проверяем...';result.className='result muted';result.textContent='Проверяем ставку...';
  let data;
  try{data=await api('/api/game/upgrade',{method:'POST',body:JSON.stringify({stake,chance,multiplier})});}
  catch(e){btn.disabled=false;btn.textContent=`⚡ Апгрейд · ${stake.toFixed(2)} USDT`;result.className='result gray';result.textContent=e.message;notify(e.message);return}
  const success=Boolean(data.success);state.balance=Number(data.user?.balance??(state.balance-stake));state.gamesPlayed=Number(data.user?.gamesPlayed??state.gamesPlayed+1);state.wins=Number(data.user?.wins??(state.wins+(success?1:0)));setBalance();
  const successAngle=chance*3.6;const targetAngle=success?Math.random()*Math.max(1,successAngle-4)+2:successAngle+Math.random()*Math.max(1,360-successAngle-2)+1;
  btn.textContent='Крутим...';result.textContent='Колесо вращается...';state.rotation+=1080+(360-targetAngle);wheel.style.transform=`rotate(${state.rotation}deg)`;
  setTimeout(()=>{
    btn.disabled=false;btn.textContent=`⚡ Апгрейд · ${state.stake.toFixed(2)} USDT`;
    if(success){target.className='item';target.innerHTML=`<div class="can blue">E+</div><b>Energy Pro</b><small>X${multiplier}</small>`;result.className='result';result.textContent=`АПГРЕЙД УСПЕШЕН · X${multiplier}`;notify('Апгрейд успешен')}
    else{target.className='item empty-result';target.innerHTML='<div class="can">?</div><b>Пусто</b><small>результата нет</small>';result.className='result gray';result.textContent='Неудача — результат пустой';notify('Неудача — выпало пустое поле')}
  },3200);
}
function tasks(){app.innerHTML=`${head('Задания','Раздел пока пуст')}<section class="card empty-page"><div class="empty-icon">⌁</div><h2>Заданий пока нет</h2><p>Задания ещё не добавлены.</p></section>`}
function catalog(){app.innerHTML=`${head('Каталог','Энергетики и предметы')}<section class="card empty-page"><div class="empty-icon">▦</div><h2>Каталог пуст</h2><p>Предметы появятся здесь позже.</p></section>`}
function getUser(){return state.user||tg?.initDataUnsafe?.user||{}}
function avatarHtml(u){return u.photo_url?`<img class="avatar" src="${esc(u.photo_url)}" alt="">`:`<div class="avatar avatar-fallback">${esc((u.first_name||'E').slice(0,1).toUpperCase())}</div>`}
async function profile(){
  const u=getUser(),name=displayName(u),username=u.username?`@${u.username}`:'@—',id=u.id||'—';
  const admin=Number(u.id)===ADMIN_ID;
  app.innerHTML=`${head('Профиль','Данные из Telegram')}
  <section class="card profile-head">${avatarHtml(u)}<div><div class="eyebrow">TELEGRAM</div><h2 class="profile-name">${esc(name)}</h2><div class="profile-id">${esc(username)} <span>[${esc(id)}]</span></div></div></section>
  <section class="wallet-pair">
    <div class="card profile-stat"><div class="profile-stat-top"><span>Депозиты</span><b>${money(state.depositsTotal)} USDT</b></div><button class="wallet-btn" id="depositBtn">＋ Пополнить</button></div>
    <div class="card profile-stat"><div class="profile-stat-top"><span>Выводы</span><b>${money(state.withdrawalsTotal)} USDT</b></div><button class="wallet-btn" id="withdrawBtn">↗ Вывести</button></div>
  </section>
  <section class="profile-only-grid">
    <div class="card profile-stat"><div class="profile-stat-top"><span>Доход в минуту</span><b class="dash">—</b></div><small>Пока нет предметов, которые приносят доход.</small></div>
    <div class="card profile-stat"><div class="profile-stat-top"><span>Ваши предметы</span><b class="dash">—</b></div><small>Предметов пока нет.</small></div>
  </section>
  ${admin?`<section class="card admin-card"><div class="eyebrow">OWNER / ADMIN</div><h3>Панель владельца</h3><div class="muted" style="font-size:11px">ID ${ADMIN_ID}. Видит данные игроков только владелец.</div><div id="adminList" class="admin-list"><small class="muted">Загрузка...</small></div></section>`:''}`;
  document.getElementById('depositBtn').onclick=()=>walletModal('deposit');
  document.getElementById('withdrawBtn').onclick=()=>walletModal('withdraw');
  if(admin)loadAdmin();
}
async function loadAdmin(){
  const box=document.getElementById('adminList');try{const d=await api('/api/admin/users',{method:'GET'});box.innerHTML=d.users.length?d.users.slice(0,30).map(x=>`<div class="admin-user"><div><b>${esc(x.username||x.first_name||'Игрок')}</b><small>[${x.id}] · ${money(x.balance)} USDT</small></div><small>${x.inventory?.length||0} предметов</small></div>`).join(''):'<small class="muted">Игроков пока нет</small>'}catch(e){box.innerHTML=`<small class="muted">${esc(e.message)}</small>`}
}
function walletModal(mode){
  document.querySelector('.modal')?.remove();const dep=mode==='deposit';
  const isCrypto=state.provider==='cryptobot';
  document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="modal-card"><div class="modal-title"><h3>${dep?'Пополнить баланс':'Вывести средства'}</h3><button class="close" id="closeModal">×</button></div>
  <div class="provider-row"><button class="provider ${state.provider==='cryptobot'?'active':''}" data-p="cryptobot">CryptoBot</button><button class="provider ${state.provider==='xrocket'?'active':''}" data-p="xrocket">xRocket</button></div>
  <div class="field" style="margin-top:10px"><label>Сумма USDT</label><input id="walletAmount" type="number" min="1" step="0.01" placeholder="10"></div>
  ${!dep&&!isCrypto?'<div class="field" style="margin-top:10px"><label>Сеть</label><select id="walletNetwork"><option value="TON">TON</option><option value="TRX">TRX</option><option value="BSC">BSC</option><option value="ETH">ETH</option><option value="SOL">SOL</option></select></div>':''}
  ${!dep&&!isCrypto?'<div class="field" style="margin-top:10px"><label>Адрес кошелька</label><input id="walletAddress" placeholder="USDT address"></div>':''}
  ${!dep&&isCrypto?`<div class="wallet-recipient">Получатель CryptoBot: <b>${esc(idSafe())}</b><br><small>Вывод будет отправлен на ваш Telegram ID через Crypto Pay.</small></div>`:''}
  <div class="wallet-status">${dep?'После оплаты провайдер подтвердит реальный платёж, и сумма будет зачислена на баланс.':'Средства списываются при успешной отправке вывода. При ошибке сервер возвращает сумму.'}</div>
  <div class="modal-actions"><button class="wallet-btn" id="cancel">Отмена</button><button class="primary" id="submit">${dep?'Создать инвойс':'Создать вывод'}</button></div></div></div>`);
  document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{state.provider=b.dataset.p;walletModal(mode)});
  document.getElementById('closeModal').onclick=closeModal;document.getElementById('cancel').onclick=closeModal;
  document.getElementById('submit').onclick=async()=>{
    const amount=+document.getElementById('walletAmount').value;if(!amount||amount<=0){notify('Укажи сумму');return}
    const body={provider:state.provider,amount};
    if(!dep&&state.provider==='xrocket'){body.address=document.getElementById('walletAddress').value.trim();body.network=document.getElementById('walletNetwork').value;if(!body.address){notify('Укажи адрес');return}}
    try{const d=await api(dep?'/api/wallet/deposit':'/api/wallet/withdraw',{method:'POST',body:JSON.stringify(body)});
      if(d.payUrl){tg?.openLink?.(d.payUrl);notify('Инвойс создан')}else {notify(d.message||'Вывод создан');await syncUser();render()} closeModal()
    }catch(e){notify(e.message)}
  };
}
function idSafe(){return getUser().id||'—'}
function closeModal(){document.querySelector('.modal')?.remove()}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{state.page=b.dataset.page;render()}));
syncUser().finally(render);
