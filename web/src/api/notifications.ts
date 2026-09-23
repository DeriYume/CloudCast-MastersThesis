import { BASE, authHeaders, req } from "./http";
import { hydrateFile, hydrateFolder } from "./crypto-glue";
import type { FileItem, FolderItem } from "./types";

export interface NotificationItem {
  id: string;
  type: string;
  file_id: string | null;
  folder_id: string | null;
  created_at: string;
}

export function openNotificationStream(
  token: string,
  onEvent: (event: string) => void,
  onClose?: () => void,
  onOpen?: () => void
): () => void {
  const controller = new AbortController();
  let aborted = false;
  (async () => {
    try {
      const res = await fetch(`${BASE}/files/notifications/stream`, {
        headers: authHeaders(token),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      if (!aborted) onOpen?.();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const evt = buf.slice(0, i);
          buf = buf.slice(i + 2);

          if (/(^|\n)data:/.test(evt)) {
            const m = /(?:^|\n)event:\s*(\S+)/.exec(evt);
            onEvent(m ? m[1] : "message");
          }
        }
      }
    } catch {

    }
    if (!aborted) onClose?.();
  })();
  return () => { aborted = true; controller.abort(); };
}

export async function listNotifications(
  token: string
): Promise<{ notifications: NotificationItem[]; unread: number }> {
  return req("GET", "/files/notifications", token);
}

export async function deleteNotification(
  token: string,
  id: string
): Promise<{ deleted: boolean }> {
  return req("DELETE", `/files/notifications/${id}`, token);
}

export async function clearNotifications(
  token: string
): Promise<{ deleted: boolean }> {
  return req("DELETE", "/files/notifications", token);
}

export async function listExpiring(
  token: string
): Promise<{ files: FileItem[]; folders: FolderItem[] }> {
  const r = await req<{ files?: FileItem[]; folders?: FolderItem[] }>("GET", "/files/expiring", token);

  return {
    files: (r.files ?? []).map(hydrateFile),
    folders: (r.folders ?? []).map(hydrateFolder),
  };
}
