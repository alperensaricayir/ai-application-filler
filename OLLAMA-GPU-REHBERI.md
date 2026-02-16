# 🚀 Ollama GPU Kullanımı Rehberi

## ✅ Otomatik GPU Algılama

Ollama **varsayılan olarak GPU'yu otomatik algılar ve kullanır**. Özel bir ayar yapmanıza gerek yok!

### GPU Durumunu Kontrol Etme

Terminal'de şu komutla Ollama'nın GPU kullanıp kullanmadığını görebilirsiniz:

```powershell
# Ollama'yı başlatın
ollama serve

# Başka bir terminal'de model çalıştırın
ollama run llama3:8b

# GPU kullanımını görmek için (NVIDIA GPU)
nvidia-smi
```

---

## 🔧 GPU Kullanımını Zorlamak (NVIDIA)

### 1. NVIDIA GPU Drivers Güncel Mi?

```powershell
nvidia-smi
```

Bu komut GPU bilgilerini göstermelidir. Göstermiyorsa driver güncelleyin:
- [NVIDIA Driver İndirme](https://www.nvidia.com/Download/index.aspx)

### 2. CUDA Kurulu Mu?

Ollama için CUDA ayrı kurmanıza **gerek yok** - Ollama kendi CUDA runtime'ını içerir.

---

## ⚙️ Environment Variables (İsteğe Bağlı)

Ollama'nın davranışını kontrol etmek için:

### GPU Kullanımını Zorla
```powershell
# PowerShell'de kalıcı olarak ayarla
[System.Environment]::SetEnvironmentVariable('OLLAMA_GPU', '1', 'User')
```

### GPU Katmanlarını Ayarla (Bellek Optimizasyonu)
```powershell
# Tüm modeli GPU'da çalıştır (varsayılan)
[System.Environment]::SetEnvironmentVariable('OLLAMA_NUM_GPU', '999', 'User')

# Sadece belirli katman sayısını GPU'da çalıştır (düşük VRAM için)
[System.Environment]::SetEnvironmentVariable('OLLAMA_NUM_GPU', '30', 'User')
```

### Bellek Limitini Ayarla
```powershell
# GPU VRAM limitini ayarla (örn: 8GB)
[System.Environment]::SetEnvironmentVariable('OLLAMA_GPU_MEMORY', '8192', 'User')
```

**NOT:** Environment variable'ları ayarladıktan sonra **Ollama'yı yeniden başlatın**.

---

## 🖥️ AMD GPU (ROCm) Desteği

AMD GPU kullanıyorsanız:

1. Ollama'nın AMD ROCm destekli versiyonunu indirin
2. ROCm drivers kurulu olmalı
3. Set environment variable:

```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_GPU_DRIVER', 'rocm', 'User')
```

---

## 🍎 macOS Metal Desteği

macOS'ta Apple Silicon (M1/M2/M3) için:

```bash
# Metal otomatik kullanılır, kontrol için:
export OLLAMA_GPU_DRIVER=metal
```

---

## 📊 Performans Kontrolü

### Model Yüklenirken GPU Kullanımını İzle

```powershell
# Terminal 1: Ollama çalıştır
ollama run llama3:8b "Tell me about GPU acceleration"

# Terminal 2: GPU izle (NVIDIA)
nvidia-smi -l 1  # Her 1 saniyede güncelle
```

**Beklenen Çıktı:**
- **GPU Memory Used:** Artmalı (model yüklenince)
- **GPU Utilization:** %0-100 arası olmalı (inference sırasında)

---

## 🔍 Sorun Giderme

### Problem: GPU Kullanılmıyor (CPU'da Çalışıyor)

**Çözüm 1:** Ollama'yı yeniden başlatın
```powershell
# Ollama servisini durdur
taskkill /IM ollama.exe /F

# Yeniden başlat
ollama serve
```

**Çözüm 2:** CUDA kontrol
```powershell
# NVIDIA Control Panel > System Information > Components
# "3D Settings" altında CUDA olmalı
```

**Çözüm 3:** Ollama loglarını kontrol
```powershell
# Ollama serve çıktısında şuna benzer satır olmalı:
# "NVIDIA GPU detected" veya "Loaded GPU driver"
```

### Problem: "Out of Memory" Hatası

**Çözüm:** Daha küçük model kullanın veya GPU katmanlarını azaltın
```powershell
# Katman sayısını düşür
[System.Environment]::SetEnvironmentVariable('OLLAMA_NUM_GPU', '20', 'User')

# Ollama'yı yeniden başlat
taskkill /IM ollama.exe /F
ollama serve
```

---

## 🎯 Bu Proje İçin Ollama Yapılandırması

Backend zaten Ollama'yı `http://localhost:11435` üzerinden kullanıyor.

### Kontrol Adımları:

1. **Ollama Çalışıyor Mu?**
```powershell
curl http://localhost:11435/api/tags
```

2. **Model İndirilmiş Mi?**
```powershell
ollama list
```

3. **GPU Test**
```powershell
ollama run llama3:8b "Test GPU performance with a complex question"
```

4. **Admin Panel'den Kontrol**
- http://localhost:5174/admin
- Provider: OLLAMA seç
- Model: llama3:8b seç
- "Test" butonuna bas

---

## 💡 Öneriler

### VRAM'e Göre Model Seçimi:

- **4GB VRAM:** `llama3:8b` (quantized)
- **6GB VRAM:** `llama3:8b` veya `mistral:7b`
- **8GB+ VRAM:** `llama3:8b`, `mistral:7b`, veya `mixtral:8x7b`
- **12GB+ VRAM:** `llama3:70b` (quantized)

### Performans İpuçları:

1. **Sadece bir model aktif tutun** - Bellekten tasarruf
2. **prompt_cache kullanın** - Backend zaten yapıyor ✅
3. **Batch processing kullanın** - PromptBuilder zaten destekliyor ✅

---

## ✅ Sonuç

Ollama **otomatik olarak GPU kullanır**. Sadece:

1. GPU driver'ların güncel olmalı
2. Ollama çalışıyor olmalı (`ollama serve`)
3. Model indirilmiş olmalı (`ollama pull llama3:8b`)

**Artık hazırsınız!** 🚀

Test için: http://localhost:5174/ → Generate Answer butonu
