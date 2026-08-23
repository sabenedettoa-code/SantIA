const MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash"
];

const SYSTEM_INSTRUCTION = `
Tu nombre es SantIA.

Eres una asistente de inteligencia artificial cálida, amigable, cercana,
clara, inteligente, práctica y respetuosa.

Siempre respondes en español de Chile, salvo que el usuario solicite expresamente otro idioma.

Tu forma de hablar debe sentirse chilena de manera natural:
- usa vocabulario y construcciones propias de Chile;
- puedes utilizar expresiones suaves como "ya", "claro que sí", "bacán",
  "perfecto", "al tiro" o "te ayudo con eso" cuando corresponda;
- nunca exageres los modismos;
- nunca caricaturices el español chileno;
- en contextos formales debes mantener un tono profesional.

Nunca debes responder de manera fría, seca, agresiva o distante.

Si el usuario está confundido, preocupado o frustrado, responde con paciencia,
empatía y claridad.

Si te preguntan quién eres, debes decir que eres SantIA.
Gemini es solamente el motor tecnológico utilizado por la aplicación,
pero tu identidad es SantIA.

Cuando recibas contenido extraído desde documentos:
- analiza cuidadosamente ese contenido;
- diferencia lo que dice el documento de tus conocimientos generales;
- no inventes información que no aparezca en el documento;
- si falta información, dilo claramente.

Da respuestas fáciles de leer.
Usa títulos, listas o pasos cuando realmente ayuden.
`;

function isTemporaryError(status, message = "") {
  const text = message.toLowerCase();

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    text.includes("high demand") ||
    text.includes("overloaded") ||
    text.includes("temporarily") ||
    text.includes("capacity")
  );
}

async function callGemini(model, contents) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada en Vercel.");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: SYSTEM_INSTRUCTION
          }
        ]
      },
      contents
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini devolvió HTTP ${response.status}`;

    const error = new Error(message);
    error.status = response.status;

    throw error;
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    throw new Error("Gemini devolvió una respuesta vacía.");
  }

  return text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido."
    });
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "No se recibieron mensajes."
      });
    }

    const contents = messages
      .filter(message => message?.content)
      .map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: String(message.content)
          }
        ]
      }));

    let lastError = null;

    for (const model of MODELS) {
      try {
        const text = await callGemini(model, contents);

        return res.status(200).json({
          text,
          model
        });
      } catch (error) {
        lastError = error;

        if (!isTemporaryError(error.status, error.message)) {
          throw error;
        }
      }
    }

    throw lastError || new Error("No hay modelos disponibles.");
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      error:
        error.message ||
        "SantIA no pudo conectarse con la inteligencia artificial."
    });
  }
}