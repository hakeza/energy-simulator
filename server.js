require('dotenv').config();
const express=require('express');
const cors=require('cors');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const {Telegraf,Markup}=require('telegraf');

const PORT=Number(process.env.PORT||3000);
const BOT_TOKEN=process.env.BOT_TOKEN||'';
const ADMIN_ID=Number(process.env.ADMIN_ID||8179254915);
const WEBAPP_URL=process.env.WEBAPP_URL||'https://hakeza.github.io/energy-simulator/';
const BACKEND_PUBLIC_URL=(process.env.BACKEND_PUBLIC_URL||'').replace(/\/$/,'');
const CRYPTO_PAY_TOKEN=process.env.CRYPTO_PAY_TOKEN||'';
const XR_TOKEN=process.env.XR_TOKEN||'';
const XR_BASE=(process.env.XR_BASE||'https://pay.api.xrocket.exchange').replace(/\/$/,'');
const DATA_FILE=path.join(__dirname,'data.json');
const app=express();
app.use(cors());
app.use(express.json());

const emptyDb={users:{},invoices:{},withdrawals:{},gameRounds:{}};
let db=emptyDb;
try{db=fs.existsSync(DATA_FILE)?{...emptyDb,...JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}:emptyDb;db.gameRounds=db.gameRounds||{}}catch{db=emptyDb}
function save(){fs.writeFileSync(DATA_FILE,JSON.stringify(db,null,2))}
function verifyTelegram(initData){
  if(!initData||!BOT_TOKEN)return null;
  const p=new URLSearchParams(initData),hash=p.get('hash');if(!hash)return null;p.delete('hash');
  const data=[...p.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const calc=crypto.createHmac('sha256',secret).update(data).digest('hex');
  if(calc.length!==hash.length||!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(hash)))return null;
  const authDate=Number(p.get('auth_date')||0);if(!authDate||Date.now()/1000-authDate>86400)return null;
  try{return JSON.parse(p.get('user')||'null')}catch{return null}
}
function auth(req,res,next){const u=verifyTelegram(req.get('X-Telegram-Init-Data'));if(!u)return res.status(401).json({error:'Telegram authorization required'});req.user=u;next()}
function userRecord(u){
  const id=String(u.id);
  if(!db.users[id])db.users[id]={id:u.id,username:u.username||'',first_name:u.first_name||'',last_name:u.last_name||'',photo_url:u.photo_url||'',balance:0,depositsTotal:0,withdrawalsTotal:0,gamesPlayed:0,wins:0,inventory:[],createdAt:new Date().toISOString()};
  else Object.assign(db.users[id],{username:u.username||'',first_name:u.first_name||'',last_name:u.last_name||'',photo_url:u.photo_url||'',depositsTotal:Number(db.users[id].depositsTotal||0),withdrawalsTotal:Number(db.users[id].withdrawalsTotal||0)});
  return db.users[id]
}
function numericAmount(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n*1000000)/1000000:0}
function creditInvoice(record,paidAmount){
  if(!record||record.status==='paid')return false;
  const u=db.users[String(record.telegramId)];if(!u)return false;
  const amount=numericAmount(paidAmount||record.amount);if(!amount)return false;
  u.balance=Number(u.balance||0)+amount;u.depositsTotal=Number(u.depositsTotal||0)+amount;
  record.status='paid';record.paidAmount=amount;record.paidAt=new Date().toISOString();save();return true;
}
async function cryptoRequest(method,body){
  const r=await fetch(`https://pay.crypt.bot/api/${method}`,{method:'POST',headers:{'Crypto-Pay-API-Token':CRYPTO_PAY_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error?.name||d.error?.message||`CryptoBot ${r.status}`);return d.result;
}
async function xrocketRequest(method,body){
  const r=await fetch(`${XR_BASE}${method}`,{method:'POST',headers:{Authorization:`Bearer ${XR_TOKEN}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body||{})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||d.title||`xRocket ${r.status}`);return d;
}

app.post('/api/me',auth,(req,res)=>{const u=userRecord(req.user);save();res.json({user:u})});
app.get('/api/admin/users',auth,(req,res)=>{if(Number(req.user.id)!==ADMIN_ID)return res.status(403).json({error:'Forbidden'});res.json({users:Object.values(db.users)})});
app.post('/api/game/upgrade',auth,(req,res)=>{
  const u=userRecord(req.user),s=numericAmount(req.body.stake);
  const requestedChance=Number(req.body.chance);
  const requestId=String(req.body.requestId||'').trim();
  if(!requestId||requestId.length>100)return res.status(400).json({error:'Некорректный идентификатор ставки'});
  const existing=db.gameRounds[requestId];
  if(existing){
    if(Number(existing.telegramId)!==Number(u.id))return res.status(403).json({error:'Раунд принадлежит другому игроку'});
    return res.json({success:existing.success,chance:existing.chance,multiplier:existing.multiplier,roll:existing.roll,payout:existing.payout||0,user:u,roundId:requestId,replayed:true});
  }
  if(!s||u.balance<s)return res.status(400).json({error:'Недостаточно средств'});
  if(!Number.isFinite(requestedChance)||requestedChance<1||requestedChance>95){
    return res.status(400).json({error:'Некорректный шанс'});
  }
  // Server is authoritative: multiplier is ALWAYS derived from the locked chance.
  const chance=Number(requestedChance.toFixed(6));
  const multiplier=Number((100/chance).toFixed(6));
  const roll=crypto.randomInt(0,1000000)/10000; // 0..99.9999
  const success=roll<chance;
  const payout=success?Number((s*multiplier).toFixed(6)):0;
  u.balance=Number((Number(u.balance)-s+payout).toFixed(6));
  u.gamesPlayed=Number(u.gamesPlayed||0)+1;
  if(success)u.wins=Number(u.wins||0)+1;
  const round={requestId,telegramId:u.id,stake:s,chance,multiplier,roll,success,payout,createdAt:new Date().toISOString()};
  db.gameRounds[requestId]=round;
  save();
  res.json({success,chance,multiplier,roll,payout,user:u,roundId:requestId});
});

app.post('/api/wallet/deposit',auth,async(req,res)=>{
  const amount=numericAmount(req.body.amount),provider=req.body.provider;if(!amount)return res.status(400).json({error:'Invalid amount'});
  const u=userRecord(req.user),clientId=`dep-${u.id}-${Date.now()}`;
  try{
    if(provider==='cryptobot'){
      if(!CRYPTO_PAY_TOKEN)return res.status(503).json({error:'CryptoBot API token is not configured'});
      const inv=await cryptoRequest('createInvoice',{asset:'USDT',amount:String(amount),description:`Energy Simulator deposit for ${u.id}`,payload:clientId,allow_comments:false,allow_anonymous:false,expires_in:3600});
      db.invoices[clientId]={provider,telegramId:u.id,amount,status:'active',remoteId:inv.invoice_id,invoice:inv,createdAt:new Date().toISOString()};save();
      return res.json({payUrl:inv.mini_app_invoice_url||inv.web_app_invoice_url||inv.bot_invoice_url});
    }
    if(provider==='xrocket'){
      if(!XR_TOKEN)return res.status(503).json({error:'xRocket API token is not configured'});
      const inv=await xrocketRequest('/api/v1/invoices',{priceAmount:String(amount),priceCurrency:'USDT',payoutCurrency:'USDT',payCurrencies:['USDT'],clientInvoiceId:clientId,description:`Energy Simulator deposit for ${u.id}`,expiresIn:3600000,customer:{id:String(u.id),telegramId:String(u.id),telegramUsername:u.username||''},callback:BACKEND_PUBLIC_URL?{callbackUrl:`${BACKEND_PUBLIC_URL}/webhooks/xrocket`}:undefined,data:{orderId:clientId}});
      db.invoices[clientId]={provider,telegramId:u.id,amount,status:'active',remoteId:inv.id,invoice:inv,createdAt:new Date().toISOString()};save();
      return res.json({payUrl:inv.links?.telegramBotLink||inv.links?.webLink});
    }
    res.status(400).json({error:'Unknown provider'});
  }catch(e){res.status(400).json({error:e.message})}
});

app.post('/api/wallet/withdraw',auth,async(req,res)=>{
  const amount=numericAmount(req.body.amount),provider=req.body.provider;
  const u=userRecord(req.user);
  if(!amount)return res.status(400).json({error:'Invalid withdrawal'});
  if(u.balance<amount)return res.status(400).json({error:'Недостаточно средств'});
  const id=`wd-${u.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const row={id,provider,telegramId:u.id,amount,status:'pending',createdAt:new Date().toISOString()};db.withdrawals[id]=row;
  try{
    // Both withdrawal methods are account-to-account transfers. No network or wallet address is requested.
    u.balance=Number((Number(u.balance)-amount).toFixed(6));save();
    if(provider==='xrocket'){
      if(!XR_TOKEN)return res.status(503).json({error:'xRocket API token is not configured'});
      const remote=await xrocketRequest('/api/v1/payouts',{
        clientPayoutId:id,
        targetType:'telegram_user_id',
        target:String(u.id),
        asset:'USDT',
        amount:String(amount),
        description:`Energy Simulator withdrawal ${id}`,
        callback:BACKEND_PUBLIC_URL?{callbackUrl:`${BACKEND_PUBLIC_URL}/webhooks/xrocket`,payload:{withdrawalId:id}}:undefined
      });
      row.remote=remote;row.remoteId=remote.payoutId||remote.id;row.status=remote.status||'finished';
      if(row.status==='finished')u.withdrawalsTotal=Number(u.withdrawalsTotal||0)+amount;
      save();return res.json({message:'Вывод отправлен через xRocket',id,status:row.status});
    }
    if(provider==='cryptobot'){
      if(!CRYPTO_PAY_TOKEN)return res.status(503).json({error:'CryptoBot API token is not configured'});
      const transfer=await cryptoRequest('transfer',{user_id:u.id,asset:'USDT',amount:String(amount),spend_id:id,comment:`Energy Simulator withdrawal ${id}`});
      row.remote=transfer;row.remoteId=transfer.transfer_id;row.status='paid';u.withdrawalsTotal=Number(u.withdrawalsTotal||0)+amount;save();
      return res.json({message:'Вывод отправлен через CryptoBot',id,status:'paid'});
    }
    u.balance=Number((Number(u.balance)+amount).toFixed(6));row.status='failed';row.error='Unknown provider';save();
    return res.status(400).json({error:'Unknown provider'});
  }catch(e){
    if(row.status==='pending'||row.status==='created'){
      u.balance=Number((Number(u.balance)+amount).toFixed(6));row.status='failed';row.error=e.message;save();
    }
    res.status(400).json({error:e.message});
  }
});

app.post('/webhooks/xrocket',(req,res)=>{
  const body=req.body||{};
  if(body.type==='invoice'){
    const inv=body.data?.invoice;const payment=body.data?.payment;
    const clientId=inv?.callback?.payload?.orderId||inv?.clientInvoiceId||payment?.invoiceId;
    const local=clientId&&db.invoices[clientId];
    if(local&&(inv?.status==='paid'||payment?.status==='paid'))creditInvoice(local,inv?.priceAmount||payment?.receiveAmount||local.amount);
  }
  if(body.type==='payout'){
    const d=body.data||{};const localId=d.clientPayoutId||d.callback?.payload?.withdrawalId;const row=localId&&db.withdrawals[localId];
    if(row){
      const u=db.users[String(row.telegramId)];
      if(d.status==='finished'&&row.status!=='paid'){row.status='paid';if(u)u.withdrawalsTotal=Number(u.withdrawalsTotal||0)+Number(row.amount||0);save()}
      else if(d.status==='failed'&&row.status!=='failed'){row.status='failed';if(u)u.balance=Number(u.balance||0)+Number(row.amount||0);save()}
    }
  }
  res.sendStatus(200);
});
app.get('/health',(req,res)=>res.json({ok:true}));

async function syncCryptoInvoices(){
  if(!CRYPTO_PAY_TOKEN)return;
  const active=Object.entries(db.invoices).filter(([,x])=>x.provider==='cryptobot'&&x.status==='active'&&x.remoteId);
  for(const [id,row] of active){
    try{const invs=await cryptoRequest('getInvoices',{invoice_ids:String(row.remoteId),count:1});const inv=invs?.[0];if(!inv)continue;if(inv.status==='paid')creditInvoice(row,inv.paid_amount||inv.amount);else if(inv.status==='expired')row.status='expired';save()}catch{}
  }
}
setInterval(()=>syncCryptoInvoices().catch(()=>{}),20000);

if(BOT_TOKEN){
 const bot=new Telegraf(BOT_TOKEN);
 bot.start(async ctx=>{userRecord(ctx.from);save();await ctx.reply('🎮 Игра сейчас недоступна в самом боте.\n\nОткрой приложение по кнопке ниже — весь Energy Simulator находится там.',Markup.inlineKeyboard([[Markup.button.webApp('⚡ Открыть Energy Simulator',WEBAPP_URL)]]))});
 bot.command('admin',async ctx=>{
   if(Number(ctx.from.id)!==ADMIN_ID)return ctx.reply('⛔ Нет доступа.');
   const users=Object.values(db.users),total=users.reduce((s,u)=>s+Number(u.balance||0),0),deps=users.reduce((s,u)=>s+Number(u.depositsTotal||0),0),wds=users.reduce((s,u)=>s+Number(u.withdrawalsTotal||0),0);
   await ctx.reply(`👑 ПАНЕЛЬ ВЛАДЕЛЬЦА\n\nИгроков: ${users.length}\nБаланс игроков: ${Number(total).toFixed(2)} USDT\nДепозиты: ${deps} USDT\nВыводы: ${wds} USDT\n\n/admin users\n/admin user ID`);
 });
 bot.on('text',async ctx=>{if(Number(ctx.from.id)!==ADMIN_ID)return;const t=ctx.message.text.trim();if(!t.startsWith('/admin '))return;const parts=t.split(/\s+/);if(parts[1]==='users'){const rows=Object.values(db.users).slice(-30).map(u=>`• ${[u.first_name,u.last_name].filter(Boolean).join(' ')||'Игрок'} ${u.username?'@'+u.username+' ':''}[${u.id}] — ${Number(u.balance||0).toFixed(2)} USDT — деп: ${Number(u.depositsTotal||0).toFixed(2)} — вывод: ${Number(u.withdrawalsTotal||0).toFixed(2)} — ${u.inventory?.length||0} предметов`);return ctx.reply(rows.join('\n')||'Пусто')}if(parts[1]==='user'&&parts[2]){const u=db.users[String(parts[2])];if(!u)return ctx.reply('Игрок не найден');return ctx.reply(`👤 ${[u.first_name,u.last_name].filter(Boolean).join(' ')||'Игрок'} ${u.username?'@'+u.username+' ':''}[${u.id}]\nБаланс: ${Number(u.balance||0).toFixed(2)} USDT\nДепозиты: ${u.depositsTotal||0} USDT\nВыводы: ${u.withdrawalsTotal||0} USDT\nАпгрейдов: ${u.gamesPlayed}\nУспехов: ${u.wins}\nПредметы: ${u.inventory.length}`)}});
 bot.telegram.setChatMenuButton({menu_button:{type:'web_app',text:'⚡ Игра',web_app:{url:WEBAPP_URL}}}).catch(()=>{});
 bot.launch({dropPendingUpdates:true}).catch(console.error);console.log('Telegram bot started');
}else console.log('BOT_TOKEN not configured: Telegram /start and /admin cannot work until backend env is configured.');
app.listen(PORT,()=>console.log(`Energy Simulator backend on :${PORT}`));
process.once('SIGINT',()=>process.exit(0));process.once('SIGTERM',()=>process.exit(0));
