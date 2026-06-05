import { useEffect, useState } from 'react';

interface Profile {
  id: string;
  entityName: string;
  callbackNumber: string;
  voicePersona: string | null;
  financialDisclaimer: string;
  isDefault: boolean;
}

export default function CallerProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  const load = () => fetch('/api/caller-profiles').then(r => r.json()).then(setProfiles).catch(() => {});

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setError('');
    const method = 'id' in editing && profiles.find(p => p.id === editing.id) ? 'PUT' : 'POST';
    const url = method === 'PUT' ? `/api/caller-profiles/${editing.id}` : '/api/caller-profiles';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!res.ok) { setError(await res.text()); return; }
    setEditing(null);
    load();
  };

  const blankProfile: Omit<Profile, 'id'> & { id: string } = {
    id: '',
    entityName: '',
    callbackNumber: '',
    voicePersona: null,
    financialDisclaimer: 'Educational use only. Not investment advice.',
    isDefault: false,
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Caller Profiles</h2>
      <p className="text-sm text-gray-500 mb-6">Define the entity name, callback number, and disclaimers that flow into every call.</p>

      <button
        onClick={() => setEditing({ ...blankProfile })}
        className="mb-6 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
      >
        + New Profile
      </button>

      {editing && (
        <div className="bg-white border rounded-lg p-5 mb-6 max-w-lg">
          <h3 className="text-sm font-semibold mb-3">{editing.id ? 'Edit Profile' : 'New Profile'}</h3>
          {[
            { field: 'entityName', label: 'Entity Name', placeholder: 'Your Name / Firm' },
            { field: 'callbackNumber', label: 'Callback Number', placeholder: '+15550001234' },
            { field: 'voicePersona', label: 'Voice Persona (optional)', placeholder: 'Friendly, concise' },
            { field: 'financialDisclaimer', label: 'Financial Disclaimer', placeholder: '' },
          ].map(({ field, label, placeholder }) => (
            <div key={field} className="mb-2">
              <label className="text-xs text-gray-500">{label}</label>
              <input
                className="border rounded px-3 py-2 text-sm w-full"
                placeholder={placeholder}
                value={(editing[field as keyof Profile] as string) ?? ''}
                onChange={e => setEditing({ ...editing, [field]: e.target.value })}
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={editing.isDefault} onChange={e => setEditing({ ...editing, isDefault: e.target.checked })} />
            Set as default
          </label>
          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">Save</button>
            <button onClick={() => setEditing(null)} className="text-gray-500 px-4 py-2 rounded text-sm border hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Callback</th>
              <th className="px-4 py-3 text-left">Default</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {profiles.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No profiles</td></tr>
            )}
            {profiles.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.entityName}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.callbackNumber}</td>
                <td className="px-4 py-3">{p.isDefault ? <span className="text-green-600 text-xs font-medium">✓ Default</span> : null}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditing(p)} className="text-indigo-600 text-xs hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
