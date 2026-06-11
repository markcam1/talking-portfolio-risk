import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ToastContainer from '../ui/Toast'

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
