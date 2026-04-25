'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { callAIAgent } from '@/lib/aiAgent'
import { FiLoader, FiCheck, FiClock, FiAlertTriangle, FiActivity, FiTrendingUp, FiRefreshCw, FiSearch } from 'react-icons/fi'
import dynamic from 'next/dynamic'

const MapComponent = dynamic(() => import('./TrackingMap'), { ssr: false })

const RESOLUTION_TWEET_AGENT = '69ec63a9e262aa46ad15400b'
const GEO_CLUSTER_AGENT = '69ec63abe262aa46ad15400d'

interface AdminDashboardProps {
  showSample: boolean
  onActiveAgent: (id: string | null) => void
}

interface Complaint {
  _id?: string
  complaint_id: string
  photo_url?: string
  description?: string
  lat?: number
  lng?: number
  area_name?: string
  ward_number?: number
  ward_name?: string
  zone?: string
  issue_type?: string
  severity?: string
  status?: string
  department_assigned?: string
  sla_deadline?: string
  sla_hours?: number
  hotspot?: boolean
  cluster_count?: number
  tweet_url?: string
}

const SAMPLE_COMPLAINTS: Complaint[] = [
  { complaint_id: 'JSV-2847', description: 'Large pothole on MG Road', lat: 12.9753, lng: 77.6069, area_name: 'MG Road', ward_number: 89, zone: 'East', issue_type: 'ROADS', severity: 'P1', status: 'in_progress', department_assigned: 'BBMP Roads', sla_deadline: '2026-04-26T04:33:00Z', sla_hours: 4, hotspot: true },
  { complaint_id: 'JSV-2848', description: 'Water supply disrupted in Indiranagar', lat: 12.9784, lng: 77.6408, area_name: 'Indiranagar', ward_number: 82, zone: 'East', issue_type: 'WATER', severity: 'P2', status: 'dispatched', department_assigned: 'BWSSB', sla_deadline: '2026-04-26T12:00:00Z', sla_hours: 8 },
  { complaint_id: 'JSV-2849', description: 'Streetlight not working on 80 Feet Road', lat: 12.9352, lng: 77.6245, area_name: '80 Feet Road', ward_number: 150, zone: 'South', issue_type: 'POWER', severity: 'P3', status: 'received', department_assigned: 'BESCOM', sla_deadline: '2026-04-27T10:00:00Z', sla_hours: 24 },
  { complaint_id: 'JSV-2850', description: 'Garbage not collected for 3 days', lat: 12.9606, lng: 77.5946, area_name: 'Jayanagar', ward_number: 170, zone: 'South', issue_type: 'HEALTH', severity: 'P2', status: 'resolved', department_assigned: 'BBMP Health', sla_deadline: '2026-04-25T16:00:00Z', sla_hours: 8 },
]

const SAMPLE_DEPTS = [
  { dept_name: 'BBMP Roads', total_assigned: 45, total_resolved: 32, avg_response_minutes: 180, sla_breach_count: 3 },
  { dept_name: 'BWSSB', total_assigned: 28, total_resolved: 22, avg_response_minutes: 240, sla_breach_count: 2 },
  { dept_name: 'BESCOM', total_assigned: 19, total_resolved: 17, avg_response_minutes: 120, sla_breach_count: 0 },
  { dept_name: 'BBMP Health', total_assigned: 33, total_resolved: 29, avg_response_minutes: 300, sla_breach_count: 5 },
]

// Simple local filter patterns for NL query
function applyLocalFilter(query: string, complaints: Complaint[]): Complaint[] | null {
  const lower = query.toLowerCase().trim()
  if (lower.includes('p1')) return complaints.filter(c => c.severity === 'P1')
  if (lower.includes('p2')) return complaints.filter(c => c.severity === 'P2')
  if (lower.includes('p3')) return complaints.filter(c => c.severity === 'P3')

  const wardMatch = lower.match(/ward\s*(\d+)/)
  if (wardMatch) return complaints.filter(c => c.ward_number === Number(wardMatch[1]))

  if (lower.includes('resolved')) return complaints.filter(c => c.status === 'resolved')
  if (lower.includes('breach')) {
    return complaints.filter(c => {
      if (!c.sla_deadline) return false
      return new Date(c.sla_deadline).getTime() < Date.now() && c.status !== 'resolved'
    })
  }
  if (lower.includes('hotspot')) return complaints.filter(c => c.hotspot)

  return null // not a simple filter, use agent
}

