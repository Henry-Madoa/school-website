import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { saveStaff } from '@/app/actions/content.ts';
import { ActionFormRedirect, Submit } from '../../ui.tsx';
import { StaffFields } from '../staff-fields.tsx';

export const metadata = { title: 'Add a profile' };

export default async function NewStaffPage() {
  const user = await requirePage('PEOPLE');
  if (!canAction(user, 'PEOPLE_CREATE')) redirect('/admin/people');

  return (
    <>
      <div className="crumb"><Link href="/admin/people">Staff &amp; leadership</Link><span aria-hidden="true">›</span>New</div>

      <ActionFormRedirect action={saveStaff} to="/admin/people/:id">
        <div className="panel">
          <header>
            <div><h2>Add a profile</h2></div>
            <span style={{ flex: 1 }} />
            <Link href="/admin/people" className="btn btn-ghost btn-xs">Cancel</Link>
            <Submit>Save profile</Submit>
          </header>
          <div className="body">
            <StaffFields />
          </div>
        </div>
      </ActionFormRedirect>
    </>
  );
}
