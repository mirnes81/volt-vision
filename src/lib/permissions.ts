// Employee permissions management
// Stored in Supabase for security and multi-device sync

import { supabase } from '@/integrations/supabase/client';

export type Permission = 
  | 'hours.view_own'           // Voir ses propres heures
  | 'hours.add_own'            // Ajouter ses propres heures
  | 'hours.modify_own_limit'   // Modifier sa propre limite hebdomadaire
  | 'hours.validate'           // Valider les heures des autres
  | 'hours.view_all'           // Voir toutes les heures
  | 'hours.export'             // Exporter les heures
  | 'hours.alerts'             // Voir les alertes heures
  | 'settings.hours';          // Accès paramètres heures globaux

export interface EmployeePermissions {
  userId: string;
  userName: string;
  permissions: Permission[];
  updatedAt?: string;
}

const DOLIBARR_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Default permissions for regular employees
export const DEFAULT_EMPLOYEE_PERMISSIONS: Permission[] = [
  'hours.view_own',
  'hours.add_own',
];

// All permissions for admins
export const ADMIN_PERMISSIONS: Permission[] = [
  'hours.view_own',
  'hours.add_own',
  'hours.modify_own_limit',
  'hours.validate',
  'hours.view_all',
  'hours.export',
  'hours.alerts',
  'settings.hours',
];

// Human-readable permission labels
export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  'hours.view_own': {
    label: 'Voir ses heures',
    description: 'Peut voir ses propres entrées de temps',
  },
  'hours.add_own': {
    label: 'Saisir ses heures',
    description: 'Peut ajouter des entrées de temps pour lui-même',
  },
  'hours.modify_own_limit': {
    label: 'Modifier sa limite',
    description: 'Peut modifier sa propre limite hebdomadaire',
  },
  'hours.validate': {
    label: 'Valider les heures',
    description: 'Peut approuver ou rejeter les heures des autres employés',
  },
  'hours.view_all': {
    label: 'Voir toutes les heures',
    description: 'Peut voir les heures de tous les employés',
  },
  'hours.export': {
    label: 'Exporter les heures',
    description: 'Peut exporter les données de temps en fichier',
  },
  'hours.alerts': {
    label: 'Alertes dépassement',
    description: 'Peut voir et gérer les alertes de dépassement d\'heures',
  },
  'settings.hours': {
    label: 'Paramètres heures',
    description: 'Accès aux paramètres globaux des heures dans la configuration',
  },
};

// Cache for permissions to avoid repeated DB calls
let permissionsCache: Map<string, { permissions: Permission[]; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId: string | number): string {
  return String(userId);
}

// Get permissions for a specific employee from database
export async function getEmployeePermissionsAsync(userId: number | string): Promise<Permission[]> {
  const cacheKey = getCacheKey(userId);
  const cached = permissionsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.permissions;
  }

  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('tenant_id', DOLIBARR_TENANT_ID)
      .eq('user_id', String(userId));

    if (error) {
      console.error('Error fetching permissions:', error);
      return DEFAULT_EMPLOYEE_PERMISSIONS;
    }

    const permissions = data && data.length > 0 
      ? (data.map(d => d.permission as Permission))
      : DEFAULT_EMPLOYEE_PERMISSIONS;
    
    permissionsCache.set(cacheKey, { permissions, timestamp: Date.now() });
    return permissions;
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return DEFAULT_EMPLOYEE_PERMISSIONS;
  }
}

// Synchronous version for compatibility (uses cache, returns defaults if not cached)
export function getEmployeePermissions(userId: number | string): Permission[] {
  const cacheKey = getCacheKey(userId);
  const cached = permissionsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.permissions;
  }
  
  // Trigger async fetch for next time
  getEmployeePermissionsAsync(userId);
  return DEFAULT_EMPLOYEE_PERMISSIONS;
}

