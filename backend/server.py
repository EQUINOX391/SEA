"""
server.py - Server Asinkron Flask-SocketIO untuk Streaming Data Simulasi
Menyediakan endpoint WebSocket untuk mengirim state simulasi ke klien frontend
dan menerima perintah interaktif (pengerukan).
"""

import eventlet
import socketio
from flask import Flask
from model import CoastalEcosystemModel
import time
import threading

# Inisialisasi Server
sio = socketio.Server(async_mode='eventlet', cors_allowed_origins="*")
app = Flask(__name__)
app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)

# Inisialisasi Model Simulasi
# Ukuran 1000x1000 dengan 300 agen awal
model = CoastalEcosystemModel(width=1000, height=1000, initial_agents=300)

# Flag kontrol thread simulasi
running = True

def simulation_loop():
    """
    Loop utama simulasi yang berjalan di thread terpisah.
    Menjalankan langkah simulasi dan memancarkan data ke klien secara berkala.
    Target: ~20 FPS (setiap 50ms) atau sesuai beban komputasi.
    """
    global running
    print("Memulai loop simulasi backend...")
    
    while running:
        start_time = time.time()
        
        # 1. Jalankan satu langkah logika simulasi (ABM + Polusi)
        model.step()
        
        # 2. Ambil snapshot state saat ini
        # Fungsi ini mengonversi objek Python/NumPy ke struktur yang bisa di-JSON
        snapshot = model.get_state_snapshot()
        
        # 3. Kirim data ke semua klien yang terhubung melalui WebSocket
        # Event name: 'simulation_step'
        sio.emit('simulation_step', snapshot)
        
        # 4. Kontrol laju frame (target ~20 FPS = 0.05 detik per frame)
        elapsed = time.time() - start_time
        sleep_time = max(0, 0.05 - elapsed)
        
        if sleep_time > 0:
            eventlet.sleep(sleep_time)
        else:
            # Jika komputasi lebih lama dari target, langsung lanjut (frame drop)
            eventlet.sleep(0)

@sio.on('connect')
def connect(sid, environ):
    """Dipanggil ketika klien baru terhubung."""
    print(f"Klien terhubung: {sid}")
    # Opsional: Kirim state awal segera
    # sio.emit('simulation_step', model.get_state_snapshot(), to=sid)

@sio.on('disconnect')
def disconnect(sid):
    """Dipanggil ketika klien terputus."""
    print(f"Klien terputus: {sid}")

@sio.on('trigger_dredging')
def handle_dredging(sid, data):
    """
    Handler untuk permintaan pengerukan dari klien.
    Data yang diharapkan: {'x': float, 'y': float, 'intensity': float}
    """
    print(f"Permintaan pengerukan diterima dari {sid}: {data}")
    
    try:
        x = data.get('x', 500)
        y = data.get('y', 500)
        intensity = data.get('intensity', 50.0)
        
        # Panggil fungsi model untuk memicu gangguan
        model.trigger_coastal_dredging(x, y, intensity)
        
        # Konfirmasi ke klien pengirim (opsional)
        sio.emit('dredging_confirmed', {'status': 'success', 'x': x, 'y': y}, to=sid)
        
    except Exception as e:
        print(f"Error saat memicu pengerukan: {e}")
        sio.emit('dredging_error', {'status': 'error', 'message': str(e)}, to=sid)

if __name__ == '__main__':
    # Mulai thread simulasi di latar belakang
    # Daemon=True memastikan thread mati jika main thread mati
    sim_thread = eventlet.spawn(simulation_loop)
    
    print("Server dimulai di http://0.0.0.0:5000")
    print("Menunggu koneksi klien...")
    
    # Jalankan server Flask-SocketIO
    # host='0.0.0.0' agar bisa diakses dari jaringan lokal/docker
    try:
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app)
    except KeyboardInterrupt:
        print("Server dihentikan oleh pengguna.")
        running = False
        sim_thread.kill()
