export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const { text, voiceName, prompt } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const voice = voiceName || "Kore";
  const stylePrompt = prompt || "Parle à un rythme soutenu et naturel, comme dans une conversation de bureau entre collègues. Pas de pauses inutiles.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

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

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini TTS error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data.error?.message || "TTS error" });
    }

    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) return res.status(500).json({ error: "No audio in response" });

    // Return base64 PCM audio data
    res.status(200).json({ audio: audioData });
  } catch (error) {
    console.error("TTS server error:", error);
    res.status(500).json({ error: "Server error" });
  }
}
