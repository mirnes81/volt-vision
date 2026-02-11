// Employee permissions management
// Stored in Supabase for security and multi-device sync

import { supabase } from '@/integrations/supabase/client';

const LEGACY_PERMISSIONS_KEY = 'mv3_employee_permissions';
const MIGRATION_DONE_KEY = 'mv3_permissions_migrated_to_db';
const DOLIBARR_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export type Permission = 
  | 'hours.view_own'           // Voir ses propres heures
  | 'hours.add_own'            // Ajouter ses propres heures
  | 'hours.modify_own_limit'   // Modifier sa propre limite hebdomadaire
  | 'hours.validate'           // Valider les heures des autres
  | 'hours.view_all'           // Voir toutes les heures
  | 'hours.export'             // Exporter les heures
  | 'hours.alerts'             // Voir les alertes heures
  | 'settings.hours'           // Accès paramètres heures globaux
  | 'interventions.view_assigned' // Voir ses interventions assignées
  | 'interventions.view_all'     // Voir toutes les interventions
  | 'interventions.create'       // Créer des interventions
  | 'interventions.edit'         // Modifier des interventions
  | 'emergencies.create'         // Créer des urgences
  | 'emergencies.claim'          // Prendre en charge une urgence
  | 'planning.view'              // Voir le planning
  | 'reports.generate';          // Générer des rapports PDF

export interface EmployeePermissions {
  userId: string;
  userName: string;
  permissions: Permission[];
  updatedAt?: string;
}

// Duplicate removed - DOLIBARR_TENANT_ID is defined above

// Default permissions for regular employees
export const DEFAULT_EMPLOYEE_PERMISSIONS: Permission[] = [
  'hours.view_own',
  'hours.add_own',
  'interventions.view_assigned',
  'planning.view',
  'emergencies.claim',
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
  'interventions.view_assigned',
  'interventions.view_all',
  'interventions.create',
  'interventions.edit',
  'emergencies.create',
  'emergencies.claim',
  'planning.view',
  'reports.generate',
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
  'interventions.view_assigned': {
    label: 'Voir ses interventions',
    description: 'Peut voir les interventions qui lui sont assignées',
  },
  'interventions.view_all': {
    label: 'Voir toutes les interventions',
    description: 'Peut voir toutes les interventions de l\'entreprise',
  },
  'interventions.create': {
    label: 'Créer des interventions',
    description: 'Peut créer de nouvelles interventions',
  },
  'interventions.edit': {
    label: 'Modifier des interventions',
    description: 'Peut modifier les détails des interventions existantes',
  },
  'emergencies.create': {
    label: 'Créer des urgences',
    description: 'Peut créer des interventions d\'urgence avec bonus',
  },
  'emergencies.claim': {
    label: 'Prendre une urgence',
    description: 'Peut prendre en charge une intervention d\'urgence',
  },
  'planning.view': {
    label: 'Voir le planning',
    description: 'Peut accéder au calendrier et au planning des interventions',
  },
  'reports.generate': {
    label: 'Générer des rapports',
    description: 'Peut générer et télécharger des rapports PDF',
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

// ============ MIGRATION FROM LOCALSTORAGE ============

interface LegacyPermissionEntry {
  userId: number | string;
  userName: string;
  permissions: Permission[];
  updatedAt: string;
}

// Check if migration has already been done
export function isMigrationDone(): boolean {
  return localStorage.getItem(MIGRATION_DONE_KEY) === 'true';
}

// Get legacy permissions from localStorage
export function getLegacyPermissions(): LegacyPermissionEntry[] {
  try {
    const stored = localStorage.getItem(LEGACY_PERMISSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Check if there are permissions to migrate
export function hasLegacyPermissions(): boolean {
  const legacy = getLegacyPermissions();
  return legacy.length > 0 && !isMigrationDone();
}

// Migrate permissions from localStorage to database
export async function migratePermissionsToDatabase(): Promise<{
  success: boolean;
  migrated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let migrated = 0;

  try {
    const legacyPermissions = getLegacyPermissions();
    
    if (legacyPermissions.length === 0) {
      localStorage.setItem(MIGRATION_DONE_KEY, 'true');
      return { success: true, migrated: 0, errors: [] };
    }

    console.log(`Migrating ${legacyPermissions.length} employee permissions to database...`);

    for (const entry of legacyPermissions) {
      try {
        // Skip if no permissions
        if (!entry.permissions || entry.permissions.length === 0) {
          continue;
        }

        // Check if this user already has permissions in database
        const { data: existing } = await supabase
          .from('user_permissions')
          .select('id')
          .eq('tenant_id', DOLIBARR_TENANT_ID)
          .eq('user_id', String(entry.userId))
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`User ${entry.userId} already has permissions in DB, skipping`);
          continue;
        }

        // Insert permissions
        const permissionRows = entry.permissions.map(permission => ({
          tenant_id: DOLIBARR_TENANT_ID,
          user_id: String(entry.userId),
          user_name: entry.userName,
          permission,
        }));

        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionRows);

        if (error) {
          errors.push(`User ${entry.userName}: ${error.message}`);
        } else {
          migrated++;
          console.log(`Migrated permissions for ${entry.userName}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`User ${entry.userName}: ${message}`);
      }
    }

    // Mark migration as done even if some errors occurred
    localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    
    // Optionally clear legacy storage after successful migration
    if (errors.length === 0 && migrated > 0) {
      localStorage.removeItem(LEGACY_PERMISSIONS_KEY);
    }

    return { success: errors.length === 0, migrated, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, migrated, errors: [message] };
  }
}

// Reset migration flag (for debugging/re-migration)
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_DONE_KEY);
}
