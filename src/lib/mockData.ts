import { Intervention, Product, Worker } from '@/types/intervention';

export const mockWorker: Worker = {
  id: 1,
  login: 'jdupont',
  name: 'Dupont',
  firstName: 'Jean',
  email: 'jean.dupont@mv3pro.ch',
  phone: '+41 79 123 45 67',
};

export const mockProducts: Product[] = [
  { id: 1, ref: 'CAB-2.5', label: 'Câble 2.5mm² (m)', unit: 'm', price: 1.50 },
  { id: 2, ref: 'CAB-4', label: 'Câble 4mm² (m)', unit: 'm', price: 2.20 },
  { id: 3, ref: 'PRISE-T13', label: 'Prise T13', unit: 'pce', price: 12.00 },
  { id: 4, ref: 'PRISE-T23', label: 'Prise T23', unit: 'pce', price: 18.00 },
  { id: 5, ref: 'INT-SIMPLE', label: 'Interrupteur simple', unit: 'pce', price: 15.00 },
  { id: 6, ref: 'INT-DOUBLE', label: 'Interrupteur double', unit: 'pce', price: 22.00 },
  { id: 7, ref: 'DISJ-16A', label: 'Disjoncteur 16A', unit: 'pce', price: 25.00 },
  { id: 8, ref: 'DISJ-32A', label: 'Disjoncteur 32A', unit: 'pce', price: 35.00 },
  { id: 9, ref: 'DIFF-30MA', label: 'Différentiel 30mA', unit: 'pce', price: 85.00 },
  { id: 10, ref: 'SPOT-LED', label: 'Spot LED encastrable', unit: 'pce', price: 28.00 },
];

export const mockInterventions: Intervention[] = [
  {
    id: 1,
    ref: 'INT-2024-001',
    label: 'Installation tableau électrique',
    clientId: 101,
    clientName: 'M. Bernard Martin',
    projectId: 50,
    projectRef: 'PROJ-2024-010',
    location: 'Rue du Lac 15, 1201 Genève',
    type: 'tableau',
    priority: 'normal',
    status: 'en_cours',
    description: 'Installation complète nouveau tableau électrique 3 rangées. Remplacement ancien tableau défaillant. Client demande ajout de différentiels sur chaque circuit.',
    dateCreation: '2024-01-15',
    dateStart: '2024-01-20',
    tasks: [
      { id: 1, label: 'Couper alimentation générale', order: 1, status: 'fait', dateDone: '2024-01-20' },
      { id: 2, label: 'Démonter ancien tableau', order: 2, status: 'fait', dateDone: '2024-01-20' },
      { id: 3, label: 'Installer nouveau coffret', order: 3, status: 'fait', dateDone: '2024-01-20' },
      { id: 4, label: 'Câbler disjoncteurs', order: 4, status: 'a_faire' },
      { id: 5, label: 'Installer différentiels', order: 5, status: 'a_faire' },
      { id: 6, label: 'Test et mise en service', order: 6, status: 'a_faire' },
      { id: 7, label: 'Contrôle OIBT', order: 7, status: 'a_faire' },
    ],
    materials: [
      { id: 1, productId: 7, productName: 'Disjoncteur 16A', qtyUsed: 8, unit: 'pce' },
      { id: 2, productId: 8, productName: 'Disjoncteur 32A', qtyUsed: 2, unit: 'pce' },
    ],
    hours: [
      { id: 1, userId: 1, userName: 'Jean Dupont', dateStart: '2024-01-20T08:00:00', dateEnd: '2024-01-20T12:00:00', durationHours: 4, workType: 'installation' },
    ],
    photos: [],
  },
  {
    id: 2,
    ref: 'INT-2024-002',
    label: 'Dépannage panne électrique',
    clientId: 102,
    clientName: 'Mme Sophie Müller',
    location: 'Avenue de la Gare 8, 1003 Lausanne',
    type: 'depannage',
    priority: 'urgent',
    status: 'a_planifier',
    description: 'Plus de courant dans la cuisine et le salon depuis ce matin. Disjoncteur saute à chaque réenclenchement. Urgence client.',
    dateCreation: '2024-01-21',
    tasks: [
      { id: 8, label: 'Diagnostic panne', order: 1, status: 'a_faire' },
      { id: 9, label: 'Localiser le défaut', order: 2, status: 'a_faire' },
      { id: 10, label: 'Réparation', order: 3, status: 'a_faire' },
      { id: 11, label: 'Test et validation', order: 4, status: 'a_faire' },
    ],
    materials: [],
    hours: [],
    photos: [],
  },
  {
    id: 3,
    ref: 'INT-2024-003',
    label: 'Rénovation cuisine complète',
    clientId: 103,
    clientName: 'Restaurant Le Soleil',
    projectId: 51,
    projectRef: 'PROJ-2024-011',
    location: 'Rue de Carouge 45, 1205 Genève',
    type: 'cuisine',
    priority: 'normal',
    status: 'en_cours',
    description: 'Rénovation électrique complète cuisine professionnelle. Mise aux normes, nouveau circuit triphasé pour four, prises industrielles.',
    dateCreation: '2024-01-10',
    dateStart: '2024-01-18',
    tasks: [
      { id: 12, label: 'Relevé de l\'existant', order: 1, status: 'fait', dateDone: '2024-01-18' },
      { id: 13, label: 'Tirage nouveaux câbles', order: 2, status: 'fait', dateDone: '2024-01-19' },
      { id: 14, label: 'Installation circuit triphasé', order: 3, status: 'a_faire' },
      { id: 15, label: 'Pose prises industrielles', order: 4, status: 'a_faire' },
      { id: 16, label: 'Raccordement équipements', order: 5, status: 'a_faire' },
      { id: 17, label: 'Contrôle et PV', order: 6, status: 'a_faire' },
    ],
    materials: [
      { id: 3, productId: 2, productName: 'Câble 4mm² (m)', qtyUsed: 50, unit: 'm' },
      { id: 4, productId: 4, productName: 'Prise T23', qtyUsed: 6, unit: 'pce' },
    ],
    hours: [
      { id: 2, userId: 1, userName: 'Jean Dupont', dateStart: '2024-01-18T08:00:00', dateEnd: '2024-01-18T17:00:00', durationHours: 8, workType: 'renovation' },
      { id: 3, userId: 1, userName: 'Jean Dupont', dateStart: '2024-01-19T08:00:00', dateEnd: '2024-01-19T16:00:00', durationHours: 7, workType: 'renovation' },
    ],
    photos: [],
  },
];

// Simulate API delay
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
