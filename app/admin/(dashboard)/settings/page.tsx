import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { getSettings } from '@/lib/site.ts';
import { saveSettings } from '@/app/actions/content.ts';
import { ActionForm, ImageField, Submit } from '../ui.tsx';

export const metadata = { title: 'School profile & theme' };

/*
 * Everything about the school that the website repeats in a dozen places — name, motto, address,
 * the phone number in the header, the colours the whole site is built from.
 *
 * Saved in sections rather than as one enormous form: each section posts only its own fields, so
 * a slow connection cannot half-save the school's identity, and a mistake in one section is
 * fixed without re-reading the rest.
 */
export default async function SettingsPage() {
  const user = await requirePage('SETTINGS');
  const school = await getSettings();
  const mayEdit = canAction(user, 'SETTINGS_MANAGE');

  return (
    <>
      {!mayEdit ? (
        <div className="note note-info">Your Permission Set lets you read the school profile but not change it.</div>
      ) : null}

      {/* ------------------------------------------------------------ identity */}
      <ActionForm action={saveSettings} success="Saved. The website has been updated.">
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>The school</h2>
                <p>Used in the header, the footer, every page title and the structured data search engines read.</p>
              </div>
              <span style={{ flex: 1 }} />
              {mayEdit ? <Submit>Save</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" type="text" required maxLength={200} defaultValue={school.name} />
                </div>
                <div className="field">
                  <label htmlFor="short_name">Short name</label>
                  <input id="short_name" name="short_name" type="text" maxLength={80} defaultValue={school.short_name ?? ''} />
                  <p className="help">Shown beside the crest, where the full name would not fit.</p>
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="motto">Motto</label>
                  <input id="motto" name="motto" type="text" maxLength={200} defaultValue={school.motto ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="school_type">Kind of school</label>
                  <input id="school_type" name="school_type" type="text" maxLength={120} defaultValue={school.school_type ?? ''} placeholder="Private day and boarding school" />
                </div>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="founded_year">Founded</label>
                  <input id="founded_year" name="founded_year" type="text" maxLength={10} defaultValue={school.founded_year ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="registration_no">MoE registration</label>
                  <input id="registration_no" name="registration_no" type="text" maxLength={80} defaultValue={school.registration_no ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="licence_no">Licence</label>
                  <input id="licence_no" name="licence_no" type="text" maxLength={80} defaultValue={school.licence_no ?? ''} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="about_intro">One-line description</label>
                <input id="about_intro" name="about_intro" type="text" maxLength={300} defaultValue={school.about_intro ?? ''} />
                <p className="help">Used on the home page and as the site&rsquo;s description in search results.</p>
              </div>
              <div className="field">
                <label htmlFor="about_story">Our story</label>
                <textarea id="about_story" name="about_story" maxLength={4000} defaultValue={school.about_story ?? ''} placeholder="A blank line starts a new paragraph." />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="mission">Mission</label>
                  <textarea id="mission" name="mission" maxLength={1000} defaultValue={school.mission ?? ''} style={{ minHeight: 90 }} />
                </div>
                <div className="field">
                  <label htmlFor="vision">Vision</label>
                  <textarea id="vision" name="vision" maxLength={1000} defaultValue={school.vision ?? ''} style={{ minHeight: 90 }} />
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {/* ------------------------------------------------------------- contact */}
      <ActionForm action={saveSettings} success="Contact details saved.">
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>Where to find us</h2>
                <p>The contact strip at the top of every page, the footer and the contact page.</p>
              </div>
              <span style={{ flex: 1 }} />
              {mayEdit ? <Submit>Save</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="physical_address">Physical address</label>
                  <input id="physical_address" name="physical_address" type="text" maxLength={200} defaultValue={school.physical_address ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="postal_address">Postal address</label>
                  <input id="postal_address" name="postal_address" type="text" maxLength={120} defaultValue={school.postal_address ?? ''} />
                </div>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="city">Town or city</label>
                  <input id="city" name="city" type="text" maxLength={80} defaultValue={school.city ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="county">County</label>
                  <input id="county" name="county" type="text" maxLength={80} defaultValue={school.county ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="country">Country</label>
                  <input id="country" name="country" type="text" maxLength={80} defaultValue={school.country ?? 'Kenya'} />
                </div>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="phone_primary">Main phone</label>
                  <input id="phone_primary" name="phone_primary" type="tel" maxLength={30} defaultValue={school.phone_primary ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="phone_secondary">Second phone</label>
                  <input id="phone_secondary" name="phone_secondary" type="tel" maxLength={30} defaultValue={school.phone_secondary ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="whatsapp_number">WhatsApp</label>
                  <input id="whatsapp_number" name="whatsapp_number" type="tel" maxLength={30} defaultValue={school.whatsapp_number ?? ''} />
                  <p className="help">Adds the floating WhatsApp button. Leave empty to remove it.</p>
                </div>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="email">General email</label>
                  <input id="email" name="email" type="email" maxLength={160} defaultValue={school.email ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="admissions_email">Admissions email</label>
                  <input id="admissions_email" name="admissions_email" type="email" maxLength={160} defaultValue={school.admissions_email ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="office_hours">Office hours</label>
                  <input id="office_hours" name="office_hours" type="text" maxLength={200} defaultValue={school.office_hours ?? ''} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="map_embed_url">Google Maps embed link</label>
                <input id="map_embed_url" name="map_embed_url" type="url" maxLength={600} defaultValue={school.map_embed_url ?? ''} placeholder="https://www.google.com/maps/embed?pb=…" />
                <p className="help">From Google Maps → Share → Embed a map → copy the <code>src</code> of the iframe. Adds a map to the contact page.</p>
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {/* ---------------------------------------------------------- appearance */}
      <ActionForm action={saveSettings} success="Appearance saved.">
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>Appearance</h2>
                <p>Three colours build the whole site — buttons, gradients, focus rings and the admin you are looking at.</p>
              </div>
              <span style={{ flex: 1 }} />
              {mayEdit ? <Submit>Save</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="brand_primary">Primary</label>
                  <input id="brand_primary" name="brand_primary" type="color" defaultValue={school.brand_primary} />
                  <p className="help">Buttons, links, headings.</p>
                </div>
                <div className="field">
                  <label htmlFor="brand_deep">Deep</label>
                  <input id="brand_deep" name="brand_deep" type="color" defaultValue={school.brand_deep} />
                  <p className="help">The footer, the hero gradient, the admin sidebar.</p>
                </div>
                <div className="field">
                  <label htmlFor="brand_accent">Accent</label>
                  <input id="brand_accent" name="brand_accent" type="color" defaultValue={school.brand_accent} />
                  <p className="help">Calls to action, and the focus ring. Make sure dark text is readable on it.</p>
                </div>
              </div>

              <div className="grid-2">
                <ImageField name="logo" label="Crest or logo" current={school.logo_url} hint="Square works best. Shown in the header, the footer and the sign-in page." />
                <div className="field">
                  <label htmlFor="crest_emoji">Crest stand-in</label>
                  <input id="crest_emoji" name="crest_emoji" type="text" maxLength={8} defaultValue={school.crest_emoji ?? '🎓'} />
                  <p className="help">Used until a logo is uploaded.</p>
                </div>
              </div>

              <ImageField name="hero_image" label="Home page photograph" current={school.hero_image_url} hint="Wide and bright. A gradient is laid over it, so the detail at the left is hidden." />

              <div className="field">
                <label htmlFor="hero_headline">Home page headline</label>
                <input id="hero_headline" name="hero_headline" type="text" maxLength={200} defaultValue={school.hero_headline ?? ''} placeholder={school.motto ?? 'Know the child, teach the child'} />
              </div>
              <div className="field">
                <label htmlFor="hero_body">Home page introduction</label>
                <textarea id="hero_body" name="hero_body" maxLength={1000} defaultValue={school.hero_body ?? ''} style={{ minHeight: 90 }} />
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {/* -------------------------------------------------------------- facts */}
      <ActionForm action={saveSettings} success="Figures saved.">
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>The figures on the home page</h2>
                <p>Published as counters. Keep them true — a prospective parent will ask about them on the tour.</p>
              </div>
              <span style={{ flex: 1 }} />
              {mayEdit ? <Submit>Save</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="stat_students">Pupils on the roll</label>
                  <input id="stat_students" name="stat_students" type="number" min={0} max={100000} defaultValue={school.stat_students} />
                </div>
                <div className="field">
                  <label htmlFor="stat_teachers">Teachers</label>
                  <input id="stat_teachers" name="stat_teachers" type="number" min={0} max={10000} defaultValue={school.stat_teachers} />
                </div>
                <div className="field">
                  <label htmlFor="stat_clubs">Clubs &amp; societies</label>
                  <input id="stat_clubs" name="stat_clubs" type="number" min={0} max={1000} defaultValue={school.stat_clubs} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="stat_pass_rate">Headline result</label>
                <input id="stat_pass_rate" name="stat_pass_rate" type="text" maxLength={120} defaultValue={school.stat_pass_rate ?? ''} placeholder="100% transition to senior school, 2025" />
                <p className="help">Written as &ldquo;figure, context&rdquo; — the part before the comma is shown large.</p>
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {/* --------------------------------------------------- money and links */}
      <ActionForm action={saveSettings} success="Saved.">
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>Fees, the portal and social media</h2>
                <p>How parents pay, where the portal lives, and where else the school posts.</p>
              </div>
              <span style={{ flex: 1 }} />
              {mayEdit ? <Submit>Save</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="currency_symbol">Currency symbol</label>
                  <input id="currency_symbol" name="currency_symbol" type="text" maxLength={8} defaultValue={school.currency_symbol} />
                </div>
                <div className="field">
                  <label htmlFor="paybill_no">M-Pesa paybill</label>
                  <input id="paybill_no" name="paybill_no" type="text" maxLength={30} defaultValue={school.paybill_no ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="portal_url">Parent portal address</label>
                  <input id="portal_url" name="portal_url" type="url" maxLength={600} defaultValue={school.portal_url ?? ''} placeholder="https://portal.school.ac.ke" />
                  <p className="help">The one link between this website and the management system.</p>
                </div>
              </div>
              <div className="field">
                <label htmlFor="bank_details">Bank details</label>
                <textarea id="bank_details" name="bank_details" maxLength={600} defaultValue={school.bank_details ?? ''} style={{ minHeight: 80 }} />
                <p className="help">Published on the fees page. Account name and number only — never a signatory&rsquo;s details.</p>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="facebook_url">Facebook</label>
                  <input id="facebook_url" name="facebook_url" type="url" maxLength={600} defaultValue={school.facebook_url ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="instagram_url">Instagram</label>
                  <input id="instagram_url" name="instagram_url" type="url" maxLength={600} defaultValue={school.instagram_url ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="youtube_url">YouTube</label>
                  <input id="youtube_url" name="youtube_url" type="url" maxLength={600} defaultValue={school.youtube_url ?? ''} />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="x_url">X</label>
                  <input id="x_url" name="x_url" type="url" maxLength={600} defaultValue={school.x_url ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="tiktok_url">TikTok</label>
                  <input id="tiktok_url" name="tiktok_url" type="url" maxLength={600} defaultValue={school.tiktok_url ?? ''} />
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      <div className="panel">
        <header><h2>What this site does not hold</h2></header>
        <div className="body">
          <p className="help" style={{ margin: 0 }}>
            No pupil record, no mark, no register and no fee balance is stored here. The academic structure, term dates
            and fee structure on this site are what the school has chosen to <em>publish</em> — the management system
            remains the record of what any individual owes or scored. That separation is the reason this website runs
            as its own application, with its own database and its own logins.{' '}
            <Link href="/privacy" target="_blank">The privacy notice</Link> says the same thing to parents.
          </p>
        </div>
      </div>
    </>
  );
}
