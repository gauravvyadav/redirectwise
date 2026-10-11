// Internationalization utility supporting all 18 languages and in-extension selection

import { useEffect, useState } from 'react';
import { getSettings } from './storage';

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  dir?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt_BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'zh_CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
];

let currentLanguage = 'system';
let loadedMessages: Record<string, { message: string }> = {};
let listeners: Array<() => void> = [];
let isInitialized = false;

export async function setI18nLanguage(lang: string): Promise<void> {
  currentLanguage = lang || 'system';
  if (currentLanguage === 'system') {
    loadedMessages = {};
  } else {
    try {
      const url = chrome.runtime.getURL(`_locales/${currentLanguage}/messages.json`);
      const res = await fetch(url);
      if (res.ok) {
        loadedMessages = await res.json();
      } else {
        loadedMessages = {};
      }
    } catch (err) {
      console.warn('[RedirectWise i18n] Failed to load messages for', currentLanguage, err);
      loadedMessages = {};
    }
  }

  // Update document dir for RTL languages like Arabic
  const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage);
  if (targetLang?.dir === 'rtl') {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.removeAttribute('dir');
  }

  listeners.forEach(fn => {
    try {
      fn();
    } catch (err) {
      console.error('[RedirectWise i18n] Error in subscriber:', err);
    }
  });
}

export async function initI18n(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  try {
    const settings = await getSettings();
    if (settings.language && settings.language !== 'system') {
      await setI18nLanguage(settings.language);
    }
  } catch (err) {
    console.warn('[RedirectWise i18n] Error initializing language settings:', err);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['redirectwise_settings']) {
        const newSettings = changes['redirectwise_settings'].newValue;
        if (newSettings && newSettings.language !== currentLanguage) {
          setI18nLanguage(newSettings.language || 'system');
        }
      }
    });
  } catch {}
}

export function subscribeI18n(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function getCurrentLanguage(): string {
  return currentLanguage;
}

export function getMessage(key: string, substitutions?: string | string[]): string {
  // If user selected an explicit language, try that catalog first
  if (currentLanguage !== 'system' && loadedMessages[key]?.message) {
    let msg = loadedMessages[key].message;
    if (substitutions) {
      const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
      subs.forEach((sub, idx) => {
        msg = msg.replace(new RegExp(`\\$${idx + 1}`, 'g'), sub);
      });
    }
    return msg;
  }

  // Use Chrome extension native API (browser UI language)
  try {
    const nativeMsg = chrome.i18n?.getMessage(key, substitutions as any);
    if (nativeMsg) return nativeMsg;
  } catch {}

  return key;
}

export const t = getMessage;

// React hook for views that re-render upon language change
export function useI18n() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeI18n(() => {
      setTick(n => n + 1);
    });
    initI18n();
    return unsub;
  }, []);

  return {
    t: getMessage,
    getMessage,
    currentLanguage,
    setLanguage: setI18nLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
