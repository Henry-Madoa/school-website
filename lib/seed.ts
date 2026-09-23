import 'server-only';

/*
 * Creating the schema, and filling an empty database with a school.
 *
 * The demonstration content is a plausible Kenyan CBC school — four levels from Pre-Primary to
 * Junior Secondary, a year of terms, a fee structure, notices, events, staff, albums and bus
 * routes — so that the site can be looked at, shown to the school and signed off before a single
 * real word has been typed into it. Every one of those rows is ordinary content the admin can
 * edit or delete.
 *
 * Seeding only ever adds to an empty table. Run it twice and the second run does nothing, so it
 * is safe to leave wired into a deployment.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { all, exec, one, run, value } from './db.ts';
import { hashPassword } from './password.ts';
import { expandActionsToLines, STANDARD_ROLES } from './permissions.ts';
import { slugify } from './slugify.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Applies lib/schema.sql. Idempotent — every statement is CREATE … IF NOT EXISTS. */
export async function applySchema(): Promise<void> {
  const sql = await readFile(join(HERE, 'schema.sql'), 'utf8');
  await exec(sql);
}

const isEmpty = async (table: string): Promise<boolean> =>
  Number(await value<number>(`SELECT COUNT(*)::int FROM ${table}`) ?? 0) === 0;

const iso = (date: Date): string => date.toISOString();
const days = (n: number): Date => new Date(Date.now() + n * 86_400_000);
const at = (date: Date, hour: number, minute = 0): string => {
  const copy = new Date(date);
  copy.setUTCHours(hour, minute, 0, 0);
  return copy.toISOString();
};
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

/* Unsplash photographs, used only as placeholder content. Replace them from the admin by
 * uploading the school's own — every one of these fields takes a Cloudinary upload. */
const photo = (id: string, w = 1600): string => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

const CAMPUS = photo('1580582932707-520aed937b7b');
const CLASSROOM = photo('1503676260728-1c00da094a0b');
const SCIENCE = photo('1532094349884-543bc11b234d');
const LIBRARY = photo('1481627834876-b7833e8f5570');
const SPORT = photo('1461896836934-ffe607ba8211');
const MUSIC = photo('1514320291840-2e0a9bf2a9ae');
const BUS = photo('1544620347-c4fd4a3d5957');
const GRADUATION = photo('1523050854058-8df90110c9f1');
const CHILDREN = photo('1509062522246-3755977927d7');
const ART = photo('1499951360447-b19be8fe80f5');
const COMPUTER = photo('1497633762265-9d179a990aa6');
const ASSEMBLY = photo('1577896851231-70ef18881754');

export interface SeedResult {
  created: string[];
  adminEmail: string | null;
  adminPassword: string | null;
}

/**
 * Fills whatever is still empty. The first administrator's password comes from ADMIN_PASSWORD, or
 * is generated and returned once — it is never written to a log the school cannot see.
 */
