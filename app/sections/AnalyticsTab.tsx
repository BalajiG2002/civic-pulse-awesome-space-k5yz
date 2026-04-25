'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FiDownload, FiLoader, FiFilter, FiRefreshCw } from 'react-icons/fi'

interface AnalyticsTabProps {
  showSample: boolean
}

const SAMPLE_AUDIT = [
  { complaint_id: 'JSV-2847', action: 'status_update', old_status: 'dispatched', new_status: 'in_progress', actor: 'admin', details: 'Assigned to field team', timestamp: '2026-04-25T10:30:00Z' },
  { complaint_id: 'JSV-2848', action: 'created', old_status: '', new_status: 'received', actor: 'system', details: 'New complaint registered', timestamp: '2026-04-25T09:15:00Z' },
  { complaint_id: 'JSV-2850', action: 'status_update', old_status: 'in_progress', new_status: 'resolved', actor: 'admin', details: 'Issue fixed on site', timestamp: '2026-04-25T14:00:00Z' },
  { complaint_id: 'JSV-2849', action: 'sla_breach', old_status: 'received', new_status: 'breached', actor: 'SLA Monitor', details: 'SLA deadline exceeded', timestamp: '2026-04-25T12:00:00Z' },
]

const SAMPLE_DEPTS = [
  { dept_name: 'BBMP Roads', total_assigned: 45, total_resolved: 32, avg_response_minutes: 180, sla_breach_count: 3 },
  { dept_name: 'BWSSB', total_assigned: 28, total_resolved: 22, avg_response_minutes: 240, sla_breach_count: 2 },
  { dept_name: 'BESCOM', total_assigned: 19, total_resolved: 17, avg_response_minutes: 120, sla_breach_count: 0 },
  { dept_name: 'BBMP Health', total_assigned: 33, total_resolved: 29, avg_response_minutes: 300, sla_breach_count: 5 },
  { dept_name: 'Local Police', total_assigned: 12, total_resolved: 10, avg_response_minutes: 90, sla_breach_count: 1 },
]

const SAMPLE_CATEGORIES = [
  { type: 'ROADS', count: 45, pct: 35 },
  { type: 'WATER', count: 28, pct: 22 },
  { type: 'HEALTH', count: 25, pct: 19 },
  { type: 'POWER', count: 19, pct: 15 },
  { type: 'SAFETY', count: 8, pct: 6 },
  { type: 'OTHER', count: 4, pct: 3 },
]

export default function AnalyticsTab({ showSample }: AnalyticsTabProps) {
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [error, setError] = useState('')

  const displayAudit = showSample ? SAMPLE_AUDIT : auditLogs
  const displayDepts = showSample ? SAMPLE_DEPTS : departments

  const filteredAudit = filterText.trim()
    ? displayAudit.filter(l => (l.complaint_id || '').toLowerCase().includes(filterText.toLowerCase()) || (l.action || '').toLowerCase().includes(filterText.toLowerCase()))
    : displayAudit

  const loadData = useCallback(async () => {
    if (showSample) return
    setLoading(true)
    setError('')
    try {
      const [aRes, dRes, cRes] = await Promise.all([
        fetch('/api/audit-log'),
        fetch('/api/departments'),
        fetch('/api/complaints'),
      ])
      const aJson = await aRes.json()
      const dJson = await dRes.json()
      const cJson = await cRes.json()
      if (aJson.success) setAuditLogs(Array.isArray(aJson.data) ? aJson.data : [])
      if (dJson.success) setDepartments(Array.isArray(dJson.data) ? dJson.data : [])
      if (cJson.success) setComplaints(Array.isArray(cJson.data) ? cJson.data : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
    }
    setLoading(false)
  }, [showSample])

  useEffect(() => { loadData() }, [loadData])

  const categoryData = showSample ? SAMPLE_CATEGORIES : (() => {
    const counts: Record<string, number> = {}
    complaints.forEach(c => {
      const t = c.issue_type || 'OTHER'
      counts[t] = (counts[t] || 0) + 1
    })
    const total = complaints.length || 1
    return Object.entries(counts).map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count)
  })()

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Complaint ID', 'Action', 'Old Status', 'New Status', 'Actor', 'Details']
    const rows = displayAudit.map(l => [
      l.timestamp ? new Date(l.timestamp).toISOString() : '',
      l.complaint_id || '',
      l.action || '',
      l.old_status || '',
      l.new_status || '',
      l.actor || '',
      (l.details || '').replace(/,/g, ';'),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const CATEGORY_COLORS = ['hsl(220,80%,60%)', 'hsl(160,70%,50%)', 'hsl(280,60%,60%)', 'hsl(35,85%,55%)', 'hsl(0,75%,55%)', 'hsl(220,15%,55%)']

  return (
    <div className="space-y-4 p-4">
      {error && (
        <Card className="border-[hsl(0,75%,55%)] bg-card">
          <CardContent className="p-3 text-[hsl(0,75%,55%)] text-sm">{error}</CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading || showSample}>
          <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
        </Button>
      </div>

      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categoryData.map((cat, i) => (
              <div key={cat.type} className="flex items-center gap-3">
                <span className="text-xs text-foreground w-16">{cat.type}</span>
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${cat.pct}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right">{cat.count} ({cat.pct}%)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Department Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Department</TableHead>
                <TableHead className="text-muted-foreground">Resolved</TableHead>
                <TableHead className="text-muted-foreground">Avg Time</TableHead>
                <TableHead className="text-muted-foreground">Breaches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayDepts.map((d, i) => (
                <TableRow key={d.dept_name || i} className={`border-border ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs text-foreground font-medium">{d.dept_name}</TableCell>
                  <TableCell className="text-xs text-foreground">{d.total_resolved ?? 0}/{d.total_assigned ?? 0}</TableCell>
                  <TableCell className="text-xs text-foreground">{d.avg_response_minutes ? `${Math.round(d.avg_response_minutes / 60 * 10) / 10}h` : '--'}</TableCell>
                  <TableCell className={`text-xs ${(d.sla_breach_count || 0) > 0 ? 'text-[hsl(0,75%,55%)] font-medium' : 'text-foreground'}`}>{d.sla_breach_count ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground">Audit Trail</CardTitle>
            <Button size="sm" onClick={handleExportCSV} className="bg-primary text-primary-foreground text-xs">
              <FiDownload className="mr-1" size={12} /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <FiFilter size={12} className="text-muted-foreground" />
            <Input
              placeholder="Filter by ID or action..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="bg-input border-border text-foreground text-xs h-8"
            />
          </div>
          <ScrollArea className="max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Time</TableHead>
                  <TableHead className="text-muted-foreground">ID</TableHead>
                  <TableHead className="text-muted-foreground">Action</TableHead>
                  <TableHead className="text-muted-foreground">Status Change</TableHead>
                  <TableHead className="text-muted-foreground">Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudit.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No audit logs</TableCell></TableRow>
                )}
                {filteredAudit.map((l, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="text-xs text-muted-foreground">{l.timestamp ? new Date(l.timestamp).toLocaleString() : '--'}</TableCell>
                    <TableCell className="text-xs font-mono text-foreground">{l.complaint_id}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{l.action}</Badge></TableCell>
                    <TableCell className="text-xs text-foreground">{l.old_status || '--'} → {l.new_status || '--'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.actor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
