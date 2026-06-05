import { useEffect, useRef, useState } from 'react';

interface Portfolio { id: string; name: string }
interface Contact { id: string; name: string; phoneNumbers: Array<{ phone_e164: string; label: string }> }
interface Profile { id: string; entityName: string; isDefault: boolean }

interface TranscriptLine { role: string; text: string }

export default function RunKickoff() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [portfolioId, setPortfolioId] = useState('');
  const [contactId, setContactId] = useState('');
  const [phone, setPhone] = useState('');
  const [profileId, setProfileId] = useState('');
  const [modeHint, setModeHint] = useState<'summary' | 'detail'>('summary');
  const [error, setError] = useState('');

  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch('/api/portfolios').then(r => r.json()).then(setPortfolios).catch(() => {});
    fetch('/api/contacts').then(r => r.json()).then(setContacts).catch(() => {});
    fetch('/api/caller-profiles').then(r => r.json()).then((ps: Profile[]) => {
      setProfiles(ps);
      const def = ps.find(p => p.isDefault);
      if (def) setProfileId(def.id);
    }).catch(() => {});
  }, []);

  // When contact changes, auto-fill primary phone
  useEffect(() => {
    const c = contacts.find(c => c.id === contactId);
    if (c) {
      const primary = c.phoneNumbers.find(p => p.label === 'mobile') ?? c.phoneNumbers[0];
      if (primary) setPhone(primary.phone_e164);
    }
  }, [contactId, contacts]);

  const launch = async () => {
    setError(''); setStatus('queued'); setTranscript([]);

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        savedPortfolioId: portfolioId || undefined,
        contactId: contactId || undefined,
        phoneE164: phone,
        callerProfileId: profileId || undefined,
        modeHint,
        trigger: 'manual',
      }),
    });
    if (!res.ok) { const t = await res.text(); setError(t); setStatus(''); return; }
    const job = await res.json();
    setJobId(job.id);

    // Connect WebSocket for live updates
    const ws = new WebSocket(`ws://${window.location.host}/ws/jobs/${job.id}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === 'transcript') {
        setTranscript(prev => [...prev, { role: msg.role, text: msg.text }]);
      } else if (msg.event === 'status') {
        setStatus(msg.status ?? '');
        if (msg.status === 'blocked') setBlockReason(msg.reason ?? '');
      }
    };
    ws.onerror = () => setError('WebSocket error');
    ws.onclose = () => { wsRef.current = null; };

    // Also poll job status
    const interval = setInterval(async () => {
      const jr = await fetch(`/api/jobs/${job.id}`);
      if (!jr.ok) return;
      const j = await jr.json();
      setStatus(j.status);
      if (j.blockReason) setBlockReason(j.blockReason);
      if (['completed', 'voicemail', 'blocked', 'failed'].includes(j.status)) {
        clearInterval(interval);
      }
    }, 3000);
  };

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Run Talking Portfolio</h2>

      <div className="bg-white rounded-lg border p-6 mb-6 space-y-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Portfolio (leave blank for last run)</label>
          <select className="border rounded px-3 py-2 text-sm w-full" value={portfolioId} onChange={e => setPortfolioId(e.target.value)}>
            <option value="">— Use last optimizer run —</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Contact</label>
          <select className="border rounded px-3 py-2 text-sm w-full" value={contactId} onChange={e => setContactId(e.target.value)}>
            <option value="">— Select contact —</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Phone (E.164)</label>
          <input className="border rounded px-3 py-2 text-sm w-full font-mono" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+16462328797" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Caller Profile</label>
          <select className="border rounded px-3 py-2 text-sm w-full" value={profileId} onChange={e => setProfileId(e.target.value)}>
            <option value="">— Default —</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.entityName}{p.isDefault ? ' (default)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Mode Hint</label>
          <div className="flex gap-3">
            {(['summary', 'detail'] as const).map(m => (
              <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="mode" checked={modeHint === m} onChange={() => setModeHint(m)} />
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={launch}
          disabled={!phone || !!status}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status ? `Status: ${status}` : 'Launch Call'}
        </button>

        {status === 'blocked' && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            <strong>Blocked:</strong> {blockReason}
          </div>
        )}
      </div>

      {/* Live transcript */}
      {(jobId || transcript.length > 0) && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-3">Live Transcript</h3>
          {transcript.length === 0 && <p className="text-gray-400 text-sm">Waiting for call…</p>}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {transcript.map((line, i) => (
              <div key={i} className={`text-sm ${line.role === 'agent' ? 'text-blue-700' : 'text-gray-800'}`}>
                <span className="font-medium capitalize">{line.role}:</span> {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
