// ============================================================
// ALIV AI — frontend logic
// ============================================================

const TOKEN_KEY = 'aliv_token';
const USER_KEY = 'aliv_username';
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

const AUTH_VIEW = document.getElementById('auth-view');
const CHAT_VIEW = document.getElementById('chat-view');

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, username);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Bir hata oluştu.');
  }
  return data;
}

function showView(view) {
  AUTH_VIEW.classList.toggle('hidden', view !== 'auth');
  CHAT_VIEW.classList.toggle('hidden', view !== 'chat');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printAsPdf(text) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up penceresi engellendi. Lütfen tarayıcı ayarlarından izin verin.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
    <title>ALIV AI</title>
    <style>
      body { font-family: -apple-system, Arial, sans-serif; padding: 40px; line-height: 1.6; color: #111; white-space: pre-wrap; }
      h1 { font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 20px; }
    </style></head>
    <body><h1>ALIV AI</h1><div>${escapeHtml(text)}</div></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// INTRO ANIMATION
// ============================================================
function buildLogoIntro() {
  const overlay = document.getElementById('logo-intro');
  const stage = document.getElementById('intro-stage');
  const container = document.getElementById('intro-tiles');
  if (!overlay || !container) return;

  const cols = 6;
  const rows = 6;
  const tileSize = window.innerWidth < 480 ? 18 : 24;
  const center = (cols - 1) / 2;
  const maxDist = Math.hypot(center, center);

  container.style.width = `${cols * tileSize}px`;
  container.style.height = `${rows * tileSize}px`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement('div');
      tile.className = 'intro-tile';
      tile.style.left = `${c * tileSize}px`;
      tile.style.top = `${r * tileSize}px`;
      tile.style.width = `${tileSize}px`;
      tile.style.height = `${tileSize}px`;
      tile.style.backgroundPosition = `${-c * tileSize}px ${-r * tileSize}px`;
      tile.style.backgroundSize = `${cols * tileSize}px ${rows * tileSize}px`;

      const dx = (Math.random() - 0.5) * 360;
      const dy = (Math.random() - 0.5) * 360;
      const rot = (Math.random() - 0.5) * 240;

      tile.style.setProperty('--dx', `${dx}px`);
      tile.style.setProperty('--dy', `${dy}px`);
      tile.style.setProperty('--rot', `${rot}deg`);

      // Tiles near the center settle first, outer tiles follow —
      // gives the assembly a "core forms, frame completes" feel.
      const dist = Math.hypot(c - center, r - center) / maxDist;
      tile.style.transitionDelay = `${dist * 0.22 + Math.random() * 0.13}s`;

      container.appendChild(tile);
    }
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => container.classList.add('assembled'));
  });

  // Reveal the wordmark once the tiles have mostly settled, then hold
  // briefly before the overlay fades to reveal the app underneath.
  setTimeout(() => stage?.classList.add('reveal-word'), 1200);
  setTimeout(() => overlay.classList.add('done'), 2300);
}

// ============================================================
// INFO MODAL + MODEL BADGES
// ============================================================
const infoModal = document.getElementById('info-modal');
const infoModalClose = document.getElementById('info-modal-close');
const infoModalBackdrop = document.getElementById('info-modal-backdrop');
const infoBtn = document.getElementById('info-btn');
const infoLinkAuth = document.getElementById('info-link-auth');

function openInfoModal() {
  infoModal.classList.remove('hidden');
}
function closeInfoModal() {
  infoModal.classList.add('hidden');
}

infoBtn?.addEventListener('click', openInfoModal);
infoLinkAuth?.addEventListener('click', openInfoModal);
infoModalClose.addEventListener('click', closeInfoModal);
infoModalBackdrop.addEventListener('click', closeInfoModal);

let modelsCache = null;

