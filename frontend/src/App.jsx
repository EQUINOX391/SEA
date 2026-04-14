/**
 * App.jsx - Komponen Utama Aplikasi
 * Mengelola koneksi SocketIO, state global simulasi, dan merender scene 3D.
 */

import React, { useEffect, useState, createContext, useContext } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import io from 'socket.io-client';
import Scene from './Scene';
import UIOverlay from './UI';

// Context untuk berbagi data simulasi antar komponen
export const SimulationContext = createContext(null);

// URL Backend (sesuaikan jika backend berjalan di host/port berbeda)
const BACKEND_URL = 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [simData, setSimData] = useState({
    step: 0,
    agents: [],
    tss_max: 0,
    tss_grid_sampled: [],
    do_grid_sampled: [],
    grid_dims: [100, 100]
  });
  const [connected, setConnected] = useState(false);
  const [tssLevel, setTssLevel] = useState(0);

  useEffect(() => {
    // Inisialisasi koneksi SocketIO
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    newSocket.on('connect', () => {
      console.log('Terhubung ke server simulasi:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Terputus dari server simulasi');
      setConnected(false);
    });

    newSocket.on('simulation_step', (data) => {
      // Terima data snapshot dari backend
      setSimData(data);
      setTssLevel(data.tss_max || 0);
    });

    newSocket.on('dredging_confirmed', (data) => {
      console.log('Pengerukan dikonfirmasi:', data);
    });

    newSocket.on('dredging_error', (err) => {
      console.error('Error pengerukan:', err);
    });

    setSocket(newSocket);

    // Cleanup saat komponen unmount
    return () => {
      newSocket.close();
    };
  }, []);

  // Fungsi untuk memicu pengerukan dari UI
  const triggerDredging = () => {
    if (socket && connected) {
      // Kirim perintah ke tengah area simulasi (500, 500) dengan intensitas tinggi
      socket.emit('trigger_dredging', { x: 500, y: 500, intensity: 60.0 });
    } else {
      console.warn('Tidak terhubung ke server. Tidak dapat memicu pengerukan.');
    }
  };

  return (
    <SimulationContext.Provider value={{ simData, connected, tssLevel }}>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {/* Overlay UI Statistik & Kontrol */}
        <UIOverlay onTriggerDredging={triggerDredging} />

        {/* Canvas 3D Three.js */}
        <Canvas
          camera={{ position: [600, 400, 600], fov: 50 }}
          shadows
          dpr={[1, 2]} // Adaptif DPI untuk performa
        >
          {/* Pencahayaan & Lingkungan */}
          <color attach="background" args={['#001e2d']} />
          <fog attach="fog" args={['#001e2d', 100, 1500]} />
          
          <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={4} />
          <Stars radius={2000} depth={100} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[100, 200, 100]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <hemisphereLight
            args={['#87ceeb', '#001e2d', 0.6]}
            position={[0, 100, 0]}
          />

          {/* Scene Utama Simulasi */}
          <Scene />

          {/* Kontrol Kamera Orbit */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={100}
            maxDistance={1500}
            target={[500, 0, 500]}
          />
        </Canvas>
      </div>
    </SimulationContext.Provider>
  );
}

export default App;
