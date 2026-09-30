const tg=window.Telegram?.WebApp;
const API_BASE=(window.ENERGY_BACKEND_URL||localStorage.getItem('energy_backend_url')||'').replace(/\/$/,'');
if(tg){tg.ready();tg.expand();tg.setHeaderColor?.('#070b07');tg.setBackgroundColor?.('#050805')}
const ADMIN_ID=8179254915;
const state={
  page:'home', balance:0, gamesPlayed:0, wins:0, depositsTotal:0, withdrawalsTotal:0, provider:'xrocket',
  chance:70, multiplier:2, stake:50, rotation:0,
  items:[],
  user:(tg?.initDataUnsafe?.user)||null
};
const app=document.getElementById('app'), balanceEl=document.getElementById('balance'), toast=document.getElementById('toast');
const money=n=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Math.floor(Number(n)||0)));
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
  try{const d=await api('/api/me',{method:'POST',body:JSON.stringify({})});state.balance=d.user.balance||0;state.gamesPlayed=d.user.gamesPlayed||0;state.wins=d.user.wins||0;state.depositsTotal=d.user.depositsTotal||0;state.withdrawalsTotal=d.user.withdrawalsTotal||0;state.items=d.user.inventory||[];state.user=d.user;setBalance()}catch(e){}
}
function nav(){document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page))}
function render(){nav();setBalance();({home,games,tasks,catalog,profile}[state.page]||home)()}
function home(){
  const rows=[0,1,2].map(()=>`<div class="shelf-level"><div class="shelf-board"></div>${[0,1,2].map(()=>`<div class="slot empty"></div>`).join('')}</div>`).join('');
  app.innerHTML=`${head('Главное меню','Твоя коллекция энергетиков')}
  <section class="card hero"><div class="eyebrow">ENERGY COLLECTION</div><h2>Собирай. <span class="lime">Выставляй.</span></h2>
  <p>Получай энергетики и выставляй их на своей дизайнерской витрине.</p></section>
  <div class="section-title"><span>Моя витрина</span><em>0 / 9</em></div>
  <section class="display-shelf"><div class="shelf-frame"></div><div class="shelf-crown"></div>${rows}
  <div class="shelf-feet"><span></span><span></span></div><div class="shelf-caption">DESIGNER ENERGY DISPLAY</div></section>`;
}
function games(){
  app.innerHTML=`${head('Игры','Доступная игра')}
  <section class="card game-card"><div class="game-left"><div class="game-icon">↑</div><div><h3>Upgrader</h3><p>Настрой X и шанс, затем попробуй улучшить предмет.</p></div></div>
  <button class="primary" id="openUpgrade">Играть</button></section><div id="upgradeMount"></div>`;
  document.getElementById('openUpgrade').onclick=openUpgrader;
}
function openUpgrader(){
  const m=document.getElementById('upgradeMount');
  m.innerHTML=`<section class="card upgrader">
  <div class="upgrade-head"><div><b>UPGRADER</b><div class="muted" style="font-size:9px;margin-top:4px">X${state.multiplier.toFixed(2)} · шанс ${state.chance}%</div></div>
  <div style="display:flex;align-items:center;gap:8px"><div class="chance" id="chanceLabel">${state.chance}%</div><button class="gear" id="gear">⚙</button></div></div>
  <div class="wheel-wrap"><div class="wheel" id="wheel" style="--success-angle:${state.chance*3.6}deg"><div class="wheel-inner"><div class="wheel-core">
  <div class="arrows"><span>⌃</span><span>⌃</span></div></div></div></div><div class="pointer"></div></div>
  <div class="upgrade-items"><div class="item"><div class="can lime">E</div><b>Energy Basic</b><small>Ставка ${state.stake} ⚡</small></div><div class="arrow">➜</div>
  <div class="item empty-result" id="targetItem"><div class="can">?</div><b>Результат</b><small>пусто</small></div></div>
  <div class="controls"><div class="amount"><span>Шанс</span><input id="chance" type="range" min="1" max="95" value="${state.chance}"><b id="chanceValue">${state.chance}%</b></div>
  <button class="primary" id="upgradeBtn">⚡ Апгрейд · ${state.stake}</button><button class="primary" id="maxBtn">MAX</button></div>
  <div class="settings-panel" id="settings"><div class="settings-grid"><div class="field"><label>Множитель X</label><input id="multiplier" type="number" min="1.01" max="100" step="0.01" value="${state.multiplier}"></div>
  <div class="field"><label>Шанс успеха %</label><input id="chanceSet" type="number" min="1" max="95" step="1" value="${state.chance}"></div></div>
  <div class="settings-help">Настрой X (во сколько раз увеличивается предмет) и процент успеха. Чем выше X, тем меньше шанс обычно имеет смысл ставить.</div>
  <button class="primary" id="saveSettings" style="width:100%;margin-top:9px">Сохранить настройки</button></div>
  <div class="result muted" id="result">Готов к апгрейду</div></section>`;
  const chance=document.getElementById('chance'), cv=document.getElementById('chanceValue'), cl=document.getElementById('chanceLabel'), wheel=document.getElementById('wheel');
  const syncChance=()=>{state.chance=Math.max(1,Math.min(95,+chance.value||70));cv.textContent=state.chance+'%';cl.textContent=state.chance+'%';wheel.style.setProperty('--success-angle',state.chance*3.6+'deg')};
  chance.oninput=syncChance;
  document.getElementById('maxBtn').onclick=()=>{chance.value=95;syncChance()};
  document.getElementById('gear').onclick=()=>document.getElementById('settings').classList.toggle('open');
  document.getElementById('saveSettings').onclick=()=>{let x=Math.max(1.01,Math.min(100,+document.getElementById('multiplier').value||2));let c=Math.max(1,Math.min(95,+document.getElementById('chanceSet').value||70));state.multiplier=x;state.chance=c;chance.value=c;syncChance();openUpgrader();notify('Настройки сохранены')};
  document.getElementById('upgradeBtn').onclick=doUpgrade;
  m.scrollIntoView({behavior:'smooth',block:'start'});
}
function doUpgrade(){
  const btn=document.getElementById('upgradeBtn'),wheel=document.getElementById('wheel'),result=document.getElementById('result'),target=document.getElementById('targetItem');
  if(state.balance<state.stake){result.className='result gray';result.textContent=`Нужно ${state.stake} ⚡ для апгрейда`;notify('Недостаточно баланса');return}
  const chance=state.chance;const success=Math.random()*100<chance;const successAngle=chance*3.6;
  const targetAngle=success?Math.random()*Math.max(1,successAngle-4)+2:successAngle+Math.random()*Math.max(1,360-successAngle-2)+1;
  state.balance-=state.stake;state.gamesPlayed++;setBalance();btn.disabled=true;btn.textContent='Крутим...';result.className='result muted';result.textContent='Колесо вращается...';
  state.rotation+=1080+(360-targetAngle);wheel.style.transform=`rotate(${state.rotation}deg)`;
  setTimeout(async()=>{
    btn.disabled=false;btn.textContent=`⚡ Апгрейд · ${state.stake}`;
    if(success){state.wins++;target.className='item';target.innerHTML=`<div class="can blue">E+</div><b>Energy Pro</b><small>X${state.multiplier.toFixed(2)}</small>`;result.className='result';result.textContent=`АПГРЕЙД УСПЕШЕН · X${state.multiplier.toFixed(2)}`;notify('Апгрейд успешен')}
    else{target.className='item empty-result';target.innerHTML='<div class="can">?</div><b>Пусто</b><small>результата нет</small>';result.className='result gray';result.textContent='Неудача — результат пустой';notify('Неудача — выпало пустое поле')}
    try{await api('/api/game/upgrade',{method:'POST',body:JSON.stringify({success,stake:state.stake,chance,multiplier:state.multiplier})})}catch(e){}
  },3200);
}
function tasks(){app.innerHTML=`${head('Задания','Раздел пока пуст')}<section class="card empty-page"><div class="empty-icon">⌁</div><h2>Заданий пока нет</h2><p>Задания ещё не добавлены.</p></section>`}
function catalog(){app.innerHTML=`${head('Каталог','Энергетики и предметы')}<section class="card empty-page"><div class="empty-icon">▦</div><h2>Каталог пуст</h2><p>Предметы появятся здесь позже.</p></section>`}
function getUser(){return state.user||tg?.initDataUnsafe?.user||{}}
function avatarHtml(u){return u.photo_url?`<img class="avatar" src="${esc(u.photo_url)}" alt="">`:`<div class="avatar avatar-fallback">${esc((u.first_name||'E').slice(0,1).toUpperCase())}</div>`}
async function profile(){
  const u=getUser(),name=u.username?`@${u.username}`:(u.first_name||'Игрок'),id=u.id||'—';
  const admin=Number(u.id)===ADMIN_ID;
  app.innerHTML=`${head('Профиль','Данные из Telegram')}
  <section class="card profile-head">${avatarHtml(u)}<div><div class="eyebrow">TELEGRAM</div><h2 class="profile-name">${esc(name)}</h2><div class="profile-id">[${esc(id)}]</div></div></section>
  <section class="profile-only-grid">
    <div class="card profile-stat"><div class="profile-stat-top"><span>Депозиты</span><b>${money(state.depositsTotal)} USDT</b></div><button class="wallet-btn" id="depositBtn">＋ Пополнить</button></div>
    <div class="card profile-stat"><div class="profile-stat-top"><span>Выводы</span><b>${money(state.withdrawalsTotal)} USDT</b></div><button class="wallet-btn" id="withdrawBtn">↗ Вывести</button></div>
    <div class="card profile-stat"><div class="profile-stat-top"><span>Доход в минуту</span><b class="dash">—</b></div><small>Пока нет предметов, которые приносят доход.</small></div>
    <div class="card profile-stat"><div class="profile-stat-top"><span>Ваши предметы</span><b class="dash">—</b></div><small>Предметов пока нет.</small></div>
  </section>
  ${admin?`<section class="card admin-card"><div class="eyebrow">OWNER / ADMIN</div><h3>Панель владельца</h3><div class="muted" style="font-size:11px">ID ${ADMIN_ID}. Видит данные игроков только владелец.</div><div id="adminList" class="admin-list"><small class="muted">Загрузка...</small></div></section>`:''}`;
  document.getElementById('depositBtn').onclick=()=>walletModal('deposit');
  document.getElementById('withdrawBtn').onclick=()=>walletModal('withdraw');
  if(admin)loadAdmin();
}
async function loadAdmin(){
  const box=document.getElementById('adminList');try{const d=await api('/api/admin/users',{method:'GET'});box.innerHTML=d.users.length?d.users.slice(0,30).map(x=>`<div class="admin-user"><div><b>${esc(x.username||x.first_name||'Игрок')}</b><small>[${x.id}] · ${money(x.balance)} ⚡</small></div><small>${x.inventory?.length||0} предметов</small></div>`).join(''):'<small class="muted">Игроков пока нет</small>'}catch(e){box.innerHTML=`<small class="muted">${esc(e.message)}</small>`}
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