async function loadModels() {
  if (modelsCache) return modelsCache;
  try {
    const res = await fetch('/api/models');
    modelsCache = await res.json();
  } catch {
    modelsCache = { models: [], image: null };
  }
  renderBadges(document.getElementById('model-badges'), modelsCache);
  renderBadges(document.getElementById('info-model-badges'), modelsCache);
  return modelsCache;
}

function renderBadges(container, data) {
  if (!container) return;
  container.innerHTML = '';
  (data.models || []).forEach((m) => {
    const badge = document.createElement('span');
    badge.className = 'model-badge';
    badge.innerHTML = `<span class="dot"></span>${m.label}`;
    container.appendChild(badge);
  });
  if (data.image) {
    const badge = document.createElement('span');
    badge.className = 'model-badge image-badge';
    badge.innerHTML = `<span class="dot"></span>${data.image.label}`;
    container.appendChild(badge);
  }
}

// ============================================================
// AUTH VIEW
// ============================================================
const tabs = document.querySelectorAll('.auth-tabs .tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.dataset.tab;
    loginForm.classList.toggle('active', target === 'login');
    registerForm.classList.toggle('active', target === 'register');
  });
});

// ---- OTP digit-group helper (used by both login and register) ----
function setupOtpGroup(groupEl, onComplete) {
  const boxes = Array.from(groupEl.querySelectorAll('.otp-box'));
  let autoTimer = null;

  function getCode() {
    return boxes.map((b) => b.value).join('');
  }

  function pulse(box) {
    box.classList.remove('filled');
    // restart the pop animation even if the class was already applied
    requestAnimationFrame(() => box.classList.add('filled'));
  }

  function maybeComplete() {
    const code = getCode();
    if (/^\d{6}$/.test(code)) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => onComplete(code), 120);
    }
  }

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      groupEl.classList.remove('shake');

      if (box.value) {
        pulse(box);
        if (i < boxes.length - 1) boxes[i + 1].focus();
      } else {
        box.classList.remove('filled');
      }
      maybeComplete();
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        e.preventDefault();
        boxes[i - 1].value = '';
        boxes[i - 1].classList.remove('filled');
        boxes[i - 1].focus();
      }
    });

    box.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      if (!text) return;
      e.preventDefault();
      const digits = text.slice(0, boxes.length).split('');
      digits.forEach((d, idx) => {
        boxes[idx].value = d;
        pulse(boxes[idx]);
      });
      boxes[Math.min(digits.length, boxes.length - 1)].focus();
      maybeComplete();
    });
  });

  return {
    getCode,
    focusFirst: () => boxes[0].focus(),
    setVerifying(on) {
      groupEl.classList.toggle('verifying', on);
      boxes.forEach((b) => { b.disabled = on; });
    },
    shake() {
      groupEl.classList.remove('success');
      groupEl.classList.add('shake');
      setTimeout(() => groupEl.classList.remove('shake'), 500);
    },
    success() {
      groupEl.classList.add('success');
    },
    resetState() {
      groupEl.classList.remove('verifying', 'shake', 'success');
    },
    clear(focusFirst = true) {
      boxes.forEach((b) => b.classList.remove('filled', 'success'));
      boxes.forEach((b) => { b.value = ''; });
      groupEl.classList.remove('success');
      if (focusFirst) boxes[0].focus();
    },
  };
}

// ---- LOGIN ----
const loginUsername = document.getElementById('login-username');
const loginStep1Btn = document.getElementById('login-step1-btn');
const loginOtpWrap = document.getElementById('login-otp-wrap');
const loginMsg = document.getElementById('login-msg');
const loginSubmitBtn = loginOtpWrap.querySelector('.secondary-btn');

const loginOtpCtl = setupOtpGroup(document.getElementById('login-otp-group'), (code) => attemptLogin(code));

let loginVerifying = false;

