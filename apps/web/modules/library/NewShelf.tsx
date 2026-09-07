'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { KitchenIcon } from '@/modules/woodland/KitchenIcon';
import styles from './woodland-library.module.css';

export function NewShelf() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  function close() { setOpen(false); toggle.current?.focus(); }
  return <div className={styles.newShelf}>
    <button ref={toggle} type="button" className={styles.journalLink} aria-expanded={open} aria-controls={open ? formId : undefined} onClick={() => { setOpen(value => !value); setNotice(''); }}><KitchenIcon name="plus" />New shelf</button>
    {open && <form id={formId} aria-busy={busy} onSubmit={async event => {
      event.preventDefault();
      if (!name.trim() || busy) return;
      setBusy(true); setError('');
      try { await api.createShelf(name.trim()); setNotice(`Shelf created: ${name.trim()}.`); setName(''); close(); router.refresh(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'The shelf could not be saved. Your name is still here.'); }
      finally { setBusy(false); }
    }}><label>Shelf name<input ref={input} value={name} onChange={event => setName(event.target.value)} required maxLength={60} disabled={busy} /></label><button type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving...' : 'Create shelf'}</button><button type="button" disabled={busy} onClick={close}>Cancel</button>{error && <p role="alert">{error}</p>}</form>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
