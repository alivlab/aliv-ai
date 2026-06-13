export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, file } = req.body;

    const parts = [];

    if (message) {
      parts.push({ text: message });
    }

    if (file && file.data && file.type && file.type.startsWith("image/")) {
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: file.data
        }
      });
    }

    if (file && file.type && !file.type.startsWith("image/")) {
      parts.push({
        text: `Kullanıcı "${file.name}" adlı bir dosya yükledi. Şu an yalnızca görseller doğrudan analiz edilebilir.`
      });
    }

    if (parts.length === 0) {
      return res.status(400).json({ error: "Mesaj veya dosya gönderilmedi." });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || JSON.stringify(data)
      });
    }

    return res.status(200).json({
      reply:
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Cevap alınamadı."
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