async function attemptLogin(code) {
  if (loginVerifying) return;

  const username = loginUsername.value.trim();
  if (!username) {
    loginMsg.textContent = 'Lütfen kullanıcı adınızı girin.';
    return;
  }

  loginVerifying = true;
  loginMsg.textContent = '';
  loginMsg.classList.remove('success');
  loginSubmitBtn.disabled = true;
  loginOtpCtl.resetState();
  loginOtpCtl.setVerifying(true);

  try {
    const data = await postJSON('/api/verify', { username, code, mode: 'login' });
    loginOtpCtl.setVerifying(false);
    loginOtpCtl.success();
    setSession(data.token, data.username);
    setTimeout(enterChat, 420); // let the success glow play briefly
  } catch (err) {
    loginOtpCtl.setVerifying(false);
    loginOtpCtl.shake();
    loginMsg.textContent = err.message;
    setTimeout(() => loginOtpCtl.clear(true), 200);
  } finally {
    loginVerifying = false;
    loginSubmitBtn.disabled = false;
  }
}

loginStep1Btn.addEventListener('click', () => {
  const username = loginUsername.value.trim();
  loginMsg.textContent = '';

  if (!username) {
    loginMsg.textContent = 'Lütfen kullanıcı adınızı girin.';
    return;
  }

  if (loginOtpWrap.classList.contains('open')) return;

  loginOtpWrap.classList.add('open');
  loginStep1Btn.classList.add('hidden');
  setTimeout(() => loginOtpCtl.focusFirst(), 280);
});

// Fallback: manual submit (e.g. autofill filled the boxes without firing input events)
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!loginOtpWrap.classList.contains('open')) {
    loginStep1Btn.click();
    return;
  }

  const code = loginOtpCtl.getCode();
  if (!/^\d{6}$/.test(code)) {
    loginMsg.textContent = 'Lütfen 6 haneli kodu girin.';
    return;
  }

  attemptLogin(code);
});

// ---- REGISTER ----
const registerUsername = document.getElementById('register-username');
const registerStep1Btn = document.getElementById('register-step1-btn');
const registerStep2Btn = document.getElementById('register-step2-btn');
const registerQr = document.getElementById('register-qr');
const registerSecret = document.getElementById('register-secret');
const registerMsg = document.getElementById('register-msg');
const regSteps = document.querySelectorAll('.reg-step');
const registerStep3 = document.querySelector('.reg-step[data-step="3"]');
const registerSubmitBtn = registerStep3.querySelector('.secondary-btn');

const registerOtpCtl = setupOtpGroup(document.getElementById('register-otp-group'), (code) => attemptRegisterVerify(code));

let pendingUsername = '';
let registerVerifying = false;

function goToStep(n) {
  regSteps.forEach((step) => {
    step.classList.toggle('active', Number(step.dataset.step) === n);
  });
}

async function attemptRegisterVerify(code) {
  if (registerVerifying) return;

  registerVerifying = true;
  registerMsg.textContent = '';
  registerSubmitBtn.disabled = true;
  registerOtpCtl.resetState();
  registerOtpCtl.setVerifying(true);

  try {
    const data = await postJSON('/api/verify', { username: pendingUsername, code, mode: 'register' });
    registerOtpCtl.setVerifying(false);
    registerOtpCtl.success();
    setSession(data.token, data.username);
    setTimeout(enterChat, 420);
  } catch (err) {
    registerOtpCtl.setVerifying(false);
    registerOtpCtl.shake();
    registerMsg.textContent = err.message;
    setTimeout(() => registerOtpCtl.clear(true), 200);
  } finally {
    registerVerifying = false;
    registerSubmitBtn.disabled = false;
  }
}

registerStep1Btn.addEventListener('click', async () => {
  registerMsg.textContent = '';
  const username = registerUsername.value.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    registerMsg.textContent = 'Kullanıcı adı 3-20 karakter olmalı, sadece harf, rakam ve _ içermeli.';
    return;
  }

  registerStep1Btn.disabled = true;
  registerStep1Btn.textContent = 'Yükleniyor...';

  try {
    const data = await postJSON('/api/register', { username });
    pendingUsername = username;
    registerQr.src = data.qr;
    registerSecret.textContent = data.secret;
    goToStep(2);
  } catch (err) {
    registerMsg.textContent = err.message;
  } finally {
    registerStep1Btn.disabled = false;
    registerStep1Btn.textContent = 'Devam Et';
  }
});

