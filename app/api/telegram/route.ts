import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MANAGER_AGENT_ID = '69ec63cb14ac76855da37886'
const LYZR_CHAT_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/'

function getBotToken() { return process.env.TELEGRAM_BOT_TOKEN ?? '' }
function getApiKey() { return process.env.LYZR_API_KEY ?? '' }
function getAppUrl(req?: Request) {
  if (req) {
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || ''
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    if (host) return `${proto}://${host}`
  }
  return 'https://civic-pulse-awesome-space-k5yz.architect.space'
}

async function sendTelegram(chatId: number, text: string) {
  const token = getBotToken()
  if (!token) { console.error('[TG] BOT_TOKEN not set, cannot send'); return }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })
    if (!res.ok) {
      console.error('[TG] sendMessage failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('[TG] sendMessage error:', e)
  }
}

async function callAgent(message: string, agentId: string, userId: string, sessionId: string) {
  const LYZR_API_KEY = getApiKey()
  if (!LYZR_API_KEY) {
    console.error('[TG] LYZR_API_KEY is not set')
    return null
  }
  try {
    const res = await fetch(LYZR_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY
      },
      body: JSON.stringify({
        message,
        agent_id: agentId,
        user_id: userId,
        session_id: sessionId
      })
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[TG] Agent call failed:', res.status, errText)
      return null
    }
    const data = await res.json()
    console.log('[TG] Agent response:', JSON.stringify(data).slice(0, 500))
    return data
  } catch (e) {
    console.error('[TG] Agent call error:', e)
    return null
  }
}

function extractAgentResponse(data: any): string {
  if (!data) return ''
  // v3 API: response is typically at data.response
  if (typeof data.response === 'string') return data.response
  if (typeof data.response?.result === 'string') return data.response.result
  if (typeof data.response?.message === 'string') return data.response.message
  if (typeof data.message === 'string') return data.message
  return JSON.stringify(data.response ?? data)
}

function extractComplaintData(data: any): Record<string, any> {
  const responseText = extractAgentResponse(data)
  // Try parsing the response text as JSON
  try {
    const parsed = JSON.parse(responseText)
    return parsed?.complaint_data ?? parsed ?? {}
  } catch {
    // Not JSON - try extracting JSON from within the text
    const jsonMatch = responseText.match(/\{[\s\S]*"complaint_id"[\s\S]*\}/)
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]) } catch {}
    }
  }
  return {}
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'telegram webhook active' })
}

