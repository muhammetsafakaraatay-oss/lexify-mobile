# Lexify MVP — Lansman Özeti

## Ürün vaadi (tek cümle)

**Gerçek İngilizce içerikten kelime yakala, SM-2 ile unutmadan tekrar et.**

## MVP’de çalışan döngü

1. **Keşfet / Oku** — makale, yapıştırılan metin veya YouTube transcript
2. **Dokun** — kelime anlamı, CEFR, IPA, ses
3. **Basılı tut** — tam cümle çevirisi
4. **Kaydet** — kelime listesi (misafir: cihazda; giriş: Supabase)
5. **Çalış** — flashcard, quiz, hızlı pratik
6. **Pro** — kamera, video, sınırsız kayıt (RevenueCat)

## Ücretsiz vs Pro

| Özellik | Ücretsiz | Pro |
|--------|----------|-----|
| Okuma & kelime çevirisi | ✓ | ✓ |
| Cümle çevirisi (uzun bas) | ✓ | ✓ |
| Kelime kaydı | 30 kelime, günde 8 | Sınırsız |
| Flashcard oturumu | 12 kart | Sınırsız |
| Quiz | 1/gün | Sınırsız |
| Kamera OCR | — | ✓ |
| YouTube transcript | — | ✓ |
| Bulut senkron | Giriş sonrası | ✓ |

## App Store metadata (Türkçe — kopyala-yapıştır)

**Ad:** Lexify — İngilizce Kelime

**Alt başlık:** Okurken kelime öğren, tekrar et

**Açıklama (kısa):**
Lexify, BBC ve NYT gibi gerçek metinlerden kelime öğrenmeni sağlar. Kelimeye dokun, anlamını gör, kaydet ve bilimsel aralıklı tekrar (SM-2) ile pekiştir. YouTube transcript ve kamera OCR Pro ile açılır.

**Anahtar kelimeler:**
ingilizce,kelime,okuma,flashcard,cefr,quiz,youtube,ocr,öğrenme,vocabulary

**Destek URL:** `mailto:muhammetsafakaraatay@gmail.com`

**Gizlilik:** https://lexitr.vercel.app/privacy-policy

### Uzun açıklama (App Store — 4000 karaktere kadar)

Lexify, sözlük uygulaması değil — okuduğun gerçek İngilizce içerikten kelime öğrenmeni sağlayan bir öğrenme döngüsüdür.

**Nasıl çalışır?**
• Keşfet’ten BBC, NYT ve benzeri makaleleri aç veya kendi metnini yapıştır
• Bilmediğin kelimeye dokun — anlam, CEFR seviyesi ve telaffuz anında gelsin
• Cümleyi anlamak için basılı tut — tam Türkçe çeviri
• Kelimelerini kaydet; SM-2 algoritması doğru zamanda tekrar ettirsin
• Flashcard, quiz ve hızlı pratik ile pekiştir

**Lexify Pro ile**
• Kamera OCR — kitap ve ekrandan metin tara
• YouTube transcript — video izlerken kelime öğren
• Sınırsız kelime kaydı ve çalışma oturumu
• Google hesabınla bulutta senkron

İngilizceyi liste ezberlemek yerine içerik akışının içinde öğren. İlk kelimeni bugün kaydet.

### Ekran görüntüsü başlıkları (6–8 slide)

| # | Ekran | Başlık (üstte) | Alt metin (opsiyonel) |
|---|--------|----------------|------------------------|
| 1 | Onboarding | Gerçek içerikten öğren | Makale · video · OCR |
| 2 | Oku / kelime tip | Dokun, anında anla | CEFR · IPA · ses |
| 3 | Cümle çevirisi | Basılı tut, cümleyi çevir | Akışı bozmadan |
| 4 | Kelimelerim | Kelimelerini topla | Kaynak ve seviye ile |
| 5 | Çalış / Flashcard | Bilimle tekrar et | SM-2 aralıklı tekrar |
| 6 | Quiz | Kendini test et | Eşleştirme quiz |
| 7 | Keşfet | Seviyene uygun makale | A1’den C2’ye |
| 8 | Pro paywall | Tüm gücü aç | OCR · video · sınırsız |

## Teknik lansman komutları

### EAS ortam değişkenleri (zorunlu)

Expo dashboard → [@safaxx/lexify](https://expo.dev/accounts/safaxx/projects/lexify) → **Environment variables**  
`preview` ve `production` için `.env.example` içindeki anahtarları ekle.

```bash
# Örnek (değerleri kendi .env dosyandan)
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "..." --environment preview --environment production
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..." --environment preview --environment production
npx eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "..." --environment preview --environment production
```

### iOS build

```bash
npx eas login   # safaxx — zaten girişli
npx eas build --platform ios --profile preview
# iPhone’da QA → aşağıdaki checklist
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

**Not (May 2026):** Ücretsiz EAS planında aylık iOS build kotası dolmuş olabilir. Kotanın yenilenmesi (~12 gün) veya [billing upgrade](https://expo.dev/accounts/safaxx/settings/billing) gerekir.

**Kota yokken alternatif — Mac + kablo:**

```bash
npm install
npx expo run:ios --device
```

Son başarılı cloud build’ler (eski commit — yeni MVP için yeniden build gerekir):

| Profil | Build # | IPA |
|--------|---------|-----|
| production | 3 | [expo.dev/.../b3d51c78](https://expo.dev/accounts/safaxx/projects/lexify/builds/b3d51c78-4b7a-414b-8d6d-e18d308dab74) |
| preview | 1 | [expo.dev/.../65080808](https://expo.dev/accounts/safaxx/projects/lexify/builds/65080808-730c-4ef4-85a8-bb58e8ac3215) |

## Son QA (15 dk)

- [ ] Misafir: 3 kelime kaydet → Google giriş → kelimeler hesapta
- [ ] Uzun bas → tam cümle Türkçe
- [ ] Çalış sekmesi → flashcard + quiz
- [ ] Pro olmayan: kamera paywall
- [ ] Paywall satın alma / geri yükleme (sandbox)

## Bilinen sınırlar (v1.0)

- Bazı haber siteleri bot koruması nedeniyle linkten açılmayabilir → manuel yapıştırma
- Web önizleme proxy gerektirir; App Store build doğrudan Vercel API kullanır
- Misafir verisi yalnızca girişte bir kez birleştirilir (sonradan tekrar birleştirme yok)
