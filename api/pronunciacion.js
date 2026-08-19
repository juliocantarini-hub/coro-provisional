export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { contenido, idioma } = await req.json()

  const prompt = `Sos un asistente de pronunciación para cantantes de coro. El siguiente texto está en ${idioma}. Para cada línea del texto, escribí tres líneas con estos prefijos exactos:
O: [línea original]
F: [pronunciación fonética simplificada en español, con guiones entre sílabas y la sílaba acentuada en MAYÚSCULAS]
T: [traducción al español entre paréntesis]

Dejá una línea en blanco entre cada grupo. No agregues explicaciones ni comentarios. Ejemplo de formato:
O: Kyrie eleison
F: KI-ri-e e-LEI-son
T: (Señor, ten piedad)

Texto:\n\n${contenido}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    })
  })

  const data = await response.json()
  const texto = data.choices?.[0]?.message?.content || ''

  return new Response(JSON.stringify({ texto }), {
    headers: { 'Content-Type': 'application/json' }
  })
}