import { initDB, createModel } from 'lyzr-architect';

let _model: any = null;

export default async function getAuditLogModel() {
  if (!_model) {
    await initDB();
    _model = createModel('AuditLog', {
      complaint_id: String,
      action: String,
      old_status: String,
      new_status: String,
      actor: String,
      details: String,
      timestamp: { type: Date, default: Date.now },
    });
  }
  return _model;
}
