const $ = (selector) => document.querySelector(selector);
const body = document.body;
body.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let motion = !reduced.matches;
let sound = false;
let audio;
let state = 'sailing';
let incidents = 0;
let start = performance.now();
let lastTime = start;
let elapsed = 0;
let frame;
let scroll = 0;
let hoverX = 0;
let actualX = -110;
let toastTimer;
let impactPlayed = false;
const crashDuration = 7.4;
const stern = document.querySelector('#stern-piece');
const bow = document.querySelector('#bow-piece');
const cargo = [...document.querySelectorAll('#ship .container')];
const fragments = [...document.querySelectorAll('.crash-fragment')];
const smokePuffs = [...document.querySelectorAll('.blast-puff')];
const sparks = [...document.querySelectorAll('.blast-spark')];
const ship = $('#ship');
const sink = $('#sink');
const sinkLabel = $('#sink-label');
const status = $('#ship-status');
const systemRoute = $('#system-route');
const systemPacket = $('#system-packet');
const systemRouteLength = systemRoute.getTotalLength();
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const mix = (a, b, p) => a + (b - a) * p;
const ease = p => p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;

function applyMotion() {
  body.classList.toggle('motion-on', motion);
  body.classList.toggle('motion-paused', !motion);
  $('#motion').setAttribute('aria-pressed', String(motion));
  $('#motion span').textContent = motion ? 'on' : 'off';
  if (!motion && state === 'sinking') finishSink();
  if (!motion && state === 'relaunching') finishRelaunch();
  if (!motion && state === 'sailing') ship.style.transform = 'translate(110px,0) rotate(0deg)';
  lastTime = performance.now();
  if (motion && !frame && !document.hidden) frame = requestAnimationFrame(tick);
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4300);
}

function tone(frequency, duration, type = 'sine', volume = .055, delay = 0) {
  if (!sound || !audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime + delay);
  gain.gain.setValueAtTime(0, audio.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, audio.currentTime + delay + .04);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + delay + duration);
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.start(audio.currentTime + delay);
  oscillator.stop(audio.currentTime + delay + duration + .04);
}

function setStatus(text) { if (status.textContent !== text) status.textContent = text; }

