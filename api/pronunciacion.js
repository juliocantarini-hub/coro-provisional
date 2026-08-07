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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    })
  })

  const data = await response.json()
  const texto = data.choices?.[0]?.message?.content || ''

  return new Response(JSON.stringify({ texto }), {
    headers: { 'Content-Type': 'application/json' }
  })
}