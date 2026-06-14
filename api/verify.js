import { authenticator } from 'otplib';
import { getSupabase } from './_supabase.js';
import { createToken } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, code, mode } = req.body || {};
    const clean = String(username || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim().replace(/\s+/g, '');

    if (!clean || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Lütfen 6 haneli kodu girin.' });
    }

    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', clean)
      .maybeSingle();

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ error: 'Sunucu hatası, lütfen tekrar deneyin.' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    if (mode === 'login' && !user.verified) {
      return res.status(403).json({ error: 'Hesap henüz doğrulanmadı. Önce kayıt işlemini tamamlayın.' });
    }

    const valid = authenticator.verify({ token: cleanCode, secret: user.secret });
    if (!valid) {
      return res.status(401).json({ error: 'Kod geçersiz veya süresi doldu. Tekrar deneyin.' });
    }

    if (mode === 'register' && !user.verified) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ verified: true })
        .eq('username', clean);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        return res.status(500).json({ error: 'Sunucu hatası, lütfen tekrar deneyin.' });
      }
    }

    const token = createToken(clean);
    return res.status(200).json({ token, username: clean });
  } catch (err) {
    console.error('Verify handler error:', err);
    return res.status(500).json({ error: 'Sunucu hatası: ' + (err.message || 'bilinmeyen hata') });
  }
}
