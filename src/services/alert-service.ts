import { supabase  } from '../db/supabase-client';
import { ERROR_CODES  } from '../config/constants';

async function listAlerts({ status }) {
  let query = supabase.from('alerts').select('*, driver:drivers(driverId, fullName)', { count: 'exact' });
  
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  
  const { data: alerts, error, count } = await query.order('createdAt', { ascending: false });
  if (error) throw error;
  
  return { count: alerts.length, total: count, alerts };
}

async function getAlert(alertId) {
  const { data: alert, error } = await supabase.from('alerts').select('*').eq('alertId', alertId).single();
  if (error || !alert) {
    const err = new Error('Alert not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }
  return alert;
}

async function resolveAlert(alertId, status) {
  if (!['acknowledged', 'resolved'].includes(status)) {
    const err = new Error('Invalid status');
    (err as any).code = ERROR_CODES.VALIDATION_ERROR;
    throw err;
  }

  const { error } = await supabase.from('alerts').update({ 
    status,
    resolvedAt: new Date().toISOString()
  }).eq('alertId', alertId);

  if (error) {
    const err = new Error('Alert not found');
    (err as any).code = ERROR_CODES.NOT_FOUND;
    throw err;
  }
  return { alertId, status };
}

export {
  listAlerts,
  getAlert,
  resolveAlert
};
