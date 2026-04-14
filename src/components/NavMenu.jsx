import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ALL_ITEMS = [
  { icon: '🧾', label: 'Caja',           path: '/caja',   roles: ['admin','gerente','cajero','mesero','cocina'] },
  { icon: '🍳', label: 'Cocina',          path: '/cocina', roles: ['admin','gerente','cocina'] },
  { icon: '🍽️', label: 'Menú',           path: '/menu',   roles: ['admin','gerente'] },
  { icon: '⚙️', label: 'Administración', path: '/admin',  roles: ['admin','gerente'] },
]

export default function NavMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const empleado = (() => {
    try { return JSON.parse(localStorage.getItem('taqueropOS_empleadoActivo') || '{}') }
    catch { return {} }
  })()
  const rol = empleado?.rol || 'cajero'

  const items = ALL_ITEMS.filter(item => item.roles.includes(rol))

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function signOut() {
    setOpen(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700
                   text-slate-300 hover:text-white transition text-lg"
        title="Navegación"
      >
        ☰
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-700
                        bg-[#1e293b] shadow-2xl z-50 overflow-hidden py-1">
          {items.map(({ icon, label, path }) => (
            <button
              key={path}
              type="button"
              onClick={() => { setOpen(false); navigate(path) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition
                ${location.pathname === path
                  ? 'text-orange-400 bg-orange-500/10 font-semibold'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </button>
          ))}
          <div className="border-t border-slate-700 mt-1 pt-1">
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400
                         hover:bg-red-500/10 hover:text-red-400 transition"
            >
              <span className="text-base">🚪</span>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
