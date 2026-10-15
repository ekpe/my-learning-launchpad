/**
 * The course "landing page" content an admin may edit without a code change or redeploy: what appears on the course
 * card, the course page header and its overview. Pure and dependency-free so the admin API, the admin form and the
 * tests all apply exactly the same rules.
 *
 * Deliberately NOT editable here: curriculum, curriculum version, launch gate, price, free flag, order, id.
 * Those change learner access, progress or billing and have their own safeguarded paths.
 */

export interface CourseDetails {
  title: string;
  subtitle: string;
  trackLabel: string;
  description: string;
  cardDescription: string;
  fullDescription: string;
  duration: string;
  format: string;
  audience: string;
  image: string;
  outcomes: string[];
  benefits: string[];
}

type TextSpec = { kind: 'text'; max: number; required?: boolean };
type ListSpec = { kind: 'list'; maxItems: number; maxItem: number };
type ImageSpec = { kind: 'image'; max: number };

export const DETAIL_SPEC: Record<keyof CourseDetails, TextSpec | ListSpec | ImageSpec> = {
  title: { kind: 'text', max: 120, required: true },
  subtitle: { kind: 'text', max: 160 },
  trackLabel: { kind: 'text', max: 40 },
  description: { kind: 'text', max: 600, required: true },
  cardDescription: { kind: 'text', max: 300 },
  fullDescription: { kind: 'text', max: 6000 },
  duration: { kind: 'text', max: 60, required: true },
  format: { kind: 'text', max: 80 },
  audience: { kind: 'text', max: 300, required: true },
  image: { kind: 'image', max: 500 },
  outcomes: { kind: 'list', maxItems: 10, maxItem: 200 },
  benefits: { kind: 'list', maxItems: 10, maxItem: 120 },
};

export const DETAIL_KEYS = Object.keys(DETAIL_SPEC) as (keyof CourseDetails)[];

export const DETAIL_LABELS: Record<keyof CourseDetails, string> = {
  title: 'Course title',
  subtitle: 'Subtitle',
  trackLabel: 'Track label (small tag on the card)',
  description: 'Short description',
  cardDescription: 'Card description (shorter text for the course card)',
  fullDescription: 'Full description',
  duration: 'Duration',
  format: 'Format',
  audience: 'Target audience',
  image: 'Image',
  outcomes: 'Learning outcomes',
  benefits: 'Benefits ("What you get")',
};

/** An https image URL, or a site-relative path such as /images/x.jpg. */
export function isValidImage(v: string): boolean {
  if (!v) return true;
  if (/\s/.test(v)) return false;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export interface DetailsResult {
  ok: boolean;
  /** Cleaned values for every supplied, valid field. */
  fields: Partial<CourseDetails>;
  /** Field -> message, for the form. */
  errors: Partial<Record<keyof CourseDetails | '_', string>>;
}

/**
 * Validates a partial update. Unknown keys (curriculum, price, launchGate, ...) are rejected rather than ignored, so a
 * mistaken or malicious request can never smuggle in a change to something that is not "landing page content".
 */
export function validateCourseDetails(input: unknown): DetailsResult {
  const errors: DetailsResult['errors'] = {};
  const fields: Partial<CourseDetails> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, fields, errors: { _: 'No fields supplied.' } };

  for (const key of Object.keys(input)) {
    if (!(key in DETAIL_SPEC)) errors._ = `"${key}" cannot be edited here.`;
  }

  for (const key of DETAIL_KEYS) {
    if (!(key in (input as object))) continue;
    const raw = (input as any)[key];
    const spec = DETAIL_SPEC[key];

    if (spec.kind === 'list') {
      if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) {
        errors[key] = 'Must be a list of text lines.';
        continue;
      }
      const items = raw.map((x: string) => x.trim()).filter(Boolean);
      if (items.length > spec.maxItems) errors[key] = `Use at most ${spec.maxItems} lines.`;
      else if (items.some((x) => x.length > spec.maxItem)) errors[key] = `Keep each line under ${spec.maxItem} characters.`;
      else (fields as any)[key] = items;
      continue;
    }

    if (typeof raw !== 'string') {
      errors[key] = 'Must be text.';
      continue;
    }
    const value = spec.kind === 'text' && key === 'fullDescription' ? raw.replace(/\r\n/g, '\n').trim() : raw.trim();
    if (spec.kind === 'text' && spec.required && !value) errors[key] = `${DETAIL_LABELS[key]} is required.`;
    else if (value.length > spec.max) errors[key] = `Keep this under ${spec.max} characters (now ${value.length}).`;
    else if (spec.kind === 'image' && !isValidImage(value)) errors[key] = 'Use an https link or a path starting with /.';
    else (fields as any)[key] = value;
  }

  if (Object.keys(fields).length === 0 && Object.keys(errors).length === 0) errors._ = 'No fields supplied.';
  return { ok: Object.keys(errors).length === 0, fields, errors };
}

/** Values to put in the form from any course record (live, draft or static). */
export function detailsFromCourse(c: any): CourseDetails {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    title: str(c?.title),
    subtitle: str(c?.subtitle),
    trackLabel: str(c?.trackLabel),
    description: str(c?.description),
    cardDescription: str(c?.cardDescription),
    fullDescription: str(c?.fullDescription),
    duration: str(c?.duration),
    format: str(c?.format),
    audience: str(c?.audience),
    image: str(c?.image),
    // the course page shows outcomes, falling back to learningObjectives
    outcomes: list(c?.outcomes).length ? list(c?.outcomes) : list(c?.learningObjectives),
    benefits: list(c?.benefits),
  };
}
