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
  const container = document.getElementById('intro-tiles');
  if (!overlay || !container) return;

  const cols = 6;
  const rows = 6;
  const tileSize = window.innerWidth < 480 ? 18 : 24;

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
      tile.style.transitionDelay = `${Math.random() * 0.35}s`;

      container.appendChild(tile);
    }
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => container.classList.add('assembled'));
  });

  setTimeout(() => overlay.classList.add('done'), 1700);
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

// ---- LOGIN ----
const loginUsername = document.getElementById('login-username');
const loginStep1Btn = document.getElementById('login-step1-btn');
const loginOtpWrap = document.getElementById('login-otp-wrap');
const loginOtp = document.getElementById('login-otp');
const loginMsg = document.getElementById('login-msg');

loginStep1Btn.addEventListener('click', () => {
  const username = loginUsername.value.trim();
  loginMsg.textContent = '';

  if (!username) {
    loginMsg.textContent = 'Lütfen kullanıcı adınızı girin.';
    return;
  }

  if (loginOtpWrap.classList.contains('open')) return;

  loginOtpWrap.classList.add('open');
  loginUsername.setAttribute('disabled', 'true');
  loginStep1Btn.classList.add('hidden');
  setTimeout(() => loginOtp.focus(), 250);
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';
  loginMsg.classList.remove('success');

  const username = loginUsername.value.trim();
  const code = loginOtp.value.trim();

  if (!loginOtpWrap.classList.contains('open')) {
    loginStep1Btn.click();
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    loginMsg.textContent = 'Lütfen 6 haneli kodu girin.';
    return;
  }

  try {
    const data = await postJSON('/api/verify', { username, code, mode: 'login' });
    setSession(data.token, data.username);
    enterChat();
  } catch (err) {
    loginMsg.textContent = err.message;
    loginOtp.value = '';
    loginOtp.focus();
  }
});

// ---- REGISTER ----
const registerUsername = document.getElementById('register-username');
const registerStep1Btn = document.getElementById('register-step1-btn');
const registerStep2Btn = document.getElementById('register-step2-btn');
const registerQr = document.getElementById('register-qr');
const registerSecret = document.getElementById('register-secret');
const registerOtp = document.getElementById('register-otp');
const registerMsg = document.getElementById('register-msg');
const regSteps = document.querySelectorAll('.reg-step');

let pendingUsername = '';

function goToStep(n) {
  regSteps.forEach((step) => {
    step.classList.toggle('active', Number(step.dataset.step) === n);
  });
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
  setTimeout(() => registerOtp.focus(), 250);
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerMsg.textContent = '';

  const code = registerOtp.value.trim();
  if (!/^\d{6}$/.test(code)) {
    registerMsg.textContent = 'Lütfen 6 haneli kodu girin.';
    return;
  }

  try {
    const data = await postJSON('/api/verify', { username: pendingUsername, code, mode: 'register' });
    setSession(data.token, data.username);
    enterChat();
  } catch (err) {
    registerMsg.textContent = err.message;
    registerOtp.value = '';
    registerOtp.focus();
  }
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
const modeButtons = document.querySelectorAll('.mode-btn');

const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const attachmentPreview = document.getElementById('attachment-preview');
const attachmentThumb = document.getElementById('attachment-thumb');
const attachmentIcon = document.getElementById('attachment-icon');
const attachmentName = document.getElementById('attachment-name');
const attachmentRemove = document.getElementById('attachment-remove');

let history = []; // { role: 'user' | 'assistant', content: string }
let attachedFile = null; // { name, mimeType, base64, previewDataUrl }
let currentMode = 'chat'; // 'chat' | 'image'

const SYSTEM_PROMPT = {
  role: 'system',
  content: 'Sen ALIV AI adlı, kullanıcılara yardımcı olan bir Türkçe yapay zeka asistanısın. Açık, kısa ve net cevaplar ver. Bir dosya (PDF, görsel veya metin) eklendiyse içeriğini analiz ederek kullanıcının isteğine göre yanıt ver (örneğin özetle, açıkla veya sorularını cevapla).',
};

function enterChat() {
  showView('chat');
  loadModels();
  updatePlaceholder();
  chatInput.focus();
}

// ---- mode toggle ----
modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;

    modeButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;

    if (currentMode === 'image' && attachedFile && !attachedFile.mimeType.startsWith('image/')) {
      clearAttachment();
    }

    updatePlaceholder();
  });
});

