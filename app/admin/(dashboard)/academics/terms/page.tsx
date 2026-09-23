import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction, canPage } from '@/lib/permissions.ts';
import { adminTerms } from '@/lib/content.ts';
import { formatDateShort } from '@/lib/format.ts';
import { saveTerm, deleteTerm } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter, Submit } from '../../ui.tsx';

export const metadata = { title: 'Term dates' };

export default async function TermsPage() {
  const user = await requirePage('ACADEMICS_TERMS');
  const terms = await adminTerms();
  const mayManage = canAction(user, 'TERMS_MANAGE');
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();

  return (
    <>
      <div className="tabs">
        {canPage(user, 'ACADEMICS') ? <Link href="/admin/academics">Levels &amp; subjects</Link> : null}
        <Link href="/admin/academics/terms" aria-current="page">Term dates</Link>
        {canPage(user, 'ACADEMICS_FEES') ? <Link href="/admin/academics/fees">Fee structure</Link> : null}
      </div>

      <div className="panel">
        <header>
          <div>
            <h2>Term dates</h2>
            <p>
              Published on the calendar page and the home page, and used to decide which fee structure the website
              shows. Exactly one term is the current one.
            </p>
          </div>
          <span style={{ flex: 1 }} />
          <Link href="/academics/calendar" target="_blank" className="btn btn-ghost btn-xs">View ↗</Link>
        </header>
      </div>

      {mayManage ? (
        <ActionForm action={saveTerm} success="Term saved.">
          <div className="panel">
            <header>
              <div><h2>Add a term</h2></div>
              <span style={{ flex: 1 }} />
              <Submit>Add term</Submit>
            </header>
            <div className="body">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="new-term-name">Term</label>
                  <input id="new-term-name" name="name" type="text" required maxLength={60} placeholder="Term 1" />
                </div>
                <div className="field">
                  <label htmlFor="new-term-year">Academic year</label>
                  <input id="new-term-year" name="year_name" type="text" required maxLength={40} defaultValue={String(year)} />
                </div>
                <div className="check-row" style={{ alignSelf: 'end' }}>
                  <input id="new-term-current" name="is_current" type="checkbox" value="1" />
                  <label htmlFor="new-term-current">
                    This is the current term
                    <span className="help">Ticking it un-ticks whichever term is current now.</span>
                  </label>
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="new-term-start">Opens</label>
                  <input id="new-term-start" name="start_date" type="date" required />
                </div>
                <div className="field">
                  <label htmlFor="new-term-end">Closes</label>
                  <input id="new-term-end" name="end_date" type="date" required />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-term-note">Note</label>
                <input id="new-term-note" name="note" type="text" maxLength={300} placeholder="Half-term break in the middle weekend." />
              </div>
            </div>
          </div>
        </ActionForm>
      ) : null}

      <div className="panel">
        <header><h2>The calendar</h2></header>
        {terms.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">📆</span>
            <h3>No terms yet</h3>
            <p>Until a term exists the website cannot show term dates, and the fee page has nothing to price.</p>
          </div>
        ) : (
          <div className="body">
            <RowFilter placeholder="Search terms by name, year or status…">
              {terms.map((term) => (
                <div
                  key={term.id}
                  data-filter={`${term.name} ${term.year_name} ${term.note ?? ''} ${term.is_current ? 'Current' : term.start_date > today ? 'Upcoming' : 'Completed'}`}
                  style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 14 }}
                >
                  <ActionForm action={saveTerm} success="Saved.">
                    <input type="hidden" name="id" value={term.id} />
                    <fieldset disabled={!mayManage} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{term.name} {term.year_name}</strong>
                        {term.is_current ? <span className="badge badge-ok">Current</span>
                          : term.start_date > today ? <span className="badge badge-info">Upcoming</span>
                            : <span className="badge">Completed</span>}
                        <span className="help">{formatDateShort(term.start_date)} – {formatDateShort(term.end_date)}</span>
                      </div>

                      <div className="grid-3">
                        <div className="field">
                          <label htmlFor={`tn-${term.id}`}>Term</label>
                          <input id={`tn-${term.id}`} name="name" type="text" required maxLength={60} defaultValue={term.name} />
                        </div>
                        <div className="field">
                          <label htmlFor={`ty-${term.id}`}>Academic year</label>
                          <input id={`ty-${term.id}`} name="year_name" type="text" required maxLength={40} defaultValue={term.year_name} />
                        </div>
                        <div className="check-row" style={{ alignSelf: 'end' }}>
                          <input id={`tc-${term.id}`} name="is_current" type="checkbox" value="1" defaultChecked={term.is_current} />
                          <label htmlFor={`tc-${term.id}`}>Current term</label>
                        </div>
                      </div>

                      <div className="grid-3">
                        <div className="field">
                          <label htmlFor={`ts-${term.id}`}>Opens</label>
                          <input id={`ts-${term.id}`} name="start_date" type="date" required defaultValue={term.start_date} />
                        </div>
                        <div className="field">
                          <label htmlFor={`te-${term.id}`}>Closes</label>
                          <input id={`te-${term.id}`} name="end_date" type="date" required defaultValue={term.end_date} />
                        </div>
                        <div className="field">
                          <label htmlFor={`tnote-${term.id}`}>Note</label>
                          <input id={`tnote-${term.id}`} name="note" type="text" maxLength={300} defaultValue={term.note ?? ''} />
                        </div>
                      </div>

                      {mayManage ? <div><Submit className="btn btn-ghost btn-xs">Save term</Submit></div> : null}
                    </fieldset>
                  </ActionForm>

                  {mayManage ? (
                    <ActionForm action={deleteTerm}>
                      <input type="hidden" name="id" value={term.id} />
                      <ConfirmSubmit message={`Delete ${term.name} ${term.year_name}? Every fee line for it is deleted too.`}>
                        Delete term
                      </ConfirmSubmit>
                    </ActionForm>
                  ) : null}
                </div>
              ))}
            </RowFilter>
          </div>
        )}
      </div>
    </>
  );
}
