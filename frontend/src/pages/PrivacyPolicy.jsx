export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24 text-gray-300 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-gray-500 mb-8">Last updated: April 2026</p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h2>
        <p>When you use GifWave, we collect the following information:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
          <li>Email address and username (at registration)</li>
          <li>GIFs and content you upload</li>
          <li>Usage data (likes, follows, messages)</li>
          <li>Device information for analytics</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">2. How We Use Your Information</h2>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
          <li>To provide and improve our service</li>
          <li>To show personalized content and ads (via Google AdMob)</li>
          <li>To process premium subscriptions</li>
          <li>To communicate with you about updates</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">3. Third-Party Services</h2>
        <p className="text-gray-400">We use the following third-party services:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
          <li><strong className="text-gray-300">Supabase</strong> — database and authentication</li>
          <li><strong className="text-gray-300">Google AdMob</strong> — advertising</li>
          <li><strong className="text-gray-300">Whop</strong> — premium subscription processing</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">4. Data Retention</h2>
        <p className="text-gray-400">Your data is retained as long as your account is active. You may delete your account at any time from your profile settings.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">5. DMCA & Copyright</h2>
        <p className="text-gray-400">GifWave respects intellectual property rights. If you believe content on our platform infringes your copyright, please contact us at <a href="mailto:support@gifwave.app" className="text-brand-400 underline">support@gifwave.app</a> with a description of the infringing content and your ownership claim. We will remove infringing content promptly.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">6. Contact</h2>
        <p className="text-gray-400">For privacy inquiries: <a href="mailto:support@gifwave.app" className="text-brand-400 underline">support@gifwave.app</a></p>
      </section>
    </div>
  )
}
