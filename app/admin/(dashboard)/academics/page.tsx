import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction, canPage } from '@/lib/permissions.ts';
import { adminLevels } from '@/lib/content.ts';
import { saveLevel, deleteLevel, addGrade, deleteGrade, addSubject, deleteSubject } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, ImageField, RowFilter, Submit } from '../ui.tsx';

export const metadata = { title: 'Academic structure' };

/**
 * What the school teaches, as the website publishes it.
 *
 * This is the website's own record, not a copy of the management system's — the site publishes
 * what the school wants published, and nothing here can reach a pupil, a mark or a register.
 */
export default async function AcademicsPage() {
  const user = await requirePage('ACADEMICS');
  const levels = await adminLevels();
  const mayManage = canAction(user, 'ACADEMICS_MANAGE');

  return (
    <>
      <div className="tabs">
        <Link href="/admin/academics" aria-current="page">Levels &amp; subjects</Link>
        {canPage(user, 'ACADEMICS_TERMS') ? <Link href="/admin/academics/terms">Term dates</Link> : null}
        {canPage(user, 'ACADEMICS_FEES') ? <Link href="/admin/academics/fees">Fee structure</Link> : null}
      </div>

      <div className="panel">
        <header>
          <div>
            <h2>Levels, grades and learning areas</h2>
            <p>
              {levels.length} level{levels.length === 1 ? '' : 's'} ·{' '}
              {levels.reduce((n, level) => n + level.grades.length, 0)} grades ·{' '}
              {levels.reduce((n, level) => n + level.subjects.length, 0)} learning areas
            </p>
          </div>
        </header>
      </div>

      {mayManage ? (
        <ActionForm action={saveLevel} success="Level added.">
          <div className="panel">
            <header>
              <div><h2>Add a level</h2></div>
              <span style={{ flex: 1 }} />
              <Submit>Add level</Submit>
            </header>
            <div className="body">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="new-level-name">Name</label>
                  <input id="new-level-name" name="name" type="text" required maxLength={120} placeholder="Junior Secondary" />
                </div>
                <div className="field">
                  <label htmlFor="new-level-tagline">One-line description</label>
                  <input id="new-level-tagline" name="tagline" type="text" maxLength={200} placeholder="Grade 7 to Grade 9" />
                </div>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="new-level-age">Entry age</label>
                  <input id="new-level-age" name="age_note" type="text" maxLength={200} placeholder="From 12 years" />
                </div>
                <div className="field">
                  <label htmlFor="new-level-sort">Order</label>
                  <input id="new-level-sort" name="sort" type="number" min={0} max={9999} defaultValue={levels.length} />
                </div>
                <div className="check-row" style={{ alignSelf: 'end' }}>
                  <input id="new-level-pub" name="is_published" type="checkbox" value="1" defaultChecked />
                  <label htmlFor="new-level-pub">Publish</label>
                </div>
              </div>
            </div>
          </div>
        </ActionForm>
      ) : null}

      {levels.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="big" aria-hidden="true">🎓</span>
            <h3>No levels yet</h3>
            <p>A level is a stage of the school — Pre-Primary, Lower Primary, and so on. Grades and learning areas sit inside one.</p>
          </div>
        </div>
      ) : (
        <RowFilter placeholder="Search levels, grades and learning areas…">
          {levels.map((level) => (
            <div key={level.id} className="panel" data-filter-group={`${level.name} ${level.tagline ?? ''}`}>
              <header>
                <div>
                  <h2>{level.name}</h2>
                  <p>
                    {level.grades.map((grade) => grade.name).join(' · ') || 'No grades yet'} ·{' '}
                    {level.subjects.length} learning area{level.subjects.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span style={{ flex: 1 }} />
                {level.is_published ? <span className="badge badge-ok">Live</span> : <span className="badge badge-warn">Hidden</span>}
                {level.is_published ? <Link href={`/academics/${level.slug}`} target="_blank" className="btn btn-ghost btn-xs">View ↗</Link> : null}
              </header>

              <div className="body">
                <ActionForm action={saveLevel} success="Level saved.">
                  <input type="hidden" name="id" value={level.id} />
                  <fieldset disabled={!mayManage} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 16 }}>
                    <div className="grid-2">
                      <div className="field">
                        <label htmlFor={`ln-${level.id}`}>Name</label>
                        <input id={`ln-${level.id}`} name="name" type="text" required maxLength={120} defaultValue={level.name} />
                      </div>
                      <div className="field">
                        <label htmlFor={`lt-${level.id}`}>One-line description</label>
                        <input id={`lt-${level.id}`} name="tagline" type="text" maxLength={200} defaultValue={level.tagline ?? ''} />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor={`ld-${level.id}`}>What it is like</label>
                      <textarea id={`ld-${level.id}`} name="description" maxLength={4000} defaultValue={level.description ?? ''} placeholder="A paragraph a parent would recognise their own child in." />
                    </div>

                    <div className="grid-2">
                      <div className="field">
                        <label htmlFor={`la-${level.id}`}>Entry age</label>
                        <input id={`la-${level.id}`} name="age_note" type="text" maxLength={200} defaultValue={level.age_note ?? ''} />
                      </div>
                      <div className="field">
                        <label htmlFor={`le-${level.id}`}>Entry requirement</label>
                        <input id={`le-${level.id}`} name="entry_note" type="text" maxLength={400} defaultValue={level.entry_note ?? ''} placeholder="Placement assessment in reading and numbers." />
                      </div>
                    </div>

                    <ImageField name="image" label="Photograph" current={level.image_url} />

                    <div className="grid-3">
                      <div className="field">
                        <label htmlFor={`ls-${level.id}`}>Order</label>
                        <input id={`ls-${level.id}`} name="sort" type="number" min={0} max={9999} defaultValue={level.sort} />
                      </div>
                      <div className="check-row" style={{ alignSelf: 'end' }}>
                        <input id={`lp-${level.id}`} name="is_published" type="checkbox" value="1" defaultChecked={level.is_published} />
                        <label htmlFor={`lp-${level.id}`}>Publish</label>
                      </div>
                      {mayManage ? <div style={{ alignSelf: 'end' }}><Submit className="btn btn-ghost btn-xs">Save level</Submit></div> : null}
                    </div>
                  </fieldset>
                </ActionForm>

                <div className="grid-2" style={{ marginTop: 20 }}>
                  {/* ------------------------------------------------------- grades */}
                  <div>
                    <h3 style={{ fontSize: '0.88rem', marginBottom: 10 }}>Grades</h3>
                    <table className="list">
                      <tbody>
                        {level.grades.map((grade) => (
                          <tr key={grade.id} data-filter={grade.name}>
                            <td>{grade.name}</td>
                            <td className="actions">
                              {mayManage ? (
                                <ActionForm action={deleteGrade}>
                                  <input type="hidden" name="id" value={grade.id} />
                                  <input type="hidden" name="level_id" value={level.id} />
                                  <ConfirmSubmit message={`Remove ${grade.name}? Any fee lines and enquiries pointing at it lose the link.`}>Remove</ConfirmSubmit>
                                </ActionForm>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {level.grades.length === 0 ? <tr data-filter=""><td className="help">No grades yet.</td><td /></tr> : null}
                      </tbody>
                    </table>

                    {mayManage ? (
                      <ActionForm action={addGrade}>
                        <input type="hidden" name="level_id" value={level.id} />
                        <div className="toolbar" style={{ marginTop: 10 }}>
                          <div className="grow">
                            <label htmlFor={`ng-${level.id}`} className="sr-only">New grade</label>
                            <input id={`ng-${level.id}`} name="name" type="text" required maxLength={60} placeholder="Grade 9" />
                          </div>
                          <input name="sort" type="hidden" value={level.grades.length} />
                          <Submit className="btn btn-ghost btn-xs" busy="…">Add grade</Submit>
                        </div>
                      </ActionForm>
                    ) : null}
                  </div>

                  {/* ----------------------------------------------------- subjects */}
                  <div>
                    <h3 style={{ fontSize: '0.88rem', marginBottom: 10 }}>Learning areas</h3>
                    <table className="list">
                      <tbody>
                        {level.subjects.map((subject) => (
                          <tr key={subject.id} data-filter={`${subject.name} ${subject.is_core ? 'Core' : 'Elective'}`}>
                            <td>
                              {subject.name}
                              {subject.is_core ? <span className="badge badge-brand" style={{ marginLeft: 8 }}>Core</span> : <span className="badge" style={{ marginLeft: 8 }}>Elective</span>}
                            </td>
                            <td className="actions">
                              {mayManage ? (
                                <ActionForm action={deleteSubject}>
                                  <input type="hidden" name="id" value={subject.id} />
                                  <input type="hidden" name="level_id" value={level.id} />
                                  <ConfirmSubmit message={`Remove ${subject.name}?`}>Remove</ConfirmSubmit>
                                </ActionForm>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {level.subjects.length === 0 ? <tr data-filter=""><td className="help">No learning areas yet.</td><td /></tr> : null}
                      </tbody>
                    </table>

                    {mayManage ? (
                      <ActionForm action={addSubject}>
                        <input type="hidden" name="level_id" value={level.id} />
                        <div className="toolbar" style={{ marginTop: 10 }}>
                          <div className="grow">
                            <label htmlFor={`ns-${level.id}`} className="sr-only">New learning area</label>
                            <input id={`ns-${level.id}`} name="name" type="text" required maxLength={80} placeholder="Integrated Science" />
                          </div>
                          <label className="check-row" style={{ padding: 0 }}>
                            <input name="is_core" type="checkbox" value="1" defaultChecked />
                            <span style={{ fontSize: '0.8rem' }}>Core</span>
                          </label>
                          <Submit className="btn btn-ghost btn-xs" busy="…">Add</Submit>
                        </div>
                      </ActionForm>
                    ) : null}
                  </div>
                </div>
              </div>

              {mayManage ? (
                <footer>
                  <span className="help" style={{ flex: 1 }}>
                    Deleting a level removes its grades and learning areas with it.
                  </span>
                  <ActionForm action={deleteLevel}>
                    <input type="hidden" name="id" value={level.id} />
                    <ConfirmSubmit message={`Delete ${level.name}, its ${level.grades.length} grade(s) and ${level.subjects.length} learning area(s)?`}>
                      Delete level
                    </ConfirmSubmit>
                  </ActionForm>
                </footer>
              ) : null}
            </div>
          ))}
        </RowFilter>
      )}
    </>
  );
}
