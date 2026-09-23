'use server';

/*
 * Every write the admin makes to the website's content.
 *
 * Each action does the same four things in the same order, and the order matters:
 *
 *   1. `requireAction` — the page Execute right and every table right the operation needs. A
 *      Server Action is a POST endpoint the whole internet can reach; the screen that rendered
 *      the form having checked the right proves nothing about the request that arrives.
 *   2. Upload any image to Cloudinary, so a failed upload fails before the row is touched.
 *   3. Call the domain function in lib/content.ts, which validates, writes and audits.
 *   4. Return an ActionResult the form can render — never a thrown error across the wire.
 *
 * The signature is `(previousState, formData)`, which is what `useActionState` in the admin's
 * forms expects; the first argument is unused everywhere.
 */
import { revalidatePath } from 'next/cache';
import { requireAction } from '@/lib/auth.ts';
import { actionResult } from '@/lib/errors.ts';
import { uploadImage, uploadImages } from '@/lib/cloudinary-server.ts';
import * as content from '@/lib/content.ts';
import * as inbox from '@/lib/inbox.ts';
import type { ActionResult } from '@/lib/types.ts';

/*
 * requireAction() returns the actor (id, name, email) with the resolved user attached. It is
 * passed straight through to the domain layer, which reads only the three actor fields — so the
 * audit row always names the person who actually made the request.
 */

const text = (form: FormData, key: string): string => String(form.get(key) ?? '');
const id = (form: FormData, key = 'id'): number => Number(form.get(key) ?? 0);

/** After a content change, the admin list the editor is looking at should be right too. */
const refresh = (...paths: string[]): void => { for (const path of paths) revalidatePath(path); };

/* ========================================================================== news */

export async function savePost(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireAction(editing ? 'NEWS_UPDATE' : 'NEWS_CREATE');

    const uploaded = await uploadImage(form.get('image'), 'news');
    const input: content.PostInput = {
      title: form.get('title'),
      category: form.get('category'),
      excerpt: form.get('excerpt'),
      body: form.get('body'),
      attachmentUrl: form.get('attachment_url'),
      isPublished: form.get('is_published'),
      isPinned: form.get('is_pinned'),
      publishedAt: form.get('published_at'),
      expiresAt: form.get('expires_at'),
      imageUrl: uploaded?.url ?? null,
    };

    if (editing) {
      await content.updatePost(editing, input, actor);
      refresh('/admin/news', `/admin/news/${editing}`);
      return { id: editing };
    }
    const created = await content.createPost(input, actor);
    refresh('/admin/news');
    return { id: created };
  });
}

export async function deletePost(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('NEWS_DELETE');
    await content.deletePost(id(form), actor);
    refresh('/admin/news');
    return { ok: true as const };
  });
}

export async function togglePost(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('NEWS_UPDATE');
    const field = text(form, 'field') === 'is_pinned' ? 'is_pinned' : 'is_published';
    await content.togglePost(id(form), field, actor);
    refresh('/admin/news');
    return { ok: true as const };
  });
}

/* ======================================================================== events */

export async function saveEvent(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireAction(editing ? 'EVENTS_UPDATE' : 'EVENTS_CREATE');

    const uploaded = await uploadImage(form.get('image'), 'events');
    const input: content.EventInput = {
      title: form.get('title'),
      category: form.get('category'),
      summary: form.get('summary'),
      body: form.get('body'),
      location: form.get('location'),
      startsAt: form.get('starts_at'),
      endsAt: form.get('ends_at'),
      allDay: form.get('all_day'),
      isPublished: form.get('is_published'),
      rsvpEnabled: form.get('rsvp_enabled'),
      capacity: form.get('capacity'),
      imageUrl: uploaded?.url ?? null,
    };

    if (editing) {
      await content.updateEvent(editing, input, actor);
      refresh('/admin/events', `/admin/events/${editing}`);
      return { id: editing };
    }
    const created = await content.createEvent(input, actor);
    refresh('/admin/events');
    return { id: created };
  });
}

export async function deleteEvent(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('EVENTS_DELETE');
    await content.deleteEvent(id(form), actor);
    refresh('/admin/events');
    return { ok: true as const };
  });
}

