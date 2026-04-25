'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import { FiSend, FiCamera, FiCheck, FiAlertTriangle, FiMapPin, FiLoader, FiHelpCircle, FiClock, FiExternalLink } from 'react-icons/fi'
import { MdMyLocation } from 'react-icons/md'

const MANAGER_AGENT_ID = '69ec63cb14ac76855da37886'
const SOCIAL_AMPLIFIER_AGENT_ID = '69ec63a962c85fb35091fe07'

const GREETING_KEYWORDS = ['hi', 'hello', 'hey', '/start', 'good morning', 'good evening', 'namaste']
const CAPABILITY_KEYWORDS = ['what can you do', 'how does this work', 'what are your features', 'help', '/help', 'what do you do', 'features']

const WELCOME_MESSAGE = `Hi! I'm JanSeva AI -- Bengaluru's civic complaint assistant.
I can help you:
- Report a civic issue -- send a photo + description
- Track your complaint -- type: status JSV-XXXX
- Escalate an issue -- type: escalate JSV-XXXX
- Ask me anything about civic services in Bengaluru
What would you like to do?`

const CAPABILITY_MESSAGE = `I can:
- Register civic complaints (potholes, water leaks, power outages, garbage)
- Auto-route to the right government department (BBMP, BWSSB, BESCOM)
- Track complaints in real-time with SLA timers
- Tweet P1 critical issues publicly for accountability
- Alert you when your complaint is resolved
Just send a photo of the issue to get started!`

const DEFAULT_LOCATION = { lat: 12.9698, lng: 77.7499, area: 'Brookefield, Ward 83' }

interface ChatMessage {
  id: string
  role: 'citizen' | 'system'
  text: string
  timestamp: string
  data?: Record<string, any>
  isLoading?: boolean
  stepType?: 'verified' | 'classified' | 'dispatched' | 'tracking' | 'info'
  isPipeline?: boolean
  pipelineSteps?: PipelineStep[]
  isResultCard?: boolean
}

interface PipelineStep {
  label: string
  status: 'pending' | 'active' | 'done'
}

interface LocationData {
  lat: number
  lng: number
  area: string
}

interface WebChatPortalProps {
  showSample: boolean
  theme?: string
}

const EXAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: 'ex1',
    role: 'citizen',
    text: 'Big pothole near Polaris School, Brookefield -- dangerous for bikes',
    timestamp: '10:15 AM',
  },
  {
    id: 'ex2',
    role: 'system',
    text: 'Complaint JSV-0001 registered. Classified: P2 Roads. Dispatched to BBMP Roads. SLA: 24 hours. Track at /track?id=JSV-0001',
    timestamp: '10:16 AM',
    data: {
      complaint_id: 'JSV-0001',
      severity: 'P2',
      issue_type: 'ROADS',
      status: 'dispatched',
      department_assigned: 'BBMP Roads',
      sla_hours: 24,
      area_name: 'Brookefield, near Polaris School',
      ward_number: 83,
    },
  },
]

const PIPELINE_STEPS_TEMPLATE: PipelineStep[] = [
  { label: 'Verifying photo & location', status: 'pending' },
  { label: 'Classifying issue', status: 'pending' },
  { label: 'Finding ward & checking hotspots', status: 'pending' },
  { label: 'Dispatching to department', status: 'pending' },
  { label: 'Done -- complaint registered', status: 'pending' },
]

const STEP_ICONS = ['search', 'tag', 'map-pin', 'send', 'check']

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <FiLoader className="animate-spin text-primary" size={12} />
      <span className="text-xs text-muted-foreground">Agents processing</span>
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  )
}

