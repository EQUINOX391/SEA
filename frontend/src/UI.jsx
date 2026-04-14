/**
 * UI.jsx - Overlay Antarmuka Pengguna (DOM di atas Canvas)
 * Menampilkan statistik real-time dan tombol kontrol interaktif.
 */

import React, { useContext } from 'react';
import { SimulationContext } from './App';

function UIOverlay({ onTriggerDredging }) {
  const { simData, connected, tssLevel } = useContext(SimulationContext);

  // Hitung jumlah agen per tipe
  const agentCounts = simData.agents.reduce((acc, agent) => {
    acc[agent.type] = (acc[agent.type] || 0) + 1;
    return acc;
  }, {});

  const whaleCount = agentCounts.whale_shark || 0;
  const fishCount = agentCounts.reef_fish || 0;
  const planktonCount = agentCounts.zooplankton || 0;

  // Tentukan warna peringatan berdasarkan tingkat TSS
  let tssStatus = "Normal";
  let tssColor = "#4caf50"; // Hijau
  if (tssLevel > 30) {
    tssStatus = "Waspada";
    tssColor = "#ff9800"; // Oranye
  }
  if (tssLevel > 60) {
    tssStatus = "Bahaya";
    tssColor = "#f44336"; // Merah
  }
  if (tssLevel > 90) {
    tssStatus = "KRITIS - Mortalitas Tinggi";
    tssColor = "#9c27b0"; // Ungu
  }

  return (
    <div id="ui-container">
      <h1>🌊 Simulasi Ekosistem Pesisir</h1>
      
      <div className="stat">
        <strong>Status Koneksi:</strong>{' '}
        <span style={{ color: connected ? '#4caf50' : '#f44336' }}>
          {connected ? 'Terhubung' : 'Terputus'}
        </span>
      </div>

      <div className="stat">
        <strong>Langkah Simulasi:</strong> {simData.step}
      </div>

      <div className="stat">
        <strong>Populasi Agen:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>🦈 Hiu Paus: {whaleCount}</li>
          <li>🐠 Ikan Karang: {fishCount}</li>
          <li>🦐 Zooplankton: {planktonCount}</li>
        </ul>
      </div>

      <div className="stat">
        <strong>Kualitas Air (TSS):</strong>{' '}
        <span style={{ color: tssColor, fontWeight: 'bold' }}>
          {tssLevel.toFixed(1)} mg/L
        </span>
        <br />
        <small style={{ color: tssColor }}>{tssStatus}</small>
      </div>

      <div className="warning">
        <p>⚠️ TSS > 90 mg/L menyebabkan kematian massal.</p>
      </div>

      <button onClick={onTriggerDredging}>
        🚧 Mulai Proyek Pengerukan Pesisir
      </button>
      
      <div style={{ marginTop: '15px', fontSize: '0.75rem', opacity: 0.8 }}>
        <p><strong>Kontrol Kamera:</strong></p>
        <ul style={{ margin: '0', paddingLeft: '15px' }}>
          <li>Klik kiri + geser: Putar</li>
          <li>Klik kanan + geser: Geser</li>
          <li>Scroll: Zoom</li>
        </ul>
      </div>
    </div>
  );
}

export default UIOverlay;
