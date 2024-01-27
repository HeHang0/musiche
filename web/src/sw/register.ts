let swRegistration: ServiceWorkerRegistration | null = null;
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}
async function unregisterOldServiceWorker(workerName: string) {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (let registration of registrations) {
      if (!(registration.active?.scriptURL.endsWith(workerName) ?? true)) {
        await registration.update().catch(console.error).finally();
        await registration.unregister();
      }
    }
  } catch (error) {
    console.error('unregister old serviceWorker failed:', error);
  }
}
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      let routerPrefix = localStorage.getItem('musiche-router-prefix') || '';
      if (routerPrefix) routerPrefix = '/' + routerPrefix;
      const workerName =
        (window as any).serviceWorkerJS || 'worker.js?' + Date.now();
      await unregisterOldServiceWorker(workerName);
      swRegistration = await navigator.serviceWorker.register(
        routerPrefix + '/' + workerName
      );
      console.log(
        'Service Worker registered with scope:',
        swRegistration.scope
      );
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}
