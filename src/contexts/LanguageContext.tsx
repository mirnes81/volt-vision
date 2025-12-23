import * as React from 'react';

type Language = 'fr' | 'de' | 'it';

interface Translations {
  [key: string]: {
    fr: string;
    de: string;
    it: string;
  };
}

const translations: Translations = {
  // Navigation
  'nav.home': { fr: 'Accueil', de: 'Startseite', it: 'Home' },
  'nav.interventions': { fr: 'Travaux', de: 'Arbeiten', it: 'Lavori' },
  'nav.calendar': { fr: 'Calendrier', de: 'Kalender', it: 'Calendario' },
  'nav.profile': { fr: 'Profil', de: 'Profil', it: 'Profilo' },
  
  // Dashboard
  'dashboard.hello': { fr: 'Bonjour', de: 'Guten Tag', it: 'Buongiorno' },
  'dashboard.today': { fr: 'Aujourd\'hui', de: 'Heute', it: 'Oggi' },
  'dashboard.interventions': { fr: 'Interventions', de: 'Einsätze', it: 'Interventi' },
  'dashboard.urgent': { fr: 'Urgentes', de: 'Dringend', it: 'Urgenti' },
  'dashboard.worked': { fr: 'Travaillées', de: 'Gearbeitet', it: 'Lavorate' },
  'dashboard.myInterventions': { fr: 'Mes interventions', de: 'Meine Einsätze', it: 'I miei interventi' },
  'dashboard.inProgress': { fr: 'en cours', de: 'in Bearbeitung', it: 'in corso' },
  'dashboard.seeAll': { fr: 'Voir tout', de: 'Alle anzeigen', it: 'Vedi tutto' },
  'dashboard.noIntervention': { fr: 'Aucune intervention aujourd\'hui', de: 'Heute keine Einsätze', it: 'Nessun intervento oggi' },
  
  // Interventions
  'intervention.toPlan': { fr: 'À planifier', de: 'Zu planen', it: 'Da pianificare' },
  'intervention.inProgress': { fr: 'En cours', de: 'In Bearbeitung', it: 'In corso' },
  'intervention.completed': { fr: 'Terminé', de: 'Abgeschlossen', it: 'Completato' },
  'intervention.invoiced': { fr: 'Facturé', de: 'Fakturiert', it: 'Fatturato' },
  'intervention.search': { fr: 'Rechercher...', de: 'Suchen...', it: 'Cerca...' },
  'intervention.all': { fr: 'Tous', de: 'Alle', it: 'Tutti' },
  'intervention.notFound': { fr: 'Aucune intervention trouvée', de: 'Kein Einsatz gefunden', it: 'Nessun intervento trovato' },
  
  // Types
  'type.installation': { fr: 'Installation', de: 'Installation', it: 'Installazione' },
  'type.depannage': { fr: 'Dépannage', de: 'Störungsbehebung', it: 'Riparazione' },
  'type.renovation': { fr: 'Rénovation', de: 'Renovation', it: 'Ristrutturazione' },
  'type.tableau': { fr: 'Tableau', de: 'Schaltschrank', it: 'Quadro' },
  'type.cuisine': { fr: 'Cuisine', de: 'Küche', it: 'Cucina' },
  'type.oibt': { fr: 'OIBT', de: 'NIV', it: 'OIBT' },
  
  // Tabs
  'tab.hours': { fr: 'Heures', de: 'Stunden', it: 'Ore' },
  'tab.materials': { fr: 'Matériel', de: 'Material', it: 'Materiale' },
  'tab.tasks': { fr: 'Tâches', de: 'Aufgaben', it: 'Compiti' },
  'tab.photos': { fr: 'Photos', de: 'Fotos', it: 'Foto' },
  'tab.ai': { fr: 'IA', de: 'KI', it: 'IA' },
  'tab.signature': { fr: 'Signature', de: 'Unterschrift', it: 'Firma' },
  'tab.oibt': { fr: 'OIBT', de: 'NIV', it: 'OIBT' },
  'tab.gps': { fr: 'GPS', de: 'GPS', it: 'GPS' },
  'tab.voice': { fr: 'Audio', de: 'Audio', it: 'Audio' },
  'tab.history': { fr: 'Historique', de: 'Verlauf', it: 'Storico' },
  
  // Hours
  'hours.running': { fr: 'En cours depuis', de: 'Läuft seit', it: 'In corso da' },
  'hours.ready': { fr: 'Prêt à commencer', de: 'Bereit zu starten', it: 'Pronto a iniziare' },
  'hours.start': { fr: 'Démarrer le chrono', de: 'Timer starten', it: 'Avvia timer' },
  'hours.stop': { fr: 'Arrêter le chrono', de: 'Timer stoppen', it: 'Ferma timer' },
  'hours.total': { fr: 'Total cumulé', de: 'Gesamtsumme', it: 'Totale cumulato' },
  'hours.history': { fr: 'Historique', de: 'Verlauf', it: 'Storico' },
  'hours.noHours': { fr: 'Aucune heure enregistrée', de: 'Keine Stunden erfasst', it: 'Nessuna ora registrata' },
  
  // Materials
  'materials.add': { fr: 'Ajouter du matériel', de: 'Material hinzufügen', it: 'Aggiungi materiale' },
  'materials.product': { fr: 'Produit', de: 'Produkt', it: 'Prodotto' },
  'materials.selectProduct': { fr: 'Sélectionner un produit', de: 'Produkt auswählen', it: 'Seleziona prodotto' },
  'materials.quantity': { fr: 'Quantité', de: 'Menge', it: 'Quantità' },
  'materials.unit': { fr: 'Unité', de: 'Einheit', it: 'Unità' },
  'materials.comment': { fr: 'Commentaire (optionnel)', de: 'Kommentar (optional)', it: 'Commento (opzionale)' },
  'materials.installed': { fr: 'Matériel posé', de: 'Installiertes Material', it: 'Materiale installato' },
  'materials.noMaterial': { fr: 'Aucun matériel enregistré', de: 'Kein Material erfasst', it: 'Nessun materiale registrato' },
  'materials.scanQr': { fr: 'Scanner QR', de: 'QR scannen', it: 'Scansiona QR' },
  
  // Tasks
  'tasks.progress': { fr: 'Progression', de: 'Fortschritt', it: 'Progresso' },
  'tasks.tasks': { fr: 'tâches', de: 'Aufgaben', it: 'compiti' },
  'tasks.noTask': { fr: 'Aucune tâche définie', de: 'Keine Aufgaben definiert', it: 'Nessun compito definito' },
  'tasks.doneOn': { fr: 'Fait le', de: 'Erledigt am', it: 'Fatto il' },
  
  // Photos
  'photos.take': { fr: 'Prendre une photo', de: 'Foto aufnehmen', it: 'Scatta foto' },
  'photos.before': { fr: 'Avant', de: 'Vorher', it: 'Prima' },
  'photos.during': { fr: 'Pendant', de: 'Während', it: 'Durante' },
  'photos.after': { fr: 'Après', de: 'Nachher', it: 'Dopo' },
  'photos.defect': { fr: 'Défaut', de: 'Defekt', it: 'Difetto' },
  'photos.noPhoto': { fr: 'Aucune photo', de: 'Keine Fotos', it: 'Nessuna foto' },
  
  // AI
  'ai.assistant': { fr: 'Assistant IA', de: 'KI-Assistent', it: 'Assistente IA' },
  'ai.description': { fr: 'L\'IA peut générer automatiquement un résumé de l\'intervention ou proposer un diagnostic pour les dépannages.', de: 'Die KI kann automatisch eine Zusammenfassung des Einsatzes erstellen oder eine Diagnose für Störungsbehebungen vorschlagen.', it: 'L\'IA può generare automaticamente un riepilogo dell\'intervento o proporre una diagnosi per le riparazioni.' },
  'ai.generateSummary': { fr: 'Générer résumé IA', de: 'KI-Zusammenfassung erstellen', it: 'Genera riepilogo IA' },
  'ai.summary': { fr: 'Résumé généré', de: 'Erstellte Zusammenfassung', it: 'Riepilogo generato' },
  'ai.diagnostic': { fr: 'Assistant dépannage IA', de: 'KI-Störungsassistent', it: 'Assistente riparazione IA' },
  'ai.diagnosticResult': { fr: 'Diagnostic suggéré', de: 'Vorgeschlagene Diagnose', it: 'Diagnosi suggerita' },
  
  // Signature
  'signature.client': { fr: 'Signature du client', de: 'Kundenunterschrift', it: 'Firma del cliente' },
  'signature.saved': { fr: 'Signature client enregistrée', de: 'Kundenunterschrift gespeichert', it: 'Firma cliente salvata' },
  'signature.new': { fr: 'Nouvelle signature', de: 'Neue Unterschrift', it: 'Nuova firma' },
  'signature.sign': { fr: 'Signez ici avec votre doigt', de: 'Unterschreiben Sie hier mit dem Finger', it: 'Firma qui con il dito' },
  'signature.clear': { fr: 'Effacer', de: 'Löschen', it: 'Cancella' },
  'signature.save': { fr: 'Enregistrer', de: 'Speichern', it: 'Salva' },
  
  // OIBT
  'oibt.title': { fr: 'Contrôle OIBT', de: 'NIV-Kontrolle', it: 'Controllo OIBT' },
  'oibt.description': { fr: 'Formulaire de contrôle électrique selon OIBT/NIBT', de: 'Elektrische Kontrollformular gemäss NIV', it: 'Modulo di controllo elettrico secondo OIBT' },
  'oibt.isolation': { fr: 'Isolation (MΩ)', de: 'Isolation (MΩ)', it: 'Isolamento (MΩ)' },
  'oibt.continuity': { fr: 'Continuité PE (Ω)', de: 'PE-Durchgang (Ω)', it: 'Continuità PE (Ω)' },
  'oibt.differential': { fr: 'Différentiel 30mA (ms)', de: 'FI 30mA (ms)', it: 'Differenziale 30mA (ms)' },
  'oibt.voltage': { fr: 'Tension (V)', de: 'Spannung (V)', it: 'Tensione (V)' },
  'oibt.result': { fr: 'Résultat global', de: 'Gesamtergebnis', it: 'Risultato globale' },
  'oibt.ok': { fr: 'Conforme', de: 'Konform', it: 'Conforme' },
  'oibt.nok': { fr: 'Non conforme', de: 'Nicht konform', it: 'Non conforme' },
  'oibt.reserve': { fr: 'Avec réserves', de: 'Mit Vorbehalten', it: 'Con riserve' },
  'oibt.comments': { fr: 'Commentaires', de: 'Kommentare', it: 'Commenti' },
  'oibt.generatePdf': { fr: 'Générer PV PDF', de: 'PDF-Protokoll erstellen', it: 'Genera verbale PDF' },
  'oibt.saveMeasures': { fr: 'Enregistrer mesures', de: 'Messungen speichern', it: 'Salva misure' },
  
  // GPS
  'gps.title': { fr: 'Navigation GPS', de: 'GPS-Navigation', it: 'Navigazione GPS' },
  'gps.getLocation': { fr: 'Ma position', de: 'Meine Position', it: 'La mia posizione' },
  'gps.navigate': { fr: 'Naviguer vers le chantier', de: 'Zum Standort navigieren', it: 'Naviga verso il cantiere' },
  'gps.distance': { fr: 'Distance', de: 'Entfernung', it: 'Distanza' },
  'gps.openMaps': { fr: 'Ouvrir dans Maps', de: 'In Maps öffnen', it: 'Apri in Maps' },
  
  // Voice
  'voice.title': { fr: 'Notes vocales', de: 'Sprachnotizen', it: 'Note vocali' },
  'voice.record': { fr: 'Enregistrer', de: 'Aufnehmen', it: 'Registra' },
  'voice.stop': { fr: 'Arrêter', de: 'Stoppen', it: 'Ferma' },
  'voice.play': { fr: 'Écouter', de: 'Abspielen', it: 'Ascolta' },
  'voice.delete': { fr: 'Supprimer', de: 'Löschen', it: 'Elimina' },
  'voice.noNotes': { fr: 'Aucune note vocale', de: 'Keine Sprachnotizen', it: 'Nessuna nota vocale' },
  
  // History
  'history.title': { fr: 'Historique du site', de: 'Standortverlauf', it: 'Storico del sito' },
  'history.previousInterventions': { fr: 'Interventions précédentes à cette adresse', de: 'Frühere Einsätze an dieser Adresse', it: 'Interventi precedenti a questo indirizzo' },
  'history.noHistory': { fr: 'Aucun historique', de: 'Kein Verlauf', it: 'Nessuno storico' },
  
  // Stock
  'stock.title': { fr: 'Stock véhicule', de: 'Fahrzeugbestand', it: 'Stock veicolo' },
  'stock.available': { fr: 'Disponible', de: 'Verfügbar', it: 'Disponibile' },
  'stock.low': { fr: 'Stock bas', de: 'Niedriger Bestand', it: 'Stock basso' },
  'stock.outOfStock': { fr: 'Rupture', de: 'Nicht verfügbar', it: 'Esaurito' },
  
  // Calendar
  'calendar.title': { fr: 'Calendrier', de: 'Kalender', it: 'Calendario' },
  'calendar.week': { fr: 'Semaine', de: 'Woche', it: 'Settimana' },
  'calendar.month': { fr: 'Mois', de: 'Monat', it: 'Mese' },
  'calendar.today': { fr: 'Aujourd\'hui', de: 'Heute', it: 'Oggi' },
  
  // Profile
  'profile.title': { fr: 'Mon profil', de: 'Mein Profil', it: 'Il mio profilo' },
  'profile.email': { fr: 'Email', de: 'E-Mail', it: 'Email' },
  'profile.phone': { fr: 'Téléphone', de: 'Telefon', it: 'Telefono' },
  'profile.security': { fr: 'Sécurité', de: 'Sicherheit', it: 'Sicurezza' },
  'profile.changePassword': { fr: 'Changer mot de passe', de: 'Passwort ändern', it: 'Cambia password' },
  'profile.help': { fr: 'Aide', de: 'Hilfe', it: 'Aiuto' },
  'profile.support': { fr: 'Support et documentation', de: 'Support und Dokumentation', it: 'Supporto e documentazione' },
  'profile.theme': { fr: 'Thème', de: 'Design', it: 'Tema' },
  'profile.language': { fr: 'Langue', de: 'Sprache', it: 'Lingua' },
  'profile.logout': { fr: 'Se déconnecter', de: 'Abmelden', it: 'Disconnetti' },
  'profile.offline': { fr: 'Mode hors-ligne', de: 'Offline-Modus', it: 'Modalità offline' },
  'profile.offlineDesc': { fr: 'Données synchronisées', de: 'Daten synchronisiert', it: 'Dati sincronizzati' },
  
  // Common
  'common.cancel': { fr: 'Annuler', de: 'Abbrechen', it: 'Annulla' },
  'common.confirm': { fr: 'Confirmer', de: 'Bestätigen', it: 'Conferma' },
  'common.save': { fr: 'Enregistrer', de: 'Speichern', it: 'Salva' },
  'common.add': { fr: 'Ajouter', de: 'Hinzufügen', it: 'Aggiungi' },
  'common.delete': { fr: 'Supprimer', de: 'Löschen', it: 'Elimina' },
  'common.edit': { fr: 'Modifier', de: 'Bearbeiten', it: 'Modifica' },
  'common.loading': { fr: 'Chargement...', de: 'Laden...', it: 'Caricamento...' },
  'common.error': { fr: 'Erreur', de: 'Fehler', it: 'Errore' },
  'common.success': { fr: 'Succès', de: 'Erfolg', it: 'Successo' },
  'common.urgent': { fr: 'Urgent', de: 'Dringend', it: 'Urgente' },
  
  // Login
  'login.title': { fr: 'Se connecter', de: 'Anmelden', it: 'Accedi' },
  'login.username': { fr: 'Identifiant', de: 'Benutzername', it: 'Nome utente' },
  'login.password': { fr: 'Mot de passe', de: 'Passwort', it: 'Password' },
  'login.submit': { fr: 'Se connecter', de: 'Anmelden', it: 'Accedi' },
  'login.demo': { fr: 'Demo: identifiant', de: 'Demo: Benutzername', it: 'Demo: nome utente' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = React.useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mv3_language');
      return (saved as Language) || 'fr';
    }
    return 'fr';
  });

  const handleSetLanguage = React.useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('mv3_language', lang);
  }, []);

  const t = React.useCallback((key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }
    return translation[language] || translation.fr || key;
  }, [language]);

  const value = React.useMemo(() => ({ 
    language, 
    setLanguage: handleSetLanguage, 
    t 
  }), [language, handleSetLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
