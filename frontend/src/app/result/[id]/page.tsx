import type { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { Activity } from 'lucide-react';

type Props = {
  params: { id: string };
};

const HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'; // Match backend port

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const res = await fetch(`${HOST}/api/results/${params.id}`, { cache: 'no-store' }).catch(() => null);
  
  if (!res || !res.ok) {
    return { title: 'Result Not Found - NetPulse' };
  }

  const data = await res.json();
  if (!data || !data.data) {
    return { title: 'Result Not Found - NetPulse' };
  }
  
  const result = data.data;
  const imageUrl = `${HOST}${result.imagePath}`;

  return {
    title: `NetPulse Speed Test - ${result.download} Mbps Download`,
    description: `Internet speed test result: ${result.download} Mbps Download, ${result.upload} Mbps Upload, ${result.ping} ms Ping. Tested with NetPulse.`,
    openGraph: {
      title: `NetPulse Speed Test - ${result.download} Mbps Download`,
      description: `Internet speed test result: ${result.download} Mbps Download, ${result.upload} Mbps Upload, ${result.ping} ms Ping. Tested with NetPulse.`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: 'Speed Test Result',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `NetPulse Speed Test - ${result.download} Mbps Download`,
      description: `Internet speed test result: ${result.download} Mbps Download, ${result.upload} Mbps Upload, ${result.ping} ms Ping. Tested with NetPulse.`,
      images: [imageUrl],
    },
  };
}

export default async function ResultPage({ params }: Props) {
  const res = await fetch(`${HOST}/api/results/${params.id}`, { cache: 'no-store' }).catch(() => null);
  
  if (!res || !res.ok) {
    return (
      <div className="app-container dark" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column' }}>
        <h1 style={{ color: 'white', fontSize: '2rem' }}>Result Not Found</h1>
        <p style={{ color: 'var(--text-muted)' }}>The speed test result you are looking for does not exist.</p>
        <Link href="/" style={{ marginTop: '2rem', padding: '12px 24px', background: 'var(--accent-cyan)', color: '#000', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>Run a Speed Test</Link>
      </div>
    );
  }

  const data = await res.json();
  const result = data.data;
  const imageUrl = `${HOST}${result.imagePath}`;

  return (
    <div className="app-container dark" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', background: '#020617' }}>
      
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={32} color="var(--accent-cyan)" />
          <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '2px', fontWeight: 800, color: 'white' }}>Net<span style={{ color: 'var(--accent-cyan)' }}>Pulse</span></h1>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        
        <h2 style={{ color: 'white', marginBottom: '0.5rem', textAlign: 'center' }}>Speed Test Result</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>Tested on {new Date(result.createdAt).toLocaleString()}</p>

        {result.bufferbloatGrade && result.bufferbloatGrade !== 'N/A' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '30px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Activity size={20} color="var(--accent-purple)" />
            <span style={{ color: 'white', fontWeight: 600 }}>Bufferbloat Grade:</span>
            <span style={{ color: result.bufferbloatGrade.startsWith('A') ? 'var(--accent-green)' : result.bufferbloatGrade.startsWith('B') || result.bufferbloatGrade.startsWith('C') ? '#f59e0b' : '#ef4444', fontWeight: 800, fontSize: '1.2rem' }}>
              {result.bufferbloatGrade}
            </span>
          </div>
        )}

        <div style={{ width: '100%', overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
          <img src={imageUrl} alt="Speed Test Result" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>

        <Link href="/" style={{ padding: '16px 32px', background: 'var(--accent-cyan)', color: '#070e1a', borderRadius: '30px', textDecoration: 'none', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '1px', transition: 'transform 0.2s', boxShadow: '0 10px 20px rgba(129, 226, 235, 0.2)' }}>
          RUN YOUR OWN TEST
        </Link>
      </div>

    </div>
  );
}
