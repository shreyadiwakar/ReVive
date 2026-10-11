import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID?.() || String(Date.now())
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const value = useMemo(() => ({ push, success: (m) => push(m, 'success'), error: (m) => push(m, 'error') }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg border ${
              t.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-white border-emerald-200 text-charcoal'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="text-charcoal/50 hover:text-charcoal" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
