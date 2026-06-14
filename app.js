// ============================================================
// ALIV AI — frontend logic
// ============================================================

const AUTH_VIEW = document.getElementById('auth-view');
const CHAT_VIEW = document.getElementById('chat-view');

const TOKEN_KEY = 'aliv_token';
const USER_KEY = 'aliv_username';
const MODEL_KEY = 'aliv_model';

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

// ============================================================
// AUTH VIEW
// ============================================================

// ---- tabs ----
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
const modelSelect = document.getElementById('model-select');
const newChatBtn = document.getElementById('new-chat-btn');
const logoutBtn = document.getElementById('logout-btn');
const chatBrandMark = document.getElementById('chat-brand-mark');

let history = []; // { role: 'user' | 'assistant', content: string }

const SYSTEM_PROMPT = {
  role: 'system',
  content: 'Sen ALIV AI adlı, kullanıcılara yardımcı olan bir Türkçe yapay zeka asistanısın. Açık, kısa ve net cevaplar ver.',
};

function enterChat() {
  showView('chat');

  const savedModel = localStorage.getItem(MODEL_KEY);
  if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
    modelSelect.value = savedModel;
  }

  chatInput.focus();
}

modelSelect.addEventListener('change', () => {
  localStorage.setItem(MODEL_KEY, modelSelect.value);
});

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

function addMessage(role, content, modelLabel) {
  emptyState.classList.add('hidden');

  const bubble = document.createElement('div');
  bubble.className = `msg ${role}`;

  if (role === 'assistant' && modelLabel) {
    const tag = document.createElement('span');
    tag.className = 'model-tag';
    tag.textContent = modelLabel;
    bubble.appendChild(tag);
  }

  const text = document.createElement('span');
  text.textContent = content;
  bubble.appendChild(text);

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
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

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  autoResize();

  history.push({ role: 'user', content: text });
  addMessage('user', text);

  sendBtn.disabled = true;
  chatBrandMark.classList.add('thinking');
  const typingBubble = addTypingBubble();

  try {
    const model = modelSelect.value;
    const payload = {
      token: getToken(),
      model,
      messages: [SYSTEM_PROMPT, ...history.slice(-20)],
    };

    const data = await postJSON('/api/chat', payload);
    history.push({ role: 'assistant', content: data.reply });

    typingBubble.remove();
    addMessage('assistant', data.reply, modelSelect.options[modelSelect.selectedIndex].text);
  } catch (err) {
    typingBubble.remove();
    addMessage('error', err.message);

    if (/oturum/i.test(err.message)) {
      clearSession();
      setTimeout(() => location.reload(), 1500);
    }
  } finally {
    sendBtn.disabled = false;
    chatBrandMark.classList.remove('thinking');
    chatInput.focus();
  }
});

newChatBtn.addEventListener('click', () => {
  history = [];
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
  if (getToken()) {
    enterChat();
  } else {
    showView('auth');
  }
})();
