import { verifyToken } from './_session.js';

// Each entry maps a public model id (used by the frontend) to a provider + the
// model name that provider expects.
const MODELS = {
  'gemini-2.0-flash': { provider: 'gemini', model: 'gemini-2.0-flash', vision: true },
  'gemini-1.5-flash': { provider: 'gemini', model: 'gemini-1.5-flash', vision: true },
  'groq-llama-70b': { provider: 'groq', model: 'llama-3.3-70b-versatile', vision: false },
  'groq-llama-8b': { provider: 'groq', model: 'llama-3.1-8b-instant', vision: false },
  'or-llama-8b': { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free', vision: false },
  'or-gemma-9b': { provider: 'openrouter', model: 'google/gemma-2-9b-it:free', vision: false },
  'or-mistral-7b': { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free', vision: false },
};

const DEFAULT_MODEL = 'gemini-2.0-flash';
const VISION_FALLBACK = 'gemini-2.0-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, model, messages, file } = req.body || {};

    const username = verifyToken(token);
    if (!username) {
      return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Mesaj bulunamadı.' });
    }

    let config = MODELS[model] || MODELS[DEFAULT_MODEL];

    // A file (PDF/image/text) can only be understood by a vision-capable model.
    // If the selected model can't handle it, transparently fall back to Gemini.
    if (file && !config.vision) {
      config = MODELS[VISION_FALLBACK];
    }

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
        {
          'HTTP-Referer': 'https://aliv.tr',
          'X-Title': 'ALIV AI',
        }
      );
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(502).json({ error: 'Yapay zeka servisine ulaşılamadı: ' + (err.message || 'bilinmeyen hata') });
  }
}

async function callGemini(model, messages, file) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY tanımlı değil');

  const systemMessages = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Attach the uploaded file (image/PDF/text) to the most recent user turn.
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

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Gemini API hatası');

  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || 'Yanıt alınamadı.';
}

async function callOpenAICompatible(url, apiKey, model, messages, extraHeaders = {}) {
  if (!apiKey) throw new Error(`API key tanımlı değil: ${url}`);

  const r = await fetch(url, {
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

  return data.choices?.[0]?.message?.content || 'Yanıt alınamadı.';
}
