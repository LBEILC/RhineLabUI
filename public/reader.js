const search = document.querySelector('#catalogue-search');
search?.addEventListener('input', () => {
  const query = search.value.toLocaleLowerCase().trim();
  let matches = 0;
  document.querySelectorAll('[data-collection]').forEach(collection => {
    let visible = 0;
    collection.querySelectorAll('.directory-row').forEach(row => {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
      if (!row.hidden) visible++;
    });
    collection.hidden = !visible;
    matches += visible;
  });
  document.querySelector('#catalogue-empty').hidden = matches > 0;
});

if ('IntersectionObserver' in window) {
  const links = [...document.querySelectorAll('.reader-sidebar nav a')];
  const observer = new IntersectionObserver(entries => {
    const entry = entries.find(item => item.isIntersecting);
    if (!entry) return;
    links.forEach(link => {
      const active = decodeURIComponent(link.hash.slice(1)) === entry.target.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '0px 0px -65% 0px' });
  document.querySelectorAll('.main-content h1[id],.main-content h2[id],.main-content h3[id]').forEach(heading => observer.observe(heading));
}
