'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AuthProvider, ProtectedRoute, LoginForm, RegisterForm, UserMenu } from 'lyzr-architect/client'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import dynamic from 'next/dynamic'
import { FiMessageSquare, FiSearch, FiMap, FiShield, FiBarChart2, FiClock, FiActivity, FiSun, FiMoon, FiSend } from 'react-icons/fi'

import WebChatPortal from './sections/WebChatPortal'
import CitizenTrackingPage from './sections/CitizenTrackingPage'
import AdminDashboard from './sections/AdminDashboard'
import AnalyticsTab from './sections/AnalyticsTab'
import ScheduleManagement from './sections/ScheduleManagement'
import TelegramSetup from './sections/TelegramSetup'

const DynMap = dynamic(() => import('./sections/TrackingMap'), { ssr: false })

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const DARK_THEME: Record<string, string> = {
  '--background': '220 25% 7%',
  '--foreground': '220 15% 85%',
  '--card': '220 22% 10%',
  '--card-foreground': '220 15% 85%',
  '--popover': '220 20% 13%',
  '--popover-foreground': '220 15% 85%',
  '--primary': '220 80% 55%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '220 18% 16%',
  '--secondary-foreground': '220 15% 80%',
  '--accent': '160 70% 45%',
  '--accent-foreground': '0 0% 100%',
  '--destructive': '0 75% 55%',
  '--muted': '220 15% 20%',
  '--muted-foreground': '220 12% 55%',
  '--border': '220 18% 18%',
  '--input': '220 15% 24%',
  '--ring': '220 80% 55%',
  '--chart-1': '220 80% 60%',
  '--chart-2': '160 70% 50%',
  '--chart-3': '280 60% 60%',
  '--chart-4': '35 85% 55%',
  '--chart-5': '0 75% 55%',
  '--sidebar-background': '220 24% 8%',
  '--sidebar-border': '220 18% 15%',
  '--radius': '0.125rem',
}

const LIGHT_THEME: Record<string, string> = {
  '--background': '0 0% 97%',
  '--foreground': '220 25% 10%',
  '--card': '0 0% 100%',
  '--card-foreground': '220 25% 10%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '220 25% 10%',
  '--primary': '220 80% 55%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '220 10% 90%',
  '--secondary-foreground': '220 25% 15%',
  '--accent': '160 70% 45%',
  '--accent-foreground': '0 0% 100%',
  '--destructive': '0 75% 55%',
  '--muted': '220 10% 92%',
  '--muted-foreground': '220 12% 40%',
  '--border': '220 15% 85%',
  '--input': '220 15% 90%',
  '--ring': '220 80% 55%',
  '--chart-1': '220 80% 60%',
  '--chart-2': '160 70% 50%',
  '--chart-3': '280 60% 60%',
  '--chart-4': '35 85% 55%',
  '--chart-5': '0 75% 55%',
  '--sidebar-background': '0 0% 97%',
  '--sidebar-border': '220 15% 85%',
  '--radius': '0.125rem',
}

type ViewType = 'chat' | 'track' | 'map' | 'dashboard' | 'analytics' | 'schedule' | 'telegram'

const AGENTS = [
  { id: '69ec63cb14ac76855da37886', name: 'Pipeline Manager', purpose: 'Orchestrates complaint processing' },
  { id: '69ec634d3d7bb6a97c4dbdef', name: 'VerifierAgent', purpose: 'Validates photos and extracts GPS' },
  { id: '69ec63aa913abe53de5493db', name: 'ClassifierAgent', purpose: 'Categorizes and assigns severity' },
  { id: '69ec63abe262aa46ad15400d', name: 'GeoClusterAgent', purpose: 'Detects hotspots by location' },
  { id: '69ec63abc92502fd15549142', name: 'DispatcherAgent', purpose: 'Routes to departments via Slack' },
  { id: '69ec63a962c85fb35091fe07', name: 'SocialAmplifier', purpose: 'Tweets P1 alerts' },
  { id: '69ec63a9e262aa46ad15400b', name: 'Resolution Tweet', purpose: 'Tweets resolution updates' },
  { id: '69ec63aadf3c614277735556', name: 'SLA Monitor', purpose: 'Monitors SLA compliance' },
]

