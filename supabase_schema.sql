-- =============================================
-- GifWave Supabase DB Şeması
-- Supabase SQL Editor'de çalıştır
-- =============================================

-- Profiller (auth.users'ı genişletir)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Postlar
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gif_url TEXT NOT NULL,
  caption TEXT,
  tags TEXT[],
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'upload', -- upload | giphy | converted
  music_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beğeniler (composite PK)
CREATE TABLE IF NOT EXISTS likes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Yorumlar
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Takip (composite PK)
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Profil doğrulaması
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Yorum beğenileri
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- Gizlilik ayarları
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT FALSE,
  who_can_comment TEXT DEFAULT 'all',
  who_can_reply TEXT DEFAULT 'all',
  show_liked_posts BOOLEAN DEFAULT TRUE,
  allow_dm BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DM Mesajlar
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow count trigger
CREATE OR REPLACE FUNCTION fn_update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = NEW.following_id) WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = NEW.follower_id) WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = OLD.following_id) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = OLD.follower_id) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_follow_counts ON follows;
CREATE TRIGGER trigger_follow_counts AFTER INSERT OR DELETE ON follows FOR EACH ROW EXECUTE FUNCTION fn_update_follow_counts();

-- Bildirimler
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- like | comment | follow
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- İndeksler (performans)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_likes_count ON posts(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: herkes okuyabilir, sadece kendi profilini güncelleyebilir
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: herkes okuyabilir, kendi postunu ekleyip silebilir
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Likes
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Comment likes
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cl_select" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "cl_insert" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cl_delete" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- User settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_select" ON user_settings FOR SELECT USING (true);
CREATE POLICY "us_insert" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "us_update" ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "msg_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "msg_update" ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- Notifications: sadece kendi bildirimlerini görebilir
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- Storage Buckets
-- =============================================
-- Supabase Dashboard > Storage'da şunları oluştur:
-- Bucket adı: "gifs"
-- Public: EVET (açık)
-- File size limit: 10MB (GIF) veya 50MB (video→GIF)
--
-- Aşağıdaki SQL'i de çalıştır:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gifs', 'gifs', true,
  52428800, -- 50MB
  ARRAY['image/gif', 'image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "gifs_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'gifs');
CREATE POLICY "gifs_auth_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gifs' AND auth.role() = 'authenticated');
CREATE POLICY "gifs_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'gifs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gifs_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'gifs' AND auth.uid()::text = (storage.foldername(name))[1]);
