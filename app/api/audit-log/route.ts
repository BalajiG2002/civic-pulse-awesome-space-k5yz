import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';

import getAuditLogModel from '@/models/AuditLog';

async function handler(req: NextRequest) {
  try {
    const AuditLog = await getAuditLogModel();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const complaint_id = url.searchParams.get('complaint_id');
      const filter: Record<string, any> = {};
      if (complaint_id) filter.complaint_id = complaint_id;
      const data = await AuditLog.find(filter);
      return NextResponse.json({ success: true, data });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      let userId: string | undefined;
      try { userId = getCurrentUserId(); } catch {}
      const data = await AuditLog.create({ ...body, owner_user_id: userId });
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

const authedHandler = authMiddleware(handler);
export const GET = authedHandler;
export const POST = authedHandler;
