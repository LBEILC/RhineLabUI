const catalogue = document.querySelector<HTMLElement>('#catalogue')!;
const viewport = document.querySelector<HTMLElement>('#viewport')!;
const params = new URLSearchParams(location.search);
const desktop = matchMedia('(min-width: 1000px) and (min-height: 620px)');

function showCatalogue() {
  viewport.hidden = true;
  catalogue.hidden = false;
  document.body.className = 'catalogue-page';
}

async function start() {
  if (params.get('view') === 'list' || !desktop.matches) return;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2');
  if (!context) return;
  context.getExtension('WEBGL_lose_context')?.loseContext();
  viewport.hidden = false;
  catalogue.hidden = true;
  document.body.className = 'archive-page';
  window.addEventListener('archive-unavailable', showCatalogue, { once: true });
  try { await import('./main'); }
  catch (error) {
    console.error('Could not load the interactive archive:', error);
    showCatalogue();
  }
}

desktop.addEventListener('change', () => {
  if (!desktop.matches && !viewport.hidden) location.replace('/?view=list');
});
void start();
