// PWA initialization
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = (window.SITE_BASEURL || '') + '/service-worker.js';
    navigator.serviceWorker.register(swPath)
      .then(registration => {
        console.log('SW registered:', registration);
      })
      .catch(error => {
        console.log('SW registration failed:', error);
      });
  });
}
