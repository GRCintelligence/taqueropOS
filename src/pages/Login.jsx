import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BUSINESS_ID = '00000000-0000-0000-0000-000000000001'

const ROL_BADGE = {
  admin:   'bg-red-500/20    text-red-400    border border-red-500/30',
  gerente: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  cajero:  'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  mesero:  'bg-blue-500/20   text-blue-400   border border-blue-500/30',
  cocina:  'bg-green-500/20  text-green-400  border border-green-500/30',
}

const ROL_LABEL = {
  admin: 'Admin', gerente: 'Gerente', cajero: 'Cajero',
  mesero: 'Mesero', cocina: 'Cocina',
}

// ─── Login con email + contraseña ─────────────────────────────────────────────
function FormLogin({ onSuccess }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })

    if (authErr) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500 mb-4 shadow-lg shadow-orange-500/30">
            <span className="text-4xl">🌮</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Taquero<span className="text-orange-500">POS</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Sistema de punto de venta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="usuario@taqueria.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-base
                       transition shadow-lg shadow-orange-500/25 disabled:opacity-60 disabled:cursor-not-allowed mt-2">
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </span>
              : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-8">TaqueroPOS v1.0 — Solo acceso autorizado</p>
      </div>
    </div>
  )
}

// ─── Selección de empleado ─────────────────────────────────────────────────────
function SeleccionEmpleado({ onSelect, onSkip }) {
  const [empleados, setEmpleados] = useState(null) // null = loading
  const [error,     setError]     = useState('')

  useState(() => {
    supabase
      .from('empleados')
      .select('id, nombre, rol, pin')
      .eq('business_id', BUSINESS_ID)
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error: err }) => {
        if (err) { setError('No se pudieron cargar los empleados.'); setEmpleados([]); return }
        setEmpleados(Array.isArray(data) ? data : [])
      })
  }, [])

  if (empleados === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (empleados.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-white font-bold text-xl mb-2">No hay empleados registrados</h2>
          <p className="text-slate-400 text-sm mb-6">
            {error || 'Agrega empleados desde el panel de administración para usar esta función.'}
          </p>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={onSkip}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition">
              Entrar de todas formas
            </button>
            <button type="button" onClick={() => window.location.href = '/admin'}
              className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition">
              Ir al Panel de Admin
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">👋</div>
          <h2 className="text-white font-extrabold text-2xl">¿Quién eres?</h2>
          <p className="text-slate-400 text-sm mt-1">Selecciona tu perfil para comenzar</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {empleados.map(emp => (
            <button key={emp.id} type="button" onClick={() => onSelect(emp)}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-slate-800 border border-slate-700
                         hover:border-orange-500 hover:bg-slate-700 active:scale-95 transition text-center group">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center
                              text-2xl font-extrabold text-orange-400 group-hover:bg-orange-500/30 transition">
                {emp.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{emp.nombre}</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${ROL_BADGE[emp.rol] ?? ROL_BADGE.cajero}`}>
                  {ROL_LABEL[emp.rol] ?? emp.rol}
                </span>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-slate-600 text-xs">
          ¿No ves tu perfil?{' '}
          <button type="button" onClick={onSkip} className="text-slate-500 hover:text-slate-300 underline transition">
            Entrar sin identificarse
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Entrada de PIN ───────────────────────────────────────────────────────────
function EntradaPIN({ empleado, onConfirm, onBack }) {
  const [pin, setPin]   = useState('')
  const [err, setErr]   = useState('')
  const [busy, setBusy] = useState(false)

  async function confirmar() {
    if (pin.length < 4) { setErr('Ingresa los 4 dígitos.'); return }
    if (pin !== empleado.pin) { setErr('PIN incorrecto'); setPin(''); return }

    setBusy(true)
    const entrada = Date.now()

    // Guardar empleado activo en localStorage
    localStorage.setItem('taqueropOS_empleadoActivo', JSON.stringify({
      id:      empleado.id,
      nombre:  empleado.nombre,
      rol:     empleado.rol,
      entrada,
    }))

    // Registrar entrada en la tabla turnos
    try {
      await supabase.from('turnos').insert({
        empleado_id: empleado.id,
        business_id: BUSINESS_ID,
        entrada:     new Date(entrada).toISOString(),
      })
    } catch { /* continuar aunque falle el registro */ }

    onConfirm()
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        {/* Avatar + nombre */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center
                          text-3xl font-extrabold text-orange-400 mx-auto mb-3">
            {empleado.nombre.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-white font-bold text-lg">{empleado.nombre}</h2>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${ROL_BADGE[empleado.rol] ?? ROL_BADGE.cajero}`}>
            {ROL_LABEL[empleado.rol] ?? empleado.rol}
          </span>
          <p className="text-slate-400 text-sm mt-3">Ingresa tu PIN de 4 dígitos</p>
        </div>

        {/* Display PIN */}
        <div className="flex justify-center gap-3 mb-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold transition
              ${pin.length > i ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-600 border border-slate-700'}`}>
              {pin.length > i ? '●' : '○'}
            </div>
          ))}
        </div>

        {err && <p className="text-red-400 text-sm text-center mb-3 font-medium">{err}</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} type="button"
              onClick={() => { if (pin.length < 4) { setPin(p => p + n); setErr('') } }}
              className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-xl border border-slate-700 transition">
              {n}
            </button>
          ))}
          <button type="button" onClick={() => { setPin(p => p.slice(0,-1)); setErr('') }}
            className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xl border border-slate-700 transition">
            ←
          </button>
          <button type="button" onClick={() => { if (pin.length < 4) { setPin(p => p + '0'); setErr('') } }}
            className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xl border border-slate-700 transition">
            0
          </button>
          <div />
        </div>

        <button type="button" onClick={confirmar} disabled={busy || pin.length < 4}
          className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-base
                     transition disabled:opacity-50 disabled:cursor-not-allowed mb-3">
          {busy
            ? <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </span>
            : 'Entrar'}
        </button>

        <button type="button" onClick={onBack}
          className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition text-center">
          ← Cambiar de empleado
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate()
  // 'login' → 'empleados' → 'pin' → navigate('/caja')
  const [paso,        setPaso]        = useState('login')
  const [empSelecto,  setEmpSelecto]  = useState(null)

  function irACaja() { navigate('/caja') }

  if (paso === 'login') {
    return <FormLogin onSuccess={() => setPaso('empleados')} />
  }

  if (paso === 'empleados') {
    return (
      <SeleccionEmpleado
        onSelect={emp => { setEmpSelecto(emp); setPaso('pin') }}
        onSkip={irACaja}
      />
    )
  }

  if (paso === 'pin' && empSelecto) {
    return (
      <EntradaPIN
        empleado={empSelecto}
        onConfirm={irACaja}
        onBack={() => { setEmpSelecto(null); setPaso('empleados') }}
      />
    )
  }

  return null
}
