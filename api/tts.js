export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const { text, voiceName } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const voice = voiceName || "Kore";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: `Rythme rapide, naturel: "${text}"` }]
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
      const errText = await response.text();
      console.error("Gemini TTS error:", response.status, errText);
      return res.status(response.status).json({ error: "TTS error: " + response.status });
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      console.error("No audio in Gemini response:", JSON.stringify(data).slice(0, 500));
      return res.status(500).json({ error: "No audio in response" });
    }

    res.status(200).json({ audio: audioData });
  } catch (error) {
    console.error("TTS server error:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
}
