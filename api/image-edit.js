import { verifyToken } from './_session.js';

// Experimental: image editing via Gemini's image-capable model.
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

    if (!image?.data || !image?.mimeType) {
      return res.status(400).json({ error: 'Lütfen düzenlemek istediğiniz görseli ekleyin.' });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Lütfen görselde ne yapılmasını istediğinizi yazın.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY tanımlı değil');

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: image.mimeType, data: image.data } },
          ],
        },
      ],
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

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData);
    const textPart = parts.find((p) => p.text);

    if (!imagePart) {
      return res.status(502).json({
        error: 'Model bir görsel döndürmedi: ' + (textPart?.text || 'bu istek için görsel düzenleme şu anda kullanılamıyor.'),
      });
    }

    return res.status(200).json({
      image: { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data },
      text: textPart?.text || '',
    });
  } catch (err) {
    console.error('Image edit error:', err);
    return res.status(502).json({ error: 'Görsel düzenleme servisine ulaşılamadı: ' + (err.message || 'bilinmeyen hata') });
  }
}
