'use client'

import { useState, useRef, useEffect } from 'react'
import EmojiPickerReact, { EmojiClickData, Theme } from 'emoji-picker-react'

interface EmojiPickerFieldProps {
  value: string
  onChange: (emoji: string) => void
  name?: string
}

export function EmojiPickerField({ value, onChange, name }: EmojiPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleEmojiClick(emojiData: EmojiClickData) {
    onChange(emojiData.emoji)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Hidden input for form submission */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
      >
        {value ? (
          <span className="text-2xl">{value}</span>
        ) : (
          <span className="text-muted-foreground">Choisir...</span>
        )}
      </button>

      {/* Picker dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0" style={{ width: '350px' }}>
          <EmojiPickerReact
            onEmojiClick={handleEmojiClick}
            theme={Theme.LIGHT}
            width="100%"
            height={400}
            searchPlaceHolder="Rechercher un emoji..."
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  )
}
