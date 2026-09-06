# NMS Dashboard Platform

Draft materi pitching. Target durasi: 7-10 menit. Target audiens: dosen, reviewer, calon pengguna, atau partner pilot.

## Slide 1 — Cover

**NMS Dashboard Platform**

Centralized multi-site network monitoring dashboard

- Monitoring site, device, telemetry, alarm, map, and logical topology dalam satu interface
- Demo: <https://dash.prabutama.my.id>
- Presenter: `[Nama]`
- Institusi: `[Kampus/Organisasi]`

**Visual:** screenshot Overview dashboard, logo project, dan tanggal presentasi.

**Narasi:**

Platform ini menyatukan monitoring jaringan multi-site ke dalam satu dashboard operasional. User dapat melihat kondisi site, device, telemetry, alarm, dan topology tanpa membuka banyak tool berbeda.

## Slide 2 — Problem

### Monitoring jaringan masih terfragmentasi

- Data device tersebar di banyak tool atau halaman.
- Admin sulit melihat kondisi seluruh site dalam satu tampilan.
- Device bermasalah tidak langsung terlihat berdasarkan prioritas.
- Telemetry mentah sulit dibaca oleh operator non-developer.
- Hubungan antar device dan lokasi site tidak selalu terlihat jelas.

**Narasi:**

Masalah utama bukan hanya mengumpulkan data. Masalahnya adalah mengubah data tersebut menjadi informasi operasional yang cepat dipahami dan bisa ditindaklanjuti.

## Slide 3 — Opportunity

### Satu operational view untuk banyak site

Platform monitoring terpusat dapat membantu:

- Network operation team memantau kondisi harian.
- Admin melihat device yang perlu diperiksa lebih dulu.
- Tim memahami distribusi site melalui map.
- Operator memahami hubungan logical antar device melalui topology.
- Organisasi mengembangkan monitoring dari demo ke device nyata.

**Visual:** diagram before/after.

```text
Sebelum: banyak tool + telemetry mentah + prioritas tidak jelas
Sesudah: satu dashboard + status teragregasi + prioritas issue
```

## Slide 4 — Solution

### NMS Dashboard Platform

Platform menyediakan:

- Overview kesehatan seluruh network.
- Site inventory dan site detail.
- Device inventory dan device detail.
- Fresh telemetry dan historical metrics.
- Critical & Warning Devices.
- Alarm list dan severity.
- Map lokasi site.
- Logical topology per site.
- Normalized metric labels untuk operator.

**One-line value proposition:**

> Mengubah telemetry jaringan menjadi operational view yang ringkas, terukur, dan mudah ditindaklanjuti.

## Slide 5 — How It Works

```text
NMS Agent
    |
    | HTTP telemetry
    v
ThingsBoard
    |
    | tenant API
    v
Go BFF API
    |
    | normalized dashboard view model
    v
Next.js Web Dashboard
```

### Peran setiap komponen

- **NMS Agent:** mengumpulkan atau menghasilkan telemetry device.
- **ThingsBoard:** menyimpan telemetry, device, asset, relation, attribute, dan alarm.
- **Go BFF:** menggabungkan dan menormalisasi data menjadi API dashboard.
- **Next.js dashboard:** menampilkan data dalam interface monitoring operasional.

**Narasi:**

Frontend tidak mengakses ThingsBoard secara langsung. BFF menjadi boundary yang menyembunyikan detail backend dan menjaga response tetap sesuai kebutuhan dashboard.

## Slide 6 — Demo Scope

### Lingkungan demo saat ini

| Item | Nilai |
|---|---:|
| Site | 3 |
| Device | 15 |
| Device per site | 5 |
| Device online | 15 |
| Telemetry stale | 0 |
| Active alarm | 0 |
| Site coordinates | 3 |
| Logical topology | 3 |

### Site demo

- Jakarta — `-6.2088, 106.8456` — DKI Jakarta
- Surabaya — `-7.2575, 112.7521` — Jawa Timur
- Makassar — `-5.1477, 119.4327` — Sulawesi Selatan

**Catatan:** angka diambil dari public BFF API pada `2026-08-28T08:12:40Z`. Angka dapat berubah karena telemetry demo bersifat dinamis.

## Slide 7 — Overview Dashboard

### Informasi yang tampil

- Total sites.
- Total devices.
- Online devices.
- Active alarms.
- Critical devices.
- Critical & Warning Devices.
- Summary indicators.
- Site map.
- Recent alarms jika tersedia.

**Visual wajib:** screenshot halaman `/` dengan KPI cards, daftar issue, dan map.

**Narasi:**

Overview menjadi halaman pertama untuk operational triage. Operator tidak perlu membuka detail setiap device untuk menemukan kandidat masalah.

## Slide 8 — Critical & Warning Devices

### Prioritas issue berasal dari aggregated device reports

Status device ditentukan dari kombinasi:

- Reachability.
- Freshness telemetry.
- Alarm severity.
- Packet loss.
- CPU usage.
- Memory usage.
- Latency.

### Contoh data live demo

Pada pengambilan data `2026-08-28T08:12:40Z`, device warning mencakup:

- `ap-makassar` — CPU `75.72%`.
- `router-makassar` — CPU `83.55%`.
- `switch-makassar` — CPU `78.85%`.

**Catatan presentasi:** angka telemetry berubah secara periodik. Tampilkan nilai yang terlihat saat live demo jika berbeda.

## Slide 9 — Device Monitoring

### Detail device dalam satu halaman

