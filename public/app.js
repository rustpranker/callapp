// Frontend JS for index/dashboard/call -- consolidated for demo
(async function(){
  function el(id){return document.getElementById(id);}

  // index page elements
  if(el('send-code')){
    el('send-code').addEventListener('click', async ()=>{
      const phone = el('phone').value.trim();
      el('msg').textContent = '';
      if(!phone){ el('msg').textContent = 'Введите номер'; return; }
      try{
        const res = await fetch('/api/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Ошибка');
        document.getElementById('step-phone').style.display='none';
        document.getElementById('step-code').style.display='block';
      }catch(e){
        el('msg').textContent = e.message;
      }
    });
  }

  if(el('verify-code')){
    el('verify-code').addEventListener('click', async ()=>{
      const phone = el('phone').value.trim();
      const code = el('code').value.trim();
      el('msg').textContent = '';
      try{
        const res = await fetch('/api/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone, code})});
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Ошибка');
        // redirect to dashboard
        window.location.href = '/dashboard';
      }catch(e){
        el('msg').textContent = e.message;
      }
    });
  }

  // dashboard page elements
  if(el('btn-settings')){
    const modalSettings = el('modal-settings');
    const modalSupport = el('modal-support');
    el('btn-settings').addEventListener('click', ()=> modalSettings.classList.remove('hidden'));
    el('close-settings').addEventListener('click', ()=> modalSettings.classList.add('hidden'));
    el('btn-call').addEventListener('click', async ()=>{
      const target = el('target').value.trim();
      el('status').textContent='';
      if(!target){ el('status').textContent='Введите номер'; return; }
      try{
        const res = await fetch('/api/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target})});
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Ошибка');
        // store history
        const history = JSON.parse(localStorage.getItem('call_history'||'[]')) || [];
        history.unshift({target, time: new Date().toISOString()});
        localStorage.setItem('call_history', JSON.stringify(history));
        // go to call page
        window.location.href = '/call';
      }catch(e){
        el('status').textContent = e.message;
      }
    });

    el('close-support').addEventListener('click', ()=> modalSupport.classList.add('hidden'));
    document.getElementById('profile-circle').textContent = (localStorage.getItem('nick')||'U')[0].toUpperCase();
    // load history
    const callsList = document.getElementById('calls-list');
    const history = JSON.parse(localStorage.getItem('call_history')||'[]');
    if(history.length){
      callsList.innerHTML='';
      history.forEach(h=>{
        const div = document.createElement('div');
        div.className='call-item';
        div.innerHTML = `<div class="avatar">📱</div><div class="meta"><div class="num">${h.target}</div><div class="time">${new Date(h.time).toLocaleString()}</div></div>`;
        callsList.appendChild(div);
      });
    }
  }

  // call page
  if(el('end-btn')){
    let timer = null; let sec=0;
    function startTimer(){ timer = setInterval(()=>{ sec++; const mm=Math.floor(sec/60).toString().padStart(2,'0'); const ss=(sec%60).toString().padStart(2,'0'); el('call-timer').textContent = mm + ':' + ss; },1000); }
    startTimer();
    el('end-btn').addEventListener('click', async ()=>{
      // For simplicity, end call just stops timer and shows message
      clearInterval(timer);
      document.getElementById('after').style.display='block';
    });
    el('back-btn').addEventListener('click', ()=>{ window.location.href = '/dashboard'; });
  }

})();
