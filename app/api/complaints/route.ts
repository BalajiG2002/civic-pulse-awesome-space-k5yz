import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth, getCurrentUserId } from 'lyzr-architect';
import getComplaintModel from '@/models/Complaint';

async function handler(req: NextRequest) {
  if (req.method === 'GET') {
    try {
      const Complaint = await getComplaintModel();
      const url = new URL(req.url);
      const filter: Record<string, any> = {};
      const status = url.searchParams.get('status');
      const severity = url.searchParams.get('severity');
      const complaint_id = url.searchParams.get('complaint_id');
      const department = url.searchParams.get('department');
      if (status) filter.status = status;
      if (severity) filter.severity = severity;
      if (complaint_id) filter.complaint_id = complaint_id;
      if (department) filter.department_assigned = department;
      const data = await Complaint.find(filter);
      return NextResponse.json({ success: true, data });
    } catch (error: any) {
      return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
    }
  }

  if (req.method === 'POST') {
    try {
      const Complaint = await getComplaintModel();
      const body = await req.json();
      const data = await Complaint.create({
        ...body,
        owner_user_id: body.telegram_chat_id ? `tg-${body.telegram_chat_id}` : 'anonymous'
      });
      return NextResponse.json({ success: true, data });
    } catch (error: any) {
      return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

const publicHandler = optionalAuth(handler);
export const GET = publicHandler;
export const POST = publicHandler;
