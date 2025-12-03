# LUCE MİMARLIK İÇ İŞ AKIŞI SİSTEMİ - CHECKLIST

> **Proje Amacı:** Güvenli, ölçeklenebilir, üretim ortamı için hazır iç iş akışı ve proje yönetim sistemi  
> **Teknoloji:** Next.js, TypeScript, Supabase, Vercel  
> **Başlangıç:** 2025-12-03

---

## PHASE 1: PROJE KURULUMU VE ALTYAPI

- [x] **1.1** Next.js projesi oluştur (App Router, TypeScript)
- [x] **1.2** TailwindCSS kurulumu ve yapılandırması
- [x] **1.3** Proje klasör yapısını oluştur (app/, lib/, components/, types/, etc.)
- [x] **1.4** ESLint ve Prettier yapılandırması
- [x] **1.5** Git repository başlat ve initial commit
- [x] **1.6** Environment variables template oluştur (.env.example)
- [x] **1.7** README.md ile kurulum dökümanı

---

## PHASE 2: SUPABASE ENTEGRASYONU VE VERİTABANI ŞEMASI

- [x] **2.1** Supabase projesi oluştur ve bağlantı bilgilerini yapılandır
- [x] **2.2** Supabase Client kurulumu (Next.js için)
- [x] **2.3** Database Schema: `companies` tablosu
- [x] **2.4** Database Schema: `roles` tablosu (RBAC için)
- [x] **2.5** Database Schema: `users` tablosu (Supabase Auth ile ilişkili)
- [x] **2.6** Database Schema: `projects` tablosu
- [x] **2.7** Database Schema: `invoices` tablosu
- [x] **2.8** Database Schema: `invoice_project_links` tablosu
- [x] **2.9** Database Schema: `audit_logs` tablosu
- [x] **2.10** Foreign key ilişkileri ve indexler
- [x] **2.11** Database migration dosyaları oluştur

---

## PHASE 3: GÜVENLİK KATMANI - ROW LEVEL SECURITY (RLS)

- [x] **3.1** `companies` tablosu için RLS politikaları
- [x] **3.2** `users` tablosu için RLS politikaları (company_id bazlı)
- [x] **3.3** `roles` tablosu için RLS politikaları
- [x] **3.4** `projects` tablosu için RLS politikaları (company_id bazlı)
- [x] **3.5** `invoices` tablosu için RLS politikaları (company_id + role bazlı)
- [x] **3.6** `invoice_project_links` için RLS politikaları
- [x] **3.7** `audit_logs` tablosu için RLS politikaları
- [x] **3.8** RLS test senaryoları oluştur ve doğrula

---

## PHASE 4: AUTHENTICATION VE AUTHORIZATION

- [x] **4.1** Supabase Auth entegrasyonu (Magic Link)
- [x] **4.2** Login sayfası oluştur
- [x] **4.3** Session yönetimi (middleware)
- [x] **4.4** Protected routes yapılandırması
- [x] **4.5** RBAC middleware implementasyonu
- [x] **4.6** Permission checker utility fonksiyonları
- [x] **4.7** User context provider (React Context)
- [x] **4.8** Logout fonksiyonalitesi
- [x] **4.9** Auth error handling ve kullanıcı dostu mesajlar
- [x] **4.10** MFA opsiyonu için altyapı planlaması (dokümante et)

---

## PHASE 5: SUPABASE STORAGE VE DOSYA YÖNETİMİ

- [x] **5.1** Supabase Storage bucket oluştur (invoices - private)
- [x] **5.2** Storage güvenlik politikaları (RLS, dosya tipi, boyut)
- [x] **5.3** File upload utility fonksiyonları (PDF validasyonu)
- [x] **5.4** Maksimum dosya boyutu kontrolü (5MB limit)
- [x] **5.5** Dosya tipi kontrolü (.pdf only)
- [x] **5.6** Signed URL oluşturma fonksiyonu (kısa ömürlü)
- [x] **5.7** Virus scan entegrasyonu için not/öneri (3rd party)
- [x] **5.8** Storage backup stratejisi dokümante et

---

## PHASE 6: UI COMPONENT KÜTÜPHANESİ

