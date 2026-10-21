import { useEffect, useState } from 'react'

// Ventana de ayuda "Cómo practicar": se abre en el medio de la pantalla, con una X para cerrar
// y la opción de no volver a mostrarla (se recuerda en este dispositivo).

const CLAVE_OCULTA = 'corum_ayuda_practica_oculta'
const CLAVE_VISTA = 'corum_ayuda_practica_vista' // una vez por sesión

export function ayudaPracticaOculta() {
  try { return localStorage.getItem(CLAVE_OCULTA) === '1' } catch { return false }
}

/** La ayuda se abre sola una vez por sesión, salvo que el cantante haya elegido no verla más. */
export function debeAbrirseSola() {
  if (ayudaPracticaOculta()) return false
  try { return sessionStorage.getItem(CLAVE_VISTA) !== '1' } catch { return true }
}

/** Marca que la ayuda ya se mostró en esta sesión (se llama al abrirse, no al decidir). */
export function marcarAyudaVista() {
  try { sessionStorage.setItem(CLAVE_VISTA, '1') } catch { /* sin almacenamiento */ }
}

function Paso({ icono, titulo, children }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
      <div style={{ fontSize: '20px', lineHeight: '24px', flex: '0 0 26px', textAlign: 'center' }}>{icono}</div>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A18', marginBottom: '2px' }}>{titulo}</div>
        <div style={{ fontSize: '13px', color: '#3D3D3A', lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  )
}

export default function AyudaPractica({ onCerrar }) {
  const [noMostrar, setNoMostrar] = useState(false)
  useEffect(() => { marcarAyudaVista() }, [])

  function cerrar() {
    if (noMostrar) {
      try { localStorage.setItem(CLAVE_OCULTA, '1') } catch { /* sin almacenamiento */ }
    }
    onCerrar(noMostrar)
  }

  return (
    <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(26,26,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cómo practicar"
        style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '18px 18px 16px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#1A1A18' }}>Cómo practicar tu parte</div>
          <button onClick={cerrar} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', color: '#5F5E5A', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <Paso icono="🎹" titulo="Piano">
          Escuchá tu parte y mirá en el teclado qué notas van sonando, sin usar el micrófono.
        </Paso>
        <Paso icono="🎤" titulo="Practicar afinación">
          Escuchá primero una sección, pausá y repetila cantándola. Tu afinación se refleja en las teclas del piano,
          y el medidor muestra tu rango: si se mantiene en verde y amarillo, tu afinación es estable. La primera vez
          el navegador pide permiso para usar el micrófono: hace falta aceptarlo.
        </Paso>
        <Paso icono="📝" titulo="Grabarme y ver informe">
          Elegís un fragmento, escuchás el primer compás y un compás de clics, y cantás. Al terminar te mostramos dónde
          corregir afinación y ritmo, y podés pedir consejos de práctica. Usá auriculares para que los clics no se cuelen.
          Tu grabación no se guarda: se analiza en tu dispositivo y se descarta.
        </Paso>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#3D3D3A', margin: '14px 0 14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={noMostrar} onChange={(e) => setNoMostrar(e.target.checked)} />
          No volver a mostrar esta ayuda
        </label>
        <button onClick={cerrar} style={{ padding: '10px 22px', borderRadius: '22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', border: 'none', background: '#1D7A5F', color: '#FFFFFF' }}>
          Entendido
        </button>
      </div>
    </div>
  )
}