export async function seedDatabase(options: { demo?: boolean } = {}): Promise<SeedResult> {
  const demo = options.demo ?? process.env.SEED_DEMO_DATA !== 'false';
  const created: string[] = [];
  let adminEmail: string | null = null;
  let adminPassword: string | null = null;

  /* --------------------------------------------------------- the Permission Sets */
  // Ordinary rows, every one of them editable line by line in Security › Permission Sets. The
  // System Administrator set carries no lines at all: its access comes from is_system, exactly as
  // the management system does it.
  if (await isEmpty('web_role')) {
    for (const standard of STANDARD_ROLES) {
      const { id: roleId } = await run(
        'INSERT INTO web_role (name, description, is_system, created_at, created_by) VALUES (?,?,?,?,?)',
        standard.name, standard.description, !!standard.isSystem, iso(new Date()), 'seed',
      );
      for (const line of expandActionsToLines(standard.actions ?? [])) {
        await run(
          `INSERT INTO web_permission_line (role_id, object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm)
           VALUES (?,?,?,?,?,?,?,?)`,
          roleId, line.object_type, line.object_name,
          line.read_perm, line.insert_perm, line.modify_perm, line.delete_perm, line.execute_perm,
        );
      }
    }
    created.push(`${STANDARD_ROLES.length} Permission Sets`);
  }

  /* ------------------------------------------------------------ the first admin */
  if (await isEmpty('web_user')) {
    const systemRole = await one<{ id: number }>('SELECT id FROM web_role WHERE is_system ORDER BY id LIMIT 1');
    adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@school.ac.ke').toLowerCase();
    adminPassword = process.env.ADMIN_PASSWORD ?? `school-${Math.random().toString(36).slice(2, 10)}`;
    await run(
      'INSERT INTO web_user (name, email, password_hash, role_id, status, title, created_at, created_by) VALUES (?,?,?,?,?,?,?,?)',
      process.env.ADMIN_NAME ?? 'Website Administrator', adminEmail, await hashPassword(adminPassword),
      systemRole?.id ?? null, 'ACTIVE', 'System administrator', iso(new Date()), 'seed',
    );
    created.push('a System Administrator account');
  }

  /* ---------------------------------------------------------------- the school */
  const settings = await one<{ name: string }>('SELECT name FROM web_setting WHERE id = 1');
  if (demo && (!settings || settings.name === 'Our School')) {
    await run(
      `UPDATE web_setting SET
         name = ?, short_name = ?, motto = ?, school_type = ?, founded_year = ?,
         about_intro = ?, about_story = ?, mission = ?, vision = ?,
         registration_no = ?, licence_no = ?, physical_address = ?, postal_address = ?, city = ?, county = ?,
         phone_primary = ?, phone_secondary = ?, email = ?, admissions_email = ?, office_hours = ?,
         paybill_no = ?, bank_details = ?, hero_image_url = ?, hero_headline = ?, hero_body = ?,
         stat_students = ?, stat_teachers = ?, stat_clubs = ?, stat_pass_rate = ?,
         whatsapp_number = ?, facebook_url = ?, instagram_url = ?, youtube_url = ?, updated_at = ?
       WHERE id = 1`,
      'Green Valley Academy', 'Green Valley', 'Know the child, teach the child', 'Private day and boarding school', '2004',
      'A school small enough to know your child, organised enough to prove it.',
      'Green Valley Academy opened in 2004 with forty-one pupils in three borrowed classrooms. Twenty years later we teach over six hundred children from Pre-Primary to Junior Secondary on a campus we built ourselves, and the thing the founders cared about has not changed: every child here is known by name, by every adult who teaches them.\n\nWe are deliberately not the biggest school in the county. Classes stay small, teachers stay for years rather than terms, and the office can tell you how your child is doing without going to look for a file.',
      'To teach the Competency Based Curriculum honestly and well, so that every child leaves us able to think, to work with others and to keep learning without us.',
      'A school where a parent never has to wonder how their child is doing, and a child never has to wonder whether they are known.',
      'MOE/PRI/0142/2004', 'KIA/LIC/2019/8871',
      'Kiambu Road, Runda', 'P.O. Box 4471–00100', 'Nairobi', 'Nairobi',
      '+254 720 114 220', '+254 733 880 415', 'office@greenvalley.ac.ke', 'admissions@greenvalley.ac.ke',
      'Monday to Friday, 7.00 am – 5.00 pm. Saturday, 8.00 am – 12.00 noon.',
      '400200', 'Equity Bank, Runda branch · Account 0170 2745 88190 · Green Valley Academy',
      CAMPUS, 'Know the child, teach the child',
      'Green Valley Academy teaches the Competency Based Curriculum from Pre-Primary through Junior Secondary, as a day and boarding school on Kiambu Road. Small classes, teachers who know every child by name, and a school office you can actually reach.',
      612, 38, 14, '100% transition to senior school, 2025',
      '+254 720 114 220', 'https://facebook.com/greenvalleyacademy', 'https://instagram.com/greenvalleyacademy', 'https://youtube.com/@greenvalleyacademy',
      iso(new Date()),
    );
    created.push('school profile');
  }

  if (!demo) return { created, adminEmail, adminPassword };

  /* ------------------------------------------------------------ what is taught */
  if (await isEmpty('web_level')) {
    const levels: [name: string, tagline: string, description: string, ageNote: string, entryNote: string, image: string, grades: string[], core: string[], electives: string[]][] = [
      [
        'Pre-Primary', 'PP1 and PP2 — the first years of school',
        'The first years of school, where children learn through play, stories, songs and structured activity. The day is short, warm and predictable, and the emphasis is on language, early number sense, confidence and friendship. Every child is settled by an adult who knows them before any teaching happens at all.',
        'From 4 years on 1 January of the year of entry', 'No formal assessment — a play-based visit instead.',
        CHILDREN, ['PP1', 'PP2'],
        ['Language Activities', 'Mathematical Activities', 'Environmental Activities', 'Psychomotor & Creative Activities', 'Religious Education'],
        ['Swimming'],
      ],
      [
        'Lower Primary', 'Grade 1 to Grade 3',
        'Reading, writing and number take hold here. Each class stays with one class teacher who comes to know every child well, with specialists for music, PE and computing. Assessment is continuous and gentle, and parents hear about a difficulty in the week it appears rather than at the end of term.',
        'From 6 years', 'A short placement assessment in reading and numbers.',
        CLASSROOM, ['Grade 1', 'Grade 2', 'Grade 3'],
        ['English', 'Kiswahili', 'Mathematics', 'Environmental Activities', 'Religious Education', 'Creative Activities'],
        ['Music', 'Swimming', 'French'],
      ],
      [
        'Upper Primary', 'Grade 4 to Grade 6',
        'Subject specialists take over the core learning areas and pupils begin to work more independently — longer projects, science practicals, and the first taste of boarding for families who want it. This is where a child learns to organise their own work, which matters more later than anything on the syllabus.',
        'From 9 years', 'Placement assessment; boarding available from Grade 4.',
        SCIENCE, ['Grade 4', 'Grade 5', 'Grade 6'],
        ['English', 'Kiswahili', 'Mathematics', 'Science & Technology', 'Social Studies', 'Religious Education', 'Agriculture', 'Home Science'],
        ['Music', 'French', 'Computer Studies', 'Art & Craft'],
      ],
      [
        'Junior Secondary', 'Grade 7 to Grade 9',
        'Taught by subject specialists in laboratories and workshops, with electives alongside the core learning areas and a clear eye on senior school pathways. Pupils choose, and are guided in choosing — the choices are theirs, the advice is ours, and the report card follows each pupil’s own subjects.',
        'From 12 years', 'Placement assessment in the core learning areas.',
        COMPUTER, ['Grade 7', 'Grade 8', 'Grade 9'],
        ['English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies', 'Pre-Technical Studies', 'Religious Education', 'Business Studies'],
        ['Computer Science', 'French', 'Visual Arts', 'Performing Arts', 'Sports & Physical Education'],
      ],
    ];

    for (const [index, [name, tagline, description, ageNote, entryNote, image, grades, core, electives]] of levels.entries()) {
      const { id: levelId } = await run(
        'INSERT INTO web_level (name, slug, tagline, description, age_note, entry_note, image_url, sort, is_published) VALUES (?,?,?,?,?,?,?,?,TRUE)',
        name, slugify(name), tagline, description, ageNote, entryNote, image, index,
      );
      for (const [g, grade] of grades.entries()) {
        await run('INSERT INTO web_grade (level_id, name, sort) VALUES (?,?,?)', levelId, grade, g);
      }
      for (const [s, subject] of core.entries()) {
        await run('INSERT INTO web_subject (level_id, name, is_core, sort) VALUES (?,?,TRUE,?)', levelId, subject, s);
      }
      for (const [s, subject] of electives.entries()) {
        await run('INSERT INTO web_subject (level_id, name, is_core, sort) VALUES (?,?,FALSE,?)', levelId, subject, s);
      }
    }
    created.push('4 levels with grades and learning areas');
  }

  /* ----------------------------------------------------------------- the year */
  if (await isEmpty('web_term')) {
    const year = new Date().getFullYear();
    const terms: [name: string, start: string, end: string, current: boolean][] = [
      ['Term 1', `${year}-01-06`, `${year}-04-04`, false],
      ['Term 2', `${year}-05-05`, `${year}-08-01`, false],
      ['Term 3', `${year}-08-25`, `${year}-10-31`, false],
      ['Term 1', `${year + 1}-01-05`, `${year + 1}-04-03`, false],
    ];
    const today = dateOnly(new Date());
    // Whichever term today actually falls in is the current one; failing that, the next to open.
    let currentIndex = terms.findIndex(([, s, e]) => s <= today && today <= e);
    if (currentIndex < 0) currentIndex = Math.max(0, terms.findIndex(([, s]) => s > today));

    for (const [index, [name, start, end]] of terms.entries()) {
      await run(
        'INSERT INTO web_term (name, year_name, start_date, end_date, is_current, note) VALUES (?,?,?,?,?,?)',
        name, String(new Date(`${start}T00:00:00Z`).getUTCFullYear()), start, end, index === currentIndex,
        index === currentIndex ? 'Half-term break in the middle weekend of the term — see News & notices.' : null,
      );
    }
    created.push('4 terms');
  }

  /* ------------------------------------------------------------------- the fees */
  if (await isEmpty('web_fee')) {
    const term = await one<{ id: number }>('SELECT id FROM web_term WHERE is_current ORDER BY start_date LIMIT 1');
    const grades = await all<{ id: number; name: string; level_name: string }>(
      'SELECT g.id, g.name, l.name AS level_name FROM web_grade g JOIN web_level l ON l.id = g.level_id ORDER BY l.sort, g.sort',
    );
    if (term && grades.length) {
      // Tuition by level, in shillings per term. Everything else is the same school-wide.
      const tuition: Record<string, number> = { 'Pre-Primary': 28_000, 'Lower Primary': 34_000, 'Upper Primary': 41_000, 'Junior Secondary': 52_000 };
      for (const grade of grades) {
        const base = tuition[grade.level_name] ?? 35_000;
        const lines: [item: string, amount: number, applies: string, sort: number][] = [
          ['Tuition', base, 'ALL', 0],
          ['Activity & examinations', 4_500, 'ALL', 1],
          ['Lunch', 7_500, 'DAY', 2],
          ['Boarding', 26_000, 'BOARDER', 3],
          ['School transport', 12_000, 'OPT_IN', 4],
          ['Swimming', 3_000, 'OPT_IN', 5],
        ];
        for (const [item, amount, applies, sort] of lines) {
          // Boarding only exists from Grade 4 upwards.
          if (applies === 'BOARDER' && (grade.level_name === 'Pre-Primary' || grade.level_name === 'Lower Primary')) continue;
          await run(
            'INSERT INTO web_fee (term_id, grade_id, item, amount_cents, applies_to, sort) VALUES (?,?,?,?,?,?)',
            term.id, grade.id, item, amount * 100, applies, sort,
          );
        }
      }
      created.push('a term of fee lines');
    }
  }

  /* --------------------------------------------------------------------- news */
  if (await isEmpty('web_post')) {
    const posts: [title: string, category: string, excerpt: string, body: string, image: string | null, daysAgo: number, pinned: boolean][] = [
      [
        'Term 2 opens on Monday 5 May — reporting times',
        'NOTICE',
        'Boarders report from 2.00 pm on Sunday; day scholars at the usual time on Monday morning.',
        'Term 2 opens on Monday 5 May.\n\nBoarders report to their houses between 2.00 pm and 5.00 pm on Sunday 4 May, with the term’s shopping list completed and the health form signed. House staff will be on the gate.\n\nDay scholars report at 7.20 am on Monday 5 May for assembly, in full uniform including the games kit — the first PE lesson is on the Monday.\n\nThe school bus runs its normal routes from Monday morning. Parents joining a route this term should tell the transport office before Friday so the seat is allocated and the fare appears on the correct invoice.',
        ASSEMBLY, 3, true,
      ],
      [
        'Green Valley takes the county science fair',
        'ACHIEVEMENT',
        'Our Grade 8 team placed first in the county with a solar water-purification project, and go to the nationals in August.',
        'Four of our Grade 8 pupils spent a term of Friday afternoons building a solar water purifier out of parts they could buy in Ruiru, and last week it won the Kiambu County Science and Engineering Fair.\n\nThe judges singled out the costing: the team could say exactly what their device cost to build and what it would cost a household to run, which most entries could not.\n\nThey represent the county at the national fair in August. The whole school is proud of them, and so are we.',
        SCIENCE, 9, false,
      ],
      [
        'Parents’ consultation day — Saturday 24 May',
        'NOTICE',
        'Fifteen-minute appointments with every subject teacher. Book through the office from Monday.',
        'Consultation day is Saturday 24 May, 8.00 am to 1.00 pm.\n\nEach appointment is fifteen minutes with the class teacher, and from Grade 4 upwards you can also see any subject teacher you ask for. Please book through the office from Monday 12 May — we schedule them rather than run a queue, because a queue means the parents who came furthest wait longest.\n\nBring the term’s report card. If your child is old enough to sit in on the conversation, bring them too: it is about them, and it goes better when they are there.',
        null, 14, false,
      ],
      [
        'New library wing opens',
        'NEWS',
        'Four thousand titles, a reading room for the younger children and six research desks for Junior Secondary.',
        'The new library wing opened this month after eleven months of building, funded partly by the school and partly by an appeal the parents’ association ran through last year.\n\nIt holds just over four thousand catalogued titles, a separate reading room for Pre-Primary and Lower Primary with a floor you can sit on, and six research desks with computers for Junior Secondary.\n\nEvery pupil may borrow two books at a time for two weeks. The librarian is in from 7.00 am, which is early enough for the children who come on the first bus.',
        LIBRARY, 21, false,
      ],
      [
        'Fee structure for the coming year',
        'CIRCULAR',
        'Published in full on the website, per grade and per term. No increase on tuition for Pre-Primary.',
        'The fee structure for the coming academic year is published in full on this website, grade by grade and term by term, with what is compulsory and what is optional set out plainly.\n\nTuition rises by four per cent across Lower Primary, Upper Primary and Junior Secondary, which is below the year’s inflation and is accounted for almost entirely by staff salaries. Pre-Primary tuition does not change.\n\nFamilies who would like to spread a term across instalments should speak to the bursar before the term begins rather than after. We would always rather agree a plan than chase one.',
        null, 28, false,
      ],
      [
        'Inter-house athletics: Kilimanjaro takes the shield',
        'NEWS',
        'Nine records fell on a good, dry day. Kilimanjaro House takes the shield back after three years.',
        'Sports day ran in perfect weather and nine school records went in a single afternoon, four of them in the Grade 7 and 8 girls’ events.\n\nKilimanjaro House takes the shield back after three years with Elgon, on 284 points to Elgon’s 271, with Kenya House on 240 and Longonot on 226.\n\nThank you to the hundred-odd parents who came, to the PE department for a programme that ran to time, and to the Grade 9 pupils who marshalled every event without being asked twice.',
        SPORT, 35, false,
      ],
      [
        'Admissions open for January',
        'NOTICE',
        'Places remain in most grades. Apply online — it takes about ten minutes on a phone.',
        'Applications for the January intake are open now, and there are places in most grades.\n\nGrade 1 and Grade 7 fill first: if you are applying into either, apply at least a term ahead. If the grade you want is full we will offer a place on the waiting list and call you the moment one opens — we do not take a deposit to hold a waiting-list place.\n\nApply online from this website. It takes about ten minutes on a phone, no documents are needed at that stage, and you get an application number by SMS straight away.',
        GRADUATION, 42, false,
      ],
      [
        'Music and drama festival — a full house',
        'NEWS',
        'The choir, the Grade 6 play and a brass section that did not exist a year ago.',
        'Four hundred parents filled the hall for the music and drama festival, and the school choir opened with a Kiswahili setting written for them by our own music teacher.\n\nThe Grade 6 play — written by the class over a term — was the evening’s surprise, and the brass section, which did not exist at all a year ago, closed it.\n\nRecordings go to every family by e-mail this week.',
        MUSIC, 56, false,
      ],
    ];

    for (const [title, category, excerpt, body, image, daysAgo, pinned] of posts) {
      await run(
        `INSERT INTO web_post (title, slug, category, excerpt, body, image_url, audience, is_published, is_pinned, published_at, author, created_at)
         VALUES (?,?,?,?,?,?, 'ALL', TRUE, ?,?,?,?)`,
        title, slugify(title), category, excerpt, body, image, pinned, at(days(-daysAgo), 9), 'School office', iso(days(-daysAgo)),
      );
    }
    created.push(`${posts.length} notices and news articles`);
  }

  /* ------------------------------------------------------------------- events */
  if (await isEmpty('web_event')) {
    const events: [title: string, category: string, summary: string, body: string, image: string | null, inDays: number, hour: number, hours: number, location: string, rsvp: boolean, capacity: number | null][] = [
      ['Open day for prospective parents', 'PARENTS', 'Walk the campus while the school is working, and meet the teachers your child would have.',
        'Come and see the school on an ordinary working day, with lessons running and the playground full.\n\nYou will see classrooms in session at the grade your child would join, the science and computer laboratories, the library, the dining hall at lunch, the boarding houses if boarding interests you, and the buses.\n\nThe Principal and the Registrar will both be there, and you are very welcome to bring your child.',
        CAMPUS, 12, 9, 3, 'Main campus, Kiambu Road', true, 80],
      ['Grade 7 parents’ evening', 'PARENTS', 'Subject choices, the assessment calendar and what Junior Secondary actually asks of a family.',
        'An evening for Grade 7 parents on what changes in Junior Secondary: subject specialists, electives, the assessment calendar, and how much independent work to expect at home.\n\nThe Grade 7 team will all be there, and there is time at the end for questions.',
        CLASSROOM, 19, 17, 2, 'School hall', true, 120],
      ['Inter-schools football — Green Valley v St Mary’s', 'SPORT', 'Boys’ and girls’ fixtures from 2.00 pm. Parents and supporters very welcome.',
        'Home fixtures against St Mary’s, Karen. Girls kick off at 2.00 pm, boys at 3.30 pm. Refreshments from the parents’ association, proceeds to the library appeal.',
        SPORT, 5, 14, 3, 'School playing fields', false, null],
      ['Music and drama festival', 'ARTS', 'The choir, the brass section and a play written by Grade 6.',
        'Our annual evening of music and drama. Doors at 5.30 pm, curtain at 6.00 pm, finished by 8.00.\n\nEvery class from Grade 3 upwards contributes something, and the evening closes with the choir.',
        MUSIC, 33, 18, 2, 'School hall', true, 400],
      ['Half-term break begins', 'HOLIDAY', 'School closes at 12.30 pm; boarders travel the same afternoon.',
        'School closes for half-term at 12.30 pm. The buses run their routes immediately after closing.\n\nBoarders travel the same afternoon and report back by 5.00 pm on the Sunday.',
        null, 26, 12, 1, 'Whole school', false, null],
      ['Prize giving and Grade 9 graduation', 'ACADEMIC', 'The school year closes with prize giving and the Grade 9 graduation.',
        'Prize giving for the whole school, followed by the Grade 9 graduation ceremony and lunch for graduating families.\n\nEvery Grade 9 family receives a formal invitation with the reporting time.',
        GRADUATION, 61, 10, 4, 'School hall and grounds', true, 300],
      ['Careers morning for Junior Secondary', 'ACADEMIC', 'Fifteen parents and alumni talking about what they actually do all day.',
        'Fifteen parents and former pupils come in to talk to Grades 7, 8 and 9 about their work — engineers, nurses, a pilot, two farmers, a magistrate and a software developer among them.\n\nIf you would like to take part, tell the office.',
        COMPUTER, 40, 8, 4, 'Junior Secondary block', false, null],
      ['Art exhibition and open studio', 'ARTS', 'A term’s work from every class, hung properly, for one afternoon.',
        'A term of work from every class in the school, hung properly in the hall for one afternoon. Pupils show their own work — which is the point of it.',
        ART, -12, 14, 3, 'School hall', false, null],
    ];

    for (const [title, category, summary, body, image, inDays, hour, hours, location, rsvp, capacity] of events) {
      const starts = at(days(inDays), hour);
      await run(
        `INSERT INTO web_event (title, slug, summary, body, image_url, category, location, starts_at, ends_at, all_day, is_published, rsvp_enabled, capacity, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,FALSE,TRUE,?,?,?)`,
        title, slugify(title), summary, body, image, category, location, starts,
        new Date(Date.parse(starts) + hours * 3_600_000).toISOString(), rsvp, capacity, iso(new Date()),
      );
    }
    created.push(`${events.length} events`);
  }

  /* ------------------------------------------------------------------ gallery */
  if (await isEmpty('web_album')) {
    const albums: [title: string, description: string, cover: string, photos: [url: string, caption: string][]][] = [
      ['Around the campus', 'The buildings, the fields and the twenty-year-old jacaranda in the middle of it all.', CAMPUS, [
        [CAMPUS, 'The main block from the front lawn'],
        [CLASSROOM, 'A Lower Primary classroom, mid-morning'],
        [LIBRARY, 'The new library wing'],
        [SCIENCE, 'The science laboratory'],
        [COMPUTER, 'The computer laboratory'],
        [BUS, 'The fleet, waiting for the afternoon run'],
      ]],
      ['Sports day', 'Nine records in one afternoon, and Kilimanjaro House with the shield.', SPORT, [
        [SPORT, 'The Grade 8 girls’ 800 metres'],
        [CHILDREN, 'Pre-Primary sack race — no records broken'],
        [ASSEMBLY, 'The march past'],
      ]],
      ['Music and drama festival', 'Four hundred parents, one hall and a brass section that did not exist a year ago.', MUSIC, [
        [MUSIC, 'The choir opening the evening'],
        [ART, 'Set design by the Grade 6 class'],
        [GRADUATION, 'Curtain call'],
      ]],
    ];

    for (const [index, [title, description, cover, photos]] of albums.entries()) {
      const { id: albumId } = await run(
        'INSERT INTO web_album (title, slug, description, cover_url, taken_on, sort, is_published, created_at) VALUES (?,?,?,?,?,?,TRUE,?)',
        title, slugify(title), description, cover, dateOnly(days(-30 * (index + 1))), index, iso(new Date()),
      );
      for (const [p, [url, caption]] of photos.entries()) {
        await run('INSERT INTO web_photo (album_id, url, caption, sort) VALUES (?,?,?,?)', albumId, url, caption, p);
      }
    }
    created.push(`${albums.length} gallery albums`);
  }

  /* -------------------------------------------------------------------- people */
  if (await isEmpty('web_staff')) {
    const staff: [name: string, role: string, category: string, qualification: string, bio: string][] = [
      ['Dr Agnes Wanjiru Kamau', 'Principal', 'LEADERSHIP', 'PhD Education Leadership, University of Nairobi',
        'Agnes has led Green Valley since 2016, after eleven years teaching science and six as a deputy elsewhere. She still teaches one Grade 9 class, on the grounds that a principal who does not teach stops understanding the job.'],
      ['Mr Peter Otieno Ochieng', 'Deputy Principal, Academics', 'LEADERSHIP', 'MEd Curriculum Studies, Kenyatta University',
        'Peter runs the academic side: the timetable, the assessment calendar and the report cards. He came to Green Valley in 2011 as a mathematics teacher and has never quite given the subject up.'],
      ['Mrs Faith Njeri Mwangi', 'Deputy Principal, Pastoral', 'LEADERSHIP', 'BEd Guidance & Counselling, Moi University',
        'Faith looks after boarding, wellbeing and discipline, and is the person a child goes to when something has gone wrong. She has the longest memory in the school for who is friends with whom.'],
      ['Mr Samuel Kiprono Rutto', 'Head of Junior Secondary', 'TEACHING', 'BSc Physics, BEd, Egerton University',
        'Samuel teaches physics and integrated science and coaches the science fair teams — including the four who won the county this year.'],
      ['Ms Grace Achieng Odhiambo', 'Head of Lower Primary', 'TEACHING', 'BEd Early Childhood, Maseno University',
        'Grace has taught the first years of school for nineteen years and trains every new Lower Primary teacher who joins us.'],
      ['Mr Daniel Mutiso Musyoka', 'Head of Mathematics', 'TEACHING', 'BSc Mathematics, BEd, University of Nairobi',
        'Daniel runs the mathematics department and the Saturday clinic for anyone in Grades 6 to 9 who wants an extra hour.'],
      ['Mrs Lucy Wambui Njoroge', 'Head of Languages', 'TEACHING', 'MA Linguistics, BEd, Kenyatta University',
        'Lucy heads English and Kiswahili and directs the drama festival entry, which is why the Grade 6 play is always better than it has any right to be.'],
      ['Mr Joseph Kibet Langat', 'Head of Boarding', 'TEACHING', 'BEd Physical Education, Kenyatta University',
        'Joseph runs the boarding houses and the athletics programme, and lives on the campus with his family.'],
      ['Mrs Esther Nyambura Kariuki', 'Bursar', 'ADMIN', 'CPA(K), BCom Finance, Strathmore University',
        'Esther runs the accounts office. She is the person to speak to about a fee plan, and she would much rather you spoke to her early.'],
      ['Mr Ali Hassan Omar', 'Registrar & Admissions', 'ADMIN', 'BA Education, Pwani University',
        'Ali handles every application from the first phone call to the reporting date, and answers the admissions line himself.'],
      ['Mrs Sarah Chebet Koech', 'School Nurse', 'ADMIN', 'BScN, Registered Nurse',
        'Sarah staffs the sick bay, keeps the immunisation records and calls parents the same day about anything beyond a scraped knee.'],
      ['Mr Francis Mwenda Kirimi', 'Chair, Board of Management', 'BOARD', 'MBA, FCPA(K)',
        'Francis has chaired the board since 2019 and is a parent of two former pupils.'],
    ];

    for (const [index, [name, role, category, qualification, bio]] of staff.entries()) {
      await run(
        'INSERT INTO web_staff (name, role_title, category, qualification, bio, sort, is_published) VALUES (?,?,?,?,?,?,TRUE)',
        name, role, category, qualification, bio, index,
      );
    }
    created.push(`${staff.length} staff profiles`);
  }

  if (await isEmpty('web_testimonial')) {
    const testimonials: [name: string, role: string, quote: string][] = [
      ['Mercy Atieno', 'Parent, Grade 4 and Grade 7', 'What sold me was the phone call. I rang about a maths worry on a Tuesday and the class teacher called me back the same afternoon, having actually looked at my son’s work. That has never stopped happening.'],
      ['James Mwangi', 'Parent, Grade 2', 'My daughter had never been to school before. She was settled within a fortnight, and I know the name of every adult who teaches her. At the last school I did not.'],
      ['Nasra Abdi', 'Parent, boarder in Grade 8', 'Boarding was a hard decision. What made it work is that nothing else changed — same teachers, same timetable, same reports. She just gets two hours of quiet prep we could never give her at home.'],
      ['Brian Kiplagat', 'Former pupil, class of 2022', 'The science fair coaching I got in Grade 8 is the reason I took engineering. Mr Rutto made us cost everything, and it turns out that is the whole job.'],
    ];
    for (const [index, [name, role, quote]] of testimonials.entries()) {
      await run('INSERT INTO web_testimonial (name, role_title, quote, rating, sort, is_published, created_at) VALUES (?,?,?,5,?,TRUE,?)', name, role, quote, index, iso(new Date()));
    }
    created.push('4 testimonials');
  }

  if (await isEmpty('web_faq')) {
    const faqs: [q: string, a: string, category: string][] = [
      ['When can my child start?', 'We admit at the start of any term where a place exists, and most families join in Term 1 (January). Apply at least a term ahead for the popular grades; if a grade is full we will offer a place on the waiting list and call you the moment one opens.', 'ADMISSIONS'],
      ['What do I need to apply?', 'Only the child’s details and your phone number to start. At the assessment please bring the birth certificate, the most recent report card, the immunisation card and, for a transfer, a letter from the previous school.', 'ADMISSIONS'],
      ['Is there an assessment?', 'Yes — a short, friendly placement assessment in literacy and numeracy appropriate to the grade, plus a conversation with the parents. It tells us where to place the child, not whether to accept them.', 'ADMISSIONS'],
      ['How old must my child be?', 'The usual Kenyan ages: PP1 at 4, Grade 1 at 6, Grade 7 at 12, measured on 1 January of the year of entry. We will advise if your child is close to a boundary.', 'ADMISSIONS'],
      ['Do you take transfers mid-year?', 'Yes, where a place exists. Bring the transfer letter and the last report; the child sits the same placement assessment.', 'ADMISSIONS'],
      ['Is boarding compulsory?', 'No. Boarding is available from Grade 4 upwards and is entirely your choice. Most of our pupils are day scholars.', 'GENERAL'],
      ['What does it cost?', 'The full fee structure is published on this website, per grade and per term, with what is compulsory and what is optional set out plainly. There are no hidden charges.', 'FEES'],
      ['Can fees be paid in instalments?', 'Yes. Fees are due at the start of each term, but where a family needs to spread the cost the school can invoice a term in instalments — speak to the bursar before the term begins rather than after.', 'FEES'],
      ['Are there scholarships or bursaries?', 'A limited number of bursaries are offered each year on need and merit. Ask the admissions office when you apply, and be ready to provide supporting documents.', 'FEES'],
      ['Does the school bus reach us?', 'We run several routes across Nairobi and Kiambu with named stops and published times. Check the transport page, and if your area is not covered tell us — routes change with demand.', 'TRANSPORT'],
      ['Who drives the buses?', 'Drivers are employed directly by the school, licensed and PSV-badged, and every journey is authorised by a work ticket. A child is released only to a parent or a named adult at the stop.', 'TRANSPORT'],
      ['How is my child assessed?', 'Continuously, through the term — classwork, projects, practicals and tests — with each learning area reported as a competency level and the teacher’s comment. A full report card is published at the end of every term.', 'ACADEMICS'],
      ['How large are the classes?', 'We cap classes at 28 in Pre-Primary and Lower Primary, and 32 from Grade 4 upwards. Most sit below the cap.', 'ACADEMICS'],
      ['How long until I hear back about an application?', 'We acknowledge every application immediately, and the admissions office will contact you within three working days to arrange the assessment.', 'ADMISSIONS'],
    ];
    for (const [index, [question, answer, category]] of faqs.entries()) {
      await run('INSERT INTO web_faq (question, answer, category, sort, is_published) VALUES (?,?,?,?,TRUE)', question, answer, category, index);
    }
    created.push(`${faqs.length} questions`);
  }

  /* ---------------------------------------------------------------- transport */
  if (await isEmpty('web_route')) {
    const routes: [code: string, name: string, description: string, fare: number, stops: [name: string, pickup: string, dropoff: string][]][] = [
      ['R1', 'Runda – Gigiri – Village Market', 'The shortest route, and the first bus back in the evening.', 12_000, [
        ['Runda Mimosa gate', '06:20', '17:05'], ['Runda Grove', '06:28', '17:12'], ['Gigiri shops', '06:38', '17:22'], ['Village Market', '06:45', '17:30'],
      ]],
      ['R2', 'Ruaka – Banana – Ndenderu', 'Along Limuru Road, with a feeder from Ndenderu.', 12_000, [
        ['Ndenderu stage', '06:05', '17:30'], ['Banana Hill', '06:15', '17:20'], ['Ruaka shopping centre', '06:30', '17:05'], ['Two Rivers', '06:40', '16:55'],
      ]],
      ['R3', 'Kasarani – Roysambu – Thika Road', 'The long route. Leaves earliest and returns last.', 14_000, [
        ['Kasarani Mwiki stage', '05:55', '17:45'], ['Hunters', '06:05', '17:35'], ['Roysambu roundabout', '06:15', '17:25'], ['Garden City', '06:30', '17:10'],
      ]],
      ['R4', 'Westlands – Parklands – Muthaiga', 'Through Parklands and Muthaiga, joining Kiambu Road at Muthaiga.', 13_000, [
        ['Westlands Sarit', '06:10', '17:25'], ['Parklands Aga Khan', '06:22', '17:14'], ['Muthaiga shops', '06:35', '17:02'],
      ]],
    ];
    for (const [index, [code, name, description, fare, stops]] of routes.entries()) {
      const { id: routeId } = await run(
        'INSERT INTO web_route (code, name, description, fare_cents, sort, is_published) VALUES (?,?,?,?,?,TRUE)',
        code, name, description, fare * 100, index,
      );
      for (const [s, [stopName, pickup, dropoff]] of stops.entries()) {
        await run('INSERT INTO web_stop (route_id, name, pickup_time, dropoff_time, sort) VALUES (?,?,?,?,?)', routeId, stopName, pickup, dropoff, s);
      }
    }
    created.push(`${routes.length} bus routes`);
  }

  return { created, adminEmail, adminPassword };
}
