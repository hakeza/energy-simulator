require('dotenv').config();
const express=require('express');
const cors=require('cors');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const {Telegraf,Markup}=require('telegraf');

const PORT=process.env.PORT||3000;
const BOT_TOKEN=process.env.BOT_TOKEN||'';
const ADMIN_ID=Number(process.env.ADMIN_ID||8179254915);
const WEBAPP_URL=process.env.WEBAPP_URL||'https://hakeza.github.io/energy-simulator/';
const CRYPTO_PAY_TOKEN=process.env.CRYPTO_PAY_TOKEN||'';
const XR_TOKEN=process.env.XR_TOKEN||'';
const DATA_FILE=path.join(__dirname,'data.json');
const app=express();app.use(cors());app.use(express.json());
const db=fs.existsSync(DATA_FILE)?JSON.parse(fs.readFileSync(DATA_FILE,'utf8')):{users:{},invoices:{},withdrawals:{}};
function save(){fs.writeFileSync(DATA_FILE,JSON.stringify(db,null,2))}
function verifyTelegram(initData){
  if(!initData||!BOT_TOKEN) return null;
  const p=new URLSearchParams(initData),hash=p.get('hash');if(!hash)return null;p.delete('hash');
  const data=[...p.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const calc=crypto.createHmac('sha256',secret).update(data).digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(hash)))return null;
  const authDate=Number(p.get('auth_date')||0);if(Date.now()/1000-authDate>86400)return null;
  try{return JSON.parse(p.get('user')||'null')}catch{return null}
}
function auth(req,res,next){const u=verifyTelegram(req.get('X-Telegram-Init-Data'));if(!u)return res.status(401).json({error:'Telegram authorization required'});req.user=u;next()}
function userRecord(u){const id=String(u.id);if(!db.users[id])db.users[id]={id:u.id,username:u.username||'',first_name:u.first_name||'',photo_url:u.photo_url||'',balance:0,gamesPlayed:0,wins:0,inventory:[],createdAt:new Date().toISOString()};else Object.assign(db.users[id],{username:u.username||'',first_name:u.first_name||'',photo_url:u.photo_url||''});return db.users[id]}
app.post('/api/me',auth,(req,res)=>{const u=userRecord(req.user);save();res.json({user:u})});
app.get('/api/admin/users',auth,(req,res)=>{if(req.user.id!==ADMIN_ID)return res.status(403).json({error:'Forbidden'});res.json({users:Object.values(db.users)})});
app.post('/api/game/upgrade',auth,(req,res)=>{const u=userRecord(req.user);const {success,stake}=req.body;const s=Math.max(0,Number(stake)||0);if(u.balance<0)return res.status(400).json({error:'Invalid balance'});u.balance=Math.max(0,u.balance-s);u.gamesPlayed++;if(success)u.wins++;save();res.json({user:u})});

