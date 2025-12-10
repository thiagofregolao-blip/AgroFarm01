export async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("✅ Service Worker registrado:", registration.scope);
      return registration;
    } catch (error) {
      console.error("❌ Erro ao registrar Service Worker:", error);
    }
  }
}

export async function requestNotificationPermission() {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    console.log("Permissão de notificação:", permission);
    return permission === "granted";
  }
  return false;
}

export function showNotification(title: string, options?: NotificationOptions) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, options);
  }
}
