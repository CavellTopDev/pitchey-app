import { useEffect, useState } from 'react';
import { pitchService } from '../services/pitch.service';
import type { Pitch } from '../services/pitch.service';

export default function TestMarketplace() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPitches();
  }, []);

  const loadPitches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🧪 TEST: Loading pitches from pitch service...');
      const { pitches: pitchesData } = await pitchService.getPublicPitches();
      console.log('🧪 TEST: Received pitches:', pitchesData?.length);
      
      if (pitchesData) {
        const stellarPitches = pitchesData.filter(p => p.creator?.username === 'stellarproduction');
        console.log('🧪 TEST: Stellar pitches found:', stellarPitches.length);
        stellarPitches.forEach(pitch => {
          console.log(`🧪 TEST: - ${pitch.title} by ${pitch.creator?.username}`);
        });
      }
      
      setPitches(Array.isArray(pitchesData) ? pitchesData : []);
    } catch (err: any) {
      console.error('🧪 TEST: Failed to load pitches:', err);
      setError(err.message);
      setPitches([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading test marketplace...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  const stellarPitches = pitches.filter(p => p.creator?.username === 'stellarproduction');
  const otherPitches = pitches.filter(p => p.creator?.username !== 'stellarproduction');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Marketplace Debug</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="font-bold">Summary:</h2>
        <p>Total pitches: {pitches.length}</p>
        <p>Stellar pitches: {stellarPitches.length}</p>
        <p>Other pitches: {otherPitches.length}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Stellar Production House Pitches:</h2>
        {stellarPitches.length > 0 ? (
          <div className="grid gap-4">
            {stellarPitches.map(pitch => (
              <div key={pitch.id} className="border border-purple-200 p-4 rounded bg-purple-50">
                <h3 className="font-bold text-purple-800">{pitch.title}</h3>
                <p className="text-sm text-purple-600">{pitch.logline}</p>
                <p className="text-xs text-gray-500">
                  by {pitch.creator?.companyName || pitch.creator?.username} 
                  ({pitch.creator?.userType})
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-red-600">❌ No Stellar pitches found!</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2">Other Pitches:</h2>
        <div className="grid gap-4">
          {otherPitches.map(pitch => (
            <div key={pitch.id} className="border border-gray-200 p-4 rounded">
              <h3 className="font-bold">{pitch.title}</h3>
              <p className="text-sm text-gray-600">{pitch.logline}</p>
              <p className="text-xs text-gray-500">
                by {pitch.creator?.companyName || pitch.creator?.username}
                ({pitch.creator?.userType})
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}