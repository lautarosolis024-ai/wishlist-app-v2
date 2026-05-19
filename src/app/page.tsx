'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus, Search, Heart, ShoppingBag, User, X, ChevronDown,
  Trash2, Check, ExternalLink, RefreshCw, Ruler, StickyNote,
  ChevronRight, Package, ArrowLeft, Sparkles, TrendingDown,
  TrendingUp, Minus, Edit3, Tag, Store, Info, Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============ TYPES ============
interface WishlistItem {
  id: string
  url: string
  title: string
  price: number | null
  originalPrice: number | null
  currency: string
  brand: string | null
  store: string | null
  description: string | null
  images: string
  sizeGuide: string | null
  recommendedSize: string | null
  sizeReason: string | null
  category: string
  notes: string | null
  purchased: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

interface UserProfile {
  id: string
  chest: number | null
  waist: number | null
  hips: number | null
  shoulderWidth: number | null
  armLength: number | null
  inseam: number | null
  height: number | null
  weight: number | null
  shoeSize: number | null
  notes: string | null
}

interface SizeRecommendation {
  recommendedSize: string | null
  confidence: 'alta' | 'media' | 'baja'
  explanation: string
  alternative: string | null
}

interface ScrapeResult {
  title: string
  price: number | null
  originalPrice: number | null
  currency: string
  brand: string | null
  store: string | null
  description: string | null
  images: string[]
  sizeGuide: string | null
  category: string
  color: string | null
}

// ============ CONSTANTS ============
const CATEGORIES = [
  { value: 'all', label: 'Todas', icon: '🎯' },
  { value: 'ropa', label: 'Ropa', icon: '👕' },
  { value: 'calzado', label: 'Calzado', icon: '👟' },
  { value: 'tecnologia', label: 'Tecnología', icon: '📱' },
  { value: 'hogar', label: 'Hogar', icon: '🏠' },
  { value: 'accesorios', label: 'Accesorios', icon: '⌚' },
  { value: 'deportes', label: 'Deportes', icon: '⚽' },
  { value: 'otros', label: 'Otros', icon: '📦' },
]

const SPRING_DEFAULT = { damping: 28, stiffness: 300 }
const SPRING_GENTLE = { damping: 32, stiffness: 260 }

// ============ API HELPERS ============
async function fetchItems(params: string = '') {
  const res = await fetch(`/api/items${params}`)
  if (!res.ok) throw new Error('Error cargando items')
  return res.json() as Promise<WishlistItem[]>
}

async function fetchProfile() {
  const res = await fetch('/api/profile')
  if (!res.ok) throw new Error('Error cargando perfil')
  return res.json() as Promise<UserProfile>
}

async function scrapeUrl(url: string) {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error scrapeando URL')
  }
  return res.json() as Promise<ScrapeResult>
}

async function recommendSize(itemId: string) {
  const res = await fetch('/api/recommend-size', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error recomendando talle')
  }
  return res.json() as Promise<SizeRecommendation>
}

// ============ SPRING VARIANTS ============
const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRING_DEFAULT },
  exit: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.2 } },
}

const sheetVariants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: SPRING_GENTLE },
  exit: { y: '100%', transition: { duration: 0.25, ease: 'easeIn' } },
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

