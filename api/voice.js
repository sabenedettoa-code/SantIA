export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido."
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en Vercel."
      });
    }

    const { text } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "No se recibió texto para generar voz."
      });
    }

    const cleanText = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#*_>`]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    const response = await fetch(
      "https://api.openai.com/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: "coral",
          input: cleanText,
          instructions:
            "Habla en español de Chile. Voz femenina cálida, cercana, natural, amable y conversacional. Usa ritmo chileno natural, sin exagerar modismos ni caricaturizar el acento. Debe sonar como una asistente inteligente moderna, tranquila y acogedora.",
          response_format: "mp3"
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(errorText);

      return res.status(response.status).json({
        error: "No se pudo generar la voz de SantIA."
      });
    }

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader(
      "Cache-Control",
      "private, max-age=0, no-store"
    );

    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error.message ||
        "No se pudo generar la voz."
    });
  }
}