function PublicMapView({ showSample }: { showSample: boolean }) {
  const [complaints, setComplaints] = React.useState<any[]>([])
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (showSample) {
      setComplaints([
        { lat: 12.9753, lng: 77.6069, complaint_id: 'JSV-2847', severity: 'P1', issue_type: 'ROADS', status: 'in_progress', area_name: 'MG Road', hotspot: true },
        { lat: 12.9784, lng: 77.6408, complaint_id: 'JSV-2848', severity: 'P2', issue_type: 'WATER', status: 'dispatched', area_name: 'Indiranagar' },
        { lat: 12.9352, lng: 77.6245, complaint_id: 'JSV-2849', severity: 'P3', issue_type: 'POWER', status: 'received', area_name: '80 Feet Road' },
        { lat: 12.9606, lng: 77.5946, complaint_id: 'JSV-2850', severity: 'P2', issue_type: 'HEALTH', status: 'resolved', area_name: 'Jayanagar' },
      ])
      setLoaded(true)
      return
    }
    fetch('/api/complaints')
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data)) {
          const dbComplaints = j.data.filter((c: any) => c.lat && c.lng)
          setComplaints(dbComplaints)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [showSample])

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Bengaluru Complaint Map</h2>
      <Card className="bg-card border border-border overflow-hidden">
        <div style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
          {loaded ? (
            <DynMap lat={12.9698} lng={77.7499} zoom={12} complaints={complaints.map((c: any) => ({ lat: c.lat, lng: c.lng, complaint_id: c.complaint_id || '', severity: c.severity || 'P3', issue_type: c.issue_type || '', status: c.status || 'received', area_name: c.area_name || '', hotspot: c.hotspot || false, sla_hours: c.sla_hours }))} pulseDemo />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading map...</div>
          )}
        </div>
      </Card>
      <div className="flex gap-3 flex-wrap px-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'hsl(0,75%,55%)' }} /> P1 Critical</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'hsl(35,85%,55%)' }} /> P2 High</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'hsl(160,70%,45%)' }} /> Resolved</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'hsl(220,12%,55%)' }} /> Other</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-full inline-block border border-red-400" style={{ background: 'rgba(239,68,68,0.1)' }} /> Hotspot Zone</div>
      </div>
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        {mode === 'login' ? (
          <LoginForm onSwitchToRegister={() => setMode('register')} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setMode('login')} />
        )}
      </div>
    </div>
  )
}

