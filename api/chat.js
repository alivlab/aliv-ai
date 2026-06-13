export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, file, history = [] } = req.body;

    const systemInstruction = `
Sen Aliv adlı modern bir yapay zeka asistanısın.
Cevapların kısa, net, doğal ve kaliteli olsun.
Görsel gönderildiyse gerçekten görseli incele ve detaylı ama düzenli analiz yap.
Kullanıcı logo, tasarım veya görsel üretmeni isterse:
- Doğrudan görsel üretemediğini açıkça söyle.
- Ama kullanabileceği net prompt, SVG, HTML/CSS veya tasarım tarifi üret.
Bir önceki konuşmaları dikkate al.
Terminal gibi kuru konuşma. Profesyonel ama samimi cevap ver.
`;

    const contents = [];

    for (const item of history.slice(-12)) {
      contents.push({
        role: item.role === "model" ? "model" : "user",
        parts: [{ text: item.text }]
      });
    }

    const currentParts = [];

    if (message) {
      currentParts.push({ text: message });
    }

    if (file && file.data && file.type && file.type.startsWith("image/")) {
      currentParts.push({
        inlineData: {
          mimeType: file.type,
          data: file.data
        }
      });
    }

    if (file && file.type && !file.type.startsWith("image/")) {
      currentParts.push({
        text: `Kullanıcı "${file.name}" adlı bir dosya yükledi. Şu an yalnızca görseller doğrudan analiz edilebilir.`
      });
    }

    contents.push({
      role: "user",
      parts: currentParts
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents
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
