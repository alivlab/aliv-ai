import { verifyToken } from './_session.js';

// =================================================================
// ALIV AI — Görsel Oluşturma / Düzenleme
// =================================================================
//
// Sağlayıcı zinciri (yukarıdan aşağıya, ilk başarılı sonuç döner):
//
//  1. Cloudflare Workers AI  [ÖNERİLEN — ~10k istek/gün ücretsiz]
//     FLUX.1-schnell (hızlı, text-to-image)
//     FLUX.2-klein-9b (kaliteli, text-to-image + editing)
//     Env: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
//
//  2. Together AI  [ÖNERİLEN YEDEK — ücretsiz FLUX.1-schnell-Free]
//     FLUX.1-schnell-Free endpoint (sadece text-to-image)
//     Env: TOGETHER_API_KEY
//
//  3. Gemini ("Nano Banana" ailesi)  [YEDEK — ~500 istek/gün, ~10 RPM]
//     gemini-2.5-flash-image + gemini-3.1-flash-image-preview
//     Env: GEMINI_API_KEY
//     NOT: RPM limiti çok düşük, tek sağlayıcı olarak güvenilmez.
//
// Vercel maxDuration bütçesi (vercel.json: 60s):
//   CF ~20s + Together ~18s + Gemini ~17s ≈ 55s (güvenli marj var)
// =================================================================

// --- Cloudflare ---
const CF_FAST    = '@cf/black-forest-labs/flux-1-schnell';
const CF_QUALITY = '@cf/black-forest-labs/flux-2-klein-9b';

// --- Together AI ---
const TOGETHER_MODEL = 'black-forest-labs/FLUX.1-schnell-Free';

// --- Gemini ---
const GEMINI_QUALITY_CHAIN = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
const GEMINI_FAST_CHAIN    = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];

// --- Model display labels ---
const LABELS = {
  [CF_FAST]:            'FLUX.1 Schnell (Hızlı)',
  [CF_QUALITY]:         'FLUX.2 Klein (Kaliteli)',
  [TOGETHER_MODEL]:     'FLUX.1 Schnell (Together, Yedek)',
  'gemini-2.5-flash-image':          'Gemini Nano Banana (Yedek)',
  'gemini-3.1-flash-image-preview':  'Gemini Nano Banana 2 (Yedek)',
};

// --- Timeouts ---
const CF_MS      = 20000; // Cloudflare is fast
const TOGETHER_MS = 18000;
const GEMINI_MS  = 16000; // 2 attempts × 16s fits under budget