export default function AdminDashboard({ showSample, onActiveAgent }: AdminDashboardProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [apiError, setApiError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  // NL Query state
  const [nlQuery, setNlQuery] = useState('')
  const [nlLoading, setNlLoading] = useState(false)
  const [nlResult, setNlResult] = useState<string | null>(null)
  const [nlFilteredComplaints, setNlFilteredComplaints] = useState<Complaint[] | null>(null)

  const displayComplaints = showSample ? SAMPLE_COMPLAINTS : complaints
  const displayDepts = showSample ? SAMPLE_DEPTS : departments

  const baseFiltered = statusFilter === 'all'
    ? displayComplaints
    : displayComplaints.filter(c => c.status === statusFilter)

  const filteredComplaints = nlFilteredComplaints ?? baseFiltered

  const loadData = useCallback(async () => {
    if (showSample) return
    setLoading(true)
    setApiError('')
    try {
      const [cRes, dRes] = await Promise.all([
        fetch('/api/complaints'),
        fetch('/api/departments'),
      ])
      const cJson = await cRes.json()
      const dJson = await dRes.json()
      if (cJson.success) setComplaints(Array.isArray(cJson.data) ? cJson.data : [])
      if (dJson.success) setDepartments(Array.isArray(dJson.data) ? dJson.data : [])
    } catch (e: any) {
      setApiError(e?.message || 'Failed to load data')
    }
    setLoading(false)
  }, [showSample])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const activeCount = displayComplaints.filter(c => c.status !== 'resolved').length
  const resolvedToday = displayComplaints.filter(c => c.status === 'resolved').length
  const breachCount = displayComplaints.filter(c => {
    if (!c.sla_deadline) return false
    return new Date(c.sla_deadline).getTime() < Date.now() && c.status !== 'resolved'
  }).length

  const handleNlQuery = async () => {
    if (!nlQuery.trim()) return
    setNlLoading(true)
    setNlResult(null)
    setNlFilteredComplaints(null)

    // Try simple local filter first
    const localResult = applyLocalFilter(nlQuery, displayComplaints)
    if (localResult !== null) {
      setNlFilteredComplaints(localResult)
      setNlResult(`Found ${localResult.length} complaint${localResult.length !== 1 ? 's' : ''} matching "${nlQuery}"`)
      setNlLoading(false)
      return
    }

    // Complex query: call GeoClusterAgent
    try {
      const result = await callAIAgent(nlQuery, GEO_CLUSTER_AGENT)
      const agentData = result?.response?.result
      const responseText = agentData?.message ?? agentData?.text ?? result?.response?.message ?? 'No results found for your query.'
      setNlResult(responseText)
    } catch {
      setNlResult('Failed to process query. Please try again.')
    }
    setNlLoading(false)
  }

  const clearNlFilter = () => {
    setNlQuery('')
    setNlResult(null)
    setNlFilteredComplaints(null)
  }

  const handleStatusUpdate = async (complaint: Complaint, newStatus: string) => {
    setActionLoading(true)
    setActionMsg('')
    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(complaint.complaint_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) }),
      })
      const json = await res.json()
      if (json.success) {
        setActionMsg(`Status updated to ${newStatus}`)
        await fetch('/api/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ complaint_id: complaint.complaint_id, action: 'status_update', old_status: complaint.status, new_status: newStatus, actor: 'admin', details: `Status changed to ${newStatus}` }),
        })
        if (newStatus === 'resolved' && complaint.severity === 'P1') {
          onActiveAgent(RESOLUTION_TWEET_AGENT)
          await callAIAgent(
            `Complaint ${complaint.complaint_id} (${complaint.issue_type}) in ${complaint.area_name} has been resolved by ${complaint.department_assigned}. Post a resolution tweet.`,
            RESOLUTION_TWEET_AGENT
          )
          onActiveAgent(null)
        }
        await loadData()
        setSelectedComplaint(null)
      } else {
        setActionMsg(`Error: ${json.error || 'Update failed'}`)
      }
    } catch (e: any) {
      setActionMsg(`Error: ${e?.message || 'Update failed'}`)
    }
    setActionLoading(false)
  }

  function getSlaText(deadline?: string) {
    if (!deadline) return { text: '--', critical: false }
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff <= 0) return { text: 'BREACHED', critical: true }
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return { text: `${h}h ${m}m`, critical: h < 1 }
  }

  function getRowSeverityClasses(complaint: Complaint) {
    if (complaint.status === 'resolved') return 'border-l-2 border-l-[hsl(160,70%,45%)]'
    if (complaint.severity === 'P1') return 'border-l-2 border-l-[hsl(0,75%,55%)] bg-[hsl(0,75%,55%)]/5'
    if (complaint.severity === 'P2') return 'border-l-2 border-l-[hsl(35,85%,55%)]'
    return ''
  }

  const statsCards = [
    { label: 'Active', value: activeCount, color: 'hsl(220,80%,55%)' },
    { label: 'Resolved', value: resolvedToday, color: 'hsl(160,70%,45%)' },
    { label: 'Avg Response', value: displayDepts.length > 0 ? `${Math.round(displayDepts.reduce((a, d) => a + (d.avg_response_minutes || 0), 0) / displayDepts.length)}m` : '--', color: 'hsl(280,60%,60%)' },
    { label: 'SLA Breaches', value: breachCount, color: 'hsl(0,75%,55%)' },
  ]

  return (
    <div className="space-y-4 p-4">
      {/* NL Query Input */}
      <Card className="bg-card border border-border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <FiSearch size={14} className="text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Ask anything -- e.g. show all P1 complaints, Ward 83 issues, BBMP Roads performance"
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNlQuery()}
              disabled={nlLoading}
              className="flex-1 bg-input border-border text-foreground text-sm"
            />
            <Button size="sm" onClick={handleNlQuery} disabled={nlLoading || !nlQuery.trim()} className="bg-primary text-primary-foreground text-xs px-3">
              {nlLoading ? <FiLoader className="animate-spin" size={14} /> : 'Query'}
            </Button>
            {(nlResult || nlFilteredComplaints) && (
              <Button size="sm" variant="ghost" onClick={clearNlFilter} className="text-xs text-muted-foreground px-2">
                Clear
              </Button>
            )}
          </div>
          {nlLoading && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <FiLoader className="animate-spin" size={12} /> Processing query...
            </div>
          )}
          {nlResult && !nlLoading && (
            <div className="mt-2 p-3 rounded bg-secondary/50 border border-border text-sm text-foreground whitespace-pre-line">
              {nlResult}
            </div>
          )}
        </CardContent>
      </Card>

      {apiError && (
        <Card className="border-[hsl(0,75%,55%)] bg-card">
          <CardContent className="p-3 text-[hsl(0,75%,55%)] text-sm">{apiError}</CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading || showSample}>
          <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsCards.map(s => (
          <Card key={s.label} className="bg-card border border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {displayComplaints.some(c => c.lat && c.lng) && (
        <Card className="bg-card border border-border overflow-hidden">
          <div style={{ height: 250 }}>
            <MapComponent
              lat={12.9698}
              lng={77.7499}
              zoom={12}
              complaints={displayComplaints.filter(c => c.lat && c.lng).map(c => ({
                lat: c.lat!,
                lng: c.lng!,
                complaint_id: c.complaint_id,
                severity: c.severity || 'P3',
                issue_type: c.issue_type || '',
                status: c.status || 'received',
                area_name: c.area_name,
                hotspot: c.hotspot,
                sla_hours: c.sla_hours,
              }))}
              pulseDemo
            />
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setNlFilteredComplaints(null); setNlResult(null) }}>
          <SelectTrigger className="w-40 bg-input border-border text-foreground">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filteredComplaints.length} complaints</span>
      </div>

      <Card className="bg-card border border-border">
        <ScrollArea className="max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">ID</TableHead>
                <TableHead className="text-muted-foreground">Location</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Severity</TableHead>
                <TableHead className="text-muted-foreground">SLA</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {loading ? 'Loading...' : showSample ? 'No sample data' : 'No complaints yet. Switch on the Sample toggle to see demo data.'}
                </TableCell></TableRow>
              )}
              {filteredComplaints.map(c => {
                const sla = getSlaText(c.sla_deadline)
                return (
                  <TableRow key={c.complaint_id} className={`border-border cursor-pointer hover:bg-secondary/50 ${getRowSeverityClasses(c)}`} onClick={() => setSelectedComplaint(c)}>
                    <TableCell className="font-mono text-xs text-foreground">{c.complaint_id}</TableCell>
                    <TableCell className="text-xs text-foreground">{c.area_name || '--'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.issue_type || '--'}</Badge></TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${c.severity === 'P1' ? 'bg-[hsl(0,75%,55%)] text-white' : c.severity === 'P2' ? 'bg-[hsl(35,85%,55%)] text-white' : 'bg-muted text-muted-foreground'}`}>
                        {c.severity || '--'}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-xs ${sla.critical ? 'text-[hsl(0,75%,55%)] font-medium' : 'text-muted-foreground'}`}>{sla.text}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs border-border">{c.status || '--'}</Badge></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {selectedComplaint && (
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono text-foreground">{selectedComplaint.complaint_id}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedComplaint(null)} className="text-muted-foreground text-xs">Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-foreground">{selectedComplaint.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{selectedComplaint.issue_type}</span></div>
              <div><span className="text-muted-foreground">Severity:</span> <span className="text-foreground">{selectedComplaint.severity}</span></div>
              <div><span className="text-muted-foreground">Dept:</span> <span className="text-foreground">{selectedComplaint.department_assigned}</span></div>
              <div><span className="text-muted-foreground">Ward:</span> <span className="text-foreground">{selectedComplaint.ward_number || '--'}</span></div>
              <div><span className="text-muted-foreground">Zone:</span> <span className="text-foreground">{selectedComplaint.zone || '--'}</span></div>
              <div><span className="text-muted-foreground">Hotspot:</span> <span className="text-foreground">{selectedComplaint.hotspot ? 'Yes' : 'No'}</span></div>
            </div>
            {actionMsg && <p className="text-xs text-[hsl(160,70%,45%)]">{actionMsg}</p>}
            <div className="flex gap-2">
              {selectedComplaint.status !== 'in_progress' && selectedComplaint.status !== 'resolved' && (
                <Button size="sm" className="bg-primary text-primary-foreground text-xs" onClick={() => handleStatusUpdate(selectedComplaint, 'in_progress')} disabled={actionLoading}>
                  {actionLoading ? <FiLoader className="animate-spin mr-1" size={12} /> : <FiClock className="mr-1" size={12} />} In Progress
                </Button>
              )}
              {selectedComplaint.status !== 'resolved' && (
                <Button size="sm" className="bg-[hsl(160,70%,45%)] text-white text-xs" onClick={() => handleStatusUpdate(selectedComplaint, 'resolved')} disabled={actionLoading}>
                  {actionLoading ? <FiLoader className="animate-spin mr-1" size={12} /> : <FiCheck className="mr-1" size={12} />} Resolved
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Department Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Department</TableHead>
                <TableHead className="text-muted-foreground">Resolved</TableHead>
                <TableHead className="text-muted-foreground">Avg Time</TableHead>
                <TableHead className="text-muted-foreground">Breaches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayDepts.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No department data</TableCell></TableRow>
              )}
              {displayDepts.map((d, i) => (
                <TableRow key={d.dept_name || i} className={`border-border ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <TableCell className="text-xs text-foreground">{d.dept_name}</TableCell>
                  <TableCell className="text-xs text-foreground">{d.total_resolved ?? 0}/{d.total_assigned ?? 0}</TableCell>
                  <TableCell className="text-xs text-foreground">{d.avg_response_minutes ? `${Math.round(d.avg_response_minutes)}m` : '--'}</TableCell>
                  <TableCell className={`text-xs ${(d.sla_breach_count || 0) > 0 ? 'text-[hsl(0,75%,55%)]' : 'text-foreground'}`}>{d.sla_breach_count ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