export async function toggleEvent(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('EVENTS_UPDATE');
    const field = text(form, 'field') === 'rsvp_enabled' ? 'rsvp_enabled' : 'is_published';
    await content.toggleEvent(id(form), field, actor);
    refresh('/admin/events');
    return { ok: true as const };
  });
}

export async function deleteRsvp(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('EVENTS_RSVP_DELETE');
    await inbox.deleteRsvp(id(form), actor);
    refresh('/admin/events/bookings');
    return { ok: true as const };
  });
}

/* ======================================================================= gallery */

export async function saveAlbum(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireAction(editing ? 'GALLERY_UPDATE' : 'GALLERY_CREATE');

    const uploaded = await uploadImage(form.get('cover'), 'gallery');
    const input: content.AlbumInput = {
      title: form.get('title'),
      description: form.get('description'),
      takenOn: form.get('taken_on'),
      isPublished: form.get('is_published'),
      sort: form.get('sort'),
      coverUrl: uploaded?.url ?? null,
    };

    if (editing) {
      await content.updateAlbum(editing, input, actor);
      refresh('/admin/gallery', `/admin/gallery/${editing}`);
      return { id: editing };
    }
    const created = await content.createAlbum(input, actor);
    refresh('/admin/gallery');
    return { id: created };
  });
}

export async function deleteAlbum(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('GALLERY_DELETE');
    await content.deleteAlbum(id(form), actor);
    refresh('/admin/gallery');
    return { ok: true as const };
  });
}

/** Adds however many photographs were chosen, uploading them one at a time. */
export async function addPhotos(_prev: unknown, form: FormData): Promise<ActionResult<{ added: number }>> {
  return actionResult(async () => {
    const actor = await requireAction('GALLERY_PHOTO_ADD');
    const albumId = id(form, 'album_id');
    const uploaded = await uploadImages(form.getAll('photos'), 'gallery');
    const caption = text(form, 'caption') || null;
    const added = await content.addPhotos(albumId, uploaded.map((image) => ({ url: image.url, caption })), actor);
    refresh('/admin/gallery', `/admin/gallery/${albumId}`);
    return { added };
  });
}

export async function deletePhoto(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('GALLERY_PHOTO_DELETE');
    const albumId = await content.deletePhoto(id(form), actor);
    refresh('/admin/gallery', `/admin/gallery/${albumId}`);
    return { ok: true as const };
  });
}

export async function setPhotoCaption(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('GALLERY_PHOTO_UPDATE');
    await content.setPhotoCaption(id(form), form.get('caption'), actor);
    refresh('/admin/gallery');
    return { ok: true as const };
  });
}

/* ========================================================================= staff */

export async function saveStaff(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireAction(editing ? 'PEOPLE_UPDATE' : 'PEOPLE_CREATE');

    const uploaded = await uploadImage(form.get('photo'), 'staff');
    const input: content.StaffInput = {
      name: form.get('name'),
      roleTitle: form.get('role_title'),
      category: form.get('category'),
      qualification: form.get('qualification'),
      bio: form.get('bio'),
      email: form.get('email'),
      sort: form.get('sort'),
      isPublished: form.get('is_published'),
      photoUrl: uploaded?.url ?? null,
    };

    if (editing) {
      await content.updateStaff(editing, input, actor);
      refresh('/admin/people', `/admin/people/${editing}`);
      return { id: editing };
    }
    const created = await content.createStaff(input, actor);
    refresh('/admin/people');
    return { id: created };
  });
}

export async function deleteStaff(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('PEOPLE_DELETE');
    await content.deleteStaff(id(form), actor);
    refresh('/admin/people');
    return { ok: true as const };
  });
}

/* ================================================================== testimonials */

export async function saveTestimonial(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireAction(editing ? 'TESTIMONIALS_UPDATE' : 'TESTIMONIALS_CREATE');

    const uploaded = await uploadImage(form.get('photo'), 'testimonials');
    const created = await content.saveTestimonial(editing || null, {
      name: form.get('name'),
      roleTitle: form.get('role_title'),
      quote: form.get('quote'),
      rating: form.get('rating'),
      sort: form.get('sort'),
      isPublished: form.get('is_published'),
      photoUrl: uploaded?.url ?? null,
    }, actor);
    refresh('/admin/testimonials');
    return { id: created };
  });
}

