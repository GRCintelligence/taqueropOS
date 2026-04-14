import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavMenu from '../components/NavMenu'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const BUSINESS_ID = '00000000-0000-0000-0000-000000000001'

const ROL_OPTIONS = ['admin', 'gerente', 'cajero', 'mesero', 'cocina']
const ROL_LABEL   = { admin: 'Dueño', gerente: 'Gerente', cajero: 'Cajero', mesero: 'Mesero', cocina: 'Cocina' }
const ROL_BADGE   = {
  admin:   'bg-red-500/20    text-red-400    border border-red-500/30',
  gerente: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  cajero:  'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  mesero:  'bg-blue-500/20   text-blue-400   border border-blue-500/30',
  cocina:  'bg-green-500/20  text-green-400  border border-green-500/30',
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}

const fmt = n => `$${(parseFloat(n) || 0).toFixed(2)}`

function readCobradosRange(desde, hasta) {
  const result = []
  const cur = new Date(desde + 'T00:00:00')
  const end = new Date(hasta  + 'T23:59:59')
  while (cur <= end) {
    const key = `taqueropOS_cobrados_${dateStr(cur)}`
    const data = readLS(key, [])
    result.push(...data.map(c => ({ ...c, _fecha: dateStr(cur) })))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function periodoRange(periodo) {
  const hoy = new Date()
  const hoyStr = dateStr(hoy)
  if (periodo === 'hoy') return { desde: hoyStr, hasta: hoyStr }
  if (periodo === 'semana') {
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    return { desde: dateStr(lunes), hasta: hoyStr }
  }
  if (periodo === 'mes') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return { desde: dateStr(ini), hasta: hoyStr }
  }
  return null // personalizado
}

// ─── Paleta de temas ──────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:        'bg-[#0f172a]',
    panel:     'bg-[#1e293b]',
    border:    'border-slate-700',
    text:      'text-white',
    textSub:   'text-slate-400',
    input:     'bg-slate-900 border-slate-600 text-white placeholder-slate-500',
    divider:   'border-slate-700/50',
    rowHover:  'hover:bg-slate-700/30',
    toggleOff: 'bg-slate-600',
    track:     'bg-slate-700',
    hdr:       'bg-[#0f172a] border-slate-800',
    badge:     'bg-slate-700 text-slate-300',
    btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-300',
    chartGrid: '#334155',
    chartText: '#94a3b8',
  },
  light: {
    bg:        'bg-slate-100',
    panel:     'bg-white',
    border:    'border-slate-200',
    text:      'text-slate-900',
    textSub:   'text-slate-500',
    input:     'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    divider:   'border-slate-200',
    rowHover:  'hover:bg-slate-50',
    toggleOff: 'bg-slate-300',
    track:     'bg-slate-200',
    hdr:       'bg-slate-100 border-slate-200',
    badge:     'bg-slate-100 text-slate-600 border border-slate-200',
    btnSecondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
    chartGrid: '#e2e8f0',
    chartText: '#64748b',
  },
}

const PIE_COLORS = ['#f97316','#3b82f6','#a855f7','#22c55e','#ec4899','#14b8a6']

// ─── PIN Gate (acceso al admin) ───────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  function tryUnlock() {
    const stored = localStorage.getItem('taqueropOS_adminPIN') || '2205'
    if (pin === stored) onUnlock()
    else { setErr('PIN incorrecto'); setPin('') }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xs bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="text-white font-bold text-xl">Panel de Administración</h2>
          <p className="text-slate-400 text-sm mt-1">Ingresa el PIN de administrador</p>
        </div>
        <div className="flex justify-center gap-3 mb-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold transition
              ${pin.length > i ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-600'}`}>
              {pin.length > i ? '●' : '○'}
            </div>
          ))}
        </div>
        {err && <p className="text-red-400 text-sm text-center mb-3 font-medium">{err}</p>}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} type="button"
              onClick={() => { if (pin.length < 4) { setPin(p => p + n); setErr('') } }}
              className="py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold text-xl transition">
              {n}
            </button>
          ))}
          <button type="button" onClick={() => { setPin(p => p.slice(0,-1)); setErr('') }}
            className="py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xl transition">←</button>
          <button type="button" onClick={() => { if (pin.length < 4) { setPin(p => p + '0'); setErr('') } }}
            className="py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition">0</button>
          <div />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigate('/caja')}
            className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition">
            ← Volver
          </button>
          <button type="button" onClick={tryUnlock}
            className="py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition">
            Entrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de PIN inline (para proteger acciones) ─────────────────────────────
function PinModal({ titulo, subtitulo, onConfirm, onCancel }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  function confirm() {
    const stored = localStorage.getItem('taqueropOS_adminPIN') || '2205'
    if (pin === stored) { onConfirm(); return }
    setErr('PIN incorrecto')
    setPin('')
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xs bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🔐</div>
          <h3 className="text-white font-bold text-base">{titulo}</h3>
          {subtitulo && <p className="text-slate-400 text-sm mt-0.5">{subtitulo}</p>}
        </div>
        <div className="flex justify-center gap-2.5 mb-3">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold transition
              ${pin.length > i ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-600'}`}>
              {pin.length > i ? '●' : '○'}
            </div>
          ))}
        </div>
        {err && <p className="text-red-400 text-sm text-center mb-2 font-medium">{err}</p>}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} type="button"
              onClick={() => { if (pin.length < 4) { setPin(p => p + n); setErr('') } }}
              className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold text-xl transition">
              {n}
            </button>
          ))}
          <button type="button" onClick={() => { setPin(p => p.slice(0,-1)); setErr('') }}
            className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xl transition">←</button>
          <button type="button" onClick={() => { if (pin.length < 4) { setPin(p => p + '0'); setErr('') } }}
            className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition">0</button>
          <div />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel}
            className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={pin.length < 4}
            className="py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition disabled:opacity-50">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Selector de tema ─────────────────────────────────────────────────────────
function ThemeSelector({ onSelect }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🎨</div>
        <h2 className="text-white font-bold text-2xl mb-2">¿Qué tema prefieres?</h2>
        <p className="text-slate-400 text-sm mb-8">Puedes cambiarlo después desde la barra lateral</p>
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => onSelect('dark')}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-800 border-2 border-slate-700
                       hover:border-orange-500 transition">
            <span className="text-4xl">🌙</span>
            <div>
              <p className="text-white font-bold">Tema Oscuro</p>
              <p className="text-slate-400 text-xs mt-0.5">Fondo negro / azul</p>
            </div>
          </button>
          <button type="button" onClick={() => onSelect('light')}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border-2 border-slate-200
                       hover:border-orange-500 transition">
            <span className="text-4xl">☀️</span>
            <div>
              <p className="text-slate-900 font-bold">Tema Claro</p>
              <p className="text-slate-500 text-xs mt-0.5">Fondo blanco / gris</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Navegación lateral ───────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: '📊 Reportes',
    items: [
      { id: 'rep-resumen',   label: 'Resumen de ventas' },
      { id: 'rep-articulo',  label: 'Ventas por artículo' },
      { id: 'rep-categoria', label: 'Ventas por categoría' },
      { id: 'rep-pago',      label: 'Tipo de pago' },
      { id: 'rep-recibos',   label: 'Recibos' },
      { id: 'rep-desctos',   label: 'Descuentos' },
    ],
  },
  {
    label: '👥 Empleados',
    items: [
      { id: 'emp-lista',  label: 'Lista de empleados' },
      { id: 'emp-acceso', label: 'Derechos de acceso' },
      { id: 'emp-horas',  label: 'Horas trabajadas' },
    ],
  },
  {
    label: '⚙️ Configuración',
    items: [
      { id: 'cfg-negocio',   label: 'Datos del negocio' },
      { id: 'cfg-pagos',     label: 'Métodos de pago' },
      { id: 'cfg-pin',       label: 'Cambiar PIN' },
      { id: 'cfg-funciones', label: 'Funciones' },
    ],
  },
]

const SECTION_TITLES = {
  dashboard:       '',
  'rep-resumen':   'Resumen de ventas',
  'rep-articulo':  'Ventas por artículo',
  'rep-categoria': 'Ventas por categoría',
  'rep-pago':      'Ventas por tipo de pago',
  'rep-recibos':   'Recibos',
  'rep-desctos':   'Descuentos',
  'emp-lista':     'Lista de empleados',
  'emp-acceso':    'Derechos de acceso',
  'emp-horas':     'Horas trabajadas',
  'cfg-negocio':   'Datos del negocio',
  'cfg-pagos':     'Métodos de pago',
  'cfg-pin':       'Cambiar PIN',
  'cfg-funciones': 'Funciones',
}

