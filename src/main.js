const root = document.documentElement;
const body = document.body;
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const audio = document.getElementById('demo-audio');
const demo = document.getElementById('demo-button');
const status = document.getElementById('demo-status');
const canvas = document.getElementById('hero-canvas');
const names = { aurora: 'Аврора', violet: 'Аметист', sunset: 'Закат' };
const presets = {
  flat: [0,0,0,0,0,0,0,0,0,0],
  bass: [6,5,4,2,0,-1,-1,0,1,2],
  vocal: [-2,-2,-1,1,3,4,3,1,0,-1],
  electronic: [4,3,1,0,-2,0,2,3,4,3]
};
const presetNames = { flat:'Ровный', bass:'Бас', vocal:'Вокал', electronic:'Электроника' };
const bands = [31,62,125,250,500,1000,2000,4000,8000,16000];
let theme = 'aurora';
let preset = 'flat';
let scene;
let sceneModule;
let sceneGeneration = 0;
let context, source, filters = [], gain, analyser, frame;
let audioBusy = false;
const stored = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const remember = (key, value) => { try { localStorage.setItem(key,value); } catch {} };

function setTheme(value) {
  theme = Object.hasOwn(names,value) ? value : 'aurora';
  root.dataset.theme = theme;
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    const active = button.dataset.themeChoice === theme;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  document.querySelectorAll('[data-theme-name]').forEach(element => { element.textContent = names[theme]; });
  scene?.setPalette(theme);
  remember('zigzak-website-theme',theme);
}

async function bootScene() {
  if (!canvas) return;
  const generation = ++sceneGeneration;
  scene?.destroy();
  try {
    const { initScene } = await (sceneModule ||= import('./scene.js'));
    if (generation !== sceneGeneration) return;
    scene = initScene(canvas,{
      reducedMotion:motion.matches,
      onReady:() => canvas.closest('.hero-visual')?.classList.add('scene-ready')
    });
    scene?.setPalette(theme);
  } catch { canvas.closest('.hero-visual')?.classList.remove('scene-ready'); }
}

function presetBars(values) {
  const baseline = [44,62,78,91,80,58,73,87,66,47];
  document.querySelectorAll('#eq-bars > div').forEach((bar,index) => {
    bar.style.setProperty('--height',`${Math.max(22,Math.min(100,baseline[index]+values[index]*4))}%`);
    bar.style.setProperty('--delay',`${index * -0.11}s`);
  });
}

function applyPreset(value) {
  preset = Object.hasOwn(presets,value) ? value : 'flat';
  const values = presets[preset];
  const time = context?.currentTime || 0;
  filters.forEach((filter,index) => filter.gain.setTargetAtTime(values[index],time,0.08));
  if (gain) gain.gain.setTargetAtTime(Math.pow(10,-Math.max(0,...values)/20),time,0.08);
  document.querySelectorAll('[data-preset]').forEach(button => {
    const active = button.dataset.preset === preset;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  presetBars(values);
  remember('zigzak-demo-preset',preset);
}

async function prepareAudio() {
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    source = context.createMediaElementSource(audio);
    filters = bands.map(frequency => {
      const filter = context.createBiquadFilter();
      filter.type = 'peaking'; filter.frequency.value = frequency; filter.Q.value = 1.1;
      return filter;
    });
    gain = context.createGain();
    analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(filters[0]);
    filters.forEach((filter,index) => filter.connect(filters[index+1] || gain));
    gain.connect(analyser); analyser.connect(context.destination);
    applyPreset(preset);
  }
  if (context?.state === 'suspended') await context.resume();
}

function syncAudio() {
  const playing = audio && !audio.paused && !audio.ended;
  body.classList.toggle('audio-playing',playing);
  if (demo) {
    demo.setAttribute('aria-pressed',String(playing));
    const label = demo.querySelector('[data-demo-label]');
    if (label) label.textContent = playing ? 'Остановить на мгновение' : 'Почувствовать звук';
  }
  if (status) status.textContent = playing ? 'Neon Skyline · ZigZak Originals' : '';
  cancelAnimationFrame(frame);
  if (playing && analyser && !motion.matches) {
    const bytes = new Uint8Array(analyser.frequencyBinCount);
    const nodes = [...document.querySelectorAll('#eq-bars > div')];
    const animate = () => {
      if (audio.paused || document.hidden) return;
      analyser.getByteFrequencyData(bytes);
      nodes.forEach((node,index) => {
        const amount = bytes[Math.min(bytes.length-1,index*2+1)]/255;
        node.style.setProperty('--height',`${22+amount*77}%`);
      });
      frame = requestAnimationFrame(animate);
    };
    animate();
  } else presetBars(presets[preset]);
}

async function toggleAudio() {
  if (!audio || audioBusy) return;
  if (!audio.paused) { audio.pause(); return; }
  audioBusy = true;
  demo?.setAttribute('aria-busy','true');
  try {
    await prepareAudio();
    if (audio.ended) audio.currentTime = 0;
    await audio.play();
  } catch {
    if (status) status.textContent = 'Демо пока не удалось включить. Попробуй ещё раз.';
  } finally {
    audioBusy = false;
    demo?.removeAttribute('aria-busy');
  }
}

function setMenu(open) {
  body.classList.toggle('menu-open',open);
  const toggle = document.getElementById('menu-toggle');
  toggle?.setAttribute('aria-expanded',String(open));
  toggle?.setAttribute('aria-label',open ? 'Закрыть меню' : 'Открыть меню');
}

function revealSections() {
  const elements = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || motion.matches) {
    elements.forEach(element => element.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
  },{threshold:0.07,rootMargin:'0px 0px 40px 0px'});
  elements.forEach(element => observer.observe(element));
}

