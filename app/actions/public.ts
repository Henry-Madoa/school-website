'use server';

/*
 * Everything an anonymous visitor may write: an enquiry, a tour booking, an online application,
 * an event booking and a newsletter sign-up. Five actions, and nothing else on this site accepts
 * a POST from someone who is not signed in.
 *
 * Each one is rate-limited by address, validated in the domain layer, screened by a honeypot and
 * recorded against a synthetic `website` actor rather than a login. Nothing here reads or returns
 * anybody's personal data: the caller gets a reference number and no more.
 */
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { actionResult, AppError } from '@/lib/errors.ts';
import { rateLimit, clientIp } from '@/lib/rate-limit.ts';
import { createEnquiry, createApplication, createRsvp, subscribe } from '@/lib/inbox.ts';
import type { ActionResult, FormValues } from '@/lib/types.ts';

/**
 * Two windows per form: a burst, so a double-tap on a slow connection cannot file two enquiries,
 * and an hourly ceiling so one address cannot flood the admissions desk.
 */
async function guard(kind: string, perHour: number): Promise<void> {
  const ip = clientIp(await headers());
  if (!rateLimit(`site:${kind}:burst:${ip}`, 3, 60_000).ok) {
    throw new AppError('Please wait a moment before sending another — the school has your first message.', 'RATE_LIMITED');
  }
  if (!rateLimit(`site:${kind}:hour:${ip}`, perHour, 3_600_000).ok) {
    throw new AppError('Too many submissions from this connection. Please call the school office instead.', 'RATE_LIMITED');
  }
}

/**
 * A honeypot: a field no person sees and every crude bot fills. Cheaper than a puzzle, and a
 * parent on a phone should not be asked to identify traffic lights to ask about school fees.
 *
 * A bot that is told it failed simply tries again, so a filled honeypot is accepted silently and
 * thrown away.
 */
const looksAutomated = (values: FormValues): boolean => !!String(values.website_url ?? '').trim();

const str = (value: FormDataEntryValue | undefined): string => String(value ?? '').trim();

/* ------------------------------------------------------------------- enquiries */

export async function submitEnquiry(values: FormValues): Promise<ActionResult<{ reference: string }>> {
  return actionResult(async () => {
    await guard('enquiry', 10);
    if (looksAutomated(values)) return { reference: 'ENQ-0000' };

    const { reference } = await createEnquiry({
      kind: values.kind,
      name: values.name,
      phone: values.phone,
      email: values.email,
      gradeId: values.grade_id,
      message: values.message,
      preferredDate: values.preferred_date,
      preferredTime: values.preferred_time,
      visitors: values.visitors,
      sourcePage: values.source_page,
    });
    revalidatePath('/admin/enquiries');
    return { reference };
  });
}

/* ----------------------------------------------------------------- application */

export async function submitApplication(values: FormValues): Promise<ActionResult<{ no: string }>> {
  return actionResult(async () => {
    await guard('application', 5);
    if (looksAutomated(values)) return { no: 'APP-0000' };

    const { no } = await createApplication({
      firstName: values.first_name,
      middleName: values.middle_name,
      lastName: values.last_name,
      dateOfBirth: values.date_of_birth,
      gender: values.gender,
      previousSchool: values.previous_school,
      gradeId: values.grade_id,
      boardingStatus: values.boarding_status,
      transportRoute: values.transport_route,
      medical: values.medical,
      guardianName: values.guardian_name,
      guardianRelationship: values.guardian_relationship,
      guardianPhone: values.guardian_phone,
      guardianEmail: values.guardian_email,
      message: values.message,
      photoConsent: values.photo_consent,
      declaration: values.declaration,
      privacy: values.privacy,
      sourcePage: values.source_page,
    });
    revalidatePath('/admin/applications');
    return { no };
  });
}

/* ------------------------------------------------------------------------ RSVP */

export async function submitRsvp(values: FormValues): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    await guard('rsvp', 10);
    if (looksAutomated(values)) return { ok: true as const };

    const eventId = Number(str(values.event_id));
    if (!eventId) throw new AppError('We could not tell which event that was for.', 'VALIDATION');

    await createRsvp(eventId, {
      name: values.name,
      phone: values.phone,
      email: values.email,
      guests: values.guests,
      message: values.message,
    });
    revalidatePath('/events');
    revalidatePath('/admin/events');
    return { ok: true as const };
  });
}

/* ------------------------------------------------------------------ newsletter */

export async function subscribeToNewsletter(values: FormValues): Promise<ActionResult<{ email: string }>> {
  return actionResult(async () => {
    await guard('subscribe', 10);
    if (looksAutomated(values)) return { email: str(values.email) };

    const { email } = await subscribe({ email: values.email, name: values.name, sourcePage: values.source_page });
    revalidatePath('/admin/subscribers');
    return { email };
  });
}