// ─── Helper: calcular top productos ──────────────────────────────────────────
function calcTopProducts(cobrados) {
  const counts = {}
  cobrados.forEach(ticket => {
    if (!Array.isArray(ticket.items)) return
    ticket.items.forEach(({ product, qty }) => {
      if (!product?.name) return
      counts[product.name] = (counts[product.name] || 0) + (qty || 1)
    })
  })
  return Object.entries(counts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }))
}

// ─── Selector de período (reutilizable) ──────────────────────────────────────
function PeriodoSelector({ periodo, setPeriodo, desde, setDesde, hasta, setHasta, t }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border ${t.border} ${t.panel}`}>
      {[
        { id: 'hoy',    label: 'Hoy' },
        { id: 'semana', label: 'Esta semana' },
        { id: 'mes',    label: 'Este mes' },
        { id: 'custom', label: 'Personalizado' },
      ].map(({ id, label }) => (
        <button key={id} type="button" onClick={() => setPeriodo(id)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
            ${periodo === id
              ? 'bg-orange-500 text-white'
              : `${t.btnSecondary}`}`}>
          {label}
        </button>
      ))}
      {periodo === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className={`px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${t.input}`} />
          <span className={`text-sm ${t.textSub}`}>—</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className={`px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${t.input}`} />
        </div>
      )}
    </div>
  )
}

