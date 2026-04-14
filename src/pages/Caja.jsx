import { useState, useEffect, useRef, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BUSINESS_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n) => `$${(n ?? 0).toFixed(2)}`

const NEGOCIO = {
  nombre:    'Mi Taquería',
  direccion: 'Av. Principal #123, Guadalajara',
  telefono:  '33-1234-5678',
}

const BILLETES = [500, 200, 100, 50, 20, 10, 5, 1]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getNextTicketNum() {
  const last = parseInt(localStorage.getItem('taqueropOS_lastTicket') || '0', 10)
  const next = last + 1
  localStorage.setItem('taqueropOS_lastTicket', String(next))
  return next
}

function tiempoAbierto(createdAt) {
  if (!createdAt) return ''
  const mins = Math.floor((Date.now() - createdAt) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `hace ${hrs}h ${rem}m` : `hace ${hrs}h`
}

function loadTickets() {
  try {
    const raw = localStorage.getItem('taqueropOS_tickets')
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.map(t => ({
      ...t,
      items:     Array.isArray(t.items) ? t.items.map(i => ({ ...i, personaIdx: i.personaIdx ?? 0 })) : [],
      personas:  t.personas  ?? 1,
      tipo:      t.tipo      ?? 'aqui',
      createdAt: t.createdAt ?? Date.now(),
    }))
  } catch {
    return []
  }
}

function getAdminPIN() {
  const pin = localStorage.getItem('taqueropOS_adminPIN')
  if (!pin) { localStorage.setItem('taqueropOS_adminPIN', '2205'); return '2205' }
  return pin
}

function cobradosKey() {
  const d = new Date()
  return `taqueropOS_cobrados_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function saveTicketCobrado(ticket, metodoPago, total) {
  try {
    const key = cobradosKey()
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    existing.push({
      id: ticket.id, mesa: ticket.mesa, cliente: ticket.cliente,
      total, metodoPago, items: ticket.items, fecha: Date.now(),
    })
    localStorage.setItem(key, JSON.stringify(existing))
  } catch {}
}

function getNegocio() {
  try { return JSON.parse(localStorage.getItem('taqueropOS_negocio')) || NEGOCIO }
  catch { return NEGOCIO }
}

function printViaIframe(html) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden;'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow.document
  doc.open(); doc.write(html); doc.close()
  iframe.contentWindow.focus()
  iframe.contentWindow.print()
  setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 2000)
}

function printTicket({ ticket, method, pagoNum }) {
  const negocio = getNegocio()
  const ticketNum = getNextTicketNum()
  const now    = new Date()
  const fecha  = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora   = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
  const items  = Array.isArray(ticket.items) ? ticket.items : []
  const total  = items.reduce((s, i) => s + i.product.price * i.qty, 0)
  const cambio = pagoNum - total
  const numPersonas = ticket.personas ?? 1

  let itemRows = ''
  if (numPersonas > 1) {
    for (let p = 0; p < numPersonas; p++) {
      const pItems = items.filter(i => (i.personaIdx ?? 0) === p)
      if (!pItems.length) continue
      itemRows += `<tr><td colspan="2" style="padding-top:5px;font-weight:bold;border-top:1px dashed #000">Persona ${p + 1}</td></tr>`
      pItems.forEach(({ product, qty }) => {
        itemRows += `<tr><td>${product.name} x${qty}</td><td style="text-align:right">$${(product.price * qty).toFixed(2)}</td></tr>`
      })
    }
  } else {
    items.forEach(({ product, qty }) => {
      itemRows += `<tr><td>${product.name} x${qty}</td><td style="text-align:right">$${(product.price * qty).toFixed(2)}</td></tr>`
    })
  }

  const pagoRows = method === 'efectivo'
    ? `<tr><td>Efectivo:</td><td style="text-align:right">$${pagoNum.toFixed(2)}</td></tr>
       <tr><td>Cambio:</td><td style="text-align:right">$${cambio.toFixed(2)}</td></tr>`
    : `<tr><td>Método:</td><td style="text-align:right">${method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</td></tr>`

  printViaIframe(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',Courier,monospace;font-size:11px;width:300px;padding:6px 8px;color:#000}
    h1{font-size:14px;font-weight:bold;text-align:center;margin-bottom:2px}
    .s{font-size:10px;text-align:center;margin-bottom:1px}
    .ln{border-top:1px solid #000;margin:5px 0}
    .ld{border-top:1px dashed #000;margin:5px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:1px 0;vertical-align:top}
    .ttl td{font-weight:bold;font-size:13px}
    .foot{text-align:center;margin-top:6px}
    @media print{@page{margin:0;size:80mm auto}}
  </style></head><body>
    <h1>${negocio.nombre}</h1>
    <div class="s">${negocio.direccion}</div>
    <div class="s">Tel: ${negocio.telefono}</div>
    <div class="ln"></div>
    <table>
      <tr><td colspan="2">Fecha: ${fecha} &nbsp; ${hora}</td></tr>
      <tr><td colspan="2">Ticket #: ${ticketNum}</td></tr>
      <tr><td>Mesa: ${ticket.mesa}</td><td style="text-align:right">Cliente: ${ticket.cliente}</td></tr>
    </table>
    <div class="ld"></div>
    <table>${itemRows}</table>
    <div class="ld"></div>
    <table class="ttl"><tr><td>TOTAL:</td><td style="text-align:right">$${total.toFixed(2)}</td></tr></table>
    <div class="ld"></div>
    <table>${pagoRows}</table>
    <div class="ln"></div>
    <div class="foot">¡Gracias por su visita!</div>
    <div class="foot">Vuelva pronto 🌮</div>
  </body></html>`)
}

function guardarOrdenCocina(ticket) {
  try {
    const LS_KEY = 'taqueropOS_ordenes_cocina'
    const items  = Array.isArray(ticket.items) ? ticket.items : []
    const numPersonas = ticket.personas ?? 1

    const personas = []
    for (let p = 0; p < numPersonas; p++) {
      const pItems = items.filter(i => (i.personaIdx ?? 0) === p)
      if (!pItems.length) continue
      personas.push({
        nombre: `Persona ${p + 1}`,
        items: pItems.map(({ product, qty }) => ({
          nombre:   product.name,
          cantidad: qty,
        })),
      })
    }
    // Si no hay separación por persona, agrupa todo en una
    if (personas.length === 0 && items.length > 0) {
      personas.push({
        nombre: 'Orden',
        items: items.map(({ product, qty }) => ({ nombre: product.name, cantidad: qty })),
      })
    }

    const orden = {
      id:            crypto.randomUUID(),
      mesa:          ticket.mesa,
      cliente:       ticket.cliente || '',
      personas,
      estado:        'pendiente',
      creadoEn:      Date.now(),
      actualizadoEn: Date.now(),
    }

    const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    existing.push(orden)
    localStorage.setItem(LS_KEY, JSON.stringify(existing))
  } catch (e) {
    console.error('Error guardando orden en cocina:', e)
  }
}

function printComanda(ticket) {
  // Guardar en pantalla de cocina además de imprimir
  guardarOrdenCocina(ticket)

  const now   = new Date()
  const fecha = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora  = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
  const items = Array.isArray(ticket.items) ? ticket.items : []
  const numPersonas = ticket.personas ?? 1

  let body = ''
  for (let p = 0; p < numPersonas; p++) {
    const pItems = items.filter(i => (i.personaIdx ?? 0) === p)
    if (!pItems.length) continue
    body += `<div class="sep"></div><div class="persona">PERSONA ${p + 1}</div>`
    pItems.forEach(({ product, qty }) => {
      body += `<div class="item">${product.name} x${qty}</div>`
    })
  }

  printViaIframe(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',Courier,monospace;font-size:12px;width:300px;padding:6px 8px;color:#000}
    h1{font-size:13px;font-weight:bold;text-align:center}
    .sub{font-size:10px;text-align:center;margin-bottom:2px}
    .sep{border-top:1px dashed #000;margin:5px 0}
    .bsep{border-top:2px solid #000;margin:5px 0}
    .persona{font-weight:bold;font-size:12px;padding:2px 0}
    .item{padding:1px 4px;font-size:11px}
    @media print{@page{margin:0;size:80mm auto}}
  </style></head><body>
    <h1>====== COMANDA ======</h1>
    <div class="sub">Mesa: ${ticket.mesa} | Cliente: ${ticket.cliente}</div>
    <div class="sub">Fecha: ${fecha} ${hora}</div>
    <div class="bsep"></div>
    ${body}
    <div class="bsep"></div>
  </body></html>`)
}

// ─── Fondo de caja helpers ────────────────────────────────────────────────────
function todayKey() {
  const d = new Date()
  return `taqueropOS_fondo_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function loadFondo() {
  try {
    const raw = localStorage.getItem(todayKey())
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err, info) { console.error('Caja error:', err, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-white font-bold text-xl mb-2">Algo salió mal</h2>
            <p className="text-slate-400 text-sm mb-6">Ocurrió un error inesperado en la pantalla de caja.</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Caja() {
  const navigate = useNavigate()

  // ── Estado ─────────────────────────────────────────────────────────────────
  const [tickets, setTickets]           = useState(loadTickets)
  const [activeTicketId, setActiveTicketId] = useState(() => {
    const saved = loadTickets()
    return saved.length > 0 ? saved[saved.length - 1].id : null
  })

  // Modal nuevo ticket
  const [showModal, setShowModal]       = useState(false)
  const [modalMesa, setModalMesa]       = useState('')
  const [modalCliente, setModalCliente] = useState('')
  const [modalTipo, setModalTipo]       = useState('aqui')

  // Catálogo — datos de Supabase
  const [productos,         setProductos]        = useState([])
  const [categorias,        setCategorias]       = useState([])
  const [loadingProductos,  setLoadingProductos] = useState(true)
  const [selectedCategory,  setSelectedCategory] = useState('Todos')

  // Pago
  const [paymentMethod, setPaymentMethod] = useState('efectivo')

  // Panel de cobro
  const [cobrandoTicket, setCobrandoTicket] = useState(null)
  const [pagoCliente, setPagoCliente]       = useState('')

  // Personas: producto pendiente de asignar a una persona
  const [pendingProduct, setPendingProduct] = useState(null)

  // Drawer de tickets
  const [showDrawer, setShowDrawer]       = useState(false)
  const [drawerSearch, setDrawerSearch]   = useState('')
  const [drawerFiltro, setDrawerFiltro]   = useState('todos')

  // Cancelar ticket con PIN
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelMotivo,    setCancelMotivo]    = useState('')
  const [cancelPIN,       setCancelPIN]       = useState('')
  const [cancelError,     setCancelError]     = useState('')

  // Empleado activo
  const [empleadoActivo] = useState(() => {
    try { return JSON.parse(localStorage.getItem('taqueropOS_empleadoActivo')) || null }
    catch { return null }
  })

  // ── Permisos por rol ────────────────────────────────────────────────────────
  const rol             = empleadoActivo?.rol || 'cajero'
  const puedeAdmin      = ['admin', 'gerente'].includes(rol)
  const puedeCobrar     = ['admin', 'gerente', 'cajero'].includes(rol)
  const puedeCrearTicket = ['admin', 'gerente', 'cajero', 'mesero'].includes(rol)
  const puedeCancelar   = ['admin', 'gerente'].includes(rol)
  const puedeVerCocina  = ['admin', 'gerente', 'cocina'].includes(rol)

  // Fondo de caja
  const [fondo,             setFondo]             = useState(null)
  const [showFondoModal,    setShowFondoModal]    = useState(false)
  const [showFondoDesglose, setShowFondoDesglose] = useState(false)
  const [billetes,          setBilletes]          = useState(() =>
    Object.fromEntries(BILLETES.map(b => [b, 0]))
  )

  // ── Persistencia ───────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('taqueropOS_tickets', JSON.stringify(tickets))
  }, [tickets])

  // ── Cargar productos y categorías desde Supabase ───────────────────────────
  useEffect(() => {
    async function fetchMenu() {
      setLoadingProductos(true)
      try {
        const [{ data: prods }, { data: cats }] = await Promise.all([
          supabase
            .from('products')
            .select('*, categories(name)')
            .eq('business_id', BUSINESS_ID)
            .eq('is_available', true)
            .order('name'),
          supabase
            .from('categories')
            .select('id, name')
            .eq('business_id', BUSINESS_ID)
            .order('name'),
        ])
        setProductos(Array.isArray(prods) ? prods : [])
        setCategorias(Array.isArray(cats) ? cats : [])
      } catch (err) {
        console.error('Error al cargar el menú:', err)
      } finally {
        setLoadingProductos(false)
      }
    }
    fetchMenu()
  }, [])

  // ── Fondo de caja: verificar al cargar ─────────────────────────────────────
  useEffect(() => {
    const saved = loadFondo()
    if (saved) setFondo(saved)
    else setShowFondoModal(true)
  }, [])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const activeTicket     = (tickets ?? []).find(t => t.id === activeTicketId) ?? null
  const activeItems      = Array.isArray(activeTicket?.items) ? activeTicket.items : []
  const activeNumPersonas = activeTicket?.personas ?? 1

  const filteredProducts = selectedCategory === 'Todos'
    ? productos
    : productos.filter(p => p.categories?.name === selectedCategory)

  const total = activeItems.reduce((s, i) => s + i.product.price * i.qty, 0)

  const cobrandoItems = Array.isArray(cobrandoTicket?.items) ? cobrandoTicket.items : []
  const cobrandoTotal = cobrandoItems.reduce((s, i) => s + i.product.price * i.qty, 0)
  const pagoNum       = parseFloat(pagoCliente) || 0
  const cambio        = pagoNum - cobrandoTotal

  // Items del ticket activo agrupados por persona
  const groupedActive = Array.from({ length: activeNumPersonas }, (_, p) =>
    activeItems.filter(i => (i.personaIdx ?? 0) === p)
  )

  // Items del ticket en cobro agrupados por persona
  const cobNumPersonas  = cobrandoTicket?.personas ?? 1
  const groupedCobrando = Array.from({ length: cobNumPersonas }, (_, p) =>
    cobrandoItems.filter(i => (i.personaIdx ?? 0) === p)
  )

  // Drawer filtrado
  const drawerTickets = (tickets ?? []).filter(t => {
    const q = drawerSearch.toLowerCase()
    const matchSearch = !q ||
      (t.mesa ?? '').toLowerCase().includes(q) ||
      (t.cliente ?? '').toLowerCase().includes(q)
    const matchFiltro = drawerFiltro === 'todos' ||
      (drawerFiltro === 'aqui'   && (t.tipo ?? 'aqui') === 'aqui') ||
      (drawerFiltro === 'llevar' && (t.tipo ?? 'aqui') === 'llevar')
    return matchSearch && matchFiltro
  })

  const fondoTotal = BILLETES.reduce((sum, b) => sum + b * (billetes[b] || 0), 0)

  // ── Handlers ─────────────────────────────────────────────────────────────
  function openModal() {
    setModalMesa(''); setModalCliente(''); setModalTipo('aqui'); setShowModal(true)
  }

  function createTicket(e) {
    e.preventDefault()
    if (!modalMesa.trim()) return
    const ticket = {
      id:        Date.now(),
      mesa:      modalMesa.trim(),
      cliente:   modalCliente.trim() || 'Cliente',
      tipo:      modalTipo,
      personas:  1,
      items:     [],
      createdAt: Date.now(),
    }
    setTickets(prev => [...(prev ?? []), ticket])
    setActiveTicketId(ticket.id)
    setCobrandoTicket(null)
    setShowModal(false)
  }

  function switchTicket(ticketId) {
    setCobrandoTicket(null)
    setPagoCliente('')
    setPendingProduct(null)
    setActiveTicketId(ticketId)
    setShowDrawer(false)
  }

  // Agregar persona al ticket activo
  function addPersona() {
    if (!activeTicketId) return
    setTickets(prev => (prev ?? []).map(t =>
      t.id === activeTicketId ? { ...t, personas: (t.personas ?? 1) + 1 } : t
    ))
  }

  // Agrega producto a una persona específica
  function addProductToPersona(product, personaIdx) {
    if (!activeTicketId) return
    setTickets(prev => (prev ?? []).map(t => {
      if (t.id !== activeTicketId) return t
      const items = Array.isArray(t.items) ? t.items : []
      const exists = items.find(i => i.product.id === product.id && (i.personaIdx ?? 0) === personaIdx)
      if (exists) {
        return {
          ...t,
          items: items.map(i =>
            (i.product.id === product.id && (i.personaIdx ?? 0) === personaIdx)
              ? { ...i, qty: i.qty + 1 }
              : i
          ),
        }
      }
      return { ...t, items: [...items, { product, qty: 1, personaIdx }] }
    }))
  }

  // Si hay más de una persona, pide a qué persona; si no, agrega directo
  function addProduct(product) {
    if (!activeTicketId) return
    if (activeNumPersonas > 1) {
      setPendingProduct(product)
    } else {
      addProductToPersona(product, 0)
    }
  }

  function changeQty(productId, personaIdx, delta) {
    setTickets(prev => (prev ?? []).map(t => {
      if (t.id !== activeTicketId) return t
      const items = Array.isArray(t.items) ? t.items : []
      return {
        ...t,
        items: items
          .map(i => (i.product.id === productId && (i.personaIdx ?? 0) === personaIdx)
            ? { ...i, qty: i.qty + delta }
            : i
          )
          .filter(i => i.qty > 0),
      }
    }))
  }

  function removeItem(productId, personaIdx) {
    setTickets(prev => (prev ?? []).map(t => {
      if (t.id !== activeTicketId) return t
      const items = Array.isArray(t.items) ? t.items : []
      return {
        ...t,
        items: items.filter(i =>
          !(i.product.id === productId && (i.personaIdx ?? 0) === personaIdx)
        ),
      }
    }))
  }

  function cobrar() {
    if (!activeTicket || activeItems.length === 0) return
    setCobrandoTicket({ ...activeTicket, method: paymentMethod })
    setPagoCliente('')
  }

  function confirmarCobro() {
    if (!cobrandoTicket) return
    saveTicketCobrado(cobrandoTicket, cobrandoTicket.method, cobrandoTotal)
    const id = cobrandoTicket.id
    const remaining = (tickets ?? []).filter(t => t.id !== id)
    setTickets(remaining)
    setActiveTicketId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
    setCobrandoTicket(null)
    setPagoCliente('')
    setPaymentMethod('efectivo')
  }

  function cancelarCobro() {
    setCobrandoTicket(null)
    setPagoCliente('')
  }

  function cancelarTicket() {
    if (!cancelMotivo.trim()) { setCancelError('El motivo es obligatorio.'); return }
    if (cancelPIN.length < 4) { setCancelError('Ingresa los 4 dígitos del PIN.'); return }
    if (cancelPIN !== getAdminPIN()) {
      setCancelError('PIN incorrecto')
      setCancelPIN('')
      return
    }
    const remaining = (tickets ?? []).filter(t => t.id !== activeTicketId)
    setTickets(remaining)
    setActiveTicketId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
    setCobrandoTicket(null)
    setShowCancelModal(false)
    setCancelMotivo('')
    setCancelPIN('')
    setCancelError('')
  }

  function handlePrint() {
    if (!cobrandoTicket) return
    printTicket({
      ticket:  cobrandoTicket,
      method:  cobrandoTicket.method,
      pagoNum: cobrandoTicket.method === 'efectivo' ? pagoNum : 0,
    })
  }

  function handlePrintComanda() {
    if (!activeTicket) return
    printComanda(activeTicket)
  }

  function guardarFondo() {
    if (fondoTotal === 0) return
    const d = new Date()
    const fecha = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const data = {
      fecha,
      total: fondoTotal,
      desglose: Object.fromEntries(BILLETES.map(b => [b, billetes[b] || 0])),
    }
    localStorage.setItem(todayKey(), JSON.stringify(data))
    setFondo(data)
    setShowFondoModal(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  // ── Menú hamburguesa ──────────────────────────────────────────────────────
  const [showNavMenu, setShowNavMenu] = useState(false)

  // ── Bottom sheet (móvil) ───────────────────────────────────────────────────
  const [showBottomSheet, setShowBottomSheet] = useState(false)
  const navMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target)) {
        setShowNavMenu(false)
      }
    }
    if (showNavMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNavMenu])

  const NAV_ITEMS = [
    { icon: '🧾', label: 'Caja',           path: '/caja',   visible: true           },
    { icon: '🍳', label: 'Cocina',          path: '/cocina', visible: puedeVerCocina },
    { icon: '🍽️', label: 'Menú',           path: '/menu',   visible: puedeAdmin     },
    { icon: '⚙️', label: 'Administración', path: '/admin',  visible: puedeAdmin     },
  ].filter(i => i.visible)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌮</span>
            <span className="text-white font-extrabold text-xl tracking-tight">
              Taquero<span className="text-orange-500">POS</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {/* Empleado activo */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-sm">
              <span className="text-slate-400">👤</span>
              {empleadoActivo ? (
                <span className="text-white font-medium">
                  {empleadoActivo.nombre}
                  <span className="text-slate-400 font-normal"> — {empleadoActivo.rol.charAt(0).toUpperCase() + empleadoActivo.rol.slice(1)}</span>
                </span>
              ) : (
                <span className="text-slate-400">Sin identificar</span>
              )}
            </div>

            {fondo && (
              <button
                type="button"
                onClick={() => setShowFondoDesglose(true)}
                className="text-green-400 text-sm font-semibold hover:text-green-300 transition px-3 py-1.5 rounded-lg hover:bg-slate-800"
              >
                💰 Fondo: {fmt(fondo.total)}
              </button>
            )}
          </div>
          {/* Menú hamburguesa */}
          <div className="relative" ref={navMenuRef}>
            <button type="button"
              onClick={() => setShowNavMenu(v => !v)}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700
                         text-slate-300 hover:text-white transition text-lg"
              title="Navegación">
              ☰
            </button>

            {showNavMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-700
                              bg-[#1e293b] shadow-2xl z-50 overflow-hidden py-1">
                {NAV_ITEMS.map(({ icon, label, path }) => (
                  <button key={path} type="button"
                    onClick={() => { setShowNavMenu(false); navigate(path) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition
                      ${path === '/caja'
                        ? 'text-orange-400 bg-orange-500/10 font-semibold'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                    <span className="text-base">{icon}</span>
                    {label}
                  </button>
                ))}
                <div className="border-t border-slate-700 mt-1 pt-1">
                  <button type="button" onClick={signOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400
                               hover:bg-red-500/10 hover:text-red-400 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                    </svg>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ── BARRA SUPERIOR (Nuevo Ticket + Drawer) ───────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 border-b border-slate-800 shrink-0">
          {puedeCrearTicket && (
            <button
              type="button"
              onClick={openModal}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition"
            >
              <span className="text-lg leading-none">+</span> Nuevo Ticket
            </button>
          )}

          <button
            type="button"
            onClick={() => { setShowDrawer(true); setDrawerSearch(''); setDrawerFiltro('todos') }}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
          >
            🎫 Tickets abiertos ({(tickets ?? []).length})
          </button>

          {/* Ticket activo — indicador compacto */}
          {activeTicket && (
            <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30">
              <span className="text-orange-400 text-xs font-bold">
                Mesa {activeTicket.mesa} · {activeTicket.cliente}
              </span>
              {activeTicket.tipo === 'llevar' && (
                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">llevar</span>
              )}
            </div>
          )}
        </div>

        {/* ── CUERPO PRINCIPAL ─────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── IZQUIERDA: Catálogo ────────────────────────────────────────── */}
          <div className="flex flex-col w-full md:w-[65%] border-r border-slate-800 overflow-hidden">

            <div className="px-4 py-3 shrink-0 border-b border-slate-800">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-4 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
              >
                <option value="Todos">Todos los artículos</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Loading */}
              {loadingProductos && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Cargando menú...</span>
                </div>
              )}

              {/* Sin ticket activo */}
              {!loadingProductos && !activeTicketId && (
                <div className="text-center text-slate-600 text-sm mt-8">
                  Crea un ticket para comenzar a agregar productos
                </div>
              )}

              {/* Sin productos */}
              {!loadingProductos && activeTicketId && productos.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <div className="text-5xl">🌮</div>
                  <p className="text-slate-400 text-sm font-medium">No hay productos disponibles.</p>
                  <p className="text-slate-500 text-xs">Agrega productos desde el Gestor de Menú</p>
                  <button
                    type="button"
                    onClick={() => navigate('/menu')}
                    className="mt-1 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl transition"
                  >
                    Ir al Gestor de Menú
                  </button>
                </div>
              )}

              {/* Grid de productos */}
              {!loadingProductos && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      disabled={!activeTicketId}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition
                        ${activeTicketId
                          ? 'bg-slate-800 border-slate-700 hover:border-orange-500 hover:bg-slate-700 active:scale-95'
                          : 'bg-slate-800/50 border-slate-800 opacity-40 cursor-not-allowed'}`}
                    >
                      {product.image_url?.startsWith('http') ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-lg"
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <span className="text-4xl">{product.image_url || '🌮'}</span>
                      )}
                      <span className="text-white text-xs font-medium leading-tight line-clamp-2">
                        {product.name}
                      </span>
                      <span className="text-orange-400 font-bold text-sm">{fmt(product.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── DERECHA: Panel variable ────────────────────────────────────── */}
          <div className="hidden md:flex flex-col w-[35%] overflow-hidden">

            {/* ── PANEL DE COBRO ─────────────────────────────────────────── */}
            {cobrandoTicket ? (
              <>
                <div className="px-4 py-3 border-b border-slate-800 shrink-0 bg-orange-500/10">
                  <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-0.5">Cobrando</p>
                  <p className="text-white font-semibold">Mesa {cobrandoTicket.mesa}</p>
                  <p className="text-slate-400 text-sm">{cobrandoTicket.cliente}</p>
                </div>

                {/* Resumen agrupado por persona */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                  {(groupedCobrando ?? []).map((pItems, p) => {
                    if (!pItems || pItems.length === 0) return null
                    return (
                      <div key={p}>
                        {cobNumPersonas > 1 && (
                          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-2 mb-1">
                            Persona {p + 1}
                          </p>
                        )}
                        {pItems.map(({ product, qty }) => (
                          <div key={`${p}-${product.id}`} className="flex items-center justify-between py-0.5">
                            <span className="text-slate-300 text-sm">
                              {product.name}<span className="text-slate-500 ml-1">x{qty}</span>
                            </span>
                            <span className="text-white text-sm font-medium">{fmt(product.price * qty)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>

                <div className="px-4 py-4 border-t border-slate-800 space-y-3 shrink-0">
                  <div className="flex items-end justify-between">
                    <span className="text-slate-400 text-sm">Total a cobrar</span>
                    <span className="text-white text-3xl font-extrabold">{fmt(cobrandoTotal)}</span>
                  </div>

                  {cobrandoTicket.method === 'efectivo' ? (
                    <>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">
                          ¿Con cuánto paga el cliente?
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={pagoCliente}
                          onChange={e => setPagoCliente(e.target.value)}
                          placeholder="0.00"
                          autoFocus
                          className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-xl font-bold
                                     placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                        />
                      </div>
                      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition
                        ${pagoNum === 0 ? 'bg-slate-800 border-slate-700'
                          : cambio >= 0 ? 'bg-green-500/10 border-green-500/40'
                          : 'bg-red-500/10 border-red-500/40'}`}
                      >
                        <span className="text-slate-300 text-sm font-medium">Cambio</span>
                        <div className="text-right">
                          {pagoNum === 0
                            ? <span className="text-slate-600 text-xl font-extrabold">—</span>
                            : cambio >= 0
                              ? <span className="text-green-400 text-xl font-extrabold">{fmt(cambio)}</span>
                              : <div>
                                  <span className="text-red-400 text-xl font-extrabold">{fmt(Math.abs(cambio))}</span>
                                  <p className="text-red-500 text-xs">faltan</p>
                                </div>
                          }
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700">
                      <span className="text-2xl">{cobrandoTicket.method === 'tarjeta' ? '💳' : '📲'}</span>
                      <div>
                        <p className="text-white font-medium text-sm">
                          Pago con {cobrandoTicket.method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}
                        </p>
                        <p className="text-slate-400 text-xs">Sin cambio</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium
                                 transition flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 8H7V4h10v4zM5 12h14M5 12a2 2 0 00-2 2v4h18v-4a2 2 0 00-2-2H5zM7 16h.01M17 16h.01" />
                      </svg>
                      Ticket
                    </button>
                    <button
                      type="button"
                      onClick={() => cobrandoTicket && printComanda(cobrandoTicket)}
                      className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium
                                 transition flex items-center justify-center gap-1.5"
                    >
                      🍳 Comanda
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={confirmarCobro}
                    disabled={cobrandoTicket.method === 'efectivo' && pagoNum < cobrandoTotal}
                    className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600
                               text-white font-extrabold text-lg tracking-wide transition
                               shadow-lg shadow-orange-500/30
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirmar cobro
                  </button>

                  <button
                    type="button"
                    onClick={cancelarCobro}
                    className="w-full py-1.5 text-slate-500 hover:text-slate-300 text-sm transition text-center"
                  >
                    ← Cancelar, volver al ticket
                  </button>
                </div>
              </>

            /* ── SIN TICKET ACTIVO ─────────────────────────────────────── */
            ) : !activeTicket ? (
              <div className="flex-1 flex items-center justify-center text-center px-6">
                <div>
                  <div className="text-5xl mb-3">🧾</div>
                  <p className="text-slate-500 text-sm">Selecciona o crea un ticket para ver el detalle</p>
                </div>
              </div>

            /* ── TICKET ACTIVO ─────────────────────────────────────────── */
            ) : (
              <>
                {/* Encabezado + controles de persona */}
                <div className="px-4 py-3 border-b border-slate-800 shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold">Mesa {activeTicket.mesa}</p>
                      <p className="text-slate-400 text-sm">{activeTicket.cliente}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Comanda rápida */}
                      <button
                        type="button"
                        onClick={handlePrintComanda}
                        disabled={activeItems.length === 0}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300
                                   transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Imprimir comanda de cocina"
                      >
                        🍳
                      </button>
                      {/* Agregar persona */}
                      <button
                        type="button"
                        onClick={addPersona}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                      >
                        + Persona
                      </button>
                      {/* Cancelar ticket */}
                      {puedeCancelar && (
                        <button
                          type="button"
                          onClick={() => { setCancelMotivo(''); setCancelPIN(''); setCancelError(''); setShowCancelModal(true) }}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                          title="Cancelar ticket"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  {activeNumPersonas > 1 && (
                    <p className="text-orange-400 text-xs mt-1 font-medium">
                      {activeNumPersonas} personas
                    </p>
                  )}
                </div>

                {/* Lista de items agrupada por persona */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {activeItems.length === 0 && (
                    <p className="text-center text-slate-600 text-sm mt-8">
                      Toca un producto para agregarlo
                    </p>
                  )}

                  {(groupedActive ?? []).map((pItems, p) => (
                    <div key={p}>
                      {activeNumPersonas > 1 && (
                        <div className="flex items-center gap-2 mt-2 mb-1">
                          <div className="flex-1 h-px bg-slate-700" />
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider shrink-0">
                            Persona {p + 1}
                          </span>
                          <div className="flex-1 h-px bg-slate-700" />
                        </div>
                      )}
                      {(pItems ?? []).length === 0 && activeNumPersonas > 1 && (
                        <p className="text-slate-700 text-xs text-center py-1">Sin productos</p>
                      )}
                      {(pItems ?? []).map(({ product, qty }) => (
                        <div
                          key={`${p}-${product.id}`}
                          className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2.5 mb-1.5"
                        >
                          <span className="text-xl shrink-0">
                            {product.image_url?.startsWith('http') ? '🌮' : (product.image_url || '🌮')}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium truncate">{product.name}</p>
                            <p className="text-orange-400 text-xs">{fmt(product.price * qty)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => changeQty(product.id, p, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-base font-bold flex items-center justify-center transition"
                            >−</button>
                            <span className="w-6 text-center text-white text-sm font-semibold">{qty}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(product.id, p, +1)}
                              className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-base font-bold flex items-center justify-center transition"
                            >+</button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(product.id, p)}
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 flex items-center justify-center transition shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Total + Métodos de pago + Cobrar */}
                <div className="px-4 py-4 border-t border-slate-800 space-y-3 shrink-0">
                  <div className="flex items-end justify-between">
                    <span className="text-slate-400 text-sm">Total</span>
                    <span className="text-white text-3xl font-extrabold">{fmt(total)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'efectivo',      label: 'Efectivo',      icon: '💵' },
                      { key: 'tarjeta',       label: 'Tarjeta',       icon: '💳' },
                      { key: 'transferencia', label: 'Transferencia', icon: '📲' },
                    ].map(({ key, label, icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPaymentMethod(key)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition
                          ${paymentMethod === key
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        <span className="text-xl">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>

                  {puedeCobrar ? (
                    <button
                      type="button"
                      onClick={cobrar}
                      disabled={activeItems.length === 0}
                      className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600
                                 text-white font-extrabold text-lg tracking-wide transition
                                 shadow-lg shadow-orange-500/30
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      COBRAR
                    </button>
                  ) : (
                    <div className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
                      <p className="text-slate-500 text-sm">🔒 Solo el cajero puede cobrar</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── BOTÓN FLOTANTE (móvil) ──────────────────────────────────────── */}
        {!showBottomSheet && (
          <div className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
            <button
              type="button"
              onClick={() => setShowBottomSheet(true)}
              className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-orange-500 hover:bg-orange-400
                         text-white font-bold text-sm shadow-xl shadow-orange-500/40 transition active:scale-95"
            >
              🧾 Ver ticket
              {activeItems.length > 0 && (
                <span className="flex items-center gap-1">
                  · {fmt(total)}
                  <span className="bg-white/20 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {activeItems.reduce((s, i) => s + i.qty, 0)}
                  </span>
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── BOTTOM SHEET (móvil) ────────────────────────────────────────── */}
        {showBottomSheet && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowBottomSheet(false)}
            />
            {/* Sheet */}
            <div className="relative bg-slate-900 rounded-t-3xl border-t border-slate-700 flex flex-col"
                 style={{ maxHeight: '90vh' }}>
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-600" />
              </div>
              {/* Header sheet */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0">
                <span className="text-white font-bold text-base">
                  {cobrandoTicket
                    ? `Cobrando — Mesa ${cobrandoTicket.mesa}`
                    : activeTicket
                      ? `Mesa ${activeTicket.mesa} · ${activeTicket.cliente}`
                      : 'Sin ticket activo'}
                </span>
                <button type="button" onClick={() => setShowBottomSheet(false)}
                  className="text-slate-400 hover:text-white transition text-xl leading-none">✕</button>
              </div>

              {/* Contenido — reutiliza el panel derecho exacto */}
              <div className="flex flex-col flex-1 overflow-hidden">
                {cobrandoTicket ? (
                  <>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                      {(groupedCobrando ?? []).map((pItems, p) => {
                        if (!pItems || pItems.length === 0) return null
                        return (
                          <div key={p}>
                            {cobNumPersonas > 1 && (
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-2 mb-1">Persona {p + 1}</p>
                            )}
                            {pItems.map(({ product, qty }) => (
                              <div key={`${p}-${product.id}`} className="flex items-center justify-between py-0.5">
                                <span className="text-slate-300 text-sm">{product.name}<span className="text-slate-500 ml-1">x{qty}</span></span>
                                <span className="text-white text-sm font-medium">{fmt(product.price * qty)}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-4 py-4 border-t border-slate-800 space-y-3 shrink-0">
                      <div className="flex items-end justify-between">
                        <span className="text-slate-400 text-sm">Total a cobrar</span>
                        <span className="text-white text-3xl font-extrabold">{fmt(cobrandoTotal)}</span>
                      </div>
                      {cobrandoTicket.method === 'efectivo' ? (
                        <>
                          <input type="number" min="0" step="1" value={pagoCliente}
                            onChange={e => setPagoCliente(e.target.value)} placeholder="¿Con cuánto paga?"
                            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-xl font-bold
                                       placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
                          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition
                            ${pagoNum === 0 ? 'bg-slate-800 border-slate-700' : cambio >= 0 ? 'bg-green-500/10 border-green-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
                            <span className="text-slate-300 text-sm font-medium">Cambio</span>
                            {pagoNum === 0
                              ? <span className="text-slate-600 text-xl font-extrabold">—</span>
                              : cambio >= 0
                                ? <span className="text-green-400 text-xl font-extrabold">{fmt(cambio)}</span>
                                : <div><span className="text-red-400 text-xl font-extrabold">{fmt(Math.abs(cambio))}</span><p className="text-red-500 text-xs">faltan</p></div>
                            }
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700">
                          <span className="text-2xl">{cobrandoTicket.method === 'tarjeta' ? '💳' : '📲'}</span>
                          <p className="text-white font-medium text-sm">Pago con {cobrandoTicket.method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</p>
                        </div>
                      )}
                      <button type="button" onClick={confirmarCobro}
                        disabled={cobrandoTicket.method === 'efectivo' && pagoNum < cobrandoTotal}
                        className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-extrabold text-lg
                                   transition shadow-lg shadow-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
                        Confirmar cobro
                      </button>
                      <button type="button" onClick={cancelarCobro}
                        className="w-full py-1.5 text-slate-500 hover:text-slate-300 text-sm transition text-center">
                        ← Cancelar
                      </button>
                    </div>
                  </>
                ) : activeTicket ? (
                  <>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                      {activeItems.length === 0 && (
                        <p className="text-center text-slate-600 text-sm mt-8">Toca un producto para agregarlo</p>
                      )}
                      {(groupedActive ?? []).map((pItems, p) => (
                        <div key={p}>
                          {activeNumPersonas > 1 && (
                            <div className="flex items-center gap-2 mt-2 mb-1">
                              <div className="flex-1 h-px bg-slate-700" />
                              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider shrink-0">Persona {p + 1}</span>
                              <div className="flex-1 h-px bg-slate-700" />
                            </div>
                          )}
                          {(pItems ?? []).map(({ product, qty }) => (
                            <div key={`${p}-${product.id}`}
                              className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2.5 mb-1.5">
                              <span className="text-xl shrink-0">{product.image_url?.startsWith('http') ? '🌮' : (product.image_url || '🌮')}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-medium truncate">{product.name}</p>
                                <p className="text-orange-400 text-xs">{fmt(product.price * qty)}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => changeQty(product.id, p, -1)}
                                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-base font-bold flex items-center justify-center transition">−</button>
                                <span className="w-6 text-center text-white text-sm font-semibold">{qty}</span>
                                <button type="button" onClick={() => changeQty(product.id, p, +1)}
                                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-base font-bold flex items-center justify-center transition">+</button>
                              </div>
                              <button type="button" onClick={() => removeItem(product.id, p)}
                                className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 flex items-center justify-center transition shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-4 border-t border-slate-800 space-y-3 shrink-0">
                      <div className="flex items-end justify-between">
                        <span className="text-slate-400 text-sm">Total</span>
                        <span className="text-white text-3xl font-extrabold">{fmt(total)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'efectivo', label: 'Efectivo', icon: '💵' },
                          { key: 'tarjeta', label: 'Tarjeta', icon: '💳' },
                          { key: 'transferencia', label: 'Transferencia', icon: '📲' },
                        ].map(({ key, label, icon }) => (
                          <button key={key} type="button" onClick={() => setPaymentMethod(key)}
                            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition
                              ${paymentMethod === key ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            <span className="text-xl">{icon}</span>{label}
                          </button>
                        ))}
                      </div>
                      {puedeCobrar ? (
                        <button type="button" onClick={cobrar} disabled={activeItems.length === 0}
                          className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600
                                     text-white font-extrabold text-lg tracking-wide transition
                                     shadow-lg shadow-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
                          COBRAR
                        </button>
                      ) : (
                        <div className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
                          <p className="text-slate-500 text-sm">🔒 Solo el cajero puede cobrar</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center px-6">
                    <div>
                      <div className="text-5xl mb-3">🧾</div>
                      <p className="text-slate-500 text-sm">Crea un ticket para comenzar</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL NUEVO TICKET ──────────────────────────────────────────── */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
              <div className="px-6 py-5 border-b border-slate-700">
                <h2 className="text-white font-bold text-lg">Nuevo Ticket</h2>
                <p className="text-slate-400 text-sm">Ingresa los datos de la mesa</p>
              </div>

              <form onSubmit={createTicket} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Número de mesa <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={modalMesa}
                    onChange={e => setModalMesa(e.target.value)}
                    placeholder="Ej. 5, Barra, Para llevar..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white
                               placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nombre del cliente
                  </label>
                  <input
                    type="text"
                    value={modalCliente}
                    onChange={e => setModalCliente(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white
                               placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                  />
                </div>

                {/* Tipo de orden */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de orden</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'aqui',   label: '🍽️ Para comer aquí' },
                      { key: 'llevar', label: '🥡 Para llevar' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setModalTipo(key)}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition
                          ${modalTipo === key
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                            : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition"
                  >
                    Abrir Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL SELECTOR DE PERSONA ───────────────────────────────────── */}
        {pendingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-xs bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-5">
              <p className="text-white font-bold text-base mb-1">¿Para qué persona?</p>
              <p className="text-slate-400 text-sm mb-4">
                {pendingProduct.image_url?.startsWith('http') ? '' : (pendingProduct.image_url || '🌮')} {pendingProduct.name}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: activeNumPersonas }, (_, p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      addProductToPersona(pendingProduct, p)
                      setPendingProduct(null)
                    }}
                    className="py-3 rounded-xl bg-slate-700 hover:bg-orange-500 hover:text-white
                               text-slate-200 font-semibold text-sm transition"
                  >
                    Persona {p + 1}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingProduct(null)}
                className="w-full mt-3 py-2 text-slate-500 hover:text-slate-300 text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── DRAWER DE TICKETS ───────────────────────────────────────────── */}
        {showDrawer && (
          <div className="fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDrawer(false)}
            />

            {/* Panel del drawer */}
            <div className="relative z-10 w-80 max-w-full bg-slate-900 border-r border-slate-700 flex flex-col shadow-2xl">
              {/* Header del drawer */}
              <div className="px-4 py-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white font-bold text-base">Tickets abiertos</h2>
                  <button
                    type="button"
                    onClick={() => setShowDrawer(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Búsqueda */}
                <input
                  type="text"
                  value={drawerSearch}
                  onChange={e => setDrawerSearch(e.target.value)}
                  placeholder="Buscar por mesa o nombre..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm
                             placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition mb-3"
                />

                {/* Filtro tipo */}
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { key: 'todos',   label: 'Todos' },
                    { key: 'aqui',   label: '🍽️ Aquí' },
                    { key: 'llevar', label: '🥡 Llevar' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDrawerFiltro(key)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition
                        ${drawerFiltro === key
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de tickets */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {drawerTickets.length === 0 && (
                  <p className="text-center text-slate-600 text-sm mt-8">
                    {(tickets ?? []).length === 0 ? 'Sin tickets abiertos' : 'Sin resultados'}
                  </p>
                )}
                {(drawerTickets ?? []).map(ticket => {
                  const ticketTotal = (Array.isArray(ticket.items) ? ticket.items : [])
                    .reduce((s, i) => s + i.product.price * i.qty, 0)
                  const isActive = ticket.id === activeTicketId
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => switchTicket(ticket.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition
                        ${isActive
                          ? 'bg-orange-500/15 border-orange-500/50'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${isActive ? 'text-orange-400' : 'text-white'}`}>
                              Mesa {ticket.mesa}
                            </span>
                            {(ticket.tipo ?? 'aqui') === 'llevar' && (
                              <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                                llevar
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-xs truncate">{ticket.cliente}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-white text-sm font-bold">{fmt(ticketTotal)}</p>
                          <p className="text-slate-500 text-xs">{tiempoAbierto(ticket.createdAt)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Footer del drawer */}
              <div className="px-4 py-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={openModal}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition"
                >
                  + Nuevo Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL CANCELAR TICKET ───────────────────────────────────────── */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-xs bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-5">
              <h3 className="text-white font-bold text-lg mb-0.5">🔐 Cancelar Ticket</h3>
              <p className="text-slate-400 text-sm mb-4">Se requiere PIN de administrador</p>

              {/* Motivo */}
              <div className="mb-4">
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Motivo de cancelación</label>
                <input
                  type="text"
                  value={cancelMotivo}
                  onChange={e => setCancelMotivo(e.target.value)}
                  placeholder="Ej. Error de captura..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm
                             placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                />
              </div>

              {/* PIN display */}
              <div className="flex justify-center gap-3 mb-3">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold transition
                    ${cancelPIN.length > i ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-600'}`}>
                    {cancelPIN.length > i ? '●' : '○'}
                  </div>
                ))}
              </div>

              {cancelError && (
                <p className="text-red-400 text-sm text-center mb-3 font-medium">{cancelError}</p>
              )}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} type="button"
                    onClick={() => { if (cancelPIN.length < 4) { setCancelPIN(p => p + n); setCancelError('') } }}
                    className="py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold text-xl transition">
                    {n}
                  </button>
                ))}
                <button type="button"
                  onClick={() => { setCancelPIN(p => p.slice(0,-1)); setCancelError('') }}
                  className="py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xl transition">
                  ←
                </button>
                <button type="button"
                  onClick={() => { if (cancelPIN.length < 4) { setCancelPIN(p => p + '0'); setCancelError('') } }}
                  className="py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition">
                  0
                </button>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => { setShowCancelModal(false); setCancelPIN(''); setCancelMotivo(''); setCancelError('') }}
                  className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition">
                  Cancelar
                </button>
                <button type="button" onClick={cancelarTicket}
                  className="py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold transition">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL APERTURA DE CAJA ──────────────────────────────────────── */}
        {showFondoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">

              <div className="px-6 py-5 border-b border-slate-700 shrink-0">
                <h2 className="text-white font-bold text-xl">☀️ Apertura de Caja</h2>
                <p className="text-orange-400 text-sm font-medium capitalize">
                  {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-slate-400 text-sm mt-1">Registra el fondo inicial para comenzar el día</p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-1">
                  <div className="grid grid-cols-3 text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-700 mb-2">
                    <span>Billete</span>
                    <span className="text-center">Cantidad</span>
                    <span className="text-right">Subtotal</span>
                  </div>
                  {BILLETES.map(b => (
                    <div key={b} className="grid grid-cols-3 items-center py-1.5">
                      <span className="text-white font-semibold text-sm">${b}</span>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBilletes(prev => ({ ...prev, [b]: Math.max(0, (prev[b] || 0) - 1) }))}
                          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-base flex items-center justify-center transition"
                        >−</button>
                        <span className="w-8 text-center text-white font-semibold text-sm">{billetes[b] || 0}</span>
                        <button
                          type="button"
                          onClick={() => setBilletes(prev => ({ ...prev, [b]: (prev[b] || 0) + 1 }))}
                          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-base flex items-center justify-center transition"
                        >+</button>
                      </div>
                      <span className="text-right text-slate-300 text-sm font-medium">
                        {fmt(b * (billetes[b] || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-5 border-t border-slate-700 shrink-0 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Total del fondo</span>
                  <span className="text-white text-3xl font-extrabold">{fmt(fondoTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={guardarFondo}
                  disabled={fondoTotal === 0}
                  className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-extrabold text-lg
                             transition shadow-lg shadow-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Abrir Caja
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL DESGLOSE DE FONDO ─────────────────────────────────────── */}
        {showFondoDesglose && fondo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFondoDesglose(false)}
          >
            <div
              className="w-full max-w-xs bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-base">💰 Fondo de Caja</h3>
                  <p className="text-slate-400 text-xs">{fondo.fecha}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFondoDesglose(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                >✕</button>
              </div>
              <div className="space-y-1.5 mb-4">
                {BILLETES.filter(b => (fondo.desglose?.[b] || 0) > 0).map(b => (
                  <div key={b} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">${b} × {fondo.desglose[b]}</span>
                    <span className="text-white font-medium">{fmt(b * fondo.desglose[b])}</span>
                  </div>
                ))}
                {BILLETES.every(b => !(fondo.desglose?.[b] > 0)) && (
                  <p className="text-slate-500 text-sm text-center py-2">Sin desglose registrado</p>
                )}
              </div>
              <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Total</span>
                <span className="text-green-400 text-xl font-extrabold">{fmt(fondo.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
