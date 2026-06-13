export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body;

    const response = await fetch(
      "https://opencode.ai/zen/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENCODE_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          messages: [
            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "JSON parse hatası",
        raw: text
      });
    }

    if (!response.ok) {
      return res.status(500).json({
        error: data
      });
    }

    return res.status(200).json({
      reply:
        data.choices?.[0]?.message?.content ||
        JSON.stringify(data)
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
