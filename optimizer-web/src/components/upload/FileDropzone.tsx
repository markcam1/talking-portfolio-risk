import React, { useRef, useState } from 'react'

interface FileDropzoneProps {
  onFile: (content: string, filename: string) => void
}

export default function FileDropzone({ onFile }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      onFile(content, file.name)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) readFile(file)
  }

  const handleNativeDialog = () => {
    inputRef.current?.click()
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={handleNativeDialog}
      className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-colors ${
        dragging
          ? 'border-brand-400 bg-brand-500/10'
          : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center">
        <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-200">Drop your portfolio CSV here</p>
        <p className="text-xs text-slate-500 mt-1">or click to browse files</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
        }}
      />
    </div>
  )
}
