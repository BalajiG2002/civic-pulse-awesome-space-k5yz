'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FiSearch, FiLoader, FiMapPin, FiClock, FiCheck, FiAlertCircle } from 'react-icons/fi'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

interface CitizenTrackingPageProps {
  showSample: boolean
}

const SAMPLE_COMPLAINT = {
  complaint_id: 'JSV-2847',
  photo_url: '',
  description: 'Large pothole on MG Road near Brigade Junction.',
  lat: 12.9753,
  lng: 77.6069,
  area_name: 'MG Road, Brigade Junction',
  ward_number: 89,
  ward_name: 'Shanthinagar',
  zone: 'East',
  issue_type: 'ROADS',
  severity: 'P1',
  status: 'in_progress',
  department_assigned: 'BBMP Roads',
  sla_deadline: '2026-04-26T04:33:00Z',
  sla_hours: 4,
  hotspot: true,
  cluster_count: 5,
}

const TIMELINE_STEPS = [
  { key: 'received', label: 'Received', icon: FiCheck },
  { key: 'verified', label: 'Verified', icon: FiCheck },
  { key: 'classified', label: 'Classified', icon: FiCheck },
  { key: 'dispatched', label: 'Dispatched', icon: FiCheck },
  { key: 'in_progress', label: 'In Progress', icon: FiClock },
  { key: 'resolved', label: 'Resolved', icon: FiCheck },
]

const MapComponent = dynamic(() => import('./TrackingMap'), { ssr: false })