export async function deleteTestimonial(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('TESTIMONIALS_DELETE');
    await content.deleteTestimonial(id(form), actor);
    refresh('/admin/testimonials');
    return { ok: true as const };
  });
}

/* =========================================================================== FAQ */

export async function saveFaq(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireAction(editing ? 'FAQS_UPDATE' : 'FAQS_CREATE');
    const created = await content.saveFaq(editing || null, {
      question: form.get('question'),
      answer: form.get('answer'),
      category: form.get('category'),
      sort: form.get('sort'),
      isPublished: form.get('is_published'),
    }, actor);
    refresh('/admin/faqs');
    return { id: created };
  });
}

export async function deleteFaq(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('FAQS_DELETE');
    await content.deleteFaq(id(form), actor);
    refresh('/admin/faqs');
    return { ok: true as const };
  });
}

/* ==================================================================== academics */

export async function saveLevel(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const editing = id(form);
    const actor = await requireAction('ACADEMICS_MANAGE');
    const uploaded = await uploadImage(form.get('image'), 'levels');
    const saved = await content.saveLevel(editing || null, {
      name: form.get('name'),
      tagline: form.get('tagline'),
      description: form.get('description'),
      ageNote: form.get('age_note'),
      entryNote: form.get('entry_note'),
      sort: form.get('sort'),
      isPublished: form.get('is_published'),
      imageUrl: uploaded?.url ?? null,
    }, actor);
    refresh('/admin/academics', `/admin/academics/${saved}`);
    return { id: saved };
  });
}

export async function deleteLevel(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('ACADEMICS_MANAGE');
    await content.deleteLevel(id(form), actor);
    refresh('/admin/academics');
    return { ok: true as const };
  });
}

export async function addGrade(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('ACADEMICS_MANAGE');
    const levelId = id(form, 'level_id');
    await content.addGrade(levelId, form.get('name'), form.get('sort'), actor);
    refresh('/admin/academics', `/admin/academics/${levelId}`);
    return { ok: true as const };
  });
}

export async function deleteGrade(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('ACADEMICS_MANAGE');
    await content.deleteGrade(id(form), actor);
    refresh('/admin/academics', `/admin/academics/${id(form, 'level_id')}`);
    return { ok: true as const };
  });
}

export async function addSubject(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('ACADEMICS_MANAGE');
    const levelId = id(form, 'level_id');
    await content.addSubject(levelId, form.get('name'), form.get('is_core'), actor);
    refresh('/admin/academics', `/admin/academics/${levelId}`);
    return { ok: true as const };
  });
}

export async function deleteSubject(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('ACADEMICS_MANAGE');
    await content.deleteSubject(id(form), actor);
    refresh('/admin/academics', `/admin/academics/${id(form, 'level_id')}`);
    return { ok: true as const };
  });
}

/* ========================================================================= terms */

export async function saveTerm(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const actor = await requireAction('TERMS_MANAGE');
    const saved = await content.saveTerm(id(form) || null, {
      name: form.get('name'),
      yearName: form.get('year_name'),
      startDate: form.get('start_date'),
      endDate: form.get('end_date'),
      isCurrent: form.get('is_current'),
      note: form.get('note'),
    }, actor);
    refresh('/admin/academics/terms');
    return { id: saved };
  });
}

export async function deleteTerm(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('TERMS_MANAGE');
    await content.deleteTerm(id(form), actor);
    refresh('/admin/academics/terms');
    return { ok: true as const };
  });
}

/* ========================================================================== fees */

export async function saveFee(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const actor = await requireAction('FEES_MANAGE');
    const saved = await content.saveFee(id(form) || null, {
      termId: form.get('term_id'),
      gradeId: form.get('grade_id'),
      item: form.get('item'),
      amount: form.get('amount'),
      appliesTo: form.get('applies_to'),
      sort: form.get('sort'),
    }, actor);
    refresh('/admin/academics/fees');
    return { id: saved };
  });
}

export async function deleteFee(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('FEES_MANAGE');
    await content.deleteFee(id(form), actor);
    refresh('/admin/academics/fees');
    return { ok: true as const };
  });
}