function setupTilt() {
  if (motion.matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.tilt-card').forEach(card => {
    const reset = () => {
      card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y');
      card.style.removeProperty('transform');
    };
    card.addEventListener('pointermove',event => {
      if (motion.matches) return reset();
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX-bounds.left)/bounds.width - 0.5;
      const y = (event.clientY-bounds.top)/bounds.height - 0.5;
      card.style.setProperty('--tilt-x',`${-y*3}deg`);
      card.style.setProperty('--tilt-y',`${x*3}deg`);
      card.style.transform = `perspective(1400px) rotateX(${-y*3}deg) rotateY(${x*3}deg)`;
    });
    card.addEventListener('pointerleave',reset);
    card.addEventListener('pointercancel',reset);
  });
}

setTheme(stored('zigzak-website-theme','aurora'));
applyPreset(stored('zigzak-demo-preset','flat'));
revealSections();
root.classList.add('js');
bootScene();
setupTilt();
if (audio) {
  audio.volume = 0.7;
  for (const event of ['play','pause','ended']) audio.addEventListener(event,syncAudio);
  audio.addEventListener('error',() => {
    syncAudio();
    if (status) status.textContent = 'Не удалось загрузить демо. Скачай плеер и включи любимые треки.';
  });
}
demo?.addEventListener('click',toggleAudio);
document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click',() => setTheme(button.dataset.themeChoice)));
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click',() => {
  applyPreset(button.dataset.preset);
  if (status && audio && !audio.paused) status.textContent = `Neon Skyline · ${presetNames[preset]}`;
}));
document.getElementById('menu-toggle')?.addEventListener('click',() => setMenu(!body.classList.contains('menu-open')));
document.querySelectorAll('#nav-links a').forEach(link => link.addEventListener('click',() => setMenu(false)));
document.addEventListener('click',event => { if (body.classList.contains('menu-open') && !event.target.closest('.site-header')) setMenu(false); });
document.addEventListener('keydown',event => {
  if (event.key === 'Escape' && body.classList.contains('menu-open')) {
    setMenu(false); document.getElementById('menu-toggle')?.focus();
  }
});
window.matchMedia('(min-width: 761px)').addEventListener('change',event => { if (event.matches) setMenu(false); });
motion.addEventListener('change',() => { bootScene(); syncAudio(); if (motion.matches) document.querySelectorAll('.reveal').forEach(element => element.classList.add('is-visible')); });
document.addEventListener('visibilitychange',syncAudio);
window.addEventListener('pagehide',() => { ++sceneGeneration; audio?.pause(); cancelAnimationFrame(frame); scene?.destroy(); });
window.addEventListener('pageshow',event => { if (event.persisted) bootScene(); });
