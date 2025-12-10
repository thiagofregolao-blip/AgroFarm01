import { useEffect } from "react";
import { showNotification } from "@/utils/sw-register";

export function useNotifications() {
  useEffect(() => {
    // Listener para eventos customizados de notificação
    const handleCustomNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { title, body, icon } = customEvent.detail;
      showNotification(title, { body, icon });
    };

    window.addEventListener("crm-notification", handleCustomNotification);

    return () => {
      window.removeEventListener("crm-notification", handleCustomNotification);
    };
  }, []);

  function notify(title: string, body?: string, options?: { vibrate?: boolean; sound?: boolean }) {
    // Vibração
    if (options?.vibrate && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // Som (opcional - pode ser adicionado um elemento audio)
    if (options?.sound) {
      try {
        const audio = new Audio("/notification.mp3");
        audio.play().catch(() => {
          /* ignore */
        });
      } catch {
        /* ignore */
      }
    }

    // Notificação visual
    showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "crm-notification",
      requireInteraction: false,
    });
  }

  return { notify };
}