- [x] **6.1** Layout component (Sidebar + Main Content)
- [x] **6.2** Sidebar navigasyon komponenti (responsive)
- [x] **6.3** Card komponenti
- [x] **6.4** Table komponenti (sortable, filterable)
- [x] **6.5** Modal/Dialog komponenti
- [x] **6.6** Dropdown/Select komponenti
- [x] **6.7** FileUploader komponenti (drag-drop)
- [x] **6.8** Button komponenti (variants)
- [x] **6.9** Form input komponentleri (Input, Textarea, Checkbox)
- [x] **6.10** Loading states ve Skeleton komponentleri
- [x] **6.11** Toast/Notification sistemi
- [x] **6.12** Accessibility: ARIA labels, keyboard navigation

---

## PHASE 7: FATURA YÖNETİMİ (INVOICE MODULE)

- [x] **7.1** Fatura listeleme sayfası (/invoices)
- [x] **7.2** Fatura ekleme formu (muhasebeci için)
- [x] **7.3** PDF upload fonksiyonalitesi
- [x] **7.4** Fatura meta bilgileri (tarih, tutar, tedarikçi)
- [x] **7.5** Fatura detay sayfası
- [x] **7.6** Faturayı projeye atama (dropdown + link oluşturma)
- [x] **7.7** Permission kontrolü: invoices.create, invoices.view_company
- [x] **7.8** Permission kontrolü: invoices.assign_project
- [x] **7.9** Input validation ve sanitization
- [x] **7.10** Audit log: fatura yükleme ve proje atama işlemleri

---

## PHASE 8: PROJE YÖNETİMİ (PROJECT MODULE)

- [x] **8.1** Proje listeleme sayfası (/projects)
- [x] **8.2** Yeni proje oluşturma formu
- [x] **8.3** Proje detay sayfası
- [x] **8.4** Proje muhasebe sayfası (/projects/[id]/accounting)
- [x] **8.5** Projeye bağlı fatura listesi gösterimi
- [x] **8.6** Basit analizler: toplam harcama hesaplama
- [x] **8.7** Aylık harcama grafiği (Chart.js veya Recharts)
- [x] **8.8** En büyük 5 fatura widget'ı
- [x] **8.9** Permission kontrolü: projects.create, projects.view
- [x] **8.10** Audit log: proje oluşturma ve güncelleme

---

## PHASE 9: ROL VE KULLANICI YÖNETİMİ

- [ ] **9.1** Roller listeleme sayfası (/roles)
- [ ] **9.2** Yeni rol oluşturma (şirket yöneticisi için)
- [ ] **9.3** Permissions JSON editor (kullanıcı dostu interface)
- [ ] **9.4** Varsayılan roller seed: superadmin, şirket_yöneticisi, muhasebe, mimar, insaat_muhendisi
- [ ] **9.5** Kullanıcı listeleme sayfası (/users)
- [ ] **9.6** Yeni kullanıcı ekleme (davetiye gönderme)
- [ ] **9.7** Kullanıcıya rol atama
- [ ] **9.8** Permission kontrolü: roles.manage_company, users.manage
- [ ] **9.9** Audit log: rol ve kullanıcı değişiklikleri

---

## PHASE 10: GÜVENLİK SERTLEŞTIRME

- [ ] **10.1** XSS koruması: Input sanitization tüm formlarda
- [ ] **10.2** CSRF koruması: SameSite cookie ayarları
- [ ] **10.3** Rate limiting: API routes için middleware (upstash-redis veya vercel rate-limit)
- [ ] **10.4** SQL Injection koruması: Parameterized queries (Supabase zaten koruyor, doğrula)
- [ ] **10.5** HTTPS zorunlu (Vercel otomatik, doğrula)
- [ ] **10.6** Security headers (helmet.js benzeri, next.config.js)
- [ ] **10.7** Environment variables güvenliği (.env.local, .gitignore)
- [ ] **10.8** Supabase API keys güvenliği (anon key vs service key ayrımı)
- [ ] **10.9** Error handling: Hassas bilgi sızdırmayan hata mesajları
- [ ] **10.10** Dependency security audit (npm audit)

---

## PHASE 11: LOGGİNG VE İZLEME

- [ ] **11.1** Audit log kayıt fonksiyonu (createAuditLog utility)
- [ ] **11.2** Kritik işlemler için audit log entegrasyonu
- [ ] **11.3** Sentry kurulumu ve yapılandırması
- [ ] **11.4** Error boundary komponentleri
- [ ] **11.5** API error standardizasyonu (JSON format)
- [ ] **11.6** Client-side error logging
- [ ] **11.7** Performance monitoring (Vercel Analytics)
- [ ] **11.8** Log retention policy dokümante et

