import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const emptyPost = { id: null, title: '', slug: '', excerpt: '', content: '', category: 'Genel', status: 'draft', cover_image: '', font_family: 'Inter', font_size: 18 }
const demoPosts = [{ id: 'demo-1', title: 'Not almak, düşüncenin ilk biçimidir', slug: 'not-almak-dusunmenin-ilk-bicimidir', excerpt: 'Kafamızın içindeki dağınık sesleri görünür kılmanın en basit yolu üzerine.', content: '<p>Bir fikri yazmak, onu dünyaya bırakmadan önce ona bir biçim vermektir.</p><p>Bu alan Supabase baglantin kuruldugunda gercek yazilarinla dolacak.</p>', category: 'Genel', status: 'published', cover_image: '', font_family: 'Inter', font_size: 18, created_at: new Date().toISOString() }]
const uploadHandlers = { avatar: null, cover: null }

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authMessage, setAuthMessage] = useState('')
  const [posts, setPosts] = useState([])
  const [view, setView] = useState('posts')
  const [editingPost, setEditingPost] = useState(emptyPost)
  const [postMessage, setPostMessage] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [socialPosts, setSocialPosts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [following, setFollowing] = useState(new Set())
  const [followingProfiles, setFollowingProfiles] = useState([])
  const [followerProfiles, setFollowerProfiles] = useState([])
  const [comments, setComments] = useState({})
  const [socialMessage, setSocialMessage] = useState('')
  const [profileForm, setProfileForm] = useState({ display_name: '', bio: '', avatar_url: '', website_url: '' })
  const [uploading, setUploading] = useState(false)
  const isConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) { loadPosts(); loadSocial() } }, [session])

  async function loadPosts() {
    if (!supabase) { setPosts(JSON.parse(localStorage.getItem('nobiblio-posts') || 'null') || demoPosts); return }
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (!error) setPosts(data || [])
  }
  async function loadSocial() {
    if (!supabase) { setSocialPosts(posts.filter((post) => post.status === 'published')); return }
    const [{ data: postData }, { data: profileData }, { data: follows }, { data: followers }] = await Promise.all([
      supabase.from('posts').select('*').eq('status', 'published').order('published_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('follows').select('following_id').eq('follower_id', session.user.id).eq('status', 'accepted'),
      supabase.from('follows').select('follower_id').eq('following_id', session.user.id).eq('status', 'accepted'),
    ])
    setSocialPosts(postData || [])
    setProfiles(Object.fromEntries((profileData || []).map((profile) => [profile.id, profile])))
    setFollowing(new Set((follows || []).map((follow) => follow.following_id)))
    setFollowingProfiles((follows || []).map((follow) => (profileData || []).find((profile) => profile.id === follow.following_id)).filter(Boolean))
    setFollowerProfiles((followers || []).map((follow) => (profileData || []).find((profile) => profile.id === follow.follower_id)).filter(Boolean))
    const ownProfile = (profileData || []).find((profile) => profile.id === session.user.id)
    if (ownProfile) setProfileForm({ display_name: ownProfile.display_name || ownProfile.full_name || '', bio: ownProfile.bio || '', avatar_url: ownProfile.avatar_url || '', website_url: ownProfile.website_url || '' })
  }
  async function submitAuth(event) {
    event.preventDefault(); setAuthMessage('')
    if (!supabase) { setSession({ user: { email: authForm.email, user_metadata: { full_name: authForm.name || 'Editör' } } }); return }
    const result = authMode === 'login' ? await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password }) : await supabase.auth.signUp({ email: authForm.email, password: authForm.password, options: { data: { full_name: authForm.name } } })
    if (result.error) setAuthMessage(result.error.message); else if (authMode === 'signup') setAuthMessage('Hesabın oluşturuldu. E-posta onayını kontrol et.')
  }
  function updateAuth(field, value) { setAuthForm((current) => ({ ...current, [field]: value })) }
  function beginNewPost() { setEditingPost({ ...emptyPost }); setPostMessage(''); setView('editor'); setSidebarOpen(false) }
  function beginEdit(post) { setEditingPost({ ...post }); setPostMessage(''); setView('editor'); setSidebarOpen(false) }
  function updatePost(field, value) { setEditingPost((current) => ({ ...current, [field]: value })) }
  async function savePost(event) {
    event.preventDefault(); setPostMessage('')
    if (!editingPost.title.trim()) { setPostMessage('Başlık gerekli.'); return }
    const { id: _id, created_at: _createdAt, ...postFields } = editingPost
    const payload = { ...postFields, slug: editingPost.slug || editingPost.title.toLowerCase().replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ]+/gi, '-').replace(/^-|-$/g, ''), updated_at: new Date().toISOString() }
    if (!supabase) { const nextPosts = editingPost.id ? posts.map((post) => post.id === editingPost.id ? { ...post, ...payload } : post) : [{ ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() }, ...posts]; localStorage.setItem('nobiblio-posts', JSON.stringify(nextPosts)); setPosts(nextPosts); setPostMessage('Taslak kaydedildi.'); setView('posts'); return }
    const { error } = editingPost.id ? await supabase.from('posts').update(payload).eq('id', editingPost.id) : await supabase.from('posts').insert({ ...payload, author_id: session.user.id })
    if (error) setPostMessage(error.message); else { await loadPosts(); setPostMessage('Yazı kaydedildi.'); setView('posts') }
  }
  async function deletePost(id) {
    if (!window.confirm('Bu yazıyı silmek istediğine emin misin?')) return
    if (supabase) await supabase.from('posts').delete().eq('id', id)
    const nextPosts = posts.filter((post) => post.id !== id); setPosts(nextPosts); localStorage.setItem('nobiblio-posts', JSON.stringify(nextPosts))
  }
  async function toggleFollow(authorId) {
    if (authorId === session.user.id) return
    if (!supabase) return
    if (following.has(authorId)) await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', authorId)
    else await supabase.from('follows').upsert({ follower_id: session.user.id, following_id: authorId, status: 'accepted' })
    await loadSocial()
  }
  async function loadComments(postId) {
    if (!supabase) return
    const { data } = await supabase.from('comments').select('*').eq('post_id', postId).eq('status', 'visible').order('created_at', { ascending: true })
    setComments((current) => ({ ...current, [postId]: data || [] }))
  }
  async function addComment(postId, body) {
    if (!body.trim()) return
    if (!supabase) return
    const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: session.user.id, body: body.trim() })
    if (error) setSocialMessage(error.message); else await loadComments(postId)
  }
  async function saveProfile(event) {
    event.preventDefault(); setSocialMessage('')
    if (!supabase) { setSocialMessage('Profil ayarları demo modunda saklanamaz.'); return }
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, ...profileForm, updated_at: new Date().toISOString() })
    setSocialMessage(error ? error.message : 'Profil güncellendi.'); if (!error) await loadSocial()
  }
  async function uploadImage(bucket, file) {
    if (!supabase || !file) return null
    if (!file.type.startsWith('image/')) { setSocialMessage('Sadece görsel dosyaları yükleyebilirsin.'); return null }
    if (file.size > 5 * 1024 * 1024) { setSocialMessage('Görsel boyutu 5 MB altında olmalı.'); return null }
    setUploading(true); setSocialMessage('Görsel yükleniyor...')
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-')
    const path = `${session.user.id}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' })
    if (error) { setUploading(false); setSocialMessage(error.message); return null }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    setUploading(false); setSocialMessage('Görsel yüklendi.')
    return data.publicUrl
  }
  async function uploadAvatar(file) {
    const publicUrl = await uploadImage('profile-avatars', file)
    if (publicUrl) setProfileForm((current) => ({ ...current, avatar_url: publicUrl }))
  }
  async function uploadCover(file) {
    const publicUrl = await uploadImage('post-covers', file)
    if (publicUrl) setEditingPost((current) => ({ ...current, cover_image: publicUrl }))
  }
  async function rateAuthor(authorId, honestyScore, reliabilityScore, note) {
    if (authorId === session.user.id) { setSocialMessage('Kendine puan veremezsin.'); return }
    if (!supabase) { setSocialMessage('Puanlama için Supabase bağlantısı gerekli.'); return }
    const { error } = await supabase.from('author_ratings').upsert({ rater_id: session.user.id, author_id: authorId, honesty_score: honestyScore, reliability_score: reliabilityScore, note, updated_at: new Date().toISOString() })
    setSocialMessage(error ? error.message : 'Puanın kaydedildi.')
  }
  async function reportTarget(target) {
    if (!supabase) return
    const reason = window.prompt('Şikâyet nedeni: spam, harassment, copyright, misinformation veya other')
    if (!['spam', 'harassment', 'copyright', 'misinformation', 'other'].includes(reason)) return
    const details = window.prompt('Kısa açıklama (isteğe bağlı):') || ''
    const { error } = await supabase.from('reports').insert({ reporter_id: session.user.id, ...target, reason, details })
    setSocialMessage(error ? error.message : 'Şikâyetin moderasyona gönderildi.')
  }
  async function quotePost(post, quoteText, note) {
    if (!supabase) { setSocialMessage('Alıntılamak için Supabase bağlantısı gerekli.'); return }
    if (!quoteText?.trim()) return
    const { error } = await supabase.from('quotes').insert({ author_id: session.user.id, source_post_id: post.id, quote_text: quoteText.trim(), note })
    setSocialMessage(error ? error.message : 'Alıntı profiline eklendi.')
  }
  const visiblePosts = useMemo(() => posts.filter((post) => (filter === 'all' || post.status === filter) && `${post.title} ${post.excerpt}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))), [posts, filter, query])
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Editör'
  uploadHandlers.avatar = uploadAvatar
  uploadHandlers.cover = uploadCover
  if (authLoading) return <div className="loading-screen"><span className="logo-mark">NB</span>Yükleniyor...</div>
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} update={updateAuth} submit={submitAuth} message={authMessage} configured={isConfigured} />
  return <div className="app-layout"><aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}><div className="brand"><span className="logo-mark">NB</span><span>NoBiblio</span></div><nav><button className={view === 'feed' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('feed'); setSidebarOpen(false) }}><span>◉</span> Akış</button><button className={view === 'posts' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('posts'); setSidebarOpen(false) }}><span>▤</span> Yazılarım</button><button className={view === 'profile' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('profile'); setSidebarOpen(false) }}><span>◎</span> Profilim</button><button className={view === 'editor' ? 'nav-item active' : 'nav-item'} onClick={beginNewPost}><span>＋</span> Yeni yazı</button></nav><div className="sidebar-bottom"><div className="mini-profile"><span>{userName.slice(0, 1).toUpperCase()}</span><div><strong>{userName}</strong><small>Editör</small></div></div><button className="logout" onClick={() => supabase ? supabase.auth.signOut() : setSession(null)}>Çıkış yap <span>↪</span></button></div></aside><div className="workspace"><header className="workspace-header"><button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button><div><span className="breadcrumb">NoBiblio / </span><strong>{view === 'feed' ? 'Akış' : view === 'profile' ? 'Profilim' : view === 'posts' ? 'Yazılarım' : editingPost.id ? 'Yazıyı düzenle' : 'Yeni yazı'}</strong></div><div className="header-user"><span>{userName.slice(0, 1).toUpperCase()}</span>{userName}</div></header><main className="content">{view === 'feed' ? <Feed posts={socialPosts} profiles={profiles} following={following} comments={comments} message={socialMessage} toggleFollow={toggleFollow} loadComments={loadComments} addComment={addComment} quotePost={quotePost} reportTarget={reportTarget} rateAuthor={rateAuthor} /> : view === 'profile' ? <Profile form={profileForm} setForm={setProfileForm} save={saveProfile} uploadAvatar={uploadAvatar} message={socialMessage} uploading={uploading} followingProfiles={followingProfiles} followerProfiles={followerProfiles} /> : view === 'posts' ? <PostList posts={visiblePosts} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} newPost={beginNewPost} editPost={beginEdit} deletePost={deletePost} /> : <Editor post={editingPost} update={updatePost} save={savePost} message={postMessage} back={() => setView('posts')} uploadCover={uploadCover} uploading={uploading} />}</main></div></div>
}

