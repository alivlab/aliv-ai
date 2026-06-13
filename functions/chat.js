export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENCODE_API_KEY}`
      },
      body: JSON.stringify({
        model: "minimax-m2.5-free",
        messages: [
          {
            role: "user",
            content: body.message
          }
        ]
      })
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return Response.json({
        error: "JSON olmayan cevap geldi: " + text
      }, { status: 500 });
    }

    if (!response.ok) {
      return Response.json({
        error: JSON.stringify(data)
      }, { status: 500 });
    }

    return Response.json({
      reply: data.choices?.[0]?.message?.content || JSON.stringify(data)
    });

  } catch (err) {
    return Response.json({
      error: "Hata: " + err.message
    }, { status: 500 });
  }
}
