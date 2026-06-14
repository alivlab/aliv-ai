import { verifyToken } from './_session.js';

// Image generation AND editing via Gemini's image-capable model.
// - No `image` field in the request  -> text-to-image generation.
// - `image` field provided           -> edit/transform that image.
//
// If this model name becomes unavailable in the future, check
// https://ai.google.dev/gemini-api/docs/image-generation for the
// current model id and update IMAGE_MODEL below.
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, prompt, image } = req.body || {};

    const username = verifyToken(token);
    if (!username) {
      return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Lütfen bir görsel tanımı yazın.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY tanımlı değil');

    const parts = [{ text: prompt }];
    if (image?.data && image?.mimeType) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'Gemini görsel API hatası');

    const resultParts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = resultParts.find((p) => p.inlineData);
    const textPart = resultParts.find((p) => p.text);

    if (!imagePart) {
      return res.status(502).json({
        error: 'Model bir görsel döndürmedi: ' + (textPart?.text || 'bu istek için görsel üretimi şu anda kullanılamıyor.'),
      });
    }

    return res.status(200).json({
      image: { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data },
      text: textPart?.text || '',
    });
  } catch (err) {
    console.error('Image error:', err);
    return res.status(502).json({ error: 'Görsel servisine ulaşılamadı: ' + (err.message || 'bilinmeyen hata') });
  }
}