// Check if an employee has a specific permission
export async function hasPermissionAsync(
  userId: number | string, 
  permission: Permission, 
  isAdmin?: boolean
): Promise<boolean> {
  if (isAdmin) return true;
  
  const permissions = await getEmployeePermissionsAsync(userId);
  return permissions.includes(permission);
}

// Sync version for compatibility
export function hasPermission(userId: number | string, permission: Permission, isAdmin?: boolean): boolean {
  if (isAdmin) return true;
  
  const permissions = getEmployeePermissions(userId);
  return permissions.includes(permission);
}

// Check if an employee has any of the specified permissions
export async function hasAnyPermissionAsync(
  userId: number | string, 
  permissions: Permission[], 
  isAdmin?: boolean
): Promise<boolean> {
  if (isAdmin) return true;
  
  const userPermissions = await getEmployeePermissionsAsync(userId);
  return permissions.some(p => userPermissions.includes(p));
}

// Sync version
export function hasAnyPermission(userId: number | string, permissions: Permission[], isAdmin?: boolean): boolean {
  if (isAdmin) return true;
  return permissions.some(p => hasPermission(userId, p, false));
}

// Set permissions for an employee (saves to database)
export async function setEmployeePermissionsAsync(
  userId: number | string,
  userName: string,
  permissions: Permission[]
): Promise<void> {
  const userIdStr = String(userId);
  
  // First, delete existing permissions for this user
  const { error: deleteError } = await supabase
    .from('user_permissions')
    .delete()
    .eq('tenant_id', DOLIBARR_TENANT_ID)
    .eq('user_id', userIdStr);

  if (deleteError) {
    console.error('Error deleting permissions:', deleteError);
    throw deleteError;
  }

  // Then insert new permissions
  if (permissions.length > 0) {
    const permissionRows = permissions.map(permission => ({
      tenant_id: DOLIBARR_TENANT_ID,
      user_id: userIdStr,
      user_name: userName,
      permission,
    }));

    const { error: insertError } = await supabase
      .from('user_permissions')
      .insert(permissionRows);

    if (insertError) {
      console.error('Error inserting permissions:', insertError);
      throw insertError;
    }
  }

  // Update cache
  permissionsCache.set(getCacheKey(userId), { permissions, timestamp: Date.now() });
}

// Sync version for backwards compatibility (calls async version)
export function setEmployeePermissions(
  userId: number | string,
  userName: string,
  permissions: Permission[]
): void {
  // Fire and forget - for backwards compatibility
  setEmployeePermissionsAsync(userId, userName, permissions).catch(console.error);
}

// Get all employee permissions from database
export async function getAllEmployeePermissionsAsync(): Promise<EmployeePermissions[]> {
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('user_id, user_name, permission, created_at')
      .eq('tenant_id', DOLIBARR_TENANT_ID)
      .order('user_name');

    if (error) {
      console.error('Error fetching all permissions:', error);
      return [];
    }

    // Group by user
    const userMap = new Map<string, EmployeePermissions>();
    
    for (const row of data || []) {
      const existing = userMap.get(row.user_id);
      if (existing) {
        existing.permissions.push(row.permission as Permission);
      } else {
        userMap.set(row.user_id, {
          userId: row.user_id,
          userName: row.user_name,
          permissions: [row.permission as Permission],
          updatedAt: row.created_at,
        });
      }
    }

    return Array.from(userMap.values());
  } catch (error) {
    console.error('Error fetching all permissions:', error);
    return [];
  }
}

// Sync version (returns empty, use async)
export function getAllEmployeePermissions(): EmployeePermissions[] {
  console.warn('getAllEmployeePermissions is deprecated, use getAllEmployeePermissionsAsync');
  return [];
}

// Clear cache
export function clearPermissionsCache(): void {
  permissionsCache.clear();
}

// Preload permissions for a user
export async function preloadPermissions(userId: number | string): Promise<void> {
  await getEmployeePermissionsAsync(userId);
}
