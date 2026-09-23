'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { submitEnquiry, submitRsvp, subscribeToNewsletter } from '@/app/actions/public.ts';

/*
 * The forms a visitor fills in. Deliberately plain: no modal, no design system, no step a parent
 * on a phone at nine in the evening has to think about. The one hidden field on each is the
 * honeypot, which a person never sees and a crude bot cannot resist.
 */

export interface GradeOption { id: number; name: string; level_name: string }

/* ============================================================== enquiry and tour */

export function EnquiryForm({
  grades,
  sourcePage,
  kind = 'ENQUIRY',
  slots,
  compact = false,
}: {
  grades: GradeOption[];
  sourcePage: string;
  kind?: 'ENQUIRY' | 'TOUR';
  /** Tour mode: the visiting times the school actually offers. */
  slots?: string[];
  /** Drops the optional fields, for the short form beside an article. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const tour = kind === 'TOUR';
  const today = new Date().toISOString().slice(0, 10);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const result = await submitEnquiry({ ...values, kind, source_page: sourcePage });
      if (!result.ok) { setError(result.error); return; }
      setReference(result.data.reference);
    } catch {
      setError('We could not send that just now. Please try again, or call the school office.');
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <div className="callout callout-accent done">
        <div className="tick" aria-hidden="true">✓</div>
        <h3>{tour ? 'Your visit is booked' : 'Thank you — we have your message'}</h3>
        <p className="small">
          {tour
            ? 'The admissions office will call to confirm the time. Please bring your child if you can — they notice more than you do.'
            : 'The admissions office will call you within one working day. If it is urgent, please phone the school directly.'}
        </p>
        <p className="tiny muted" style={{ marginBottom: 4 }}>Your reference</p>
        <div className="reference">{reference}</div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {error ? <div className="alert alert-bad" role="alert">{error}</div> : null}

      <div className="row">
        <div>
          <label htmlFor={`enq-name-${kind}`}>Your name <Req /></label>
          <input id={`enq-name-${kind}`} name="name" type="text" required autoComplete="name" maxLength={120} />
        </div>
        <div>
          <label htmlFor={`enq-phone-${kind}`}>Phone number <Req /></label>
          <input id={`enq-phone-${kind}`} name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="07xx xxx xxx" maxLength={30} />
        </div>
      </div>

      {compact && !tour ? null : (
        <div className="row">
          <div>
            <label htmlFor={`enq-email-${kind}`}>Email <span className="optional">(optional)</span></label>
            <input id={`enq-email-${kind}`} name="email" type="email" autoComplete="email" maxLength={160} />
          </div>
          <div>
            <label htmlFor={`enq-grade-${kind}`}>Grade you have in mind</label>
            <select id={`enq-grade-${kind}`} name="grade_id" defaultValue="">
              <option value="">— choose a grade —</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name} ({grade.level_name})</option>)}
            </select>
          </div>
        </div>
      )}

      {tour ? (
        <div className="row c3">
          <div>
            <label htmlFor="enq-date">Day you would like to visit <Req /></label>
            <input id="enq-date" name="preferred_date" type="date" required min={today} />
          </div>
          <div>
            <label htmlFor="enq-time">Time</label>
            <select id="enq-time" name="preferred_time" defaultValue={slots?.[0] ?? '09:00'}>
              {(slots ?? ['09:00', '10:30', '14:00', '15:30']).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="enq-visitors">How many of you</label>
            <input id="enq-visitors" name="visitors" type="number" min={1} max={20} defaultValue={2} />
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor={`enq-message-${kind}`}>{tour ? 'Anything you would particularly like to see?' : 'Your question'}</label>
        <textarea
          id={`enq-message-${kind}`}
          name="message"
          maxLength={2000}
          placeholder={tour
            ? 'e.g. a Grade 5 lesson, the computer class, the school transport'
            : 'e.g. Do you have a place in Grade 5 for January, and does the school transport reach Kiwanja?'}
        />
      </div>

      <Honeypot id={`enq-hp-${kind}`} />

      <div>
        <button type="submit" className="btn btn-accent" disabled={busy}>
          {busy ? 'Sending…' : tour ? 'Book the visit' : 'Send my enquiry'}
        </button>
        <p className="hint">
          We use your details only to reply to this {tour ? 'booking' : 'enquiry'}, and we never pass them on.
          See our <Link href="/privacy">privacy notice</Link>.
        </p>
      </div>
    </form>
  );
}

/* =========================================================================== RSVP */

export function RsvpForm({ eventId, eventTitle, placesLeft }: { eventId: number; eventTitle: string; placesLeft: number | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const result = await submitRsvp({ ...values, event_id: String(eventId) });
      if (!result.ok) { setError(result.error); return; }
      setDone(true);
    } catch {
      setError('We could not book that just now. Please try again, or call the school office.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="callout callout-accent done">
        <div className="tick" aria-hidden="true">✓</div>
        <h3>You are booked in</h3>
        <p className="small" style={{ margin: 0 }}>We have your place for <strong>{eventTitle}</strong>. The office will confirm by phone if anything changes.</p>
      </div>
    );
  }

  if (placesLeft !== null && placesLeft <= 0) {
    return (
      <div className="callout">
        <h3>This event is full</h3>
        <p className="small" style={{ margin: 0 }}>Please call the school office — we keep a short waiting list and places do come back.</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {error ? <div className="alert alert-bad" role="alert">{error}</div> : null}
      {placesLeft !== null && placesLeft <= 20 ? (
        <p className="tiny muted" style={{ margin: 0 }}>{placesLeft} place{placesLeft === 1 ? '' : 's'} left.</p>
      ) : null}

      <div className="row">
        <div>
          <label htmlFor="rsvp-name">Your name <Req /></label>
          <input id="rsvp-name" name="name" type="text" required autoComplete="name" maxLength={120} />
        </div>
        <div>
          <label htmlFor="rsvp-phone">Phone number <Req /></label>
          <input id="rsvp-phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" maxLength={30} />
        </div>
      </div>
      <div className="row">
        <div>
          <label htmlFor="rsvp-email">Email <span className="optional">(optional)</span></label>
          <input id="rsvp-email" name="email" type="email" autoComplete="email" maxLength={160} />
        </div>
        <div>
          <label htmlFor="rsvp-guests">How many of you</label>
          <input id="rsvp-guests" name="guests" type="number" min={1} max={20} defaultValue={2} />
        </div>
      </div>
      <div>
        <label htmlFor="rsvp-message">Anything we should know <span className="optional">(optional)</span></label>
        <textarea id="rsvp-message" name="message" maxLength={500} placeholder="e.g. we will need step-free access" />
      </div>

      <Honeypot id="rsvp-hp" />

      <div>
        <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? 'Booking…' : 'Book my place'}</button>
        <p className="hint">Free, and you can change your mind — just call the office.</p>
      </div>
    </form>
  );
}

/* ===================================================================== newsletter */

export function NewsletterForm({ sourcePage }: { sourcePage: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('busy');
    setError(null);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const result = await subscribeToNewsletter({ ...values, source_page: sourcePage });
      if (!result.ok) { setError(result.error); setState('idle'); return; }
      setState('done');
    } catch {
      setError('That did not go through. Please try again.');
      setState('idle');
    }
  };

  if (state === 'done') {
    return <p className="tiny" style={{ marginTop: 14 }}>✓ You are on the list. We send a short round-up at the end of each month, and nothing else.</p>;
  }

  return (
    <form className="newsletter" onSubmit={onSubmit}>
      <label htmlFor="news-email" className="sr-only">Your email address</label>
      <input id="news-email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" maxLength={160} />
      <span className="honeypot" aria-hidden="true">
        <label htmlFor="news-hp">Leave this empty</label>
        <input id="news-hp" name="website_url" type="text" tabIndex={-1} autoComplete="off" />
      </span>
      <button type="submit" className="btn btn-sm btn-accent" disabled={state === 'busy'}>
        {state === 'busy' ? 'Adding…' : 'Subscribe'}
      </button>
      {error ? <p className="tiny" style={{ width: '100%', margin: '6px 0 0', color: 'var(--accent)' }}>{error}</p> : null}
    </form>
  );
}

/* ========================================================================= pieces */

const Req = () => <span aria-hidden="true" style={{ color: 'var(--bad)' }}>*</span>;

function Honeypot({ id }: { id: string }): ReactNode {
  return (
    <div className="honeypot" aria-hidden="true">
      <label htmlFor={id}>Leave this field empty</label>
      <input id={id} name="website_url" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
