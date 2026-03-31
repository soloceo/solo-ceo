import { useEffect, useRef } from "react";
import { todayDateKey } from "../lib/date-utils";
import { api } from "../lib/api";

/**
 * Check for overdue/due-today items and show browser notifications.
 * Runs once per app session on mount.
 */
export function useDueReminders(lang: string, t?: (key: string) => string) {
  const notified = useRef(false);

  useEffect(() => {
    if (notified.current) return;
    if (!("Notification" in window)) return;

    const check = async () => {
      try {
        const [tasks] = await Promise.all([
          api.get<any[]>("/api/tasks"),
          api.get("/api/clients"), // milestones are embedded in client data
        ]);
        const today = todayDateKey();

        // Find overdue/due-today tasks
        // Compare only the date portion (first 10 chars) so tasks with time like "2026-03-31T14:00" still match
        const dueTasks = (Array.isArray(tasks) ? tasks : []).filter((t: Record<string, unknown>) =>
          t.due && (t.due as string).slice(0, 10) <= today && t.column !== "done" && !t.soft_deleted
        );

        const total = dueTasks.length;
        if (total === 0) return;

        notified.current = true;
        const title = t ? t("app.reminder.title") : (lang === "zh" ? "一人CEO · 提醒" : "Solo CEO · Reminder");
        const body = t
          ? t("app.reminder.tasksDue").replace("{n}", String(dueTasks.length))
          : `${dueTasks.length} task(s) due or overdue`;

        if (Notification.permission === "granted") {
          new Notification(title, { body, icon: "./icon-192.png", tag: "due-reminder" });
        } else if (Notification.permission !== "denied") {
          const p = await Notification.requestPermission();
          if (p === "granted") new Notification(title, { body, icon: "./icon-192.png", tag: "due-reminder" });
        }
      } catch { /* silent */ }
    };

    // Delay check to let app settle
    const timer = setTimeout(check, 5000);
    return () => clearTimeout(timer);
  }, [lang]);
}
