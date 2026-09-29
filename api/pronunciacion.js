export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { contenido, idioma } = await req.json()

  const prompt = `Sos un asistente de pronunciación para cantantes de coro que NO conocen el idioma original y necesitan leer en voz alta sin saber ${idioma}. El siguiente texto está en ${idioma}.

Para cada línea del texto, escribí tres líneas con estos prefijos exactos:
O: [línea original, tal cual]
F: [transliteración fonética escrita con la ORTOGRAFÍA DEL ESPAÑOL, para que alguien que solo sabe leer español la pronuncie en voz alta sin conocer ${idioma}. Cambiá la escritura de las palabras a cómo sonarían escritas en español (por ejemplo, sonidos como "th", "sh", vocales o consonantes que no existen en español se adaptan a la letra en español que más se parece). Separá sílabas con guiones y marcá en MAYÚSCULAS la sílaba con el acento tónico.]
T: [traducción al español entre paréntesis]

MUY IMPORTANTE: la línea F nunca puede quedar igual ni casi igual a la línea O (salvo coincidencia de una sola palabra corta). Si F queda escrita casi con las mismas letras que O, está mal: tenés que reescribir la pronunciación con ortografía de español, no repetir el texto original. Estos son ejemplos de referencia de cómo cambia la escritura:
O: Kyrie eleison
F: KI-ri-e e-LÉI-son
T: (Señor, ten piedad)

O: Going home
F: GOU-in JOUM
T: (Voy a casa)

O: Gloria in excelsis Deo
F: GLO-ria in ex-CHEL-sis DÉ-o
T: (Gloria a Dios en las alturas)

Dejá una línea en blanco entre cada grupo. Procesá cada línea del texto original UNA SOLA VEZ, respetando el mismo orden, sin omitir ninguna y sin repetir ningún grupo ni volver a escribir el texto completo de nuevo. Generá el resultado una única vez de principio a fin. No agregues explicaciones ni comentarios.

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
      temperature: 0,
      max_tokens: 2000,
    })
  })

  const data = await response.json()
  const texto = data.choices?.[0]?.message?.content || ''

  return new Response(JSON.stringify({ texto }), {
    headers: { 'Content-Type': 'application/json' }
  })
}