export default function CitizenTrackingPage({ showSample }: CitizenTrackingPageProps) {
  const [searchId, setSearchId] = useState('')
  const [complaint, setComplaint] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const searchParams = useSearchParams()

  // Auto-search from URL query param or path param
  useEffect(() => {
    if (showSample) return
    const idFromQuery = searchParams.get('id') ?? searchParams.get('complaint_id')
    const idFromPath = window.location.pathname.split('/track/')?.[1]
    const complaintId = idFromQuery || idFromPath || ''
    if (complaintId) {
      setSearchId(complaintId)
      ;(async () => {
        setLoading(true)
        setError('')
        setComplaint(null)
        try {
          const res = await fetch(`/api/complaints?complaint_id=${encodeURIComponent(complaintId)}`)
          const json = await res.json()
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            setComplaint(json.data[0])
          } else {
            setError('Complaint not found')
          }
        } catch {
          setError('Failed to fetch complaint. Please try again.')
        }
        setLoading(false)
      })()
    }
  }, [searchParams, showSample])

  const displayComplaint = showSample ? SAMPLE_COMPLAINT : complaint

  const handleSearch = async () => {
    if (!searchId.trim()) return
    setLoading(true)
    setError('')
    setComplaint(null)
    try {
      const res = await fetch(`/api/complaints?complaint_id=${encodeURIComponent(searchId.trim())}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setComplaint(json.data[0])
      } else {
        setError(json.error || 'Complaint not found')
      }
    } catch {
      setError('Failed to fetch complaint. Please try again.')
    }
    setLoading(false)
  }

  function getStepStatus(stepKey: string, currentStatus: string) {
    const order = TIMELINE_STEPS.map(s => s.key)
    const currentIdx = order.indexOf(currentStatus)
    const stepIdx = order.indexOf(stepKey)
    if (stepIdx < currentIdx) return 'completed'
    if (stepIdx === currentIdx) return 'current'
    return 'pending'
  }

  function getSlaDisplay(deadline: string | undefined, slaHours?: number) {
    if (!deadline) return { text: 'N/A', color: 'text-muted-foreground', percent: 100 }
    const deadlineTime = new Date(deadline).getTime()
    const now = Date.now()
    const diff = deadlineTime - now
    if (diff <= 0) return { text: 'SLA BREACHED', color: 'text-[hsl(0,75%,55%)]', percent: 0 }
    const totalMs = (slaHours ?? 24) * 3600000
    const percent = Math.min(100, Math.max(0, (diff / totalMs) * 100))
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    let color = 'text-[hsl(160,70%,45%)]' // green > 50%
    if (percent <= 10) color = 'text-[hsl(0,75%,55%)]' // red < 10%
    else if (percent <= 50) color = 'text-[hsl(35,85%,55%)]' // amber 10-50%
    return { text: `${hours}h ${mins}m remaining`, color, percent }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Track Your Complaint</h2>
      <div className="flex gap-2">
        <Input
          placeholder="Enter Complaint ID (e.g. JSV-0001)"
          value={showSample ? 'JSV-2847' : searchId}
          onChange={e => setSearchId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1 bg-input border-border font-mono"
          disabled={showSample}
        />
        <Button onClick={handleSearch} disabled={loading || showSample} className="bg-primary text-primary-foreground">
          {loading ? <FiLoader className="animate-spin" size={16} /> : <FiSearch size={16} />}
        </Button>
      </div>

      {error && (
        <Card className="border-[hsl(0,75%,55%)] bg-card">
          <CardContent className="p-3 flex items-center gap-2 text-[hsl(0,75%,55%)]">
            <FiAlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      {displayComplaint && (
        <div className="space-y-4">
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-mono text-sm text-foreground">{displayComplaint.complaint_id}</CardTitle>
                <div className="flex gap-1">
                  <Badge className={displayComplaint.severity === 'P1' ? 'bg-[hsl(0,75%,55%)] text-white' : displayComplaint.severity === 'P2' ? 'bg-[hsl(35,85%,55%)] text-white' : 'bg-[hsl(160,70%,45%)] text-white'}>
                    {displayComplaint.severity}
                  </Badge>
                  <Badge variant="secondary">{displayComplaint.issue_type}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{displayComplaint.description}</p>
              {displayComplaint.photo_url && (
                <div className="border border-border rounded overflow-hidden">
                  <img src={displayComplaint.photo_url} alt="Complaint" className="w-full h-40 object-cover" />
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <FiMapPin size={12} />
                <span>{displayComplaint.area_name}{displayComplaint.ward_number ? `, Ward ${displayComplaint.ward_number}` : ''}</span>
              </div>
            </CardContent>
          </Card>

          {(displayComplaint.lat && displayComplaint.lng) && (
            <Card className="bg-card border border-border overflow-hidden">
              <div style={{ height: 200 }}>
                <MapComponent lat={displayComplaint.lat} lng={displayComplaint.lng} label={displayComplaint.complaint_id ?? 'Location'} />
              </div>
            </Card>
          )}

          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {TIMELINE_STEPS.map((step, i) => {
                  const s = getStepStatus(step.key, displayComplaint.status ?? 'received')
                  const StepIcon = step.icon
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${s === 'completed' ? 'bg-[hsl(160,70%,45%)] text-white' : s === 'current' ? 'bg-[hsl(35,85%,55%)] text-white' : 'bg-muted text-muted-foreground'}`}>
                          <StepIcon size={12} />
                        </div>
                        {i < TIMELINE_STEPS.length - 1 && (
                          <div className={`w-px h-6 ${s === 'completed' ? 'bg-[hsl(160,70%,45%)]' : 'bg-border'}`} />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm font-medium ${s === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>{step.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border">
            <CardContent className="p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="text-foreground">{displayComplaint.department_assigned || 'Pending'}</span>
              </div>
              {(() => {
                const sla = getSlaDisplay(displayComplaint.sla_deadline, displayComplaint.sla_hours)
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SLA</span>
                      <span className={`${sla.color} font-medium`}>{sla.text}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${sla.percent > 50 ? 'bg-[hsl(160,70%,45%)]' : sla.percent > 10 ? 'bg-[hsl(35,85%,55%)]' : 'bg-[hsl(0,75%,55%)]'}`} style={{ width: `${sla.percent}%` }} />
                    </div>
                  </div>
                )
              })()}
              {displayComplaint.hotspot && (
                <Badge className="bg-[hsl(0,75%,55%)] text-white text-xs">HOTSPOT AREA</Badge>
              )}
            </CardContent>
          </Card>

          {displayComplaint.status === 'resolved' && (
            <Button variant="outline" className="w-full border-[hsl(160,70%,45%)] text-[hsl(160,70%,45%)]">
              Was this fixed? Give Feedback
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
