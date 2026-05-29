# Lexify — Mayıs Geliştirme Yol Haritası

Ay sonu EAS build öncesi öncelik sırası.

## Hafta 1 — Çekirdek döngü (✓ büyük ölçüde tamam)

- [x] Cümle çevirisi (uzun bas)
- [x] Çalış sekmesi
- [x] Misafir → hesap kelime senkronu
- [x] Ücretsiz plan banner
- [x] Misafir okuma geçmişi (yerel + girişte senkron)
- [x] Arama: yazarken canlı sonuç

## Hafta 2 — Çalışma & tutma

- [x] Quiz: ekrana dönünce limit kontrolü
- [x] Flashcard: ekrana dönünce due sayısı yenileme
- [x] Kelime tipi: çeviriyi paylaş
- [x] **Premium Quiz & Flashcard UI** (`components/study/StudyChrome.tsx`)
- [ ] Günlük hatırlatıcı (expo-notifications) — opsiyonel
- [ ] Koleksiyonlara kelime ekleme UI
- [ ] Offline: son çevirileri cache (AsyncStorage)

## Hafta 3 — Pro & kalite

- [ ] RevenueCat sandbox QA (gerçek cihaz)
- [ ] OCR: düşük ışık / bulanık foto ipuçları
- [ ] Video: transcript yüklenemezse net hata + yapıştır fallback
- [ ] Performans: büyük metinlerde tokenize chunking
- [ ] Erişilebilirlik: VoiceOver etiketleri (kritik butonlar)

## Hafta 4 — Lansman hazırlığı

- [ ] `eas build` production
- [ ] App Store ekran görüntüleri (MVP.md tablosu)
- [ ] TestFlight beta (5–10 kişi)
- [ ] Son QA checklist (MVP.md)

## Backlog (v1.1+)

- Apple Sign In
- Kelime export (CSV)
- Arkadaş / leaderboard
- Spaced repetition istatistik grafiği
