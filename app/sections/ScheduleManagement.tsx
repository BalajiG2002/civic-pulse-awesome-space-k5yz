'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listSchedules, pauseSchedule, resumeSchedule, getScheduleLogs, cronToHuman } from '@/lib/scheduler'
import type { Schedule, ExecutionLog } from '@/lib/scheduler'
import { FiLoader, FiPlay, FiPause, FiClock, FiActivity, FiRefreshCw } from 'react-icons/fi'

const SCHEDULE_ID = '69ec63cae35ffb1f44aa6641'
const SLA_AGENT_ID = '69ec63aadf3c614277735556'

export default function ScheduleManagement() {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listSchedules({ agentId: SLA_AGENT_ID })
      if (res.success && Array.isArray(res.schedules)) {
        const found = res.schedules.find((s: Schedule) => s.id === SCHEDULE_ID) || res.schedules[0] || null
        setSchedule(found)
      }
      const logRes = await getScheduleLogs(SCHEDULE_ID, { limit: 10 })
      if (logRes.success && Array.isArray((logRes as any).logs)) {
        setLogs((logRes as any).logs)
      } else if (logRes.success && Array.isArray((logRes as any).data)) {
        setLogs((logRes as any).data)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load schedule')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  const handleToggle = async () => {
    setToggling(true)
    setError('')
    try {
      if (schedule?.is_active) {
        await pauseSchedule(SCHEDULE_ID)
      } else {
        await resumeSchedule(SCHEDULE_ID)
      }
      await loadSchedules()
    } catch (e: any) {
      setError(e?.message || 'Toggle failed')
    }
    setToggling(false)
  }

  const cronText = schedule?.cron_expression ? cronToHuman(schedule.cron_expression) : 'Every 30 minutes'

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-foreground">SLA Breach Monitor Schedule</h2>

      {error && (
        <Card className="border-[hsl(0,75%,55%)] bg-card">
          <CardContent className="p-3 text-[hsl(0,75%,55%)] text-sm">{error}</CardContent>
        </Card>
      )}

      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <FiActivity size={14} /> Schedule Status
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSchedules} disabled={loading}>
              <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FiLoader className="animate-spin" size={14} />
              <span className="text-sm">Loading schedule...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">SLA Breach Monitor Agent</p>
                  <p className="text-xs text-muted-foreground font-mono">{SCHEDULE_ID}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FiClock size={10} /> {cronText}
                  </p>
                  <p className="text-xs text-muted-foreground">Timezone: {schedule?.timezone || 'Asia/Kolkata'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={schedule?.is_active ? 'bg-[hsl(160,70%,45%)] text-white' : 'bg-muted text-muted-foreground'}>
                    {schedule?.is_active ? 'ACTIVE' : 'PAUSED'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="schedule-toggle" className="text-xs text-muted-foreground">
                      {schedule?.is_active ? 'Pause' : 'Activate'}
                    </Label>
                    <Switch
                      id="schedule-toggle"
                      checked={schedule?.is_active ?? false}
                      onCheckedChange={handleToggle}
                      disabled={toggling}
                    />
                  </div>
                </div>
              </div>

              {schedule?.next_run_time && (
                <div className="text-xs text-muted-foreground">
                  Next run: {new Date(schedule.next_run_time).toLocaleString()}
                </div>
              )}
              {schedule?.last_run_at && (
                <div className="text-xs text-muted-foreground">
                  Last run: {new Date(schedule.last_run_at).toLocaleString()}
                  {schedule.last_run_success != null && (
                    <Badge variant="outline" className="ml-2 text-xs border-border">
                      {schedule.last_run_success ? 'Success' : 'Failed'}
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No execution logs yet</p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Time</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Attempt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, i) => (
                    <TableRow key={log.id || i} className="border-border">
                      <TableCell className="text-xs text-foreground">{log.executed_at ? new Date(log.executed_at).toLocaleString() : '--'}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${log.success ? 'bg-[hsl(160,70%,45%)] text-white' : 'bg-[hsl(0,75%,55%)] text-white'}`}>
                          {log.success ? 'Success' : 'Failed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.attempt}/{log.max_attempts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
