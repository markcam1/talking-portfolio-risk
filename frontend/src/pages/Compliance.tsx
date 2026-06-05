import { useEffect, useState } from 'react';

interface Job { id: string; status: string; createdAt: string; complianceDir: string | null }
interface ManifestFile { name: string; sha256: string; size: number; createdAt: string }
interface Manifest { jobId: string; files: ManifestFile[] }

export default function Compliance() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    fetch('/api/jobs?limit=50').then(r => r.json()).then((js: Job[]) => {
      setJobs(js.filter(j => j.complianceDir));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedJob) { setManifest(null); return; }
    fetch(`/api/compliance/${selectedJob}`).then(r => r.json()).then(setManifest).catch(() => {});
  }, [selectedJob]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Compliance Bundles</h2>

      <div className="flex gap-6">
        {/* Job list */}
        <div className="w-64 bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">Jobs</div>
          {jobs.length === 0 && <p className="px-4 py-4 text-gray-400 text-sm">No compliance bundles yet</p>}
          {jobs.map(job => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job.id)}
              className={`w-full text-left px-4 py-3 border-b text-sm hover:bg-gray-50 ${selectedJob === job.id ? 'bg-indigo-50' : ''}`}
            >
              <div className="font-mono text-xs text-gray-600">{job.id.slice(0, 8)}…</div>
              <div className="text-xs text-gray-400 mt-0.5">{new Date(job.createdAt).toLocaleString()}</div>
              <div className="text-xs text-gray-500">{job.status}</div>
            </button>
          ))}
        </div>

        {/* File list */}
        <div className="flex-1">
          {!selectedJob && <p className="text-gray-400">Select a job to view its compliance bundle.</p>}
          {manifest && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                Files — Job {manifest.jobId.slice(0, 8)}…
              </div>
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">File</th>
                    <th className="px-4 py-2 text-left">Size</th>
                    <th className="px-4 py-2 text-left">SHA-256</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {manifest.files.map(f => (
                    <tr key={f.name} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{f.name}</td>
                      <td className="px-4 py-2 text-gray-500">{(f.size / 1024).toFixed(1)} KB</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-400">{f.sha256.slice(0, 12)}…</td>
                      <td className="px-4 py-2">
                        <a
                          href={`/api/compliance/${manifest.jobId}/files/${f.name}`}
                          target="_blank"
                          className="text-indigo-600 text-xs hover:underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
