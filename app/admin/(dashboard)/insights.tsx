import Link from 'next/link';
import { canNav } from '@/lib/permissions.ts';
import type { EventView, SessionUser } from '@/lib/types.ts';
import {
  RANGES, admissionsActivity, admissionsFunnel, admissionsSources, contentCounts, interestByGrade, noticesPerMonth,
  type Range,
} from '@/lib/insights.ts';
import { BarRows, ColumnChart, Legend, LineChart, Meter, TableView, type Series } from './charts.tsx';

/*
 * The dashboard's charts. Like the tiles above them, each one is built only when this person may
 * open the screen it summarises, and its query is skipped otherwise.
 */

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const format = (iso: string, options: Intl.DateTimeFormatOptions) => day(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', ...options });

function bucketLabels(unit: 'day' | 'week' | 'month', starts: string[]) {
  if (unit === 'month') {
    return { labels: starts.map((s) => format(s, { month: 'short' })), tips: starts.map((s) => format(s, { month: 'long', year: 'numeric' })) };
  }
  if (unit === 'week') {
    return { labels: starts.map((s) => format(s, { day: 'numeric', month: 'short' })), tips: starts.map((s) => `Week of ${format(s, { day: 'numeric', month: 'short', year: 'numeric' })}`) };
  }
  return { labels: starts.map((s) => format(s, { day: 'numeric', month: 'short' })), tips: starts.map((s) => format(s, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })) };
}

function Delta({ now, before }: { now: number; before: number }) {
  if (now === before) return <span className="delta">No change on the period before</span>;
  if (before === 0) return <span className="delta up">▲ New this period (none the period before)</span>;
  const change = Math.round(((now - before) / before) * 100);
  return change > 0
    ? <span className="delta up">▲ {change}% on the period before ({before.toLocaleString('en-GB')})</span>
    : <span className="delta down">▼ {Math.abs(change)}% on the period before ({before.toLocaleString('en-GB')})</span>;
}

function Card({ title, subtitle, wide, children }: { title: string; subtitle?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`panel${wide ? ' wide' : ''}`}>
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <div className="body">{children}</div>
    </div>
  );
}

