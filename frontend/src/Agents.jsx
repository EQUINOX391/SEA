/**
 * Agents.jsx - Sistem Rendering Agen dengan InstancedMesh
 * Merender ratusan/ribuan agen secara efisien menggunakan THREE.InstancedMesh.
 * Mengimplementasikan logika Boids sederhana di sisi klien untuk ikan kecil.
 */

import React, { useContext, useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationContext } from './App';

// Konfigurasi geometri untuk setiap tipe agen
const AGENT_CONFIGS = {
  whale_shark: {
    color: '#5c6bc0', // Biru keunguan
    scale: 8.0,
    geometry: new THREE.ConeGeometry(1, 4, 8), // Bentuk torpedo sederhana
    rotationOffset: Math.PI / 2 // Kerucut menghadap sumbu X
  },
  reef_fish: {
    color: '#ff7043', // Oranye terang
    scale: 1.5,
    geometry: new THREE.ConeGeometry(0.5, 1.5, 6),
    rotationOffset: Math.PI / 2
  },
  zooplankton: {
    color: '#66bb6a', // Hijau muda
    scale: 0.8,
    geometry: new THREE.SphereGeometry(0.4, 6, 6),
    rotationOffset: 0
  }
};

// Pre-bake rotasi geometri agar menghadap arah gerak yang benar
Object.values(AGENT_CONFIGS).forEach(config => {
  config.geometry.rotateZ(config.rotationOffset);
});

