'use client'

import { Suspense } from 'react'
import CitizenTrackingPage from '@/app/sections/CitizenTrackingPage'

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <CitizenTrackingPage showSample={false} />
    </Suspense>
  )
}
