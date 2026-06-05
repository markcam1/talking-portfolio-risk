import { useEffect, useState } from 'react';

interface HealthStatus {
  orchestrator: string;
  optimizer: string;
  callAgent: string;
  mockMode: boolean;
}

interface Job {
  id: string;
  phoneE164: string;
  status: string;
  trigger: string;
  createdAt: string;
  blockReason?: string;
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  optimizing: 'bg-blue-100 text-blue-700',
  gated: 'bg-yellow-100 text-yellow-700',
  dialing: 'bg-orange-100 text-orange-700',
  in_call: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  voicemail: 'bg-teal-100 text-teal-700',
  blocked: 'bg-red-100 text-red-700',
  failed: 'bg-red-200 text-red-800',
  pending_approval: 'bg-yellow-200 text-yellow-800',
};

export default function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {});
    fetch('/api/jobs?limit=20').then(r => r.json()).then(setJobs).catch(() => {});
  }, []);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* Health panel */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Orchestrator', value: health?.orchestrator },
          { label: 'Optimizer', value: health?.optimizer },
          { label: 'Call Agent', value: health?.callAgent },
          { label: 'Mock Mode', value: health?.mockMode ? 'on' : 'off' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-sm font-semibold ${value === 'ok' || value === 'on' ? 'text-green-600' : value === 'off' ? 'text-gray-500' : 'text-red-500'}`}>
              {value ?? '…'}
            </p>
          </div>
        ))}
      </div>

      {/* Quick-start button */}
      <div className="mb-8">
        <a href="/run" className="inline-block bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          + New Talking Portfolio Run
        </a>
      </div>

      {/* Recent jobs */}
      <h3 className="text-lg font-semibold mb-3">Recent Jobs</h3>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Job ID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Trigger</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No jobs yet</td></tr>
            )}
            {jobs.map(job => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{job.id.slice(0, 8)}…</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {job.status}
                  </span>
                  {job.blockReason && <span className="ml-2 text-xs text-red-500">({job.blockReason})</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{job.trigger}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(job.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
