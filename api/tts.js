export const config = { supportsResponseStreaming: true };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const { text, voiceName, prompt } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const voice = voiceName || "Kore";
  const stylePrompt = prompt || "Parle à un rythme soutenu et naturel, comme dans une conversation de bureau entre collègues. Pas de pauses inutiles.";

  // Try streaming first, fall back to non-streaming
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: `${stylePrompt}\n\nDis exactement ceci : "${text}"` }]
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice }
        }
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Gemini TTS error:", JSON.stringify(errData));

      // Fallback to non-streaming endpoint
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!fallbackRes.ok) {
        const fbErr = await fallbackRes.json().catch(() => ({}));
        return res.status(fallbackRes.status).json({ error: fbErr.error?.message || "TTS error" });
      }

      const fbData = await fallbackRes.json();
      const audioData = fbData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) return res.status(500).json({ error: "No audio in response" });

      // Return as single-chunk streaming format
      res.setHeader("Content-Type", "application/x-ndjson");
      res.write(JSON.stringify({ audio: audioData, done: true }) + "\n");
      return res.end();
    }

    // Stream the response
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse JSON array chunks from Gemini streaming response
      // Gemini streams as a JSON array: [{...}, {...}, ...]
      // We need to extract complete objects
      let searchStart = 0;
      while (searchStart < buffer.length) {
        // Find audio data in the buffer
        const dataStart = buffer.indexOf('"data":', searchStart);
        if (dataStart === -1) break;

        const valueStart = buffer.indexOf('"', dataStart + 7);
        if (valueStart === -1) break;

        const valueEnd = buffer.indexOf('"', valueStart + 1);
        if (valueEnd === -1) break; // Incomplete, wait for more data

        const audioChunk = buffer.substring(valueStart + 1, valueEnd);
        if (audioChunk.length > 0) {
          res.write(JSON.stringify({ audio: audioChunk, done: false }) + "\n");
        }

        searchStart = valueEnd + 1;
      }

      // Keep only unprocessed part of buffer
      const lastProcessed = buffer.lastIndexOf('"data"');
      if (lastProcessed > 0) {
        // Keep from last potential incomplete match
        const lastQuote = buffer.lastIndexOf('"', buffer.length - 1);
        if (lastQuote > lastProcessed) {
          buffer = buffer.substring(lastQuote);
        }
      }
    }

    res.write(JSON.stringify({ audio: "", done: true }) + "\n");
    res.end();
  } catch (error) {
    console.error("TTS server error:", error);
    // If headers already sent, just end
    if (res.headersSent) {
      res.write(JSON.stringify({ error: error.message, done: true }) + "\n");
      res.end();
    } else {
      res.status(500).json({ error: "Server error: " + error.message });
    }
  }
}
