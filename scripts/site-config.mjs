import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const engineRoot = fileURLToPath(new URL('../', import.meta.url));
export const contentRoot = resolve(process.env.RHINELAB_CONTENT_DIR || join(engineRoot, 'examples/rhine-lab'));
export const generatedRoot = join(engineRoot, '.generated');
export const outputRoot = join(engineRoot, 'dist');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function loadSite(root = contentRoot) {
  let data = {};
  try { data = JSON.parse(await readFile(join(root, 'site.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const site = {
    title: 'RHINE LAB · ANALYSIS OS', brand: 'RHINE LAB', author: 'Author', label: 'RHINE LAB, LLC.',
    lang: 'zh-CN', sessionName: 'JOYCE MOORE', sessionStatus: 'SESSION AUTHORIZED',
    welcomeName: 'RHINE LAB.LLC.', welcomeMessage: '欢迎访问莱茵生命内部资料档案',
    url: 'https://example.com', githubUrl: '', favicon: '/favicon.svg', description: 'Notes, projects, and things learned.',
    intro: 'Welcome to this personal archive.', headline: 'A record of\nthings', headlineEmphasis: 'learned.',
    projectLinkPrefixes: [], projectTitleAliases: {}, ...data,
  };
  for (const key of ['title', 'brand', 'author', 'label', 'url', 'githubUrl', 'favicon', 'description', 'intro', 'headline', 'headlineEmphasis', 'lang', 'sessionName', 'sessionStatus', 'welcomeName', 'welcomeMessage']) {
    if (typeof site[key] !== 'string') throw new Error(`site.json: ${key} must be a string`);
  }
  try {
    if (!site.lang) throw new Error();
    site.lang = Intl.getCanonicalLocales(site.lang)[0];
  } catch { throw new Error('site.json: lang must be a valid language tag'); }
  const url = new URL(site.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) throw new Error('site.json: url must be an HTTP(S) origin without a path');
  site.url = url.origin;
  if (site.githubUrl && !/^https?:\/\//.test(site.githubUrl)) throw new Error('site.json: githubUrl must be HTTP(S)');
  if (!Array.isArray(site.projectLinkPrefixes) || site.projectLinkPrefixes.some(value => typeof value !== 'string')) {
    throw new Error('site.json: projectLinkPrefixes must be an array of strings');
  }
  if (!site.projectTitleAliases || Array.isArray(site.projectTitleAliases) || typeof site.projectTitleAliases !== 'object' || Object.values(site.projectTitleAliases).some(value => typeof value !== 'string')) throw new Error('site.json: projectTitleAliases must map labels to titles');
  return site;
}

export function siteTokens(html, site) {
  return html.replace(/\{\{site\.(\w+)\}\}/g, (_, key) => escapeHtml(site[key]));
}
