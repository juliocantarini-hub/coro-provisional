export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { contenido, idioma } = await req.json()

  const prompt = `Sos un asistente de pronunciación para cantantes de coro. El siguiente texto está en ${idioma}. Para cada línea del texto, escribí la línea original y debajo su pronunciación fonética simplificada en español, para que un cantante que no conoce el idioma pueda pronunciarlo correctamente. Usá guiones para separar sílabas y mayúsculas para la sílaba acentuada. Formato exacto:

[línea original]
[pronunciación]

[línea siguiente]
[pronunciación]

No agregues explicaciones ni comentarios, solo el texto con su pronunciación. Texto:\n\n${contenido}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  )

  const data = await response.json()
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return new Response(JSON.stringify({ texto }), {
    headers: { 'Content-Type': 'application/json' }
  })
}