function AgentStatusPanel({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-3">
        <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1"><FiActivity size={10} /> Agent Network (8 agents)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {AGENTS.map(a => (
            <div key={a.id} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${activeAgentId === a.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`} title={a.purpose}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeAgentId === a.id ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'}`} />
              <span className="truncate">{a.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Page() {
  const [activeView, setActiveView] = useState<ViewType>('chat')
  const [showSample, setShowSample] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(true)
  const [chatBadge, setChatBadge] = useState(0)
  const [breachCount, setBreachCount] = useState(0)

  // Load theme from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('janseva-theme')
      if (saved === 'light') setIsDark(false)
      else if (saved === 'dark') setIsDark(true)
    } catch {}
  }, [])

  // Fetch complaint & breach counts
  const fetchCounts = useCallback(() => {
    fetch('/api/complaints')
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data)) {
          const active = j.data.filter((c: any) => c.status !== 'resolved').length
          setChatBadge(active)
          const breaches = j.data.filter((c: any) => {
            if (!c.sla_deadline) return false
            return new Date(c.sla_deadline).getTime() < Date.now() && c.status !== 'resolved'
          }).length
          setBreachCount(breaches)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [fetchCounts])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    try {
      localStorage.setItem('janseva-theme', next ? 'dark' : 'light')
    } catch {}
  }

  const themeVars = (isDark ? DARK_THEME : LIGHT_THEME) as React.CSSProperties

  const isPublicView = activeView === 'chat' || activeView === 'track' || activeView === 'map'

  const NAV_ITEMS: { key: ViewType; label: string; icon: React.ReactNode; admin?: boolean; badge?: number; badgeColor?: string }[] = [
    { key: 'chat', label: 'Chat', icon: <FiMessageSquare size={14} />, badge: chatBadge > 0 ? chatBadge : undefined },
    { key: 'track', label: 'Track', icon: <FiSearch size={14} /> },
    { key: 'map', label: 'Map', icon: <FiMap size={14} /> },
    { key: 'dashboard', label: 'Dashboard', icon: <FiShield size={14} />, admin: true, badge: breachCount > 0 ? breachCount : undefined, badgeColor: 'bg-[hsl(0,75%,55%)]' },
    { key: 'analytics', label: 'Analytics', icon: <FiBarChart2 size={14} />, admin: true },
    { key: 'schedule', label: 'Schedule', icon: <FiClock size={14} />, admin: true },
    { key: 'telegram', label: 'Telegram', icon: <FiSend size={14} />, admin: true },
  ]

  return (
    <ErrorBoundary>
      <div style={themeVars} className="min-h-screen bg-background text-foreground font-sans">
        <header className={`border-b border-border sticky top-0 z-50 ${isDark ? 'bg-[hsl(220,24%,8%)]' : 'bg-white'}`}>
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground tracking-tight">JanSeva AI</h1>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
                <span className="text-[10px] text-[hsl(var(--accent))] font-medium">LIVE</span>
              </span>
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground hidden sm:inline-flex">Bengaluru</Badge>
            </div>
            <nav className="flex items-center gap-0.5">
              {NAV_ITEMS.filter(n => !n.admin).map(n => (
                <Button key={n.key} variant={activeView === n.key ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView(n.key)} className="text-xs gap-1 h-8 px-2 relative">
                  {n.icon} <span className="hidden sm:inline">{n.label}</span>
                  {n.badge != null && n.badge > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-medium flex items-center justify-center text-white px-1 ${n.badgeColor || 'bg-primary'}`}>
                      {n.badge > 99 ? '99+' : n.badge}
                    </span>
                  )}
                </Button>
              ))}
              <div className="w-px h-5 bg-border mx-1" />
              {NAV_ITEMS.filter(n => n.admin).map(n => (
                <Button key={n.key} variant={activeView === n.key ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView(n.key)} className="text-xs gap-1 h-8 px-2 relative">
                  {n.icon} <span className="hidden md:inline">{n.label}</span>
                  {n.badge != null && n.badge > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-medium flex items-center justify-center text-white px-1 ${n.badgeColor || 'bg-primary'}`}>
                      {n.badge > 99 ? '99+' : n.badge}
                    </span>
                  )}
                </Button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleTheme} className="p-1 h-8 w-8" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                {isDark ? <FiSun size={14} /> : <FiMoon size={14} />}
              </Button>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="sample-toggle" className="text-[10px] text-muted-foreground hidden sm:inline">Sample</Label>
                <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
              </div>
              {!isPublicView && (
                <AuthProvider>
                  <UserMenu />
                </AuthProvider>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto">
          {activeView === 'chat' && <WebChatPortal showSample={showSample} />}
          {activeView === 'track' && <CitizenTrackingPage showSample={showSample} />}
          {activeView === 'map' && <PublicMapView showSample={showSample} />}

          {activeView === 'dashboard' && (
            <AuthProvider>
              <ProtectedRoute unauthenticatedFallback={<AuthScreen />}>
                <AdminDashboard showSample={showSample} onActiveAgent={setActiveAgentId} />
              </ProtectedRoute>
            </AuthProvider>
          )}

          {activeView === 'analytics' && (
            <AuthProvider>
              <ProtectedRoute unauthenticatedFallback={<AuthScreen />}>
                <AnalyticsTab showSample={showSample} />
              </ProtectedRoute>
            </AuthProvider>
          )}

          {activeView === 'schedule' && (
            <AuthProvider>
              <ProtectedRoute unauthenticatedFallback={<AuthScreen />}>
                <ScheduleManagement />
              </ProtectedRoute>
            </AuthProvider>
          )}

          {activeView === 'telegram' && (
            <AuthProvider>
              <ProtectedRoute unauthenticatedFallback={<AuthScreen />}>
                <div className="max-w-2xl mx-auto p-4">
                  <TelegramSetup />
                </div>
              </ProtectedRoute>
            </AuthProvider>
          )}
        </main>

        <footer className="border-t border-border mt-6 py-3 px-4">
          <div className="max-w-7xl mx-auto">
            <AgentStatusPanel activeAgentId={activeAgentId} />
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
