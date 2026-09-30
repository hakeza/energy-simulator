const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const modal = document.getElementById("crashModal");
const multiplierEl = document.getElementById("multiplier");
const rocket = document.querySelector(".rocket");
const startBtn = document.getElementById("startCrash");
const cashoutBtn = document.getElementById("cashout");
const result = document.getElementById("crashResult");
let timer = null, value = 1, crashAt = 0, running = false;

function openCrash(){ modal.classList.remove("hidden"); resetCrash(); }
function closeCrash(){ modal.classList.add("hidden"); clearInterval(timer); running=false; }
function resetCrash(){
  clearInterval(timer); value=1; running=false;
  multiplierEl.textContent="1.00x"; rocket.style.left="18%"; rocket.style.bottom="25%";
  startBtn.classList.remove("hidden"); cashoutBtn.classList.add("hidden");
  result.textContent="Тестовая версия — баланс пока не списывается.";
}
function startCrash(){
  if(running) return;
  running=true; value=1; crashAt=1.35+Math.random()*6.0;
  startBtn.classList.add("hidden"); cashoutBtn.classList.remove("hidden");
  result.textContent="Множитель растёт…";
  timer=setInterval(()=>{
    value += 0.01 + value*0.004;
    multiplierEl.textContent=value.toFixed(2)+"x";
    const p=Math.min(82,18+(value-1)*12);
    rocket.style.left=p+"%";
    rocket.style.bottom=(25+Math.min(45,(value-1)*8))+"%";
    if(value>=crashAt) endCrash();
  },40);
}
function endCrash(){
  clearInterval(timer); running=false;
  startBtn.classList.remove("hidden"); cashoutBtn.classList.add("hidden");
  result.textContent="💥 Crash! Раунд завершён.";
}
function cashout(){
  if(!running) return;
  clearInterval(timer); running=false;
  startBtn.classList.remove("hidden"); cashoutBtn.classList.add("hidden");
  result.textContent="⚡ Забрано на "+value.toFixed(2)+"x";
}
document.getElementById("crashBtn").onclick=openCrash;
document.getElementById("gamesNav").onclick=openCrash;
document.getElementById("closeCrash").onclick=closeCrash;
startBtn.onclick=startCrash;
cashoutBtn.onclick=cashout;
modal.addEventListener("click",e=>{if(e.target===modal)closeCrash();});
