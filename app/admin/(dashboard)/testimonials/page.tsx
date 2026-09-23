import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminTestimonials } from '@/lib/content.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { initials } from '@/lib/format.ts';
import { saveTestimonial, deleteTestimonial } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, ImageField, RowFilter, Submit } from '../ui.tsx';

export const metadata = { title: 'Testimonials' };

/**
 * Testimonials are three fields long, so they are edited in the list rather than on a card of
 * their own — one screen, one save per row, no navigation.
 */
export default async function TestimonialsPage() {
  const user = await requirePage('TESTIMONIALS');
  const testimonials = await adminTestimonials();
  const mayEdit = canAction(user, 'TESTIMONIALS_UPDATE');
  const mayCreate = canAction(user, 'TESTIMONIALS_CREATE');
  const mayDelete = canAction(user, 'TESTIMONIALS_DELETE');

  return (
    <>
      <div className="panel">
        <header>
          <div>
            <h2>Testimonials</h2>
            <p>
              {testimonials.length} in total · shown on the home page and the About page.
              Ask the family before you publish what they said.
            </p>
          </div>
        </header>
      </div>

      {mayCreate ? (
        <ActionForm action={saveTestimonial} success="Testimonial added.">
          <div className="panel">
            <header>
              <div><h2>Add a testimonial</h2></div>
              <span style={{ flex: 1 }} />
              <Submit>Add</Submit>
            </header>
            <div className="body">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="new-name">Who said it</label>
                  <input id="new-name" name="name" type="text" required maxLength={120} placeholder="Mercy Atieno" />
                </div>
                <div className="field">
                  <label htmlFor="new-role">Their relationship to the school</label>
                  <input id="new-role" name="role_title" type="text" maxLength={120} placeholder="Parent, Grade 4 and Grade 7" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-quote">What they said</label>
                <textarea id="new-quote" name="quote" required maxLength={1000} placeholder="In their words, not yours — a specific thing that happened beats a general compliment." />
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="new-rating">Stars</label>
                  <select id="new-rating" name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="new-sort">Order</label>
                  <input id="new-sort" name="sort" type="number" min={0} max={9999} defaultValue={testimonials.length} />
                </div>
                <div className="check-row" style={{ alignSelf: 'end' }}>
                  <input id="new-published" name="is_published" type="checkbox" value="1" defaultChecked />
                  <label htmlFor="new-published">Publish</label>
                </div>
              </div>
              <ImageField name="photo" label="Photograph" hint="Optional. Initials are shown if there is none." />
            </div>
          </div>
        </ActionForm>
      ) : null}

      {testimonials.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="big" aria-hidden="true">💬</span>
            <h3>No testimonials yet</h3>
            <p>A parent&rsquo;s own words are worth more than a paragraph of prospectus copy. Ask at the next consultation day.</p>
          </div>
        </div>
      ) : (
        <RowFilter placeholder="Search testimonials by name, relationship or words…">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} style={{ display: 'grid', gap: 8 }} data-filter={`${testimonial.name} ${testimonial.role_title ?? ''} ${testimonial.quote}`}>
            <ActionForm action={saveTestimonial} success="Saved.">
              <input type="hidden" name="id" value={testimonial.id} />
              <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
                <div className="panel">
                  <header>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flex: '0 0 auto',
                        background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: 'var(--brand)',
                        display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.72rem',
                      }}
                    >
                      {testimonial.photo_url
                        ? <img src={cdn(testimonial.photo_url, { width: 80, height: 80 })} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initials(testimonial.name)}
                    </span>
                    <div>
                      <h2>{testimonial.name}</h2>
                      <p>{testimonial.role_title ?? 'No relationship given'}</p>
                    </div>
                    <span style={{ flex: 1 }} />
                    {testimonial.is_published ? <span className="badge badge-ok">Live</span> : <span className="badge badge-warn">Hidden</span>}
                    {mayEdit ? <Submit className="btn btn-ghost btn-xs">Save</Submit> : null}
                  </header>
                  <div className="body">
                    <div className="grid-2">
                      <div className="field">
                        <label htmlFor={`name-${testimonial.id}`}>Who said it</label>
                        <input id={`name-${testimonial.id}`} name="name" type="text" required maxLength={120} defaultValue={testimonial.name} />
                      </div>
                      <div className="field">
                        <label htmlFor={`role-${testimonial.id}`}>Relationship</label>
                        <input id={`role-${testimonial.id}`} name="role_title" type="text" maxLength={120} defaultValue={testimonial.role_title ?? ''} />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`quote-${testimonial.id}`}>What they said</label>
                      <textarea id={`quote-${testimonial.id}`} name="quote" required maxLength={1000} defaultValue={testimonial.quote} />
                    </div>
                    <div className="grid-3">
                      <div className="field">
                        <label htmlFor={`rating-${testimonial.id}`}>Stars</label>
                        <select id={`rating-${testimonial.id}`} name="rating" defaultValue={String(testimonial.rating)}>
                          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`sort-${testimonial.id}`}>Order</label>
                        <input id={`sort-${testimonial.id}`} name="sort" type="number" min={0} max={9999} defaultValue={testimonial.sort} />
                      </div>
                      <div className="check-row" style={{ alignSelf: 'end' }}>
                        <input id={`pub-${testimonial.id}`} name="is_published" type="checkbox" value="1" defaultChecked={testimonial.is_published} />
                        <label htmlFor={`pub-${testimonial.id}`}>Publish</label>
                      </div>
                    </div>
                    <ImageField name="photo" label="Photograph" current={testimonial.photo_url} />
                  </div>
                  {mayDelete ? (
                    <footer>
                      <span className="help" style={{ flex: 1 }}>Deleting removes the quotation and its photograph for good.</span>
                    </footer>
                  ) : null}
                </div>
              </fieldset>
            </ActionForm>
            {mayDelete ? (
              <ActionForm action={deleteTestimonial}>
                <input type="hidden" name="id" value={testimonial.id} />
                <ConfirmSubmit message={`Delete the testimonial from ${testimonial.name}?`}>Delete this testimonial</ConfirmSubmit>
              </ActionForm>
            ) : null}
            </div>
          ))}
        </RowFilter>
      )}
    </>
  );
}
