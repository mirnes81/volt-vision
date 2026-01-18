// Employee permissions management
// Stored locally for Dolibarr mode compatibility

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
  userId: number | string;
  userName: string;
  permissions: Permission[];
  updatedAt: string;
}

const PERMISSIONS_STORAGE_KEY = 'mv3_employee_permissions';

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

// Get all stored permissions
export function getAllEmployeePermissions(): EmployeePermissions[] {
  try {
    const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get permissions for a specific employee
export function getEmployeePermissions(userId: number | string): Permission[] {
  const all = getAllEmployeePermissions();
  const found = all.find(e => String(e.userId) === String(userId));
  return found?.permissions || DEFAULT_EMPLOYEE_PERMISSIONS;
}

// Check if an employee has a specific permission
export function hasPermission(userId: number | string, permission: Permission, isAdmin?: boolean): boolean {
  // Admins have all permissions
  if (isAdmin) return true;
  
  const permissions = getEmployeePermissions(userId);
  return permissions.includes(permission);
}

// Check if an employee has any of the specified permissions
export function hasAnyPermission(userId: number | string, permissions: Permission[], isAdmin?: boolean): boolean {
  if (isAdmin) return true;
  return permissions.some(p => hasPermission(userId, p, false));
}

// Set permissions for an employee
export function setEmployeePermissions(
  userId: number | string,
  userName: string,
  permissions: Permission[]
): void {
  const all = getAllEmployeePermissions();
  const existingIndex = all.findIndex(e => String(e.userId) === String(userId));
  
  const entry: EmployeePermissions = {
    userId,
    userName,
    permissions,
    updatedAt: new Date().toISOString(),
  };
  
  if (existingIndex >= 0) {
    all[existingIndex] = entry;
  } else {
    all.push(entry);
  }
  
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(all));
}

// Remove permissions for an employee (reverts to defaults)
export function removeEmployeePermissions(userId: number | string): void {
  const all = getAllEmployeePermissions();
  const filtered = all.filter(e => String(e.userId) !== String(userId));
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(filtered));
}

// Clear all stored permissions
export function clearAllPermissions(): void {
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
}