// =================================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, prompt, image, tier } = req.body || {};

  // --- Auth ---
  const username = verifyToken(token);
  if (!username) {
    return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
  }

  // --- Input ---
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Lütfen bir görsel tanımı yazın.' });
  }

  // --- Keys ---
  const cfAccount  = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken    = process.env.CLOUDFLARE_API_TOKEN;
  const togetherKey = process.env.TOGETHER_API_KEY;
  const geminiKey  = process.env.GEMINI_API_KEY;

  const hasCF      = !!(cfAccount && cfToken);
  const hasTogether = !!togetherKey;
  const hasGemini  = !!geminiKey;

  if (!hasCF && !hasTogether && !hasGemini) {
    return res.status(500).json({
      error:
        'Görsel oluşturma için hiçbir API anahtarı yapılandırılmamış.\n\n' +
        'En az birini Vercel → Settings → Environment Variables\'a ekleyin:\n' +
        '• CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN  (ücretsiz, önerilen)\n' +
        '• TOGETHER_API_KEY  (ücretsiz FLUX, iyi yedek)\n' +
        '• GEMINI_API_KEY  (sınırlı, son çare)',
    });
  }

  const errors = [];
  const isEdit = !!(image?.data && image?.mimeType);

  // ─────────────────────────────────────────────────────────────
  // 1) Cloudflare Workers AI
  // ─────────────────────────────────────────────────────────────
  if (hasCF) {
    try {
      const cfResult = await callCloudflare({
        account: cfAccount,
        token: cfToken,
        prompt,
        image,
        tier,
        isEdit,
      });
      if (cfResult.image) {
        return res.status(200).json(cfResult);
      }
      errors.push(`cf: ${cfResult.refusal}`);
    } catch (err) {
      errors.push(`cf: ${err.message}`);
      console.error('[image] CF error:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2) Together AI (sadece text-to-image, editing desteklenmiyor)
  // ─────────────────────────────────────────────────────────────
  if (hasTogether && !isEdit) {
    try {
      const tResult = await callTogether({ apiKey: togetherKey, prompt });
      if (tResult.image) {
        return res.status(200).json(tResult);
      }
      errors.push(`together: ${tResult.refusal}`);
    } catch (err) {
      errors.push(`together: ${err.message}`);
      console.error('[image] Together error:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3) Gemini fallback
  // ─────────────────────────────────────────────────────────────
  if (hasGemini) {
    const chain = tier === 'fast' ? GEMINI_FAST_CHAIN : GEMINI_QUALITY_CHAIN;
    for (const model of chain) {
      try {
        const gResult = await callGemini({ apiKey: geminiKey, model, prompt, image });
        if (gResult.image) {
          return res.status(200).json(gResult);
        }
        errors.push(`${model}: ${gResult.refusal}`);
      } catch (err) {
        errors.push(`${model}: ${err.message}`);
        console.error('[image] Gemini error:', model, err.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Tüm sağlayıcılar başarısız
  // ─────────────────────────────────────────────────────────────
  console.error('[image] All providers failed:', errors.join(' | '));
  return res.status(502).json({
    error: friendlyError(errors, { hasCF, hasTogether, hasGemini }),
  });
}

// =================================================================
// Cloudflare Workers AI
// =================================================================
async function callCloudflare({ account, token, prompt, image, tier, isEdit }) {
  // Editing → her zaman kalite modeli (flux-2-klein supports image input via multipart)
  const model = isEdit
    ? CF_QUALITY
    : (tier === 'fast' ? CF_FAST : CF_QUALITY);

  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${encodeURIComponent(model)}`;

  let r;

  if (model === CF_FAST) {
    // flux-1-schnell: JSON body, returns { result: { image: "<base64>" } }
    r = await fetchTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        seed: Math.floor(Math.random() * 9_999_999),
        steps: 4,
      }),
    }, CF_MS);
  } else {
    // flux-2-klein-9b: multipart/form-data, supports optional input_image_0
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('steps', isEdit ? '15' : '20');
    form.append('width', '1024');
    form.append('height', '1024');
    if (isEdit) {
      const buf = Buffer.from(image.data, 'base64');
      form.append(
        'input_image_0',
        new Blob([buf], { type: image.mimeType }),
        'input.jpg'
      );
    }
    r = await fetchTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }, CF_MS);
  }

  // Parse response
  let data;
  try { data = await r.json(); } catch { data = null; }

  if (!r.ok || !data || data.success === false) {
    const msg = data?.errors?.[0]?.message || `HTTP ${r.status}`;
    throw new Error(msg);
  }

  const b64 = data.result?.image;
  if (!b64) {
    return { image: null, refusal: 'görsel döndürmedi' };
  }

  return {
    image: { mimeType: 'image/jpeg', data: b64 },
    text: '',
    model: LABELS[model],
  };
}

// =================================================================
// Together AI — FLUX.1-schnell-Free
// =================================================================
async function callTogether({ apiKey, prompt }) {
  const r = await fetchTimeout('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TOGETHER_MODEL,
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
      response_format: 'b64_json',
    }),
  }, TOGETHER_MS);

  let data;
  try { data = await r.json(); } catch { data = null; }

  if (!r.ok || !data) {
    const msg = data?.error?.message || data?.error || `HTTP ${r.status}`;
    throw new Error(String(msg));
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    return { image: null, refusal: 'görsel döndürmedi' };
  }

  return {
    image: { mimeType: 'image/png', data: b64 },
    text: '',
    model: LABELS[TOGETHER_MODEL],
  };
}

// =================================================================
// Gemini ("Nano Banana") — fallback
// =================================================================
async function callGemini({ apiKey, model, prompt, image }) {
  const parts = [{ text: prompt }];
  if (image?.data && image?.mimeType) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }

  const r = await fetchTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
    GEMINI_MS
  );

  let data;
  try { data = await r.json(); } catch { data = null; }

  if (!r.ok || !data) {
    const msg = data?.error?.message || `HTTP ${r.status}`;
    throw new Error(msg);
  }

  const candidates = data.candidates?.[0]?.content?.parts || [];
  const imgPart  = candidates.find((p) => p.inlineData);
  const textPart = candidates.find((p) => p.text);

  if (!imgPart) {
    return { image: null, refusal: textPart?.text || 'görsel döndürmedi' };
  }

  return {
    image: { mimeType: imgPart.inlineData.mimeType, data: imgPart.inlineData.data },
    text: textPart?.text || '',
    model: LABELS[model] || model,
  };
}

// =================================================================
// Yardımcılar
// =================================================================
function fetchTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

function friendlyError(errors, { hasCF, hasTogether, hasGemini }) {
  const all = errors.join(' | ').toLowerCase();

  // Sadece Gemini yapılandırılmış ve rate-limit yediyse
  if (!hasCF && !hasTogether && hasGemini) {
    if (/429|quota|rate.?limit|resource.?exhausted/i.test(all)) {
      return (
        'Gemini görsel kotası doldu (ücretsiz katman: ~10 istek/dakika). ' +
        'Birkaç dakika bekleyip tekrar deneyin. ' +
        'Daha güvenilir görsel üretimi için lütfen Cloudflare veya Together AI API anahtarı ekleyin (README).'
      );
    }
  }

  if (/abort|timeout/i.test(all)) {
    return 'Görsel servisi zaman aşımına uğradı. Lütfen tekrar deneyin.';
  }
  if (/429|quota|rate.?limit|resource.?exhausted|exceeded/i.test(all)) {
    return 'Tüm görsel sağlayıcıları şu anda istek limitine ulaştı. Lütfen birkaç dakika sonra tekrar deneyin.';
  }
  if (/auth|api.?key|permission|unauthorized|forbidden|403|401/i.test(all)) {
    return 'Görsel sağlayıcısına erişim reddedildi. API anahtarlarınızı kontrol edin (Cloudflare / Together / Gemini).';
  }
  if (/not found|404|unsupported/i.test(all)) {
    return 'Görsel modeli bulunamadı (model adı değişmiş olabilir). Lütfen tekrar deneyin.';
  }

  const last = errors.at(-1) || 'bilinmeyen hata';
  return 'Görsel oluşturulamadı: ' + last;
}