export async function Insights({ user, range, upcoming }: { user: SessionUser; range: Range; upcoming: EventView[] }) {
  const mayEnquiries = canNav(user, 'ENQUIRIES');
  const mayApplications = canNav(user, 'APPLICATIONS');
  const mayAdmissions = mayEnquiries || mayApplications;
  const mayNews = canNav(user, 'NEWS');
  const mayEvents = canNav(user, 'EVENTS');
  const contentRows = [
    { label: 'Published notices', key: 'notices', may: mayNews, href: '/admin/news' },
    { label: 'Events ahead', key: 'events', may: mayEvents, href: '/admin/events' },
    { label: 'Photo albums', key: 'albums', may: canNav(user, 'GALLERY'), href: '/admin/gallery' },
    { label: 'Photographs', key: 'photos', may: canNav(user, 'GALLERY'), href: '/admin/gallery' },
    { label: 'Staff profiles', key: 'staff', may: canNav(user, 'PEOPLE'), href: '/admin/people' },
    { label: 'Testimonials', key: 'testimonials', may: canNav(user, 'TESTIMONIALS'), href: '/admin/testimonials' },
    { label: 'Questions answered', key: 'faqs', may: canNav(user, 'FAQS'), href: '/admin/faqs' },
  ] as const;
  const mayContent = contentRows.some((row) => row.may);
  const bookable = mayEvents ? upcoming.filter((event) => event.rsvp_enabled).slice(0, 5) : [];

  if (!mayAdmissions && !mayNews && !mayContent && !bookable.length) return null;

  const [activity, funnel, sources, grades, notices, counts] = await Promise.all([
    mayAdmissions ? admissionsActivity(range) : null,
    mayEnquiries ? admissionsFunnel(range) : null,
    mayAdmissions ? admissionsSources(range) : null,
    mayAdmissions ? interestByGrade(range) : null,
    mayNews ? noticesPerMonth() : null,
    mayContent ? contentCounts() : null,
  ]);
  const rangeLabel = RANGES.find((r) => r.value === range)!.label.toLowerCase();

  return (
    <>
      {activity ? (
        <section className="insight-grid" aria-label="Admissions insights">
          <div className="insights-head wide">
            <div>
              <h2>Admissions insights</h2>
              <p>Everything in this section covers the {rangeLabel}, in Nairobi time.</p>
            </div>
            <span style={{ flex: 1 }} />
            <nav className="range-filter" aria-label="Period">
              {RANGES.map((option) => (
                <Link key={option.value} href={`/admin?range=${option.value}`} aria-current={option.value === range ? 'true' : undefined} scroll={false}>
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>

          <ActivityCard activity={activity} mayEnquiries={mayEnquiries} mayApplications={mayApplications} />

          {funnel ? (
            <Card title="Admissions funnel" subtitle="How far this period's enquiries have got. Each stage counts everyone who reached it.">
              {funnel[0]!.n === 0 ? (
                <p className="viz-empty">No enquiries in this period yet. The funnel fills in as the office works them.</p>
              ) : (
                <>
                  <BarRows
                    rows={funnel.map((stage, i) => ({
                      label: stage.stage,
                      values: [stage.n],
                      note: i === 0 ? undefined : `${Math.round((stage.n / funnel[0]!.n) * 100)}%`,
                    }))}
                    colors={['var(--viz-ramp-1)', 'var(--viz-ramp-2)', 'var(--viz-ramp-3)', 'var(--viz-ramp-4)', 'var(--viz-ramp-5)']}
                    perRow
                    max={funnel[0]!.n}
                  />
                  <TableView
                    caption="Admissions funnel"
                    head={['Stage', 'Enquiries', 'Share of all']}
                    rows={funnel.map((stage) => [stage.stage, stage.n, `${Math.round((stage.n / funnel[0]!.n) * 100)}%`])}
                  />
                </>
              )}
            </Card>
          ) : null}

          {sources ? (
            <Card title="Where they came from" subtitle="The page each enquiry or application was sent from.">
              {sources.length === 0 ? (
                <p className="viz-empty">Nothing has been sent from the website in this period yet.</p>
              ) : (
                <>
                  <BarRows rows={sources.map((row) => ({ label: row.label, values: [row.n] }))} colors={['var(--viz-1)']} />
                  <TableView caption="Where they came from" head={['Page', 'Sent']} rows={sources.map((row) => [row.label, row.n])} />
                </>
              )}
            </Card>
          ) : null}

          {grades ? <GradesCard grades={grades} mayEnquiries={mayEnquiries} mayApplications={mayApplications} /> : null}
        </section>
      ) : null}

      {notices || counts || bookable.length ? (
        <section className="insight-grid" aria-label="Website insights">
          <div className="insights-head wide">
            <div>
              <h2>The website at a glance</h2>
              <p>What visitors can see right now, and how often it changes.</p>
            </div>
          </div>

          {notices ? (
            <Card title="Notices published" subtitle="Per month, over the last six months.">
              <ColumnChart
                labels={notices.map((m) => format(m.month, { month: 'short' }))}
                tipLabels={notices.map((m) => format(m.month, { month: 'long', year: 'numeric' }))}
                values={notices.map((m) => m.n)}
                color="var(--viz-1)"
              />
              <TableView caption="Notices published per month" head={['Month', 'Notices']} rows={notices.map((m) => [format(m.month, { month: 'long', year: 'numeric' }), m.n])} />
            </Card>
          ) : null}

          {counts ? (
            <Card title="On the website now" subtitle="Everything currently published and visible to visitors.">
              <BarRows
                rows={contentRows.filter((row) => row.may).map((row) => ({ label: row.label, values: [counts[row.key]] }))}
                colors={['var(--viz-1)']}
              />
              <TableView
                caption="Content on the website"
                head={['Content', 'Published']}
                rows={contentRows.filter((row) => row.may).map((row) => [row.label, counts[row.key]])}
              />
            </Card>
          ) : null}

          {bookable.length ? (
            <Card title="Event bookings" subtitle="Places booked for the next events taking bookings." wide={!!notices && !!counts}>
              {bookable.map((event) => (
                <Meter key={event.id} label={event.title} value={event.rsvp_guests} capacity={event.capacity} href={`/admin/events/${event.id}`} />
              ))}
              <TableView
                caption="Event bookings"
                head={['Event', 'Booked', 'Places']}
                rows={bookable.map((event) => [event.title, event.rsvp_guests, event.capacity ?? 'No limit'])}
              />
            </Card>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function ActivityCard({ activity, mayEnquiries, mayApplications }: { activity: Awaited<ReturnType<typeof admissionsActivity>>; mayEnquiries: boolean; mayApplications: boolean }) {
  const { labels, tips } = bucketLabels(activity.unit, activity.buckets.map((b) => b.start));
  const series: Series[] = [
    ...(mayEnquiries ? [{ name: 'Enquiries', values: activity.buckets.map((b) => b.enquiries), color: 'var(--viz-1)' }] : []),
    ...(mayApplications ? [{ name: 'Applications', values: activity.buckets.map((b) => b.applications), color: 'var(--viz-2)' }] : []),
  ];
  const lead = mayEnquiries ? 'enquiries' : 'applications';
  const per = activity.unit === 'day' ? 'Per day' : activity.unit === 'week' ? 'Per week' : 'Per month';

  return (
    <Card title="Admissions activity" subtitle={`${per}. Enquiries include visit bookings.`} wide>
      <div className="hero-stat">
        <div>
          <div className="figure">{activity.totals[lead].toLocaleString('en-GB')}</div>
          <div className="caption">{lead === 'enquiries' ? 'Enquiries received' : 'Applications received'}</div>
          <Delta now={activity.totals[lead]} before={activity.previous[lead]} />
        </div>
        {mayEnquiries && mayApplications ? (
          <div className="side">
            <b>{activity.totals.applications.toLocaleString('en-GB')}</b>
            <span className="caption">Applications received</span>
            <Delta now={activity.totals.applications} before={activity.previous.applications} />
          </div>
        ) : null}
      </div>

      {series.length > 1 ? <Legend items={series.map((s) => ({ name: s.name, color: s.color }))} /> : null}
      <LineChart labels={labels} tipLabels={tips} series={series} />
      {activity.totals.enquiries + activity.totals.applications === 0 ? (
        <p className="viz-empty" style={{ paddingTop: 8 }}>Nothing has arrived in this period yet. New enquiries and applications plot here as they come in.</p>
      ) : null}
      <TableView
        caption="Admissions activity"
        head={['Period', ...series.map((s) => s.name)]}
        rows={activity.buckets.map((_, i) => [tips[i]!, ...series.map((s) => s.values[i] ?? 0)])}
      />
    </Card>
  );
}

function GradesCard({ grades, mayEnquiries, mayApplications }: { grades: Awaited<ReturnType<typeof interestByGrade>>; mayEnquiries: boolean; mayApplications: boolean }) {
  const names = [...(mayEnquiries ? ['Enquiries'] : []), ...(mayApplications ? ['Applications'] : [])];
  const colors = [...(mayEnquiries ? ['var(--viz-1)'] : []), ...(mayApplications ? ['var(--viz-2)'] : [])];
  const valuesOf = (g: (typeof grades)[number]) => [...(mayEnquiries ? [g.enquiries] : []), ...(mayApplications ? [g.applications] : [])];
  const total = grades.reduce((sum, g) => sum + valuesOf(g).reduce((a, b) => a + b, 0), 0);

  return (
    <Card title="Interest by grade" subtitle="Which grades families are asking about, in the school's grade order.">
      {total === 0 ? (
        <p className="viz-empty">No grade has been asked about in this period yet.</p>
      ) : (
        <>
          {names.length > 1 ? <Legend items={names.map((name, i) => ({ name, color: colors[i]! }))} shape="rect" /> : null}
          <BarRows rows={grades.map((g) => ({ label: g.grade, values: valuesOf(g) }))} colors={colors} names={names} />
          <TableView caption="Interest by grade" head={['Grade', ...names]} rows={grades.map((g) => [g.grade, ...valuesOf(g)])} />
        </>
      )}
    </Card>
  );
}
