import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
function tokens(dark: boolean): Record<string, string> {
  const paper = dark ? '#222722' : '#f0eee8', surface = dark ? '#2b302a' : '#faf9f5', soft = dark ? '#353c33' : '#e5e4dc'
  const ink = dark ? '#eeeede' : '#272c23', muted = dark ? '#babfb0' : '#63685b', line = dark ? '#57604f' : '#b9bcae', accent = dark ? '#c8caa0' : '#4f6040'
  const values = {
    'bg-base': paper, 'bg-layer-1': surface, 'bg-layer-2': surface, 'bg-layer-3': soft, 'bg-overlay': surface,
    'bg-module-platform': soft, 'bg-multi-select': soft, 'bg-skeleton': soft, 'bg-mask-1': '#141b1699', 'bg-mask-2': '#141b1644', 'bg-mask-3': '#141b16bb',
    'border-l1': line, 'border-l2': line, 'border-l2-darkmode-thin': line, 'border-l3': line, 'border-l4': muted,
    'brand-primary': accent, 'brand-primary-invert': paper, 'brand-text': accent,
    'button-primary-fill': dark ? '#b9c499' : '#35432c', 'button-primary-hover': dark ? '#d1dabc' : '#24331f', 'button-primary-dimmed': soft,
    'button-contrast-fill': ink, 'button-elevated-fill': surface, 'button-floating-fill': surface, 'button-floating-hover': soft,
    'button-info-fill': '#4f6040', 'button-info-hover': '#35462a',
    'button-ghost-active-border': accent, 'button-ghost-active-fill': soft, 'button-ghost-active-hover': soft,
    'interactive-bg-active': soft, 'interactive-bg-hover-accent': soft, 'interactive-bg-hover-solid': soft, 'interactive-bg-hover': soft,
    'interactive-bg-hover-danger': dark ? '#633e33' : '#f0d9ca',
    'label-primary': ink, 'label-primary-bluish': ink, 'label-primary-dimmed': muted, 'label-secondary': muted,
    'label-tertiary': muted, 'label-caption': muted, 'label-dimmed': muted, 'label-primary-foreground': dark ? '#222722' : '#faf9f5', 'label-primary-inverted': surface,
    'link': dark ? '#d0d9aa' : '#465d2d', 'markdown-code-block': soft, 'markdown-code-block-banner': soft,
    'markdown-inline-code': soft, 'markdown-citation': soft, 'markdown-placeholder': soft, 'markdown-tag': soft,
    'scrollbar-bg-l1': line, 'scrollbar-bg-l2': line, 'scrollbar-hover-l1': muted, 'scrollbar-hover-l2': muted,
    'separator-primary': line, 'state-business-primary': accent, 'state-business-tertiary': soft,
    'state-success-primary': accent, 'state-success-secondary': accent, 'state-success-tertiary': soft,
    'state-warn-label': dark ? '#e1b17c' : '#815220', 'state-warn-primary': dark ? '#e1b17c' : '#815220', 'state-warn-secondary': '#c18f53', 'state-warn-tertiary': soft,
    'state-error-primary': dark ? '#f2ae93' : '#a34429', 'state-error-secondary': dark ? '#f2ae93' : '#a34429', 'toast-bg': ink, 'tooltip-bg': ink,
  }
  const result = Object.fromEntries(Object.entries(values).map(([key, value]) => ['--dsw-alias-' + key, value]))
  for (const key of ['bubble', 'input-major', 'login-input', 'menu', 'selector', 'sidebar-fill', 'tip']) result['--dsw-specific-' + key] = surface
  for (const key of ['bubble-highlight', 'sidebar-nav-item-active-accent', 'sidebar-nav-item-active', 'sidebar-nav-item-hover']) result['--dsw-specific-' + key] = soft
  Object.assign(result, {
    '--dsw-font-family': '"Segoe UI", "Microsoft YaHei UI", sans-serif', '--ds-font-family-code': '"Cascadia Code", Consolas, monospace',
    '--dsw-elevation-soft': '0 4px 12px #1820140b', '--dsw-elevation-panel': '0 16px 48px #18201420',
    '--dsw-elevation-prominent': '0 24px 72px #18201430', '--dsw-elevation-stroke-color': line,
    '--dsw-shadow-lv2': '0 10px 32px #18201420', '--dsw-shadow-lv3': '0 24px 72px #18201430',
    '--dsw-radius-sm': '2px', '--dsw-radius-md': '3px', '--dsw-radius-lg': '3px',
    '--shiki-foreground': ink, '--shiki-background': soft, '--shiki-token-comment': muted,
    '--shiki-token-string': dark ? '#c7d597' : '#526c31', '--shiki-token-keyword': dark ? '#e6b987' : '#985c28', '--shiki-token-function': accent,
  })
  return result
}
const light = tokens(false), dark = tokens(true)
export const TOKENS: ThemeTokenOverrides = Object.fromEntries(Object.entries(light).map(([key, value]) => [key, { light: value, dark: dark[key]! }]))
