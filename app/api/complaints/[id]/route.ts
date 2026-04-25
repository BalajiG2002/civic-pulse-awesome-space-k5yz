import { NextRequest, NextResponse } from 'next/server'
import getComplaintModel from '@/models/Complaint'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const Complaint = await getComplaintModel()
    const data = await Complaint.findOne({ complaint_id: params.id })
    if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const Complaint = await getComplaintModel()
    const body = await req.json()
    const data = await Complaint.findOneAndUpdate(
      { complaint_id: params.id },
      { ...body, updated_at: new Date().toISOString() },
      { new: true }
    )
    if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
