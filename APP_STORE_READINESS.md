# Lexify App Store Readiness

## 1. Release Config

- [x] `bundleIdentifier`: `com.lexify.app`
- [x] iOS `buildNumber`: `1`
- [x] Android `versionCode`: `1`
- [x] `eas.json` added
- [x] App Store Connect app id in `eas.json` (`6768446396`)
- [ ] Run `npx eas login`
- [ ] Run `npx eas build:configure`

## 2. Real iPhone QA

### Auth
- [ ] Open app from a fresh install
- [ ] Verify onboarding flow reaches login correctly
- [ ] Test Google login end-to-end on a real iPhone
- [ ] Kill app and reopen, confirm session persists
- [ ] Log out and confirm user returns to login cleanly

### Reading Loop
- [ ] Open `Keşfet`
- [ ] Open a featured article
- [ ] Tap at least 5 different words
- [ ] Verify meaning, CEFR, IPA and audio work
- [ ] Save 3 words
- [ ] Confirm saved words appear in `Kelimelerim`

### Reader / Paste
- [ ] Open `Oku`
- [ ] Paste a raw English paragraph
- [ ] Process text
- [ ] Tap words and save at least 2

### Video
- [ ] Paste a YouTube URL with transcript
- [ ] Verify full transcript loads
- [ ] Tap a timestamp and confirm player seeks correctly
- [ ] Tap 3 words in transcript
- [ ] Save 2 words from video context

### Camera OCR
- [ ] Grant camera permission
- [ ] Capture a printed paragraph
- [ ] Verify OCR result opens
- [ ] Tap words inside OCR result
- [ ] Save at least 1 word from OCR flow
- [ ] Test gallery import flow

### Study Loop
- [ ] Open `Flashcards`
- [ ] Verify normal review mode
- [ ] Verify `Tüm Kelimeleri Çalış`
- [ ] Open `Quiz`
- [ ] Complete one full matching run

### Profile / Dashboard
- [ ] Confirm dashboard stats update after new saves
- [ ] Confirm profile reflects saved vocabulary and streak/progress

## 3. App Store Metadata

Taslak metinler: [`MVP.md`](./MVP.md)

- [x] App subtitle (taslak)
- [x] App description (taslak)
- [x] Keywords (taslak)
- [x] Support URL (mailto)
- [x] Privacy Policy URL
- [ ] Marketing screenshots for:
  - [ ] Onboarding
  - [ ] Reader
  - [ ] Video transcript
  - [ ] Camera OCR
  - [ ] Flashcards
  - [ ] Quiz
  - [ ] Dashboard

## 4. Privacy / Compliance

- [ ] Confirm what data is stored in Supabase
- [x] Guest words merge to Supabase on Google sign-in (`mergeGuestWordsIntoAccount`)
- [ ] Prepare App Privacy answers for:
  - [ ] Contact info
  - [ ] User content
  - [ ] Usage data
  - [ ] Diagnostics
- [ ] Verify Google login and Supabase URLs are production-ready
- [ ] Decide whether notifications/reminders are in scope for v1

## 5. Build / Submission

- [ ] `npx eas build --platform ios --profile preview`
- [ ] Install preview build on iPhone
- [ ] Run full QA pass again on build artifact
- [ ] `npx eas build --platform ios --profile production`
- [ ] `npx eas submit --platform ios --profile production`

## Notes

- Web proxy (`/Users/safa/Desktop/lexify-mobile/proxy.js`) is for local preview convenience and is not the App Store blocker.
- The real release gate is native iPhone verification, Google auth validation, and App Store metadata/privacy completion.
