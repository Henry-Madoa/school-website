'use server';

/*
 * Permission Sets and the accounts that hold them.
 *
 * One rule governs every action in this file, and it is stricter than the Permission Set model
 * itself: **only a System Administrator may change who can do what.** Table rights on web_role or
 * web_user are not enough, because an editor granted Modify on web_role could otherwise write
 * themselves Execute on every page in the catalogue and quietly become an administrator.
 *
 * So each action asks for two things — the named action (which keeps the audit vocabulary
 * consistent with the rest of the admin) and the system flag (which is what actually decides).
 */
import { revalidatePath } from 'next/cache';
import { requireAction, hashPassword } from '@/lib/auth.ts';
import { actionResult, AppError } from '@/lib/errors.ts';
import * as v from '@/lib/validate.ts';
import * as roles from '@/lib/roles.ts';
import type { ActionKey } from '@/lib/permissions.ts';
import type { ActionResult } from '@/lib/types.ts';

const id = (form: FormData, key = 'id'): number => Number(form.get(key) ?? 0);

/** The action's own right, plus the system flag. Both, every time. */
async function requireSystemAdmin(key: ActionKey) {
  const actor = await requireAction(key);
  if (!actor.user.is_system) {
    throw new AppError('Only a System Administrator may change Permission Sets or accounts.', 'FORBIDDEN');
  }
  return actor;
}

const refresh = (...paths: string[]): void => { for (const path of paths) revalidatePath(path); };

/* =============================================================== permission sets */

export async function saveRole(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireSystemAdmin('ROLES_MANAGE');
    const input = { name: form.get('name'), description: form.get('description') };

    if (editing) {
      await roles.updateRole(editing, input, actor);
      refresh('/admin/security/roles', `/admin/security/roles/${editing}`);
      return { id: editing };
    }
    const created = await roles.createRole(input, actor);
    refresh('/admin/security/roles');
    return { id: created };
  });
}

export async function deleteRole(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireSystemAdmin('ROLES_MANAGE');
    await roles.deleteRole(id(form), actor);
    refresh('/admin/security/roles');
    return { ok: true as const };
  });
}

/**
 * Saves the whole permission grid at once. The editor is a screenful of checkboxes and one Save,
 * and a half-applied grid is a Permission Set nobody can reason about — so lib/roles.ts replaces
 * the lines inside a transaction.
 */
export async function saveRolePermissions(_prev: unknown, form: FormData): Promise<ActionResult<{ lines: number }>> {
  return actionResult(async () => {
    const actor = await requireSystemAdmin('ROLES_MANAGE');
    const roleId = id(form, 'role_id');
    const lines = await roles.saveRoleLines(roleId, roles.linesFromForm(form), actor);
    refresh('/admin/security/roles', `/admin/security/roles/${roleId}`);
    return { lines };
  });
}

/** The "give this set everything these jobs need" shortcut in the editor. */
export async function grantRoleActions(_prev: unknown, form: FormData): Promise<ActionResult<{ lines: number }>> {
  return actionResult(async () => {
    const actor = await requireSystemAdmin('ROLES_MANAGE');
    const roleId = id(form, 'role_id');
    const keys = form.getAll('actions').map((value) => String(value) as ActionKey);
    const lines = await roles.grantActions(roleId, keys, actor);
    refresh('/admin/security/roles', `/admin/security/roles/${roleId}`);
    return { lines };
  });
}

/* ======================================================================= accounts */

export async function saveUser(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireSystemAdmin('USERS_MANAGE');

    const input: roles.UserInput = {
      name: form.get('name'),
      email: form.get('email'),
      roleId: form.get('role_id'),
      title: form.get('title'),
      status: form.get('status'),
      extraRoleIds: form.getAll('extra_roles'),
    };

    if (editing) {
      await roles.updateUser(editing, input, actor);
      refresh('/admin/security/users', `/admin/security/users/${editing}`);
      return { id: editing };
    }

    // A new account is created with a password the administrator hands over, and is made to
    // change it at first sign-in — so the one the administrator knows stops working immediately.
    const password = v.password(form.get('password'));
    const created = await roles.createUser(input, await hashPassword(password), actor);
    refresh('/admin/security/users');
    return { id: created };
  });
}

export async function resetUserPassword(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireSystemAdmin('USERS_MANAGE');
    const password = v.password(form.get('password'));
    await roles.setUserPassword(id(form), await hashPassword(password), true, actor);
    refresh('/admin/security/users', `/admin/security/users/${id(form)}`);
    return { ok: true as const };
  });
}

export async function deleteUser(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireSystemAdmin('USERS_MANAGE');
    await roles.deleteUser(id(form), actor);
    refresh('/admin/security/users');
    return { ok: true as const };
  });
}

/** The per-user exceptions to their Permission Sets. Same grid, same rules, one person. */
export async function saveUserPermissions(_prev: unknown, form: FormData): Promise<ActionResult<{ lines: number }>> {
  return actionResult(async () => {
    const actor = await requireSystemAdmin('USERS_MANAGE');
    const userId = id(form, 'user_id');
    const lines = await roles.saveUserOverrides(userId, roles.linesFromForm(form), actor);
    refresh('/admin/security/users', `/admin/security/users/${userId}`);
    return { lines };
  });
}
