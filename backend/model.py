"""
model.py - Inti Simulasi Ekologis (Agent-Based Modeling & System Dynamics)
Menggunakan Mesa untuk ABM dan NumPy untuk komputasi grid polusi yang cepat.
"""

import numpy as np
from mesa import Model, Agent
from mesa.space import ContinuousSpace
import math
import random

class MarineAgent(Agent):
    """
    Kelas dasar untuk semua agen laut.
    Memiliki atribut umur, status hidup, dan tipe spesies.
    """
    def __init__(self, unique_id, model, species_type, max_age):
        # Mesa 3.x: Agent.__init__ hanya menerima (model, *args)
        # unique_id diatur otomatis oleh model saat register_agent
        super().__init__(model)
        self._unique_id = unique_id  # Simpan ID custom
        self.species_type = species_type
        self.max_age = max_age
        self.age = 0
        self.alive = True
        # Energi/motivasi untuk bergerak
        self.energy = 100 

    @property
    def unique_id(self):
        """Override unique_id untuk menggunakan ID custom."""
        return self._unique_id
    
    @unique_id.setter
    def unique_id(self, value):
        self._unique_id = value

    def step(self):
        """Langkah dasar: tambah umur, cek kematian."""
        self.age += 1
        if self.age >= self.max_age:
            self.alive = False
        
        # Cek kondisi lingkungan untuk mortalitas dini
        x, y = self.pos
        if x is not None and 0 <= x < self.model.width and 0 <= y < self.model.height:
            # Ambil nilai polusi di posisi agen (dibulatkan ke integer untuk indeks grid)
            tss_val = self.model.tss_grid[int(y), int(x)]
            do_val = self.model.do_grid[int(y), int(x)]

            # Aturan Mortalitas: TSS > 90 atau DO terlalu rendah
            if tss_val > 90 or do_val < 2.0:
                self.alive = False # Mati karena polusi/hipoksia

class WhaleShark(MarineAgent):
    """
    Hiu Paus: Filter feeder besar, bergerak mencari Zooplankton.
    Umur panjang, gerakan lebih lambat namun stabil.
    """
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, "whale_shark", max_age=5000)
        self.speed = 1.5 # Kecepatan gerak

    def step(self):
        super().step()
        if not self.alive: return

        # Logika sederhana: Cari arah dengan densitas Zooplankton tertinggi
        # Dalam implementasi nyata, ini bisa menggunakan raycasting atau sensor lokal
        # Di sini kita buat bergerak acak dengan bias menuju pusat jika tidak ada data
        dx = self.random.uniform(-1, 1)
        dy = self.random.uniform(-1, 1)
        
        # Normalisasi vektor gerak
        dist = math.sqrt(dx**2 + dy**2)
        if dist > 0:
            dx, dy = (dx/dist) * self.speed, (dy/dist) * self.speed

        new_x = self.pos[0] + dx
        new_y = self.pos[1] + dy

        # Batasi agar tetap dalam ruang (wrap-around atau clamp)
        new_x = max(0, min(self.model.width - 1, new_x))
        new_y = max(0, min(self.model.height - 1, new_y))

        self.model.space.move_agent(self, (new_x, new_y))

class ReefFish(MarineAgent):
    """Ikan Karang: Bergerak lebih cepat, membentuk kawanan kecil."""
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, "reef_fish", max_age=1000)
        self.speed = 2.0

    def step(self):
        super().step()
        if not self.alive: return
        
        # Gerakan acak sederhana untuk demonstrasi
        # Logika Boids lengkap dilakukan di frontend untuk performa visual
        angle = self.random.uniform(0, 2 * math.pi)
        dx = math.cos(angle) * self.speed
        dy = math.sin(angle) * self.speed

        new_x = max(0, min(self.model.width - 1, self.pos[0] + dx))
        new_y = max(0, min(self.model.height - 1, self.pos[1] + dy))
        
        self.model.space.move_agent(self, (new_x, new_y))

class Zooplankton(MarineAgent):
    """Zooplankton: Bergerak mengikuti arus/kualitas air, makanan Hiu Paus."""
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, "zooplankton", max_age=200)
        self.speed = 0.5

    def step(self):
        super().step()
        if not self.alive: return

        # Cenderung berkumpul di area dengan DO tinggi dan TSS rendah
        x, y = self.pos
        # Gerakan sangat lambat, cenderung diam kecuali terganggu
        if self.random.random() < 0.3: # 30% kemungkinan bergerak
            angle = self.random.uniform(0, 2 * math.pi)
            dx = math.cos(angle) * self.speed
            dy = math.sin(angle) * self.speed
            new_x = max(0, min(self.model.width - 1, x + dx))
            new_y = max(0, min(self.model.height - 1, y + dy))
            self.model.space.move_agent(self, (new_x, new_y))

