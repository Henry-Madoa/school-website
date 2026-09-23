import 'server-only';

/*
 * Permission Sets, in the Business Central style the school's management system already uses —
 * so the people who administer the ERP administer the website with the same vocabulary.
 *
 * A role's access is a list of lines, each granting rights on one Object:
 *   - a TABLE  (web_post, web_enquiry …) with Read / Insert / Modify / Delete
 *   - a PAGE   (NEWS, ENQUIRIES …) with Execute — may this screen be reached at all
 *
 * Business operations are rarely one table right. "Publish a notice" touches web_post and has to
 * be reachable from the News page; "record an enquiry outcome" modifies web_enquiry from the
 * Enquiries page. ACTIONS below is the bridge: one named grant of (owning page, table rights[])
 * per operation, built from what the Server Actions actually read and write. A call site asks for
 * one action — `requireAction('NEWS_PUBLISH')` — and the page Execute right and every table right
 * it lists are checked together.
 *
 * The admin-configurable unit, in the Permission Set editor, remains the table and the page.
 * ACTIONS is a registry for the code, not a third kind of object for the administrator.
 */
import { all } from './db.ts';
import type { ObjectType, PermissionLine, PermissionSet, Right } from './types.ts';

export type { ObjectType, PermissionLine, PermissionSet, Right };

/** The shape every check below needs — lib/auth.ts's SessionUser satisfies it. */
export interface PermissionHolder {
  is_system: boolean;
  permissions: PermissionSet;
}

