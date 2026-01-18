import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UnacknowledgedAssignment {
  id: string;
  user_id: string;
  user_name: string;
  intervention_id: number | null;
  intervention_ref: string;
  intervention_label: string;
  priority: string;
  date_planned: string | null;
  client_name: string | null;
  location: string | null;
  reminder_count: number;
  last_reminder_sent: string | null;
  tenant_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting reminder check for unacknowledged urgent interventions...');

    // Create Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate 2 hours ago
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const twoHoursAgoISO = twoHoursAgo.toISOString();

    console.log('Checking for assignments older than:', twoHoursAgoISO);

    // Find urgent/critical assignments that:
    // 1. Are not acknowledged
    // 2. Were assigned more than 2 hours ago OR last reminder was sent more than 2 hours ago
    const { data: unacknowledgedAssignments, error: fetchError } = await supabase
      .from('intervention_assignments')
      .select('*')
      .in('priority', ['urgent', 'critical'])
      .eq('notification_acknowledged', false)
      .or(`last_reminder_sent.is.null,last_reminder_sent.lt.${twoHoursAgoISO}`)
      .lt('assigned_at', twoHoursAgoISO);

    if (fetchError) {
      console.error('Error fetching unacknowledged assignments:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${unacknowledgedAssignments?.length || 0} unacknowledged urgent assignments needing reminder`);

    if (!unacknowledgedAssignments || unacknowledgedAssignments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No reminders needed',
          remindersCount: 0 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update each assignment with reminder info
    const reminderResults = [];
    
    for (const assignment of unacknowledgedAssignments as UnacknowledgedAssignment[]) {
      console.log(`Sending reminder for assignment ${assignment.id} to user ${assignment.user_name}`);
      
      // Update the assignment with new reminder info
      const { error: updateError } = await supabase
        .from('intervention_assignments')
        .update({
          reminder_count: (assignment.reminder_count || 0) + 1,
          last_reminder_sent: new Date().toISOString(),
          notification_sent: true, // Mark as sent to trigger realtime notification
        })
        .eq('id', assignment.id);

      if (updateError) {
        console.error(`Error updating reminder for assignment ${assignment.id}:`, updateError);
        reminderResults.push({
          assignmentId: assignment.id,
          userId: assignment.user_id,
          success: false,
          error: updateError.message,
        });
      } else {
        console.log(`Reminder ${assignment.reminder_count + 1} sent for assignment ${assignment.id}`);
        reminderResults.push({
          assignmentId: assignment.id,
          userId: assignment.user_id,
          userName: assignment.user_name,
          interventionRef: assignment.intervention_ref,
          priority: assignment.priority,
          reminderNumber: (assignment.reminder_count || 0) + 1,
          success: true,
        });
      }
    }

    const successCount = reminderResults.filter(r => r.success).length;
    const failCount = reminderResults.filter(r => !r.success).length;

    console.log(`Reminder job completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} reminders (${failCount} failed)`,
        remindersCount: successCount,
        failedCount: failCount,
        details: reminderResults,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-reminders function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
