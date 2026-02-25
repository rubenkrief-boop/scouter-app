'use client'

import { useState, useRef } from 'react'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface AvatarUploadProps {
  userId: string
  firstName: string
  lastName: string
  currentAvatarUrl: string | null
  /** Large size for profile header (default), small for cards */
  size?: 'lg' | 'sm'
  /** Whether the current user can edit this avatar */
  canEdit?: boolean
}

export function AvatarUpload({
  userId,
  firstName,
  lastName,
  currentAvatarUrl,
  size = 'lg',
  canEdit = true,
}: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`

  const sizeClasses = size === 'lg'
    ? 'w-16 h-16 text-2xl'
    : 'w-11 h-11 text-sm'

  const iconSize = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'

  async function handleFileSelect(file: File) {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Type de fichier non supporté. Utilisez PNG, JPG ou WebP.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 2 Mo).')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'upload')
        return
      }

      // Cache-busting
      setAvatarUrl(data.avatarUrl + '?t=' + Date.now())
      toast.success('Photo mise à jour')
    } catch {
      toast.error('Erreur réseau lors de l\'upload')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete() {
    setIsUploading(true)
    try {
      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
        return
      }

      setAvatarUrl(null)
      toast.success('Photo supprimée')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setIsUploading(false)
    }
  }

  function handleClick() {
    if (canEdit && !isUploading) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className="relative group">
      {/* Avatar circle */}
      <div
        onClick={handleClick}
        className={`${sizeClasses} rounded-full overflow-hidden flex items-center justify-center font-bold relative ${
          canEdit ? 'cursor-pointer' : ''
        } ${
          avatarUrl
            ? ''
            : size === 'lg'
            ? 'bg-white/20 backdrop-blur text-white'
            : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
        }`}
      >
        {isUploading ? (
          <Loader2 className={`${iconSize} animate-spin ${size === 'lg' ? 'text-white' : 'text-indigo-500'}`} />
        ) : avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={`${firstName} ${lastName}`}
            fill
            className="object-cover"
            sizes={size === 'lg' ? '64px' : '44px'}
          />
        ) : (
          initials
        )}

        {/* Hover overlay for edit */}
        {canEdit && !isUploading && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
            <Camera className={`${iconSize} text-white`} />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      {canEdit && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
            // Reset input so same file can be re-selected
            e.target.value = ''
          }}
        />
      )}

      {/* Delete button */}
      {canEdit && avatarUrl && !isUploading && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
          className={`absolute opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md ${
            size === 'lg' ? '-bottom-0.5 -right-0.5' : '-bottom-0.5 -right-0.5'
          }`}
          title="Supprimer la photo"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
