-- Table for released interventions (available for handover)
CREATE TABLE public.released_interventions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id INTEGER NOT NULL,
  intervention_ref TEXT NOT NULL,
  intervention_label TEXT NOT NULL,
  client_name TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  date_start TIMESTAMP WITH TIME ZONE,
  intervention_type TEXT NOT NULL DEFAULT 'installation',
  priority TEXT NOT NULL DEFAULT 'normal',
  released_by_user_id INTEGER NOT NULL,
  released_by_name TEXT NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  taken_by_user_id INTEGER,
  taken_by_name TEXT,
  taken_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'taken', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.released_interventions ENABLE ROW LEVEL SECURITY;

-- Everyone can read available interventions
CREATE POLICY "Anyone can view released interventions" 
ON public.released_interventions 
FOR SELECT 
USING (true);

-- Anyone can insert (release their interventions)
CREATE POLICY "Anyone can release interventions" 
ON public.released_interventions 
FOR INSERT 
WITH CHECK (true);

-- Anyone can update (take an intervention)
CREATE POLICY "Anyone can take interventions" 
ON public.released_interventions 
FOR UPDATE 
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.released_interventions;