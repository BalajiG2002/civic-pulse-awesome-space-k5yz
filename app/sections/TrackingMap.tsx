'use client'

import React, { useEffect, useRef } from 'react'

interface TrackingMapProps {
  lat: number
  lng: number
  label?: string
  complaints?: Array<{
    lat: number
    lng: number
    complaint_id: string
    severity: string
    issue_type: string
    status: string
    area_name?: string
    sla_remaining?: string
    sla_hours?: number
    photo_url?: string
    hotspot?: boolean
  }>
  zoom?: number
  pulseDemo?: boolean
}

export default function TrackingMap({ lat, lng, label, complaints, zoom = 15, pulseDemo }: TrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    if (!document.querySelector('link[href*="leaflet"]')) {
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return
      const L = (window as any).L
      if (!L) return

      const map = L.map(mapRef.current).setView([lat, lng], zoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap',
      }).addTo(map)

      // --- Demo pin at Polaris School ---
      const demoIcon = L.divIcon({
        html: `<div style="position:relative;"><div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid white;position:relative;z-index:2;"></div></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      })
      L.marker([12.9698, 77.7499], { icon: demoIcon }).addTo(map)
        .bindPopup(`<strong>Polaris School of Technology</strong><br/>Ward 83, East Zone<br/><em>Demo Location</em>`)

      if (Array.isArray(complaints) && complaints.length > 0) {
        complaints.forEach((c: any) => {
          if (c.lat && c.lng) {
            const color = c.status === 'resolved'
              ? '#2dd4bf'
              : c.severity === 'P1'
              ? '#ef4444'
              : c.severity === 'P2'
              ? '#f59e0b'
              : '#6b7280'

            const isPulsing = pulseDemo && c.severity === 'P1' && c.status !== 'resolved'
            const pulseRing = isPulsing
              ? `<div style="position:absolute;top:-8px;left:-8px;width:28px;height:28px;border-radius:50%;border:2px solid ${color};opacity:0.6;animation:mapPulse 1.5s ease-out infinite;"></div>`
              : ''

            const icon = L.divIcon({
              html: `<div style="position:relative;">${pulseRing}<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;position:relative;z-index:2;"></div></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6],
              className: '',
            })

            // Hotspot pulsing red circle
            if (c.hotspot) {
              L.circle([c.lat, c.lng], {
                radius: 500,
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.1,
                weight: 1,
                className: 'animate-pulse',
              }).addTo(map)
            }

            // Severity badge color for popup
            const sevColor = c.severity === 'P1' ? '#ef4444' : c.severity === 'P2' ? '#f59e0b' : c.severity === 'P3' ? '#22c55e' : '#6b7280'

            const photoThumb = c.photo_url
              ? `<img src="${c.photo_url}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;margin-top:4px;" />`
              : ''

            const slaInfo = c.sla_remaining
              ? `<br/><small>SLA remaining: ${c.sla_remaining}</small>`
              : c.sla_hours
              ? `<br/><small>SLA: ${c.sla_hours}h</small>`
              : ''

            const statusLabel = c.status ? c.status.replace('_', ' ') : 'unknown'

            const popupContent = `
              <div style="min-width:160px;">
                <strong>${c.complaint_id}</strong>
                <span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;background:${sevColor};color:white;font-size:10px;">${c.severity}</span>
                <br/><span style="font-size:12px;">${c.issue_type || ''}</span>
                <br/><span style="font-size:11px;color:#666;">${c.area_name || ''}</span>
                <br/><span style="font-size:11px;">Status: <b>${statusLabel}</b></span>
                ${slaInfo}
                ${photoThumb}
                <br/><a href="/track/${c.complaint_id}" style="font-size:11px;color:#3b82f6;">Track &rarr;</a>
              </div>
            `

            L.marker([c.lat, c.lng], { icon }).addTo(map)
              .bindPopup(popupContent)
          }
        })
      } else {
        L.marker([lat, lng]).addTo(map).bindPopup(label || 'Location')
      }

      // Inject pulse animation CSS
      if (!document.getElementById('map-pulse-style')) {
        const style = document.createElement('style')
        style.id = 'map-pulse-style'
        style.textContent = `@keyframes mapPulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }`
        document.head.appendChild(style)
      }

      mapInstanceRef.current = map
    }

    if ((window as any).L) {
      initMap()
    } else {
      script.onload = initMap
      document.head.appendChild(script)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [lat, lng, label, zoom, complaints, pulseDemo])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />
}