class CoastalEcosystemModel(Model):
    """
    Model Utama Simulasi Ekosistem.
    Mengelola ruang, agen, dan dinamika polusi (TSS/DO).
    """
    def __init__(self, width=1000, height=1000, initial_agents=200):
        super().__init__()
        self.width = width
        self.height = height
        self.running = True
        self.step_count = 0

        # Inisialisasi Ruang Kontinu
        self.space = ContinuousSpace(width, height, torus=False)

        # Inisialisasi Grid Polusi (NumPy Arrays)
        # DO: Dissolved Oxygen (mg/L), optimal ~6-8
        self.do_grid = np.full((height, width), 7.0, dtype=np.float32)
        # TSS: Total Suspended Solids (mg/L), optimal 0-20
        self.tss_grid = np.zeros((height, width), dtype=np.float32)

        # Daftar agen - Manajemen manual untuk Mesa 3.x
        self.agents_list = []
        self.agent_counter = 0

        # Populasi Awal
        self._spawn_agents(initial_agents)

    def _spawn_agents(self, count):
        """Membuat agen awal secara acak."""
        for _ in range(count):
            x = self.random.uniform(0, self.width)
            y = self.random.uniform(0, self.height)
            
            # Distribusi spesies
            rand = self.random.random()
            if rand < 0.05: # 5% Hiu Paus
                agent = WhaleShark(self.next_id(), self)
            elif rand < 0.35: # 30% Ikan Karang
                agent = ReefFish(self.next_id(), self)
            else: # 65% Zooplankton
                agent = Zooplankton(self.next_id(), self)
            
            self.space.place_agent(agent, (x, y))
            self.agents_list.append(agent)
            self.agent_counter += 1

    def next_id(self):
        self.agent_counter += 1
        return self.agent_counter

    def trigger_coastal_dredging(self, x, y, intensity=50.0):
        """
        API Interaktif: Memicu pengerukan pesisir.
        Menyebarkan TSS dan mengurangi DO secara radial.
        x, y: Koordinat pusat gangguan.
        intensity: Kekuatan dampak awal.
        """
        radius = int(150) # Radius dampak dalam pixel/grid units
        
        # Batasi koordinat
        cx, cy = int(max(0, min(self.width-1, x))), int(max(0, min(self.height-1, y)))
        
        # Buat mask lingkaran untuk efisiensi
        y_coords, x_coords = np.ogrid[:self.height, :self.width]
        dist_sq = (x_coords - cx)**2 + (y_coords - cy)**2
        mask = dist_sq <= radius**2

        # Hitung falloff (penurunan intensitas seiring jarak)
        # Menggunakan fungsi Gaussian sederhana untuk penyebaran halus
        sigma = radius / 3.0
        falloff = np.exp(-dist_sq / (2 * sigma**2))
        
        # Terapkan dampak pada grid
        # TSS meningkat drastis di pusat
        self.tss_grid[mask] += intensity * falloff[mask]
        self.tss_grid = np.clip(self.tss_grid, 0, 150) # Cap maksimal TSS

        # DO menurun berbanding terbalik dengan TSS
        do_reduction = (intensity * 0.15) * falloff
        self.do_grid[mask] -= do_reduction[mask]
        self.do_grid = np.clip(self.do_grid, 0.0, 10.0) # Cap DO

        print(f"Dredging triggered at ({x}, {y}) with intensity {intensity}. Affected area updated.")

    def step(self):
        """Satu langkah simulasi penuh."""
        self.step_count += 1
        
        # 1. Update Dinamika Polusi (Diffusion & Decay)
        # TSS perlahan mengendap (decay)
        decay_rate = 0.98 
        self.tss_grid *= decay_rate
        self.tss_grid = np.maximum(self.tss_grid, 0)

        # DO perlahan pulih jika TSS rendah
        recovery_mask = self.tss_grid < 10
        self.do_grid[recovery_mask] += 0.05
        self.do_grid = np.clip(self.do_grid, 0, 10)

        # 2. Langkah Agen - Shuffle dan step manual untuk Mesa 3.x
        random.shuffle(self.agents_list)
        for agent in self.agents_list:
            agent.step()

        # 3. Bersihkan agen mati
        dead_agents = [a for a in self.agents_list if not a.alive]
        for agent in dead_agents:
            self.space.remove_agent(agent)
            self.agents_list.remove(agent)
        
        # Opsional: Respawn sedikit zooplankton untuk menjaga rantai makanan
        zoo_count = len([a for a in self.agents_list if a.species_type == 'zooplankton'])
        if zoo_count < 50:
             self._spawn_agents(10) # Spawn tambahan

    def get_state_snapshot(self):
        """
        Mengambil snapshot state saat ini untuk dikirim ke klien via WebSocket.
        Mengembalikan daftar agen hidup dan ringkasan grid polusi.
        """
        agents_data = []
        for agent in self.agents_list:
            if agent.alive:
                x, y = agent.pos
                agents_data.append({
                    "id": agent.unique_id,
                    "type": agent.species_type,
                    "x": float(x),
                    "y": float(y),
                    # Rotasi dummy berdasarkan arah gerak terakhir (bisa dikembangkan)
                    "rotation": 0.0 
                })

        # Untuk grid, kita kirim downsampled version agar payload JSON tidak terlalu besar
        # Misal: kirim grid 100x100 dari asli 1000x1000
        scale_factor = 10
        small_tss = self.tss_grid[::scale_factor, ::scale_factor]
        small_do = self.do_grid[::scale_factor, ::scale_factor]

        return {
            "step": self.step_count,
            "agents": agents_data,
            "tss_max": float(np.max(self.tss_grid)),
            "tss_grid_sampled": small_tss.tolist(),
            "do_grid_sampled": small_do.tolist(),
            "grid_dims": [self.height // scale_factor, self.width // scale_factor]
        }
