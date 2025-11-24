import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMediaInputs } from './hooks/useMediaInputs';
import { Visualizer } from './components/Visualizer';
import { Leva } from 'leva';
import { useState } from 'react';

function App() {
  const { video, audioAnalyser, audioContext, isReady, error } = useMediaInputs();
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    setStarted(true);
  };

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'red',
        flexDirection: 'column'
      }}>
        <h1>Error</h1>
        <p>{error}</p>
        <p>Please allow camera and microphone access.</p>
      </div>
    );
  }

  if (!isReady || !video || !audioAnalyser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'white'
      }}>
        <h1>Initializing Media...</h1>
      </div>
    );
  }

  if (!started) {
    return (
      <div
        onClick={handleStart}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: 'white',
          cursor: 'pointer',
          background: '#000',
          flexDirection: 'column'
        }}
      >
        <h1>Click to Start</h1>
        <p>Audio visualization requires user interaction.</p>
      </div>
    );
  }

  return (
    <>
      <Leva collapsed={false} theme={{ sizes: { rootWidth: '400px' } }} />
      <Canvas
        camera={{ position: [0, 0, 12], fov: 45 }}
        style={{ width: '100vw', height: '100vh', background: '#000' }}
        dpr={[1, 2]} // Handle high DPI screens
      >
        <color attach="background" args={['#000000']} />

        <Visualizer video={video} audioAnalyser={audioAnalyser} />

        <OrbitControls makeDefault enableZoom={true} enablePan={true} />
      </Canvas>

      <div className="ui-overlay">
        <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          Audio Reactive Particles
        </h1>
        <p style={{ color: '#aaa', margin: 0, fontSize: '0.9rem' }}>
          Play some music and watch the particles react.
        </p>
      </div>
    </>
  );
}

export default App;