function updatePlaceholder() {
  if (currentMode === 'image') {
    chatInput.placeholder = attachedFile
      ? 'Bu görselde ne yapılmasını istiyorsunuz? (örn: arka plandaki insanları sil)'
      : 'Oluşturmak istediğiniz görseli tanımlayın... (örn: dağ manzarası, gün batımı)';
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

  if (currentMode === 'image' && !file.type.startsWith('image/')) {
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

// ---- message rendering ----
function addMessage(role, content, opts = {}) {
  emptyState.classList.add('hidden');

  const bubble = document.createElement('div');
  bubble.className = `msg ${role}`;

  if (role === 'assistant' && opts.modelLabel) {
    const tag = document.createElement('span');
    tag.className = 'model-tag';
    tag.textContent = opts.modelLabel;
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
  text.textContent = content;
  bubble.appendChild(text);

  if (role === 'assistant') {
    const toolbar = document.createElement('div');
    toolbar.className = 'msg-toolbar';

    const txtBtn = document.createElement('button');
    txtBtn.type = 'button';
    txtBtn.textContent = '⬇ Metin (.txt)';
    txtBtn.addEventListener('click', () => downloadText('aliv-yanit.txt', content));

    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.textContent = '⬇ PDF olarak kaydet';
    pdfBtn.addEventListener('click', () => printAsPdf(content));

    toolbar.appendChild(txtBtn);
    toolbar.appendChild(pdfBtn);
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

  const link = document.createElement('a');
  link.href = imgSrc;
  link.download = filename;
  link.className = 'download-link';
  link.textContent = '⬇ Görseli indir';
  bubble.appendChild(link);

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addTypingBubble() {
  emptyState.classList.add('hidden');
  const bubble = document.createElement('div');
  bubble.className = 'msg assistant';
  bubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

// ---- send flows ----
async function sendChatMessage(text) {
  const attachmentForMessage = attachedFile
    ? { name: attachedFile.name, mimeType: attachedFile.mimeType, previewDataUrl: attachedFile.previewDataUrl }
    : null;

  history.push({ role: 'user', content: text });
  addMessage('user', text, { attachment: attachmentForMessage });

  chatBrandMark.classList.add('thinking');
  const typingBubble = addTypingBubble();

  try {
    const payload = {
      token: getToken(),
      messages: [SYSTEM_PROMPT, ...history.slice(-20)],
    };

    if (attachedFile) {
      payload.file = { mimeType: attachedFile.mimeType, data: attachedFile.base64 };
    }

    const data = await postJSON('/api/chat', payload);
    history.push({ role: 'assistant', content: data.reply });

    typingBubble.remove();
    addMessage('assistant', data.reply, { modelLabel: data.model });
  } catch (err) {
    typingBubble.remove();
    addMessage('error', err.message);

    if (/oturum/i.test(err.message)) {
      clearSession();
      setTimeout(() => location.reload(), 1500);
    }
  } finally {
    chatBrandMark.classList.remove('thinking');
    clearAttachment();
  }
}

async function sendImageMessage(prompt) {
  const isEdit = !!attachedFile;
  const attachmentForMessage = isEdit
    ? { name: attachedFile.name, mimeType: attachedFile.mimeType, previewDataUrl: attachedFile.previewDataUrl }
    : null;

  addMessage('user', prompt, { attachment: attachmentForMessage });

  chatBrandMark.classList.add('thinking');
  const typingBubble = addTypingBubble();

  try {
    const payload = { token: getToken(), prompt };
    if (isEdit) {
      payload.image = { mimeType: attachedFile.mimeType, data: attachedFile.base64 };
    }

    const data = await postJSON('/api/image', payload);

    typingBubble.remove();
    const src = `data:${data.image.mimeType};base64,${data.image.data}`;
    addImageMessage(data.text || '', src, isEdit ? 'aliv-duzenlenmis.png' : 'aliv-gorsel.png');
  } catch (err) {
    typingBubble.remove();
    addMessage('error', err.message);

    if (/oturum/i.test(err.message)) {
      clearSession();
      setTimeout(() => location.reload(), 1500);
    }
  } finally {
    chatBrandMark.classList.remove('thinking');
    clearAttachment();
  }
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  autoResize();
  sendBtn.disabled = true;

  if (currentMode === 'image') {
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
