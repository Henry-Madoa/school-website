import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminStaffMember } from '@/lib/content.ts';
import { saveStaff, deleteStaff } from '@/app/actions/content.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, Submit } from '../../ui.tsx';
import { StaffFields } from '../staff-fields.tsx';

export const metadata = { title: 'Staff profile' };

export default async function StaffCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('PEOPLE');
  const person = await adminStaffMember(Number(id));
  if (!person) notFound();

  const mayEdit = canAction(user, 'PEOPLE_UPDATE');

  return (
    <>
      <div className="crumb"><Link href="/admin/people">Staff &amp; leadership</Link><span aria-hidden="true">›</span>{person.name}</div>

      {!mayEdit ? <div className="note note-info">Your Permission Set lets you read this screen but not change it.</div> : null}

      <ActionForm action={saveStaff} success="Saved.">
        <input type="hidden" name="id" value={person.id} />
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{person.name}</h2>
                <p>{person.role_title}</p>
              </div>
              <span style={{ flex: 1 }} />
              <Link href="/staff" target="_blank" className="btn btn-ghost btn-xs">View ↗</Link>
              <Link href="/admin/people" className="btn btn-ghost btn-xs">Back</Link>
              {mayEdit ? <Submit>Save changes</Submit> : null}
            </header>
            <div className="body">
              <StaffFields person={person} />
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {canAction(user, 'PEOPLE_DELETE') ? (
        <div className="panel">
          <header><h2>Remove this profile</h2></header>
          <div className="body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <p className="help" style={{ margin: 0, flex: '1 1 320px' }}>
              If somebody has simply left, untick &ldquo;Show on the website&rdquo; instead — that keeps the record and
              takes them off the page.
            </p>
            <ActionFormRedirect action={deleteStaff} to="/admin/people">
              <input type="hidden" name="id" value={person.id} />
              <ConfirmSubmit message={`Delete ${person.name}'s profile and photograph?`} className="btn btn-danger">
                Delete profile
              </ConfirmSubmit>
            </ActionFormRedirect>
          </div>
        </div>
      ) : null}
    </>
  );
}