function AuthScreen({ mode, setMode, form, update, submit, message, configured }) { return <main className="auth-shell"><section className="auth-panel"><div className="auth-brand"><span className="logo-mark">NB</span><span>NoBiblio</span></div><div className="auth-copy"><span className="overline">Kişisel yayın alanın</span><h1>Düşüncelerini<br /><em>yayınla.</em></h1><p>Yaz, düzenle ve kendi arşivini oluştur.</p></div><div className="auth-form-wrap"><div className="auth-tabs"><button className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>Giriş yap</button><button className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>Kayıt ol</button></div><form onSubmit={submit}>{mode === 'signup' && <label>Adın<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Nasıl hitap edelim?" required /></label>}<label>E-posta<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="ornek@mail.com" required /></label><label>Şifre<input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="En az 6 karakter" minLength="6" required /></label><button className="primary-button" type="submit">{mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'} <span>↗</span></button></form>{message && <p className="form-message">{message}</p>}{!configured && <p className="config-note">Supabase bağlantısı yok. Demo modunda giriş yapabilirsin. Gerçek hesaplar için `.env` dosyanı oluştur.</p>}</div></section><div className="auth-side"><div className="side-quote">“<br /><em>Yazmak, zihnin<br />kendine açtığı<br />bir penceredir.</em><br /><small>NoBiblio / 01</small></div><div className="side-shape">NB</div></div></main> }

function PostList({ posts, query, setQuery, filter, setFilter, newPost, editPost, deletePost }) { return <><div className="page-heading"><div><span className="overline">Kontrol paneli</span><h1>Yazılar</h1><p>Fikirlerinin bulunduğu yer.</p></div><button className="primary-button" onClick={newPost}>Yeni yazı <span>＋</span></button></div><div className="toolbar"><div className="search-input"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Yazılarda ara..." /></div><div className="status-tabs">{[['all', 'Tümü'], ['published', 'Yayında'], ['draft', 'Taslak']].map(([key, label]) => <button className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div></div><div className="posts-table">{posts.length ? posts.map((post) => <article className="post-row" key={post.id} onClick={() => editPost(post)}><div className="post-thumb">{post.cover_image ? <img src={post.cover_image} alt="" /> : <span>{post.title.slice(0, 1) || 'N'}</span>}</div><div className="post-info"><h2>{post.title || 'Başlıksız yazı'}</h2><p>{post.excerpt || 'Özet eklenmemiş'}</p><small>{new Date(post.created_at || Date.now()).toLocaleDateString('tr-TR')} · {post.category}</small></div><span className={`status ${post.status}`}>{post.status === 'published' ? 'Yayında' : 'Taslak'}</span><button className="row-delete" onClick={(event) => { event.stopPropagation(); deletePost(post.id) }} aria-label="Yazıyı sil">×</button><span className="row-arrow">↗</span></article>) : <div className="empty-list"><span>○</span><h2>Henüz yazın yok</h2><p>İlk fikrini yazmaya hazır mısın?</p><button onClick={newPost}>İlk yazını oluştur <span>↗</span></button></div>}</div></> }

function Editor({ post, update, save, message, back, uploading }) {
  const [preview, setPreview] = useState(false)
  return <form className="editor" onSubmit={save}>
    <div className="editor-top"><button className="back-button" type="button" onClick={back}>← Yazılara dön</button><div className="editor-actions">{message && <span className="save-message">{message}</span>}<button className="secondary-button" type="button" onClick={() => setPreview(!preview)}>{preview ? 'Düzenle' : 'Önizle'}</button><button className="primary-button" type="submit">{post.status === 'published' ? 'Güncelle' : 'Kaydet'} <span>↗</span></button></div></div>
    {preview ? <article className="preview"><span className="overline">{post.category}</span><h1>{post.title || 'Başlıksız yazı'}</h1><p className="preview-excerpt">{post.excerpt}</p><div className="preview-content" style={{ fontFamily: post.font_family, fontSize: `${post.font_size}px` }} dangerouslySetInnerHTML={{ __html: post.content || '<p>İçerik önizlemesi burada görünür.</p>' }} /></article> : <div className="editor-grid"><section className="editor-main"><input className="title-input" value={post.title} onChange={(event) => update('title', event.target.value)} placeholder="Yazı başlığı" /><textarea className="excerpt-input" value={post.excerpt} onChange={(event) => update('excerpt', event.target.value)} placeholder="Yazının kısa özeti..." rows="2" /><textarea className="content-input" value={post.content} onChange={(event) => update('content', event.target.value)} placeholder="Hikâyeni buraya yaz... HTML kullanabilirsin." rows="18" /></section><aside className="editor-settings"><div className="settings-card"><h3>Yayın ayarları</h3><label>Durum<select value={post.status} onChange={(event) => update('status', event.target.value)}><option value="draft">Taslak</option><option value="published">Yayında</option></select></label><label>Kategori<input value={post.category} onChange={(event) => update('category', event.target.value)} placeholder="Genel" /></label><label>Slug<input value={post.slug} onChange={(event) => update('slug', event.target.value)} placeholder="yazi-basligi" /></label><label>Kapak görseli<input type="file" accept="image/*" onChange={(event) => uploadHandlers.cover?.(event.target.files?.[0])} />{uploading && <small>Yükleniyor...</small>}{post.cover_image && <small className="upload-done">Kapak görseli yüklendi.</small>}</label></div><div className="settings-card"><h3>Okuma deneyimi</h3><label>Yazı tipi<select value={post.font_family} onChange={(event) => update('font_family', event.target.value)}><option>Inter</option><option>Georgia</option><option>Arial</option><option>Courier New</option><option>Verdana</option></select></label><label>Punto <output>{post.font_size}px</output><input type="range" min="14" max="28" value={post.font_size} onChange={(event) => update('font_size', Number(event.target.value))} /></label><div className="font-preview" style={{ fontFamily: post.font_family, fontSize: `${post.font_size}px` }}>Böyle görünecek.</div></div></aside></div>}
  </form>
}

function Feed({ posts, profiles, following, comments, message, toggleFollow, loadComments, addComment, quotePost, reportTarget, rateAuthor }) {
  return <div className="social-page"><div className="page-heading"><div><span className="overline">Topluluk</span><h1>Akış</h1><p>Takip ettiklerinin ve topluluğun yeni yazıları.</p></div><span className="feed-note">{posts.length} yayın</span></div>{message && <div className="social-message">{message}</div>}<div className="feed-list">{posts.length ? posts.map((post) => <SocialPost key={post.id} post={post} profile={profiles[post.author_id]} isFollowing={following.has(post.author_id)} comments={comments[post.id] || []} toggleFollow={toggleFollow} loadComments={loadComments} addComment={addComment} quotePost={quotePost} reportTarget={reportTarget} rateAuthor={rateAuthor} />) : <div className="empty-list"><span>◌</span><h2>Akış henüz sessiz</h2><p>İlk yazılar yayınlandığında burada görünecek.</p></div>}</div></div>
}

function SocialPost({ post, profile, isFollowing, comments, toggleFollow, loadComments, addComment, quotePost, reportTarget, rateAuthor }) {
  const [comment, setComment] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [showQuote, setShowQuote] = useState(false)
  const [quoteText, setQuoteText] = useState(post.excerpt || post.title)
  const [quoteNote, setQuoteNote] = useState('')
  const authorName = profile?.display_name || profile?.full_name || 'Adsız yazar'
  async function submitComment() { if (comment.trim()) { await addComment(post.id, comment); setComment('') } }
  return <article className="social-post"><div className="social-post-head"><div className="social-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : authorName.slice(0, 1).toUpperCase()}</div><div><strong>{authorName}</strong><small>{new Date(post.published_at || post.created_at).toLocaleDateString('tr-TR')} · {post.category}</small></div><button className="more-button" onClick={() => reportTarget({ post_id: post.id })}>•••</button></div><h2>{post.title}</h2>{post.cover_image && <img className="social-cover" src={post.cover_image} alt="" />}<p className="social-excerpt">{post.excerpt}</p><div className="social-content" dangerouslySetInnerHTML={{ __html: post.content }} /><div className="social-actions"><button onClick={() => { setShowComments(!showComments); if (!showComments) loadComments(post.id) }}>◯ Yorumlar {comments.length ? `(${comments.length})` : ''}</button><button onClick={() => setShowQuote(!showQuote)}>❝ Alıntıla</button><button onClick={() => setShowRating(!showRating)}>☆ Puanla</button>{post.author_id && <button className={isFollowing ? 'following' : ''} onClick={() => toggleFollow(post.author_id)}>{isFollowing ? 'Takiptesin' : '+ Takip et'}</button>}</div>{showQuote && <div className="quote-editor"><span className="overline">Yeni alıntı</span><textarea value={quoteText} onChange={(event) => setQuoteText(event.target.value)} maxLength="1000" rows="3" placeholder="Alıntı metni" /><input value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} maxLength="1000" placeholder="Kendi yorumun (isteğe bağlı)" /><div><button className="secondary-button" onClick={() => setShowQuote(false)}>Vazgeç</button><button className="primary-button" onClick={() => { quotePost(post, quoteText, quoteNote); setShowQuote(false) }}>Alıntıyı paylaş ↗</button></div></div>}{showRating && <RatingForm authorId={post.author_id} rateAuthor={rateAuthor} />}{showComments && <div className="comments"><div className="comment-form"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Düşünceni yaz..." onKeyDown={(event) => { if (event.key === 'Enter') submitComment() }} /><button onClick={submitComment}>Gönder</button></div>{comments.map((item) => <div className="comment" key={item.id}><span className="comment-avatar">{item.author_id.slice(0, 1).toUpperCase()}</span><p>{item.body}<small>{new Date(item.created_at).toLocaleDateString('tr-TR')}</small></p></div>)}</div>}</article>
}

function RatingForm({ authorId, rateAuthor }) { const [honesty, setHonesty] = useState(5); const [reliability, setReliability] = useState(5); const [note, setNote] = useState(''); return <div className="rating-form"><label>Dürüstlük<select value={honesty} onChange={(event) => setHonesty(Number(event.target.value))}><option value="1">1 / 5</option><option value="2">2 / 5</option><option value="3">3 / 5</option><option value="4">4 / 5</option><option value="5">5 / 5</option></select></label><label>Güvenilirlik<select value={reliability} onChange={(event) => setReliability(Number(event.target.value))}><option value="1">1 / 5</option><option value="2">2 / 5</option><option value="3">3 / 5</option><option value="4">4 / 5</option><option value="5">5 / 5</option></select></label><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Kısa not (isteğe bağlı)" /><button onClick={() => rateAuthor(authorId, honesty, reliability, note)}>Puanı gönder</button></div> }

function Profile({ form, setForm, save, message, followingProfiles = [], followerProfiles = [] }) { return <div className="profile-page"><div className="page-heading"><div><span className="overline">Sosyal ayarlar</span><h1>Profilim</h1><p>İnsanların seni tanıması için alanını düzenle.</p></div></div><div className="connection-stats"><div><strong>{followingProfiles.length}</strong><span>Takip ettiklerim</span></div><div><strong>{followerProfiles.length}</strong><span>Takipçilerim</span></div></div><form className="profile-form" onSubmit={save}><div className="profile-preview"><div className="large-avatar">{form.avatar_url ? <img src={form.avatar_url} alt="" /> : (form.display_name || 'N').slice(0, 1).toUpperCase()}</div><strong>{form.display_name || 'İsmin'}</strong><p>{form.bio || 'Bio alanın burada görünecek.'}</p></div><label>Görünen ad<input value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} placeholder="Adın veya kullanıcı adın" required /></label><label>Profil fotoğrafı<input type="file" accept="image/*" onChange={(event) => uploadHandlers.avatar?.(event.target.files?.[0])} />{form.avatar_url && <small className="upload-done">Profil fotoğrafı yüklendi.</small>}</label><label>Bio<textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} maxLength="280" rows="4" placeholder="Kendinden kısaca bahset..." /></label><label>Web sitesi<input value={form.website_url} onChange={(event) => setForm({ ...form, website_url: event.target.value })} placeholder="https://..." /></label><button className="primary-button" type="submit">Profili kaydet <span>↗</span></button>{message && <p className="form-message">{message}</p>}</form><div className="connection-lists"><ConnectionList title="Takip ettiklerim" profiles={followingProfiles} empty="Henüz kimseyi takip etmiyorsun." /><ConnectionList title="Takipçilerim" profiles={followerProfiles} empty="Henüz takipçin yok." /></div></div> }

function ConnectionList({ title, profiles, empty }) { return <section className="connection-list"><h2>{title}</h2>{profiles.length ? profiles.map((profile) => <div className="connection-person" key={profile.id}><div className="comment-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile.display_name || profile.full_name || 'N').slice(0, 1).toUpperCase()}</div><span>{profile.display_name || profile.full_name || 'Adsız yazar'}<small>{profile.bio || 'NoBiblio yazarı'}</small></span></div>) : <p>{empty}</p>}</section> }

export default App
