import '@styles/shared/legals.styles.css'

export const PrivacyPolicy = () => {
  return (
    <div className="legals">
      <div className="legals-header">
        <h1 className="legals-title">Privacy Policy</h1>
        <p className="legals-updated">Last updated: 12/09/2025</p>
      </div>

      <div className="legals-section">
        <h2>1. Who We Are</h2>
        <p>
          Gigin Ltd (company number <strong>14578267</strong>) is registered in
          England and Wales.
        </p>
        <p className="legals-address">
          Registered office: The Old Rectory, Rectory Lane, Kingston, Cambridge,
          CB23 2NL. <br />
          Contact email:{' '}
          <a href="mailto:toby@giginmusic.com">toby@giginmusic.com</a>
        </p>
        <p>We are the “data controller” of your personal information.</p>
      </div>

      <div className="legals-section">
        <h2>2. What Information We Collect</h2>
        <p>We collect the following categories of data when you use the Platform:</p>
        <ul>
          <li>Account information: name, email, password, phone number, and login method (including Google sign-in).</li>
          <li>Profile information: bio, photos, videos, music tracks, links to social media, genres, and your city or county.</li>
          <li>Gig information: event details, such as date, time, type of music, and agreed fees.</li>
          <li>Payment information: Stripe account IDs and related payment details (processed securely via Stripe).</li>
          <li>Analytics and technical information: device information, usage statistics, and crash data, collected through Firebase Analytics.</li>
        </ul>
        <p>
          We do not collect your date of birth, but by signing up you confirm you are{' '}
          <strong>18 years or older</strong>.
        </p>
      </div>

      <div className="legals-section">
        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>Provide, maintain, and improve the Platform.</li>
          <li>Facilitate bookings between musicians and venues.</li>
          <li>Process payments through Stripe.</li>
          <li>Send transactional communications (e.g. booking confirmations, password resets).</li>
          <li>Send marketing communications, if you have opted in.</li>
          <li>Monitor usage and improve performance through Firebase Analytics.</li>
          <li>Comply with our legal obligations.</li>
        </ul>
      </div>

      <div className="legals-section">
        <h2>4. Legal Basis for Processing</h2>
        <ul>
          <li>Contractual necessity – to provide you with the Platform.</li>
          <li>Consent – for marketing communications.</li>
          <li>Legitimate interests – improving our services and preventing misuse.</li>
          <li>Legal obligations – to comply with financial and regulatory requirements.</li>
        </ul>
      </div>

      <div className="legals-section">
        <h2>5. Who We Share Your Data With</h2>
        <p>We only share your data with trusted third parties necessary for providing the Platform:</p>
        <ul>
          <li>Stripe – for secure payment processing.</li>
          <li>Google – for account sign-in (OAuth).</li>
          <li>Firebase – for analytics, crash reporting, and sending transactional emails.</li>
        </ul>
        <p>We do not sell or rent your data to third parties.</p>
      </div>

      <div className="legals-section">
        <h2>6. Data Retention</h2>
        <p>
          We keep your personal data for as long as your account is active. If you close
          your account, we will delete your data unless we need to retain certain
          information for legal, regulatory, or security reasons.
        </p>
      </div>

      <div className="legals-section">
        <h2>7. Your Rights</h2>
        <p>Under data protection law, you have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data.</li>
          <li>Object to or restrict processing.</li>
          <li>Request data portability.</li>
        </ul>
        <p>
          To exercise any of these rights, email us at{' '}
          <a href="mailto:toby@giginmusic.com">toby@giginmusic.com</a>. We will respond within
          30 days.
        </p>
      </div>

      <div className="legals-section">
        <h2>8. Marketing Communications</h2>
        <p>
          If you opt in during sign-up, we may send you marketing emails about Gigin. You
          can withdraw your consent at any time by following the unsubscribe link in
          emails or contacting us directly.
        </p>
      </div>

      <div className="legals-section">
        <h2>9. Cookies</h2>
        <p>We currently do not use cookies. If this changes, we will update this Privacy Policy and provide a cookie notice.</p>
      </div>

      <div className="legals-section">
        <h2>10. Data Security</h2>
        <p>
          We use appropriate technical and organisational measures to protect your data,
          including encryption and secure hosting. However, no system is completely
          secure, and we cannot guarantee absolute security of your data.
        </p>
      </div>

      <div className="legals-section">
        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of
          significant changes.
        </p>
      </div>

      <div className="legals-section">
        <h2>12. Contact Us</h2>
        <p className="legals-address">
          <strong>Gigin Ltd</strong> <br />
          The Old Rectory, Rectory Lane, Kingston, Cambridge, CB23 2NL <br />
          Email: <a href="mailto:toby@giginmusic.com">toby@giginmusic.com</a>
        </p>
      </div>
    </div>
  )
}