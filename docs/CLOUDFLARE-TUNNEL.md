# Cloudflare Tunnel kurulumu (Windows)

Bilgisayarınızda çalışan `npm start` uygulamasını **modemde port açmadan** kendi alan adınıza bağlar. HTTPS Cloudflare tarafından verilir.

**Gereksinimler:** Alan adınız Cloudflare hesabınızda olmalı (nameserver’lar Cloudflare’e yönlü).

---

## 1. cloudflared kurulumu

PowerShell:

```powershell
winget install Cloudflare.cloudflared
```

Kurulum yoksa: [cloudflared indir](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

Kontrol:

```powershell
cloudflared --version
```

---

## 2. Cloudflare’a giriş

```powershell
cloudflared tunnel login
```

Tarayıcı açılır → domain seçin → izin verin.

---

## 3. Tünel oluşturma

```powershell
cloudflared tunnel create not-bulmaca
```

Çıktıda **Tunnel ID** (UUID) yazar. Kaydedin.

Kimlik dosyası: `C:\Users\KULLANICI_ADINIZ\.cloudflared\<TUNNEL_ID>.json`

---

## 4. Yapılandırma dosyası

Proje klasöründe:

```powershell
Copy-Item cloudflare\config.yml.example cloudflare\config.yml
```

`cloudflare\config.yml` dosyasını düzenleyin:

- `tunnel:` → Tunnel ID
- `credentials-file:` → `.cloudflared` içindeki `.json` tam yolu
- `hostname:` → kullanmak istediğiniz alt alan adı (ör. `not.okulum.com`)

---

## 5. DNS kaydı (otomatik)

```powershell
cd "C:\Users\HP\OneDrive\Desktop\Not belirleme uygulaması"
cloudflared tunnel route dns not-bulmaca not.sizindomain.com
```

`not.sizindomain.com` yerine config’teki hostname ile aynı adresi yazın.

Cloudflare panelinde **DNS → Records** altında CNAME görünür.

---

## 6. Çalıştırma

**İki terminal** veya tek script:

### A) İki terminal

Terminal 1:

```powershell
npm start
```

Terminal 2:

```powershell
cloudflared tunnel --config cloudflare\config.yml run
```

### B) Tek script (önerilen)

```powershell
.\scripts\start-with-tunnel.ps1
```

---

## 7. Test

- Bilgisayar: https://not.sizindomain.com
- Telefon (mobil veri dahil): aynı adres
- Admin: https://not.sizindomain.com/admin.html

İlk admin şifresi: **admin123** → hemen değiştirin.

---

## Hızlı test (alan adı olmadan)

Sadece denemek için geçici public URL:

```powershell
npm start
# başka terminal:
cloudflared tunnel --url http://127.0.0.1:3000
```

`https://xxxx.trycloudflare.com` benzeri bir link verir (her seferinde değişir, kalıcı değil).

---

## Sorun giderme

| Sorun | Çözüm |
|--------|--------|
| 502 / site açılmıyor | Önce `npm start` çalışıyor mu? `http://localhost:3000` deneyin |
| DNS yok | `tunnel route dns` komutunu tekrar çalıştırın |
| credentials-file hatası | `config.yml` içindeki `.json` yolu tam ve doğru mu? |
| PC kapalıyken site kapalı | Normal; bilgisayar açık ve iki süreç çalışmalı |
| PWA güncellenmiyor | Tarayıcıda site verilerini temizleyin veya gizli sekme |

---

## Otomatik başlatma (isteğe bağlı)

Windows görev zamanlayıcı veya `start-with-tunnel.ps1` kısayolunu **Başlangıç** klasörüne koyabilirsiniz. Bilgisayar açılınca sunucu + tünel başlar.

---

## Güvenlik

- Admin paneli (`/admin.html`) internete açılır; güçlü şifre kullanın.
- İsterseniz Cloudflare **Access** ile admin sayfasına ek şifre koyabilirsiniz (Zero Trust).
