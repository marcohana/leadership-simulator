export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const isStream = req.body.stream === true;
  
  // Build the Anthropic request body (remove our custom 'stream' flag)
  const anthropicBody = { ...req.body };
  delete anthropicBody.stream;
  if (isStream) anthropicBody.stream = true;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(anthropicBody)
    });

    if (!response.ok) {
      let errMsg = "API error " + response.status;
      try { const e = await response.json(); errMsg = e.error?.message || errMsg; } catch(e) {}
      return res.status(response.status).json({ error: errMsg });
    }

    // Non-streaming: return JSON directly
    if (!isStream) {
      const data = await response.json();
      return res.status(200).json(data);
    }

    // Streaming: pipe the SSE response through
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Use response.body as async iterable (Node 18+)
    for await (const chunk of response.body) {
      res.write(chunk);
    }
    res.end();

  } catch (error) {
    if (res.headersSent) { res.end(); }
    else { res.status(500).json({ error: "Server error: " + error.message }); }
  }
}
