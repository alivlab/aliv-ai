import { verifyToken } from './_session.js';
import { MODEL_REGISTRY, CHAINS } from './providers.js';

const TIMEOUT_MS = 25000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, messages, file, preferred } = req.body || {};

    const username = verifyToken(token);
    if (!username) {
      return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Mesaj bulunamadı.' });
    }

    // A file attachment always requires a vision-capable model,
    // regardless of which category the user picked.
    const chainKey = file ? 'vision' : (CHAINS[preferred] ? preferred : 'auto');
    const chain = CHAINS[chainKey];
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

        return res.status(200).json({ reply, model: config.label, category: chainKey });
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
