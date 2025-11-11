'use client'

import React, { useCallback, useState } from 'react'

interface DropzoneProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number // in MB
  label?: string
}

export default function Dropzone({
  onFileSelect,
  accept = '*',
  maxSize = 5,
  label = 'Drop file here or click to browse',
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateFile = useCallback((file: File) => {
    const maxBytes = maxSize * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`File size exceeds ${maxSize}MB limit`)
      return false
    }
    setError(null)
    return true
  }, [maxSize])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && validateFile(file)) {
      onFileSelect(file)
    }
  }, [onFileSelect, validateFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && validateFile(file)) {
      onFileSelect(file)
    }
  }, [onFileSelect, validateFile])

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <input
          type="file"
          id="file-input"
          className="hidden"
          accept={accept}
          onChange={handleFileInput}
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">{label}</p>
          <p className="mt-1 text-xs text-gray-500">Max file size: {maxSize}MB</p>
        </label>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

