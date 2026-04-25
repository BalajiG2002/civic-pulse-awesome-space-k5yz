import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

const ENV_PATH = path.join(process.cwd(), '.env.local')
const WEBHOOK_PATH = '/api/telegram'

async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(ENV_PATH, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1)
      }
    }
    return env
  } catch {
    return {}
  }
}

async function writeEnvVar(key: string, value: string) {
  let content = ''
  try {
    content = await fs.readFile(ENV_PATH, 'utf-8')
  } catch {
    content = ''
  }
  const lines = content.split('\n')
  let found = false
  const updated = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      found = true
      return `${key}=${value}`
    }
    return line
  })
  if (!found) updated.push(`${key}=${value}`)
  await fs.writeFile(ENV_PATH, updated.join('\n'))
}

// GET - check webhook status
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? ''

  if (!token) {
    return NextResponse.json({
      configured: false,
      message: 'TELEGRAM_BOT_TOKEN is not set. Use POST to configure it.'
    })
  }

  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const infoData = await infoRes.json()
    const result = infoData?.result ?? {}

    return NextResponse.json({
      configured: true,
      webhook_url: result.url || 'none',
      pending_updates: result.pending_update_count ?? 0,
      last_error: result.last_error_message || 'none',
      last_error_date: result.last_error_date ? new Date(result.last_error_date * 1000).toISOString() : null
    })
  } catch (e: any) {
    return NextResponse.json({ configured: true, error: e?.message || 'Failed to check webhook' }, { status: 500 })
  }
}

// POST - set bot token and register webhook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bot_token } = body

    if (!bot_token || typeof bot_token !== 'string' || bot_token.length < 10) {
      return NextResponse.json({ error: 'Invalid bot_token provided' }, { status: 400 })
    }

    // Validate the token by calling getMe
    const meRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`)
    const meData = await meRes.json()
    if (!meData?.ok) {
      return NextResponse.json({
        error: 'Invalid bot token. Telegram rejected it.',
        details: meData?.description || 'Unknown error'
      }, { status: 400 })
    }

    const botInfo = meData.result

    // Build the webhook URL from request host
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || ''
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    let webhookUrl = ''
    if (host) {
      webhookUrl = `${proto}://${host}${WEBHOOK_PATH}`
    } else {
      // Fallback: read APP_URL from env
      const envVars = await readEnvFile()
      const appUrl = envVars['APP_URL'] || envVars['NEXT_PUBLIC_APP_URL'] || ''
      webhookUrl = appUrl ? `${appUrl}${WEBHOOK_PATH}` : ''
    }

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Could not determine webhook URL' }, { status: 500 })
    }

    // Set the webhook
    const setRes = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
        drop_pending_updates: true
      })
    })
    const setData = await setRes.json()

    if (!setData?.ok) {
      return NextResponse.json({
        error: 'Failed to set webhook',
        details: setData?.description || 'Unknown error'
      }, { status: 500 })
    }

    // Save token to env
    await writeEnvVar('TELEGRAM_BOT_TOKEN', bot_token)

    // Update process.env for current runtime
    process.env.TELEGRAM_BOT_TOKEN = bot_token

    return NextResponse.json({
      success: true,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        first_name: botInfo.first_name
      },
      webhook_url: webhookUrl,
      message: `Bot @${botInfo.username} connected and webhook registered.`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Setup failed' }, { status: 500 })
  }
}
