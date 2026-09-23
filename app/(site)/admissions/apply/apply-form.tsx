'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { submitApplication } from '@/app/actions/public.ts';
import type { GradeOption } from '../../forms.tsx';

/*
 * The online application — four short steps rather than one long page, because a parent filling
 * this on a phone at nine in the evening will abandon a form that looks endless.
 *
 * Every step stays mounted and is merely hidden, so nothing a parent has typed is lost by stepping
 * back and forth, and the whole thing submits as one. Nothing is asked that the school does not
 * need to reach a decision; documents, medical forms and the rest are collected at reporting.
 */

const STEPS = ['The place', 'The child', 'Parent or guardian', 'Confirm'] as const;

const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Aunt', 'Uncle', 'Sponsor'];

export function ApplyForm({
  grades,
  routes,
  intakeTerm,
}: {
  grades: GradeOption[];
  routes: { id: number; code: string; name: string }[];
  intakeTerm: string | null;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The browser has already checked `required` on the visible step; move on rather than submit.
    if (step < STEPS.length - 1) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    setBusy(true);
    setError(null);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const result = await submitApplication({ ...values, source_page: '/admissions/apply' });
      if (!result.ok) { setError(result.error); return; }
      setReference(result.data.no);
    } catch {
      setError('We could not submit that just now. Please try again, or call the school office.');
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <div className="callout callout-accent done">
        <div className="tick" aria-hidden="true">🎉</div>
        <h3>Your application is in</h3>
        <p className="small">The admissions office has it, and will contact you about the placement assessment.</p>
        <p className="tiny muted" style={{ marginBottom: 4 }}>Your application number — keep it, and quote it when you call</p>
        <div className="reference">{reference}</div>
        <p className="tiny" style={{ marginTop: 20 }}>
          Questions in the meantime? <Link href="/contact">Talk to the admissions office</Link>.
        </p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="progress" aria-hidden="true">
        {STEPS.map((label, index) => <span key={label} className={index <= step ? 'on' : ''} />)}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>

      {error ? <div className="alert alert-bad" role="alert">{error}</div> : null}

      {/* ---------------------------------------------------------- step 1 */}
      <fieldset style={{ display: step === 0 ? 'grid' : 'none' }}>
        <legend>The place you are applying for</legend>
        <div className="row">
          <div>
            <label htmlFor="ap-grade">Grade <Req /></label>
            <select id="ap-grade" name="grade_id" required defaultValue="">
              <option value="">— choose a grade —</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name} ({grade.level_name})</option>)}
            </select>
            {intakeTerm ? <p className="hint">Applications are being taken for {intakeTerm}.</p> : null}
          </div>
          <input type="hidden" name="boarding_status" value="DAY" />
        </div>

        {routes.length ? (
          <div>
            <label htmlFor="ap-route">School bus <span className="optional">(optional)</span></label>
            <select id="ap-route" name="transport_route" defaultValue="">
              <option value="">Not using the school bus</option>
              {routes.map((route) => (
                <option key={route.id} value={`${route.code} — ${route.name}`}>{route.code} — {route.name}</option>
              ))}
            </select>
            <p className="hint">You can change this later. <Link href="/school-bus">See the routes and times</Link>.</p>
          </div>
        ) : null}
      </fieldset>

      {/* ---------------------------------------------------------- step 2 */}
      <fieldset style={{ display: step === 1 ? 'grid' : 'none' }}>
        <legend>About the child</legend>
        <div className="row c3">
          <div>
            <label htmlFor="ap-first">First name <Req /></label>
            <input id="ap-first" name="first_name" type="text" required={step === 1} maxLength={60} />
          </div>
          <div>
            <label htmlFor="ap-middle">Middle name</label>
            <input id="ap-middle" name="middle_name" type="text" maxLength={60} />
          </div>
          <div>
            <label htmlFor="ap-last">Last name <Req /></label>
            <input id="ap-last" name="last_name" type="text" required={step === 1} maxLength={60} />
          </div>
        </div>
        <div className="row c3">
          <div>
            <label htmlFor="ap-dob">Date of birth <Req /></label>
            <input id="ap-dob" name="date_of_birth" type="date" required={step === 1} max={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label htmlFor="ap-gender">Gender <Req /></label>
            <select id="ap-gender" name="gender" required={step === 1} defaultValue="">
              <option value="">— choose —</option>
              <option value="MALE">Boy</option>
              <option value="FEMALE">Girl</option>
            </select>
          </div>
          <div>
            <label htmlFor="ap-prev">Current / previous school</label>
            <input id="ap-prev" name="previous_school" type="text" maxLength={120} />
          </div>
        </div>
        <div>
          <label htmlFor="ap-medical">Medical, dietary or learning needs we should know about</label>
          <textarea id="ap-medical" name="medical" maxLength={1000} placeholder="e.g. asthma, a nut allergy, needs to sit at the front" />
          <p className="hint">Nothing here affects the decision. It tells us how to look after your child properly.</p>
        </div>
      </fieldset>

      {/* ---------------------------------------------------------- step 3 */}
      <fieldset style={{ display: step === 2 ? 'grid' : 'none' }}>
        <legend>Parent or guardian</legend>
        <div className="row">
          <div>
            <label htmlFor="ap-gname">Full name <Req /></label>
            <input id="ap-gname" name="guardian_name" type="text" required={step === 2} autoComplete="name" maxLength={120} />
          </div>
          <div>
            <label htmlFor="ap-grel">Relationship to the child <Req /></label>
            <select id="ap-grel" name="guardian_relationship" required={step === 2} defaultValue="Mother">
              {RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label htmlFor="ap-gphone">Phone number <Req /></label>
            <input id="ap-gphone" name="guardian_phone" type="tel" required={step === 2} inputMode="tel" autoComplete="tel" placeholder="07xx xxx xxx" maxLength={30} />
            <p className="hint">This is how the school will reach you about the application.</p>
          </div>
          <div>
            <label htmlFor="ap-gemail">Email <span className="optional">(optional)</span></label>
            <input id="ap-gemail" name="guardian_email" type="email" autoComplete="email" maxLength={160} />
          </div>
        </div>
        <div>
          <label htmlFor="ap-message">Anything you would like to tell us</label>
          <textarea id="ap-message" name="message" maxLength={1500} placeholder="e.g. we are moving to Nairobi in April and would like to start in Term 2" />
        </div>
      </fieldset>

      {/* ---------------------------------------------------------- step 4 */}
      <fieldset style={{ display: step === 3 ? 'grid' : 'none' }}>
        <legend>Confirm and send</legend>
        <p className="tiny muted" style={{ margin: 0 }}>
          The school will contact you to arrange a short placement assessment. You will be asked to bring the birth
          certificate, the most recent report card and, for a transfer, a letter from the previous school — nothing
          needs uploading now.
        </p>
        <div className="check">
          <input id="ap-declaration" name="declaration" type="checkbox" value="1" required={step === 3} />
          <label htmlFor="ap-declaration">The information I have given is true and complete to the best of my knowledge. <Req /></label>
        </div>
        <div className="check">
          <input id="ap-privacy" name="privacy" type="checkbox" value="1" required={step === 3} />
          <label htmlFor="ap-privacy">
            I accept the school&rsquo;s <Link href="/privacy">privacy notice</Link> and agree that the school may hold
            these details to process this application. <Req />
          </label>
        </div>
        <div className="check">
          <input id="ap-photo" name="photo_consent" type="checkbox" value="1" defaultChecked />
          <label htmlFor="ap-photo">
            I consent to photographs of my child being used in school communications.{' '}
            <span className="optional">(You can change this at any time.)</span>
          </label>
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="ap-hp">Leave this field empty</label>
          <input id="ap-hp" name="website_url" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </fieldset>

      <div className="btn-row" style={{ marginTop: 4 }}>
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>← Back</button>
        ) : null}
        <button type="submit" className="btn btn-accent" disabled={busy}>
          {busy ? 'Sending…' : step < STEPS.length - 1 ? 'Continue →' : 'Submit my application'}
        </button>
      </div>
    </form>
  );
}

const Req = () => <span aria-hidden="true" style={{ color: 'var(--bad)' }}>*</span>;