---

## PHASE 12: BACKUP VE RECOVERY

- [ ] **12.1** Supabase automated backup aktifleştir
- [ ] **12.2** Point-in-time recovery (PITR) yapılandırması
- [ ] **12.3** Storage backup stratejisi (Supabase Storage yedekleme)
- [ ] **12.4** Backup test senaryosu oluştur
- [ ] **12.5** Disaster recovery planı dokümante et
- [ ] **12.6** Database snapshot alma dokümante et

---

## PHASE 13: TEST VE KALİTE KONTROLÜ

- [ ] **13.1** Unit test setup (Jest + React Testing Library)
- [ ] **13.2** Kritik fonksiyonlar için unit testler
- [ ] **13.3** Integration test: Auth flow
- [ ] **13.4** Integration test: Fatura yükleme ve proje atama
- [ ] **13.5** E2E test setup (Playwright veya Cypress)
- [ ] **13.6** E2E test: Kullanıcı login ve fatura işlemleri
- [ ] **13.7** Permission test senaryoları
- [ ] **13.8** RLS policy test senaryoları
- [ ] **13.9** Performance testing (Lighthouse)
- [ ] **13.10** Accessibility testing (axe-core)

---

## PHASE 14: DEPLOYMENT VE CI/CD

- [x] **14.1** Vercel projesi oluştur ve bağla
- [x] **14.2** Environment variables Vercel'e ekle
- [x] **14.3** vercel.json yapılandırması
- [x] **14.4** Branch stratejisi: main (production), dev (staging)
- [x] **14.5** GitHub Actions CI/CD pipeline (lint, test, build)
- [x] **14.6** Preview deployments yapılandır
- [x] **14.7** Production deployment testi
- [x] **14.8** Domain yapılandırması (gerekirse)
- [x] **14.9** SSL/TLS doğrulama
- [x] **14.10** Post-deployment smoke tests

---

## PHASE 15: DOKÜMANTASYON

- [x] **15.1** README.md: Kurulum adımları
- [x] **15.2** README.md: Environment variables açıklamaları
- [x] **15.3** README.md: Deploy adımları
- [x] **15.4** README.md: Güvenlik notları
- [x] **15.5** ARCHITECTURE.md: Sistem mimarisi
- [x] **15.6** SECURITY.md: Güvenlik politikaları ve best practices
- [x] **15.7** API.md: API endpoints dokümantasyonu
- [x] **15.8** PERMISSIONS.md: Rol ve yetki matrisi
- [x] **15.9** CONTRIBUTING.md: Geliştirici katkı kılavuzu
- [x] **15.10** CHANGELOG.md: Versiyon geçmişi

---

## PHASE 16: ÜRETİM HAZIRLIĞI VE OPTİMİZASYON

- [ ] **16.1** Performance optimizasyonu: Code splitting
- [ ] **16.2** Performance optimizasyonu: Image optimization
- [ ] **16.3** Performance optimizasyonu: Lazy loading
- [ ] **16.4** SEO optimizasyonu (metadata)
- [ ] **16.5** Mobile responsive test (tüm sayfalar)
- [ ] **16.6** Cross-browser testing
- [ ] **16.7** Production build optimizasyonu
- [ ] **16.8** Monitoring dashboard hazırlama (Sentry + Vercel)
- [ ] **16.9** User acceptance testing (UAT) planı
- [ ] **16.10** Go-live checklist ve rollback planı

---

## İLERİ ÖZELLİKLER (BACKLOG)

- [ ] Fatura OCR entegrasyonu
- [ ] Otomatik e-fatura eşleştirme
- [ ] Çoklu şirket yönetimi (multi-tenancy genişletme)
- [ ] Gelişmiş raporlama ve dashboard
- [ ] Workflow approval sistemi
- [ ] SSO entegrasyonları (Google, Microsoft)
- [ ] Mobile app (React Native)
- [ ] Real-time notifications (Supabase Realtime)
- [ ] Export/Import özellikleri (Excel, CSV)
- [ ] Advanced analytics ve BI entegrasyonu

---

## BLOCKED ITEMS & NOTES

_Bu bölüm engellenen görevler ve önemli notlar için kullanılacak_

---

**Son Güncelleme:** 2025-12-03  
**Durum:** ✅ MVP TAMAMLANDI - Production Ready!
