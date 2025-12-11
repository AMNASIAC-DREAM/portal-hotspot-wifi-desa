```
███████╗ ██████╗  ██████╗  ██╗
██╔════╝██╔═══██╗██╔═══██╗███║
███████╗██║   ██║██║   ██║╚██║   Hotspot TLS Fingerprint System
╚════██║██║   ██║██║   ██║ ██║   Device DNA • TLS Capture • CHAP Auth
███████║╚██████╔╝╚██████╔╝ ██║   Cloudflare Worker API • Anti-Bypass
╚══════╝ ╚═════╝  ╚═════╝  ╚═╝
```
step-by-step untuk Worker baru + KV Storage + Bind Environment sampai boleh run /tls-info & /api/validate.

Pergi ke:

👉 https://dash.cloudflare.com

Masuk akaun bro.

🚀 STEP 2 — Pergi menu WORKERS & PAGES

Sebelah kiri sidebar → tekan:

Workers & Pages → Create Application

🚀 STEP 3 — Pilih “Create Worker”

Klik:

📌 Create Worker

Cloudflare auto buat worker sample.

🚀 STEP 4 — Padam semua code dan paste code Worker

Padam semua dalam editor Cloudflare.

LEPAS TU paste penuh script dalam folder workers-cloudflare di atas 

🚀 STEP 5 — Setup KV Namespaces

Worker guna:
```
env.HOTSPOT_KV
```
buat KV storage.
Cara buat:
Pergi sidebar kiri: Workers → KV → Create Namespace

Nama namespace:
```nginx
HOTSPOT_KV
```
Selesai create → akan keluar ID seperti:
```
72b8ee4b21ad45ec9829d34cfc8d99a9
```
🚀 STEP 6 — Bind KV ke Worker
Pergi ke:
Workers → klik nama worker → Settings → Bindings

Tambah binding:

Variable name:
```nginx
HOTSPOT_KV
```
KV Namespace:
Pilih namespace HOTSPOT_KV yang bro buat tadi

Save.

👍 Sekarang Worker boleh panggil env.HOTSPOT_KV.get() dan .put().

🚀 STEP 7 — Save & Deploy Worker

Klik:

Deploy

Worker URL akan jadi macam ni:
```arduino
https://nama-server.<something>.workers.dev
```

🚀 STEP 8 — TEST ENDPOINT
Test TLS:
```
https://nama-server.workers.dev/tls-info
```
Jika berjalan, akan keluar JSON:
```json
{
  "tlsVersion": "TLSv1.3",
  "clientIP": "x.x.x.x",
  "asn": 4788
}
```

STEP 9 — Update login.html worker URL di atas ke dalam ftp mikrotik
```
ftp://192.168.88.1
```
Dalam login.html edit host workers :
```js
const WORKER_URL = 'https://nama-server.workers.dev';
```
Tukar ikut Worker baru.

10. Upload Portal Files
Letak semua file ke folder:
```bash
/hotspot
```

✅ 11. Allow Cloudflare Workers dalam Walled Garden (WAJIB)
Cloudflare Workers biasanya berada bawah IP range:
```
104.16.0.0/12
172.64.0.0/13
```

Masukkan dalam walled-garden IP Mikrotik:
```bash
/ip hotspot walled-garden ip
add action=allow dst-address=104.16.0.0/12
add action=allow dst-address=172.64.0.0/13
```
⚠️ Kalau error syntax error, pastikan command tepat begini:
```bash
/ip hotspot walled-garden ip add dst-address=104.16.0.0/12 action=allow
/ip hotspot walled-garden ip add dst-address=172.64.0.0/13 action=allow
```

✅ 12. Allow specific domain Workers.dev (WAJIB)

Jika Worker URL:
```arduino
https://nama-server.workers.dev
```
Tambah ke walled-garden layer7:
Step A — Create rule:
```bash
/ip hotspot walled-garden
add dst-host=*.workers.dev action=allow
add dst-host=*.cloudflare.com action=allow
add dst-host=nama-server.workers.dev action=allow
```
✅ 3. Allow HTTPS (Port 443) traffic ke Worker

Kalau hotspot block HTTPS sebelum login, fetch() akan gagal.
Pastikan:
```bash
/ip firewall filter add chain=hotspot dst-port=443 protocol=tcp action=accept
```
✅ 4. Allow DNS (WAJIB)

Jika hotspot block DNS, domain workers.dev tak boleh resolve.
```bash
/ip firewall filter add chain=hotspot dst-port=53 protocol=udp action=accept
/ip firewall filter add chain=hotspot dst-port=53 protocol=tcp action=accept
```

5. Testing — Verify dari Mikrotik terminal

Test DNS resolve:
```bash
/tool dns-update
ping workers.dev
```
Test HTTPS:
```bash
/tool fetch url=https://workers.dev output=none
```
Kalau dapat “status: finished”, bermakna OK.

🔥 6. Setting paling penting untuk login.html
Setting A — Allow HTML + JS dalam /hotspot
```bash
/ip hotspot profile set hsprof1 html-directory=hotspot
```

Setting B — Redirect sukses

Dalam login.html , Worker /status URL digunakan:
```bash
set redirect-url="https://nama-server.workers.dev/status"
```
Atau dari CLI:
```bash
/ip hotspot profile set hsprof1 login-by=mac,http-chap,http-redirection
```

🔍 7. Confirm Worker API dalam browser (tanpa login)

Buka browser HP:
```arduino
https://nama-server.workers.dev/tls-info
```
Kalau dapat output JSON seperti:
```json
{
 "tlsVersion": "TLSv1.3",
 "tlsCipher": "AES128-GCM",
 "clientIP": "xx.xx.xx.xx"
}
```
= Mikrotik allow Workers SUCCESS.


