- Health summary.
- Latest telemetry.
- Metric cards.
- Historical charts.
- Interface metrics.
- Storage metrics.
- Alarm device.
- Attributes dan raw data di bagian debug/advanced.

### Metric label operator-friendly

Raw key:

```text
snmp.if.idx2.rx_bps
```

Display label:

```text
eth0 RX Throughput
```

Raw telemetry key tetap dipertahankan untuk integrasi. Label hanya dinormalisasi untuk tampilan.

**Visual wajib:** screenshot `/devices/{deviceId}` pada metric cards dan chart.

## Slide 10 — Map dan Logical Topology

### Map

- Menampilkan lokasi tiga site demo.
- Menampilkan jumlah device per site.
- Menampilkan status site.
- Membantu melihat cakupan monitoring secara geografis.

### Logical topology

- Menampilkan node device, subnet, dan external gateway.
- Mengelompokkan role seperti Router/Gateway dan Server/Endpoint.
- Menampilkan relationship seperti `connected_subnet` dan `default_route`.
- Mendukung zoom, pan, fit, minimap, dan legend.

**Visual wajib:** satu screenshot map dan satu screenshot topology site.

## Slide 11 — Technical Stack

- **Frontend:** Next.js `14.2.20`, React `18.3.1`, TypeScript, Tailwind CSS.
- **Frontend data:** TanStack Query dan Recharts.
- **Backend:** Go `1.23`, `chi` HTTP router.
- **Telemetry backend:** ThingsBoard.
- **Deployment:** Docker Compose dan Docker Hub images.
- **Access model:** public read-only portfolio mode.
- **Integration boundary:** frontend hanya memanggil BFF.

**Narasi:**

Stack dipilih untuk menjaga pemisahan tanggung jawab. Frontend fokus pada visualisasi, BFF fokus pada aggregation dan normalization, sedangkan ThingsBoard menjadi source of truth telemetry.

## Slide 12 — Architecture Strengths

### Modular dan siap dikembangkan

- BFF stateless.
- Tidak membutuhkan database tambahan untuk MVP.
- Tidak membutuhkan Redis untuk MVP.
- ThingsBoard tetap menjadi source of truth.
- Raw DTO ThingsBoard diisolasi di layer internal.
- API frontend tidak bergantung langsung pada format ThingsBoard.
- `PUBLIC_DEMO_MODE=true` membatasi data publik ke asset demo.
- Cache response membantu mengurangi request berulang.

## Slide 13 — Current Result

### Status implementasi

- Public dashboard aktif di `https://dash.prabutama.my.id`.
- ThingsBoard public aktif di `https://thingsboard.prabutama.my.id`.
- 3 site demo berhasil tampil.
- 15 device demo berhasil tampil.
- Telemetry HTTP berhasil dikirim oleh agent.
- Overview, site, device, alarm, report, map, dan topology tersedia.
- Critical & Warning Devices menampilkan status berdasarkan telemetry dan alarm.
- BFF dan frontend berhasil melewati test/build lokal.

### Evidence API

- `GET /api/v1/sites`
- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/sites`
- `GET /api/v1/reports/devices`
- `GET /api/v1/sites/{siteKey}/topology`

## Slide 14 — Use Cases dan Roadmap

### Potensi penggunaan

- Monitoring jaringan kampus dan laboratorium.
- Monitoring cabang perusahaan.
- Internal NOC dashboard.
- Managed service provider dashboard.
- Training dan simulasi network monitoring.

### Roadmap

1. Integrasi SNMP real device.
2. Notification email, Telegram, atau WhatsApp.
3. SLA dan uptime reporting.
4. Multi-tenant access.
5. Device auto-discovery.
6. Export report PDF.
7. Integrasi ticketing system.

## Slide 15 — Closing dan Ask

### Project siap masuk tahap pilot

Yang dibutuhkan untuk tahap berikutnya:

- Akses ke device atau network lab nyata.
- Feedback dari network administrator.
- Skenario threshold dan alarm operasional.
- Server/infrastruktur untuk scaling.
- Kesempatan pilot pada satu site nyata.

**Closing statement:**

> NMS Dashboard Platform membuktikan bahwa telemetry multi-site dapat diubah menjadi operational view yang terpusat. Tahap berikutnya adalah memvalidasi sistem dengan device nyata dan memperluasnya menjadi platform monitoring yang siap digunakan.

## Live Demo Flow

1. Buka <https://dash.prabutama.my.id>.
2. Tunjukkan KPI Overview.
3. Tunjukkan `Critical & Warning Devices`.
4. Tunjukkan map tiga site.
5. Buka `/sites` dan pilih satu site.
6. Buka topology site.
7. Buka satu device dari daftar issue.
8. Tunjukkan health, freshness, metric cards, dan chart.
9. Tunjukkan alarm/report jika diperlukan.

## Screenshot Checklist

- [ ] Cover dengan screenshot Overview.
- [ ] Overview lengkap.
- [ ] Critical & Warning Devices.
- [ ] Sites inventory.
- [ ] Device detail.
- [ ] Map.
- [ ] Logical topology.
- [ ] API evidence atau architecture diagram.

## Backup Plan

Jika live demo gagal:

- Gunakan screenshot dengan timestamp.
- Tampilkan API response yang sudah disimpan.
- Jelaskan data demo bersifat dinamis.
- Tampilkan architecture diagram dan data flow.
- Jangan menampilkan credentials, token, `.env`, atau private key.
