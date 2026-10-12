import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

const SITE = 'https://www.mylearninglaunchpad.com';

function setTag(selector: string, create: () => HTMLElement, attr: string, value: string): () => void {
  let el = document.head.querySelector<HTMLElement>(selector);
  const created = !el;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  const previous = el.getAttribute(attr);
  el.setAttribute(attr, value);
  return () => {
    if (created) el!.remove();
    else if (previous !== null) el!.setAttribute(attr, previous);
  };
}

const meta = (key: 'name' | 'property', name: string) => () => {
  const m = document.createElement('meta');
  m.setAttribute(key, name);
  return m;
};

/**
 * Client-side title/description/canonical for in-app navigation. Social
 * crawlers don't run JavaScript, so /webinar also gets these tags baked into
 * its static HTML at build time (scripts/prerender-webinar.mjs).
 */
export function usePageMeta({ title, description, path, noindex }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const url = SITE + path;
    const cleanups = [
      setTag('meta[name="description"]', meta('name', 'description'), 'content', description),
      setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', url),
      setTag('meta[property="og:title"]', meta('property', 'og:title'), 'content', title),
      setTag('meta[property="og:description"]', meta('property', 'og:description'), 'content', description),
      setTag('meta[property="og:url"]', meta('property', 'og:url'), 'content', url),
      setTag('meta[name="robots"]', meta('name', 'robots'), 'content', noindex ? 'noindex, nofollow' : 'index, follow'),
    ];
    return () => {
      document.title = previousTitle;
      cleanups.reverse().forEach((c) => c());
    };
  }, [title, description, path, noindex]);
}
