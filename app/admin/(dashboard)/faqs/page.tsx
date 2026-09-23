import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminFaqs } from '@/lib/content.ts';
import { FAQ_CATEGORIES } from '@/lib/types.ts';
import { saveFaq, deleteFaq } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter, Submit } from '../ui.tsx';

export const metadata = { title: 'Questions parents ask' };

/**
 * The questions the admissions office answers on the phone every day, answered once in public.
 *
 * They appear on the Admissions page grouped by category, and the fee and transport ones also
 * appear on their own pages. Published with FAQ structured data, so a search engine can show the
 * answer directly — which is the whole point of writing them down.
 */
export default async function FaqsPage() {
  const user = await requirePage('FAQS');
  const faqs = await adminFaqs();
  const mayEdit = canAction(user, 'FAQS_UPDATE');
  const mayDelete = canAction(user, 'FAQS_DELETE');

  return (
    <>
      <div className="panel">
        <header>
          <div>
            <h2>Questions parents ask</h2>
            <p>
              {faqs.length} question{faqs.length === 1 ? '' : 's'} ·{' '}
              {FAQ_CATEGORIES.map((category) => `${faqs.filter((faq) => faq.category === category.value).length} ${category.label.toLowerCase()}`).join(' · ')}
            </p>
          </div>
        </header>
      </div>

      {canAction(user, 'FAQS_CREATE') ? (
        <ActionForm action={saveFaq} success="Question added.">
          <div className="panel">
            <header>
              <div><h2>Add a question</h2></div>
              <span style={{ flex: 1 }} />
              <Submit>Add</Submit>
            </header>
            <div className="body">
              <div className="field">
                <label htmlFor="new-question">The question, as a parent would ask it</label>
                <input id="new-question" name="question" type="text" required maxLength={300} placeholder="Does the school bus reach Ruaka?" />
              </div>
              <div className="field">
                <label htmlFor="new-answer">The answer</label>
                <textarea id="new-answer" name="answer" required maxLength={4000} placeholder="Answer it properly. A vague answer produces the phone call the question was meant to prevent." />
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="new-category">Category</label>
                  <select id="new-category" name="category" defaultValue="ADMISSIONS">
                    {FAQ_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="new-sort">Order</label>
                  <input id="new-sort" name="sort" type="number" min={0} max={9999} defaultValue={faqs.length} />
                </div>
                <div className="check-row" style={{ alignSelf: 'end' }}>
                  <input id="new-published" name="is_published" type="checkbox" value="1" defaultChecked />
                  <label htmlFor="new-published">Publish</label>
                </div>
              </div>
            </div>
          </div>
        </ActionForm>
      ) : null}

      {faqs.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="big" aria-hidden="true">❓</span>
            <h3>No questions yet</h3>
            <p>Start with the five the office answers most often. Every one you write down is a phone call you do not take.</p>
          </div>
        </div>
      ) : (
        <RowFilter placeholder="Search questions and answers…">
          {FAQ_CATEGORIES.filter((category) => faqs.some((faq) => faq.category === category.value)).map((category) => (
            <div className="panel" key={category.value} data-filter-group={category.label}>
              <header><h2>{category.label}</h2></header>
              <div className="body" style={{ display: 'grid', gap: 12 }}>
                {faqs.filter((faq) => faq.category === category.value).map((faq) => (
                  <div key={faq.id} data-filter={`${faq.question} ${faq.answer}`} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 14 }}>
                    <ActionForm action={saveFaq} success="Saved.">
                      <input type="hidden" name="id" value={faq.id} />
                      <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                        <div className="field">
                          <label htmlFor={`q-${faq.id}`}>Question</label>
                          <input id={`q-${faq.id}`} name="question" type="text" required maxLength={300} defaultValue={faq.question} />
                        </div>
                        <div className="field">
                          <label htmlFor={`a-${faq.id}`}>Answer</label>
                          <textarea id={`a-${faq.id}`} name="answer" required maxLength={4000} defaultValue={faq.answer} style={{ minHeight: 100 }} />
                        </div>
                        <div className="grid-3">
                          <div className="field">
                            <label htmlFor={`c-${faq.id}`}>Category</label>
                            <select id={`c-${faq.id}`} name="category" defaultValue={faq.category}>
                              {FAQ_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`s-${faq.id}`}>Order</label>
                            <input id={`s-${faq.id}`} name="sort" type="number" min={0} max={9999} defaultValue={faq.sort} />
                          </div>
                          <div className="check-row" style={{ alignSelf: 'end' }}>
                            <input id={`p-${faq.id}`} name="is_published" type="checkbox" value="1" defaultChecked={faq.is_published} />
                            <label htmlFor={`p-${faq.id}`}>Publish</label>
                          </div>
                        </div>
                        {mayEdit ? (
                          <div><Submit className="btn btn-ghost btn-xs">Save question</Submit></div>
                        ) : null}
                      </fieldset>
                    </ActionForm>

                    {mayDelete ? (
                      <ActionForm action={deleteFaq}>
                        <input type="hidden" name="id" value={faq.id} />
                        <ConfirmSubmit message="Delete this question and its answer?">Delete</ConfirmSubmit>
                      </ActionForm>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </RowFilter>
      )}
    </>
  );
}
