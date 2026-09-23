import { STAFF_CATEGORIES, type Staff } from '@/lib/types.ts';
import { ImageField } from '../ui.tsx';

export function StaffFields({ person }: { person?: Staff }) {
  return (
    <div className="grid-side">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" type="text" required maxLength={120} defaultValue={person?.name} placeholder="Dr Agnes Wanjiru Kamau" />
          </div>
          <div className="field">
            <label htmlFor="role_title">Role</label>
            <input id="role_title" name="role_title" type="text" required maxLength={120} defaultValue={person?.role_title} placeholder="Principal" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="qualification">Qualification</label>
          <input id="qualification" name="qualification" type="text" maxLength={200} defaultValue={person?.qualification ?? ''} placeholder="PhD Education Leadership, University of Nairobi" />
        </div>

        <div className="field">
          <label htmlFor="bio">A short biography</label>
          <textarea id="bio" name="bio" maxLength={3000} defaultValue={person?.bio ?? ''} placeholder="Two or three sentences a parent would find useful — how long they have been here, what they teach, what they are known for." />
          <p className="help">Kept short on purpose. A wall of text is a wall nobody reads.</p>
        </div>

        <ImageField name="photo" label="Photograph" current={person?.photo_url} hint="A head-and-shoulders photograph works best; it is shown as a circle." />
      </div>

      <aside>
        <div className="panel">
          <header><h2>Listing</h2></header>
          <div className="body">
            <div className="field">
              <label htmlFor="category">Section</label>
              <select id="category" name="category" defaultValue={person?.category ?? 'TEACHING'}>
                {STAFF_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
              <p className="help">School leadership also appears on the About page.</p>
            </div>

            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" maxLength={160} defaultValue={person?.email ?? ''} />
              <p className="help">Optional, and published — leave it empty if it should not be.</p>
            </div>

            <div className="field">
              <label htmlFor="sort">Order</label>
              <input id="sort" name="sort" type="number" min={0} max={9999} defaultValue={person?.sort ?? 0} />
              <p className="help">Lower numbers come first within the section.</p>
            </div>

            <div className="check-row">
              <input id="is_published" name="is_published" type="checkbox" value="1" defaultChecked={person?.is_published ?? true} />
              <label htmlFor="is_published">
                Show on the website
                <span className="help">Untick when somebody leaves, rather than deleting them mid-term.</span>
              </label>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
