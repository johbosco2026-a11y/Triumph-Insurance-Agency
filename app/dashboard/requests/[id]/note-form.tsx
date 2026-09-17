'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function NoteForm({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') || '');
    try {
      const r = await fetch(`/api/requests/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error('Unable to add note.');
      form.reset();
      router.refresh();
    } catch {
      setError('Unable to add note.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-grid" aria-label="Add internal note">
      <div className="field full">
        <textarea name="body" placeholder="Add an internal note..." required minLength={2} />
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="full">
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add note'}</button>
      </div>
    </form>
  );
}
