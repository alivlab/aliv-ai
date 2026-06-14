import { verifyToken } from './_session.js';

// ------------------------------------------------------------
// Model registry — every free model ALIV AI can call.
// "label" is shown to the user as a small tag under the reply.
// ------------------------------------------------------------
const MODEL_REGISTRY = {
  'gemini-2.0-flash': { provider: 'gemini', model: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', vision: true, key: 'GEMINI_API_KEY' },
  'gemini-1.5-flash': { provider: 'gemini', model: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', vision: true, key: 'GEMINI_API_KEY' },
  'groq-llama-70b': { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', vision: false, key: 'GROQ_API_KEY' },
  'groq-llama-8b': { provider: 'groq', model: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', vision: false, key: 'GROQ_API_KEY' },
  'or-deepseek': { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3.1:free', label: 'DeepSeek V3.1', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-qwen': { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-llama-8b': { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-gemma-9b': { provider: 'openrouter', model: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-mistral-7b': { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B', vision: false, key: 'OPENROUTER_API_KEY' },
};

// Order matters: first usable (key configured) model that responds
// successfully wins. A file attachment requires a vision model.
const TEXT_CHAIN = ['groq-llama-70b', 'gemini-2.0-flash', 'or-deepseek', 'groq-llama-8b', 'or-qwen', 'or-llama-8b', 'or-gemma-9b', 'or-mistral-7b', 'gemini-1.5-flash'];
const VISION_CHAIN = ['gemini-2.0-flash', 'gemini-1.5-flash'];

const TIMEOUT_MS = 25000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, messages, file } = req.body || {};

    const username = verifyToken(token);
    if (!username) {
      return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Mesaj bulunamadı.' });
    }

    const chain = file ? VISION_CHAIN : TEXT_CHAIN;
    const errors = [];

    for (const id of chain) {
      const config = MODEL_REGISTRY[id];
      if (!process.env[config.key]) continue; // skip models we have no key for

      try {
        let reply;
        if (config.provider === 'gemini') {
          reply = await callGemini(config.model, messages, file);
        } else if (config.provider === 'groq') {
          reply = await callOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            process.env.GROQ_API_KEY,
            config.model,
            messages
          );
        } else {
          reply = await callOpenAICompatible(
            'https://openrouter.ai/api/v1/chat/completions',
            process.env.OPENROUTER_API_KEY,
            config.model,
            messages,
            { 'HTTP-Referer': 'https://aliv.tr', 'X-Title': 'ALIV AI' }
          );
        }

        return res.status(200).json({ reply, model: config.label });
      } catch (err) {
        errors.push(`${config.label}: ${err.message}`);
      }
    }

    console.error('All models failed:', errors.join(' | '));
    return res.status(502).json({
      error: 'Şu anda hiçbir model yanıt veremedi (yoğunluk/limit olabilir). Lütfen birkaç saniye sonra tekrar deneyin.',
    });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Sunucu hatası: ' + (err.message || 'bilinmeyen hata') });
  }
}

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function callGemini(model, messages, file) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('API key tanımlı değil');

  const systemMessages = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  if (file && file.data && file.mimeType) {
    for (let i = contents.length - 1; i >= 0; i--) {
      if (contents[i].role === 'user') {
        contents[i].parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        break;
      }
    }
  }

  const body = { contents };
  if (systemMessages) {
    body.systemInstruction = { parts: [{ text: systemMessages }] };
  }

  const r = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'API hatası');

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
  if (!text) throw new Error('Boş yanıt');
  return text;
}

async function callOpenAICompatible(url, apiKey, model, messages, extraHeaders = {}) {
  if (!apiKey) throw new Error('API key tanımlı değil');

  const r = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'API hatası');

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Boş yanıt');
  return text;
}
