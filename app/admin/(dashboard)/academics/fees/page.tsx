import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction, canPage } from '@/lib/permissions.ts';
import { adminTerms, adminFees } from '@/lib/content.ts';
import { getSettings, getGrades } from '@/lib/site.ts';
import { formatMoney, formatDateShort } from '@/lib/format.ts';
import { saveFee, deleteFee, copyFees } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter, Submit } from '../../ui.tsx';

export const metadata = { title: 'Fee structure' };

const APPLIES = [
  { value: 'ALL', label: 'Compulsory — everybody' },
  { value: 'DAY', label: 'Day scholars only' },
  { value: 'BOARDER', label: 'Boarders only' },
  { value: 'OPT_IN', label: 'Optional' },
];

/**
 * The fee structure, term by term and grade by grade.
 *
 * These are the exact figures the website publishes, so they should be the ones the bursar
 * invoices. Nothing here posts to a ledger — this is what the school tells the public, and the
 * management system remains the record of what anyone actually owes.
 */
export default async function FeesPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const user = await requirePage('ACADEMICS_FEES');
  const [{ term: termParam }, terms, school, grades] = await Promise.all([
    searchParams, adminTerms(), getSettings(), getGrades(),
  ]);

  const selected = terms.find((t) => String(t.id) === termParam)
    ?? terms.find((t) => t.is_current)
    ?? terms[0];

  const fees = selected ? await adminFees(selected.id) : [];
  const mayManage = canAction(user, 'FEES_MANAGE');
  const money = (cents: number) => formatMoney(cents, school.currency_symbol);

  const byGrade = new Map<number, typeof fees>();
  for (const fee of fees) byGrade.set(fee.grade_id, [...(byGrade.get(fee.grade_id) ?? []), fee]);

  return (
    <>
      <div className="tabs">
        {canPage(user, 'ACADEMICS') ? <Link href="/admin/academics">Levels &amp; subjects</Link> : null}
        {canPage(user, 'ACADEMICS_TERMS') ? <Link href="/admin/academics/terms">Term dates</Link> : null}
        <Link href="/admin/academics/fees" aria-current="page">Fee structure</Link>
      </div>

      <div className="panel">
        <header>
          <div>
            <h2>Fee structure</h2>
            <p>
              {selected
                ? `${selected.name} ${selected.year_name} · ${formatDateShort(selected.start_date)} – ${formatDateShort(selected.end_date)} · ${fees.length} line${fees.length === 1 ? '' : 's'}`
                : 'No terms exist yet, so there is nothing to price.'}
            </p>
          </div>
          <span style={{ flex: 1 }} />
          <Link href="/admissions/fees" target="_blank" className="btn btn-ghost btn-xs">View ↗</Link>
        </header>

        {terms.length ? (
          <div className="body">
            <form method="get" className="toolbar">
              <div className="grow">
                <label htmlFor="term" className="sr-only">Term</label>
                <select id="term" name="term" defaultValue={String(selected?.id ?? '')}>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} {t.year_name}{t.is_current ? ' (current)' : ''}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-ghost">Show this term</button>
            </form>
          </div>
        ) : null}
      </div>

      {!selected ? (
        <div className="panel">
          <div className="empty">
            <span className="big" aria-hidden="true">💰</span>
            <h3>Add a term first</h3>
            <p>Fees belong to a term. Create one on the <Link href="/admin/academics/terms">Term dates</Link> tab.</p>
          </div>
        </div>
      ) : (
        <>
          {mayManage ? (
            <ActionForm action={saveFee} success="Fee line added.">
              <input type="hidden" name="term_id" value={selected.id} />
              <div className="panel">
                <header>
                  <div><h2>Add a fee line</h2></div>
                  <span style={{ flex: 1 }} />
                  <Submit>Add line</Submit>
                </header>
                <div className="body">
                  <div className="grid-3">
                    <div className="field">
                      <label htmlFor="new-fee-grade">Grade</label>
                      <select id="new-fee-grade" name="grade_id" required defaultValue="">
                        <option value="">— choose —</option>
                        {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name} ({grade.level_name})</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="new-fee-item">Item</label>
                      <input id="new-fee-item" name="item" type="text" required maxLength={120} placeholder="Tuition" />
                    </div>
                    <div className="field">
                      <label htmlFor="new-fee-amount">Amount per term ({school.currency_symbol})</label>
                      <input id="new-fee-amount" name="amount" type="text" inputMode="decimal" required placeholder="34000" />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor="new-fee-applies">Applies to</label>
                      <select id="new-fee-applies" name="applies_to" defaultValue="ALL">
                        {APPLIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <p className="help">Only &ldquo;Compulsory&rdquo; lines count towards the total the website advertises.</p>
                    </div>
                    <div className="field">
                      <label htmlFor="new-fee-sort">Order</label>
                      <input id="new-fee-sort" name="sort" type="number" min={0} max={9999} defaultValue={0} />
                    </div>
                  </div>
                </div>
              </div>
            </ActionForm>
          ) : null}

          {mayManage && terms.length > 1 ? (
            <ActionForm action={copyFees} success="Copied.">
              <div className="panel">
                <header>
                  <div>
                    <h2>Copy a whole term&rsquo;s fees</h2>
                    <p>How next year&rsquo;s structure actually gets made: copy, then adjust the figures that changed.</p>
                  </div>
                </header>
                <div className="body">
                  <div className="grid-3">
                    <div className="field">
                      <label htmlFor="copy-from">Copy from</label>
                      <select id="copy-from" name="from_term" defaultValue={String(selected.id)}>
                        {terms.map((t) => <option key={t.id} value={t.id}>{t.name} {t.year_name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="copy-to">Into</label>
                      <select id="copy-to" name="to_term" defaultValue={String(terms.find((t) => t.id !== selected.id)?.id ?? '')}>
                        {terms.filter((t) => t.id !== selected.id).map((t) => <option key={t.id} value={t.id}>{t.name} {t.year_name}</option>)}
                      </select>
                    </div>
                    <div style={{ alignSelf: 'end' }}>
                      <Submit className="btn btn-ghost">Copy lines</Submit>
                    </div>
                  </div>
                  <p className="help">Lines are added, never replaced — copying twice gives you each line twice.</p>
                </div>
              </div>
            </ActionForm>
          ) : null}

          {fees.length === 0 ? (
            <div className="panel">
              <div className="empty">
                <span className="big" aria-hidden="true">💰</span>
                <h3>No fees for {selected.name} {selected.year_name}</h3>
                <p>The website&rsquo;s fee page will say the structure is being finalised until at least one line exists.</p>
              </div>
            </div>
          ) : (
            <RowFilter placeholder="Search fees by grade, level or item…">
              {[...byGrade.entries()].map(([gradeId, lines]) => {
                const compulsory = lines.filter((line) => line.applies_to === 'ALL').reduce((sum, line) => sum + Number(line.amount_cents), 0);
                return (
                  <div className="panel" key={gradeId} data-filter-group={`${lines[0]!.grade} ${lines[0]!.level}`}>
                    <header>
                      <div>
                        <h2>{lines[0]!.grade}</h2>
                        <p>{lines[0]!.level} · compulsory total {money(compulsory)} per term</p>
                      </div>
                    </header>
                    <div className="table-wrap">
                      <table className="list">
                        <thead>
                          <tr><th>Item</th><th>Applies to</th><th className="num">Amount</th><th className="num">Order</th><th className="actions">&nbsp;</th></tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => (
                            <tr key={line.id} data-filter={`${line.item} ${APPLIES.find((option) => option.value === line.applies_to)?.label ?? ''}`}>
                              <td colSpan={5} style={{ padding: 0 }}>
                                <ActionForm action={saveFee}>
                                  <input type="hidden" name="id" value={line.id} />
                                  <input type="hidden" name="term_id" value={selected.id} />
                                  <input type="hidden" name="grade_id" value={line.grade_id} />
                                  <fieldset disabled={!mayManage} style={{ border: 0, padding: '8px 14px', margin: 0, display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                                    <div className="field" style={{ flex: '2 1 200px' }}>
                                      <label htmlFor={`fi-${line.id}`} className="sr-only">Item</label>
                                      <input id={`fi-${line.id}`} name="item" type="text" required maxLength={120} defaultValue={line.item} />
                                    </div>
                                    <div className="field" style={{ flex: '2 1 180px' }}>
                                      <label htmlFor={`fa-${line.id}`} className="sr-only">Applies to</label>
                                      <select id={`fa-${line.id}`} name="applies_to" defaultValue={line.applies_to}>
                                        {APPLIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                      </select>
                                    </div>
                                    <div className="field" style={{ flex: '1 1 120px' }}>
                                      <label htmlFor={`fm-${line.id}`} className="sr-only">Amount</label>
                                      <input id={`fm-${line.id}`} name="amount" type="text" inputMode="decimal" required defaultValue={(Number(line.amount_cents) / 100).toFixed(0)} />
                                    </div>
                                    <div className="field" style={{ flex: '0 1 80px' }}>
                                      <label htmlFor={`fs-${line.id}`} className="sr-only">Order</label>
                                      <input id={`fs-${line.id}`} name="sort" type="number" min={0} max={9999} defaultValue={line.sort} />
                                    </div>
                                    {mayManage ? <Submit className="btn btn-ghost btn-xs" busy="…">Save</Submit> : null}
                                  </fieldset>
                                </ActionForm>
                                {mayManage ? (
                                  <div style={{ padding: '0 14px 10px' }}>
                                    <ActionForm action={deleteFee}>
                                      <input type="hidden" name="id" value={line.id} />
                                      <ConfirmSubmit message={`Delete the "${line.item}" line for ${line.grade}?`}>Delete line</ConfirmSubmit>
                                    </ActionForm>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </RowFilter>
          )}
        </>
      )}
    </>
  );
}
