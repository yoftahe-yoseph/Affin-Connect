import type { PushPermissionState } from '../types';

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const perm = window.Notification.permission;
  if (perm === 'granted' || perm === 'denied') return perm;
  return 'default';
}

export async function requestBrowserPushPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (window.Notification.permission === 'granted') {
    return 'granted';
  }
  if (window.Notification.permission === 'denied') {
    return 'denied';
  }
  try {
    const result = await window.Notification.requestPermission();
    if (result === 'granted' || result === 'denied') return result;
    return 'default';
  } catch {
    return getPushPermissionState();
  }
}

export async function dispatchBrowserPushNotification(params: {
  title: string;
  body: string;
  tag: string;
  icon?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(params.title, {
        body: params.body,
        tag: params.tag,
        icon: params.icon,
      });
      return true;
    }
  } catch {
    // Fall back to direct Notification constructor below
  }

  try {
    new window.Notification(params.title, {
      body: params.body,
      tag: params.tag,
      icon: params.icon,
    });
    return true;
  } catch {
    return false;
  }
}
