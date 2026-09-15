import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const emptyPost = { id: null, title: '', slug: '', excerpt: '', content: '', category: 'Genel', status: 'draft', cover_image: '', font_family: 'Inter', font_size: 18 }
const demoPosts = [{ id: 'demo-1', title: 'Not almak, düşüncenin ilk biçimidir', slug: 'not-almak-dusunmenin-ilk-bicimidir', excerpt: 'Kafamızın içindeki dağınık sesleri görünür kılmanın en basit yolu üzerine.', content: '<p>Bir fikri yazmak, onu dünyaya bırakmadan önce ona bir biçim vermektir.</p><p>Bu alan Supabase baglantin kuruldugunda gercek yazilarinla dolacak.</p>', category: 'Genel', status: 'published', cover_image: '', font_family: 'Inter', font_size: 18, created_at: new Date().toISOString() }]

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
  const isConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) loadPosts() }, [session])

  async function loadPosts() {
    if (!supabase) { setPosts(JSON.parse(localStorage.getItem('nobiblio-posts') || 'null') || demoPosts); return }
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (!error) setPosts(data || [])
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
  const visiblePosts = useMemo(() => posts.filter((post) => (filter === 'all' || post.status === filter) && `${post.title} ${post.excerpt}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))), [posts, filter, query])
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Editör'
  if (authLoading) return <div className="loading-screen"><span className="logo-mark">NB</span>Yükleniyor...</div>
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} update={updateAuth} submit={submitAuth} message={authMessage} configured={isConfigured} />
  return <div className="app-layout"><aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}><div className="brand"><span className="logo-mark">NB</span><span>NoBiblio</span></div><nav><button className={view === 'posts' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('posts'); setSidebarOpen(false) }}><span>▤</span> Yazılar</button><button className={view === 'editor' ? 'nav-item active' : 'nav-item'} onClick={beginNewPost}><span>＋</span> Yeni yazı</button></nav><div className="sidebar-bottom"><div className="mini-profile"><span>{userName.slice(0, 1).toUpperCase()}</span><div><strong>{userName}</strong><small>Editör</small></div></div><button className="logout" onClick={() => supabase ? supabase.auth.signOut() : setSession(null)}>Çıkış yap <span>↪</span></button></div></aside><div className="workspace"><header className="workspace-header"><button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button><div><span className="breadcrumb">NoBiblio / </span><strong>{view === 'posts' ? 'Yazılar' : editingPost.id ? 'Yazıyı düzenle' : 'Yeni yazı'}</strong></div><div className="header-user"><span>{userName.slice(0, 1).toUpperCase()}</span>{userName}</div></header><main className="content">{view === 'posts' ? <PostList posts={visiblePosts} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} newPost={beginNewPost} editPost={beginEdit} deletePost={deletePost} /> : <Editor post={editingPost} update={updatePost} save={savePost} message={postMessage} back={() => setView('posts')} />}</main></div></div>
}

function AuthScreen({ mode, setMode, form, update, submit, message, configured }) { return <main className="auth-shell"><section className="auth-panel"><div className="auth-brand"><span className="logo-mark">NB</span><span>NoBiblio</span></div><div className="auth-copy"><span className="overline">Kişisel yayın alanın</span><h1>Düşüncelerini<br /><em>yayınla.</em></h1><p>Yaz, düzenle ve kendi arşivini oluştur.</p></div><div className="auth-form-wrap"><div className="auth-tabs"><button className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>Giriş yap</button><button className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>Kayıt ol</button></div><form onSubmit={submit}>{mode === 'signup' && <label>Adın<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Nasıl hitap edelim?" required /></label>}<label>E-posta<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="ornek@mail.com" required /></label><label>Şifre<input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="En az 6 karakter" minLength="6" required /></label><button className="primary-button" type="submit">{mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'} <span>↗</span></button></form>{message && <p className="form-message">{message}</p>}{!configured && <p className="config-note">Supabase bağlantısı yok. Demo modunda giriş yapabilirsin. Gerçek hesaplar için `.env` dosyanı oluştur.</p>}</div></section><div className="auth-side"><div className="side-quote">“<br /><em>Yazmak, zihnin<br />kendine açtığı<br />bir penceredir.</em><br /><small>NoBiblio / 01</small></div><div className="side-shape">NB</div></div></main> }

function PostList({ posts, query, setQuery, filter, setFilter, newPost, editPost, deletePost }) { return <><div className="page-heading"><div><span className="overline">Kontrol paneli</span><h1>Yazılar</h1><p>Fikirlerinin bulunduğu yer.</p></div><button className="primary-button" onClick={newPost}>Yeni yazı <span>＋</span></button></div><div className="toolbar"><div className="search-input"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Yazılarda ara..." /></div><div className="status-tabs">{[['all', 'Tümü'], ['published', 'Yayında'], ['draft', 'Taslak']].map(([key, label]) => <button className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div></div><div className="posts-table">{posts.length ? posts.map((post) => <article className="post-row" key={post.id} onClick={() => editPost(post)}><div className="post-thumb">{post.cover_image ? <img src={post.cover_image} alt="" /> : <span>{post.title.slice(0, 1) || 'N'}</span>}</div><div className="post-info"><h2>{post.title || 'Başlıksız yazı'}</h2><p>{post.excerpt || 'Özet eklenmemiş'}</p><small>{new Date(post.created_at || Date.now()).toLocaleDateString('tr-TR')} · {post.category}</small></div><span className={`status ${post.status}`}>{post.status === 'published' ? 'Yayında' : 'Taslak'}</span><button className="row-delete" onClick={(event) => { event.stopPropagation(); deletePost(post.id) }} aria-label="Yazıyı sil">×</button><span className="row-arrow">↗</span></article>) : <div className="empty-list"><span>○</span><h2>Henüz yazın yok</h2><p>İlk fikrini yazmaya hazır mısın?</p><button onClick={newPost}>İlk yazını oluştur <span>↗</span></button></div>}</div></> }

function Editor({ post, update, save, message, back }) { const [preview, setPreview] = useState(false); return <form className="editor" onSubmit={save}><div className="editor-top"><button className="back-button" type="button" onClick={back}>← Yazılara dön</button><div className="editor-actions">{message && <span className="save-message">{message}</span>}<button className="secondary-button" type="button" onClick={() => setPreview(!preview)}>{preview ? 'Düzenle' : 'Önizle'}</button><button className="primary-button" type="submit">{post.status === 'published' ? 'Güncelle' : 'Kaydet'} <span>↗</span></button></div></div>{preview ? <article className="preview"><span className="overline">{post.category}</span><h1>{post.title || 'Başlıksız yazı'}</h1><p className="preview-excerpt">{post.excerpt}</p><div className="preview-content" style={{ fontFamily: post.font_family, fontSize: `${post.font_size}px` }} dangerouslySetInnerHTML={{ __html: post.content || '<p>İçerik önizlemesi burada görünür.</p>' }} /></article> : <div className="editor-grid"><section className="editor-main"><input className="title-input" value={post.title} onChange={(event) => update('title', event.target.value)} placeholder="Yazı başlığı" /><textarea className="excerpt-input" value={post.excerpt} onChange={(event) => update('excerpt', event.target.value)} placeholder="Yazının kısa özeti..." rows="2" /><textarea className="content-input" value={post.content} onChange={(event) => update('content', event.target.value)} placeholder="Hikâyeni buraya yaz... HTML kullanabilirsin." rows="18" /></section><aside className="editor-settings"><div className="settings-card"><h3>Yayın ayarları</h3><label>Durum<select value={post.status} onChange={(event) => update('status', event.target.value)}><option value="draft">Taslak</option><option value="published">Yayında</option></select></label><label>Kategori<input value={post.category} onChange={(event) => update('category', event.target.value)} placeholder="Genel" /></label><label>Slug<input value={post.slug} onChange={(event) => update('slug', event.target.value)} placeholder="yazi-basligi" /></label><label>Kapak görseli<input value={post.cover_image} onChange={(event) => update('cover_image', event.target.value)} placeholder="https://..." /></label></div><div className="settings-card"><h3>Okuma deneyimi</h3><label>Yazı tipi<select value={post.font_family} onChange={(event) => update('font_family', event.target.value)}><option>Inter</option><option>Georgia</option><option>Arial</option><option>Courier New</option><option>Verdana</option></select></label><label>Punto <output>{post.font_size}px</output><input type="range" min="14" max="28" value={post.font_size} onChange={(event) => update('font_size', Number(event.target.value))} /></label><div className="font-preview" style={{ fontFamily: post.font_family, fontSize: `${post.font_size}px` }}>Böyle görünecek.</div></div></aside></div>}</form> }

export default App
