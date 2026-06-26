"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, CheckCircle, WifiOff } from 'lucide-react';

interface OutageData {
    provider: string;
    status: string;
    reports: number;
    lastUpdated: string;
} 

const OutageMap = () => {
    const [outages, setOutages] = useState<OutageData[]>([]);
    const [loading, setLoading] = useState(true);

    // Use environment variables for API URL, fallback to localhost for development
    const HOST = process.env.NEXT_PUBLIC_API_URL || 'https://netpluse.onrender.com';

    useEffect(() => {
        // Fix leaflet default icon issue in Next.js
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default?.src || 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: require('leaflet/dist/images/marker-icon.png').default?.src || 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: require('leaflet/dist/images/marker-shadow.png').default?.src || 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const fetchOutages = async () => {
            try {
                const res = await fetch(`${HOST}/outages`);
                const result = await res.json();
                if (result.success) {
                    setOutages(result.data);
                }
            } catch (e) {
                console.error("Failed to load outage data", e);
            } finally {
                setLoading(false);
            }
        };

        fetchOutages();
        // Refresh every 30 seconds
        const interval = setInterval(fetchOutages, 30000);
        return () => clearInterval(interval);
    }, [HOST]);

    if (loading) {
        return (
            <div style={{ height: '400px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ color: 'var(--text-muted)' }}>Scanning global ISP status...</div>
            </div>
        );
    }

    // Pre-defined coordinates for major ISP hubs for demonstration of the map since the mock data is ISP level, not geo-level
    const ispHubs: Record<string, [number, number]> = {
        'Comcast': [39.9526, -75.1652], // Philadelphia (HQ)
        'Spectrum': [41.0534, -73.5387], // Stamford (HQ)
        'AT&T': [32.7767, -96.7970], // Dallas (HQ)
        'Verizon': [40.7128, -74.0060], // NYC (HQ)
        'Cox': [33.7490, -84.3880], // Atlanta (HQ)
        'CenturyLink': [32.5007, -92.1193], // Monroe (HQ)
        'Starlink': [33.9164, -118.3526], // Hawthorne
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {outages.map((outage) => {
                    const isDown = outage.status.includes('Outage');
                    const isWarning = outage.status.includes('Minor');
                    return (
                        <div key={outage.provider} style={{
                            background: isDown ? 'rgba(239, 68, 68, 0.1)' : isWarning ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-glass)',
                            border: `1px solid ${isDown ? 'rgba(239, 68, 68, 0.3)' : isWarning ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                            padding: '16px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '4px' }}>{outage.provider}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{outage.reports} reports</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                {isDown ? <WifiOff color="#ef4444" size={24} /> : isWarning ? <AlertTriangle color="#f59e0b" size={24} /> : <CheckCircle color="#10b981" size={24} />}
                                <span style={{ fontSize: '0.7rem', color: isDown ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981', textTransform: 'uppercase', fontWeight: 600 }}>
                                    {outage.status}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div style={{
                height: '400px',
                width: '100%',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
                <MapContainer
                    center={[39.8283, -98.5795]} // Center of US
                    zoom={4}
                    style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    {outages.map((outage) => {
                        const coords = ispHubs[outage.provider];
                        if (!coords) return null;

                        const isDown = outage.status.includes('Outage');
                        const color = isDown ? '#ef4444' : outage.status.includes('Minor') ? '#f59e0b' : '#10b981';

                        return (
                            <CircleMarker
                                key={outage.provider}
                                center={coords}
                                radius={isDown ? 25 : 8}
                                pathOptions={{
                                    fillColor: color,
                                    fillOpacity: isDown ? 0.6 : 0.8,
                                    color: color,
                                    weight: 2
                                }}
                            >
                                <Popup>
                                    <div style={{ padding: '4px', textAlign: 'center' }}>
                                        <strong>{outage.provider}</strong><br />
                                        Status: {outage.status}<br />
                                        Reports: {outage.reports}
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>
        </div >
    );
};

export default OutageMap;
