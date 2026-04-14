/**
 * Scene.jsx - Komponen Scene 3D Utama
 * Mengelola rendering permukaan air, agen, dan efek lingkungan.
 */

import React, { useContext, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationContext } from './App';
import Agents from './Agents';

function WaterSurface() {
  const { tssLevel } = useContext(SimulationContext);
  const meshRef = useRef();

  // Interpolasi warna air berdasarkan tingkat TSS
  // Biru jernih (TSS rendah) -> Coklat keruh (TSS tinggi)
  const colorLow = new THREE.Color('#006994'); // Biru laut
  const colorHigh = new THREE.Color('#8d6e63'); // Coklat lumpur
  
  const waterColor = useMemo(() => {
    const factor = Math.min(tssLevel / 100, 1.0); // Normalisasi 0-1
    return colorLow.clone().lerp(colorHigh, factor);
  }, [tssLevel]);

  // Opasitas sedikit meningkat saat keruh
  const opacity = 0.7 + (Math.min(tssLevel / 150, 1.0) * 0.2);

  useFrame((state) => {
    if (meshRef.current) {
      // Animasi gelombang sederhana
      const time = state.clock.getElapsedTime();
      meshRef.current.position.y = Math.sin(time * 0.5) * 2;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[500, -5, 500]}>
      <planeGeometry args={[1000, 1000, 64, 64]} />
      <meshStandardMaterial
        color={waterColor}
        transparent
        opacity={opacity}
        roughness={0.2}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <group>
      {/* Permukaan Air dengan warna dinamis berdasarkan polusi */}
      <WaterSurface />
      
      {/* Render semua agen (Hiu, Ikan, Plankton) */}
      <Agents />
      
      {/* Grid helper opsional untuk referensi spasial (bisa di-hide nanti) */}
      <gridHelper args={[1000, 20, '#444444', '#222222']} position={[500, -10, 500]} />
    </group>
  );
}

export default Scene;
