import React, { useState, useRef } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 w-56 px-3 py-2 text-xs text-slate-200 bg-slate-900 border border-slate-600 rounded-lg shadow-xl pointer-events-none animate-fade-in ${posClasses[position]}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}

/** Small info icon that shows a tooltip on hover */
export function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip content={content}>
      <span className="inline-flex items-center justify-center w-4 h-4 ml-1 text-slate-500 hover:text-slate-300 cursor-help">
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm1-11H7v2h2V5zm0 4H7v4h2V9z" clipRule="evenodd" />
        </svg>
      </span>
    </Tooltip>
  )
}
