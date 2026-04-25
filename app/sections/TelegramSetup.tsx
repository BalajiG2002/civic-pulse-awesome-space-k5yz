'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { FiSend, FiCheck, FiAlertCircle, FiRefreshCw, FiLink, FiInfo } from 'react-icons/fi'

interface BotInfo {
  id: number
  username: string
  first_name: string
}

interface WebhookStatus {
  configured: boolean
  webhook_url?: string
  pending_updates?: number
  last_error?: string
  last_error_date?: string | null
  message?: string
  error?: string
}

export default function TelegramSetup() {
  const [botToken, setBotToken] = useState('')
  const [status, setStatus] = useState<WebhookStatus | null>(null)
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [resultMessage, setResultMessage] = useState('')
  const [resultError, setResultError] = useState('')

  const checkStatus = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/telegram/setup')
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { checkStatus() }, [checkStatus])

  const handleSetup = async () => {
    if (!botToken.trim()) return
    setLoading(true)
    setResultMessage('')
    setResultError('')
    try {
      const res = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setBotInfo(data.bot)
        setResultMessage(data.message)
        setBotToken('')
        await checkStatus()
      } else {
        setResultError(data.error || 'Setup failed')
      }
    } catch (e: any) {
      setResultError(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const isConnected = status?.configured && status?.webhook_url && status.webhook_url !== 'none'

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FiSend className="w-5 h-5" />
            Telegram Bot Status
          </h3>
          <button
            onClick={checkStatus}
            disabled={checking}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {checking ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <FiRefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Checking status...</span>
          </div>
        ) : isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-muted-foreground text-xs block mb-1">Webhook URL</span>
                <span className="text-foreground font-mono text-xs break-all">{status?.webhook_url}</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-muted-foreground text-xs block mb-1">Pending Updates</span>
                <span className="text-foreground font-medium">{status?.pending_updates ?? 0}</span>
              </div>
              {status?.last_error && status.last_error !== 'none' && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 col-span-full">
                  <span className="text-red-600 dark:text-red-400 text-xs block mb-1">Last Error</span>
                  <span className="text-red-700 dark:text-red-300 text-sm">{status.last_error}</span>
                  {status.last_error_date && (
                    <span className="text-red-500 text-xs block mt-1">
                      {new Date(status.last_error_date).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
            {botInfo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <FiCheck className="w-4 h-4 text-emerald-500" />
                Bot: @{botInfo.username} ({botInfo.first_name})
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-sm text-amber-600 dark:text-amber-400">Not configured</span>
          </div>
        )}
      </div>

      {/* Setup Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <FiLink className="w-5 h-5" />
          {isConnected ? 'Reconfigure Bot' : 'Connect Telegram Bot'}
        </h3>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 mb-4">
          <div className="flex gap-2">
            <FiInfo className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">How to get your Bot Token:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
                <li>Open Telegram and message <span className="font-mono font-medium">@BotFather</span></li>
                <li>Send <span className="font-mono font-medium">/newbot</span> and follow the prompts</li>
                <li>Copy the API token provided</li>
                <li>Paste it below and click Connect</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="Paste your bot token here..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
          />
          <button
            onClick={handleSetup}
            disabled={loading || !botToken.trim()}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <FiRefreshCw className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <FiSend className="w-4 h-4" />
                Connect
              </>
            )}
          </button>
        </div>

        {resultMessage && (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
            <FiCheck className="w-4 h-4 shrink-0" />
            {resultMessage}
          </div>
        )}

        {resultError && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
            <FiAlertCircle className="w-4 h-4 shrink-0" />
            {resultError}
          </div>
        )}
      </div>

      {/* Test Card */}
      {isConnected && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <FiCheck className="w-5 h-5 text-emerald-500" />
            Bot is Active
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Your Telegram bot is connected and receiving messages. Citizens can now:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 ml-4 list-disc">
            <li>Send <span className="font-mono text-foreground">/start</span> to begin</li>
            <li>Report civic issues with photos</li>
            <li>Track complaints with <span className="font-mono text-foreground">status JSV-XXXX</span></li>
            <li>Ask questions about civic services</li>
          </ul>
        </div>
      )}
    </div>
  )
}
