import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';

function getLocale(): string {
  return i18n.locale || 'es';
}

/**
 * Format a date according to the active locale
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(getLocale(), options).format(d);
}

/**
 * Format a time according to the active locale
 */
export function formatTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { timeStyle: 'short' }
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(getLocale(), options).format(d);
}

/**
 * Format full date and time according to the active locale
 */
export function formatDateTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(getLocale(), options).format(d);
}

/**
 * Format relative time (e.g. "hace 5 minutos" / "5 minutes ago")
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date = new Date()
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const diffInSeconds = Math.round((d.getTime() - baseDate.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });

  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) {
    return rtf.format(diffInSeconds, 'second');
  }
  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return rtf.format(diffInMinutes, 'minute');
  }
  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return rtf.format(diffInHours, 'hour');
  }
  const diffInDays = Math.round(diffInHours / 24);
  if (Math.abs(diffInDays) < 30) {
    return rtf.format(diffInDays, 'day');
  }
  const diffInMonths = Math.round(diffInDays / 30);
  if (Math.abs(diffInMonths) < 12) {
    return rtf.format(diffInMonths, 'month');
  }
  const diffInYears = Math.round(diffInDays / 365);
  return rtf.format(diffInYears, 'year');
}

/**
 * Format number according to the active locale
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(getLocale(), options).format(value);
}

/**
 * Format currency according to the active locale
 */
export function formatCurrency(
  value: number,
  currency: string = 'EUR',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

/**
 * Format percentage according to the active locale
 */
export function formatPercent(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'percent',
    ...options,
  }).format(value);
}

/**
 * Format list of strings according to the active locale
 */
export function formatList(
  items: string[],
  type: 'conjunction' | 'disjunction' = 'conjunction'
): string {
  if (typeof Intl.ListFormat !== 'undefined') {
    return new Intl.ListFormat(getLocale(), { style: 'long', type }).format(items);
  }
  return items.join(', ');
}

/**
 * ICU Plural helper for task counts
 */
export function formatTaskCount(count: number): string {
  return i18n._(msg`{count, plural, one {# tarea} other {# tareas}}`, { count });
}

/**
 * ICU Plural helper for section counts
 */
export function formatSectionCount(count: number): string {
  return i18n._(msg`{count, plural, one {# sección} other {# secciones}}`, { count });
}

/**
 * ICU Plural helper for workspace counts
 */
export function formatWorkspaceCount(count: number): string {
  return i18n._(msg`{count, plural, one {# workspace} other {# workspaces}}`, { count });
}
