import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './components/layout/AppShell'
import Home from './pages/Home'
import Upload from './pages/Upload'
import Configure from './pages/Configure'
import Results from './pages/Results'
import DisclaimerModal from './components/ui/DisclaimerModal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 }
  }
})

export default function App() {
  const [accepted, setAccepted] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      {!accepted && <DisclaimerModal onAccept={() => setAccepted(true)} />}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="upload" element={<Upload />} />
            <Route path="configure" element={<Configure />} />
            <Route path="results" element={<Results />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
