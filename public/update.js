// Network-only recovery entry: older workers do not intercept this page.
const button = document.querySelector('#update');
const status = document.querySelector('#status');
function waitForState(worker, states) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      error ? reject(error) : resolve();
    };
    const check = () => {
      if (states.includes(worker.state)) finish();
      else if (worker.state === 'redundant') finish(new Error('download'));
    };
    const timer = setTimeout(() => finish(new Error('timeout')), 120000);
    worker.addEventListener('statechange', check);
    check();
  });
}
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = '正在检查并下载完整资源，请保持联网…';
  try {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) throw new Error('unsupported');
    const base = new URL('./', location.href);
    const registration = await navigator.serviceWorker.register(new URL('sw.js', base), {scope: base.href, updateViaCache: 'none'});
    // Await the network check even if a previous waiting version already exists.
    await registration.update();
    const installing = registration.installing;
    if (installing) await waitForState(installing, ['installed', 'activating', 'activated']);
    const worker = registration.waiting || registration.active;
    if (!worker) throw new Error('download');
    if (registration.waiting) {
      status.textContent = '资源已就绪，正在应用更新…';
      worker.postMessage({type: 'RHINE_APPLY_UPDATE'});
    }
    await waitForState(worker, ['activated']);
    // Claiming clients is part of the worker's activation; navigate afterwards.
    location.replace(base.href);
  } catch {
    status.textContent = '更新未完成，已保留原有数据。请确认网络可用后重试。';
    button.textContent = '重试更新 ↻';
    button.disabled = false;
  }
});
