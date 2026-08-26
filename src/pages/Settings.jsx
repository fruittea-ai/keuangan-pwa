export default function Settings({ apiUrl, online, pending, onSync }) {
  return (
    <div className="page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Aplikasi</span>
          <h1>Setting</h1>
        </div>
      </header>

      <div className="report-card">
        <h2>Koneksi</h2>
        <div className="report-row">
          <span>Status internet</span>
          <strong>{online ? "Online" : "Offline"}</strong>
        </div>
        <div className="report-row">
          <span>Antrean sinkronisasi</span>
          <strong>{pending}</strong>
        </div>
        <button className="primary-button" onClick={onSync} disabled={!online || !pending}>
          {pending ? "Sinkronkan sekarang" : "Semua sudah tersinkron"}
        </button>
      </div>

      <div className="report-card">
        <h2>Mode data</h2>
        <p className="muted">Data terakhir disimpan di cache lokal agar dashboard tetap dapat dibuka ketika koneksi terputus. Transaksi baru masuk antrean dan dikirim otomatis ketika online.</p>
      </div>
    </div>
  );
}
