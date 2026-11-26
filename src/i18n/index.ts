import { useStore } from '../state/store';
import type { Language } from '../lib/settings';
import { ar } from './ar';
import { en, type Messages } from './en';

export type { Messages };

export const MESSAGES: Record<Language, Messages> = { en, ar };

export function useT(): Messages {
  return MESSAGES[useStore((s) => s.settings.language)];
}

export function useLang(): Language {
  return useStore((s) => s.settings.language);
}
