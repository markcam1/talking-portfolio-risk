import { useState } from 'react'
import Button from './Button'

interface DisclaimerModalProps {
  onAccept: () => void
}

export default function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg mx-4 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-amber-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-slate-100">Important Disclaimer</h2>
          </div>
          <p className="text-xs text-slate-400 ml-9">Please read carefully before continuing</p>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-4 overflow-y-auto text-sm text-slate-300 space-y-4 leading-relaxed">
          <p>
            <span className="font-semibold text-amber-400">For Educational &amp; Research Purposes Only.</span>{' '}
            This application is a personal learning tool built on open-source quantitative finance
            libraries. It is not a licensed financial product, brokerage service, or investment
            advisory platform.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-slate-200">By using this tool you acknowledge that:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Nothing produced by this application constitutes financial, investment, tax, or legal advice of any kind.',
                'Optimization results are purely mathematical outputs of statistical models. They do not account for your personal financial situation, risk tolerance, tax obligations, or investment objectives.',
                'Past performance and historical data used as model inputs are not indicative of future results. All investments carry risk, including the possible loss of principal.',
                'Portfolio optimization models rely on assumptions (normality of returns, stable covariances, etc.) that frequently break down in real markets. Results may be unreliable, misleading, or completely wrong.',
                'You are solely responsible for any financial decisions you make. The developer(s) of this application accept no liability whatsoever for losses or damages arising from its use.',
                'This software is provided "as is" without warranty of any kind, express or implied.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-brand-400">›</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-400 border-t border-slate-700 pt-3">
            If you are seeking personalized investment advice, please consult a licensed financial
            advisor or registered investment adviser (RIA) in your jurisdiction.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-slate-700 shrink-0 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-700 accent-brand-500 cursor-pointer"
            />
            <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors select-none">
              I have read and understood the above disclaimer. I agree to use this tool for
              educational and research purposes only.
            </span>
          </label>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!checked}
            onClick={onAccept}
          >
            Continue to Application
          </Button>
        </div>

      </div>
    </div>
  )
}