/* CryptoBot: invoice creation. Keep token only in env, never frontend. */
app.post('/api/wallet/deposit',auth,async(req,res)=>{
  const amount=Number(req.body.amount),provider=req.body.provider;
  if(!amount||amount<=0)return res.status(400).json({error:'Invalid amount'});
  const u=userRecord(req.user);const clientId=`${u.id}-${Date.now()}`;
  try{
    if(provider==='cryptobot'){
      if(!CRYPTO_PAY_TOKEN)return res.status(503).json({error:'CryptoBot API token is not configured'});
      const r=await fetch('https://pay.crypt.bot/api/createInvoice',{method:'POST',headers:{'Crypto-Pay-API-Token':CRYPTO_PAY_TOKEN,'Content-Type':'application/json'},
        body:JSON.stringify({asset:'USDT',amount:String(amount),description:`Energy Simulator deposit for ${u.id}`,payload:clientId})});
      const d=await r.json();if(!d.ok)return res.status(400).json({error:d.error?.name||'CryptoBot error'});db.invoices[clientId]={provider,telegramId:u.id,amount,status:'active',invoice:d.result};save();
      return res.json({payUrl:d.result.pay_url||d.result.bot_invoice_url||d.result.mini_app_invoice_url});
    }
    if(provider==='xrocket'){
      if(!XR_TOKEN)return res.status(503).json({error:'xRocket API token is not configured'});
      const r=await fetch('https://pay.xrocket.exchange/api/v1/tg-invoices',{method:'POST',headers:{'Rocket-Pay-Key':XR_TOKEN,'Content-Type':'application/json'},
        body:JSON.stringify({amount,currency:'USDT',description:`Energy Simulator deposit for ${u.id}`,payload:clientId,expiredIn:7200,numPayments:1})});
      const d=await r.json();if(!r.ok||d.success===false)return res.status(400).json({error:d.message||'xRocket error'});db.invoices[clientId]={provider,telegramId:u.id,amount,status:'active',invoice:d.data};save();
      return res.json({payUrl:d.data?.link||d.data?.url||d.data?.invoiceLink});
    }
    res.status(400).json({error:'Unknown provider'});
  }catch(e){res.status(500).json({error:e.message})}
});
app.post('/api/wallet/withdraw',auth,async(req,res)=>{
  const amount=Number(req.body.amount),provider=req.body.provider,address=String(req.body.address||'').trim();
  const u=userRecord(req.user);if(!amount||amount<=0||!address)return res.status(400).json({error:'Invalid withdrawal'});
  if(u.balance<amount)return res.status(400).json({error:'Недостаточно средств'});
  /* Balance is reserved first; webhook/status processing should finalize/refund on failure. */
  u.balance-=amount;const id=`wd-${u.id}-${Date.now()}`;db.withdrawals[id]={id,provider,telegramId:u.id,amount,address,status:'pending',createdAt:new Date().toISOString()};save();
  if(provider==='xrocket'&&XR_TOKEN){
    try{
      /* Current xRocket Pay API uses POST /api/v1/withdrawals. Exact request fields can change; keep this adapter isolated. */
      const r=await fetch('https://pay.xrocket.exchange/api/v1/withdrawals',{method:'POST',headers:{'Rocket-Pay-Key':XR_TOKEN,'Content-Type':'application/json'},
        body:JSON.stringify({currency:'USDT',amount:String(amount),address,network:'TON',comment:`Energy Simulator ${id}`})});
      const d=await r.json();if(!r.ok||d.success===false){u.balance+=amount;db.withdrawals[id].status='failed';save();return res.status(400).json({error:d.message||'xRocket withdrawal failed'})}
      db.withdrawals[id].remote=d.data;db.withdrawals[id].status='submitted';save();return res.json({message:'Вывод отправлен',id});
    }catch(e){u.balance+=amount;db.withdrawals[id].status='failed';save();return res.status(500).json({error:e.message})}
  }
  if(provider==='cryptobot'){
    return res.status(202).json({message:'Заявка сохранена. Для автоматического CryptoBot payout добавь payout/transfer обработчик в backend.'});
  }
  res.status(400).json({error:'Unknown provider'});
});

/* xRocket webhook placeholder: validate signature before crediting/settling in production. */
app.post('/webhooks/xrocket',(req,res)=>{res.sendStatus(200)});
app.get('/health',(req,res)=>res.json({ok:true}));

if(BOT_TOKEN){
 const bot=new Telegraf(BOT_TOKEN);
 bot.start(async ctx=>{
   await userRecord(ctx.from);save();
   await ctx.reply('🎮 Игра сейчас недоступна в самом боте.\n\nОткрой приложение по кнопке ниже — весь Energy Simulator находится там.',
     Markup.inlineKeyboard([[Markup.button.webApp('⚡ Открыть Energy Simulator',WEBAPP_URL)]]));
 });
 bot.command('admin',async ctx=>{
   if(ctx.from.id!==ADMIN_ID)return ctx.reply('⛔ Нет доступа.');
   const users=Object.values(db.users);const total=users.reduce((s,u)=>s+(u.balance||0),0);
   await ctx.reply(`👑 ПАНЕЛЬ ВЛАДЕЛЬЦА\n\nИгроков: ${users.length}\nСумма балансов: ${total} ⚡\n\nКоманды:\n/admin — статистика\n/admin users — список игроков\n/admin user ID — профиль игрока`);
 });
 bot.on('text',async ctx=>{
   if(ctx.from.id!==ADMIN_ID)return;
   const t=ctx.message.text.trim();if(!t.startsWith('/admin '))return;
   const parts=t.split(/\s+/);if(parts[1]==='users'){const rows=Object.values(db.users).slice(-30).map(u=>`• ${u.username?'@'+u.username:u.first_name||'Игрок'} [${u.id}] — ${u.balance} ⚡ — ${u.inventory.length} предметов`);return ctx.reply(rows.join('\n')||'Пусто')}
   if(parts[1]==='user'&&parts[2]){const u=db.users[String(parts[2])];if(!u)return ctx.reply('Игрок не найден');return ctx.reply(`👤 ${u.username?'@'+u.username:u.first_name||'Игрок'} [${u.id}]\nБаланс: ${u.balance} ⚡\nАпгрейдов: ${u.gamesPlayed}\nУспехов: ${u.wins}\nПредметы: ${u.inventory.length}`)}
 });
 bot.launch().catch(console.error);
 console.log('Telegram bot started');
}else console.log('BOT_TOKEN not configured: HTTP server only');
app.listen(PORT,()=>console.log(`Energy Simulator backend on :${PORT}`));
process.once('SIGINT',()=>process.exit(0));process.once('SIGTERM',()=>process.exit(0));