function PipelineStepper({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 my-2">
      <p className="text-xs font-medium text-muted-foreground mb-3">Pipeline Status</p>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs
              ${step.status === 'done' ? 'bg-emerald-500 text-white' :
                step.status === 'active' ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'}`}>
              {step.status === 'done' ? (
                <FiCheck size={12} />
              ) : step.status === 'active' ? (
                <FiLoader className="animate-spin" size={12} />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span className={`text-xs ${
              step.status === 'done' ? 'text-emerald-600 dark:text-emerald-400 line-through' :
              step.status === 'active' ? 'text-primary font-medium' :
              'text-muted-foreground'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultCard({ data }: { data: Record<string, any> }) {
  const severityColor = data.severity === 'P1' ? 'bg-red-600' : data.severity === 'P2' ? 'bg-amber-500' : 'bg-emerald-500'
  const slaDeadline = data.sla_hours ? new Date(Date.now() + data.sla_hours * 3600000).toLocaleString() : null

  return (
    <div className="bg-card border border-border rounded-lg p-4 my-2 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm font-bold text-foreground">{data.complaint_id}</span>
        <Badge className={`${severityColor} text-white text-[10px]`}>{data.severity}</Badge>
        {data.issue_type && <Badge variant="secondary" className="text-[10px]">{data.issue_type}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {data.department_assigned && (
          <div className="flex items-center gap-1">
            <FiAlertTriangle size={10} />
            <span>{data.department_assigned}</span>
          </div>
        )}
        {data.area_name && (
          <div className="flex items-center gap-1">
            <FiMapPin size={10} />
            <span>{data.area_name}</span>
          </div>
        )}
        {data.ward_number != null && data.ward_number !== 0 && (
          <div className="flex items-center gap-1">
            <FiMapPin size={10} />
            <span>Ward {data.ward_number}</span>
          </div>
        )}
        {slaDeadline && (
          <div className="flex items-center gap-1">
            <FiClock size={10} />
            <span>By {slaDeadline}</span>
          </div>
        )}
      </div>

      {data.complaint_id && (
        <a href={`/track?id=${data.complaint_id}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <span>Track at /track?id={data.complaint_id}</span>
          <FiExternalLink size={10} />
        </a>
      )}

      {data.severity === 'P1' && data.tweet_url && (
        <a href={data.tweet_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-red-500 hover:underline">
          <span>Tweeted publicly for accountability</span>
          <FiExternalLink size={10} />
        </a>
      )}

      {data.severity === 'P1' && !data.tweet_url && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <FiLoader className="animate-spin" size={10} />
          <span>Tweeting for accountability...</span>
        </p>
      )}
    </div>
  )
}

function detectIntent(input: string): 'greeting' | 'capability' | 'agent' {
  const lower = input.toLowerCase().trim()
  if (GREETING_KEYWORDS.includes(lower)) return 'greeting'
  if (CAPABILITY_KEYWORDS.some(k => lower.includes(k))) return 'capability'
  return 'agent'
}

export default function WebChatPortal({ showSample }: WebChatPortalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lang, setLang] = useState<'en' | 'hi'>('en')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationDenied, setLocationDenied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const displayMessages = showSample ? EXAMPLE_MESSAGES : messages

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [displayMessages])

  // --- LOCATION ---
  const captureLocation = useCallback(async () => {
    if (location) return // already captured
    setLocationLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      })
      const { latitude, longitude } = pos.coords
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'User-Agent': 'JanSevaAI/1.0' } }
        )
        const geo = await res.json()
        const area = geo.address?.suburb || geo.address?.neighbourhood || geo.address?.city_district || geo.display_name?.split(',')[0] || 'Unknown area'
        setLocation({ lat: latitude, lng: longitude, area })
      } catch {
        setLocation({ lat: latitude, lng: longitude, area: 'Location captured' })
      }
    } catch {
      setLocationDenied(true)
      setLocation({ ...DEFAULT_LOCATION })
    }
    setLocationLoading(false)
  }, [location])

  const addSystemMessage = (text: string, data?: Record<string, any>) => {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random()}`,
      role: 'system',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      data,
    }
    setMessages(prev => [...prev, msg])
  }

  // Save complaint to database
  const saveComplaintToDB = async (
    complaintPayload: Record<string, any>
  ): Promise<boolean> => {
    console.log('[JanSeva] Saving complaint to DB:', complaintPayload)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complaintPayload),
      })
      const result = await res.json()
      console.log('[JanSeva] Save result:', result)
      if (!result.success) {
        console.error('[JanSeva] Save failed with response:', result)
        return false
      }
      return true
    } catch (e) {
      console.error('[JanSeva] Save failed:', e)
      return false
    }
  }

  // Post P1 tweet via SocialAmplifierAgent
  const postP1Tweet = async (complaintData: Record<string, any>): Promise<string | null> => {
    try {
      console.log('[JanSeva] Posting P1 tweet for:', complaintData.complaint_id)
      const tweetPrompt = `Post an alert tweet for complaint ${complaintData.complaint_id}: ${complaintData.issue_type} at ${complaintData.area_name}, Ward ${complaintData.ward_number}. Severity P1. SLA ${complaintData.sla_hours} hours. Assigned to ${complaintData.department_assigned}.`
      const result = await callAIAgent(tweetPrompt, SOCIAL_AMPLIFIER_AGENT_ID)
      const tweetUrl = result?.response?.result?.tweet_url || result?.response?.result?.url || result?.response?.message || null
      console.log('[JanSeva] Tweet result:', tweetUrl)

      if (tweetUrl && typeof tweetUrl === 'string' && tweetUrl.startsWith('http')) {
        // Save tweet_url back to complaint
        try {
          await fetch(`/api/complaints/${complaintData.complaint_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tweet_url: tweetUrl }),
          })
          console.log('[JanSeva] Tweet URL saved to complaint')
        } catch (e) {
          console.error('[JanSeva] Failed to save tweet_url:', e)
        }
        return tweetUrl
      }
      return null
    } catch (e) {
      console.error('[JanSeva] Tweet posting failed:', e)
      return null
    }
  }

  // Animate pipeline steps
  const runPipelineAnimation = (pipelineId: string, onComplete: () => void) => {
    const delays = [0, 1500, 3000, 4500, 6000]

    delays.forEach((delay, stepIndex) => {
      setTimeout(() => {
        setMessages(prev => prev.map(msg => {
          if (msg.id !== pipelineId || !msg.pipelineSteps) return msg
          const newSteps = msg.pipelineSteps.map((s, i) => ({
            ...s,
            status: i < stepIndex ? 'done' as const :
                    i === stepIndex ? 'active' as const : 'pending' as const,
          }))
          return { ...msg, pipelineSteps: newSteps }
        }))

        // Mark last step as done after a moment
        if (stepIndex === delays.length - 1) {
          setTimeout(() => {
            setMessages(prev => prev.map(msg => {
              if (msg.id !== pipelineId || !msg.pipelineSteps) return msg
              return {
                ...msg,
                pipelineSteps: msg.pipelineSteps.map(s => ({ ...s, status: 'done' as const })),
              }
            }))
            onComplete()
          }, 800)
        }
      }, delay)
    })
  }

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'citizen',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    const currentInput = inputText.trim()
    setInputText('')

    // --- STATUS QUERY (direct DB lookup, no agent) ---
    const statusMatch = currentInput.match(/^status\s+(.+)/i)
    if (statusMatch) {
      const complaintId = statusMatch[1].trim().toUpperCase()
      setIsLoading(true)
      try {
        const res = await fetch(`/api/complaints?complaint_id=${encodeURIComponent(complaintId)}`)
        const json = await res.json()
        const c = json.data?.[0]
        if (c) {
          const slaDeadline = c.sla_deadline ? new Date(c.sla_deadline) : null
          let slaCountdown = 'N/A'
          if (slaDeadline) {
            const diff = slaDeadline.getTime() - Date.now()
            if (diff <= 0) slaCountdown = 'BREACHED'
            else {
              const h = Math.floor(diff / 3600000)
              const m = Math.floor((diff % 3600000) / 60000)
              slaCountdown = `${h}h ${m}m remaining`
            }
          }
          addSystemMessage(
            `Complaint: ${c.complaint_id}\nCategory: ${c.issue_type || 'N/A'} | Severity: ${c.severity || 'N/A'}\nLocation: ${c.area_name || 'N/A'}, Ward ${c.ward_number || 'N/A'}\nStatus: ${c.status || 'N/A'}\nDepartment: ${c.department_assigned || 'N/A'}\nSLA: ${slaCountdown}\nTrack: /track?id=${c.complaint_id}`,
            { complaint_id: c.complaint_id, severity: c.severity, issue_type: c.issue_type, status: c.status, department_assigned: c.department_assigned, area_name: c.area_name, ward_number: c.ward_number, sla_hours: c.sla_hours }
          )
        } else {
          addSystemMessage(`Complaint ${complaintId} not found. Check the ID and try again.`)
        }
      } catch {
        addSystemMessage('Failed to look up complaint. Please try again.')
      }
      setIsLoading(false)
      return
    }

    const intent = detectIntent(currentInput)

    if (intent === 'greeting') {
      addSystemMessage(WELCOME_MESSAGE)
      return
    }
    if (intent === 'capability') {
      addSystemMessage(CAPABILITY_MESSAGE)
      return
    }

    setIsLoading(true)

    // Determine location to send
    const loc = location || DEFAULT_LOCATION
    const messageWithLocation = `${currentInput} | Location: lat=${loc.lat}, lng=${loc.lng}, area=${loc.area}`

    try {
      const result = await callAIAgent(messageWithLocation, MANAGER_AGENT_ID)
      let agentData = result?.response?.result

      // Try to extract complaint_data from raw_response
      if (result?.raw_response) {
        try {
          const outer = JSON.parse(result.raw_response)
          const inner = typeof outer?.response === 'string'
            ? JSON.parse(outer.response)
            : outer?.response
          if (inner?.complaint_data) {
            agentData = { ...inner.complaint_data, message: inner.message, is_complaint: inner.is_complaint, intent_detected: inner.intent_detected }
          }
        } catch {}
      }

      const isComplaint = agentData?.is_complaint === true
      const detectedIntent = agentData?.intent_detected ?? 'unknown'
      const complaintData = agentData?.complaint_data || (agentData?.complaint_id ? agentData : null)

      if (isComplaint || detectedIntent === 'complaint' || complaintData) {
        // --- COMPLAINT FLOW ---
        const area = complaintData?.location ?? complaintData?.ward ?? loc.area
        const ward = complaintData?.ward_number ?? complaintData?.ward ?? 83
        const issueType = complaintData?.issue_type ?? 'GENERAL'
        const severity = complaintData?.severity ?? 'P2'
        const dept = complaintData?.department ?? complaintData?.department_assigned ?? 'Pending'
        const slaH = complaintData?.sla_hours ?? (severity === 'P1' ? 4 : severity === 'P2' ? 24 : 72)
        const cid = complaintData?.complaint_id ?? `JSV-${Date.now().toString().slice(-4).padStart(4, '0')}`

        // Show pipeline stepper
        const pipelineId = `pipeline-${Date.now()}`
        const pipelineMsg: ChatMessage = {
          id: pipelineId,
          role: 'system',
          text: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isPipeline: true,
          pipelineSteps: PIPELINE_STEPS_TEMPLATE.map(s => ({ ...s })),
        }
        setMessages(prev => [...prev, pipelineMsg])

        // Build complaint payload for DB
        const complaintPayload = {
          complaint_id: cid,
          description: currentInput,
          photo_url: '',
          lat: loc.lat,
          lng: loc.lng,
          area_name: area,
          ward_number: typeof ward === 'number' ? ward : parseInt(ward) || 83,
          ward_name: '',
          zone: '',
          issue_type: issueType,
          severity,
          status: 'received',
          department_assigned: dept,
          sla_deadline: new Date(Date.now() + slaH * 3600000).toISOString(),
          sla_hours: slaH,
          hotspot: complaintData?.hotspot ?? false,
          tweet_url: '',
          telegram_chat_id: '',
          created_at: new Date().toISOString(),
        }

        // Save to DB immediately
        const saved = await saveComplaintToDB(complaintPayload)
        console.log('[JanSeva] Complaint saved:', saved, cid)

        // Run pipeline animation, then show result card
        runPipelineAnimation(pipelineId, async () => {
          // Remove pipeline message, add result card
          const cardData: Record<string, any> = {
            complaint_id: cid,
            severity,
            issue_type: issueType,
            area_name: area,
            ward_number: ward,
            department_assigned: dept,
            sla_hours: slaH,
            status: 'dispatched',
            hotspot: complaintData?.hotspot ?? false,
            tweet_url: '',
          }

          setMessages(prev => [
            ...prev.filter(m => m.id !== pipelineId),
            {
              id: `result-${Date.now()}`,
              role: 'system',
              text: '',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isResultCard: true,
              data: cardData,
            }
          ])
          setIsLoading(false)

          // If P1, post tweet
          if (severity === 'P1') {
            const tweetUrl = await postP1Tweet(complaintPayload)
            if (tweetUrl) {
              setMessages(prev => prev.map(m => {
                if (m.isResultCard && m.data?.complaint_id === cid) {
                  return { ...m, data: { ...m.data, tweet_url: tweetUrl } }
                }
                return m
              }))
            }
          }
        })
      } else {
        // --- CONVERSATIONAL ---
        const responseText = agentData?.message ?? result?.response?.message ?? 'I\'m here to help! You can report a civic issue, check complaint status, or ask about civic services in Bengaluru.'

        if (detectedIntent === 'status_query' && agentData && typeof agentData === 'object') {
          addSystemMessage(responseText, agentData.complaint_data ? {
            complaint_id: agentData.complaint_data.complaint_id,
            severity: agentData.complaint_data.severity,
            issue_type: agentData.complaint_data.issue_type,
            status: agentData.complaint_data.status,
            department_assigned: agentData.complaint_data.department,
            sla_hours: agentData.complaint_data.sla_hours,
            area_name: agentData.complaint_data.location,
          } : undefined)
        } else {
          // Even if not flagged as complaint, attempt to save if response looks like one
          if (agentData && (agentData.complaint_id || agentData.complaint_data?.complaint_id)) {
            const cd = agentData.complaint_data || agentData
            const fallbackCid = cd.complaint_id ?? `JSV-${Date.now().toString().slice(-4).padStart(4, '0')}`
            await saveComplaintToDB({
              complaint_id: fallbackCid,
              description: currentInput,
              photo_url: '',
              lat: loc.lat,
              lng: loc.lng,
              area_name: cd.location ?? cd.area_name ?? loc.area,
              ward_number: cd.ward_number ?? cd.ward ?? 83,
              ward_name: '',
              zone: '',
              issue_type: cd.issue_type ?? 'GENERAL',
              severity: cd.severity ?? 'P2',
              status: 'received',
              department_assigned: cd.department ?? cd.department_assigned ?? 'Pending',
              sla_deadline: new Date(Date.now() + (cd.sla_hours ?? 24) * 3600000).toISOString(),
              sla_hours: cd.sla_hours ?? 24,
              hotspot: false,
              tweet_url: '',
              telegram_chat_id: '',
              created_at: new Date().toISOString(),
            })
          }
          addSystemMessage(responseText)
        }
        setIsLoading(false)
      }
    } catch (e) {
      console.error('[JanSeva] Agent call failed:', e)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'system',
        text: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      setIsLoading(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'citizen',
      text: `[Photo uploaded: ${file.name}]`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])

    const loc = location || DEFAULT_LOCATION

    try {
      const uploadResult = await uploadFiles(file)
      if (uploadResult.success && uploadResult.asset_ids.length > 0) {
        const messageWithLocation = `New complaint with photo. Please verify and process. | Location: lat=${loc.lat}, lng=${loc.lng}, area=${loc.area}`
        const result = await callAIAgent(
          messageWithLocation,
          MANAGER_AGENT_ID,
          { assets: uploadResult.asset_ids }
        )
        let agentData = result?.response?.result

        // Try to extract complaint_data from raw_response
        if (result?.raw_response) {
          try {
            const outer = JSON.parse(result.raw_response)
            const inner = typeof outer?.response === 'string'
              ? JSON.parse(outer.response)
              : outer?.response
            if (inner?.complaint_data) {
              agentData = { ...inner.complaint_data, message: inner.message, is_complaint: inner.is_complaint, intent_detected: inner.intent_detected }
            }
          } catch {}
        }

        // Extract complaint data
        const complaintData = agentData?.complaint_data || (agentData?.complaint_id ? agentData : null) || agentData
        const cid = complaintData?.complaint_id ?? `JSV-${Date.now().toString().slice(-4).padStart(4, '0')}`
        const issueType = complaintData?.issue_type ?? 'GENERAL'
        const severity = complaintData?.severity ?? 'P2'
        const dept = complaintData?.department ?? complaintData?.department_assigned ?? 'Pending'
        const area = complaintData?.location ?? complaintData?.area_name ?? loc.area
        const ward = complaintData?.ward_number ?? complaintData?.ward ?? 83
        const slaH = complaintData?.sla_hours ?? (severity === 'P1' ? 4 : severity === 'P2' ? 24 : 72)

        // Show pipeline stepper
        const pipelineId = `pipeline-${Date.now()}`
        const pipelineMsg: ChatMessage = {
          id: pipelineId,
          role: 'system',
          text: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isPipeline: true,
          pipelineSteps: PIPELINE_STEPS_TEMPLATE.map(s => ({ ...s })),
        }
        setMessages(prev => [...prev, pipelineMsg])

        const complaintPayload = {
          complaint_id: cid,
          description: `Photo complaint: ${file.name}`,
          photo_url: uploadResult.asset_ids[0] ?? '',
          lat: loc.lat,
          lng: loc.lng,
          area_name: area,
          ward_number: typeof ward === 'number' ? ward : parseInt(ward) || 83,
          ward_name: '',
          zone: complaintData?.zone ?? '',
          issue_type: issueType,
          severity,
          status: 'received',
          department_assigned: dept,
          sla_deadline: new Date(Date.now() + slaH * 3600000).toISOString(),
          sla_hours: slaH,
          hotspot: complaintData?.hotspot ?? false,
          tweet_url: '',
          telegram_chat_id: '',
          created_at: new Date().toISOString(),
        }

        // Save to DB
        console.log('[JanSeva] Saving photo complaint to DB:', complaintPayload)
        await saveComplaintToDB(complaintPayload)

        // Run pipeline animation, then show result card
        runPipelineAnimation(pipelineId, async () => {
          const cardData: Record<string, any> = {
            complaint_id: cid,
            severity,
            issue_type: issueType,
            area_name: area,
            ward_number: ward,
            department_assigned: dept,
            sla_hours: slaH,
            status: 'dispatched',
            hotspot: complaintData?.hotspot ?? false,
            tweet_url: '',
          }

          setMessages(prev => [
            ...prev.filter(m => m.id !== pipelineId),
            {
              id: `result-${Date.now()}`,
              role: 'system',
              text: '',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isResultCard: true,
              data: cardData,
            }
          ])
          setIsLoading(false)

          // If P1, post tweet
          if (severity === 'P1') {
            const tweetUrl = await postP1Tweet(complaintPayload)
            if (tweetUrl) {
              setMessages(prev => prev.map(m => {
                if (m.isResultCard && m.data?.complaint_id === cid) {
                  return { ...m, data: { ...m.data, tweet_url: tweetUrl } }
                }
                return m
              }))
            }
          }
        })
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'system',
          text: 'Failed to upload photo. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }])
        setIsLoading(false)
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'system',
        text: 'Failed to upload photo. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      setIsLoading(false)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function renderComplaintCard(data: Record<string, any>) {
    return (
      <div className="mt-2 space-y-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {data.complaint_id && (
            <Badge variant="outline" className="font-mono text-xs border-white/30 text-white/90">{data.complaint_id}</Badge>
          )}
          {data.severity && (
            <Badge className={data.severity === 'P1' ? 'bg-red-600 text-white' : data.severity === 'P2' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}>
              {data.severity}
            </Badge>
          )}
          {data.issue_type && <Badge variant="secondary" className="text-xs">{data.issue_type}</Badge>}
        </div>
        {data.area_name && <p className="opacity-80">Location: {data.area_name}{data.ward_number ? ` (Ward ${data.ward_number})` : ''}</p>}
        {data.department_assigned && <p className="opacity-80">Dept: {data.department_assigned}</p>}
        {data.sla_hours != null && <p className="opacity-80">SLA: {data.sla_hours}h</p>}
        {data.hotspot && <Badge className="bg-red-600 text-white text-xs">HOTSPOT</Badge>}
        {data.tweet_url && (
          <a href={data.tweet_url} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline text-xs block">View Tweet</a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FiAlertTriangle className="text-primary" size={16} />
          <h2 className="font-semibold text-foreground text-base">
            {lang === 'en' ? 'JanSeva AI Assistant' : 'JanSeva AI Sahayak'}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')} className="text-xs text-muted-foreground">
          {lang === 'en' ? 'HI' : 'EN'}
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {displayMessages.length === 0 && (
          <div className="text-center py-12">
            <FiAlertTriangle className="mx-auto mb-3 text-muted-foreground" size={32} />
            <p className="text-muted-foreground text-sm">
              {lang === 'en'
                ? 'Say hi, ask a question, or report a civic issue!'
                : 'Namaste bolein, sawal puchein, ya shikayat darj karein!'}
            </p>
            <div className="mt-4 text-left max-w-xs mx-auto space-y-1 text-xs text-muted-foreground">
              <p>Try typing:</p>
              <p className="font-mono text-foreground/70">hello</p>
              <p className="font-mono text-foreground/70">what can you do?</p>
              <p className="font-mono text-foreground/70">status JSV-XXXX</p>
              <p className="font-mono text-foreground/70">escalate JSV-XXXX</p>
              <p className="font-mono text-foreground/70">who handles water supply?</p>
              <p className="font-mono text-foreground/70">what is BBMP?</p>
            </div>
          </div>
        )}
        {displayMessages.map(msg => {
          // Pipeline stepper
          if (msg.isPipeline && msg.pipelineSteps) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%]">
                  <PipelineStepper steps={msg.pipelineSteps} />
                </div>
              </div>
            )
          }
          // Result card (replaces pipeline after completion)
          if (msg.isResultCard && msg.data) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%]">
                  <ResultCard data={msg.data} />
                </div>
              </div>
            )
          }
          if (msg.stepType) return null // Old step bubbles no longer used
          return (
            <div key={msg.id} className={`flex ${msg.role === 'citizen' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 ${msg.role === 'citizen' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                {msg.isLoading ? (
                  <TypingIndicator />
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-line">{msg.text}</p>
                    {msg.data && renderComplaintCard(msg.data)}
                  </>
                )}
                {msg.timestamp && <p className="text-[10px] mt-1 opacity-60">{msg.timestamp}</p>}
              </div>
            </div>
          )
        })}
        {isLoading && !displayMessages.some(m => m.isLoading) && (
          <div className="flex justify-end">
            <div className="bg-primary/10 rounded-lg">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      {/* Location badge above input */}
      {location && (
        <div className="px-3 pt-2">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
            locationDenied
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
          }`}>
            <FiMapPin size={10} />
            <span>
              {locationDenied
                ? `Using default: ${location.area}`
                : `Location: ${location.area}`}
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="text-accent hover:bg-accent/10 p-2 h-10 w-10"
          >
            <FiCamera size={22} />
          </Button>
          {/* Location button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={captureLocation}
            disabled={isLoading || locationLoading}
            className={`p-2 h-10 w-10 ${
              location && !locationDenied
                ? 'text-emerald-500 hover:bg-emerald-500/10'
                : location && locationDenied
                ? 'text-amber-500 hover:bg-amber-500/10'
                : 'text-muted-foreground hover:bg-accent/10'
            }`}
            title={location ? `Location: ${location.area}` : 'Add Location'}
          >
            {locationLoading ? (
              <FiLoader className="animate-spin" size={20} />
            ) : (
              <MdMyLocation size={22} />
            )}
          </Button>
          <Input
            placeholder={lang === 'en' ? 'Say hi, ask a question, or report an issue...' : 'Namaste bolein ya sawal puchein...'}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            className="flex-1 bg-input border-border text-foreground"
          />
          <Button size="sm" onClick={handleSend} disabled={isLoading || !inputText.trim()} className="bg-primary text-primary-foreground p-2 h-10 w-10">
            {isLoading ? <FiLoader className="animate-spin" size={18} /> : <FiSend size={18} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
