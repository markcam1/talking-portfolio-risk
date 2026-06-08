import { useEffect, useState } from 'react';

interface Contact {
  id: string;
  name: string;
  phoneNumbers: Array<{ phone_e164: string; label: string; is_primary: boolean }>;
  timezone: string;
  policyId: string;
  updatedAt: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const load = () => fetch('/api/contacts').then(r => r.json()).then(setContacts).catch(() => {});

  useEffect(() => { load(); }, []);

  const toE164 = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+')) return '+' + digits;
    if (digits.length === 10) return '+1' + digits;          // US local
    if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;  // US with country code
    return '+' + digits;
  };

  const create = async () => {
    setError('');
    if (!name || !phone) { setError('Name and phone required'); return; }
    const e164 = toE164(phone);
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phoneNumbers: [{ phone_e164: e164, label: 'mobile', is_primary: true, is_owned: true }],
        policyId: 'self',
      }),
    });
    if (!res.ok) { setError(await res.text()); return; }
    setName(''); setPhone('');
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete contact?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Contacts</h2>

      <div className="bg-white rounded-lg border p-5 mb-6 max-w-lg">
        <h3 className="text-sm font-semibold mb-3">New Contact</h3>
        <input className="border rounded px-3 py-2 text-sm w-full mb-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="border rounded px-3 py-2 text-sm w-full mb-2" placeholder="Phone (e.g. 2019234660 or +12019234660)" value={phone} onChange={e => setPhone(e.target.value)} />
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <button onClick={create} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">Create</button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Numbers</th>
              <th className="px-4 py-3 text-left">Policy</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {contacts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No contacts yet</td></tr>
            )}
            {contacts.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {c.phoneNumbers.map(p => p.phone_e164).join(', ')}
                </td>
                <td className="px-4 py-3 text-gray-500">{c.policyId}</td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <button onClick={() => remove(c.id)} className="text-red-500 text-xs hover:text-red-700">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
