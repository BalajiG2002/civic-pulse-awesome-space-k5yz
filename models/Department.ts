import { initDB, createModel } from 'lyzr-architect';

let _model: any = null;

export default async function getDepartmentModel() {
  if (!_model) {
    await initDB();
    _model = createModel('Department', {
      dept_name: { type: String, unique: true },
      zone: String,
      slack_channel: String,
      total_assigned: { type: Number, default: 0 },
      total_resolved: { type: Number, default: 0 },
      avg_response_minutes: { type: Number, default: 0 },
      sla_breach_count: { type: Number, default: 0 },
    });
  }
  return _model;
}
