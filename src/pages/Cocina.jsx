import { useState, useEffect, useRef, Component } from 'react'
import { useNavigate } from 'react-router-dom'

const LS_KEY = 'taqueropOS_ordenes_cocina'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readOrdenes() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function writeOrdenes(ordenes) {
  try {
    const lista = Array.isArray(ordenes) ? ordenes : []
    localStorage.setItem(LS_KEY, JSON.stringify(lista))
  } catch {}
}

function tiempoTranscurrido(ts, ahora) {
  if (!ts || !ahora) return ''
  const mins = Math.floor((ahora - ts) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `hace ${h}h ${m}m` : `hace ${h}h`
}

function esTardada(ts, ahora) {
  return ts && ahora && (ahora - ts) > 10 * 60 * 1000
}

// ─── Web Audio: beep al llegar orden nueva ────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    setTimeout(() => {
      try {
        const ctx2 = new (window.AudioContext || window.webkitAudioContext)()
        const o2 = ctx2.createOscillator()
        const g2 = ctx2.createGain()
        o2.connect(g2); g2.connect(ctx2.destination)
        o2.frequency.value = 1100
        o2.type = 'sine'
        g2.gain.setValueAtTime(0.4, ctx2.currentTime)
        g2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.3)
        o2.start(ctx2.currentTime); o2.stop(ctx2.currentTime + 0.3)
      } catch {}
    }, 200)
  } catch {}
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Cocina error:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="h-screen bg-[#0f172a] flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-white font-bold text-xl mb-2">Error en pantalla de cocina</h2>
            <p className="text-slate-400 text-sm mb-6">{String(this.state.error)}</p>
            <button type="button"
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition">
              Recargar pantalla
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Tarjeta de orden ─────────────────────────────────────────────────────────
function TarjetaOrden({ orden, onCambiarEstado, flash, ahora }) {
  if (!orden || !orden.id) return null

  const tardada = esTardada(orden.creadoEn, ahora)
  const tiempo  = tiempoTranscurrido(orden.creadoEn, ahora)
  const personas = Array.isArray(orden.personas) ? orden.personas : []

  const ESTADO_BORDER = {
    pendiente:  'border-red-500/60',
    preparando: 'border-yellow-500/60',
    listo:      'border-green-500/60',
    entregado:  'border-slate-600',
  }

  return (
    <div className={`rounded-2xl border-2 bg-slate-800 p-4 flex flex-col gap-3 transition-all duration-300
      ${ESTADO_BORDER[orden.estado] ?? 'border-slate-600'}
      ${flash ? 'animate-pulse ring-2 ring-red-400' : ''}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white font-extrabold text-lg leading-tight">
            Mesa {orden.mesa}
          </p>
          <p className="text-slate-400 text-sm">{orden.cliente || 'Sin nombre'}</p>
        </div>
        {tiempo && (
          <div className={`flex items-center gap-1 text-sm font-bold tabular-nums shrink-0
            ${tardada ? 'text-red-400' : 'text-slate-400'}`}>
            <span>⏱</span>
            <span>{tiempo}</span>
            {tardada && <span>⚠️</span>}
          </div>
        )}
      </div>

      {/* Personas e items */}
      <div className="space-y-2">
        {personas.map((persona, pi) => {
          const items = Array.isArray(persona?.items) ? persona.items : []
          return (
            <div key={pi}>
              {personas.length > 1 && (
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                  {persona.nombre || `Persona ${pi + 1}`}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item, ii) => (
                  <li key={ii} className="flex items-baseline gap-2 text-base">
                    <span className="text-orange-400 font-extrabold shrink-0">{item.cantidad}×</span>
                    <span className="text-white font-medium">{item.nombre}</span>
                  </li>
                ))}
              </ul>
              {pi < personas.length - 1 && (
                <div className="border-t border-slate-700 mt-2" />
              )}
            </div>
          )
        })}
      </div>

      {/* Botón de acción */}
      <div className="pt-1">
        {orden.estado === 'pendiente' && (
          <button type="button" onClick={() => onCambiarEstado(orden.id, 'preparando')}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600
                       text-white font-bold text-base transition">
            ▶ Iniciar preparación
          </button>
        )}
        {orden.estado === 'preparando' && (
          <button type="button" onClick={() => onCambiarEstado(orden.id, 'listo')}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700
                       text-white font-bold text-base transition">
            ✅ Marcar como listo
          </button>
        )}
        {orden.estado === 'listo' && (
          <button type="button" onClick={() => onCambiarEstado(orden.id, 'entregado')}
            className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-800
                       text-slate-300 font-bold text-base transition">
            📦 Marcar entregado
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Columna Kanban ───────────────────────────────────────────────────────────
function Columna({ titulo, icono, bgColor, borderColor, ordenes, onCambiarEstado, flashIds, ahora }) {
  const lista = Array.isArray(ordenes) ? ordenes : []
  return (
    <div className={`flex flex-col rounded-2xl ${bgColor} border ${borderColor} overflow-hidden min-h-[200px]`}>
      <div className={`px-4 py-3 border-b ${borderColor} flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{icono}</span>
          <span className="text-white font-extrabold text-base">{titulo}</span>
        </div>
        <span className="bg-slate-700 text-slate-300 text-sm font-bold px-2.5 py-0.5 rounded-full">
          {lista.length}
        </span>
      </div>
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {lista.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-2 opacity-20">—</span>
            <p className="text-slate-600 text-sm">Sin órdenes</p>
          </div>
        )}
        {lista.map(orden => (
          <TarjetaOrden
            key={orden.id}
            orden={orden}
            onCambiarEstado={onCambiarEstado}
            flash={flashIds instanceof Set && flashIds.has(orden.id)}
            ahora={ahora}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Componente interno (dentro del ErrorBoundary) ────────────────────────────
function CocinaInterna() {
  const navigate  = useNavigate()
  const [ordenes,  setOrdenes]  = useState(() => readOrdenes())
  const [ahora,    setAhora]    = useState(() => Date.now())
  const [flashIds, setFlashIds] = useState(new Set())
  const prevIdsRef = useRef(null)

  // Inicializar prevIdsRef con los IDs actuales
  useEffect(() => {
    prevIdsRef.current = new Set(readOrdenes().map(o => o.id))
  }, [])

  // Reloj en tiempo real — actualiza cada segundo
  useEffect(() => {
    const iv = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  // Polling localStorage cada 3 segundos
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        const nuevas = readOrdenes()
        const now = Date.now()

        // Detectar IDs nuevos (no entregados)
        const prevIds = prevIdsRef.current ?? new Set()
        const nuevosIds = nuevas
          .filter(o => o.estado !== 'entregado' && !prevIds.has(o.id))
          .map(o => o.id)

        if (nuevosIds.length > 0) {
          playBeep()
          const flashSet = new Set(nuevosIds)
          setFlashIds(flashSet)
          setTimeout(() => setFlashIds(new Set()), 3000)
        }

        prevIdsRef.current = new Set(nuevas.map(o => o.id))

        // Limpiar entregadas > 30s
        const limpias = nuevas.filter(o =>
          !(o.estado === 'entregado' && o.actualizadoEn && (now - o.actualizadoEn) > 30000)
        )

        if (limpias.length !== nuevas.length) {
          writeOrdenes(limpias)
        }

        setOrdenes(limpias)
      } catch (e) {
        console.error('Error en polling cocina:', e)
      }
    }, 3000)

    return () => clearInterval(iv)
  }, [])

  function cambiarEstado(id, nuevoEstado) {
    try {
      // Leer estado actual directo de localStorage (fuente de verdad)
      const actual = readOrdenes()
      const updated = actual.map(o =>
        o.id === id ? { ...o, estado: nuevoEstado, actualizadoEn: Date.now() } : o
      )
      writeOrdenes(updated)
      // Actualizar estado local inmediatamente sin esperar el polling
      setOrdenes(updated)
    } catch (e) {
      console.error('Error al cambiar estado:', e)
    }
  }

  // Derivar listas — siempre con Array.isArray guard
  const listaSegura = Array.isArray(ordenes) ? ordenes : []
  const pendientes  = listaSegura.filter(o => o?.estado === 'pendiente').sort((a,b) => (a.creadoEn||0) - (b.creadoEn||0))
  const preparando  = listaSegura.filter(o => o?.estado === 'preparando').sort((a,b) => (a.creadoEn||0) - (b.creadoEn||0))
  const listos      = listaSegura.filter(o => o?.estado === 'listo').sort((a,b) => (b.actualizadoEn||0) - (a.actualizadoEn||0))
  const totalPendientes = pendientes.length + preparando.length
  const totalActivas    = listaSegura.filter(o => o?.estado !== 'entregado').length

  // Hora formateada 12h
  const horaDisplay = new Date(ahora).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })
  const fechaDisplay = new Date(ahora).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="h-screen bg-[#0f172a] flex flex-col overflow-hidden">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3
                         bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍳</span>
          <span className="text-white font-extrabold text-xl tracking-tight">Cocina</span>
          {totalPendientes > 0 ? (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-0.5 rounded-full animate-pulse">
              {totalPendientes} pendiente{totalPendientes !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="bg-green-500/20 text-green-400 text-sm font-medium px-3 py-0.5 rounded-full">
              Al día ✓
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Reloj 12h */}
          <div className="text-right hidden sm:block">
            <p className="text-white font-bold text-lg tabular-nums leading-tight">
              {horaDisplay}
            </p>
            <p className="text-slate-500 text-xs capitalize">{fechaDisplay}</p>
          </div>

          <button type="button" onClick={() => navigate('/caja')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700
                       text-slate-300 hover:text-white text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Caja
          </button>
        </div>
      </header>

      {/* ── KANBAN ───────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden">
        <Columna
          titulo="Pendiente"
          icono="🔴"
          bgColor="bg-[#1a0808]"
          borderColor="border-red-900/50"
          ordenes={pendientes}
          onCambiarEstado={cambiarEstado}
          flashIds={flashIds}
          ahora={ahora}
        />
        <Columna
          titulo="En preparación"
          icono="🟡"
          bgColor="bg-[#1a1500]"
          borderColor="border-yellow-900/50"
          ordenes={preparando}
          onCambiarEstado={cambiarEstado}
          flashIds={flashIds}
          ahora={ahora}
        />
        <Columna
          titulo="Listo"
          icono="🟢"
          bgColor="bg-[#081a08]"
          borderColor="border-green-900/50"
          ordenes={listos}
          onCambiarEstado={cambiarEstado}
          flashIds={flashIds}
          ahora={ahora}
        />
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-2 border-t border-slate-800 flex items-center justify-between">
        <p className="text-slate-600 text-xs">
          TaqueroPOS · Cocina · Actualización cada 3 segundos
        </p>
        <p className="text-slate-600 text-xs">
          {totalActivas} orden{totalActivas !== 1 ? 'es' : ''} activa{totalActivas !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

// ─── Export con ErrorBoundary ─────────────────────────────────────────────────
export default function Cocina() {
  return (
    <ErrorBoundary>
      <CocinaInterna />
    </ErrorBoundary>
  )
}
