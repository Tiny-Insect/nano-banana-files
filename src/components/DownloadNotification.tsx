import { useState, useEffect, useCallback } from "react";
import { Download, CheckCircle } from "lucide-react";

interface Notification {
  id: number;
  message: string;
}

let showNotification: (message: string) => void = () => {};

export function useDownloadNotification() {
  return { showDownloadNotification: showNotification };
}

/** Call this from anywhere (non-hook) */
export function triggerDownloadNotification(message: string) {
  showNotification(message);
}

export default function DownloadNotificationHost() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 2500);
  }, []);

  useEffect(() => {
    showNotification = addNotification;
    return () => { showNotification = () => {}; };
  }, [addNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-[18%] left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 border-emerald-500/60 bg-card/95 backdrop-blur-lg shadow-lg shadow-emerald-500/10 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-auto"
        >
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium text-foreground">{n.message}</span>
        </div>
      ))}
    </div>
  );
}