function impactSound() {
  if (!sound || !audio) return;
  const buffer = audio.createBuffer(1, audio.sampleRate * .85, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
  const noise = audio.createBufferSource();
  const gain = audio.createGain();
  gain.gain.value = .16;
  noise.buffer = buffer;
  noise.connect(gain); gain.connect(audio.destination); noise.start();
  tone(45, 1.1, 'triangle', .13); tone(94, .4, 'sawtooth', .025);
}

// One clock keeps the impact, split hull, cargo trajectories and spray in sync.
function renderCrash(t, effects = true) {
  const approach = ease(clamp(t / 1.6));
  const rupture = ease(clamp((t - 1.65) / 1.35));
  const dive = ease(clamp((t - 3.25) / 3.7));
  const jolt = t > 1.6 && t < 2.05 ? Math.sin((t - 1.6) * 45) * 5 * (1 - (t - 1.6) / .45) : 0;
  actualX = mix(start, 320, approach);
  ship.style.transform = `translate(${actualX}px,${jolt}px)`;
  stern.style.transform = `translate(${-76 * rupture}px,${275 * dive}px) rotate(${15 * rupture - 61 * dive}deg)`;
  bow.style.transform = `translate(${74 * rupture}px,${370 * dive}px) rotate(${-12 * rupture + 112 * dive}deg)`;
  $('#hull-crack').style.opacity = String(clamp((t - 1.6) * 3) * (1 - dive));
  $('.ship-shadow').style.opacity = String(.14 * (1 - dive));
  cargo.forEach((item, i) => {
    const p = clamp((t - 1.65 - i * .08) / 3.7);
    const dx = [-220, 235, 145][i] * p;
    const dy = -[135, 190, 235][i] * Math.sin(Math.PI * p) + 360 * p ** 2;
    const rotation = [-150, 210, 310][i] * p;
    item.style.transform = `translate(${dx}px,${dy}px) rotate(${rotation}deg)`;
    item.style.opacity = String(1 - clamp((p - .8) / .2));
  });
  const blastAge = t - 1.6;
  const ignition = clamp(blastAge / .18);
  const fireFade = 1 - clamp((blastAge - .7) / .9);
  $('#explosion-fire').style.opacity = effects ? String(ignition * fireFade) : '0';
  $('#fireball').style.transform = `translate(0,${-20 * clamp(blastAge / 1.6)}px) scale(${.18 + ignition * .82 + clamp(blastAge / 1.6) * .25}) rotate(${-8 + 14 * clamp(blastAge / 1.6)}deg)`;
  const smokeAge = Math.max(0, blastAge - .12);
  $('#explosion-smoke').style.opacity = effects && blastAge > .12 ? '1' : '0';
  smokePuffs.forEach((puff, i) => {
    const p = clamp((smokeAge - i * .06) / 3.5);
    const spread = (i % 2 ? 1 : -1) * (25 + i * 13);
    puff.setAttribute('transform', `translate(${1030 + spread * p} ${310 - (110 + i * 9) * p}) scale(${.35 + p * 1.2})`);
    puff.style.opacity = String(clamp(p * 12) * (1 - p) * .8);
  });
  const sparkAge = clamp((blastAge - .04) / 1.55);
  $('#explosion-sparks').style.opacity = effects && blastAge > .04 ? String(1 - sparkAge) : '0';
  sparks.forEach((spark, i) => {
    const angle = i * Math.PI * 2 / sparks.length;
    const speed = 145 + (i * 47) % 135;
    const x = 1030 + Math.cos(angle) * speed * sparkAge;
    const y = 320 + Math.sin(angle) * speed * sparkAge + 115 * sparkAge ** 2;
    spark.setAttribute('transform', `translate(${x} ${y}) rotate(${i * 37 + sparkAge * 150}) scale(${1 - sparkAge * .6})`);
  });
  const burst = clamp((t - 1.6) / .15) * (1 - clamp((t - 2.65) / .45));
  $('#impact-burst').style.opacity = effects ? String(burst) : '0';
  $('#impact-pop').style.transform = `scale(${.65 + .35 * clamp((t - 1.6) / .2)})`;
  const spray = clamp((t - 1.8) / .25) * (1 - clamp((t - 2.5) / 1.5));
  $('#crash-splash').style.opacity = effects ? String(spray) : '0';
  $('#crash-splash').style.transform = `scale(${.65 + .5 * clamp((t - 1.8) / 1.4)})`;
  const p = clamp((t - 1.65) / 2.8);
  $('#crash-fragments').style.opacity = effects ? String((p > 0 ? 1 : 0) * (1 - clamp((p - .7) / .3))) : '0';
  fragments.forEach((item, i) => {
    const vx = -340 + (i * 137) % 570;
    const vy = -140 - (i * 43) % 270;
    const x = 1054 + vx * p;
    const y = 322 + vy * p + 440 * p * p;
    item.setAttribute('transform', `translate(${x} ${y}) rotate(${(i % 2 ? 1 : -1) * p * (190 + i * 24)})`);
  });
  const wake = clamp((t - 1.9) / 4);
  $('#impact-waves').style.opacity = effects ? String(Math.sin(wake * Math.PI) * .7) : '0';
  [$('#impact-ring-one'), $('#impact-ring-two')].forEach((ring, i) => {
    const size = 1 + wake * (5 + i * 2);
    ring.setAttribute('transform', `translate(985 416) scale(${size} ${1 + wake * 1.6 + i * .35}) translate(-985 -416)`);
  });
}

function resetShip() {
  [stern, bow, ...cargo].forEach(part => { part.style.transform = ''; part.style.opacity = ''; });
  ['#hull-crack', '#impact-burst', '#crash-fragments', '#crash-splash', '#impact-waves', '#explosion-smoke', '#explosion-fire', '#explosion-sparks'].forEach(selector => { $(selector).style.opacity = '0'; });
}

function startSink() {
  if (state !== 'sailing') return;
  clearTimeout(toastTimer); $('#toast').classList.remove('visible');
  state = 'sinking'; elapsed = 0; start = actualX; impactPlayed = false;
  body.classList.remove('is-sunk', 'is-relaunching'); body.classList.add('is-sinking');
  sink.disabled = true; sinkLabel.textContent = 'Brakes? What brakes?';
  incidents += 1; $('#incident-count').textContent = String(incidents).padStart(2, '0');
  setStatus('APPROACHING DOCK. BRAKES NOT FOUND.');
  tone(110, 1.2, 'triangle', .08); tone(147, 1.2, 'triangle', .045);
  if (!motion) finishSink();
}

function finishSink() {
  renderCrash(crashDuration, false);
  state = 'sunk'; elapsed = 0;
  body.classList.remove('is-sinking'); body.classList.add('is-sunk');
  sink.disabled = false; sinkLabel.textContent = 'Ship it again';
  setStatus('SHIP LOST. COFFEE RECOVERED.');
  toast('Task failed successfully. Coffee secured.');
}

function relaunch() {
  if (state !== 'sunk') return;
  state = 'relaunching'; elapsed = 0;
  sink.disabled = true; sinkLabel.textContent = 'Reassembling our life choices…';
  body.classList.remove('is-sunk'); body.classList.add('is-relaunching');
  setStatus('GIT REVERT: THE ENTIRE BOAT.');
  tone(220, .25, 'sine', .05); tone(330, .25, 'sine', .05, .18); tone(440, .4, 'sine', .05, .36);
  if (!motion) finishRelaunch();
}

function finishRelaunch() {
  state = 'sailing'; elapsed = 0; start = performance.now(); actualX = -110;
  resetShip(); body.classList.remove('is-relaunching');
  ship.style.transform = motion ? 'translate(-110px,0)' : 'translate(110px,0)';
  $('.ship-shadow').style.opacity = '.14';
  sink.disabled = false; sinkLabel.textContent = 'Whatever you do, don’t press this';
  setStatus('BACK AFLOAT. WHAT COULD GO WRONG?');
  toast('Fresh boat. Same questionable captain.');
}

function tick(now) {
  frame = null;
  if (!motion || document.hidden) return;
  const delta = Math.min((now - lastTime) / 1000, .05);
  lastTime = now;
  elapsed += delta;
  const packetPoint = systemRoute.getPointAtLength(((now / 4200) % 1) * systemRouteLength);
  systemPacket.setAttribute('transform', `translate(${packetPoint.x} ${packetPoint.y})`);
  if (state === 'sailing') {
    const entry = ease(clamp((now - start) / 6000));
    const target = mix(-110, 100, entry) + scroll * 100 + hoverX * 6;
    actualX += (target - actualX) * .045;
    ship.style.transform = `translate(${actualX.toFixed(2)}px,0) rotate(0deg)`;
  } else if (state === 'sinking') {
    renderCrash(elapsed);
    if (elapsed >= 1.6 && !impactPlayed) { impactPlayed = true; impactSound(); }
    if (elapsed >= 1.6 && elapsed < 2.05) setStatus('IGNITION. THIS SEEMS FINE.');
    else if (elapsed >= 2.05 && elapsed < 3.1) setStatus('BOOM. THAT WAS NOT IN THE BRIEF.');
    else if (elapsed >= 3.1 && elapsed < 5.2) setStatus('NOW SHIPPING IN MULTIPLE PIECES.');
    else if (elapsed >= 5.2) setStatus('PRIORITY ONE: SAVE THE COFFEE.');
    if (elapsed >= crashDuration) finishSink();
  } else if (state === 'relaunching') {
    const p = ease(clamp(elapsed / 3.2));
    renderCrash((1 - p) * crashDuration, false);
    if (p >= 1) finishRelaunch();
  }
  frame = requestAnimationFrame(tick);
}

sink.addEventListener('click', () => state === 'sunk' ? relaunch() : startSink());
$('#motion').addEventListener('click', () => { motion = !motion; applyMotion(); });
reduced.addEventListener('change', () => { motion = !reduced.matches; applyMotion(); });
$('#sound').addEventListener('click', async () => {
  if (!sound) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { toast('Your browser prefers the quiet life.'); return; }
    try { audio ||= new Audio(); await audio.resume(); } catch { toast('Sound couldn’t start. We’ll sail quietly.'); return; }
  }
  sound = !sound;
  $('#sound').setAttribute('aria-pressed', String(sound));
  $('#sound span').textContent = sound ? 'on' : 'off';
  if (sound) tone(220, .6, 'triangle', .06);
  else if (audio) await audio.suspend();
});

