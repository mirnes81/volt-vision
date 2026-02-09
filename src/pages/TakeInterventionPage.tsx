import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Calendar, AlertTriangle, CheckCircle, User, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import logoEnes from '@/assets/logo-enes.png';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface InterventionInfo {
  intervention_ref: string;
  intervention_label: string;
  client_name: string | null;
  location: string | null;
  priority: string;
  date_planned: string | null;
  intervention_id: number | null;
  already_assigned: boolean;
  assigned_users: string[];
}

export default function TakeInterventionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, worker } = useAuth();
  
  const ref = searchParams.get('ref') || '';
  const label = searchParams.get('label') || '';
  const interventionId = searchParams.get('id') || '';

  const [info, setInfo] = React.useState<InterventionInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [taking, setTaking] = React.useState(false);
  const [taken, setTaken] = React.useState(false);

  // Fetch intervention info
  React.useEffect(() => {
    async function fetchInfo() {
      try {
        const { data, error } = await supabase
          .from('intervention_assignments')
          .select('*')
          .eq('tenant_id', TENANT_ID)
          .eq('intervention_ref', ref);

        if (error) throw error;

        if (data && data.length > 0) {
          const first = data[0];
          const assignedUsers = data.map(d => d.user_name).filter(Boolean);
          const currentUserId = worker?.id ? String(worker.id) : '';
          const alreadyAssigned = data.some(d => d.user_id === String(currentUserId));

          setInfo({
            intervention_ref: first.intervention_ref,
            intervention_label: first.intervention_label,
            client_name: first.client_name,
            location: first.location,
            priority: first.priority || 'normal',
            date_planned: first.date_planned,
            intervention_id: first.intervention_id,
            already_assigned: alreadyAssigned,
            assigned_users: assignedUsers,
          });
        } else {
          // No existing assignments, create from URL params
          setInfo({
            intervention_ref: ref,
            intervention_label: decodeURIComponent(label),
            client_name: null,
            location: null,
            priority: 'normal',
            date_planned: null,
            intervention_id: interventionId ? parseInt(interventionId) : null,
            already_assigned: false,
            assigned_users: [],
          });
        }
      } catch (err) {
        console.error('Error fetching intervention:', err);
      } finally {
        setLoading(false);
      }
    }

    if (ref) fetchInfo();
    else setLoading(false);
  }, [ref, label, interventionId, worker]);

  const handleTake = async () => {
    if (!worker || !info) return;

    setTaking(true);
    try {
      const userName = `${worker.firstName} ${worker.name}`.trim() || worker.login || 'Technicien';
      const userId = String(worker.id);

      const { error } = await supabase
        .from('intervention_assignments')
        .insert({
          tenant_id: TENANT_ID,
          intervention_ref: info.intervention_ref,
          intervention_label: info.intervention_label,
          intervention_id: info.intervention_id,
          user_id: userId,
          user_name: userName,
          client_name: info.client_name,
          location: info.location,
          priority: info.priority,
          date_planned: info.date_planned,
          is_primary: info.assigned_users.length === 0,
          assigned_by: userId,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Vous êtes déjà assigné à cette intervention');
        } else {
          throw error;
        }
      } else {
        setTaken(true);
        toast.success('Intervention prise avec succès !');
      }
    } catch (err) {
      console.error('Error taking intervention:', err);
      toast.error('Erreur lors de la prise de l\'intervention');
    } finally {
      setTaking(false);
    }
  };

  if (!ref) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white/60">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
          <p className="text-lg font-bold">QR Code invalide</p>
          <p className="text-sm mt-1">Scannez un QR code valide depuis l'écran TV</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 rounded-2xl border border-white/20 p-6 max-w-sm w-full text-center">
          <img src={logoEnes} alt="ENES" className="h-12 mx-auto mb-4" />
          <h1 className="text-white text-lg font-bold mb-2">Connexion requise</h1>
          <p className="text-white/60 text-sm mb-4">
            Connectez-vous pour prendre l'intervention <strong className="text-white">{decodeURIComponent(label) || ref}</strong>
          </p>
          <Button
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 rounded-2xl border border-white/20 p-6 max-w-sm w-full backdrop-blur-sm">
        <img src={logoEnes} alt="ENES" className="h-10 mx-auto mb-4" />

        {loading ? (
          <div className="text-center text-white/40 py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">Chargement…</p>
          </div>
        ) : taken ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-white text-lg font-bold mb-1">Intervention prise !</h2>
            <p className="text-white/60 text-sm mb-4">
              Vous êtes assigné à <strong className="text-white">{info?.intervention_label}</strong>
            </p>
            <div className="space-y-2">
              {info?.intervention_id && (
                <Button
                  onClick={() => navigate(`/intervention/${info.intervention_id}`)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Voir l'intervention
                </Button>
              )}
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                Retour au tableau de bord
              </Button>
            </div>
          </div>
        ) : info ? (
          <>
            {/* Intervention details */}
            <div className={`rounded-xl border p-4 mb-4 ${
              info.priority !== 'normal' ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'
            }`}>
              {info.priority !== 'normal' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase">
                    {info.priority === 'critical' ? 'Critique' : 'Urgent'}
                  </span>
                </div>
              )}
              <h2 className="text-white text-lg font-bold mb-1">{info.intervention_label}</h2>
              <p className="text-white/50 text-xs font-mono mb-3">Réf: {info.intervention_ref}</p>

              {info.client_name && (
                <div className="flex items-center gap-2 text-sm text-white/70 mb-1.5">
                  <User className="h-3.5 w-3.5 text-white/40" />
                  {info.client_name}
                </div>
              )}
              {info.location && (
                <div className="flex items-center gap-2 text-sm text-white/70 mb-1.5">
                  <MapPin className="h-3.5 w-3.5 text-white/40" />
                  {info.location}
                </div>
              )}
              {info.date_planned && (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Calendar className="h-3.5 w-3.5 text-white/40" />
                  {new Date(info.date_planned).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              )}
            </div>

            {/* Currently assigned */}
            {info.assigned_users.length > 0 && (
              <div className="bg-white/5 rounded-lg border border-white/10 p-3 mb-4">
                <p className="text-[11px] text-white/40 uppercase font-bold mb-1.5">Déjà assigné(s)</p>
                <div className="flex flex-wrap gap-1.5">
                  {info.assigned_users.map((name, i) => (
                    <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {info.already_assigned ? (
              <div className="text-center">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-emerald-300 text-sm font-medium">Vous êtes déjà assigné</p>
                </div>
                {info.intervention_id && (
                  <Button
                    onClick={() => navigate(`/intervention/${info.intervention_id}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Voir l'intervention
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleTake}
                disabled={taking}
                className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                {taking ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Assignation…</>
                ) : (
                  '✋ Prendre l\'intervention'
                )}
              </Button>
            )}

            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="w-full mt-2 text-white/40 hover:text-white/60 text-xs"
            >
              <ArrowLeft className="h-3 w-3 mr-1" /> Retour
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