const humanize = (identifier: string): string =>
  identifier.replace(/^web_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/*
 * Tables that must never appear in the Permission Set line editor: the session store, and the
 * permission engine's own storage. Granting raw Insert/Modify on web_permission_line would be a
 * privilege-escalation hole — anyone with it could write themselves any right they liked.
 */
const EXCLUDED_TABLES = new Set([
  'web_session', 'web_permission_line', 'web_user_permission_line', 'web_user_role', 'web_counter',
]);

/**
 * The live set of tables a Permission Set line may target, read from the database itself rather
 * than a hand-kept list — so a table added to lib/schema.sql appears in the editor with no code
 * change. Only this application's own `web_` tables are offered: a database shared with the
 * management system must not expose its tables here.
 */
export async function listPermissionTables(): Promise<{ name: string; label: string }[]> {
  const rows = await all<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' AND table_name LIKE 'web\\_%'
     ORDER BY table_name`,
  );
  return rows.filter((r) => !EXCLUDED_TABLES.has(r.table_name)).map((r) => ({ name: r.table_name, label: humanize(r.table_name) }));
}

/* ============================================================================ pages */

export interface PageObject {
  code: string;
  label: string;
  route: string;
  icon?: string;
  /**
   * The module this screen sits inside. Execute on the parent opens the module; Execute on the
   * child opens that screen. A seeded role granted the parent gets every child with it, so a
   * Permission Set starts with the whole module and the administrator takes screens away.
   */
  parent?: string;
  /** Hidden from the sidebar — reached from inside another screen. */
  nested?: boolean;
}

/** Pages are compiled routes, not database rows, so this catalogue is maintained by hand. */
export const PAGES: PageObject[] = [
  { code: 'DASHBOARD', label: 'Dashboard', route: '/admin', icon: '◆' },

  { code: 'NEWS', label: 'News & notices', route: '/admin/news', icon: '📰' },
  { code: 'EVENTS', label: 'Events', route: '/admin/events', icon: '📅' },
  { code: 'EVENTS_RSVPS', label: 'Events › Bookings', route: '/admin/events/bookings', parent: 'EVENTS', nested: true },
  { code: 'GALLERY', label: 'Photo gallery', route: '/admin/gallery', icon: '🖼' },
  { code: 'PEOPLE', label: 'Staff & leadership', route: '/admin/people', icon: '👥' },
  { code: 'TESTIMONIALS', label: 'Testimonials', route: '/admin/testimonials', icon: '💬' },
  { code: 'FAQS', label: 'Questions parents ask', route: '/admin/faqs', icon: '❓' },

  { code: 'ACADEMICS', label: 'Academic structure', route: '/admin/academics', icon: '🎓' },
  { code: 'ACADEMICS_TERMS', label: 'Academics › Term dates', route: '/admin/academics/terms', parent: 'ACADEMICS' },
  { code: 'ACADEMICS_FEES', label: 'Academics › Fee structure', route: '/admin/academics/fees', parent: 'ACADEMICS' },
  { code: 'TRANSPORT', label: 'Bus routes', route: '/admin/transport', icon: '🚌' },

  { code: 'ENQUIRIES', label: 'Enquiries & visits', route: '/admin/enquiries', icon: '📥' },
  { code: 'APPLICATIONS', label: 'Applications', route: '/admin/applications', icon: '📝' },
  { code: 'SUBSCRIBERS', label: 'Newsletter list', route: '/admin/subscribers', icon: '✉' },

  { code: 'SETTINGS', label: 'School profile & theme', route: '/admin/settings', icon: '⚙' },

  { code: 'SECURITY', label: 'Security', route: '/admin/security', icon: '🔐' },
  { code: 'SECURITY_USERS', label: 'Security › Users', route: '/admin/security/users', parent: 'SECURITY' },
  { code: 'SECURITY_ROLES', label: 'Security › Permission Sets', route: '/admin/security/roles', parent: 'SECURITY' },
  { code: 'SECURITY_AUDIT', label: 'Security › Audit trail', route: '/admin/security/audit', parent: 'SECURITY' },
];

export const pageByCode = (code: string): PageObject | undefined => PAGES.find((p) => p.code === code);

/** The screens inside a module — the tabs of Academics, of Security. */
export const childPages = (parent: string): PageObject[] => PAGES.filter((p) => p.parent === parent);

/* ========================================================================== actions */

export interface ActionGrant {
  /** The screen the operation is reached from. */
  page: string;
  /** Every table right the operation needs, as the Server Action actually uses them. */
  tables: readonly (readonly [table: string, right: Right])[];
}

export const ACTIONS = {
  /* News & notices */
  NEWS_READ: { page: 'NEWS', tables: [['web_post', 'read']] },
  NEWS_CREATE: { page: 'NEWS', tables: [['web_post', 'insert']] },
  NEWS_UPDATE: { page: 'NEWS', tables: [['web_post', 'modify']] },
  NEWS_DELETE: { page: 'NEWS', tables: [['web_post', 'delete']] },

  /* Events and their bookings */
  EVENTS_READ: { page: 'EVENTS', tables: [['web_event', 'read']] },
  EVENTS_CREATE: { page: 'EVENTS', tables: [['web_event', 'insert']] },
  EVENTS_UPDATE: { page: 'EVENTS', tables: [['web_event', 'modify']] },
  EVENTS_DELETE: { page: 'EVENTS', tables: [['web_event', 'delete']] },
  EVENTS_RSVP_READ: { page: 'EVENTS_RSVPS', tables: [['web_rsvp', 'read'], ['web_event', 'read']] },
  EVENTS_RSVP_DELETE: { page: 'EVENTS_RSVPS', tables: [['web_rsvp', 'delete']] },

  /* Gallery — an album and its photographs move together */
  GALLERY_READ: { page: 'GALLERY', tables: [['web_album', 'read'], ['web_photo', 'read']] },
  GALLERY_CREATE: { page: 'GALLERY', tables: [['web_album', 'insert']] },
  GALLERY_UPDATE: { page: 'GALLERY', tables: [['web_album', 'modify']] },
  GALLERY_DELETE: { page: 'GALLERY', tables: [['web_album', 'delete'], ['web_photo', 'delete']] },
  GALLERY_PHOTO_ADD: { page: 'GALLERY', tables: [['web_photo', 'insert'], ['web_album', 'modify']] },
  GALLERY_PHOTO_UPDATE: { page: 'GALLERY', tables: [['web_photo', 'modify']] },
  GALLERY_PHOTO_DELETE: { page: 'GALLERY', tables: [['web_photo', 'delete']] },

  /* People */
  PEOPLE_READ: { page: 'PEOPLE', tables: [['web_staff', 'read']] },
  PEOPLE_CREATE: { page: 'PEOPLE', tables: [['web_staff', 'insert']] },
  PEOPLE_UPDATE: { page: 'PEOPLE', tables: [['web_staff', 'modify']] },
  PEOPLE_DELETE: { page: 'PEOPLE', tables: [['web_staff', 'delete']] },

  TESTIMONIALS_READ: { page: 'TESTIMONIALS', tables: [['web_testimonial', 'read']] },
  TESTIMONIALS_CREATE: { page: 'TESTIMONIALS', tables: [['web_testimonial', 'insert']] },
  TESTIMONIALS_UPDATE: { page: 'TESTIMONIALS', tables: [['web_testimonial', 'modify']] },
  TESTIMONIALS_DELETE: { page: 'TESTIMONIALS', tables: [['web_testimonial', 'delete']] },

  FAQS_READ: { page: 'FAQS', tables: [['web_faq', 'read']] },
  FAQS_CREATE: { page: 'FAQS', tables: [['web_faq', 'insert']] },
  FAQS_UPDATE: { page: 'FAQS', tables: [['web_faq', 'modify']] },
  FAQS_DELETE: { page: 'FAQS', tables: [['web_faq', 'delete']] },

  /* Academic structure */
  ACADEMICS_READ: { page: 'ACADEMICS', tables: [['web_level', 'read'], ['web_grade', 'read'], ['web_subject', 'read']] },
  ACADEMICS_MANAGE: {
    page: 'ACADEMICS',
    tables: [
      ['web_level', 'insert'], ['web_level', 'modify'], ['web_level', 'delete'],
      ['web_grade', 'insert'], ['web_grade', 'delete'],
      ['web_subject', 'insert'], ['web_subject', 'delete'],
    ],
  },
  TERMS_READ: { page: 'ACADEMICS_TERMS', tables: [['web_term', 'read']] },
  TERMS_MANAGE: { page: 'ACADEMICS_TERMS', tables: [['web_term', 'insert'], ['web_term', 'modify'], ['web_term', 'delete']] },
  FEES_READ: { page: 'ACADEMICS_FEES', tables: [['web_fee', 'read'], ['web_term', 'read'], ['web_grade', 'read']] },
  FEES_MANAGE: { page: 'ACADEMICS_FEES', tables: [['web_fee', 'insert'], ['web_fee', 'modify'], ['web_fee', 'delete']] },

  TRANSPORT_READ: { page: 'TRANSPORT', tables: [['web_route', 'read'], ['web_stop', 'read']] },
  TRANSPORT_MANAGE: {
    page: 'TRANSPORT',
    tables: [
      ['web_route', 'insert'], ['web_route', 'modify'], ['web_route', 'delete'],
      ['web_stop', 'insert'], ['web_stop', 'modify'], ['web_stop', 'delete'],
    ],
  },

  /* What visitors send in */
  ENQUIRIES_READ: { page: 'ENQUIRIES', tables: [['web_enquiry', 'read']] },
  ENQUIRIES_UPDATE: { page: 'ENQUIRIES', tables: [['web_enquiry', 'modify']] },
  ENQUIRIES_DELETE: { page: 'ENQUIRIES', tables: [['web_enquiry', 'delete']] },

  APPLICATIONS_READ: { page: 'APPLICATIONS', tables: [['web_application', 'read']] },
  APPLICATIONS_UPDATE: { page: 'APPLICATIONS', tables: [['web_application', 'modify']] },
  APPLICATIONS_DELETE: { page: 'APPLICATIONS', tables: [['web_application', 'delete']] },

  SUBSCRIBERS_READ: { page: 'SUBSCRIBERS', tables: [['web_subscriber', 'read']] },
  SUBSCRIBERS_UPDATE: { page: 'SUBSCRIBERS', tables: [['web_subscriber', 'modify']] },
  SUBSCRIBERS_DELETE: { page: 'SUBSCRIBERS', tables: [['web_subscriber', 'delete']] },

  /* The school's own record and the site's theme */
  SETTINGS_READ: { page: 'SETTINGS', tables: [['web_setting', 'read']] },
  SETTINGS_MANAGE: { page: 'SETTINGS', tables: [['web_setting', 'modify']] },

  /* Security */
  USERS_READ: { page: 'SECURITY_USERS', tables: [['web_user', 'read'], ['web_role', 'read']] },
  USERS_MANAGE: { page: 'SECURITY_USERS', tables: [['web_user', 'insert'], ['web_user', 'modify'], ['web_user', 'delete']] },
  ROLES_READ: { page: 'SECURITY_ROLES', tables: [['web_role', 'read']] },
  ROLES_MANAGE: { page: 'SECURITY_ROLES', tables: [['web_role', 'insert'], ['web_role', 'modify'], ['web_role', 'delete']] },
  AUDIT_READ: { page: 'SECURITY_AUDIT', tables: [['web_audit', 'read']] },
} as const satisfies Record<string, ActionGrant>;

export type ActionKey = keyof typeof ACTIONS;

/* =========================================================================== checks */

export function canTable(user: PermissionHolder | null | undefined, table: string, right: Right): boolean {
  if (!user) return false;
  if (user.is_system) return true;
  return !!user.permissions.tables[table]?.[right];
}

export function canPage(user: PermissionHolder | null | undefined, page: string): boolean {
  if (!user) return false;
  if (user.is_system) return true;
  return !!user.permissions.pages[page];
}

/**
 * The check a Server Action and a page both make. Both halves matter: a Permission Set that
 * grants Modify on web_post but not Execute on the News page has given nobody anything, and a
 * set that grants the page without the table right opens a screen that cannot save.
 */
export function canAction(user: PermissionHolder | null | undefined, key: ActionKey): boolean {
  if (!user) return false;
  if (user.is_system) return true;
  const grant: ActionGrant = ACTIONS[key];
  return canPage(user, grant.page) && grant.tables.every(([table, right]) => canTable(user, table, right));
}

/**
 * The "can open and actually read this screen" action for a page — its `*_READ` action, where one
 * exists. Screens with only a `*_MANAGE` action need page Execute alone.
 */
const PAGE_READ_ACTION: Partial<Record<string, ActionKey>> = (() => {
  const map: Partial<Record<string, ActionKey>> = {};
  const keys = Object.keys(ACTIONS) as ActionKey[];
  for (const { code } of PAGES) {
    const read = keys.find((k) => (ACTIONS[k] as ActionGrant).page === code && /_READ$/.test(k));
    if (read) map[code] = read;
  }
  return map;
})();

/**
 * Whether a sidebar entry should appear. Stricter than a bare `canPage`: where a screen has a
 * read action, the user must satisfy that too — so a Permission Set granting page Execute but not
 * the underlying table Read no longer surfaces a module the user cannot use.
 */
export function canNav(user: PermissionHolder | null | undefined, pages: string | string[]): boolean {
  if (!user) return false;
  if (user.is_system) return true;
  const codes = Array.isArray(pages) ? pages : [pages];
  return codes.some((code) => {
    if (!canPage(user, code)) return false;
    const read = PAGE_READ_ACTION[code];
    return read ? canAction(user, read) : true;
  });
}

/** Every top-level sidebar entry this user may see, in catalogue order. */
export const visiblePages = (user: PermissionHolder | null | undefined): PageObject[] =>
  PAGES.filter((p) => !p.parent && !p.nested && canNav(user, p.code));

/* ===================================================================== line building */

/**
 * Resolves a list of ACTIONS keys into the deduplicated lines an administrator clicking through
 * the Permission Set editor would have produced by hand. Used by the seed, and by the "grant
 * everything this role needs" button in the editor.
 */
export function expandActionsToLines(actionKeys: readonly ActionKey[]): PermissionLine[] {
  const pages = new Set<string>();
  const tables = new Map<string, Record<Right, boolean>>();

  for (const key of actionKeys) {
    const grant: ActionGrant = ACTIONS[key];
    pages.add(grant.page);
    // A module's screens come with the module, so a seeded role opens every tab of it.
    for (const child of childPages(grant.page)) pages.add(child.code);
    // …and a child screen needs its parent module to be reachable at all.
    const parent = pageByCode(grant.page)?.parent;
    if (parent) pages.add(parent);
    for (const [table, right] of grant.tables) {
      const row = tables.get(table) ?? { read: false, insert: false, modify: false, delete: false };
      row[right] = true;
      // Anything you may change, you may look at.
      row.read = true;
      tables.set(table, row);
    }
  }

  return [
    ...[...pages].map((page): PermissionLine => ({
      object_type: 'PAGE', object_name: page,
      read_perm: false, insert_perm: false, modify_perm: false, delete_perm: false, execute_perm: true,
    })),
    ...[...tables.entries()].map(([table, rights]): PermissionLine => ({
      object_type: 'TABLE', object_name: table,
      read_perm: rights.read, insert_perm: rights.insert, modify_perm: rights.modify, delete_perm: rights.delete,
      execute_perm: false,
    })),
  ];
}

/** Folds a set of stored lines into the lookup the checks above use. */
export function linesToPermissions(lines: PermissionLine[]): PermissionSet {
  const permissions: PermissionSet = { tables: {}, pages: {} };
  for (const line of lines) {
    if (line.object_type === 'PAGE') {
      if (line.execute_perm) permissions.pages[line.object_name] = true;
      continue;
    }
    const table = permissions.tables[line.object_name] ?? {};
    if (line.read_perm) table.read = true;
    if (line.insert_perm) table.insert = true;
    if (line.modify_perm) table.modify = true;
    if (line.delete_perm) table.delete = true;
    permissions.tables[line.object_name] = table;
  }
  return permissions;
}

/* ================================================================== the standard sets */

/**
 * The Permission Sets the seed creates. They are ordinary rows: an administrator can edit any of
 * them line by line, or build their own from scratch. `SYSTEM` has no lines — full access comes
 * from the flag, exactly as the management system does it.
 */
export const STANDARD_ROLES: { name: string; description: string; isSystem?: boolean; actions?: readonly ActionKey[] }[] = [
  {
    name: 'System Administrator',
    description: 'Unrestricted access, including users, Permission Sets and the audit trail.',
    isSystem: true,
  },
  {
    name: 'Website Editor',
    description: 'Publishes news, events, photographs, staff profiles and questions. Cannot see enquiries or change the school profile.',
    actions: [
      'NEWS_READ', 'NEWS_CREATE', 'NEWS_UPDATE', 'NEWS_DELETE',
      'EVENTS_READ', 'EVENTS_CREATE', 'EVENTS_UPDATE', 'EVENTS_DELETE',
      'GALLERY_READ', 'GALLERY_CREATE', 'GALLERY_UPDATE', 'GALLERY_DELETE', 'GALLERY_PHOTO_ADD', 'GALLERY_PHOTO_UPDATE', 'GALLERY_PHOTO_DELETE',
      'PEOPLE_READ', 'PEOPLE_CREATE', 'PEOPLE_UPDATE', 'PEOPLE_DELETE',
      'TESTIMONIALS_READ', 'TESTIMONIALS_CREATE', 'TESTIMONIALS_UPDATE', 'TESTIMONIALS_DELETE',
      'FAQS_READ', 'FAQS_CREATE', 'FAQS_UPDATE', 'FAQS_DELETE',
      'SETTINGS_READ',
    ],
  },
  {
    name: 'Admissions Officer',
    description: 'Works the enquiries, visits and applications the website brings in, and keeps the fee structure and term dates current.',
    actions: [
      'ENQUIRIES_READ', 'ENQUIRIES_UPDATE', 'ENQUIRIES_DELETE',
      'APPLICATIONS_READ', 'APPLICATIONS_UPDATE',
      'EVENTS_READ', 'EVENTS_RSVP_READ',
      'ACADEMICS_READ', 'TERMS_READ', 'TERMS_MANAGE', 'FEES_READ', 'FEES_MANAGE',
      'TRANSPORT_READ',
      'FAQS_READ', 'FAQS_CREATE', 'FAQS_UPDATE',
      'SETTINGS_READ',
    ],
  },
  {
    name: 'Communications Officer',
    description: 'Notices, events, bookings and the newsletter list — the school’s voice to parents, without the admissions pipeline.',
    actions: [
      'NEWS_READ', 'NEWS_CREATE', 'NEWS_UPDATE', 'NEWS_DELETE',
      'EVENTS_READ', 'EVENTS_CREATE', 'EVENTS_UPDATE', 'EVENTS_DELETE', 'EVENTS_RSVP_READ', 'EVENTS_RSVP_DELETE',
      'GALLERY_READ', 'GALLERY_CREATE', 'GALLERY_UPDATE', 'GALLERY_PHOTO_ADD',
      'SUBSCRIBERS_READ', 'SUBSCRIBERS_UPDATE', 'SUBSCRIBERS_DELETE',
      'SETTINGS_READ',
    ],
  },
  {
    name: 'Academic Registrar',
    description: 'The academic structure, term dates, the fee structure and the bus routes the website publishes.',
    actions: [
      'ACADEMICS_READ', 'ACADEMICS_MANAGE',
      'TERMS_READ', 'TERMS_MANAGE',
      'FEES_READ', 'FEES_MANAGE',
      'TRANSPORT_READ', 'TRANSPORT_MANAGE',
      'PEOPLE_READ', 'PEOPLE_UPDATE',
      'SETTINGS_READ',
    ],
  },
  {
    name: 'Read Only',
    description: 'Sees every screen in the admin and changes nothing. For a head teacher, a governor or an auditor.',
    actions: [
      'NEWS_READ', 'EVENTS_READ', 'EVENTS_RSVP_READ', 'GALLERY_READ', 'PEOPLE_READ', 'TESTIMONIALS_READ',
      'FAQS_READ', 'ACADEMICS_READ', 'TERMS_READ', 'FEES_READ', 'TRANSPORT_READ',
      'ENQUIRIES_READ', 'APPLICATIONS_READ', 'SUBSCRIBERS_READ', 'SETTINGS_READ', 'AUDIT_READ',
    ],
  },
];
