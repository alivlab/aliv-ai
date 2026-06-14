import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { getSupabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username } = req.body || {};
    const clean = String(username || '').trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      return res.status(400).json({
        error: 'Kullanıcı adı 3-20 karakter olmalı ve sadece küçük harf, rakam, _ içermeli.',
      });
    }

    const supabase = getSupabase();

    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('username, verified')
      .eq('username', clean)
      .maybeSingle();

    if (lookupError) {
      console.error('Supabase lookup error:', lookupError);
      return res.status(500).json({ error: 'Sunucu hatası, lütfen tekrar deneyin.' });
    }

    if (existing && existing.verified) {
      return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(clean, 'ALIV AI', secret);
    const qr = await QRCode.toDataURL(otpauth, {
      margin: 1,
      color: { dark: '#0b0b0d', light: '#f3f1ec' },
    });

    if (existing) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ secret, verified: false })
        .eq('username', clean);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        return res.status(500).json({ error: 'Kayıt oluşturulamadı, lütfen tekrar deneyin.' });
      }
    } else {
      const { error: insertError } = await supabase
        .from('users')
        .insert({ username: clean, secret, verified: false });

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return res.status(500).json({ error: 'Kayıt oluşturulamadı, lütfen tekrar deneyin.' });
      }
    }

    return res.status(200).json({ qr, secret, otpauth });
  } catch (err) {
    console.error('Register handler error:', err);
    return res.status(500).json({ error: 'Sunucu hatası: ' + (err.message || 'bilinmeyen hata') });
  }
}
