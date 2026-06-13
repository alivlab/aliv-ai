export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const userMessage = body.message;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    return Response.json({
      reply: data.content?.[0]?.text || "Cevap alınamadı."
    });

  } catch (err) {
    return Response.json({
      error: "Hata: " + err.message
    }, { status: 500 });
  }
}