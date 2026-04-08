'use client'

import { useState } from 'react'

export type AdminMessage = { type: 'success' | 'error'; text: string } | null

export type ShowMessageFn = (type: 'success' | 'error', text: string) => void

export function useAdminMessage() {
  const [message, setMessage] = useState<AdminMessage>(null)

  const showMessage: ShowMessageFn = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  return { message, showMessage }
}
