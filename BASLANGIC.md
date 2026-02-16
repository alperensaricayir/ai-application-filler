# 🚀 Erasmus AI - Başlatma Kılavuzu

## ✅ Derleme Hatası Düzeltildi!

Projedeki C# derleme hataları başarıyla çözüldü. Artık uygulamayı çalıştırabilirsiniz.

## 📋 Başlatma Seçenekleri

### 1️⃣ Hızlı Başlatma (Önerilen)
En hızlı yöntem - direkt çalıştırır:

```batch
hizli-baslat.bat
```

**Ne yapar?**
- Backend'i ayrı pencerede başlatır
- Frontend'i ayrı pencerede başlatır
- Her ikisi de arka planda çalışır

---

### 2️⃣ Standart Başlatma (Güvenli)
Tüm kontrolleri yapar, projeyi derler:

```batch
start.bat
```

**Ne yapar?**
- .NET SDK ve Node.js kontrolü
- Backend'i derler (build)
- HTTPS sertifika güven ayarı
- Her iki servisi başlatır

---

### 3️⃣ Ayrı Ayrı Başlatma

**Sadece Backend:**
```batch
start-backend.bat
```

**Sadece Frontend:**
```batch
start-frontend.bat
```

---

## 🛑 Uygulamayı Durdurma

```batch
stop.bat
```

Tüm backend ve frontend proceslerini kapatır.

---

## 🌐 Erişim Adresleri

### Backend API
- **Swagger UI:** https://localhost:7099/swagger
- **API Base URL:** https://localhost:7099

### Frontend
- **Web UI:** http://localhost:5173

---

## ⚙️ Gereksinimler

- ✅ .NET 8 SDK
- ✅ Node.js v20+
- ✅ npm

---

## 🔧 Sorun Giderme

### Problem: Backend derlenemiyor
**Çözüm:** Zaten düzeltildi! `start-backend.bat` artık otomatik olarak projeyi derleyecek.

### Problem: "Port already in use" hatası
**Çözüm:** 
1. `stop.bat` dosyasını çalıştırın
2. Bekleyin (5 saniye)
3. Tekrar başlatın

### Problem: Frontend açılmıyor
**Çözüm:**
```bash
cd frontend/erasmus-ai-web
npm install
npm run dev
```

---

## 📝 Düzeltilen Hatalar

### ✅ CS0136 Derleyici Hataları
**Problem:** AIController.cs dosyasında değişken isim çakışmaları

**Düzeltilen Satırlar:**
- Line 585: `answers` → `trimmedAnswers`
- Line 625: `prompt` → `questionPrompt`
- Line 626: `response` → `questionResponse`
- Line 644: `answers` → `batchAnswers`

**Sonuç:** Proje artık başarıyla derleniyor! ✨

---

## 💡 İpuçları

1. **İlk kez çalıştırıyorsanız:** `start.bat` kullanın (güvenli)
2. **Hızlı test için:** `hizli-baslat.bat` kullanın
3. **Her seferinde backend derlemek istemiyorsanız:** `hizli-baslat.bat` yeterli
4. **Backend'de değişiklik yaptıysanız:** `start-backend.bat` ile yeniden derleyin

---

**Keyifli Kodlamalar! 🎉**