function Agents() {
  const { simData } = useContext(SimulationContext);
  
  // Refs untuk InstancedMesh setiap tipe
  const whaleRef = useRef();
  const fishRef = useRef();
  const planktonRef = useRef();

  // State lokal untuk interpolasi posisi (khusus Whale Shark)
  const prevPositions = useRef({});
  const lerpFactor = 0.1; // Faktor smoothing (0-1)

  // State untuk Boids (kecepatan lokal ikan kecil)
  const velocities = useRef({});

  useFrame((state, delta) => {
    // Update transformasi instanced mesh berdasarkan data terbaru
    
    // 1. Hiu Paus (dengan interpolasi untuk gerakan halus)
    if (whaleRef.current) {
      const whales = simData.agents.filter(a => a.type === 'whale_shark');
      const count = Math.min(whales.length, 100); // Max 100 hiu
      
      for (let i = 0; i < count; i++) {
        const agent = whales[i];
        const id = agent.id;
        
        // Interpolasi posisi dari frame sebelumnya
        if (!prevPositions.current[id]) {
          prevPositions.current[id] = new THREE.Vector3(agent.x, 5, agent.y);
        }
        
        const targetPos = new THREE.Vector3(agent.x, 5, agent.y);
        const currentPos = prevPositions.current[id];
        
        // Lerp untuk gerakan halus
        currentPos.lerp(targetPos, lerpFactor);
        
        // Hitung rotasi berdasarkan arah gerak
        const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
        if (direction.length() > 0.01) {
          const angle = Math.atan2(direction.x, direction.z);
          const matrix = new THREE.Matrix4();
          matrix.compose(
            currentPos,
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle),
            new THREE.Vector3(AGENT_CONFIGS.whale_shark.scale, AGENT_CONFIGS.whale_shark.scale, AGENT_CONFIGS.whale_shark.scale)
          );
          whaleRef.current.setMatrixAt(i, matrix);
        }
        
        prevPositions.current[id] = currentPos;
      }
      whaleRef.current.instanceMatrix.needsUpdate = true;
    }

    // 2. Ikan Karang (dengan Boids sederhana)
    if (fishRef.current) {
      const fishes = simData.agents.filter(a => a.type === 'reef_fish');
      const count = Math.min(fishes.length, 500); // Max 500 ikan
      
      for (let i = 0; i < count; i++) {
        const agent = fishes[i];
        const id = agent.id;
        
        // Inisialisasi kecepatan jika belum ada
        if (!velocities.current[id]) {
          velocities.current[id] = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
          );
        }
        
        let pos = new THREE.Vector3(agent.x, 2, agent.y);
        let vel = velocities.current[id];
        
        // --- BOIDS SEDERHANA ---
        // 1. Separation (hindari tetangga terlalu dekat)
        const separation = new THREE.Vector3();
        let neighborCount = 0;
        const sepDist = 8.0;
        
        for (let j = 0; j < count; j++) {
          if (i === j) continue;
          const otherAgent = fishes[j];
          const otherPos = new THREE.Vector3(otherAgent.x, 2, otherAgent.y);
          const dist = pos.distanceTo(otherPos);
          
          if (dist < sepDist && dist > 0) {
            const push = new THREE.Vector3().subVectors(pos, otherPos).normalize().divideScalar(dist);
            separation.add(push);
            neighborCount++;
          }
        }
        
        if (neighborCount > 0) {
          separation.divideScalar(neighborCount).multiplyScalar(2.0); // Kekuatan separation
          vel.add(separation);
        }
        
        // 2. Alignment & Cohesion (opsional, disederhanakan untuk performa)
        // Di sini kita hanya gunakan target posisi dari server + separation
        
        // Batasi kecepatan maksimum
        const maxSpeed = 15.0;
        if (vel.length() > maxSpeed) {
          vel.normalize().multiplyScalar(maxSpeed);
        }
        
        // Damping (gesekan) agar tidak terlalu liar
        vel.multiplyScalar(0.95);
        
        // Update posisi lokal kecil berdasarkan velocity
        pos.add(vel.clone().multiplyScalar(delta));
        
        // Simpan kembali velocity
        velocities.current[id] = vel;
        
        // Rotasi menghadap arah velocity
        const angle = Math.atan2(vel.x, vel.z);
        const matrix = new THREE.Matrix4();
        matrix.compose(
          pos,
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle),
          new THREE.Vector3(AGENT_CONFIGS.reef_fish.scale, AGENT_CONFIGS.reef_fish.scale, AGENT_CONFIGS.reef_fish.scale)
        );
        fishRef.current.setMatrixAt(i, matrix);
      }
      fishRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Zooplankton (gerakan pasif mengikuti server)
    if (planktonRef.current) {
      const planktons = simData.agents.filter(a => a.type === 'zooplankton');
      const count = Math.min(planktons.length, 800); // Max 800 plankton
      
      for (let i = 0; i < count; i++) {
        const agent = planktons[i];
        const pos = new THREE.Vector3(agent.x, 3, agent.y);
        
        // Rotasi acak statis untuk variasi visual
        const rotY = (agent.id % 100) / 100 * Math.PI * 2;
        
        const matrix = new THREE.Matrix4();
        matrix.compose(
          pos,
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
          new THREE.Vector3(AGENT_CONFIGS.zooplankton.scale, AGENT_CONFIGS.zooplankton.scale, AGENT_CONFIGS.zooplankton.scale)
        );
        planktonRef.current.setMatrixAt(i, matrix);
      }
      planktonRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // Hitung jumlah maksimum agen per tipe untuk alokasi InstancedMesh
  const counts = useMemo(() => {
    return simData.agents.reduce((acc, agent) => {
      acc[agent.type] = (acc[agent.type] || 0) + 1;
      return acc;
    }, {});
  }, [simData.agents.length]); // Hanya re-calc saat panjang array berubah signifikan

  const maxWhales = Math.max(counts.whale_shark || 0, 10);
  const maxFish = Math.max(counts.reef_fish || 0, 50);
  const maxPlankton = Math.max(counts.zooplankton || 0, 100);

  return (
    <group>
      {/* Hiu Paus */}
      {maxWhales > 0 && (
        <instancedMesh
          ref={whaleRef}
          args={[AGENT_CONFIGS.whale_shark.geometry, null, maxWhales]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={AGENT_CONFIGS.whale_shark.color} roughness={0.4} />
        </instancedMesh>
      )}

      {/* Ikan Karang */}
      {maxFish > 0 && (
        <instancedMesh
          ref={fishRef}
          args={[AGENT_CONFIGS.reef_fish.geometry, null, maxFish]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={AGENT_CONFIGS.reef_fish.color} roughness={0.3} />
        </instancedMesh>
      )}

      {/* Zooplankton */}
      {maxPlankton > 0 && (
        <instancedMesh
          ref={planktonRef}
          args={[AGENT_CONFIGS.zooplankton.geometry, null, maxPlankton]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={AGENT_CONFIGS.zooplankton.color} roughness={0.5} />
        </instancedMesh>
      )}
    </group>
  );
}

export default Agents;
