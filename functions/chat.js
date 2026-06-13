export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const response = await fetch("https://opencode.ai/zen/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.OPENCODE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "minimax-m2.5-free",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: body.message
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        error: JSON.stringify(data)
      }, { status: 500 });
    }

    return Response.json({
      reply: data.content?.[0]?.text || JSON.stringify(data)
    });

  } catch (err) {
    return Response.json({
      error: "Hata: " + err.message
    }, { status: 500 });
  }
}
