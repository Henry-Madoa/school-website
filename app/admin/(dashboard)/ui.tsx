'use client';

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { cdn } from '@/lib/cloudinary.ts';
import type { ActionResult } from '@/lib/types.ts';

/*
 * The admin's shared controls.
 *
 * Every form here posts to a Server Action through `useActionState`, which means three things
 * that matter on an office connection: the form still works with JavaScript disabled, the button
 * disables itself while the request is in flight so nothing is submitted twice, and an error
 * comes back as a sentence the person can read rather than a thrown stack.
 */

export type FormAction<T = unknown> = (state: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

/* ======================================================================== buttons */

/** A submit button that knows whether its own form is busy. */
export function Submit({ children, busy, className = 'btn btn-primary', ...rest }: {
  children: ReactNode;
  busy?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} {...rest}>
      {pending ? (busy ?? 'Saving…') : children}
    </button>
  );
}

/**
 * A button that asks before it does something irreversible. `confirm()` rather than a modal
 * deliberately: it cannot be dismissed by a stray click, and it works identically on a phone.
 */
export function ConfirmSubmit({ message, children, className = 'btn btn-danger btn-xs', name, value }: {
  message: string;
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}
    >
      {pending ? '…' : children}
    </button>
  );
}

/* ========================================================================== forms */

/**
 * Wraps a Server Action and renders whatever it hands back — an error to fix, or a confirmation.
 * `onDone` is for the cases where a save should move the person somewhere (a new record's card).
 */
export function ActionForm<T>({
  action,
  children,
  onDone,
  success,
  className,
  id,
}: {
  action: FormAction<T>;
  children: ReactNode;
  onDone?: (data: T) => void;
  /** Shown after a save that stays on the page. */
  success?: string;
  className?: string;
  id?: string;
}) {
  const [state, dispatch] = useActionState(action, null);

  /*
   * The only thing the effect does is navigate, which is an external system. Whether to show the
   * confirmation is derived from the action's own result rather than kept in a second piece of
   * state — one source of truth, and no timer racing the next submission.
   */
  useEffect(() => {
    if (state?.ok) onDone?.(state.data);
    // onDone is a fresh closure on every render; the result is what should drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={dispatch} className={className} id={id}>
      {state && !state.ok ? <div className="note note-bad" role="alert" style={{ marginBottom: 16 }}>{state.error}</div> : null}
      {state?.ok && success ? <div className="note note-ok" role="status" style={{ marginBottom: 16 }}>{success}</div> : null}
      {children}
    </form>
  );
}

/**
 * The same, but navigates when the action succeeds — used by every "New …" form and every delete
 * that should not leave the person on the card they just removed.
 *
 * `to` is a path, not a callback: a function cannot cross from a Server Component into a Client
 * Component. Any `:name` in it is replaced by that field of the action's result, so
 * "/admin/news/:id" lands on the record that was just created.
 */
export function ActionFormRedirect<T>({
  action,
  to,
  children,
  className,
}: {
  action: FormAction<T>;
  to: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={action}
      className={className}
      onDone={(data) => {
        const target = to.replace(/:([a-zA-Z_]+)/g, (whole, key: string) => {
          const value = (data as Record<string, unknown>)?.[key];
          return value === undefined || value === null ? whole : String(value);
        });
        router.push(target);
        router.refresh();
      }}
    >
      {children}
    </ActionForm>
  );
}

/* ========================================================================== image */

/**
 * An image field with a preview.
 *
 * The file goes to Cloudinary inside the Server Action, so nothing is uploaded until the record
 * is saved — which means abandoning a form leaves no orphaned images behind. Leaving the field
 * empty keeps whatever picture the record already had.
 */
export function ImageField({
  name,
  label,
  current,
  hint,
  accept = 'image/*',
  multiple = false,
}: {
  name: string;
  label: string;
  current?: string | null;
  hint?: string;
  accept?: string;
  multiple?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(current ? cdn(current, { width: 200, height: 200 }) : null);
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="image-field">
        <div className="preview">
          {preview
            ? <img src={preview} alt="" />
            : <span aria-hidden="true">🖼</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            ref={inputRef}
            id={name}
            name={name}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setCount(files.length);
              const first = files[0];
              setPreview(first ? URL.createObjectURL(first) : (current ? cdn(current, { width: 200, height: 200 }) : null));
            }}
          />
          <p className="help">
            {multiple && count > 1
              ? `${count} images selected. `
              : ''}
            {hint ?? (current ? 'Leave empty to keep the current image.' : 'JPEG, PNG or WebP, up to 8 MB.')}
          </p>
          {current && preview ? (
            <button
              type="button"
              className="btn btn-quiet btn-xs"
              onClick={() => { setPreview(null); setCount(0); if (inputRef.current) inputRef.current.value = ''; }}
            >
              Clear selection
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== filtering */

/**
 * A search box that filters the rows already on the page rather than asking the server again.
 * Admin lists here are hundreds of rows at most, and a filter that responds on the keystroke is
 * worth more than one that is exhaustive.
 */
export function RowFilter({ placeholder = 'Search…', children }: { placeholder?: string; children: ReactNode }) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<number | null>(null);
  const id = useId();

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    // Rows may carry a curated `data-filter`; any other table row is searched by its visible text.
    const rows = new Set([
      ...container.querySelectorAll<HTMLElement>('[data-filter]'),
      ...container.querySelectorAll<HTMLElement>('table.list > tbody > tr'),
    ]);
    const needle = query.trim().toLowerCase();
    for (const row of rows) {
      const haystack = row.dataset.filter ?? row.textContent ?? '';
      row.hidden = !!needle && !haystack.toLowerCase().includes(needle);
    }
    // A group (a grade's fees, a route's stops) matches as a whole on its own name, and is hidden
    // when nothing inside it matches.
    for (const group of container.querySelectorAll<HTMLElement>('[data-filter-group]')) {
      const inside = [...rows].filter((row) => group.contains(row));
      if (needle && (group.dataset.filterGroup ?? '').toLowerCase().includes(needle)) {
        for (const row of inside) row.hidden = false;
        group.hidden = false;
      } else {
        group.hidden = !!needle && inside.every((row) => row.hidden);
      }
    }
    setShown([...rows].filter((row) => !row.hidden && !row.parentElement?.closest('[hidden]')).length);
  }, [query, children]);

  return (
    <>
      <div className="toolbar row-filter">
        <div className="grow">
          <label htmlFor={id} className="sr-only">{placeholder}</label>
          <input id={id} type="search" value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {query ? <span className="badge">{shown} shown</span> : null}
      </div>
      <div ref={ref} className="row-filter-items">{children}</div>
      {shown === 0 ? <div className="empty"><p>Nothing matches &ldquo;{query}&rdquo;.</p></div> : null}
    </>
  );
}

/* ======================================================================== toggles */

/**
 * A one-click toggle in a list — publish, pin, enable bookings. It posts a real form so it works
 * without JavaScript, and the row it belongs to is revalidated by the action.
 */
export function ToggleButton({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-xs ${on ? 'btn-ghost' : 'btn-primary'}`} disabled={pending} title={on ? offLabel : onLabel}>
      {pending ? '…' : on ? onLabel : offLabel}
    </button>
  );
}
