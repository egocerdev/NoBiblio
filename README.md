# NoBiblio

Kendi yazılarını oluşturup yayınlayabileceğin sade bir kişisel yayın paneli.

## Başlatma

```bash
npm install
npm run dev
```

## Supabase kurulumu

1. Supabase projesi oluştur.
2. `supabase/migrations/202609160001_nobiblio.sql` dosyasını Supabase SQL Editor içinde çalıştır.
3. Ardından `supabase/migrations/202609160002_fix_auth_trigger.sql` dosyasını aynı yerde çalıştır. Bu migration, kayıt sırasında görülen `Database error saving new user` hatasını düzeltir ve daha önce oluşturulmuş kullanıcı profillerini tamamlar.
4. `.env.example` dosyasını `.env` olarak kopyala.
4. Supabase Dashboard > Settings > API alanından değerleri doldur:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. `npm run dev` ile uygulamayı aç.

Supabase değişkenleri yoksa uygulama demo modunda çalışır ve yazıları tarayıcının localStorage alanında tutar. Gerçek kayıt, giriş ve yazı kaydetme için `.env` değerleri gereklidir.

## Editör

Editörde başlık, özet, içerik, slug, kategori, kapak görseli, taslak/yayın durumu, yazı tipi ve yazı boyutu ayarlanabilir. Önizle butonu yazının seçili yazı tipi ve boyutuyla canlı görünümünü açar.