registerStep2Btn.addEventListener('click', () => {
  goToStep(3);
  setTimeout(() => registerOtpCtl.focusFirst(), 280);
});

// Fallback: manual submit
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const code = registerOtpCtl.getCode();
  if (!/^\d{6}$/.test(code)) {
    registerMsg.textContent = 'Lütfen 6 haneli kodu girin.';
    return;
  }

  attemptRegisterVerify(code);
});

// ============================================================
// CHAT VIEW
// ============================================================
const messagesEl = document.getElementById('messages');
const emptyState = document.getElementById('empty-state');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const logoutBtn = document.getElementById('logout-btn');
const chatBrandMark = document.getElementById('chat-brand-mark');

const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const attachmentPreview = document.getElementById('attachment-preview');
const attachmentThumb = document.getElementById('attachment-thumb');
const attachmentIcon = document.getElementById('attachment-icon');
const attachmentName = document.getElementById('attachment-name');
const attachmentRemove = document.getElementById('attachment-remove');

// model selector
const modelSelector = document.getElementById('model-selector');
const modelSelectorBtn = document.getElementById('model-selector-btn');
const modelSelectorPanel = document.getElementById('model-selector-panel');
const mselIcon = document.getElementById('msel-icon');
const mselLabel = document.getElementById('msel-label');
const mselOptions = document.querySelectorAll('.msel-option');
const autoBadge = document.getElementById('auto-badge');

let history = []; // { role: 'user' | 'assistant', content: string }
let attachedFile = null; // { name, mimeType, base64, previewDataUrl }
let currentCategory = 'auto'; // 'auto' | 'fast' | 'quality' | 'code' | 'image'

const SYSTEM_PROMPT = {
  role: 'system',
  content: 'Sen ALIV AI adlı, kullanıcılara yardımcı olan bir Türkçe yapay zeka asistanısın. Açık, kısa ve net cevaplar ver. Bir dosya (PDF, görsel veya metin) eklendiyse içeriğini analiz ederek kullanıcının isteğine göre yanıt ver (örneğin özetle, açıkla veya sorularını cevapla).',
};

function enterChat() {
  showView('chat');
  loadModels();
  updateAutoBadge();
  updatePlaceholder();
  chatInput.focus();
}

// ---- model selector ----
function closeModelSelector() {
  modelSelector.classList.remove('open');
  modelSelectorPanel.classList.add('hidden');
  modelSelectorBtn.setAttribute('aria-expanded', 'false');
}

modelSelectorBtn.addEventListener('click', () => {
  const willOpen = modelSelectorPanel.classList.contains('hidden');
  if (willOpen) {
    modelSelector.classList.add('open');
    modelSelectorPanel.classList.remove('hidden');
    modelSelectorBtn.setAttribute('aria-expanded', 'true');
  } else {
    closeModelSelector();
  }
});

document.addEventListener('click', (e) => {
  if (!modelSelector.classList.contains('open')) return;
  if (!modelSelector.contains(e.target)) closeModelSelector();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModelSelector();
});

function updateAutoBadge() {
  autoBadge.classList.toggle('hidden', currentCategory !== 'auto');
}

function selectCategory(category) {
  const option = document.querySelector(`.msel-option[data-category="${category}"]`);
  if (!option) return;

  currentCategory = category;

  mselOptions.forEach((opt) => {
    const active = opt === option;
    opt.classList.toggle('active', active);
    opt.setAttribute('aria-selected', String(active));
  });

  mselIcon.innerHTML = option.querySelector('.msel-opt-icon').innerHTML;
  mselLabel.textContent = option.querySelector('.msel-option-title').textContent;
  updateAutoBadge();
  closeModelSelector();

  if (category === 'image' && attachedFile && !attachedFile.mimeType.startsWith('image/')) {
    clearAttachment();
  }

  updatePlaceholder();
}

