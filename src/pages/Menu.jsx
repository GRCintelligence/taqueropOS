import { useState, useEffect, useRef, Component } from 'react'
import { supabase } from '../lib/supabase'
import NavMenu from '../components/NavMenu'

const BUSINESS_ID = '00000000-0000-0000-0000-000000000001'

// Categorías por defecto si la tabla categories está vacía
const DEFAULT_CATEGORIES = ['Tacos', 'Órdenes', 'Bebidas', 'Extras']

const EMOJI_OPTIONS = ['🌮','🥩','🍗','🧺','🫓','🌯','🌑','🫔','🥤','🥛','🧃','💧','🍟','🌶️','🥗','🍲','🍕','🍔','🥚','🧀','🫕','🍜','🥙','🥪']

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err, info) { console.error('Menu error:', err, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-white font-bold text-xl mb-2">Algo salió mal</h2>
            <button type="button" onClick={() => this.setState({ hasError: false })}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition">
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) { return `$${(parseFloat(n) || 0).toFixed(2)}` }

// ─── Formulario de producto ───────────────────────────────────────────────────
// categories = [{id, name}]  — siempre UUIDs reales
function ProductForm({ product, categories, onSave, onCancel }) {
  const isNew = !product

  const firstCatId = categories[0]?.id ?? ''

  const [nombre,      setNombre]      = useState(product?.name        ?? '')
  const [precio,      setPrecio]      = useState(product?.price != null ? String(product.price) : '')
  const [descripcion, setDescripcion] = useState(product?.description ?? '')
  const [categoriaId, setCategoriaId] = useState(product?.category_id ?? firstCatId)
  const [nuevaCat,    setNuevaCat]    = useState('')
  const [showNewCat,  setShowNewCat]  = useState(false)
  const [disponible,  setDisponible]  = useState(product?.is_available ?? true)
  // Si image_url es una URL (http...) → imagePreview; si es emoji o nada → emoji state
  const [emoji,       setEmoji]       = useState(
    product?.image_url && !product.image_url.startsWith('http') ? product.image_url : '🌮'
  )
  const [imageFile,   setImageFile]   = useState(null)
  const [imagePreview,setImagePreview]= useState(
    product?.image_url?.startsWith('http') ? product.image_url : null
  )
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim())                     { setError('El nombre es obligatorio.'); return }
    if (!precio || isNaN(parseFloat(precio))) { setError('El precio debe ser un número válido.'); return }

    setSaving(true)
    setError('')

    try {
      // 1. Resolver category_id
      let finalCategoryId = categoriaId

      if (showNewCat && nuevaCat.trim()) {
        // Crear nueva categoría directamente en la BD
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert({ name: nuevaCat.trim(), business_id: BUSINESS_ID })
          .select('id')
          .single()
        if (catErr) {
          console.error('Error al crear categoría:', catErr)
          throw catErr
        }
        finalCategoryId = newCat.id
      }

      // Validar que category_id es un UUID real
      if (!finalCategoryId) {
        throw new Error('Selecciona una categoría válida antes de guardar.')
      }

      // 2. Determinar image_url final
      let imageUrl
      if (imageFile) {
        // Subir foto al storage
        try {
          const ext  = imageFile.name.split('.').pop()
          const path = `${BUSINESS_ID}/${Date.now()}.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(path, imageFile, { upsert: true })
          if (uploadErr) {
            console.warn('No se pudo subir la foto:', uploadErr.message)
            imageUrl = emoji // fallback a emoji si falla
          } else {
            const { data: urlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(path)
            imageUrl = urlData?.publicUrl ?? emoji
          }
        } catch {
          imageUrl = emoji // foto falla silenciosamente
        }
      } else if (imagePreview) {
        // Mantener la URL de foto existente
        imageUrl = imagePreview
      } else {
        // Sin foto — guardar el emoji como image_url
        imageUrl = emoji
      }

      // 3. Payload — solo columnas que existen en la tabla
      const payload = {
        business_id:  BUSINESS_ID,
        name:         nombre.trim(),
        price:        parseFloat(precio),
        description:  descripcion.trim() || null,
        category_id:  finalCategoryId,
        is_available: disponible,
        image_url:    imageUrl,
      }

      if (isNew) {
        const { error: insertErr } = await supabase.from('products').insert(payload)
        if (insertErr) throw insertErr
      } else {
        const { error: updateErr } = await supabase
          .from('products').update(payload).eq('id', product.id)
        if (updateErr) throw updateErr
      }

      onSave()
    } catch (err) {
      console.error('Error al guardar producto:', err)
      setError(err.message ?? 'Error al guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">

      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-white font-bold text-lg">
          {isNew ? 'Nuevo producto' : 'Editar producto'}
        </h1>
      </header>

      {/* Formulario */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nombre del producto <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Taco de Pastor"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
            />
          </div>

          {/* Precio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Precio <span className="text-orange-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white
                           placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Descripción <span className="text-slate-500">(opcional)</span>
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ingredientes, notas especiales..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition resize-none"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría</label>
            {!showNewCat ? (
              <div className="flex gap-2">
                <select
                  value={categoriaId}
                  onChange={e => setCategoriaId(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white
                             focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => { setShowNewCat(true); setNuevaCat('') }}
                  className="px-3 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition whitespace-nowrap">
                  + Nueva
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={nuevaCat}
                  onChange={e => setNuevaCat(e.target.value)}
                  placeholder="Nombre de categoría..."
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-orange-500 text-white
                             placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                />
                <button type="button" onClick={() => setShowNewCat(false)}
                  className="px-3 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition">
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Disponible */}
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700">
            <div>
              <p className="text-white font-medium text-sm">Disponible</p>
              <p className="text-slate-400 text-xs">Aparece en la pantalla de caja</p>
            </div>
            <button
              type="button"
              onClick={() => setDisponible(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200
                ${disponible ? 'bg-orange-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                ${disponible ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Foto / Emoji */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Imagen del producto
            </label>

            {imagePreview ? (
              <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-3 border border-slate-700">
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                <button type="button" onClick={removeImage}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-400 rounded-full
                             flex items-center justify-center text-white text-xs transition">
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-32 h-32 rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 mb-3">
                <span className="text-5xl">{emoji}</span>
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id="foto-input" />
            <div className="flex gap-2 mb-3">
              <label htmlFor="foto-input"
                className="cursor-pointer px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition">
                📷 Subir foto
              </label>
              {imagePreview && (
                <button type="button" onClick={removeImage}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-red-500/20 text-red-400 text-sm font-medium transition">
                  Quitar foto
                </button>
              )}
            </div>

            {!imagePreview && (
              <div>
                <p className="text-slate-500 text-xs mb-2">O elige un emoji:</p>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} type="button" onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl transition
                        ${emoji === e
                          ? 'bg-orange-500/20 border-2 border-orange-500'
                          : 'bg-slate-800 border border-slate-700 hover:border-slate-500'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2 pb-8">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition
                         disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</>
                : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function Menu() {
  const [products,   setProducts]  = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState('')

  // Filtros — filterCat es un id de categoría o 'Todos'
  const [search,    setSearch]    = useState('')
  const [filterCat, setFilterCat] = useState('Todos')

  // Formulario
  const [formView,   setFormView]  = useState(null) // null | 'new' | product object

  // Confirmar eliminación
  const [delConfirm, setDelConfirm] = useState(null)
  const [deleting,   setDeleting]   = useState(false)

  // ── Carga de datos ─────────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true)
    setError('')
    try {
      // 1. Cargar categorías
      let { data: catData, error: catErr } = await supabase
        .from('categories')
        .select('id, name')
        .eq('business_id', BUSINESS_ID)
        .order('name')

      if (catErr) throw catErr

      // Si no hay categorías, insertar las 4 por defecto
      if (!catData || catData.length === 0) {
        const defaults = DEFAULT_CATEGORIES.map(name => ({ name, business_id: BUSINESS_ID }))
        const { data: inserted, error: insertErr } = await supabase
          .from('categories')
          .insert(defaults)
          .select('id, name')
        if (insertErr) {
          console.error('Error al insertar categorías por defecto:', insertErr)
          throw insertErr
        }
        catData = inserted ?? []
      }

      setCategories(catData)

      // 2. Cargar productos sin JOIN
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', BUSINESS_ID)
        .order('name')

      if (prodErr) throw prodErr
      setProducts(Array.isArray(prodData) ? prodData : [])

    } catch (err) {
      console.error('fetchAll error:', err)
      setError(err.message ?? 'Error al cargar los productos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // ── Toggle disponibilidad ─────────────────────────────────────────────────
  async function toggleAvailable(product) {
    const newVal = !product.is_available
    setProducts(prev => prev.map(p =>
      p.id === product.id ? { ...p, is_available: newVal } : p
    ))
    try {
      const { error: err } = await supabase
        .from('products')
        .update({ is_available: newVal })
        .eq('id', product.id)
      if (err) throw err
    } catch {
      // Revertir cambio optimista
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, is_available: product.is_available } : p
      ))
      setError('No se pudo cambiar la disponibilidad.')
    }
  }

  // ── Eliminación ───────────────────────────────────────────────────────────
  async function deleteProduct(id) {
    setDeleting(true)
    try {
      const { error: err } = await supabase.from('products').delete().eq('id', id)
      if (err) throw err
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error al eliminar producto:', err)
      setError('No se pudo eliminar el producto: ' + (err.message ?? ''))
    } finally {
      setDelConfirm(null)
      setDeleting(false)
    }
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = products.filter(p => {
    const matchSearch = !search || (p.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'Todos' || p.category_id === filterCat
    return matchSearch && matchCat
  })

  // ── Vista: formulario ─────────────────────────────────────────────────────
  if (formView !== null) {
    return (
      <ErrorBoundary>
        <ProductForm
          product={formView === 'new' ? null : formView}
          categories={categories}
          onSave={() => { setFormView(null); fetchAll() }}
          onCancel={() => setFormView(null)}
        />
      </ErrorBoundary>
    )
  }

  // ── Vista: lista ──────────────────────────────────────────────────────────
  const filterOptions = [{ id: 'Todos', name: 'Todas las categorías' }, ...categories]

  return (
    <ErrorBoundary>
      <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌮</span>
            <span className="text-white font-extrabold text-xl tracking-tight">
              Taquero<span className="text-orange-500">POS</span>
            </span>
          </div>
          <h2 className="text-white font-bold text-base absolute left-1/2 -translate-x-1/2 hidden sm:block">
            Gestor de Menú
          </h2>
          <NavMenu />
        </header>

        {/* ── BARRA DE ACCIONES ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setFormView('new')}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400
                       text-white text-sm font-semibold transition"
          >
            <span className="text-lg leading-none">+</span> Agregar producto
          </button>

          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
          >
            {filterOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm
                           placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
              />
            </div>
          </div>
        </div>

        {/* ── CONTENIDO ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between">
              {error}
              <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-200 ml-4">✕</button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">🌮</div>
              <p className="text-slate-400 font-medium">
                {products.length === 0
                  ? 'No hay productos todavía'
                  : 'No hay productos que coincidan con la búsqueda'}
              </p>
              {products.length === 0 && (
                <button type="button" onClick={() => setFormView('new')}
                  className="mt-4 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-semibold transition text-sm">
                  + Agregar el primer producto
                </button>
              )}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(product => (
                <div
                  key={product.id}
                  className={`relative flex flex-col rounded-2xl border overflow-hidden transition
                    ${product.is_available
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-800/50 border-slate-700/50 opacity-60'}`}
                >
                  {/* Imagen o emoji */}
                  <div className="relative h-28 bg-slate-700/50 flex items-center justify-center shrink-0">
                    {product.image_url?.startsWith('http') ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ) : (
                      <span className="text-5xl">{product.image_url || '🌮'}</span>
                    )}

                    {!product.is_available && (
                      <div className="absolute top-2 left-2 bg-slate-900/80 text-slate-400 text-xs px-2 py-0.5 rounded-full font-medium">
                        No disponible
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleAvailable(product)}
                      title={product.is_available ? 'Desactivar' : 'Activar'}
                      className={`absolute top-2 right-2 w-10 h-5 rounded-full transition-colors duration-200
                        ${product.is_available ? 'bg-orange-500' : 'bg-slate-600'}`}
                    >
                      <span className={`block w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform duration-200
                        ${product.is_available ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 p-3 gap-1">
                    <p className="text-white text-sm font-semibold leading-tight line-clamp-2">
                      {product.name}
                    </p>
                    {product.description && (
                      <p className="text-slate-500 text-xs line-clamp-1">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span className="text-orange-400 font-bold text-sm">{fmt(product.price)}</span>
                      <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                        {categories.find(c => c.id === product.category_id)?.name ?? '—'}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex border-t border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => setFormView(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-slate-400
                                 hover:text-white hover:bg-slate-700/50 transition text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar
                    </button>
                    <div className="w-px bg-slate-700/50" />
                    <button
                      type="button"
                      onClick={() => setDelConfirm(product.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-slate-500
                                 hover:text-red-400 hover:bg-red-500/10 transition text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── MODAL CONFIRMAR ELIMINACIÓN ──────────────────────────────────── */}
        {delConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6">
              <div className="text-4xl text-center mb-3">🗑️</div>
              <h3 className="text-white font-bold text-center text-lg mb-1">¿Eliminar producto?</h3>
              <p className="text-slate-400 text-sm text-center mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDelConfirm(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition">
                  Cancelar
                </button>
                <button type="button" onClick={() => deleteProduct(delConfirm)} disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold transition
                             disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {deleting
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