// ============ IMAGE CAROUSEL ============
function ImageCarousel({ images, title }: { images: string[]; title: string }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const scrollLeft = container.scrollLeft
    const width = container.offsetWidth
    const newIndex = Math.round(scrollLeft / width)
    if (newIndex !== currentIndex) setCurrentIndex(newIndex)
  }, [currentIndex])

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-square bg-muted/50 rounded-2xl flex items-center justify-center">
        <Package className="w-12 h-12 text-muted-foreground/40" />
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="carousel-container rounded-2xl overflow-hidden"
        onScroll={handleScroll}
      >
        {images.map((img, i) => (
          <div key={i} className="carousel-slide">
            <div className="w-full aspect-square bg-muted/30">
              <img
                src={img}
                alt={`${title} - imagen ${i + 1}`}
                className="w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentIndex(i)
                containerRef.current?.scrollTo({ left: i * containerRef.current.offsetWidth, behavior: 'smooth' })
              }}
              className={cn('carousel-dot transition-all', i === currentIndex && 'active')}
              aria-label={`Imagen ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============ BOTTOM SHEET ============
function BottomSheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-50 glass-sheet safe-bottom max-h-[92vh] overflow-y-auto momentum-scroll no-scrollbar"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="drag-handle" />
            {title && (
              <div className="px-5 pb-2 pt-1 flex items-center justify-between">
                <h3 className="text-headline text-foreground">{title}</h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center tap-scale"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}
            <div className="px-5 pb-8">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============ ADD ITEM SHEET ============
function AddItemSheet({ open, onClose, onSuccess }: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scraped, setScraped] = useState<ScrapeResult | null>(null)
  const [category, setCategory] = useState('otros')
  const [notes, setNotes] = useState('')

  const scrapeMutation = useMutation({
    mutationFn: () => scrapeUrl(url),
    onSuccess: (data) => {
      setScraped(data)
      setCategory(data.category)
      setScraping(false)
    },
    onError: (error) => {
      toast.error(error.message)
      setScraping(false)
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: scraped!.title,
          price: scraped!.price,
          originalPrice: scraped!.originalPrice,
          currency: scraped!.currency,
          brand: scraped!.brand,
          store: scraped!.store,
          description: scraped!.description,
          images: scraped!.images,
          sizeGuide: scraped!.sizeGuide,
          category,
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error('Error guardando item')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Producto agregado a tu wishlist ✨')
      resetForm()
      onClose()
      onSuccess()
    },
    onError: () => {
      toast.error('Error guardando el producto')
    },
  })

  function resetForm() {
    setUrl('')
    setScraped(null)
    setCategory('otros')
    setNotes('')
    setScraping(false)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleScrape() {
    if (!url.trim()) {
      toast.error('Pegá un link de producto')
      return
    }
    setScraping(true)
    scrapeMutation.mutate()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Agregar producto">
      {!scraped ? (
        <div className="space-y-5">
          <div>
            <label className="text-subhead text-muted-foreground block mb-2">Pegá el link del producto</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.tienda.com/producto..."
                className="flex-1 glass-input h-12 px-4 text-body bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              />
              <button
                onClick={handleScrape}
                disabled={scraping || !url.trim()}
                className="h-12 px-5 rounded-[14px] bg-primary text-primary-foreground text-headline tap-scale disabled:opacity-40 flex items-center gap-2"
              >
                {scraping ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                {scraping ? 'Scrapeando...' : 'Extraer'}
              </button>
            </div>
          </div>

          {scraping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-6 text-center space-y-3"
            >
              <RefreshCw className="w-8 h-8 mx-auto text-primary animate-spin" />
              <p className="text-subhead text-muted-foreground">
                Analizando la página y extrayendo datos del producto...
              </p>
            </motion.div>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_DEFAULT}
          className="space-y-5"
        >
          {/* Images */}
          {scraped.images.length > 0 && (
            <ImageCarousel images={scraped.images} title={scraped.title} />
          )}

          {/* Product info */}
          <div className="space-y-3">
            <h2 className="text-title-3 text-foreground">{scraped.title}</h2>

            <div className="flex items-baseline gap-2">
              {scraped.price !== null && (
                <span className="text-title-2 text-foreground">
                  ${scraped.price.toLocaleString('es-AR')}
                </span>
              )}
              {scraped.originalPrice !== null && scraped.originalPrice > (scraped.price ?? 0) && (
                <span className="text-subhead text-muted-foreground line-through">
                  ${scraped.originalPrice.toLocaleString('es-AR')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {scraped.brand && (
                <span className="glass-pill px-3 py-1 text-footnote text-foreground flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {scraped.brand}
                </span>
              )}
              {scraped.store && (
                <span className="glass-pill px-3 py-1 text-footnote text-foreground flex items-center gap-1">
                  <Store className="w-3 h-3" /> {scraped.store}
                </span>
              )}
              {scraped.color && (
                <span className="glass-pill px-3 py-1 text-footnote text-foreground">
                  {scraped.color}
                </span>
              )}
            </div>

            {scraped.description && (
              <p className="text-subhead text-muted-foreground line-clamp-3">{scraped.description}</p>
            )}
          </div>

          {/* Category picker */}
          <div>
            <label className="text-subhead text-muted-foreground block mb-2">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter(c => c.value !== 'all').map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'glass-pill px-3 py-1.5 text-footnote tap-scale transition-all',
                    category === cat.value
                      ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                      : 'text-foreground'
                  )}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-subhead text-muted-foreground block mb-2">Notas personales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Quiero en negro, talle M..."
              className="w-full glass-input min-h-[80px] px-4 py-3 text-body bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Save button */}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full h-14 rounded-[14px] bg-primary text-primary-foreground text-headline tap-scale disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Heart className="w-5 h-5" />
            )}
            {saveMutation.isPending ? 'Guardando...' : 'Agregar a wishlist'}
          </button>
        </motion.div>
      )}
    </BottomSheet>
  )
}

// ============ PROFILE SHEET ============
function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    enabled: open,
  })

  const profileToForm = (p: UserProfile | null | undefined) => ({
    chest: p?.chest?.toString() || '',
    waist: p?.waist?.toString() || '',
    hips: p?.hips?.toString() || '',
    shoulderWidth: p?.shoulderWidth?.toString() || '',
    armLength: p?.armLength?.toString() || '',
    inseam: p?.inseam?.toString() || '',
    height: p?.height?.toString() || '',
    weight: p?.weight?.toString() || '',
    shoeSize: p?.shoeSize?.toString() || '',
    notes: p?.notes || '',
  })

  const [form, setForm] = useState<Record<string, string>>(profileToForm(null))
  const [formTouched, setFormTouched] = useState(false)

  // Sync profile data to form on first load
  if (profile && !formTouched) {
    const newForm = profileToForm(profile)
    const isDifferent = Object.keys(newForm).some(k => newForm[k] !== form[k])
    if (isDifferent) {
      setForm(newForm)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data: Record<string, number | string | null> = {}
      const numericFields = ['chest', 'waist', 'hips', 'shoulderWidth', 'armLength', 'inseam', 'height', 'weight', 'shoeSize']
      for (const field of numericFields) {
        const val = form[field]
        data[field] = val ? parseFloat(val) : null
      }
      data.notes = form.notes || null

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error guardando perfil')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Medidas guardadas ✨')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      onClose()
    },
    onError: () => {
      toast.error('Error guardando las medidas')
    },
  })

  const measurementFields = [
    { key: 'chest', label: 'Pecho', unit: 'cm' },
    { key: 'waist', label: 'Cintura', unit: 'cm' },
    { key: 'hips', label: 'Cadera', unit: 'cm' },
    { key: 'shoulderWidth', label: 'Hombros', unit: 'cm' },
    { key: 'armLength', label: 'Brazo', unit: 'cm' },
    { key: 'inseam', label: 'Tiro', unit: 'cm' },
    { key: 'height', label: 'Altura', unit: 'cm' },
    { key: 'weight', label: 'Peso', unit: 'kg' },
    { key: 'shoeSize', label: 'Pie', unit: '' },
  ]

  const hasMeasurements = Object.values(form).some(v => v.trim() !== '' && v !== form.notes)

  if (isLoading) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Mis medidas">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Mis medidas">
      <div className="space-y-5">
        <p className="text-subhead text-muted-foreground">
          Cargá tus medidas para recibir recomendaciones de talle basadas en la guía oficial de cada producto.
        </p>

        {/* Grouped inset list */}
        <div className="bg-muted/25 rounded-[16px] overflow-hidden">
          {measurementFields.map((field, i) => (
            <div
              key={field.key}
              className={cn(
                'flex items-center justify-between px-4 min-h-[50px]',
                i > 0 && 'apple-separator'
              )}
            >
              <span className="text-body text-foreground">{field.label}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={form[field.key]}
                  onChange={(e) => { setFormTouched(true); setForm(prev => ({ ...prev, [field.key]: e.target.value })) }}
                  placeholder="—"
                  className="w-20 text-right text-body bg-transparent text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                />
                {field.unit && (
                  <span className="text-footnote text-muted-foreground w-6">{field.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className="text-subhead text-muted-foreground block mb-2">Notas</label>
          <textarea
            value={form.notes}
            onChange={(e) => { setFormTouched(true); setForm(prev => ({ ...prev, notes: e.target.value })) }}
            placeholder="Ej: Suelo usar talle M en Zara, L en Nike..."
            className="w-full glass-input min-h-[70px] px-4 py-3 text-body bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full h-14 rounded-[14px] bg-primary text-primary-foreground text-headline tap-scale disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saveMutation.isPending ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          {saveMutation.isPending ? 'Guardando...' : 'Guardar medidas'}
        </button>
      </div>
    </BottomSheet>
  )
}

// ============ ITEM DETAIL SHEET ============
function ItemDetailSheet({ item, open, onClose }: {
  item: WishlistItem | null
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [showSizeRec, setShowSizeRec] = useState(false)
  const [sizeRec, setSizeRec] = useState<SizeRecommendation | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [noteText, setNoteText] = useState('')

  const images: string[] = item ? (() => {
    try { return JSON.parse(item.images) } catch { return [] }
  })() : []

  const sizeReason: SizeRecommendation | null = item?.sizeReason
    ? (() => { try { return JSON.parse(item.sizeReason) } catch { return null } })()
    : null

  const recommendMutation = useMutation({
    mutationFn: () => recommendSize(item!.id),
    onSuccess: (data) => {
      setSizeRec(data)
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const togglePurchased = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/items/${item!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchased: !item!.purchased }),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(item!.purchased ? 'Movido a wishlist' : 'Marcado como comprado ✓')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/items/${item!.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success('Producto eliminado')
      onClose()
    },
  })

  const updateNotes = useMutation({
    mutationFn: async (notes: string) => {
      const res = await fetch(`/api/items/${item!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setEditingNotes(false)
      toast.success('Nota guardada')
    },
  })

  const rescrapeMutation = useMutation({
    mutationFn: async () => {
      const scraped = await scrapeUrl(item!.url)
      const res = await fetch(`/api/items/${item!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: scraped.price,
          originalPrice: scraped.originalPrice,
          images: scraped.images,
          title: scraped.title,
        }),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success('Producto actualizado')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  if (!item) return null

  const priceChange = item.originalPrice && item.price
    ? item.originalPrice - item.price
    : null

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-5">
        {/* Images */}
        <ImageCarousel images={images} title={item.title} />

        {/* Title & Price */}
        <div className="space-y-2">
          <h2 className="text-title-2 text-foreground">{item.title}</h2>
          <div className="flex items-baseline gap-2 flex-wrap">
            {item.price !== null && (
              <span className="text-title-2 text-foreground">
                ${item.price.toLocaleString('es-AR')}
              </span>
            )}
            {item.originalPrice !== null && item.originalPrice > (item.price ?? 0) && (
              <>
                <span className="text-subhead text-muted-foreground line-through">
                  ${item.originalPrice.toLocaleString('es-AR')}
                </span>
                {priceChange !== null && priceChange > 0 && (
                  <span className="text-footnote font-semibold price-down flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" /> -${priceChange.toLocaleString('es-AR')}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {item.brand && (
              <span className="glass-pill px-3 py-1 text-footnote flex items-center gap-1">
                <Tag className="w-3 h-3" /> {item.brand}
              </span>
            )}
            {item.store && (
              <span className="glass-pill px-3 py-1 text-footnote flex items-center gap-1">
                <Store className="w-3 h-3" /> {item.store}
              </span>
            )}
            <span className="glass-pill px-3 py-1 text-footnote">
              {CATEGORIES.find(c => c.value === item.category)?.icon}{' '}
              {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
            </span>
          </div>
        </div>

        {/* Description */}
        {item.description && (
          <div className="space-y-1">
            <h4 className="text-footnote text-muted-foreground uppercase tracking-wider">Descripción</h4>
            <p className="text-subhead text-foreground">{item.description}</p>
          </div>
        )}

        {/* Size recommendation */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if (!showSizeRec) {
                if (!sizeRec && !sizeReason) {
                  recommendMutation.mutate()
                }
                setShowSizeRec(true)
              } else {
                setShowSizeRec(false)
              }
            }}
            className="w-full glass-card glass-shimmer p-4 flex items-center justify-between tap-scale"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Ruler className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-headline text-foreground">Recomendación de talle</p>
                <p className="text-footnote text-muted-foreground">
                  {(item.recommendedSize || sizeRec?.recommendedSize)
                    ? `Talle sugerido: ${sizeRec?.recommendedSize || item.recommendedSize}`
                    : 'Basado en tus medidas y la guía del producto'}
                </p>
              </div>
            </div>
            <ChevronRight className={cn(
              'w-5 h-5 text-muted-foreground transition-transform',
              showSizeRec && 'rotate-90'
            )} />
          </button>

          <AnimatePresence>
            {showSizeRec && (recommendMutation.isPending || sizeRec || sizeReason) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SPRING_DEFAULT}
                className="overflow-hidden"
              >
                <div className="glass-card p-4 space-y-3">
                  {recommendMutation.isPending ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                      <span className="ml-2 text-subhead text-muted-foreground">Analizando guía de talles...</span>
                    </div>
                  ) : (
                    <>
                      {(sizeRec || sizeReason) && (
                        <>
                          <div className="flex items-center gap-3">
                            {(sizeRec || sizeReason)?.recommendedSize && (
                              <span className="text-title-1 text-primary">
                                {(sizeRec || sizeReason)?.recommendedSize}
                              </span>
                            )}
                            <span className={cn(
                              'glass-pill px-3 py-1 text-footnote font-semibold',
                              (sizeRec || sizeReason)?.confidence === 'alta'
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                : (sizeRec || sizeReason)?.confidence === 'media'
                                ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                                : 'bg-red-500/10 text-red-700 dark:text-red-400'
                            )}>
                              Confianza {(sizeRec || sizeReason)?.confidence}
                            </span>
                          </div>
                          <p className="text-subhead text-foreground">
                            {(sizeRec || sizeReason)?.explanation}
                          </p>
                          {(sizeRec || sizeReason)?.alternative && (
                            <p className="text-footnote text-muted-foreground">
                              Alternativa: {(sizeRec || sizeReason)?.alternative}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <button
            onClick={() => {
              setNoteText(item.notes || '')
              setEditingNotes(!editingNotes)
            }}
            className="w-full glass-card p-4 flex items-center justify-between tap-scale"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <StickyNote className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-headline text-foreground">Notas</p>
                {item.notes ? (
                  <p className="text-footnote text-muted-foreground line-clamp-1">{item.notes}</p>
                ) : (
                  <p className="text-footnote text-muted-foreground">Tocá para agregar notas</p>
                )}
              </div>
            </div>
            <Edit3 className="w-4 h-4 text-muted-foreground" />
          </button>

          <AnimatePresence>
            {editingNotes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SPRING_DEFAULT}
                className="overflow-hidden"
              >
                <div className="glass-card p-4 space-y-3">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ej: Quiero en negro, esperar descuento..."
                    className="w-full glass-input min-h-[80px] px-4 py-3 text-body bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <button
                    onClick={() => updateNotes.mutate(noteText)}
                    disabled={updateNotes.isPending}
                    className="w-full h-11 rounded-[14px] bg-primary text-primary-foreground text-headline tap-scale disabled:opacity-40"
                  >
                    Guardar nota
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Open URL */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full glass-card p-4 flex items-center justify-between tap-scale block"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <p className="text-headline text-foreground">Ver en la tienda</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </a>

          {/* Rescrape */}
          <button
            onClick={() => rescrapeMutation.mutate()}
            disabled={rescrapeMutation.isPending}
            className="w-full glass-card p-4 flex items-center justify-between tap-scale"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <RefreshCw className={cn('w-5 h-5 text-primary', rescrapeMutation.isPending && 'animate-spin')} />
              </div>
              <div className="text-left">
                <p className="text-headline text-foreground">Actualizar precio</p>
                <p className="text-footnote text-muted-foreground">Re-scrapea para ver si cambió el precio</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Price change indicator */}
          {priceChange !== null && priceChange !== 0 && (
            <div className={cn(
              'glass-pill px-4 py-2 flex items-center gap-2 text-footnote',
              priceChange > 0 ? 'price-down' : 'price-up'
            )}>
              {priceChange > 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              {priceChange > 0
                ? `Bajó $${priceChange.toLocaleString('es-AR')} desde que lo agregaste`
                : `Subió $${Math.abs(priceChange).toLocaleString('es-AR')} desde que lo agregaste`
              }
            </div>
          )}

          {/* Mark purchased */}
          <button
            onClick={() => togglePurchased.mutate()}
            disabled={togglePurchased.isPending}
            className={cn(
              'w-full glass-card p-4 flex items-center justify-between tap-scale',
              item.purchased && 'border-success/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                item.purchased ? 'bg-success/15' : 'bg-primary/10'
              )}>
                <ShoppingBag className={cn('w-5 h-5', item.purchased ? 'text-success' : 'text-primary')} />
              </div>
              <p className="text-headline text-foreground">
                {item.purchased ? 'Marcar como pendiente' : 'Marcar como comprado'}
              </p>
            </div>
            {item.purchased && <Check className="w-5 h-5 text-success" />}
          </button>

          {/* Delete */}
          <button
            onClick={() => {
              if (confirm('¿Eliminar este producto de tu wishlist?')) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
            className="w-full glass-card p-4 flex items-center justify-between tap-scale"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-headline text-destructive">Eliminar</p>
            </div>
            <ChevronRight className="w-5 h-5 text-destructive/50" />
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ============ WISHLIST ITEM CARD ============
function WishlistItemCard({ item, onClick }: { item: WishlistItem; onClick: () => void }) {
  const images: string[] = (() => {
    try { return JSON.parse(item.images) } catch { return [] }
  })()

  const priceChange = item.originalPrice && item.price
    ? item.originalPrice - item.price
    : null

  return (
    <motion.button
      variants={cardVariants}
      layout
      onClick={onClick}
      className="w-full glass-card glass-shimmer p-3 tap-scale text-left"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-[12px] bg-muted/40 overflow-hidden flex-shrink-0">
          {images[0] ? (
            <img
              src={images[0]}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-headline text-foreground truncate">{item.title}</h3>

          <div className="flex items-baseline gap-2">
            {item.price !== null && (
              <span className="text-headline text-foreground">
                ${item.price.toLocaleString('es-AR')}
              </span>
            )}
            {item.originalPrice !== null && item.originalPrice > (item.price ?? 0) && (
              <span className="text-caption text-muted-foreground line-through">
                ${item.originalPrice.toLocaleString('es-AR')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {item.brand && (
              <span className="text-caption text-muted-foreground">{item.brand}</span>
            )}
            {item.store && (
              <span className="text-caption text-muted-foreground flex items-center gap-0.5">
                <Store className="w-3 h-3" />{item.store}
              </span>
            )}
            {item.recommendedSize && (
              <span className="glass-pill px-2 py-0.5 text-caption-2 text-primary font-semibold">
                {item.recommendedSize}
              </span>
            )}
            {priceChange !== null && priceChange > 0 && (
              <span className="text-caption-2 price-down flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" />-${priceChange.toLocaleString('es-AR')}
              </span>
            )}
            {item.purchased && (
              <span className="glass-pill px-2 py-0.5 text-caption-2 text-success font-semibold flex items-center gap-0.5">
                <Check className="w-3 h-3" />Comprado
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  )
}

// ============ EMPTY STATE ============
function EmptyState({ type }: { type: 'wishlist' | 'purchased' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_GENTLE}
      className="flex flex-col items-center justify-center py-16 px-8"
    >
      <div className="glass-card p-8 flex flex-col items-center text-center space-y-4 w-full max-w-sm">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          {type === 'wishlist' ? (
            <Heart className="w-10 h-10 text-primary" />
          ) : (
            <ShoppingBag className="w-10 h-10 text-primary" />
          )}
        </div>
        <h3 className="text-title-3 text-foreground">
          {type === 'wishlist' ? 'Tu wishlist está vacía' : 'No hay productos comprados'}
        </h3>
        <p className="text-subhead text-muted-foreground">
          {type === 'wishlist'
            ? 'Pegá el link de un producto y la app arma todo sola. Probá con cualquier tienda argentina.'
            : 'Cuando marques productos como comprados, aparecen acá.'}
        </p>
      </div>
    </motion.div>
  )
}

// ============ MAIN APP ============
export default function WishListApp() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'wishlist' | 'purchased'>('wishlist')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showProfileSheet, setShowProfileSheet] = useState(false)
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', activeTab, searchQuery, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams()
      if (activeTab === 'purchased') params.set('purchased', 'true')
      else params.set('purchased', 'false')
      if (searchQuery) params.set('search', searchQuery)
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      return fetchItems(`?${params.toString()}`)
    },
  })

  // Fetch profile for badge
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  })

  const hasMeasurements = !!(
    profile?.chest || profile?.waist || profile?.hips ||
    profile?.shoeSize || profile?.height
  )

  // Scroll handler for header collapse
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      setHeaderCollapsed(el.scrollTop > 30)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const handleItemSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['items'] })
  }, [queryClient])

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* ====== HEADER ====== */}
      <motion.header
        className={cn(
          'sticky top-0 z-30 px-4 safe-top transition-all duration-300',
          headerCollapsed
            ? 'bg-background/80 backdrop-blur-xl border-b border-border/50'
            : 'bg-transparent'
        )}
      >
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3 min-w-0">
            <motion.h1
              className={cn(
                'text-foreground truncate transition-all duration-300',
                headerCollapsed ? 'text-headline' : 'text-large-title'
              )}
              layout
            >
              Wishlist
            </motion.h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Profile button */}
            <button
              onClick={() => setShowProfileSheet(true)}
              className="relative w-10 h-10 rounded-full glass-card flex items-center justify-center tap-scale"
            >
              <User className="w-5 h-5 text-foreground" />
              {hasMeasurements && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
              )}
            </button>

            {/* Add button */}
            <button
              onClick={() => setShowAddSheet(true)}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center tap-scale"
            >
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>
      </motion.header>

      {/* ====== SEARCH BAR ====== */}
      <div className="px-4 pb-3">
        <div className="glass-pill flex items-center gap-2 px-4 h-11">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, marca o tienda..."
            className="flex-1 bg-transparent text-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="tap-scale">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ====== CATEGORY PILLS ====== */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar momentum-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={cn(
                'glass-pill px-3 py-1.5 text-footnote whitespace-nowrap tap-scale transition-all flex-shrink-0',
                selectedCategory === cat.value
                  ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                  : 'text-foreground'
              )}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====== CONTENT ====== */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto momentum-scroll no-scrollbar px-4"
      >
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-3 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-[12px] bg-muted/40" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted/40 rounded w-3/4" />
                    <div className="h-4 bg-muted/40 rounded w-1/2" />
                    <div className="h-3 bg-muted/40 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState type={activeTab} />
        ) : (
          <motion.div
            className="space-y-3 pb-28"
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <WishlistItemCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ====== FLOATING TAB BAR ====== */}
      <div className="fixed bottom-4 inset-x-4 z-30 safe-bottom">
        <div className="glass-tab-bar px-2 py-2 flex items-center justify-around max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('wishlist')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[20px] tap-scale transition-all',
              activeTab === 'wishlist'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Heart className={cn('w-5 h-5', activeTab === 'wishlist' && 'fill-primary')} />
            <span className={cn(
              'transition-all',
              activeTab === 'wishlist' ? 'text-headline' : 'text-subhead'
            )}>
              Wishlist
            </span>
          </button>
          <button
            onClick={() => setActiveTab('purchased')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[20px] tap-scale transition-all',
              activeTab === 'purchased'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground'
            )}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className={cn(
              'transition-all',
              activeTab === 'purchased' ? 'text-headline' : 'text-subhead'
            )}>
              Compradas
            </span>
          </button>
        </div>
      </div>

      {/* ====== SHEETS ====== */}
      <AddItemSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSuccess={handleItemSaved}
      />

      <ProfileSheet
        open={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
      />

      <ItemDetailSheet
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}
