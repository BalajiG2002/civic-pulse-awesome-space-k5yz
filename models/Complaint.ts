import { initDB, createModel } from 'lyzr-architect';

let _model: any = null;

export default async function getComplaintModel() {
  if (!_model) {
    await initDB();
    _model = createModel('Complaint', {
      complaint_id: { type: String, unique: true },
      photo_url: String,
      description: String,
      lat: Number,
      lng: Number,
      area_name: String,
      ward_number: Number,
      ward_name: String,
      zone: String,
      issue_type: String,
      severity: String,
      status: { type: String, default: 'received' },
      department_assigned: String,
      sla_deadline: Date,
      sla_hours: Number,
      resolved_at: Date,
      resolution_time_minutes: Number,
      tweet_url: String,
      telegram_chat_id: String,
      hotspot: { type: Boolean, default: false },
      cluster_count: { type: Number, default: 0 },
    });
  }
  return _model;
}