function updateScene() {
  scroll = clamp(scrollY / Math.max(1, $('.hero').offsetHeight), 0, 1);
  $('.harbor-art').setAttribute('viewBox', innerWidth <= 760 ? '150 10 1040 780' : '0 80 1440 500');
  $('.harbor-art').setAttribute('preserveAspectRatio', innerWidth <= 760 ? 'xMidYMax meet' : 'xMidYMid slice');
}
addEventListener('scroll', () => { scroll = clamp(scrollY / Math.max(1, $('.hero').offsetHeight)); }, { passive: true });
addEventListener('resize', updateScene, { passive: true });
$('#harbor').addEventListener('pointermove', event => { if (event.pointerType === 'mouse') hoverX = event.offsetX / $('#harbor').clientWidth * 2 - 1; }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = null; body.classList.add('motion-paused'); if (audio) audio.suspend(); }
  else { lastTime = performance.now(); body.classList.toggle('motion-paused', !motion); if (sound && audio) audio.resume(); if (motion && !frame) frame = requestAnimationFrame(tick); }
});

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
}), { threshold: .08 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
const dialog = $('#contact-dialog');
let trigger;
document.querySelectorAll('.contact-trigger').forEach(button => button.addEventListener('click', () => { trigger = button; dialog.showModal(); }));
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
dialog.addEventListener('close', () => trigger?.focus({ preventScroll: true }));
$('#back-top').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: motion ? 'smooth' : 'instant' }); $('.wordmark').focus({ preventScroll: true }); });
$('#year').textContent = new Date().getFullYear();
updateScene(); applyMotion();