export async function POST(req: NextRequest) {
  const APP_URL = getAppUrl(req)
  try {
    const body = await req.json()
    const message = body?.message
    if (!message) return NextResponse.json({ ok: true })

    const chatId: number = message?.chat?.id
    const text: string = (message?.text ?? '').trim()
    const textLower = text.toLowerCase()
    const hasPhoto = !!(message?.photo?.length)

    if (!chatId) return NextResponse.json({ ok: true })

    // Stable session per telegram chat
    const userId = `tg-${chatId}`
    const sessionId = `${MANAGER_AGENT_ID}-tg-${chatId}`

    // GREETING
    if (/^(\/start|hi|hello|hey|namaste)/i.test(textLower)) {
      await sendTelegram(chatId,
        'Welcome to JanSeva AI - Bengaluru\'s Autonomous Civic Platform!\n\n' +
        'I can help you:\n' +
        '- Report a civic issue: send a photo + description\n' +
        '- Track complaint: type "status JSV-XXXX"\n' +
        '- Escalate: type "escalate JSV-XXXX"\n' +
        '- Ask anything about civic services\n\n' +
        'Send a photo of the issue to get started!'
      )
      return NextResponse.json({ ok: true })
    }

    // HELP
    if (/what can you do|how does this work|\/help|features/i.test(textLower)) {
      await sendTelegram(chatId,
        'I can:\n' +
        '- Register civic complaints (potholes, leaks, outages, garbage)\n' +
        '- Auto-route to BBMP, BWSSB, BESCOM departments\n' +
        '- Track complaints with SLA timers\n' +
        '- Tweet P1 issues publicly for accountability\n' +
        '- Alert you when resolved\n\n' +
        'Just send a photo of the issue!'
      )
      return NextResponse.json({ ok: true })
    }

    // STATUS QUERY
    if (/^status\s+/i.test(text)) {
      const complaintId = text.replace(/^status\s+/i, '').trim().toUpperCase()
      try {
        const res = await fetch(`${APP_URL}/api/complaints?complaint_id=${complaintId}`)
        const json = await res.json()
        const c = json?.data?.[0]
        if (c) {
          const slaDate = c.sla_deadline ? new Date(c.sla_deadline) : null
          const diff = slaDate ? slaDate.getTime() - Date.now() : 0
          const slaText = diff <= 0 ? 'BREACHED' : `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m remaining`
          await sendTelegram(chatId,
            `<b>${c.complaint_id}</b>\n` +
            `Category: ${c.issue_type} | Severity: ${c.severity}\n` +
            `Location: ${c.area_name}, Ward ${c.ward_number}\n` +
            `Status: ${c.status}\n` +
            `Department: ${c.department_assigned}\n` +
            `SLA: ${slaText}\n` +
            `Track: ${APP_URL}/track?id=${c.complaint_id}`
          )
        } else {
          await sendTelegram(chatId, `Complaint ${complaintId} not found. Check the ID and try again.`)
        }
      } catch (e) {
        console.error('[TG] Status query error:', e)
        await sendTelegram(chatId, 'Could not fetch status. Try again.')
      }
      return NextResponse.json({ ok: true })
    }

    // COMPLAINT - has civic keywords or photo
    const civicKeywords = /pothole|water|power|garbage|leak|broken|road|light|drain|flood|sewage|crack|blocked|dirty|repair|damage|outage|supply|complaint|issue|problem/i
    if (hasPhoto || civicKeywords.test(text)) {
      await sendTelegram(chatId, 'Received your complaint. Processing now...')
      try {
        const agentMessage = hasPhoto
          ? `Civic complaint reported via Telegram with photo. Description: ${text || 'Photo attached'}`
          : `Civic complaint reported via Telegram: ${text}`

        const agentRes = await callAgent(agentMessage, MANAGER_AGENT_ID, userId, sessionId)

        // Extract complaint data from agent response
        const cd = extractComplaintData(agentRes)
        const responseText = extractAgentResponse(agentRes)

        const cid = cd?.complaint_id ?? `JSV-${Date.now().toString().slice(-4)}`
        const severity = cd?.severity ?? 'P2'
        const dept = cd?.department_assigned ?? 'BBMP'
        const slaH = cd?.sla_hours ?? 24
        const area = cd?.area_name ?? 'Bengaluru'
        const ward = cd?.ward_number ?? 0
        const issueType = cd?.issue_type ?? 'GENERAL'

        // Save to DB
        try {
          await fetch(`${APP_URL}/api/complaints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              complaint_id: cid,
              description: text || 'Photo complaint via Telegram',
              lat: cd?.lat ?? 12.9716,
              lng: cd?.lng ?? 77.5946,
              area_name: area,
              ward_number: ward,
              issue_type: issueType,
              severity,
              status: 'dispatched',
              department_assigned: dept,
              sla_hours: slaH,
              sla_deadline: new Date(Date.now() + slaH * 3600000).toISOString(),
              telegram_chat_id: String(chatId),
              created_at: new Date().toISOString()
            })
          })
        } catch (dbErr) {
          console.error('[TG] Failed to save complaint to DB:', dbErr)
        }

        // If agent returned a meaningful text response, send it
        if (responseText && responseText.length > 10 && !responseText.startsWith('{')) {
          await sendTelegram(chatId, responseText.slice(0, 4000))
        } else {
          await sendTelegram(chatId,
            `Complaint Registered!\n\n` +
            `ID: ${cid}\n` +
            `Ward ${ward}, ${area}\n` +
            `Classified: ${severity} ${issueType}\n` +
            `Dispatched to ${dept}. SLA: ${slaH} hours.\n` +
            `Track: ${APP_URL}/track?id=${cid}`
          )
        }
      } catch (e) {
        console.error('[TG] Complaint processing error:', e)
        await sendTelegram(chatId, 'Complaint received. We will process it shortly.')
      }
      return NextResponse.json({ ok: true })
    }

    // GENERAL QUERY - send to agent for any other text
    if (text.length > 0) {
      try {
        const agentRes = await callAgent(text, MANAGER_AGENT_ID, userId, sessionId)
        const responseText = extractAgentResponse(agentRes)
        if (responseText && responseText.length > 0) {
          await sendTelegram(chatId, responseText.slice(0, 4000))
        } else {
          await sendTelegram(chatId,
            'I\'m not sure what you mean. Try:\n' +
            '- Send a photo of a civic issue\n' +
            '- Type "status JSV-XXXX" to track\n' +
            '- Type "help" to see what I can do'
          )
        }
      } catch {
        await sendTelegram(chatId,
          'I\'m not sure what you mean. Try:\n' +
          '- Send a photo of a civic issue\n' +
          '- Type "status JSV-XXXX" to track\n' +
          '- Type "help" to see what I can do'
        )
      }
      return NextResponse.json({ ok: true })
    }

    // DEFAULT
    await sendTelegram(chatId,
      'I\'m not sure what you mean. Try:\n' +
      '- Send a photo of a civic issue\n' +
      '- Type "status JSV-XXXX" to track\n' +
      '- Type "help" to see what I can do'
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[TG] Webhook error:', e)
    return NextResponse.json({ ok: true })
  }
}
