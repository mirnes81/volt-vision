export type InterventionType = 
  | 'installation' 
  | 'depannage' 
  | 'renovation' 
  | 'tableau' 
  | 'cuisine'
  | 'oibt';

export type InterventionStatus = 
  | 'a_planifier' 
  | 'en_cours' 
  | 'termine' 
  | 'facture';

export type Priority = 'normal' | 'urgent' | 'critical';

export interface Task {
  id: number;
  label: string;
  order: number;
  status: 'a_faire' | 'fait';
  dateDone?: string;
  comment?: string;
}

export interface Material {
  id: number;
  productId: number;
  productRef?: string;
  productName: string;
  qtyUsed: number;
  unit: string;
  comment?: string;
  photoPath?: string;
  photo?: string | null;
  price?: number;
}

export interface WorkerHour {
  id: number;
  userId: number;
  userName: string;
  dateStart: string;
  dateEnd?: string;
  durationHours?: number;
  workType: string;
  comment?: string;
}

export interface Photo {
  id: number;
  type: 'avant' | 'pendant' | 'apres' | 'oibt' | 'defaut';
  filePath: string;
  datePhoto: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Intervention {
  id: number;
  ref: string;
  label: string;
  clientId: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  clientRef?: string;
  clientContactName?: string;
  clientIntercom?: string;
  clientAccessCode?: string;
  clientNotes?: string;
  clientExtrafields?: Record<string, any>;
  // Intervention extrafields
  extraBon?: string;           // N° de Bon (options_bongerance)
  extraAdresse?: string;       // Adresse intervention (options_adresse)
  extraContact?: string;       // Contact/Employé (options_employe)
  extraCle?: string;           // Clé (options_cle)
  extraCode?: string;          // Code (options_code)
  extraNoImm?: string;         // N° immeuble (options_noimm)
  extraAdresseComplete?: string; // Adresse complète
  extraNCompt?: string;        // N° compteur (options_ncompt)
  extraPropImm?: string;       // Propriétaire immeuble (options_propimm)
  extraConcierge?: string;     // Concierge (options_concierge)
  extraAppartement?: string;   // Appartement (options_appartement)
  interventionExtrafields?: Record<string, any>;
  projectId?: number;
  projectRef?: string;
  linkedProposalRef?: string;
  linkedOrderRef?: string;
  location: string;
  coordinates?: Coordinates;
  type: InterventionType;
  priority: Priority;
  status: InterventionStatus;
  description: string;
  briefing?: string;
  assignedTo?: {
    id: number;
    name: string;
    firstName: string;
  };
  aiSummary?: string;
  aiClientText?: string;
  aiDiagnostic?: string;
  dateCreation: string;
  dateStart?: string;
  dateEnd?: string;
  datePlanned?: string;
  tasks: Task[];
  materials: Material[];
  hours: WorkerHour[];
  photos: Photo[];
  documents?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  signaturePath?: string;
}

export interface Worker {
  id: number;
  login: string;
  name: string;
  firstName: string;
  email: string;
  phone?: string;
  isAdmin?: boolean;
  admin?: string;
}

export interface Product {
  id: number;
  ref: string;
  label: string;
  unit: string;
  price?: number;
  photo?: string | null;
  photoFile?: string | null;
  barcode?: string;
}
