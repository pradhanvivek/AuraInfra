export type ModuleFlags = { community: boolean; assets: boolean };
export const disabledFlags: ModuleFlags = { community: false, assets: false };
export function parseModuleFlags(value: unknown): ModuleFlags {
  if (!value || typeof value !== 'object') throw new Error('Invalid app configuration');
  const flags = value as Record<string, unknown>;
  if (typeof flags.community !== 'boolean' || typeof flags.assets !== 'boolean') {
    throw new Error('Invalid module flags');
  }
  return { community: flags.community, assets: flags.assets };
}
export function enabledHome(flags: ModuleFlags): '/(tabs)' | '/(tabs)/assets' | null {
  return flags.community ? '/(tabs)' : flags.assets ? '/(tabs)/assets' : null;
}
// Account/profile/notifications remain available even when both modules are off.
export function routeModule(segments: readonly string[]): keyof ModuleFlags | null {
  const root = segments[0];
  if (root === '(tabs)') {
    if (!segments[1] || segments[1] === 'index' || segments[1] === 'admin') return 'community';
    if (segments[1] === 'assets' || segments[1] === 'dashboard') return 'assets';
    return null;
  }
  if (['admin', 'admin-stats', 'community', 'community-membership', 'visitors', 'complaints',
    'amenities', 'meetings', 'dues', 'hoa-maintenance', 'hoa-meetings', 'hoa-documents', 'sops', 'services'].includes(root)) return 'community';
  if (root && (['property-tools', 'properties', 'property', 'vehicles', 'vehicle', 'appliances', 'appliance', 'jewelry',
    'jewelry-item', 'furniture', 'art', 'portfolio', 'scan-asset', 'maintenance', 'near-me', 'my-builder'].includes(root)
    || root.startsWith('property-'))) return 'assets';
  return null;
}
