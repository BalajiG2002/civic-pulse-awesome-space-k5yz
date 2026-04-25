import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';

import getDepartmentModel from '@/models/Department';

async function handler(req: NextRequest) {
  try {
    const Department = await getDepartmentModel();

    if (req.method === 'GET') {
      const data = await Department.find({});
      return NextResponse.json({ success: true, data });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      let userId: string | undefined;
      try { userId = getCurrentUserId(); } catch {}
      const data = await Department.create({ ...body, owner_user_id: userId });
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