mselOptions.forEach((opt) => {
  opt.addEventListener('click', () => selectCategory(opt.dataset.category));
});

// ---- onboarding cards (empty state) ----
document.querySelectorAll('.onboarding-card').forEach((card) => {
  card.addEventListener('click', () => {
    if (card.dataset.category) selectCategory(card.dataset.category);

    if (card.dataset.prompt) {
      chatInput.value = card.dataset.prompt;
      autoResize();
    }

    if (card.dataset.hintAttach === 'true') {
      fileInput.click();
    }

    chatInput.focus();
    const len = chatInput.value.length;
    chatInput.setSelectionRange(len, len);
  });
});

function updatePlaceholder() {
  if (currentCategory === 'image') {
    chatInput.placeholder = attachedFile
      ? 'Bu görselde ne yapılmasını istiyorsunuz? (örn: arka plandaki insanları sil)'
      : 'Oluşturmak istediğiniz görseli tanımlayın... (örn: dağ manzarası, gün batımı)';
  } else if (currentCategory === 'vision') {
    chatInput.placeholder = attachedFile
      ? 'Eklediğiniz görsel/dosya hakkında bir soru sorun...'
      : 'Bir görsel veya dosya ekleyip soru sorun (Görsel Anlama)...';
  } else {
    chatInput.placeholder = attachedFile
      ? 'Eklediğiniz dosya hakkında bir soru sorun veya özet isteyin...'
      : 'Bir mesaj yazın...';
  }
}

// ---- attachments ----
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    addMessage('error', 'Dosya çok büyük. En fazla 4MB destekleniyor.');
    return;
  }

  if (currentCategory === 'image' && !file.type.startsWith('image/')) {
    addMessage('error', 'Görsel modunda sadece resim dosyası ekleyebilirsiniz.');
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.split(',')[1];

    attachedFile = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64,
      previewDataUrl: file.type.startsWith('image/') ? dataUrl : null,
    };

    attachmentName.textContent = file.name;
    if (attachedFile.previewDataUrl) {
      attachmentThumb.src = attachedFile.previewDataUrl;
      attachmentThumb.classList.remove('hidden');
      attachmentIcon.classList.add('hidden');
    } else {
      attachmentThumb.classList.add('hidden');
      attachmentIcon.classList.remove('hidden');
      attachmentIcon.textContent = attachedFile.mimeType === 'application/pdf' ? '📕' : '📄';
    }
    attachmentPreview.classList.remove('hidden');
    attachBtn.classList.add('active');
    updatePlaceholder();
  } catch {
    addMessage('error', 'Dosya okunamadı, lütfen tekrar deneyin.');
  }
});

attachmentRemove.addEventListener('click', clearAttachment);

function clearAttachment() {
  attachedFile = null;
  attachmentPreview.classList.add('hidden');
  attachBtn.classList.remove('active');
  updatePlaceholder();
}

// ---- input box ----
function autoResize() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
}
chatInput.addEventListener('input', autoResize);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// ---- icons for message actions ----
const ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
};

function actionBtn(iconHtml, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'msg-action-btn';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = iconHtml;
  btn.addEventListener('click', onClick);
  return btn;
}

function clearRegenerateButtons() {
  messagesEl.querySelectorAll('.msg-action-btn.action-regen').forEach((b) => b.remove());
}

