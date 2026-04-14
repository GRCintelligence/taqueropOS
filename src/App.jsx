import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Caja from './pages/Caja'
import Cocina from './pages/Cocina'
import Menu from './pages/Menu'
import Reportes from './pages/Reportes'
import Admin from './pages/Admin'

const ROL_LABEL = {
  admin: 'Dueño', gerente: 'Gerente', cajero: 'Cajero',
  mesero: 'Mesero', cocina: 'Cocina',
}

// ─── Pantalla de acceso restringido ──────────────────────────────────────────
function AccesoRestringido({ rol }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-5">🔒</div>
        <h1 className="text-white font-extrabold text-2xl mb-2">Acceso restringido</h1>
        <p className="text-slate-400 text-sm mb-6">
          Tu rol de <span className="text-orange-400 font-semibold">{ROL_LABEL[rol] ?? rol}</span> no tiene
          permiso para esta sección.
        </p>
        <button
          type="button"
          onClick={() => navigate('/caja')}
          className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold
                     transition shadow-lg shadow-orange-500/25"
        >
          ← Volver a Caja
        </button>
      </div>
    </div>
  )
}

// ─── Verifica sesión de Supabase + rol del empleado ──────────────────────────
function RoleRoute({ children, roles }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  // Si no se especifican roles, cualquier sesión válida pasa
  if (!roles) return children

  const empleado = (() => {
    try { return JSON.parse(localStorage.getItem('taqueropOS_empleadoActivo') || '{}') }
    catch { return {} }
  })()
  const rol = empleado?.rol || 'cajero'

  if (!roles.includes(rol)) return <AccesoRestringido rol={rol} />

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/caja"     element={<RoleRoute roles={['admin','gerente','cajero','mesero']}><Caja /></RoleRoute>} />
        <Route path="/cocina"   element={<RoleRoute roles={['admin','gerente','cocina']}><Cocina /></RoleRoute>} />
        <Route path="/menu"     element={<RoleRoute roles={['admin','gerente']}><Menu /></RoleRoute>} />
        <Route path="/reportes" element={<RoleRoute roles={['admin','gerente']}><Reportes /></RoleRoute>} />
        <Route path="/admin"    element={<RoleRoute roles={['admin','gerente']}><Admin /></RoleRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
