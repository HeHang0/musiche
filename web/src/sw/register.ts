let swRegistration: ServiceWorkerRegistration | null = null;
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

function sendMessageToServiceWorker(registration: ServiceWorkerRegistration) {
  const proxyAddress = localStorage.getItem('musiche-proxy-address') || '';
  proxyAddress &&
    registration.active?.postMessage({
      type: 'MESSAGE_PROXY_ADDRESS',
      payload: proxyAddress
    });
}

async function unregisterOldServiceWorker(
  workerName: string
): Promise<boolean> {
  let exists = false;
  try {
    let newWorkerName = workerName.substring(workerName.lastIndexOf('/') + 1);
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (let registration of registrations) {
      const scriptURL = registration.active?.scriptURL || '';
      const scriptFileName = scriptURL.substring(
        scriptURL.lastIndexOf('/') + 1
      );
      if (scriptFileName === newWorkerName) {
        sendMessageToServiceWorker(registration);
        exists = true;
      }
      if (!(registration.active?.scriptURL.startsWith('musiche') ?? true)) {
        await registration.unregister();
      }
    }
  } catch (error) {
    console.error('unregister old serviceWorker failed:', error);
  }
  return exists;
}
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const workerName =
        (window as any).serviceWorkerJS || '/musiche.worker.js';
      if (await unregisterOldServiceWorker(workerName)) {
        return;
      }
      swRegistration = await navigator.serviceWorker.register(workerName);
      await swRegistration.update().catch(console.error).finally();
      sendMessageToServiceWorker(swRegistration);
      console.log(
        'Service Worker registered with scope:',
        swRegistration.scope
      );
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}
