"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Wifi, RefreshCw, ArrowDown, ArrowUp, ArrowLeftRight, User, Server, Layout, ChevronDown, MapPin, Check, Share2, Activity, Globe, Moon, Sun, MonitorPlay, Gamepad2, UploadCloud, CheckCircle, XCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Speedometer = dynamic(() => import('../components/Speedometer'), { ssr: false });
const LiveChart = dynamic(() => import('../components/LiveChart'), { ssr: false });
const ParticleEngine = dynamic(() => import('../components/ParticleEngine'), { ssr: false });

// Dynamically import RadarMap to strictly bypass SSR (Leaflet relies heavily on the 'window' object)
const RadarMap = dynamic(() => import('../components/RadarMap'), { ssr: false });

// Dynamically import OutageMap to bypass SSR
const OutageMap = dynamic(() => import('../components/OutageMap'), { ssr: false });
const WiFiTroubleshooter = dynamic(() => import('../components/WiFiTroubleshooter'), { ssr: false });
const ComingSoonModal = dynamic(() => import('../components/ComingSoonModal'), { ssr: false });

export interface HistoryRecord {
  id: string;
  date: string;
  ping: number;
  download: number;
  upload: number;
  server: string;
  isp: string;
}

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'ping' | 'download' | 'upload' | 'done'>('idle');
  const [ping, setPing] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dataTransferred, setDataTransferred] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [testDuration, setTestDuration] = useState<number>(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [testId, setTestId] = useState<number | null>(null);

  const [currentValue, setCurrentValue] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(100);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [chartData, setChartData] = useState<{ time: number, speed: number }[]>([]);
  const [idleChartData, setIdleChartData] = useState<{ time: number, speed: number }[]>([]);
  const [idlePing, setIdlePing] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [idleJitter, setIdleJitter] = useState<number | null>(null);
  const [loadedDownloadPing, setLoadedDownloadPing] = useState<number | null>(null);
  const [loadedUploadPing, setLoadedUploadPing] = useState<number | null>(null);
  const [testActive, setTestActive] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [connType, setConnType] = useState('multi');
  const workerRef = useRef<Worker | null>(null);

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showWifiTroubleshooter, setShowWifiTroubleshooter] = useState(false);
  const [activeComingSoonFeature, setActiveComingSoonFeature] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryRecord | null>(null);
  const [showOutageMap, setShowOutageMap] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shareCopied, setShareCopied] = useState(false);
  const finalResultsRef = useRef({ ping: 0, download: 0, upload: 0 });

  const [terminalPackets, setTerminalPackets] = useState<{ id: number; timestamp: number; message: string; phase: string }[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalPackets]);

  interface ServerNode {
    id: string;
    name: string;
    location: string;
    lat: number;
    lon: number;
    distance: number;
  }

  const [clientInfo, setClientInfo] = useState({ ip: 'Loading...', isp: '...', city: '...', lat: 0, lon: 0 });
  const [telemetry, setTelemetry] = useState({
    localIp: 'Detecting...',
    connection: 'Detecting...',
    cores: '...'
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [activeServer, setActiveServer] = useState<ServerNode | null>(null);

  // Use environment variables for API URL, fallback to localhost for development
  const HOST = process.env.NEXT_PUBLIC_API_URL || 'https://netpluse.onrender.com';

  const handleRequestGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setClientInfo(prev => ({
            ...prev,
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            city: prev.city.includes('Offline') ? 'GPS Location' : prev.city
          }));
          alert("📍 Precision GPS Location acquired and map updated!");
        },
        (err) => {
          console.error('Geolocation error:', err);
          alert("❌ Could not get GPS location. Please allow location permissions in your browser's top URL bar and try again.");
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      alert("❌ Geolocation is not supported by your browser.");
    }
  };

  useEffect(() => {
    setTestId(Math.floor(Math.random() * 90000) + 10000);
  }, []);

  useEffect(() => {
    // Fetch real geo-location client data with robust fallbacks
    const fetchGeoIP = async () => {
      // Speed up initial load time using concurrent requests with a strict short timeout
      const fetchWithTimeout = (url: string, timeout = 3000) => {
        return Promise.race([
          fetch(url).then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
          new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), timeout))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ]) as Promise<any>;
      };

      try {
        // Fire all requests concurrently for speed, but use allSettled to pick results in a STRICT deterministic order.
        // This prevents the map from "jumping" to different coordinates on every page reload depending on which API resolved first.
        // Find the first successful response as quickly as possible, avoiding the full 3000ms wait if one is slow.
        // We use Promise.any to return the first successful result immediately.
        const geoData = await Promise.any([
          fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json').then((data) => {
            if (!data.latitude) throw new Error('geojs fail');
            return { ip: data.ip || 'Unknown IP', isp: data.organization_name || 'Unknown ISP', city: `${data.city}, ${data.region}`, lat: Number(data.latitude) || 0, lon: Number(data.longitude) || 0 };
          }),
          fetchWithTimeout('https://ipapi.co/json/').then((data) => {
            if (!data.latitude) throw new Error('ipapi fail');
            return { ip: data.ip || 'Unknown IP', isp: data.org || 'Unknown ISP', city: `${data.city || 'Unknown'}, ${data.region_code || ''}`, lat: data.latitude || 0, lon: data.longitude || 0 };
          })
        ]);

        if (!geoData) throw new Error("All APIs failed");
        setClientInfo(geoData);
      } catch (e) {
        console.error("GeoIP Providers failed or timed out. Falling back to default.", e);
        setClientInfo({ ip: 'Localhost (Fallback)', isp: 'Local Network', city: 'Offline Environment', lat: 37.7749, lon: -122.4194 });
      }

      // Try actual HTML5 geolocation for highly accurate "live location" mapping over GeoIP.
      // If the user grants this, it locks specifically onto their physical device hardware coordinates.
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setClientInfo(prev => ({
              ...prev,
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              city: prev.city.includes('Offline') ? 'GPS Location' : prev.city
            }));
          },
          () => console.log('Geolocation permission denied or not available'),
          { timeout: 8000, enableHighAccuracy: true }
        );
      }
    };

    // Advanced Telemetry Sniffer Phase
    const startTelemetrySniffer = async () => {
      // 1. Core Concurrency Counter
      const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores (Active)` : 'Unknown';

      // 2. Hardware Connection Type
      // @ts-expect-error - navigator.connection is non-standard but heavily supported
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      let connectionType = 'Ethernet / Direct';
      if (conn) {
        if (conn.type) {
          connectionType = conn.type === 'cellular' ? '4G/5G Cellular' : conn.type.toUpperCase() + ' Link';
        } else if (conn.effectiveType) {
          connectionType = conn.effectiveType.toUpperCase() + ' Wireless';
        }
      }

      // 3. Local Hardware IP Sniffer using WebRTC (Creates hidden peer channel)
      let detectedLocalIp = 'Hidden (Proxy/VPN)';
      try {
        // Adding public STUN servers forces the browser to resolve ICE candidates for real local IPs instead of masking them via mDNS
        const rtc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        rtc.createDataChannel('');
        rtc.createOffer().then(offer => rtc.setLocalDescription(offer)).catch(() => { });

        rtc.onicecandidate = (event) => {
          if (!event || !event.candidate) return;
          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
          const match = event.candidate.candidate.match(ipRegex);
          if (match && match[1] && !match[1].endsWith('.local')) {
            detectedLocalIp = match[1];
            setTelemetry(prev => ({ ...prev, localIp: detectedLocalIp }));
            rtc.close();
          }
        };
        // Give it 2s to catch an IP
        setTimeout(() => { if (detectedLocalIp.startsWith('Hidden')) setTelemetry(prev => ({ ...prev, localIp: '192.168.x.x (Masked by OS)' })) }, 2000);
      } catch (e) {
        console.warn("WebRTC Sniffing blocked.", e);
      }

      setTelemetry(prev => ({ ...prev, connection: connectionType, cores }));
    };

    startTelemetrySniffer();

    // Fetch mock servers and select fastest
    const fetchServers = async () => {
      try {
        const response = await fetch(`${HOST}/servers`);
        const data = await response.json();
        const serverList = data.servers || [];
        setServers(serverList);

        if (serverList.length > 0) {
          setActiveServer(serverList[0]);
          let bestServer = serverList[0];
          let bestPing = Infinity;

          for (const server of serverList) {
            const start = performance.now();
            try {
              // Pre-ping check to find fastest node
              await fetch(`${HOST}/ping`, { cache: 'no-store' });
              const pingTime = Math.round(performance.now() - start);
              if (pingTime < bestPing) {
                bestPing = pingTime;
                bestServer = server;
              }
            } catch {
              // ignore ping errors silently
            }
          }
          setActiveServer(bestServer);
        }
      } catch (error) {
        console.error("Failed to load servers", error);
      }
    };

    fetchGeoIP();
    fetchServers();

    // Initialize the true multithreading web worker
    workerRef.current = new Worker(new URL('../workers/speedWorker.ts', import.meta.url));

    try {
      const saved = localStorage.getItem('speedtest_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch { }

    return () => {
      workerRef.current?.terminate();
    };
  }, [HOST]);

  // Live "Heartbeat" Idle Ping Tracker
  useEffect(() => {
    let active = true;
    let lastPing = -1;

    const trackIdlePing = async () => {
      while (active) {
        if (status === 'idle' && !testActive) {
          const start = performance.now();
          try {
            await fetch(`${HOST}/ping`, { cache: 'no-store' });
            const pingTime = Math.round(performance.now() - start);

            const currentJitter = lastPing >= 0 ? Math.abs(pingTime - lastPing) : 0;
            lastPing = pingTime;

            setIdlePing(pingTime);
            setIdleJitter(Math.round(currentJitter));
            setIdleChartData(prev => [...prev.slice(-19), { time: Date.now(), speed: pingTime }]);
          } catch {
            // Silently ignore ping errors when idle
          }
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    trackIdlePing();

    return () => { active = false; };
  }, [status, testActive, HOST]);

  // Track Loaded Ping (Latency under load)
  useEffect(() => {
    let active = true;
    const pings: number[] = [];

    const measureLoadedPing = async () => {
      while (active && (status === 'download' || status === 'upload')) {
        const start = performance.now();
        try {
          await fetch(`${HOST}/ping`, { cache: 'no-store' });
          const latency = Math.round(performance.now() - start);
          pings.push(latency);

          if (pings.length > 5) pings.shift(); // keep last 5 for rolling average
          const avg = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);

          if (status === 'download') setLoadedDownloadPing(avg);
          if (status === 'upload') setLoadedUploadPing(avg);
        } catch { /* silent fail on ping drops */ }

        if (active) await new Promise(r => setTimeout(r, 750));
      }
    };

    if (status === 'download' || status === 'upload') {
      measureLoadedPing();
    }

    return () => { active = false; };
  }, [status, HOST]);

  const startTest = async () => {
    setTestActive(true);
    setPing(0);
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setCurrentValue(0);
    setChartData([]);
    setDataTransferred(0);
    setTestDuration(0);
    setLoadedDownloadPing(null);
    setLoadedUploadPing(null);
    setTerminalPackets([{ id: Date.now(), timestamp: Date.now(), message: 'Initiating NetPulse telemetry sequence...', phase: 'init' }]);

    const testStartTime = performance.now();

    try {
      // 1. PING PHASE
      setStatus('ping');
      setMaxValue(100);
      let totalPing = 0;
      const pingIterations = 8;

      for (let i = 0; i < pingIterations; i++) {
        const start = performance.now();
        await fetch(`${HOST}/ping`, { cache: 'no-store' });
        const took = Math.round(performance.now() - start);

        totalPing += took;

        setCurrentValue(took);
        setPing(took);
        setChartData(prev => [...prev.slice(-20), { time: Date.now(), speed: took }]);
        setTerminalPackets(prev => [...prev.slice(-49), { id: Math.random(), timestamp: Date.now(), message: `Ping reply from node - ${took}ms`, phase: 'ping' }]);
        await new Promise(r => setTimeout(r, 100)); // gap between pings
      }
      const finalPing = Math.round(totalPing / pingIterations);
      setPing(finalPing);
      finalResultsRef.current.ping = finalPing;

      // 2. DOWNLOAD PHASE
      setStatus('download');
      setMaxValue(500);
      setChartData([]);
      await new Promise(r => setTimeout(r, 500)); // Visual pause
      await measureDownload();

      // 3. UPLOAD PHASE
      setStatus('upload');
      setMaxValue(500);
      setChartData([]);
      await new Promise(r => setTimeout(r, 500)); // Visual pause
      await measureUpload();

      const testRecord: HistoryRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        ping: finalResultsRef.current.ping,
        download: parseFloat(finalResultsRef.current.download.toFixed(1)) || 0,
        upload: parseFloat(finalResultsRef.current.upload.toFixed(1)) || 0,
        server: activeServer ? activeServer.location : 'Unknown',
        isp: clientInfo.isp || 'Unknown'
      };

      setHistory(prev => {
        const newArr = [testRecord, ...prev].slice(0, 20);
        localStorage.setItem('speedtest_history', JSON.stringify(newArr));
        return newArr;
      });

      setStatus('done');
      // Set the final dial value to the calculated average download speed instead of resetting it to zero
      setCurrentValue(parseFloat(finalResultsRef.current.download.toFixed(1)) || 0);

    } catch {
      setStatus('idle');
      alert("Test configuration error or server unreachable.");
    } finally {
      setTestDuration(Math.round((performance.now() - testStartTime) / 1000));
      setTestActive(false);
    }
  };

  const measureDownload = async () => {
    return new Promise<void>((resolve, reject) => {
      if (!workerRef.current) return reject(new Error("Worker not initialized"));

      let lastTransferred = 0;
      const connections = connType === 'multi' ? 4 : 1;

      workerRef.current.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'PROGRESS') {
          const { speedMbps, dataTransferredMb } = payload;
          const delta = dataTransferredMb - lastTransferred;
          lastTransferred = dataTransferredMb;

          setDataTransferred(prev => prev + delta);
          setCurrentValue(speedMbps);
          setDownloadSpeed(speedMbps);
          finalResultsRef.current.download = speedMbps;
          setMaxValue(prevMax => speedMbps > prevMax * 0.8 && prevMax < 10000 ? prevMax * 1.5 : prevMax);
          setChartData(prev => [...prev.slice(-30), { time: Date.now(), speed: speedMbps }]);
        } else if (type === 'DONE') {
          resolve();
        } else if (type === 'ERROR') {
          reject(new Error(payload.error));
        } else if (type === 'PACKET') {
          setTerminalPackets(prev => [...prev.slice(-49), { id: Math.random(), ...payload }]);
        }
      };

      workerRef.current.postMessage({
        type: 'START_DOWNLOAD',
        payload: { host: HOST, connections, duration: 30000 }
      });
    });
  };

  const measureUpload = async () => {
    return new Promise<void>((resolve, reject) => {
      if (!workerRef.current) return reject(new Error("Worker not initialized"));

      let lastTransferred = 0;
      const connections = connType === 'multi' ? 4 : 1;

      workerRef.current.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'PROGRESS') {
          const { speedMbps, dataTransferredMb } = payload;
          const delta = dataTransferredMb - lastTransferred;
          lastTransferred = dataTransferredMb;

          setDataTransferred(prev => prev + delta);
          setCurrentValue(speedMbps);
          setUploadSpeed(speedMbps);
          finalResultsRef.current.upload = speedMbps;
          setMaxValue(prevMax => speedMbps > prevMax * 0.8 && prevMax < 10000 ? prevMax * 1.5 : prevMax);
          setChartData(prev => [...prev.slice(-30), { time: Date.now(), speed: speedMbps }]);
        } else if (type === 'DONE') {
          resolve();
        } else if (type === 'ERROR') {
          reject(new Error(payload.error));
        } else if (type === 'PACKET') {
          setTerminalPackets(prev => [...prev.slice(-49), { id: Math.random(), ...payload }]);
        }
      };

      workerRef.current.postMessage({
        type: 'START_UPLOAD',
        payload: { host: HOST, connections, duration: 30000 }
      });
    });
  };

  const chartColor = status === 'ping' ? 'var(--accent-ping)' : status === 'download' ? 'var(--accent-cyan)' : 'var(--accent-purple)';

  const getQualityRating = () => {
    if (downloadSpeed > 300 && ping < 20) return "Excellent for UHD Streaming & Gaming";
    if (downloadSpeed > 100 && ping < 50) return "Great for HD Streaming & Working";
    if (downloadSpeed > 25) return "Good for Standard Web Use";
    return "Poor - Network Optimization Suggested";
  };

  const handleShare = async () => {
    const dashboard = document.getElementById('speedtest-dashboard');
    if (!dashboard) return;

    try {
      // 1. Generate Image from the DOM
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(dashboard, {
        backgroundColor: '#070e1a',
        scale: 2 // High Resolution
      });

      const imageUri = canvas.toDataURL('image/png');
      const textToShare = `My Internet Speed: \n⬇ ${downloadSpeed.toFixed(1)} Mbps \n⬆ ${uploadSpeed.toFixed(1)} Mbps \n📶 Ping: ${ping} ms \nCheck your speed!`;

      // 2. Try Native Web Share API first (Mobile Devices)
      if (navigator.share) {
        // Convert base64 to File object for native sharing
        const blob = await (await fetch(imageUri)).blob();
        const file = new File([blob], 'speedtest-result.png', { type: 'image/png' });

        await navigator.share({
          title: 'My SpeedTest Result',
          text: textToShare,
          files: [file]
        });
      } else {
        // 3. Fallback for Desktop (Copy Text to Clipboard & Trigger Download)
        await navigator.clipboard.writeText(textToShare);

        const link = document.createElement('a');
        link.href = imageUri;
        link.download = `speedtest-result-${Date.now()}.png`;
        link.click();

        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      }
    } catch {
      console.error("GPS request failed or timed out.");
    }
  };

  const getVerdicts = () => {
    if (status !== 'done') return [];

    // Video Streaming
    let videoVerdict = { text: "Flawless 4K Video Streaming", status: "good", Icon: MonitorPlay };
    if (downloadSpeed < 15) videoVerdict = { text: "SD/HD Streaming Only", status: "bad", Icon: MonitorPlay };
    else if (downloadSpeed < 25) videoVerdict = { text: "1080p Video Streaming", status: "ok", Icon: MonitorPlay };

    // Gaming
    let gamingVerdict = { text: "Competitive Low-Latency Gaming", status: "good", Icon: Gamepad2 };
    const pingToUse = loadedDownloadPing !== null ? loadedDownloadPing : ping;
    if (pingToUse > 100) gamingVerdict = { text: "High Lag/Rubberbanding", status: "bad", Icon: Gamepad2 };
    else if (pingToUse > 60) gamingVerdict = { text: "Casual Gaming Only", status: "ok", Icon: Gamepad2 };

    // Large File Backup
    let backupVerdict = { text: "Instant Large File Backups", status: "good", Icon: UploadCloud };
    if (uploadSpeed < 10) backupVerdict = { text: "Slow File Backups", status: "bad", Icon: UploadCloud };
    else if (uploadSpeed < 30) backupVerdict = { text: "Moderate Backup Speed", status: "ok", Icon: UploadCloud };

    return [videoVerdict, gamingVerdict, backupVerdict];
  };

  const verdicts = getVerdicts();

  return (
    <div className={`app-container ${theme}`}>
      <div className="bg-pattern">
        <div className="bg-blob" />
      </div>

      {/* 3D Warp Speed Immersion Engine */}
      {status !== 'idle' && status !== 'done' && (
        <ParticleEngine
          speed={status === 'download' ? downloadSpeed : status === 'upload' ? uploadSpeed : 0}
          status={status}
        />
      )}

      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-brand">
          <Activity size={28} style={{ marginRight: '8px' }} />
          Net <span>Pulse</span>
        </div>
        <div className="nav-links">
          <span className="nav-link" onClick={() => setActiveComingSoonFeature('Apps')}>Apps</span>
          <span className="nav-link" onClick={() => setActiveComingSoonFeature('CLI')}>CLI</span>
          <span className="nav-link" onClick={() => setActiveComingSoonFeature('VPN')}>VPN</span>
          <span className="nav-link" onClick={() => setShowHistory(true)}>History</span>
          <div className="nav-lang">
            <Globe size={16} className="nav-lang-icon" /> EN <ChevronDown size={14} />
          </div>
          <span className="nav-link nav-login" onClick={() => setActiveComingSoonFeature('Login')}>
            <User size={18} /> Login
          </span>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="theme-toggle"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </nav>

      {/* Main Content Flow */}
      <main className="main-wrapper">
        <div className="header-text">
          <h1>NetPulse</h1>
          <p>Check your connection speed</p>
        </div>

        {/* Speedometer Gauge & Live Chart Component */}
        <div className="speedometer-container">
          <Speedometer value={currentValue} maxValue={maxValue} phase={status} />




        </div>

        {/* Action Button */}
        <button
          className="action-btn"
          onClick={!testActive ? startTest : undefined}
          disabled={testActive}
        >
          {status === 'idle' ? 'START TEST' : status === 'done' ? 'TEST AGAIN' : 'TESTING...'}
          <RefreshCw size={18} />
        </button>

        {/* Lower Metric Cards */}
        <div className="metrics-row">

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title"><ArrowLeftRight size={14} /> PING</div>
              <div className="metric-icon-bg"><Wifi size={14} /></div>
            </div>
            <div className="metric-value-block">
              <span className="metric-value">{status === 'idle' && idlePing !== null ? idlePing : (ping === 0 && status !== 'ping' ? '—' : ping)}</span>
              <span className="metric-unit">ms</span>
            </div>
            <div className="metric-sub-block" style={{ flexDirection: 'row', justifyContent: 'center', gap: '0.8rem', marginTop: '6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Idle</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{status === 'done' || status !== 'idle' ? (ping > 0 ? ping : '—') : (idlePing || '—')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '2px' }}><ArrowDown size={10} /> Load</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{loadedDownloadPing || '—'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '2px' }}><ArrowUp size={10} /> Load</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-purple)', fontSize: '0.9rem' }}>{loadedUploadPing || '—'}</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title"><ArrowDown size={14} /> DOWNLOAD <span className="metric-title-sub">mbps</span></div>
              <div className="metric-icon-bg"><ArrowDown size={14} /></div>
            </div>
            <div className="metric-value-block">
              <span className="metric-value">{downloadSpeed === 0 && status !== 'download' && status !== 'done' ? '—' : downloadSpeed.toFixed(1)}</span>
            </div>
            <div className="metric-sub metric-sub-block">
              {status === 'download'
                ? (downloadSpeed > 0 ? <span><ArrowUp size={12} className="metric-sub-icon" />{` ${(downloadSpeed / 8).toFixed(2)} MB/s`}</span> : 'Testing...')
                : (downloadSpeed > 0 ? <span><ArrowUp size={12} className="metric-sub-icon" />{` ${(downloadSpeed / 8).toFixed(2)} MB/s`}</span> : '\u00A0')}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title"><ArrowUp size={14} /> UPLOAD <span className="metric-title-sub">mbps</span></div>
              <div className="metric-icon-bg up"><ArrowUp size={14} /></div>
            </div>
            <div className="metric-value-block">
              <span className="metric-value">{uploadSpeed === 0 && status !== 'upload' && status !== 'done' ? '—' : uploadSpeed.toFixed(1)}</span>
            </div>
            <div className="metric-sub metric-sub-block">
              {status === 'upload'
                ? (uploadSpeed > 0 ? <span><ArrowUp size={12} className="metric-sub-icon" />{` ${(uploadSpeed / 8).toFixed(2)} MB/s`}</span> : 'Testing...')
                : (uploadSpeed > 0 ? <span><ArrowUp size={12} className="metric-sub-icon" />{` ${(uploadSpeed / 8).toFixed(2)} MB/s`}</span> : '\u00A0')}
            </div>
          </div>

        </div>

        {/* Dynamic Contextual Verdicts */}
        {
          status === 'done' && verdicts.length > 0 && (
            <div className="verdicts-row">
              {verdicts.map((v, i) => (
                <div key={i} className={`verdict-item ${v.status}`}>
                  {v.status === 'good' ? <CheckCircle size={18} color="var(--accent-green)" /> : v.status === 'ok' ? <CheckCircle size={18} color="#f59e0b" /> : <XCircle size={18} color="#ef4444" />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      <v.Icon size={12} />
                      {v.Icon === MonitorPlay ? 'Streaming' : v.Icon === Gamepad2 ? 'Gaming' : 'Productivity'}
                    </div>
                    <span>{v.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        }

        {/* Restored Server Info Panel */}
        {/* Main Server Info Panel Data (Now constantly visible!) */}
        <div className="server-info-panel">
          <div className="server-info-row">

            {/* Client Info */}
            <div className="info-block">
              <div className="info-icon">
                <User size={24} color="var(--text-main)" />
              </div>
              <div className="info-text">
                <div className="info-label-group">
                  <span className="info-label">Client</span>
                  <button className="gps-btn" onClick={handleRequestGPS}>📍 USE GPS</button>
                </div>
                <span className="info-value">{clientInfo.ip}</span>
                <span className="info-sub">{clientInfo.isp}</span>
              </div>
            </div>

            {/* Server Info */}
            <div className="info-block">
              <div className="info-icon">
                <Server size={24} color="var(--text-main)" />
              </div>
              <div className="info-text">
                <span className="info-label">Server</span>
                <span className="info-value">{activeServer ? activeServer.location : 'Finding optimal node'}</span>
                <span className="info-sub">{activeServer ? activeServer.name : 'Searching...'}</span>
              </div>
            </div>

            {/* Change Server Button */}
            <div className="info-action-container">
              <button className="info-action">
                Change<br />Server
              </button>
            </div>

          </div>

          {/* Hardware Telemetry Sniffer Row */}
          <div className="telemetry-row">
            <div className="telemetry-item">
              <span className="telemetry-label">Network Interface</span>
              <span className="telemetry-value">{telemetry.connection}</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Local Hardware IP</span>
              <span className="telemetry-value">{telemetry.localIp}</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Available Thread Concurrency</span>
              <span className="telemetry-value">{telemetry.cores}</span>
            </div>
          </div>

          {/* Live Server Radar Sweep mapping */}
          {activeServer && (
            <RadarMap
              clientLat={clientInfo.lat}
              clientLon={clientInfo.lon}
              serverLat={activeServer.lat}
              serverLon={activeServer.lon}
              status={status}
              onLocationUpdate={(lat, lon) => {
                setClientInfo(prev => ({
                  ...prev,
                  lat,
                  lon,
                  city: 'Custom Location (Manual Pin)'
                }));
              }}
            />
          )}
        </div>

        {/* Results Info Block (Shows only when done) */}
        {
          status === 'done' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '3rem 0' }}>
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', letterSpacing: '1px' }}>TEST SUMMARY</h3>
              <div className="results-grid">
                <div className="result-item">
                  <span className="label">Network Rating</span>
                  <span className="val" style={{ color: 'var(--accent-cyan)', fontSize: '1rem', textAlign: 'center' }}>{getQualityRating()}</span>
                </div>
                <div className="result-item">
                  <span className="label">Data Transferred</span>
                  <span className="val">{dataTransferred.toFixed(1)} MB</span>
                </div>
                <div className="result-item">
                  <span className="label">Test Duration</span>
                  <span className="val">{testDuration} sec</span>
                </div>
              </div>

              <button className="share-btn" onClick={handleShare}>
                {shareCopied ? <Check size={18} color="var(--accent-cyan)" /> : <Share2 size={18} />}
                {shareCopied ? "Copied & Downloaded!" : "Share Your Results"}
              </button>
            </div>
          )
        }

        {/* Feature Cards Section restored */}
        <section className="features-section">
          <div className="feature-card">
            <div className="feature-icon"><Layout size={24} /></div>
            <div className="feature-title">Native Desktop Apps</div>
            <div className="feature-desc">Download the SpeedTest app for Windows or macOS for background telemetry and no-browser tracking.</div>
            <span className="feature-link">Download <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} /></span>
          </div>
          <div className="feature-card" style={{ cursor: 'pointer' }} onClick={() => setShowWifiTroubleshooter(!showWifiTroubleshooter)}>
            <div className="feature-icon"><Wifi size={24} /></div>
            <div className="feature-title">Troubleshoot WiFi</div>
            <div className="feature-desc">Explore tips to optimize your router placement, channels, and cut interference.</div>
            <span className="feature-link">{showWifiTroubleshooter ? 'Hide Tips' : 'Learn More'} <ChevronDown size={14} style={{ transform: showWifiTroubleshooter ? 'rotate(180deg)' : 'rotate(-90deg)', transition: 'transform 0.3s ease' }} /></span>
          </div>
          <div className="feature-card" style={{ cursor: 'pointer' }} onClick={() => setShowOutageMap(!showOutageMap)}>
            <div className="feature-icon"><MapPin size={24} /></div>
            <div className="feature-title">Global Outage Map</div>
            <div className="feature-desc">Check if your area is affected by ISP outages using down detector metrics.</div>
            <span className="feature-link">{showOutageMap ? 'Hide Map' : 'View Map'} <ChevronDown size={14} style={{ transform: showOutageMap ? 'rotate(180deg)' : 'rotate(-90deg)', transition: 'transform 0.3s ease' }} /></span>
          </div>
        </section>

        {/* WiFi Troubleshooter Integration */}
        {showWifiTroubleshooter && (
          <section style={{ width: '100%', marginTop: '2rem', marginBottom: '2rem' }}>
            <WiFiTroubleshooter />
          </section>
        )}

        {/* Global Outage Map Integration */}
        {showOutageMap && (
          <section style={{ width: '100%', marginTop: '2rem', marginBottom: '4rem' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Live Global ISP Outages</h2>
            <OutageMap />
          </section>
        )}

      </main >

      {/* Modern Footer */}
      < footer className="footer" >
        <div className="footer-links">
          <span className="footer-link">About</span>
          <span className="footer-link">Press</span>
          <span className="footer-link">Enterprise Data</span>
          <span className="footer-link">Developers</span>
          <span className="footer-link">Privacy Policy</span>
          <span className="footer-link">Terms of Use</span>
        </div>
        <div>
          ISP: {clientInfo.isp} | {clientInfo.city} | Test ID: {testId || '...'}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          © 2026 NetPulse Labs. Original robust measurement methodology.<br />
          Made with ❤️ by Lokanath Meher
        </div>
      </footer >

      {/* Sliding History Panel (kept for functionality) */}
      < div className={`history-panel-overlay ${showHistory ? 'open' : ''}`
      } onClick={() => setShowHistory(false)} />
      < div className={`history-panel ${showHistory ? 'open' : ''}`}>
        <div className="history-header">
          <h3 style={{ color: 'var(--text-main)', letterSpacing: '0.5px' }}>Result History</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="history-close" style={{ background: 'rgba(129, 226, 235, 0.2)', color: 'var(--accent-cyan)' }} onClick={() => {
              if (history.length === 0) return alert('No history to export!');
              let csv = 'Date,Ping (ms),Download (Mbps),Upload (Mbps),Server,ISP\n';
              history.forEach(h => {
                csv += `${new Date(h.date).toISOString()},${h.ping},${h.download},${h.upload},"${h.server}","${h.isp}"\n`;
              });
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.setAttribute('hidden', '');
              a.setAttribute('href', url);
              a.setAttribute('download', 'netpulse_history.csv');
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}>📄 Export CSV</button>
            <button className="history-close" onClick={() => setShowHistory(false)}>Close</button>
          </div>
        </div>

        {
          history.length === 0 ? (
            <div className="history-empty">No tests completed yet. Run a test to save results!</div>
          ) : (
            <>
              <div style={{ height: 250, padding: '1rem', borderBottom: '1px solid var(--panel-border)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...history].reverse()} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                    <XAxis dataKey="date" tickFormatter={(t) => {
                      const d = new Date(t);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }} stroke="var(--text-muted)" fontSize={10} />
                    <YAxis yAxisId="left" stroke="var(--accent-cyan)" fontSize={10} width={30} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--accent-purple)" fontSize={10} width={30} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--panel-border)', borderRadius: '8px', color: 'var(--text-main)' }}
                      labelFormatter={(t) => new Date(t).toLocaleString()}
                      itemStyle={{ fontSize: '0.9rem' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="download" stroke="var(--accent-cyan)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Down (Mbps)" />
                    <Line yAxisId="right" type="monotone" dataKey="upload" stroke="var(--accent-purple)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Up (Mbps)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ping</th>
                    <th>Down</th>
                    <th>Up</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id} onClick={() => setSelectedHistoryItem(item)} style={{ cursor: 'pointer' }}>
                      <td>{new Date(item.date).toLocaleDateString()}<br /><span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.server}</span></td>
                      <td>{item.ping} ms</td>
                      <td className="speed-col down">{item.download}</td>
                      <td className="speed-col up">{item.upload}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        }
      </div >

      {/* History Detail Modal */}
      {
        selectedHistoryItem && (
          <>
            <div className="history-panel-overlay open modal-overlay" onClick={() => setSelectedHistoryItem(null)} />
            <div className="history-detail-modal">
              <h3 className="modal-title">Test Details</h3>
              <div className="modal-grid">
                <div><strong>Date:</strong> {new Date(selectedHistoryItem.date).toLocaleString()}</div>
                <div><strong>Ping:</strong> <span className="modal-val ping">{selectedHistoryItem.ping} ms</span></div>
                <div><strong>Download:</strong> <span className="modal-val down">{selectedHistoryItem.download} Mbps</span></div>
                <div><strong>Upload:</strong> <span className="modal-val up">{selectedHistoryItem.upload} Mbps</span></div>
                <div className="modal-full-row"><strong>Server Node:</strong> {selectedHistoryItem.server}</div>
                <div className="modal-full-row"><strong>ISP Routing:</strong> {selectedHistoryItem.isp}</div>
              </div>
              <button className="gps-btn modal-close-btn" onClick={() => setSelectedHistoryItem(null)}>Close</button>
            </div>
          </>
        )
      }

      {/* Hidden Dom Node for Image Generation Trading Card (Social Proof) */}
      <div id="speedtest-dashboard" style={{
        position: 'absolute',
        top: '-10000px',
        left: '-10000px',
        width: '800px',
        height: '460px',
        background: 'linear-gradient(135deg, #070e1a 0%, #0d1b2a 100%)',
        color: 'white',
        border: '2px solid rgba(122, 200, 255, 0.2)',
        borderRadius: '24px',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 50px rgba(0,0,0,0.8)'
      }}>
        {/* Background Overlay Decor */}
        <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '150%', height: '150%', background: 'radial-gradient(circle at center, rgba(0, 243, 255, 0.08) 0%, transparent 60%)', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '8px', background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-cyan), var(--accent-purple))', zIndex: 1 }} />

        {/* Header */}
        <div style={{ padding: '2rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={32} color="var(--accent-cyan)" />
            <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '2px', fontWeight: 800 }}>Net<span style={{ color: 'var(--accent-cyan)' }}>Pulse</span></h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Connection Verified</div>
            <div style={{ fontSize: '1.1rem', color: 'white', fontWeight: 700 }}>{mounted ? new Date().toLocaleDateString() : ''}</div>
          </div>
        </div>

        {/* Core Stats Row */}
        <div style={{ display: 'flex', padding: '2rem 3rem', gap: '2rem', flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '4px', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px' }}><ArrowDown size={24} /> DOWNLOAD</div>
            <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1, color: 'white' }}>{downloadSpeed.toFixed(1)} <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Mbps</span></div>
            <div style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem', marginTop: '8px', fontWeight: 600 }}>{(downloadSpeed / 8).toFixed(2)} MB/s</div>
          </div>

          <div style={{ width: '2px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', marginBottom: '4px', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px' }}><ArrowUp size={24} /> UPLOAD</div>
            <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1, color: 'white' }}>{uploadSpeed.toFixed(1)} <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Mbps</span></div>
            <div style={{ color: 'var(--accent-purple)', fontSize: '1.2rem', marginTop: '8px', fontWeight: 600 }}>{(uploadSpeed / 8).toFixed(2)} MB/s</div>
          </div>

        </div>

        {/* Footer Meta Bar */}
        <div style={{ padding: '1.5rem 3rem', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Provider</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{clientInfo.isp || 'Unknown Routing'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Server</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{activeServer ? activeServer.location : 'Unknown'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Latency</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{ping} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>ms</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Reusable Coming Soon Modal for Pending Features */}
      {activeComingSoonFeature && (
        <ComingSoonModal
          featureName={activeComingSoonFeature}
          onClose={() => setActiveComingSoonFeature(null)}
          host={HOST}
        />
      )}
    </div >
  );
}
