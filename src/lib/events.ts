// Typed wrappers over Tauri's event system (`listen`). Each helper returns the
// unlisten function from Tauri.

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SamTokenPayload {
  text: string;
}
export interface SamDonePayload {
  text: string;
}
export interface SamActionPayload {
  tool: string;
}
export interface SamTranscriptPayload {
  text: string;
}
export interface WaQrPayload {
  data: string;
}
export interface WaStatusPayload {
  status: string;
}
export interface WaActivityPayload {
  from: string;
  text: string;
}

export const onSamToken = (cb: (p: SamTokenPayload) => void): Promise<UnlistenFn> =>
  listen<SamTokenPayload>("sam:token", (e) => cb(e.payload));

export const onSamDone = (cb: (p: SamDonePayload) => void): Promise<UnlistenFn> =>
  listen<SamDonePayload>("sam:done", (e) => cb(e.payload));

export const onSamAction = (cb: (p: SamActionPayload) => void): Promise<UnlistenFn> =>
  listen<SamActionPayload>("sam:action", (e) => cb(e.payload));

export const onSamTranscript = (
  cb: (p: SamTranscriptPayload) => void,
): Promise<UnlistenFn> =>
  listen<SamTranscriptPayload>("sam:transcript", (e) => cb(e.payload));

export const onSamRefresh = (
  cb: (listId: string | null) => void,
): Promise<UnlistenFn> =>
  listen<{ list_id: string | null }>("sam:refresh", (e) =>
    cb(e.payload?.list_id ?? null),
  );

export const onWaQr = (cb: (p: WaQrPayload) => void): Promise<UnlistenFn> =>
  listen<WaQrPayload>("wa:qr", (e) => cb(e.payload));

export const onWaStatus = (cb: (p: WaStatusPayload) => void): Promise<UnlistenFn> =>
  listen<WaStatusPayload>("wa:status", (e) => cb(e.payload));

export const onWaActivity = (
  cb: (p: WaActivityPayload) => void,
): Promise<UnlistenFn> =>
  listen<WaActivityPayload>("wa:activity", (e) => cb(e.payload));

export const onDataChanged = (cb: () => void): Promise<UnlistenFn> =>
  listen("data:changed", () => cb());

export const onNavSettings = (cb: () => void): Promise<UnlistenFn> =>
  listen("nav:settings", () => cb());

export const onNavList = (cb: (id: string) => void): Promise<UnlistenFn> =>
  listen<{ id: string }>("nav:list", (e) => cb(e.payload.id));

export const onVoiceStart = (cb: () => void): Promise<UnlistenFn> =>
  listen("voice:start", () => cb());

export const onVoiceStop = (cb: () => void): Promise<UnlistenFn> =>
  listen("voice:stop", () => cb());
