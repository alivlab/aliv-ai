export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const response = await fetch("https://opencode.ai/zen/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENCODE_API_KEY}`
      },
      body: JSON.stringify({
        model: "minimax-m2.5-free",
        input: body.message
      })
    });

    const data = await response.json();

    return Response.json({
      reply:
        data.output_text ||
        data.output?.[0]?.content?.[0]?.text ||
        JSON.stringify(data)
    });

  } catch (err) {
    return Response.json({
      error: "Hata: " + err.message
    }, { status: 500 });
  }
}
