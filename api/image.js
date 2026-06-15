import { verifyToken } from './_session.js';

// Image generation AND editing via Gemini's image-capable model
// ("Nano Banana"):
// - No `image` field in the request  -> text-to-image generation.
// - `image` field provided           -> edit/transform that image.
//
// Google sometimes promotes "-preview" model ids to a stable name.
// Try the current stable id first, then the older preview alias as
// a fallback so this keeps working through that kind of transition.
// See https://ai.google.dev/gemini-api/docs/image-generation
const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'];

const TIMEOUT_MS = 28000; // keep 2 attempts within Vercel's 60s maxDuration

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, prompt, image } = req.body || {};

  const username = verifyToken(token);
  if (!username) {
    return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
  }

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Lütfen bir görsel tanımı yazın.' });
  }

  // 1) API key missing — fail fast with a clear, actionable message.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Görsel oluşturma yapılandırılmamış: GEMINI_API_KEY ortam değişkeni tanımlı değil. ' +
        'Vercel proje ayarlarından (Settings → Environment Variables) ekleyip yeniden deploy edin.',
    });
  }

  const parts = [{ text: prompt }];
  if (image?.data && image?.mimeType) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };

  const errors = [];

  // 2) Try each known model id in order. A model that responds but
  //    returns no image (e.g. refused the prompt) is recorded and we
  //    move on; a hard API/network error is also recorded.
  for (const model of IMAGE_MODELS) {
    try {
      const result = await callImageModel(model, apiKey, body);
      if (result.image) {
        return res.status(200).json({ image: result.image, text: result.text });
      }
      errors.push(`${model}: ${result.refusal}`);
    } catch (err) {
      errors.push(`${model}: ${err.message}`);
    }
  }

  console.error('Image generation failed:', errors.join(' | '));
  return res.status(502).json({ error: friendlyError(errors) });
}

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function callImageModel(model, apiKey, body) {
  const r = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const data = await r.json();
  if (!r.ok) {
    throw new Error(data.error?.message || `HTTP ${r.status}`);
  }

  const resultParts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = resultParts.find((p) => p.inlineData);
  const textPart = resultParts.find((p) => p.text);

  if (!imagePart) {
    return { image: null, refusal: textPart?.text || 'görsel döndürmedi' };
  }

  return {
    image: { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data },
    text: textPart?.text || '',
  };
}

// 3) Turn whatever the provider(s) said into one clear, actionable
//    Turkish message for the user.
function friendlyError(errors) {
  const all = errors.join(' | ');

  if (/aborted|timeout/i.test(all)) {
    return 'Görsel servisi zaman aşımına uğradı (istek çok uzun sürdü). Lütfen tekrar deneyin.';
  }
  if (/429|quota|rate.?limit|resource.?exhausted/i.test(all)) {
    return 'Görsel modeli şu anda istek limitine ulaştı (ücretsiz kotanın sonu olabilir). Lütfen birkaç dakika sonra tekrar deneyin.';
  }
  if (/api.?key|permission|unauthorized|403|401/i.test(all)) {
    return 'Gemini API anahtarı geçersiz veya görsel modeline erişim izni yok. Lütfen GEMINI_API_KEY değerini kontrol edin.';
  }
  if (/not found|404|unsupported|invalid argument/i.test(all)) {
    return 'Görsel modeli bulunamadı ya da bu istek desteklenmiyor (model adı Google tarafında değişmiş olabilir). Lütfen tekrar deneyin; sorun sürerse model adının güncellenmesi gerekebilir.';
  }

  const last = errors[errors.length - 1] || 'bilinmeyen hata';
  return 'Görsel oluşturulamadı: ' + last;
}
