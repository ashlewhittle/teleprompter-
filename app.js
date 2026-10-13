(() => {
  'use strict';

  const WPM = 150; // average speaking pace used for time estimates
  const STORE_KEY = 'prompter.scripts';
  const SETTINGS_KEY = 'prompter.settings';

  const $ = (id) => document.getElementById(id);

  // ---------- storage ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage full or blocked */ }
  }

  let scripts = load(STORE_KEY, []);
  const settings = Object.assign({
    speed: 5,
    fontSize: 36,
    panelHeight: 45,
    panelOpacity: 55,
    mirror: true,
    countdown: true,
    facing: 'user',
    targetSecs: 30,
  }, load(SETTINGS_KEY, {}));

  const persistScripts = () => save(STORE_KEY, scripts);
  const persistSettings = () => save(SETTINGS_KEY, settings);

  let current = null; // script being edited / filmed

  // ---------- helpers ----------

  const wordCount = (text) => (text.trim().match(/\S+/g) || []).length;

  function formatSecs(secs) {
    secs = Math.round(secs);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  }

  function relativeDate(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  }

  async function readClipboard() {
    try {
      return await navigator.clipboard.readText();
    } catch (_) {
      return null;
    }
  }

  // Turn a rough idea line into a speakable sentence.
  function ideaToSentence(line) {
    let s = line.replace(/^\s*(?:[-*•–>]+|\d+[.)])\s*/, '').trim();
    // Drop short labels like "hook:" or "CTA -" that are notes to self.
    s = s.replace(/^([\w' ]{1,20}?)\s*[:–—]\s+(?=\S)/, (m, label) => (label.trim().split(/\s+/).length <= 3 ? '' : m));
    if (!s) return '';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?…"')]$/.test(s)) s += '.';
    return s;
  }

  function tidy(text) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/ /g, ' ')
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*•]+)\s+/, '').replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ---------- library ----------

  function renderLibrary() {
    const list = $('script-list');
    list.innerHTML = '';
    const sorted = [...scripts].sort((a, b) => b.updated - a.updated);
    $('empty-library').hidden = sorted.length > 0;
    for (const s of sorted) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'card';
      const words = wordCount(s.script);
      const title = document.createElement('span');
      title.className = 'card-title';
      title.textContent = s.title || 'Untitled clip';
      const sub = document.createElement('span');
      sub.className = 'card-sub';
      sub.textContent = s.script.trim() || s.ideas.trim() || 'Empty';
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = `${words} words · ~${formatSecs((words / WPM) * 60)} · ${relativeDate(s.updated)}`;
      btn.append(title, sub, meta);
      btn.addEventListener('click', () => openEditor(s));
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  function newScript(fields = {}) {
    const s = Object.assign({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: '',
      ideas: '',
      script: '',
      updated: Date.now(),
    }, fields);
    scripts.push(s);
    persistScripts();
    return s;
  }

  $('btn-new').addEventListener('click', () => openEditor(newScript()));

  $('btn-paste-new').addEventListener('click', async () => {
    const text = await readClipboard();
    if (text === null) {
      // Clipboard blocked: open an empty script so the user can long-press paste.
      openEditor(newScript());
      $('ed-script').focus();
      return;
    }
    if (!text.trim()) {
      alert('Your clipboard is empty — copy some text first.');
      return;
    }
    const firstLine = text.trim().split('\n')[0].slice(0, 40);
    openEditor(newScript({ title: firstLine, script: tidy(text) }));
  });

  // ---------- editor ----------

  const edTitle = $('ed-title');
  const edIdeas = $('ed-ideas');
  const edScript = $('ed-script');

  function openEditor(s) {
    current = s;
    edTitle.value = s.title;
    edIdeas.value = s.ideas;
    edScript.value = s.script;
    updateStats();
    showView('editor');
  }

  function saveCurrent() {
    if (!current) return;
    current.title = edTitle.value.trim();
    current.ideas = edIdeas.value;
    current.script = edScript.value;
    current.updated = Date.now();
    persistScripts();
  }

  function updateStats() {
    const words = wordCount(edScript.value);
    const secs = (words / WPM) * 60;
    $('ed-stats').textContent = `${words} words · ~${formatSecs(secs)}`;
    const target = settings.targetSecs;
    document.querySelectorAll('#targets .chip').forEach((c) => c.classList.toggle('on', Number(c.dataset.secs) === target));
    const ratio = secs / target;
    const fill = $('ed-meter-fill');
    fill.style.width = `${Math.min(ratio, 1) * 100}%`;
    fill.style.background = ratio > 1.1 ? 'var(--accent)' : ratio > 0.9 ? 'var(--warn)' : 'var(--ok)';
  }

  let saveTimer;
  function onEdit() {
    updateStats();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrent, 400);
  }
  [edTitle, edIdeas, edScript].forEach((el) => el.addEventListener('input', onEdit));

  $('targets').addEventListener('click', (e) => {
    const secs = Number(e.target.dataset && e.target.dataset.secs);
    if (!secs) return;
    settings.targetSecs = secs;
    persistSettings();
    updateStats();
  });

  $('btn-build').addEventListener('click', () => {
    const sentences = edIdeas.value.split('\n').map(ideaToSentence).filter(Boolean);
    if (!sentences.length) {
      edIdeas.focus();
      return;
    }
    const built = sentences.join('\n\n');
    const existing = edScript.value.trim();
    edScript.value = existing ? `${existing}\n\n${built}` : built;
    if (!edTitle.value.trim()) edTitle.value = sentences[0].replace(/[.!?]$/, '').slice(0, 40);
    onEdit();
    edScript.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('btn-paste').addEventListener('click', async () => {
    const text = await readClipboard();
    if (text === null) {
      alert('Clipboard access was blocked. Long-press in the script box and choose Paste instead.');
      return;
    }
    const start = edScript.selectionStart ?? edScript.value.length;
    const end = edScript.selectionEnd ?? edScript.value.length;
    edScript.value = edScript.value.slice(0, start) + text + edScript.value.slice(end);
    onEdit();
  });

  $('btn-tidy').addEventListener('click', () => {
    edScript.value = tidy(edScript.value);
    onEdit();
  });

  $('btn-clear').addEventListener('click', () => {
    if (!edScript.value || confirm('Clear the script text?')) {
      edScript.value = '';
      onEdit();
    }
  });

  $('btn-back').addEventListener('click', () => {
    saveCurrent();
    // Don't keep completely empty scripts around.
    if (current && !current.title && !current.ideas.trim() && !current.script.trim()) {
      scripts = scripts.filter((s) => s !== current);
      persistScripts();
    }
    current = null;
    renderLibrary();
    showView('library');
  });

  $('btn-delete').addEventListener('click', () => {
    if (!current || !confirm('Delete this script?')) return;
    scripts = scripts.filter((s) => s !== current);
    persistScripts();
    current = null;
    renderLibrary();
    showView('library');
  });

  $('btn-go').addEventListener('click', () => {
    saveCurrent();
    openPrompter();
  });

  // ---------- prompter ----------

  const cam = $('cam');
  const panel = $('prompt-panel');
  const textEl = $('prompt-text');
  const root = document.documentElement;

  let stream = null;
  let recorder = null;
  let chunks = [];
  let recordedBlob = null;
  let recordedUrl = null;
  let recStart = 0;
  let recTimer = null;
  let wakeLock = null;
  let countingDown = false;

  let offset = 0;
  let playing = false;
  let lastFrame = 0;

  function applySettings() {
    root.style.setProperty('--font-size', `${settings.fontSize}px`);
    root.style.setProperty('--panel-height', `${settings.panelHeight}%`);
    root.style.setProperty('--panel-opacity', settings.panelOpacity / 100);
    $('val-speed').textContent = settings.speed;
    $('val-font').textContent = `${settings.fontSize}px`;
    $('val-height').textContent = `${settings.panelHeight}%`;
    $('val-opacity').textContent = `${settings.panelOpacity}%`;
    $('in-font').value = settings.fontSize;
    $('in-height').value = settings.panelHeight;
    $('in-opacity').value = settings.panelOpacity;
    $('in-mirror').checked = settings.mirror;
    $('in-countdown').checked = settings.countdown;
    cam.classList.toggle('mirror', settings.mirror && settings.facing === 'user');
  }

  // Pixels per second, scaled with font size so a given speed keeps roughly the same words-per-minute.
  const pxPerSecond = () => settings.speed * 4 * (settings.fontSize / 36);

  function maxOffset() {
    const pad = parseFloat(getComputedStyle(textEl).paddingBottom) || 0;
    return Math.max(0, textEl.scrollHeight - pad - settings.fontSize * 1.35);
  }

  function setOffset(v) {
    offset = Math.min(Math.max(0, v), maxOffset());
    textEl.style.transform = `translate3d(0, ${-offset}px, 0)`;
  }

  function tick(now) {
    if (!playing) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    setOffset(offset + pxPerSecond() * dt);
    if (offset >= maxOffset()) {
      setPlaying(false);
      return;
    }
    requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    if (on === playing) return;
    playing = on;
    $('btn-play').textContent = on ? '❚❚' : '▶';
    if (on) {
      if (offset >= maxOffset()) setOffset(0);
      lastFrame = performance.now();
      requestAnimationFrame(tick);
    }
  }

  async function startCamera() {
    stopCamera();
    const errEl = $('cam-error');
    errEl.hidden = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errEl.textContent = 'Camera not available. Open this page in Safari over https (not inside another app).';
      errEl.hidden = false;
      return;
    }
    const video = {
      facingMode: settings.facing,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
    } catch (err) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        errEl.textContent = 'Microphone blocked — videos will have no sound. Allow the mic in Settings › Safari › Microphone.';
        errEl.hidden = false;
      } catch (err2) {
        errEl.textContent = 'Couldn\'t open the camera. Allow camera access in Settings › Safari › Camera, then try again.';
        errEl.hidden = false;
        return;
      }
    }
    cam.srcObject = stream;
    try { await cam.play(); } catch (_) { /* autoplay will kick in */ }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    cam.srcObject = null;
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) { /* not supported */ }
  }

  function releaseWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  function openPrompter() {
    const text = current && current.script.trim();
    textEl.textContent = text || 'Your script is empty.\n\nGo back and add some text to read here.';
    applySettings();
    $('settings-panel').hidden = true;
    showView('prompter');
    setPlaying(false);
    setOffset(0);
    startCamera();
    requestWakeLock();
  }

  function closePrompter() {
    if (isRecording()) stopRecording();
    setPlaying(false);
    stopCamera();
    releaseWakeLock();
    if (current) openEditor(current);
    else showView('library');
  }

  $('btn-close').addEventListener('click', closePrompter);

  $('btn-flip').addEventListener('click', () => {
    if (isRecording()) return;
    settings.facing = settings.facing === 'user' ? 'environment' : 'user';
    persistSettings();
    applySettings();
    startCamera();
  });

  $('btn-settings').addEventListener('click', () => {
    $('settings-panel').hidden = !$('settings-panel').hidden;
  });

  function bindRange(id, key) {
    $(id).addEventListener('input', (e) => {
      settings[key] = Number(e.target.value);
      persistSettings();
      applySettings();
      setOffset(offset);
    });
  }
  bindRange('in-font', 'fontSize');
  bindRange('in-height', 'panelHeight');
  bindRange('in-opacity', 'panelOpacity');

  $('in-mirror').addEventListener('change', (e) => {
    settings.mirror = e.target.checked;
    persistSettings();
    applySettings();
  });
  $('in-countdown').addEventListener('change', (e) => {
    settings.countdown = e.target.checked;
    persistSettings();
  });

  function changeSpeed(delta) {
    settings.speed = Math.min(20, Math.max(1, settings.speed + delta));
    persistSettings();
    $('val-speed').textContent = settings.speed;
  }
  $('btn-slower').addEventListener('click', () => changeSpeed(-1));
  $('btn-faster').addEventListener('click', () => changeSpeed(1));

  $('btn-play').addEventListener('click', () => setPlaying(!playing));
  $('btn-restart').addEventListener('click', () => setOffset(0));

  // Drag the text to scroll manually; a tap (no drag) toggles play/pause.
  let drag = null;
  panel.addEventListener('pointerdown', (e) => {
    drag = { y: e.clientY, start: offset, moved: false, wasPlaying: playing };
    panel.setPointerCapture(e.pointerId);
  });
  panel.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 6) {
      drag.moved = true;
      if (playing) setPlaying(false);
    }
    if (drag.moved) setOffset(drag.start - dy);
  });
  const endDrag = () => {
    if (!drag) return;
    if (!drag.moved) setPlaying(!drag.wasPlaying);
    else if (drag.wasPlaying) setPlaying(true);
    drag = null;
  };
  panel.addEventListener('pointerup', endDrag);
  panel.addEventListener('pointercancel', endDrag);

  // ---------- recording ----------

  const isRecording = () => recorder && recorder.state === 'recording';

  function pickMimeType() {
    if (!window.MediaRecorder) return null;
    const types = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  function countdown(n) {
    const el = $('countdown');
    return new Promise((resolve) => {
      if (n <= 0) return resolve();
      el.hidden = false;
      el.textContent = n;
      const iv = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(iv);
          el.hidden = true;
          resolve();
        } else {
          el.textContent = n;
        }
      }, 1000);
    });
  }

  async function startRecording() {
    if (!stream) {
      $('cam-error').textContent = 'Camera isn\'t running yet.';
      $('cam-error').hidden = false;
      return;
    }
    const mimeType = pickMimeType();
    if (mimeType === null) {
      alert('Video recording isn\'t supported in this browser. Update iOS or use Safari.');
      return;
    }
    countingDown = true;
    $('btn-record').classList.add('recording');
    setPlaying(false);
    if (offset >= maxOffset()) setOffset(0);
    await countdown(settings.countdown ? 3 : 0);
    countingDown = false;

    chunks = [];
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
    } catch (_) {
      recorder = new MediaRecorder(stream);
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = onRecordingStopped;
    recorder.start(1000);

    recStart = Date.now();
    $('rec-badge').hidden = false;
    $('rec-time').textContent = '0:00';
    recTimer = setInterval(() => {
      const secs = Math.floor((Date.now() - recStart) / 1000);
      $('rec-time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    }, 250);
    setPlaying(true);
  }

  function stopRecording() {
    clearInterval(recTimer);
    $('rec-badge').hidden = true;
    $('btn-record').classList.remove('recording');
    setPlaying(false);
    if (isRecording()) recorder.stop();
  }

  function onRecordingStopped() {
    const type = (recorder && recorder.mimeType) || (chunks[0] && chunks[0].type) || 'video/mp4';
    recordedBlob = new Blob(chunks, { type });
    chunks = [];
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    recordedUrl = URL.createObjectURL(recordedBlob);
    const rv = $('review-video');
    rv.src = recordedUrl;
    showView('review');
    rv.play().catch(() => {});
  }

  $('btn-record').addEventListener('click', () => {
    if (countingDown) return;
    if (isRecording()) stopRecording();
    else startRecording();
  });

  // Stop cleanly if the user leaves the app mid-take.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isRecording()) stopRecording();
      setPlaying(false);
    } else if ($('view-prompter').classList.contains('active')) {
      requestWakeLock();
      if (!stream || !stream.active) startCamera();
    }
  });

  // ---------- review ----------

  function fileName() {
    const base = ((current && current.title) || 'clip').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'clip';
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const ext = recordedBlob && recordedBlob.type.includes('webm') ? 'webm' : 'mp4';
    return `${base}-${stamp}.${ext}`;
  }

  $('btn-save').addEventListener('click', async () => {
    if (!recordedBlob) return;
    const file = new File([recordedBlob], fileName(), { type: recordedBlob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  function leaveReview() {
    const rv = $('review-video');
    rv.pause();
    rv.removeAttribute('src');
    rv.load();
  }

  $('btn-retake').addEventListener('click', () => {
    leaveReview();
    setOffset(0);
    showView('prompter');
    if (!stream || !stream.active) startCamera();
  });

  $('btn-done').addEventListener('click', () => {
    leaveReview();
    closePrompter();
  });

  // ---------- boot ----------

  renderLibrary();
  applySettings();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
