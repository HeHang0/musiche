export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    let routerPrefix = localStorage.getItem('musiche-router-prefix') || '';
    if (routerPrefix) routerPrefix = '/' + routerPrefix;
    navigator.serviceWorker
      .register(routerPrefix + '/worker.js')
      .then(registration => {
        console.log(
          'Service Worker registered with scope:',
          registration.scope
        );
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  }
}
