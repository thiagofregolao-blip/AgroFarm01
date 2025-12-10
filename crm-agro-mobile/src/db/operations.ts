import { db } from "./schema";

export function updateVisitStatus(visitId: string, status: string) {
  try {
    db.runSync(
      "UPDATE visits SET status = ?, updated_at = ? WHERE id = ?",
      [status, new Date().toISOString(), visitId]
    );
    
    db.runSync(
      "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
      [
        `visit_status_${visitId}_${Date.now()}`,
        "VISIT_STATUS",
        JSON.stringify({
          visit_id: visitId,
          status,
          updated_at: new Date().toISOString()
        }),
        new Date().toISOString()
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Update visit status error:', error);
    return false;
  }
}

export function saveChecklist(visitId: string, data: any) {
  try {
    db.runSync(
      "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
      [
        `checklist_${visitId}_${Date.now()}`,
        "CHECKLIST_SAVE",
        JSON.stringify({
          visit_id: visitId,
          data,
          completed_at: new Date().toISOString()
        }),
        new Date().toISOString()
      ]
    );
    
    db.runSync(
      "UPDATE visits SET status = ?, updated_at = ? WHERE id = ?",
      ['CONCLUIDA', new Date().toISOString(), visitId]
    );
    
    return true;
  } catch (error) {
    console.error('Save checklist error:', error);
    return false;
  }
}

export function createVisit(visitData: any) {
  try {
    const visitId = `visit-${Date.now()}`;
    const now = new Date().toISOString();
    
    db.runSync(
      `INSERT INTO visits (id, client_id, farm_id, field_id, scheduled_at, window_start, window_end, status, assignee, notes, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        visitId,
        visitData.client_id || null,
        visitData.farm_id || null,
        visitData.field_id || null,
        visitData.scheduled_at || null,
        visitData.window_start || null,
        visitData.window_end || null,
        'PLANEJADA',
        visitData.assignee || null,
        visitData.notes || null,
        now,
        now
      ]
    );
    
    db.runSync(
      "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
      [
        `visit_create_${visitId}`,
        "VISIT_CREATE",
        JSON.stringify({
          ...visitData,
          id: visitId,
          status: 'PLANEJADA',
          created_at: now
        }),
        now
      ]
    );
    
    return visitId;
  } catch (error) {
    console.error('Create visit error:', error);
    return null;
  }
}
