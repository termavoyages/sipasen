(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.getElementById('topbar');
  const progress = document.getElementById('progress');
  const burger = document.getElementById('burger');
  const drawer = document.getElementById('drawer');

  function closeMenu(){
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded','false');
  }
  burger.addEventListener('click', ()=>{
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  drawer.addEventListener('click', (e)=>{ if(e.target === drawer || e.target.closest('a')) closeMenu(); });
  document.querySelectorAll('.drawer a, .navlinks a').forEach(a=>{
    a.addEventListener('click', closeMenu);
  });

  const sections = [...document.querySelectorAll('section[id]')];
  const links = [...document.querySelectorAll('#desk-nav a')];
  function onScroll(){
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    const mark = y + 120;
    let current = sections[0]?.id;
    sections.forEach(s=>{ if(s.offsetTop <= mark) current = s.id; });
    links.forEach(a=> a.classList.toggle('active', a.getAttribute('href') === '#' + current));
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:0.16, rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal, .step').forEach(el=> io.observe(el));

  const stats = document.querySelectorAll('.stat .num');
  const seen = new WeakSet();
  const sio = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting || seen.has(entry.target)) return;
      seen.add(entry.target);
      const el = entry.target;
      const target = parseInt(el.dataset.target,10);
      if(reduce){ el.textContent = target.toLocaleString('fr-FR'); return; }
      const duration = 900;
      const start = performance.now();
      function step(now){
        const p = Math.min((now-start)/duration, 1);
        const eased = 1 - Math.pow(1-p, 3);
        el.textContent = Math.round(eased*target).toLocaleString('fr-FR');
        if(p<1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, {threshold:0.4});
  stats.forEach(el=> sio.observe(el));

  const chips = [...document.querySelectorAll('#countries span')];
  let ci = 0;
  if(chips.length && !reduce){
    setInterval(()=>{
      chips.forEach(c=>c.classList.remove('on'));
      chips[ci % chips.length].classList.add('on');
      ci++;
    }, 1400);
    chips[0].classList.add('on');
  }

  document.getElementById('devis').addEventListener('submit', function(e){
    e.preventDefault();
    this.reset();
    const ok = document.getElementById('form-ok');
    ok.style.display = 'block';
    ok.animate([{opacity:0, transform:'translateY(6px)'},{opacity:1, transform:'none'}], {duration:280, fill:'forwards'});
  });

  const appUrl = window.location.href.split('#')[0];
  const qrLive = document.getElementById('qr-live');
  const qrFallback = document.getElementById('qr-fallback');
  const qrUrl = document.getElementById('qr-url');
  if (qrUrl) qrUrl.textContent = appUrl;
  if (window.QRCode && qrLive) {
    QRCode.toCanvas(qrLive, appUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#14110f', light: '#f7f3ea' }
    }, (err) => {
      if (!err) {
        qrLive.hidden = false;
        if (qrFallback) qrFallback.hidden = true;
      } else if (qrFallback) {
        qrFallback.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(appUrl);
      }
    });
  } else if (qrFallback) {
    qrFallback.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(appUrl);
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  let deferredPrompt = null;
  const installBtn = document.getElementById('install-btn');
  const banner = document.getElementById('install-banner');
  const bannerBtn = document.getElementById('banner-install');

  async function promptInstall(){
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (installBtn) installBtn.hidden = true;
    if (banner) banner.classList.remove('show');
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!standalone && installBtn) installBtn.hidden = false;
    if (!standalone && banner) banner.classList.add('show');
  });
  if (installBtn) installBtn.addEventListener('click', promptInstall);
  if (bannerBtn) bannerBtn.addEventListener('click', promptInstall);
  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
    if (banner) banner.classList.remove('show');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }

  const canvas = document.getElementById('beads');
  if(canvas && !reduce){
    const ctx = canvas.getContext('2d');
    const hero = document.querySelector('.hero');
    let beads = [];
    function resize(){
      const rect = hero.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * devicePixelRatio);
      canvas.height = Math.floor(rect.height * devicePixelRatio);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    }
    function spawn(){
      const count = Math.min(70, Math.floor((hero.clientWidth * hero.clientHeight) / 14000));
      beads = Array.from({length:count}, ()=>({
        x: Math.random()*hero.clientWidth,
        y: Math.random()*hero.clientHeight,
        r: 2 + Math.random()*7,
        vx: (Math.random()-.5)*.22,
        vy: -0.12 - Math.random()*.28,
        a: .12 + Math.random()*.28
      }));
    }
    function tick(){
      ctx.clearRect(0,0,hero.clientWidth,hero.clientHeight);
      beads.forEach(b=>{
        b.x += b.vx; b.y += b.vy;
        if(b.y < -12){ b.y = hero.clientHeight + 8; b.x = Math.random()*hero.clientWidth; }
        if(b.x < -12) b.x = hero.clientWidth + 8;
        if(b.x > hero.clientWidth + 12) b.x = -8;
        ctx.beginPath();
        ctx.fillStyle = `rgba(247,243,234,${b.a})`;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
        ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    resize(); spawn(); tick();
    window.addEventListener('resize', ()=>{ resize(); spawn(); }, {passive:true});
  }
})();
