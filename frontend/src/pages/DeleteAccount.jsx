export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-lg w-full">
        <h1 className="text-3xl font-bold text-brand-400 mb-2">GifWave</h1>
        <h2 className="text-xl font-semibold mb-6">Hesap Silme Talebi</h2>

        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Hesabınızı nasıl silebilirsiniz?</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
            <li>GifWave uygulamasını açın ve giriş yapın.</li>
            <li>Sağ alttaki <strong className="text-white">Profil</strong> simgesine dokunun.</li>
            <li>Sağ üstteki <strong className="text-white">⚙️ Düzenle</strong> butonuna dokunun.</li>
            <li>Sayfanın en altındaki <strong className="text-red-400">Hesabı Sil</strong> seçeneğine dokunun.</li>
            <li>Onay mesajını kabul edin — hesabınız kalıcı olarak silinir.</li>
          </ol>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Silinen veriler</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
            <li>Profil bilgileri (kullanıcı adı, e-posta, avatar)</li>
            <li>Yüklenen tüm GIF'ler</li>
            <li>Yorumlar, beğeniler ve yeniden paylaşımlar</li>
            <li>Takip ilişkileri ve bildirimler</li>
            <li>Mesajlar</li>
          </ul>
          <p className="text-gray-500 text-xs mt-3">
            Veriler silme talebinden sonra 30 gün içinde sistemlerimizden kalıcı olarak kaldırılır.
          </p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-2">Yardıma mı ihtiyacınız var?</h3>
          <p className="text-gray-300 text-sm">
            Hesabınızı uygulama üzerinden silemiyorsanız{' '}
            <a href="mailto:support@gifwave.app" className="text-brand-400 underline">
              support@gifwave.app
            </a>{' '}
            adresine e-posta gönderin.
          </p>
        </div>
      </div>
    </div>
  )
}