// ---- streaming-style reveal for assistant replies ----
function revealText(el, text) {
  const totalTicks = 60;
  const chunk = Math.max(1, Math.ceil(text.length / totalTicks));
  const cursor = document.createElement('span');
  cursor.className = 'reveal-cursor';

  let i = 0;
  el.textContent = '';
  el.appendChild(cursor);

  const interval = setInterval(() => {
    i += chunk;
    if (i >= text.length) {
      clearInterval(interval);
      el.textContent = text;
      return;
    }
    el.textContent = text.slice(0, i);
    el.appendChild(cursor);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 18);
}

// ---- message rendering ----
function addMessage(role, content, opts = {}) {
  emptyState.classList.add('hidden');

  const bubble = document.createElement('div');
  bubble.className = `msg ${role}`;

  if (role === 'assistant' && opts.modelLabel) {
    const tag = document.createElement('span');
    tag.className = 'model-tag';
    tag.innerHTML = `<span class="dot"></span>${opts.modelLabel}`;
    bubble.appendChild(tag);
  }

  if (opts.attachment) {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    if (opts.attachment.previewDataUrl) {
      const img = document.createElement('img');
      img.src = opts.attachment.previewDataUrl;
      chip.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.textContent = opts.attachment.mimeType === 'application/pdf' ? '📕' : '📄';
      chip.appendChild(icon);
    }
    const name = document.createElement('span');
    name.textContent = opts.attachment.name;
    chip.appendChild(name);
    bubble.appendChild(chip);
  }

  const text = document.createElement('span');
  text.className = 'msg-text';
  bubble.appendChild(text);

  if (role === 'assistant' && opts.stream) {
    revealText(text, content);
  } else {
    text.textContent = content;
  }

  if (role === 'assistant') {
    const toolbar = document.createElement('div');
    toolbar.className = 'msg-toolbar';

    const copy = actionBtn(ICONS.copy, 'Kopyala', () => {
      navigator.clipboard?.writeText(content).then(() => {
        copy.innerHTML = ICONS.check;
        copy.classList.add('copied');
        setTimeout(() => {
          copy.innerHTML = ICONS.copy;
          copy.classList.remove('copied');
        }, 1400);
      });
    });
    toolbar.appendChild(copy);

    if (opts.isLatest) {
      clearRegenerateButtons();
      const regen = actionBtn(ICONS.refresh, 'Yeniden oluştur', () => regenerate());
      regen.classList.add('action-regen');
      toolbar.appendChild(regen);
    }

    const dl = actionBtn(ICONS.download, 'Metin olarak indir (.txt)', () => downloadText('aliv-yanit.txt', content));
    toolbar.appendChild(dl);

    bubble.appendChild(toolbar);
  }

  if (role === 'error' && opts.onRetry) {
    const toolbar = document.createElement('div');
    toolbar.className = 'msg-toolbar';
    const retry = actionBtn(ICONS.refresh, 'Tekrar dene', () => {
      bubble.remove();
      opts.onRetry();
    });
    toolbar.appendChild(retry);
    bubble.appendChild(toolbar);
  }

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function addImageMessage(caption, imgSrc, filename) {
  emptyState.classList.add('hidden');

  const bubble = document.createElement('div');
  bubble.className = 'msg image-result';

  if (caption) {
    const p = document.createElement('p');
    p.textContent = caption;
    bubble.appendChild(p);
  }

  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = caption || 'Oluşturulan görsel';
  bubble.appendChild(img);

  const actions = document.createElement('div');
  actions.className = 'image-actions';

  const downloadLink = document.createElement('a');
  downloadLink.href = imgSrc;
  downloadLink.download = filename;
  downloadLink.className = 'download-link';
  downloadLink.textContent = '⬇ İndir';
  actions.appendChild(downloadLink);

  const openLink = document.createElement('a');
  openLink.href = imgSrc;
  openLink.target = '_blank';
  openLink.rel = 'noopener';
  openLink.className = 'download-link open-link';
  openLink.textContent = '↗ Yeni sekmede aç';
  actions.appendChild(openLink);

  bubble.appendChild(actions);

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addTypingBubble(label) {
  emptyState.classList.add('hidden');
  const bubble = document.createElement('div');
  bubble.className = 'msg assistant typing';
  bubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>'
    + (label ? `<span class="typing-label">${label}</span>` : '');
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

// ---- shared request helper (used by send + regenerate + retry) ----
async function requestAssistantReply(apiMessages, file) {
  chatBrandMark.classList.add('thinking');
  const typingBubble = addTypingBubble();

  try {
    const payload = { token: getToken(), messages: apiMessages };
    if (currentCategory !== 'auto') payload.preferred = currentCategory;
    if (file) payload.file = file;

    const data = await postJSON('/api/chat', payload);
    history.push({ role: 'assistant', content: data.reply });

    typingBubble.remove();
    addMessage('assistant', data.reply, { modelLabel: data.model, isLatest: true, stream: true });
    clearAttachment();
  } catch (err) {
    typingBubble.remove();
    addMessage('error', err.message, { onRetry: () => requestAssistantReply(apiMessages, file) });

    if (/oturum/i.test(err.message)) {
      clearSession();
      setTimeout(() => location.reload(), 1500);
    }
  } finally {
    chatBrandMark.classList.remove('thinking');
  }
}

function regenerate() {
  if (history.length < 1 || history[history.length - 1].role !== 'assistant') return;

  history.pop();
  const bubbles = messagesEl.querySelectorAll('.msg.assistant');
  bubbles[bubbles.length - 1]?.remove();

  requestAssistantReply([SYSTEM_PROMPT, ...history.slice(-20)], null);
}

// ---- send flows ----
async function sendChatMessage(text) {
  const attachmentForMessage = attachedFile
    ? { name: attachedFile.name, mimeType: attachedFile.mimeType, previewDataUrl: attachedFile.previewDataUrl }
    : null;

  history.push({ role: 'user', content: text });
  addMessage('user', text, { attachment: attachmentForMessage });

  const apiMessages = [SYSTEM_PROMPT, ...history.slice(-20)];
  const file = attachedFile ? { mimeType: attachedFile.mimeType, data: attachedFile.base64 } : null;
  await requestAssistantReply(apiMessages, file);
}

async function sendImageMessage(prompt) {
  const isEdit = !!attachedFile;
  const attachmentForMessage = isEdit
    ? { name: attachedFile.name, mimeType: attachedFile.mimeType, previewDataUrl: attachedFile.previewDataUrl }
    : null;

  addMessage('user', prompt, { attachment: attachmentForMessage });

  chatBrandMark.classList.add('thinking');
  const typingBubble = addTypingBubble(isEdit ? 'Görsel düzenleniyor…' : 'Görsel oluşturuluyor…');

  const payload = { token: getToken(), prompt };
  if (isEdit) {
    payload.image = { mimeType: attachedFile.mimeType, data: attachedFile.base64 };
  }

  try {
    const data = await postJSON('/api/image', payload);

    typingBubble.remove();
    const src = `data:${data.image.mimeType};base64,${data.image.data}`;
    addImageMessage(data.text || '', src, isEdit ? 'aliv-duzenlenmis.png' : 'aliv-gorsel.png');
    clearAttachment();
  } catch (err) {
    typingBubble.remove();
    addMessage('error', err.message, { onRetry: () => sendImageMessage(prompt) });

    if (/oturum/i.test(err.message)) {
      clearSession();
      setTimeout(() => location.reload(), 1500);
    }
  } finally {
    chatBrandMark.classList.remove('thinking');
  }
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  autoResize();
  sendBtn.disabled = true;
  sendBtn.classList.add('pop');
  setTimeout(() => sendBtn.classList.remove('pop'), 320);

  if (currentCategory === 'image') {
    await sendImageMessage(text);
  } else {
    await sendChatMessage(text);
  }

  sendBtn.disabled = false;
  chatInput.focus();
});

newChatBtn.addEventListener('click', () => {
  history = [];
  clearAttachment();
  messagesEl.innerHTML = '';
  messagesEl.appendChild(emptyState);
  emptyState.classList.remove('hidden');
});

logoutBtn.addEventListener('click', () => {
  clearSession();
  location.reload();
});

// ============================================================
// INIT
// ============================================================
(function init() {
  buildLogoIntro();

  if (getToken()) {
    enterChat();
  } else {
    showView('auth');
  }
})();
