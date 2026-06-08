import { useEffect, useState } from 'react';

interface OwnedNumber {
  id: string;
  phoneE164: string;
  label: string | null;
  verified: boolean;
  verifiedAt: string | null;
  verificationMethod: string;
}

export default function OwnedNumbers() {
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const load = () => fetch('/api/owned-numbers').then(r => r.json()).then(setNumbers).catch(() => {});

  useEffect(() => { load(); }, []);

  const toE164 = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+')) return '+' + digits;
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
    return '+' + digits;
  };

  const add = async () => {
    setError('');
    const res = await fetch('/api/owned-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneE164: toE164(phone), label: label || undefined }),
    });
    if (!res.ok) { setError(await res.text()); return; }
    setPhone(''); setLabel('');
    load();
  };

  const confirm = async (id: string) => {
    await fetch(`/api/owned-numbers/${id}/confirm`, { method: 'POST' });
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this number?')) return;
    await fetch(`/api/owned-numbers/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-2">Owned Numbers</h2>
      <p className="text-sm text-gray-500 mb-6">Only verified owned numbers can receive calls while OWNED_NUMBERS_ONLY=true.</p>

      {/* Add form */}
      <div className="bg-white rounded-lg border p-5 mb-6 max-w-lg">
        <h3 className="text-sm font-semibold mb-3">Add Number</h3>
        <div className="flex gap-2 mb-2">
          <input
            className="border rounded px-3 py-2 text-sm flex-1"
            placeholder="2019234660 or +12019234660"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 text-sm w-32"
            placeholder="Label"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <button onClick={add} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">Add</button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Label</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Verified At</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {numbers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No numbers registered</td></tr>
            )}
            {numbers.map(n => (
              <tr key={n.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{n.phoneE164}</td>
                <td className="px-4 py-3 text-gray-500">{n.label ?? '—'}</td>
                <td className="px-4 py-3">
                  {n.verified
                    ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">✓ Verified</span>
                    : <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">Unverified</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{n.verifiedAt ? new Date(n.verifiedAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  {!n.verified && (
                    <button
                      onClick={() => confirm(n.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                    >
                      I confirm I own this number
                    </button>
                  )}
                  <button onClick={() => remove(n.id)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