export async function copyFees(_prev: unknown, form: FormData): Promise<ActionResult<{ lines: number }>> {
  return actionResult(async () => {
    const actor = await requireAction('FEES_MANAGE');
    const lines = await content.copyFees(Number(form.get('from_term')), Number(form.get('to_term')), actor);
    refresh('/admin/academics/fees');
    return { lines };
  });
}

/* ===================================================================== transport */

export async function saveRoute(_prev: unknown, form: FormData): Promise<ActionResult<{ id: number }>> {
  return actionResult(async () => {
    const actor = await requireAction('TRANSPORT_MANAGE');
    const saved = await content.saveRoute(id(form) || null, {
      code: form.get('code'),
      name: form.get('name'),
      description: form.get('description'),
      fare: form.get('fare'),
      sort: form.get('sort'),
      isPublished: form.get('is_published'),
    }, actor);
    refresh('/admin/transport', `/admin/transport/${saved}`);
    return { id: saved };
  });
}

export async function deleteRoute(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('TRANSPORT_MANAGE');
    await content.deleteRoute(id(form), actor);
    refresh('/admin/transport');
    return { ok: true as const };
  });
}

export async function saveStop(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('TRANSPORT_MANAGE');
    const routeId = id(form, 'route_id');
    await content.saveStop(id(form) || null, routeId, {
      name: form.get('name'),
      pickup: form.get('pickup_time'),
      dropoff: form.get('dropoff_time'),
      sort: form.get('sort'),
    }, actor);
    refresh('/admin/transport', `/admin/transport/${routeId}`);
    return { ok: true as const };
  });
}

export async function deleteStop(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('TRANSPORT_MANAGE');
    await content.deleteStop(id(form), actor);
    refresh('/admin/transport', `/admin/transport/${id(form, 'route_id')}`);
    return { ok: true as const };
  });
}

/* ====================================================================== settings */

export async function saveSettings(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('SETTINGS_MANAGE');

    const [logo, hero] = await Promise.all([
      uploadImage(form.get('logo'), 'brand'),
      uploadImage(form.get('hero_image'), 'brand'),
    ]);

    // Only the fields this form actually posted are written; the settings screen is in sections,
    // and a section that was not on screen must not blank the columns it owns.
    const input: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (key === 'logo' || key === 'hero_image' || key === '$ACTION_ID') continue;
      if (typeof value === 'string') input[key] = value;
    }

    await content.saveSettings(input, actor, {
      ...(logo ? { logo_url: logo.url } : {}),
      ...(hero ? { hero_image_url: hero.url } : {}),
    });
    refresh('/admin/settings', '/admin');
    return { ok: true as const };
  });
}

/* ==================================================================== the inbox */

export async function setEnquiryStatus(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('ENQUIRIES_UPDATE');
    await inbox.setEnquiryStatus(id(form), form.get('status'), form.get('notes'), actor);
    refresh('/admin/enquiries', `/admin/enquiries/${id(form)}`);
    return { ok: true as const };
  });
}

export async function deleteEnquiry(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('ENQUIRIES_DELETE');
    await inbox.deleteEnquiry(id(form), actor);
    refresh('/admin/enquiries');
    return { ok: true as const };
  });
}

export async function setApplicationStatus(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('APPLICATIONS_UPDATE');
    await inbox.setApplicationStatus(id(form), form.get('status'), form.get('notes'), actor);
    refresh('/admin/applications', `/admin/applications/${id(form)}`);
    return { ok: true as const };
  });
}

export async function deleteApplication(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('APPLICATIONS_DELETE');
    await inbox.deleteApplication(id(form), actor);
    refresh('/admin/applications');
    return { ok: true as const };
  });
}

export async function setSubscriberStatus(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('SUBSCRIBERS_UPDATE');
    await inbox.setSubscriberStatus(id(form), text(form, 'status') === 'ACTIVE' ? 'ACTIVE' : 'UNSUBSCRIBED', actor);
    refresh('/admin/subscribers');
    return { ok: true as const };
  });
}

export async function deleteSubscriber(_prev: unknown, form: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const actor = await requireAction('SUBSCRIBERS_DELETE');
    await inbox.deleteSubscriber(id(form), actor);
    refresh('/admin/subscribers');
    return { ok: true as const };
  });
}