// ─── Toggle genérico ──────────────────────────────────────────────────────────
function Toggle({ value, onChange, theme }) {
  const t = THEMES[theme]
  return (
    <button type="button" onClick={onChange}
      className={`relative w-12 h-6 rounded-full shrink-0 transition-colors duration-200
        ${value ? 'bg-orange-500' : t.toggleOff}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
        transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate()

  const [unlocked, setUnlocked] = useState(false)
  const [theme,       setTheme]       = useState(() => readLS('taqueropOS_tema', null))
  const [section,     setSection]     = useState('dashboard')
  const [showSidebar, setShowSidebar] = useState(false)

  // Dashboard data
  const [cobrados,    setCobrados]    = useState([])
  const [tickets,     setTickets]     = useState([])
  const [lastRefresh, setLastRefresh] = useState(null)

  // Configuración — negocio
  const [negocio,    setNegocio]    = useState({ nombre: 'Mi Taquería', direccion: '', telefono: '', mensajeCierre: '¡Gracias por su visita!' })
  const [negocioMsg, setNegocioMsg] = useState('')

  // Configuración — métodos de pago
  const [metodosPago, setMetodosPago] = useState({
    efectivo: true, tarjeta: true, transferencia: true,
    vales: false, dosPagos: false,
  })

  // Configuración — funciones
  const [funciones, setFunciones] = useState({
    comanda: true, personas: true, fondo: true, tipoOrden: true,
    descuentos: false, propinas: false,
  })

  // Configuración — PIN
  const [pinActual,  setPinActual]  = useState('')
  const [pinNuevo,   setPinNuevo]   = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinMsg,     setPinMsg]     = useState('')

  // Empleados
  const [empleados,     setEmpleados]     = useState([])
  const [loadingEmps,   setLoadingEmps]   = useState(false)
  const [showAddEmp,    setShowAddEmp]    = useState(false)
  const [newEmp,        setNewEmp]        = useState({ nombre: '', rol: 'cajero', pin: '', pin2: '' })
  const [addEmpMsg,     setAddEmpMsg]     = useState('')
  const [editPinEmp,    setEditPinEmp]    = useState(null)
  const [editPinVal,    setEditPinVal]    = useState('')
  const [editPinVal2,   setEditPinVal2]   = useState('')
  const [editPinMsg,    setEditPinMsg]    = useState('')
  const [turnos,        setTurnos]        = useState([])
  const [loadingTurnos, setLoadingTurnos] = useState(false)

  // PIN modal para empleados — { action: 'add'|'toggle'|'editPin'|'edit'|'delete', target: emp|null }
  const [empPinModal, setEmpPinModal] = useState(null)

  // Editar empleado
  const [editEmp,    setEditEmp]    = useState(null)   // emp completo o null
  const [editEmpMsg, setEditEmpMsg] = useState('')

  // Confirmar eliminar
  const [deleteEmp, setDeleteEmp] = useState(null)   // emp o null

  // Reportes — período compartido
  const [repPeriodo, setRepPeriodo] = useState('hoy')
  const [repDesde,   setRepDesde]   = useState(todayStr())
  const [repHasta,   setRepHasta]   = useState(todayStr())

  // Recibos — búsqueda y detalle
  const [reciboSearch,  setReciboSearch]  = useState('')
  const [reciboDetalle, setReciboDetalle] = useState(null)

  // Artículos — ordenamiento
  const [articuloSort, setArticuloSort] = useState({ col: 'qty', dir: 'desc' })

  function refreshData() {
    setCobrados(readLS(`taqueropOS_cobrados_${todayStr()}`, []))
    setTickets(readLS('taqueropOS_tickets', []))
    setLastRefresh(new Date())
  }

  useEffect(() => {
    if (!unlocked) return
    const neg = readLS('taqueropOS_negocio', null)
    if (neg) setNegocio(prev => ({ ...prev, ...neg }))
    setMetodosPago(prev => ({ ...prev, ...readLS('taqueropOS_metodosPago', {}) }))
    setFunciones(prev =>   ({ ...prev, ...readLS('taqueropOS_funciones',   {}) }))
    refreshData()
    const iv = setInterval(refreshData, 30000)
    return () => clearInterval(iv)
  }, [unlocked])

  useEffect(() => {
    if (!unlocked) return
    if (section === 'emp-lista')  fetchEmpleados()
    if (section === 'emp-horas')  fetchTurnos()
  }, [section, unlocked])

  // Sincronizar período con fechas concretas
  useEffect(() => {
    const rng = periodoRange(repPeriodo)
    if (rng) { setRepDesde(rng.desde); setRepHasta(rng.hasta) }
  }, [repPeriodo])

  async function fetchEmpleados() {
    setLoadingEmps(true)
    const { data } = await supabase
      .from('empleados')
      .select('*')
      .eq('business_id', BUSINESS_ID)
      .order('nombre')
    setEmpleados(data || [])
    setLoadingEmps(false)
  }

  async function fetchTurnos() {
    setLoadingTurnos(true)
    const today = new Date(); today.setHours(0,0,0,0)
    const { data } = await supabase
      .from('turnos')
      .select('*, empleados(nombre, rol)')
      .eq('business_id', BUSINESS_ID)
      .gte('entrada', today.toISOString())
      .order('entrada', { ascending: false })
    setTurnos(data || [])
    setLoadingTurnos(false)
  }

  async function toggleActivo(emp) {
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id)
    setEmpleados(prev => prev.map(e => e.id === emp.id ? { ...e, activo: !e.activo } : e))
  }

  async function agregarEmpleado() {
    setAddEmpMsg('')
    if (!newEmp.nombre.trim())         { setAddEmpMsg('❌ Ingresa el nombre.'); return }
    if (!/^\d{4}$/.test(newEmp.pin))   { setAddEmpMsg('❌ El PIN debe ser de 4 dígitos.'); return }
    if (newEmp.pin !== newEmp.pin2)    { setAddEmpMsg('❌ Los PINs no coinciden.'); return }
    const { error } = await supabase.from('empleados').insert({
      business_id: BUSINESS_ID,
      nombre: newEmp.nombre.trim(),
      rol:    newEmp.rol,
      pin:    newEmp.pin,
      activo: true,
    })
    if (error) {
      console.error('Error INSERT empleado:', error)
      setAddEmpMsg(`❌ ${error.message || 'Error al guardar. Intenta de nuevo.'}`)
      return
    }
    setAddEmpMsg('✅ Empleado agregado.')
    setNewEmp({ nombre: '', rol: 'cajero', pin: '', pin2: '' })
    setTimeout(() => { setShowAddEmp(false); setAddEmpMsg('') }, 1200)
    fetchEmpleados()
  }

  async function guardarEdicionEmpleado() {
    setEditEmpMsg('')
    if (!editEmp.nombre.trim()) { setEditEmpMsg('❌ Ingresa el nombre.'); return }
    const { error } = await supabase.from('empleados')
      .update({ nombre: editEmp.nombre.trim(), rol: editEmp.rol })
      .eq('id', editEmp.id)
    if (error) {
      console.error('Error UPDATE empleado:', error)
      setEditEmpMsg(`❌ ${error.message || 'Error al guardar.'}`)
      return
    }
    setEditEmpMsg('✅ Cambios guardados.')
    setTimeout(() => { setEditEmp(null); setEditEmpMsg('') }, 1000)
    fetchEmpleados()
  }

  async function eliminarEmpleado(emp) {
    const { error } = await supabase.from('empleados').delete().eq('id', emp.id)
    if (error) { console.error('Error DELETE empleado:', error); return }
    setDeleteEmp(null)
    fetchEmpleados()
  }

  async function guardarPinEmpleado() {
    setEditPinMsg('')
    if (!/^\d{4}$/.test(editPinVal))  { setEditPinMsg('❌ El PIN debe ser 4 dígitos.'); return }
    if (editPinVal !== editPinVal2)   { setEditPinMsg('❌ Los PINs no coinciden.'); return }
    const { error } = await supabase.from('empleados').update({ pin: editPinVal }).eq('id', editPinEmp.id)
    if (error) { setEditPinMsg('❌ Error al guardar.'); return }
    setEditPinMsg('✅ PIN actualizado.')
    setTimeout(() => { setEditPinEmp(null); setEditPinVal(''); setEditPinVal2(''); setEditPinMsg('') }, 1200)
  }

  function selectTheme(t) {
    localStorage.setItem('taqueropOS_tema', JSON.stringify(t))
    setTheme(t)
  }

  // ── Gates ────────────────────────────────────────────────────────────────
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />
  if (!theme)    return <ThemeSelector onSelect={selectTheme} />

  const t = THEMES[theme]

  // ── Dashboard cálculos ───────────────────────────────────────────────────
  const totalHoy        = cobrados.reduce((s, c) => s + c.total, 0)
  const totalEfectivo   = cobrados.filter(c => c.metodoPago === 'efectivo').reduce((s, c) => s + c.total, 0)
  const totalTarjeta    = cobrados.filter(c => c.metodoPago === 'tarjeta').reduce((s, c) => s + c.total, 0)
  const totalTransf     = cobrados.filter(c => c.metodoPago === 'transferencia').reduce((s, c) => s + c.total, 0)
  const totalPagos      = totalEfectivo + totalTarjeta + totalTransf || 1
  const topProducts     = calcTopProducts(cobrados)
  const maxQty          = topProducts[0]?.qty || 1
  const negocioNombre   = negocio.nombre || 'TaqueroPOS'

  // ── Datos para reportes ──────────────────────────────────────────────────
  const cobradosRango = readCobradosRange(repDesde, repHasta)

  // ── renderSection ────────────────────────────────────────────────────────
  function renderSection() {
    if (section === 'dashboard')     return renderDashboard()
    if (section === 'cfg-negocio')   return renderNegocio()
    if (section === 'cfg-pagos')     return renderPagos()
    if (section === 'cfg-funciones') return renderFunciones()
    if (section === 'cfg-pin')       return renderPIN()
    if (section === 'emp-lista')     return renderEmpleadosLista()
    if (section === 'emp-horas')     return renderEmpleadosHoras()
    if (section === 'emp-acceso')    return renderEmpleadosAcceso()
    if (section === 'rep-resumen')   return renderRepResumen()
    if (section === 'rep-articulo')  return renderRepArticulo()
    if (section === 'rep-categoria') return renderRepCategoria()
    if (section === 'rep-pago')      return renderRepPago()
    if (section === 'rep-recibos')   return renderRepRecibos()
    if (section === 'rep-desctos')   return renderRepDesctos()
    return null
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  function renderDashboard() {
    const metricCards = [
      { icon: '💰', label: 'Ventas hoy',        value: fmt(totalHoy),   sub: 'total cobrado'    },
      { icon: '🎫', label: 'Tickets cobrados',  value: cobrados.length, sub: 'hoy'              },
      { icon: '🎟️', label: 'Tickets abiertos', value: tickets.length,  sub: 'en este momento'  },
      { icon: '👥', label: 'Empleados activos', value: empleados.filter(e => e.activo).length || '—', sub: 'turno actual' },
    ]
    const metodosBar = [
      { label: 'Efectivo',      value: totalEfectivo, color: 'bg-green-500',  icon: '💵' },
      { label: 'Tarjeta',       value: totalTarjeta,  color: 'bg-blue-500',   icon: '💳' },
      { label: 'Transferencia', value: totalTransf,   color: 'bg-purple-500', icon: '📲' },
    ]
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map(({ icon, label, value, sub }) => (
            <div key={label} className={`rounded-2xl border ${t.border} ${t.panel} p-4`}>
              <div className="text-2xl mb-2">{icon}</div>
              <p className={`text-xs font-medium mb-1 ${t.textSub}`}>{label}</p>
              <p className={`text-2xl font-extrabold ${t.text}`}>{value}</p>
              <p className={`text-xs mt-0.5 ${t.textSub}`}>{sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
            <h3 className={`font-bold text-base mb-4 ${t.text}`}>Últimas ventas</h3>
            {cobrados.length === 0 ? (
              <p className={`text-sm text-center py-10 ${t.textSub}`}>Sin ventas registradas hoy</p>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {[...cobrados].reverse().slice(0, 10).map((c, i) => (
                  <div key={i} className={`flex items-center justify-between py-2.5 ${t.rowHover} -mx-2 px-2 rounded-lg transition`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${t.text}`}>Mesa {c.mesa} · {c.cliente}</p>
                      <p className={`text-xs ${t.textSub}`}>
                        {c.metodoPago === 'efectivo' ? '💵' : c.metodoPago === 'tarjeta' ? '💳' : '📲'} {c.metodoPago}
                      </p>
                    </div>
                    <span className="text-orange-500 font-bold text-sm shrink-0 ml-3">{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
            <h3 className={`font-bold text-base mb-4 ${t.text}`}>Productos más vendidos hoy</h3>
            {topProducts.length === 0 ? (
              <p className={`text-sm text-center py-10 ${t.textSub}`}>Sin datos de ventas aún</p>
            ) : (
              <div className="space-y-4">
                {topProducts.map(({ name, qty }, i) => (
                  <div key={name}>
                    <div className="flex justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold w-5 shrink-0 ${t.textSub}`}>{i + 1}</span>
                        <span className={`text-sm font-medium truncate ${t.text}`}>{name}</span>
                      </div>
                      <span className="text-orange-500 font-bold text-sm shrink-0 ml-2">{qty} uds</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${t.track}`}>
                      <div className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${(qty / maxQty) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
          <h3 className={`font-bold text-base mb-5 ${t.text}`}>Ventas por método de pago</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {metodosBar.map(({ label, value, color, icon }) => {
              const pct = Math.round((value / totalPagos) * 100)
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm font-medium ${t.textSub}`}>{icon} {label}</span>
                    <span className={`text-sm font-bold ${t.text}`}>{fmt(value)}</span>
                  </div>
                  <div className={`h-3 rounded-full overflow-hidden ${t.track}`}>
                    <div className={`h-full ${color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-xs mt-1 ${t.textSub}`}>{pct}% del total</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─── Configuración: Negocio ───────────────────────────────────────────────
  function renderNegocio() {
    function save() {
      localStorage.setItem('taqueropOS_negocio', JSON.stringify(negocio))
      setNegocioMsg('✅ Datos guardados correctamente.')
      setTimeout(() => setNegocioMsg(''), 3000)
    }
    const fields = [
      { field: 'nombre',        label: 'Nombre del negocio',           placeholder: 'Mi Taquería' },
      { field: 'direccion',     label: 'Dirección',                    placeholder: 'Av. Principal #123, Ciudad' },
      { field: 'telefono',      label: 'Teléfono',                     placeholder: '33-1234-5678' },
      { field: 'mensajeCierre', label: 'Mensaje de cierre del ticket', placeholder: '¡Gracias por su visita!' },
    ]
    return (
      <div className={`rounded-2xl border ${t.border} ${t.panel} p-6 max-w-lg`}>
        <h3 className={`font-bold text-lg mb-1 ${t.text}`}>🏪 Datos del Negocio</h3>
        <p className={`text-sm mb-5 ${t.textSub}`}>Se usan al imprimir tickets y en el dashboard</p>
        {negocioMsg && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm mb-4">
            {negocioMsg}
          </div>
        )}
        <div className="space-y-4">
          {fields.map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>{label}</label>
              <input type="text" value={negocio[field] ?? ''} placeholder={placeholder}
                onChange={e => setNegocio(prev => ({ ...prev, [field]: e.target.value }))}
                className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2
                           focus:ring-orange-500 transition ${t.input}`} />
            </div>
          ))}
          <button type="button" onClick={save}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition mt-2">
            Guardar cambios
          </button>
        </div>
      </div>
    )
  }

  // ─── Configuración: Métodos de pago ──────────────────────────────────────
  function renderPagos() {
    const OPCIONES = [
      { key: 'efectivo',      label: 'Efectivo',                  icon: '💵', desc: 'Pago en efectivo' },
      { key: 'tarjeta',       label: 'Tarjeta de crédito/débito', icon: '💳', desc: 'Terminal bancaria' },
      { key: 'transferencia', label: 'Transferencia SPEI',        icon: '📲', desc: 'Pago por app bancaria' },
      { key: 'vales',         label: 'Vales de despensa',         icon: '🎟️', desc: 'Sodexo, Edenred, etc.' },
      { key: 'dosPagos',      label: 'Pago en dos partes',        icon: '✂️', desc: 'Dividir el total' },
    ]
    function toggle(key) {
      setMetodosPago(prev => {
        const next = { ...prev, [key]: !prev[key] }
        localStorage.setItem('taqueropOS_metodosPago', JSON.stringify(next))
        return next
      })
    }
    return (
      <div className={`rounded-2xl border ${t.border} ${t.panel} p-6 max-w-lg`}>
        <h3 className={`font-bold text-lg mb-1 ${t.text}`}>💳 Métodos de Pago</h3>
        <p className={`text-sm mb-5 ${t.textSub}`}>Activa los métodos disponibles en tu negocio</p>
        <div className="space-y-2">
          {OPCIONES.map(({ key, label, icon, desc }) => (
            <div key={key} className={`flex items-center justify-between px-4 py-3.5 rounded-xl border ${t.border} transition ${t.rowHover}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className={`text-sm font-medium ${t.text}`}>{label}</p>
                  <p className={`text-xs ${t.textSub}`}>{desc}</p>
                </div>
              </div>
              <Toggle value={metodosPago[key]} onChange={() => toggle(key)} theme={theme} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Configuración: Funciones ─────────────────────────────────────────────
  function renderFunciones() {
    const OPCIONES = [
      { key: 'comanda',    label: 'Comanda de cocina',         icon: '🍳', desc: 'Imprime pedido para la cocina' },
      { key: 'personas',   label: 'Separación por personas',   icon: '👥', desc: 'Divide el ticket por comensal' },
      { key: 'fondo',      label: 'Fondo de caja al abrir',    icon: '💰', desc: 'Registro del efectivo inicial' },
      { key: 'tipoOrden',  label: 'Para llevar / Comer aquí',  icon: '🥡', desc: 'Tipo de orden en cada ticket' },
      { key: 'descuentos', label: 'Descuentos en tickets',     icon: '🏷️', desc: 'Aplicar % o $ de descuento' },
      { key: 'propinas',   label: 'Propinas',                  icon: '💸', desc: 'Sugerencia de propina al cobrar' },
    ]
    function toggle(key) {
      setFunciones(prev => {
        const next = { ...prev, [key]: !prev[key] }
        localStorage.setItem('taqueropOS_funciones', JSON.stringify(next))
        return next
      })
    }
    return (
      <div className={`rounded-2xl border ${t.border} ${t.panel} p-6 max-w-lg`}>
        <h3 className={`font-bold text-lg mb-1 ${t.text}`}>⚡ Funciones</h3>
        <p className={`text-sm mb-5 ${t.textSub}`}>Activa o desactiva funcionalidades del sistema</p>
        <div className="space-y-2">
          {OPCIONES.map(({ key, label, icon, desc }) => (
            <div key={key} className={`flex items-center justify-between px-4 py-3.5 rounded-xl border ${t.border} transition ${t.rowHover}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className={`text-sm font-medium ${t.text}`}>{label}</p>
                  <p className={`text-xs ${t.textSub}`}>{desc}</p>
                </div>
              </div>
              <Toggle value={funciones[key]} onChange={() => toggle(key)} theme={theme} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Configuración: PIN ───────────────────────────────────────────────────
  function renderPIN() {
    function save() {
      setPinMsg('')
      const stored = localStorage.getItem('taqueropOS_adminPIN') || '2205'
      if (pinActual !== stored)       { setPinMsg('❌ El PIN actual es incorrecto.'); return }
      if (!/^\d{4}$/.test(pinNuevo)) { setPinMsg('❌ El PIN nuevo debe ser de 4 dígitos.'); return }
      if (pinNuevo !== pinConfirm)    { setPinMsg('❌ Los PINs nuevos no coinciden.'); return }
      localStorage.setItem('taqueropOS_adminPIN', pinNuevo)
      setPinActual(''); setPinNuevo(''); setPinConfirm('')
      setPinMsg('✅ PIN actualizado correctamente.')
    }
    return (
      <div className={`rounded-2xl border ${t.border} ${t.panel} p-6 max-w-sm`}>
        <h3 className={`font-bold text-lg mb-1 ${t.text}`}>🔐 Cambiar PIN</h3>
        <p className={`text-sm mb-5 ${t.textSub}`}>El PIN de administrador es de 4 dígitos</p>
        {pinMsg && (
          <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${pinMsg.startsWith('✅')
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {pinMsg}
          </div>
        )}
        <div className="space-y-3">
          {[
            { label: 'PIN actual',          val: pinActual,  set: v => { setPinActual(v);  setPinMsg('') } },
            { label: 'PIN nuevo',           val: pinNuevo,   set: v => { setPinNuevo(v);   setPinMsg('') } },
            { label: 'Confirmar PIN nuevo', val: pinConfirm, set: v => { setPinConfirm(v); setPinMsg('') } },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>{label}</label>
              <input type="password" inputMode="numeric" maxLength={4}
                value={val} onChange={e => set(e.target.value.replace(/\D/g,'').slice(0,4))}
                placeholder="●●●●"
                className={`w-full px-4 py-2.5 rounded-xl border text-center text-xl tracking-[0.4em]
                           focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />
            </div>
          ))}
          <button type="button" onClick={save}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition">
            Guardar PIN
          </button>
        </div>
      </div>
    )
  }

  // ─── Empleados: Lista ─────────────────────────────────────────────────────
  function renderEmpleadosLista() {
    // Solo el admin puede gestionar empleados
    const empActivo = (() => { try { return JSON.parse(localStorage.getItem('taqueropOS_empleadoActivo') || '{}') } catch { return {} } })()
    if ((empActivo?.rol ?? 'admin') !== 'admin') {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-white font-bold text-xl mb-2">Acceso restringido</h2>
          <p className="text-slate-400 text-sm">
            Tu rol de <span className="text-orange-400 font-semibold">{ROL_LABEL[empActivo?.rol] ?? empActivo?.rol ?? 'desconocido'}</span> no tiene permiso para esta sección.
          </p>
        </div>
      )
    }
    if (loadingEmps) return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
    return (
      <div className="space-y-4">
        {/* Modal PIN de protección */}
        {empPinModal && (
          <PinModal
            titulo="Confirmación de administrador"
            subtitulo={
              empPinModal.action === 'add'     ? 'Para agregar un empleado' :
              empPinModal.action === 'toggle'  ? `Para cambiar estado de ${empPinModal.target?.nombre}` :
              empPinModal.action === 'editPin' ? `Para cambiar PIN de ${empPinModal.target?.nombre}` :
              empPinModal.action === 'edit'    ? `Para editar a ${empPinModal.target?.nombre}` :
              empPinModal.action === 'delete'  ? `Para eliminar a ${empPinModal.target?.nombre}` : ''
            }
            onCancel={() => setEmpPinModal(null)}
            onConfirm={() => {
              const { action, target } = empPinModal
              setEmpPinModal(null)
              if (action === 'add')     { setShowAddEmp(true); setAddEmpMsg('') }
              if (action === 'toggle')  { toggleActivo(target) }
              if (action === 'editPin') { setEditPinEmp(target); setEditPinVal(''); setEditPinVal2(''); setEditPinMsg('') }
              if (action === 'edit')    { setEditEmp({ ...target }); setEditEmpMsg('') }
              if (action === 'delete')  { setDeleteEmp(target) }
            }}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className={`text-sm ${t.textSub}`}>{empleados.length} empleado{empleados.length !== 1 ? 's' : ''} registrados</p>
          <button type="button"
            onClick={() => setEmpPinModal({ action: 'add', target: null })}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition">
            + Agregar empleado
          </button>
        </div>

        {/* Lista */}
        {empleados.length === 0 ? (
          <div className={`rounded-2xl border ${t.border} ${t.panel} p-10 text-center`}>
            <div className="text-5xl mb-3">👥</div>
            <p className={`font-semibold ${t.text}`}>Sin empleados</p>
            <p className={`text-sm mt-1 ${t.textSub}`}>Agrega el primer empleado con el botón de arriba</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {empleados.map(emp => (
              <div key={emp.id} className={`rounded-2xl border ${t.border} ${t.panel} p-4 flex flex-col gap-3`}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center
                                  text-xl font-extrabold text-orange-400 shrink-0">
                    {emp.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold text-sm truncate ${t.text}`}>{emp.nombre}</p>
                    <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${ROL_BADGE[emp.rol] ?? ROL_BADGE.cajero}`}>
                      {ROL_LABEL[emp.rol] ?? emp.rol}
                    </span>
                  </div>
                  {/* Botones editar / eliminar */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button"
                      onClick={() => setEmpPinModal({ action: 'edit', target: emp })}
                      title="Editar empleado"
                      className={`p-1.5 rounded-lg text-sm transition ${t.btnSecondary}`}>
                      ✏️
                    </button>
                    <button type="button"
                      onClick={() => setEmpPinModal({ action: 'delete', target: emp })}
                      title="Eliminar empleado"
                      className="p-1.5 rounded-lg text-sm transition bg-red-500/10 hover:bg-red-500/20 text-red-400">
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                  <button type="button"
                    onClick={() => setEmpPinModal({ action: 'toggle', target: emp })}
                    className="flex items-center gap-2">
                    <Toggle value={emp.activo} onChange={() => {}} theme={theme} />
                    <span className={`text-xs ${t.textSub}`}>{emp.activo ? 'Activo' : 'Inactivo'}</span>
                  </button>
                  <button type="button"
                    onClick={() => setEmpPinModal({ action: 'editPin', target: emp })}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${t.btnSecondary}`}>
                    Cambiar PIN
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal agregar empleado */}
        {showAddEmp && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-sm rounded-2xl border ${t.border} ${t.panel} p-6 shadow-2xl`}>
              <h3 className={`font-bold text-lg mb-4 ${t.text}`}>👤 Nuevo empleado</h3>
              {addEmpMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${addEmpMsg.startsWith('✅')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {addEmpMsg}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Nombre</label>
                  <input type="text" value={newEmp.nombre} onChange={e => setNewEmp(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Nombre completo"
                    className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Rol</label>
                  <select value={newEmp.rol} onChange={e => setNewEmp(p => ({ ...p, rol: e.target.value }))}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`}>
                    {ROL_OPTIONS.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>PIN (4 dígitos)</label>
                  <input type="password" inputMode="numeric" maxLength={4}
                    value={newEmp.pin} onChange={e => setNewEmp(p => ({ ...p, pin: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                    placeholder="●●●●"
                    className={`w-full px-4 py-2.5 rounded-xl border text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Confirmar PIN</label>
                  <input type="password" inputMode="numeric" maxLength={4}
                    value={newEmp.pin2} onChange={e => setNewEmp(p => ({ ...p, pin2: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                    placeholder="●●●●"
                    className={`w-full px-4 py-2.5 rounded-xl border text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <button type="button" onClick={() => { setShowAddEmp(false); setAddEmpMsg('') }}
                  className={`py-3 rounded-xl font-semibold transition ${t.btnSecondary}`}>
                  Cancelar
                </button>
                <button type="button" onClick={agregarEmpleado}
                  className="py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal editar empleado */}
        {editEmp && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-sm rounded-2xl border ${t.border} ${t.panel} p-6 shadow-2xl`}>
              <h3 className={`font-bold text-lg mb-4 ${t.text}`}>✏️ Editar empleado</h3>
              {editEmpMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${editEmpMsg.startsWith('✅')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {editEmpMsg}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Nombre</label>
                  <input type="text" value={editEmp.nombre}
                    onChange={e => setEditEmp(p => ({ ...p, nombre: e.target.value }))}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Rol</label>
                  <select value={editEmp.rol}
                    onChange={e => setEditEmp(p => ({ ...p, rol: e.target.value }))}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`}>
                    {ROL_OPTIONS.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <button type="button" onClick={() => { setEditEmp(null); setEditEmpMsg('') }}
                  className={`py-3 rounded-xl font-semibold transition ${t.btnSecondary}`}>
                  Cancelar
                </button>
                <button type="button" onClick={guardarEdicionEmpleado}
                  className="py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition">
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmar eliminar */}
        {deleteEmp && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-sm rounded-2xl border border-red-500/30 ${t.panel} p-6 shadow-2xl`}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className={`font-bold text-lg ${t.text}`}>¿Eliminar empleado?</h3>
                <p className="text-red-400 font-semibold mt-1">{deleteEmp.nombre}</p>
                <p className={`text-sm mt-2 ${t.textSub}`}>Esta acción no se puede deshacer.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDeleteEmp(null)}
                  className={`py-3 rounded-xl font-semibold transition ${t.btnSecondary}`}>
                  Cancelar
                </button>
                <button type="button" onClick={() => eliminarEmpleado(deleteEmp)}
                  className="py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold transition">
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal editar PIN */}
        {editPinEmp && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-sm rounded-2xl border ${t.border} ${t.panel} p-6 shadow-2xl`}>
              <h3 className={`font-bold text-lg mb-1 ${t.text}`}>🔑 Cambiar PIN</h3>
              <p className={`text-sm mb-4 ${t.textSub}`}>{editPinEmp.nombre}</p>
              {editPinMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${editPinMsg.startsWith('✅')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {editPinMsg}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Nuevo PIN</label>
                  <input type="password" inputMode="numeric" maxLength={4}
                    value={editPinVal} onChange={e => setEditPinVal(e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="●●●●"
                    className={`w-full px-4 py-2.5 rounded-xl border text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Confirmar PIN</label>
                  <input type="password" inputMode="numeric" maxLength={4}
                    value={editPinVal2} onChange={e => setEditPinVal2(e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="●●●●"
                    className={`w-full px-4 py-2.5 rounded-xl border text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <button type="button" onClick={() => setEditPinEmp(null)}
                  className={`py-3 rounded-xl font-semibold transition ${t.btnSecondary}`}>
                  Cancelar
                </button>
                <button type="button" onClick={guardarPinEmpleado}
                  className="py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition">
                  Guardar PIN
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Empleados: Horas trabajadas ──────────────────────────────────────────
  function renderEmpleadosHoras() {
    if (loadingTurnos) return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
    function fmtTime(iso) {
      if (!iso) return '—'
      return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    }
    function calcHoras(entrada, salida) {
      if (!salida) return null
      const mins = Math.floor((new Date(salida) - new Date(entrada)) / 60000)
      const h = Math.floor(mins / 60), m = mins % 60
      return m > 0 ? `${h}h ${m}m` : `${h}h`
    }
    const totalPorEmpleado = {}
    turnos.forEach(turno => {
      if (!turno.salida) return
      const key = turno.empleados?.nombre || turno.empleado_id
      const mins = Math.floor((new Date(turno.salida) - new Date(turno.entrada)) / 60000)
      totalPorEmpleado[key] = (totalPorEmpleado[key] || 0) + mins
    })
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className={`text-sm ${t.textSub}`}>Turnos de hoy — {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p>
          <button type="button" onClick={fetchTurnos}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${t.btnSecondary}`}>
            🔄 Actualizar
          </button>
        </div>
        {turnos.length === 0 ? (
          <div className={`rounded-2xl border ${t.border} ${t.panel} p-10 text-center`}>
            <div className="text-5xl mb-3">🕐</div>
            <p className={`font-semibold ${t.text}`}>Sin turnos registrados hoy</p>
            <p className={`text-sm mt-1 ${t.textSub}`}>Los turnos se crean automáticamente al iniciar sesión con PIN</p>
          </div>
        ) : (
          <div className={`rounded-2xl border ${t.border} ${t.panel} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${t.border}`}>
                  {['Empleado','Rol','Entrada','Salida','Horas'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${t.divider}`}>
                {turnos.map(turno => (
                  <tr key={turno.id} className={`transition ${t.rowHover}`}>
                    <td className={`px-4 py-3 font-medium ${t.text}`}>{turno.empleados?.nombre || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_BADGE[turno.empleados?.rol] ?? ROL_BADGE.cajero}`}>
                        {ROL_LABEL[turno.empleados?.rol] ?? turno.empleados?.rol ?? '—'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${t.textSub}`}>{fmtTime(turno.entrada)}</td>
                    <td className="px-4 py-3">
                      {turno.salida
                        ? <span className={t.textSub}>{fmtTime(turno.salida)}</span>
                        : <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            En turno
                          </span>
                      }
                    </td>
                    <td className={`px-4 py-3 font-medium ${t.text}`}>
                      {calcHoras(turno.entrada, turno.salida) ?? <span className={t.textSub}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {Object.keys(totalPorEmpleado).length > 0 && (
          <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
            <h3 className={`font-bold text-sm mb-4 ${t.text}`}>Total de horas por empleado (hoy)</h3>
            <div className="space-y-2">
              {Object.entries(totalPorEmpleado).map(([nombre, mins]) => {
                const h = Math.floor(mins / 60), m = mins % 60
                return (
                  <div key={nombre} className="flex justify-between items-center">
                    <span className={`text-sm ${t.text}`}>{nombre}</span>
                    <span className="text-orange-500 font-bold text-sm">{m > 0 ? `${h}h ${m}m` : `${h}h`}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Empleados: Derechos de acceso ────────────────────────────────────────
  function renderEmpleadosAcceso() {
    const PERMISOS = [
      { label: 'Crear / editar tickets',  admin: true,  gerente: true,  cajero: true,  mesero: true,  cocina: false },
      { label: 'Cobrar tickets',          admin: true,  gerente: true,  cajero: true,  mesero: false, cocina: false },
      { label: 'Cancelar tickets (PIN)',  admin: true,  gerente: true,  cajero: false, mesero: false, cocina: false },
      { label: 'Ver reportes',            admin: true,  gerente: true,  cajero: false, mesero: false, cocina: false },
      { label: 'Panel de administración', admin: true,  gerente: false, cajero: false, mesero: false, cocina: false },
      { label: 'Gestionar productos',     admin: true,  gerente: true,  cajero: false, mesero: false, cocina: false },
      { label: 'Gestionar empleados',     admin: true,  gerente: false, cajero: false, mesero: false, cocina: false },
      { label: 'Ver cocina',              admin: true,  gerente: true,  cajero: true,  mesero: true,  cocina: true  },
    ]
    const roles = ['admin', 'gerente', 'cajero', 'mesero', 'cocina']
    return (
      <div className={`rounded-2xl border ${t.border} ${t.panel} overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border}`}>
          <h3 className={`font-bold text-base ${t.text}`}>🔐 Derechos de acceso por rol</h3>
          <p className={`text-sm mt-0.5 ${t.textSub}`}>Permisos predeterminados del sistema</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${t.border}`}>
                <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub} min-w-[200px]`}>Función</th>
                {roles.map(r => (
                  <th key={r} className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wide ${t.textSub}`}>
                    <span className={`px-2 py-0.5 rounded-full ${ROL_BADGE[r]}`}>{ROL_LABEL[r]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divider}`}>
              {PERMISOS.map(perm => (
                <tr key={perm.label} className={`transition ${t.rowHover}`}>
                  <td className={`px-5 py-3 font-medium ${t.text}`}>{perm.label}</td>
                  {roles.map(r => (
                    <td key={r} className="px-4 py-3 text-center">
                      {perm[r] ? <span className="text-green-400 text-base">✅</span>
                               : <span className="text-slate-600 text-base">❌</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORTES
  // ─────────────────────────────────────────────────────────────────────────────

  function RepHeader() {
    return (
      <PeriodoSelector
        periodo={repPeriodo} setPeriodo={setRepPeriodo}
        desde={repDesde}     setDesde={setRepDesde}
        hasta={repHasta}     setHasta={setRepHasta}
        t={t}
      />
    )
  }

  function EmptyState({ msg = 'Sin datos para el período seleccionado' }) {
    return (
      <div className={`rounded-2xl border ${t.border} ${t.panel} p-14 text-center`}>
        <div className="text-5xl mb-3">📊</div>
        <p className={`font-semibold ${t.text}`}>{msg}</p>
        <p className={`text-sm mt-1 ${t.textSub}`}>Registra ventas en Caja para ver reportes aquí</p>
      </div>
    )
  }

  // ─── Reporte: Resumen de ventas ───────────────────────────────────────────
  function renderRepResumen() {
    const datos = cobradosRango
    const total    = datos.reduce((s, c) => s + (c.total || 0), 0)
    const tickets  = datos.length
    const promedio = tickets > 0 ? total / tickets : 0

    // Top producto
    const prodCounts = {}
    datos.forEach(c => (c.items || []).forEach(({ product, qty }) => {
      if (product?.name) prodCounts[product.name] = (prodCounts[product.name] || 0) + (qty || 1)
    }))
    const topProd = Object.entries(prodCounts).sort(([,a],[,b]) => b-a)[0]?.[0] ?? '—'

    // Ventas por día
    const porDia = {}
    datos.forEach(c => { porDia[c._fecha] = (porDia[c._fecha] || 0) + (c.total || 0) })
    const barData = Object.entries(porDia).sort(([a],[b]) => a.localeCompare(b)).map(([fecha, total]) => ({
      dia: fecha.slice(5), // MM-DD
      total,
    }))

    // Esta semana vs semana pasada (línea)
    const lunes = new Date(); lunes.setDate(lunes.getDate() - ((lunes.getDay()+6)%7)); lunes.setHours(0,0,0,0)
    const lunesP = new Date(lunes); lunesP.setDate(lunesP.getDate()-7)
    const semActual = readCobradosRange(dateStr(lunes), todayStr())
    const semPasada = readCobradosRange(dateStr(lunesP), dateStr(new Date(lunes.getTime()-1)))

    function mapSem(lista) {
      const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
      const acc = {}
      lista.forEach(c => {
        const d = new Date(c.fecha)
        const idx = (d.getDay()+6)%7
        acc[dias[idx]] = (acc[dias[idx]]||0) + (c.total||0)
      })
      return dias.map(d => ({ dia: d, valor: acc[d]||0 }))
    }
    const lineData = mapSem(semActual).map((r,i) => ({
      dia: r.dia, semActual: r.valor, semPasada: mapSem(semPasada)[i]?.valor || 0
    }))

    // Tabla por día
    const tablaData = Object.entries(porDia).sort(([a],[b]) => a.localeCompare(b)).map(([fecha, tot]) => ({
      fecha,
      tickets: datos.filter(c => c._fecha === fecha).length,
      total: tot,
    }))

    return (
      <div className="space-y-5">
        <RepHeader />
        {datos.length === 0 ? <EmptyState /> : (
          <>
            {/* Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: '💰', label: 'Total vendido',       value: fmt(total),        sub: 'en el período' },
                { icon: '🎫', label: 'Tickets cobrados',   value: tickets,            sub: 'en el período' },
                { icon: '📊', label: 'Ticket promedio',    value: fmt(promedio),      sub: 'por ticket' },
                { icon: '⭐', label: 'Más vendido',        value: topProd,            sub: 'producto' },
              ].map(({ icon, label, value, sub }) => (
                <div key={label} className={`rounded-2xl border ${t.border} ${t.panel} p-4`}>
                  <div className="text-2xl mb-2">{icon}</div>
                  <p className={`text-xs font-medium mb-1 ${t.textSub}`}>{label}</p>
                  <p className={`text-xl font-extrabold truncate ${t.text}`}>{value}</p>
                  <p className={`text-xs mt-0.5 ${t.textSub}`}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Ventas por día */}
            {barData.length > 0 && (
              <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
                <h3 className={`font-bold text-base mb-4 ${t.text}`}>Ventas por día</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top:0, right:8, left:-10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} />
                    <XAxis dataKey="dia" tick={{ fill: t.chartText, fontSize: 12 }} />
                    <YAxis tick={{ fill: t.chartText, fontSize: 12 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background:'#1e293b', border:'none', borderRadius:8, color:'#fff' }} />
                    <Bar dataKey="total" fill="#f97316" radius={[4,4,0,0]} name="Ventas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Esta semana vs semana pasada */}
            <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
              <h3 className={`font-bold text-base mb-4 ${t.text}`}>Esta semana vs semana pasada</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={lineData} margin={{ top:0, right:8, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} />
                  <XAxis dataKey="dia" tick={{ fill: t.chartText, fontSize: 12 }} />
                  <YAxis tick={{ fill: t.chartText, fontSize: 12 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background:'#1e293b', border:'none', borderRadius:8, color:'#fff' }} />
                  <Legend wrapperStyle={{ color: t.chartText, fontSize: 12 }} />
                  <Line type="monotone" dataKey="semActual" stroke="#f97316" strokeWidth={2} dot={false} name="Esta semana" />
                  <Line type="monotone" dataKey="semPasada" stroke="#64748b" strokeWidth={2} dot={false} name="Semana pasada" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla detallada */}
            <div className={`rounded-2xl border ${t.border} ${t.panel} overflow-hidden`}>
              <div className={`px-5 py-4 border-b ${t.border}`}>
                <h3 className={`font-bold text-base ${t.text}`}>Detalle por día</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${t.border}`}>
                    {['Fecha','Tickets','Total'].map(h => (
                      <th key={h} className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.divider}`}>
                  {tablaData.map(row => (
                    <tr key={row.fecha} className={`transition ${t.rowHover}`}>
                      <td className={`px-5 py-3 font-medium ${t.text}`}>{row.fecha}</td>
                      <td className={`px-5 py-3 ${t.textSub}`}>{row.tickets}</td>
                      <td className="px-5 py-3 text-orange-500 font-bold">{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── Reporte: Ventas por artículo ─────────────────────────────────────────
  function renderRepArticulo() {
    const datos = cobradosRango
    const totalGeneral = datos.reduce((s,c) => s + (c.total||0), 0) || 1

    const artMap = {}
    datos.forEach(c => (c.items||[]).forEach(({ product, qty }) => {
      if (!product?.name) return
      const k = product.name
      if (!artMap[k]) artMap[k] = { name: k, categoria: product.category || '—', qty: 0, total: 0 }
      artMap[k].qty   += (qty || 1)
      artMap[k].total += (product.price || 0) * (qty || 1)
    }))
    let articulos = Object.values(artMap)

    // Ordenar
    const { col, dir } = articuloSort
    articulos.sort((a,b) => dir === 'asc' ? a[col] - b[col] : b[col] - a[col])

    const top10 = [...articulos].sort((a,b) => b.qty - a.qty).slice(0,10)

    function sortBy(col) {
      setArticuloSort(prev => ({ col, dir: prev.col === col && prev.dir === 'desc' ? 'asc' : 'desc' }))
    }
    const arrow = (c) => articuloSort.col === c ? (articuloSort.dir === 'desc' ? ' ↓' : ' ↑') : ''

    return (
      <div className="space-y-5">
        <RepHeader />
        {articulos.length === 0 ? <EmptyState /> : (
          <>
            {/* Gráfica horizontal top 10 */}
            <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
              <h3 className={`font-bold text-base mb-4 ${t.text}`}>Top 10 productos más vendidos</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 36)}>
                <BarChart data={top10} layout="vertical" margin={{ top:0, right:40, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: t.chartText, fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: t.chartText, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background:'#1e293b', border:'none', borderRadius:8, color:'#fff' }} />
                  <Bar dataKey="qty" fill="#f97316" radius={[0,4,4,0]} name="Cantidad" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla */}
            <div className={`rounded-2xl border ${t.border} ${t.panel} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${t.border}`}>
                      <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>Producto</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>Categoría</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide cursor-pointer hover:text-orange-400 ${t.textSub}`}
                        onClick={() => sortBy('qty')}>Cantidad{arrow('qty')}</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide cursor-pointer hover:text-orange-400 ${t.textSub}`}
                        onClick={() => sortBy('total')}>Total{arrow('total')}</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>%</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.divider}`}>
                    {articulos.map(a => (
                      <tr key={a.name} className={`transition ${t.rowHover}`}>
                        <td className={`px-5 py-3 font-medium ${t.text}`}>{a.name}</td>
                        <td className={`px-5 py-3 ${t.textSub}`}>{a.categoria}</td>
                        <td className={`px-5 py-3 ${t.text}`}>{a.qty}</td>
                        <td className="px-5 py-3 text-orange-500 font-bold">{fmt(a.total)}</td>
                        <td className={`px-5 py-3 ${t.textSub}`}>{((a.total / totalGeneral)*100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── Reporte: Ventas por categoría ────────────────────────────────────────
  function renderRepCategoria() {
    const datos = cobradosRango
    const catMap = {}
    datos.forEach(c => (c.items||[]).forEach(({ product, qty }) => {
      const k = product?.category || 'Sin categoría'
      if (!catMap[k]) catMap[k] = { name: k, qty: 0, total: 0 }
      catMap[k].qty   += (qty || 1)
      catMap[k].total += (product?.price || 0) * (qty || 1)
    }))
    const categorias = Object.values(catMap).sort((a,b) => b.total - a.total)
    const totalGen = categorias.reduce((s,c) => s + c.total, 0) || 1

    const pieData = categorias.map(c => ({ name: c.name, value: c.total }))

    return (
      <div className="space-y-5">
        <RepHeader />
        {categorias.length === 0 ? <EmptyState /> : (
          <>
            {/* Gráfica dona */}
            <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
              <h3 className={`font-bold text-base mb-4 ${t.text}`}>Distribución por categoría</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                    labelLine={true}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background:'#1e293b', border:'none', borderRadius:8, color:'#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla */}
            <div className={`rounded-2xl border ${t.border} ${t.panel} overflow-hidden`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${t.border}`}>
                    {['Categoría','Items vendidos','Total','%'].map(h => (
                      <th key={h} className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.divider}`}>
                  {categorias.map((c, i) => (
                    <tr key={c.name} className={`transition ${t.rowHover}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className={`font-medium ${t.text}`}>{c.name}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-3 ${t.textSub}`}>{c.qty}</td>
                      <td className="px-5 py-3 text-orange-500 font-bold">{fmt(c.total)}</td>
                      <td className={`px-5 py-3 ${t.textSub}`}>{((c.total/totalGen)*100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── Reporte: Tipo de pago ────────────────────────────────────────────────
  function renderRepPago() {
    const datos = cobradosRango
    const efs  = datos.filter(c => c.metodoPago === 'efectivo')
    const tar  = datos.filter(c => c.metodoPago === 'tarjeta')
    const tra  = datos.filter(c => c.metodoPago === 'transferencia')

    const totEf  = efs.reduce((s,c) => s + (c.total||0), 0)
    const totTar = tar.reduce((s,c) => s + (c.total||0), 0)
    const totTra = tra.reduce((s,c) => s + (c.total||0), 0)
    const grand  = (totEf + totTar + totTra) || 1

    const pieData = [
      { name: 'Efectivo',      value: totEf,  color: '#22c55e' },
      { name: 'Tarjeta',       value: totTar, color: '#3b82f6' },
      { name: 'Transferencia', value: totTra, color: '#a855f7' },
    ].filter(p => p.value > 0)

    // Tabla por día y método
    const diasSet = new Set(datos.map(c => c._fecha))
    const diasTabla = [...diasSet].sort()

    return (
      <div className="space-y-5">
        <RepHeader />
        {datos.length === 0 ? <EmptyState /> : (
          <>
            {/* 3 tarjetas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: '💵', label: 'Efectivo',      total: totEf,  txns: efs.length,  color: 'text-green-400' },
                { icon: '💳', label: 'Tarjeta',       total: totTar, txns: tar.length,  color: 'text-blue-400'  },
                { icon: '📲', label: 'Transferencia', total: totTra, txns: tra.length,  color: 'text-purple-400' },
              ].map(({ icon, label, total, txns, color }) => (
                <div key={label} className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
                  <div className="text-3xl mb-3">{icon}</div>
                  <p className={`text-sm font-medium mb-1 ${t.textSub}`}>{label}</p>
                  <p className={`text-2xl font-extrabold ${color}`}>{fmt(total)}</p>
                  <p className={`text-xs mt-1 ${t.textSub}`}>{txns} transacción{txns !== 1 ? 'es' : ''} · {((total/grand)*100).toFixed(1)}%</p>
                </div>
              ))}
            </div>

            {/* Gráfica dona */}
            {pieData.length > 0 && (
              <div className={`rounded-2xl border ${t.border} ${t.panel} p-5`}>
                <h3 className={`font-bold text-base mb-4 ${t.text}`}>Distribución por método</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      dataKey="value" nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                      {pieData.map((p, i) => <Cell key={i} fill={p.color} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background:'#1e293b', border:'none', borderRadius:8, color:'#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla por día */}
            {diasTabla.length > 0 && (
              <div className={`rounded-2xl border ${t.border} ${t.panel} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${t.border}`}>
                  <h3 className={`font-bold text-base ${t.text}`}>Detalle por día</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${t.border}`}>
                        {['Fecha','Efectivo','Tarjeta','Transferencia','Total'].map(h => (
                          <th key={h} className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${t.divider}`}>
                      {diasTabla.map(fecha => {
                        const del = datos.filter(c => c._fecha === fecha)
                        const e = del.filter(c => c.metodoPago==='efectivo').reduce((s,c)=>s+(c.total||0),0)
                        const ta = del.filter(c => c.metodoPago==='tarjeta').reduce((s,c)=>s+(c.total||0),0)
                        const tr = del.filter(c => c.metodoPago==='transferencia').reduce((s,c)=>s+(c.total||0),0)
                        return (
                          <tr key={fecha} className={`transition ${t.rowHover}`}>
                            <td className={`px-4 py-3 font-medium ${t.text}`}>{fecha}</td>
                            <td className="px-4 py-3 text-green-400">{e > 0 ? fmt(e) : <span className={t.textSub}>—</span>}</td>
                            <td className="px-4 py-3 text-blue-400">{ta > 0 ? fmt(ta) : <span className={t.textSub}>—</span>}</td>
                            <td className="px-4 py-3 text-purple-400">{tr > 0 ? fmt(tr) : <span className={t.textSub}>—</span>}</td>
                            <td className="px-4 py-3 text-orange-500 font-bold">{fmt(e+ta+tr)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ─── Reporte: Recibos ────────────────────────────────────────────────────
  function renderRepRecibos() {
    const datos = cobradosRango
    const q = reciboSearch.toLowerCase()
    const filtrados = datos.filter(c =>
      !q ||
      String(c.mesa).toLowerCase().includes(q) ||
      (c.cliente || '').toLowerCase().includes(q) ||
      (c._fecha || '').includes(q)
    ).sort((a,b) => (b.fecha||0) - (a.fecha||0))

    function fmtDateTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      return d.toLocaleString('es-MX', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    }

    return (
      <div className="space-y-4">
        <RepHeader />

        {/* Buscador */}
        <input type="text" value={reciboSearch} onChange={e => setReciboSearch(e.target.value)}
          placeholder="Buscar por mesa, cliente o fecha..."
          className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 transition ${t.input}`} />

        {datos.length === 0 ? <EmptyState /> : filtrados.length === 0 ? (
          <div className={`rounded-2xl border ${t.border} ${t.panel} p-10 text-center`}>
            <p className={`font-semibold ${t.text}`}>Sin resultados</p>
            <p className={`text-sm mt-1 ${t.textSub}`}>Intenta con otro término de búsqueda</p>
          </div>
        ) : (
          <div className={`rounded-2xl border ${t.border} ${t.panel} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${t.border}`}>
                  {['Fecha/Hora','Mesa','Cliente','Items','Pago','Total',''].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wide ${t.textSub}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${t.divider}`}>
                {filtrados.map((c, i) => (
                  <tr key={i} className={`transition ${t.rowHover}`}>
                    <td className={`px-4 py-3 ${t.textSub} text-xs`}>{fmtDateTime(c.fecha)}</td>
                    <td className={`px-4 py-3 font-medium ${t.text}`}>Mesa {c.mesa}</td>
                    <td className={`px-4 py-3 ${t.textSub}`}>{c.cliente || '—'}</td>
                    <td className={`px-4 py-3 ${t.textSub}`}>{(c.items||[]).length} items</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.metodoPago === 'efectivo' ? 'bg-green-500/20 text-green-400' :
                        c.metodoPago === 'tarjeta'  ? 'bg-blue-500/20  text-blue-400'  :
                                                      'bg-purple-500/20 text-purple-400'}`}>
                        {c.metodoPago}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-orange-500 font-bold">{fmt(c.total)}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setReciboDetalle(c)}
                        className={`text-xs px-2 py-1 rounded-lg transition ${t.btnSecondary}`}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal detalle recibo */}
        {reciboDetalle && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-sm rounded-2xl border ${t.border} ${t.panel} p-6 shadow-2xl max-h-[90vh] overflow-y-auto`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-lg ${t.text}`}>🧾 Recibo</h3>
                <button type="button" onClick={() => setReciboDetalle(null)}
                  className={`p-1.5 rounded-lg transition ${t.btnSecondary}`}>✕</button>
              </div>
              <div className={`text-xs space-y-1 mb-4 ${t.textSub}`}>
                <p>Mesa: <span className={t.text}>{reciboDetalle.mesa}</span></p>
                <p>Cliente: <span className={t.text}>{reciboDetalle.cliente || '—'}</span></p>
                <p>Fecha: <span className={t.text}>{fmtDateTime(reciboDetalle.fecha)}</span></p>
                <p>Pago: <span className={t.text}>{reciboDetalle.metodoPago}</span></p>
              </div>
              <div className={`border-t ${t.border} pt-3 space-y-2`}>
                {(reciboDetalle.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className={t.textSub}>{item.product?.name} × {item.qty}</span>
                    <span className={t.text}>{fmt((item.product?.price||0) * (item.qty||1))}</span>
                  </div>
                ))}
              </div>
              <div className={`border-t ${t.border} mt-3 pt-3 flex justify-between`}>
                <span className={`font-bold ${t.text}`}>Total</span>
                <span className="text-orange-500 font-extrabold text-lg">{fmt(reciboDetalle.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Reporte: Descuentos ─────────────────────────────────────────────────
  function renderRepDesctos() {
    return (
      <div className="space-y-5">
        <div className={`rounded-2xl border ${t.border} ${t.panel} p-10 text-center`}>
          <div className="text-6xl mb-4">🏷️</div>
          <h3 className={`text-xl font-bold mb-2 ${t.text}`}>Función de descuentos próximamente</h3>
          <p className={`text-sm max-w-xs mx-auto ${t.textSub}`}>
            Activa los descuentos en <strong>Configuración → Funciones</strong> para comenzar a usarlos en tus tickets.
          </p>
          <button type="button" onClick={() => setSection('cfg-funciones')}
            className="mt-5 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition">
            Ir a Funciones →
          </button>
        </div>
      </div>
    )
  }

  // ─── Render principal ─────────────────────────────────────────────────────
  const currentTitle = section === 'dashboard'
    ? `Dashboard — ${negocioNombre}`
    : SECTION_TITLES[section] ?? ''

  // Sidebar contents — compartido entre drawer y sidebar fijo
  function SidebarContent({ onNav }) {
    return (
      <>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800 shrink-0">
          <button type="button" onClick={() => { setSection('dashboard'); onNav?.() }}
            className="flex items-center gap-2 w-full text-left">
            <span className="text-xl">🌮</span>
            <span className="text-white font-extrabold text-base tracking-tight">
              Taquero<span className="text-orange-500">POS</span>
            </span>
          </button>
          <p className="text-slate-600 text-xs mt-0.5 pl-7">Panel de administración</p>
        </div>

        {/* Dashboard */}
        <div className="px-3 pt-3 shrink-0">
          <button type="button" onClick={() => { setSection('dashboard'); onNav?.() }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition
              ${section === 'dashboard'
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            🏠 Dashboard
          </button>
        </div>

        {/* Grupos de navegación */}
        <nav className="flex-1 px-3 py-3 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map(({ label, items }) => (
            <div key={label}>
              <p className="text-slate-600 text-xs font-bold uppercase tracking-wider px-3 mb-1.5">
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ id, label: itemLabel }) => (
                  <button key={id} type="button" onClick={() => { setSection(id); onNav?.() }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition
                      ${section === id
                        ? 'bg-orange-500/20 text-orange-400 font-medium'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    {itemLabel}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: tema + logout */}
        <div className="px-3 pb-4 pt-3 border-t border-slate-800 space-y-0.5 shrink-0">
          <button type="button"
            onClick={() => selectTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition">
            {theme === 'dark' ? '☀️ Tema Claro' : '🌙 Tema Oscuro'}
          </button>
          <button type="button"
            onClick={async () => { await supabase.auth.signOut(); navigate('/') }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition">
            🚪 Cerrar sesión
          </button>
        </div>
      </>
    )
  }

  return (
    <div className={`flex h-screen overflow-hidden ${t.bg}`}>

      {/* ── SIDEBAR DRAWER (móvil) ─────────────────────────────────────────── */}
      {showSidebar && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSidebar(false)} />
          {/* Drawer */}
          <aside className="relative w-64 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col overflow-y-auto">
            <SidebarContent onNav={() => setShowSidebar(false)} />
          </aside>
        </div>
      )}

      {/* ── BARRA LATERAL (desktop) ────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 bg-slate-950 border-r border-slate-800 flex-col overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* ── CONTENIDO PRINCIPAL ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b ${t.hdr}`}>
          <div className="flex items-center gap-3">
            {/* Hamburguesa (solo móvil) */}
            <button type="button" onClick={() => setShowSidebar(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-lg">
              ☰
            </button>
            <div>
              <h1 className={`font-bold text-lg md:text-xl leading-tight ${t.text}`}>{currentTitle}</h1>
              {section === 'dashboard' && (
                <p className={`text-xs md:text-sm capitalize ${t.textSub}`}>
                  {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {section === 'dashboard' && lastRefresh && (
              <>
                <span className={`text-xs hidden sm:block ${t.textSub}`}>
                  Act. {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button type="button" onClick={refreshData} title="Actualizar datos"
                  className={`p-2 rounded-lg transition text-lg ${t.btnSecondary}`}>
                  🔄
                </button>
              </>
            )}
            <NavMenu />
          </div>
        </div>

        {/* Sección activa */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {renderSection()}
        </div>
      </main>
    </div>
  )
}
