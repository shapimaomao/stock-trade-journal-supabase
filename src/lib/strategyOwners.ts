import { TradeRecord } from '../types';

export const DEFAULT_STRATEGY_OWNERS = ['自己', 'E大', 'E大S', 'E大500'];

const STORAGE_KEY = 'custom_strategy_owners';

/**
 * Get custom strategy owners from localStorage
 */
export function getStoredCustomOwners(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(s => String(s).trim()).filter(Boolean);
    }
  } catch (e) {
    console.error('Failed to parse custom_strategy_owners from localStorage:', e);
  }
  return [];
}

/**
 * Save a new custom strategy owner
 */
export function saveCustomStrategyOwner(newOwner: string): string[] {
  const clean = newOwner.trim();
  if (!clean) return getStoredCustomOwners();

  const current = getStoredCustomOwners();
  if (!current.includes(clean) && !DEFAULT_STRATEGY_OWNERS.includes(clean)) {
    const updated = [...current, clean];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save custom_strategy_owners:', e);
    }
    return updated;
  }
  return current;
}

/**
 * Delete a custom strategy owner from localStorage presets
 */
export function removeCustomStrategyOwner(ownerToDelete: string): string[] {
  const current = getStoredCustomOwners();
  const updated = current.filter(o => o !== ownerToDelete);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to update custom_strategy_owners:', e);
  }
  return updated;
}

/**
 * Get all available strategy owner options combining defaults, localStorage, and existing trades data
 */
export function getAllStrategyOwners(trades: TradeRecord[] = []): string[] {
  const stored = getStoredCustomOwners();
  const tradeOwners = trades
    .map(t => formatStrategyOwner(t.strategyType))
    .filter(Boolean);

  const combined = Array.from(new Set([...DEFAULT_STRATEGY_OWNERS, ...stored, ...tradeOwners]));
  return combined;
}

/**
 * Formats strategy owner for display
 */
export function formatStrategyOwner(owner?: string): string {
  if (!owner) return '自己';
  if (owner === 'self') return '自己';
  if (owner === 'other') return '别人的策略';
  return owner;
}

/**
 * Returns color badge styling classes for strategy owner tag
 */
export function getStrategyOwnerBadgeStyle(owner?: string): string {
  const formatted = formatStrategyOwner(owner);

  switch (formatted) {
    case '自己':
      return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
    case 'E大':
      return 'bg-sky-500/15 text-sky-300 border border-sky-500/30';
    case 'E大S':
      return 'bg-purple-500/15 text-purple-300 border border-purple-500/30';
    case 'E大500':
      return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
    default:
      return 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30';
  }
}
