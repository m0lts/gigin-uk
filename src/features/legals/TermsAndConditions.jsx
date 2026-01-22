import '@styles/shared/legals.styles.css';

export const TermsAndConditions = () => {
  const lastUpdated = '12/09/2025';

  return (
    <div className="legals">
      <header className="legals-header" id='top'>
        <h1 className="legals-title">Gigin Ltd – Terms &amp; Conditions</h1>
        <p className="legals-updated"><strong>Last updated:</strong> {lastUpdated}</p>
        <p className="legals-intro">
          These Terms &amp; Conditions (“Terms”) govern your access to and use of the Gigin platform and services
          (together, the “Platform”). By creating an account or using the Platform, you agree to be bound by these
          Terms. If you do not agree, you must not use the Platform.
        </p>
      </header>

      {/* Optional in-page navigation */}
      <nav className="legals-toc" aria-label="Table of contents">
        <ul>
          <li><a href="#company-info">1. Company Information</a></li>
          <li><a href="#users-eligibility">2. Users and Eligibility</a></li>
          <li><a href="#role">3. Role of Gigin</a></li>
          <li><a href="#functionality">4. Platform Functionality</a></li>
          <li><a href="#payments-fees">5. Payments and Fees</a></li>
          <li><a href="#cancellations-refunds">6. Cancellations and Refunds</a></li>
          <li><a href="#responsibilities">7. User Responsibilities</a></li>
          <li><a href="#ip">8. Intellectual Property</a></li>
          <li><a href="#suspension-termination">9. Suspension and Termination</a></li>
          <li><a href="#disputes">10. Disputes and Mediation</a></li>
          <li><a href="#liability">11. Limitation of Liability</a></li>
          <li><a href="#privacy">12. Privacy and Data Protection</a></li>
          <li><a href="#marketing">13. Marketing</a></li>
          <li><a href="#changes">14. Changes to Terms</a></li>
          <li><a href="#contact">15. Contact</a></li>
        </ul>
      </nav>

      <section id="company-info" className="legals-section">
        <h2>1. Company Information</h2>
        <p>
          The Platform is operated by <strong>Gigin Ltd</strong> (company number <strong>14578267</strong>),
          registered in England and Wales.
        </p>
        <p><strong>Registered office:</strong> The Old Rectory, Rectory Lane, Kingston, Cambridge, CB23 2NL.</p>
        <p><strong>Contact email:</strong> toby@giginmusic.com</p>
      </section>

      <section id="users-eligibility" className="legals-section">
        <h2>2. Users and Eligibility</h2>
        <ul>
          <li>The Platform is available only to individuals aged <strong>18 or over</strong>.</li>
          <li>Two types of accounts are available:
            <ul>
              <li><strong>Musician Accounts</strong> (solo artists, bands or DJs)</li>
              <li><strong>Venue Accounts</strong> (venues, event organisers, hosts)</li>
            </ul>
          </li>
          <li>By creating an account, you confirm that the information you provide is true and accurate.</li>
        </ul>
      </section>

      <section id="role" className="legals-section">
        <h2>3. Role of Gigin</h2>
        <ul>
          <li>Gigin is a <strong>facilitator only</strong>.</li>
          <li>We provide tools for musicians and venues to connect, book gigs, and manage payments.</li>
          <li>We are <strong>not a party</strong> to any contract between musicians and venues.</li>
          <li>We are not responsible for:
            <ul>
              <li>the quality or outcome of performances,</li>
              <li>the behaviour of any user,</li>
              <li>ensuring a gig takes place as agreed.</li>
            </ul>
          </li>
        </ul>
      </section>

      <section id="functionality" className="legals-section">
        <h2>4. Platform Functionality</h2>
        <ul>
          <li>Venues can create profiles and post gig opportunities, which appear on the gig map and their venue profile.</li>
          <li>Musicians can create profiles and apply to posted gigs.</li>
          <li>Venues review applications and select musicians.</li>
          <li>Fees may be flat-rate or ticketed:
            <ul>
              <li><strong>Flat-fee gigs:</strong> venue pays via debit/credit card on Gigin. Funds are held in escrow via Stripe and released to the musician 48 hours after the gig, unless a dispute is raised.</li>
              <li><strong>Ticketed gigs:</strong> no payment flows through Gigin. The venue and musician manage ticketing directly, and the musician keeps 100% of ticket revenue.</li>
            </ul>
          </li>
        </ul>
      </section>

      <section id="payments-fees" className="legals-section">
        <h2>5. Payments and Fees</h2>
        <ul>
          <li>Payments are processed via Stripe. Both venues and musicians must connect a Stripe account when registering.</li>
          <li>Funds for flat-fee gigs are held in escrow until 48 hours after the gig is performed, then automatically released to the musician.</li>
          <li>If a dispute is reported within 48 hours, funds will be held until resolved.</li>
          <li>At present, <strong>Gigin does not charge commission</strong>. Stripe processing fees are covered by Gigin.</li>
          <li>We may update our fees in the future; any changes will be communicated in advance.</li>
        </ul>
      </section>

      <section id="cancellations-refunds" className="legals-section">
        <h2>6. Cancellations and Refunds</h2>
        <ul>
          <li>If a musician or venue <strong>deletes their account</strong> or is <strong>suspended</strong> before a confirmed gig, the gig will be cancelled and the venue refunded.</li>
          <li>Venues may cancel gigs before confirmation without penalty.</li>
          <li>Once a gig is confirmed, cancellations may lead to refunds or payment adjustments at Gigin’s discretion.</li>
          <li>Specific cancellation policies (e.g. late cancellations) may be introduced and updated from time to time.</li>
        </ul>
      </section>

      <section id="responsibilities" className="legals-section">
        <h2>7. User Responsibilities</h2>
        <p>Users agree to:</p>
        <ul>
          <li>honour bookings made through the Platform,</li>
          <li>provide accurate information on profiles and gigs,</li>
          <li>behave professionally and respectfully at gigs,</li>
          <li>not misuse the Platform or upload illegal, harmful, or offensive content.</li>
        </ul>
      </section>

      <section id="ip" className="legals-section">
        <h2>8. Intellectual Property</h2>
        <ul>
          <li>Users retain ownership of all content they upload (profiles, photos, recordings, etc.).</li>
          <li>By uploading content, you grant Gigin a non-exclusive, worldwide, royalty-free licence to use, display, and promote it for the purpose of operating and marketing the Platform.</li>
        </ul>
      </section>

      <section id="suspension-termination" className="legals-section">
        <h2>9. Suspension and Termination</h2>
        <ul>
          <li>Gigin may suspend or remove any account at its discretion for breach of these Terms, unlawful behaviour, or misuse of the Platform.</li>
          <li>Users may delete their accounts at any time.</li>
          <li>If a user is removed or deletes their account, all future confirmed gigs are cancelled and venues refunded.</li>
        </ul>
      </section>

      <section id="disputes" className="legals-section">
        <h2>10. Disputes and Mediation</h2>
        <ul>
          <li>Gigin will act as mediator in disputes between venues and musicians.</li>
          <li>If mediation fails, disputes are a matter between the venue and musician.</li>
          <li>These Terms and any disputes arising under them are governed by the <strong>laws of England and Wales</strong>.</li>
          <li>The <strong>courts of England and Wales</strong> have exclusive jurisdiction.</li>
        </ul>
      </section>

      <section id="liability" className="legals-section">
        <h2>11. Limitation of Liability</h2>
        <ul>
          <li>To the fullest extent permitted by law, Gigin excludes all liability for:
            <ul>
              <li>indirect or consequential loss or damages,</li>
              <li>loss of profits, income, or business opportunities.</li>
            </ul>
          </li>
          <li>Gigin’s total liability to any user for all claims is limited to the <strong>total fees paid to Gigin by that user in the 12 months prior to the claim</strong>.</li>
        </ul>
      </section>

      <section id="privacy" className="legals-section">
        <h2>12. Privacy and Data Protection</h2>
        <ul>
          <li>Gigin processes personal data in accordance with the <strong>UK GDPR</strong> and <strong>Data Protection Act 2018</strong>.</li>
          <li>This includes the use of Stripe for payment processing.</li>
          <li>Full details of how we collect, use, and store personal data are set out in our <strong>Privacy Policy</strong>, which forms part of these Terms.</li>
        </ul>
      </section>

      <section id="marketing" className="legals-section">
        <h2>13. Marketing</h2>
        <ul>
          <li>By signing up, users may choose to opt in to receive marketing communications from Gigin.</li>
          <li>Users can withdraw consent at any time by adjusting account settings or contacting us.</li>
        </ul>
      </section>

      <section id="changes" className="legals-section">
        <h2>14. Changes to Terms</h2>
        <ul>
          <li>Gigin may update these Terms from time to time.</li>
          <li>Users will be notified of material changes. Continued use of the Platform after changes indicates acceptance.</li>
        </ul>
      </section>

      <section id="contact" className="legals-section">
        <h2>15. Contact</h2>
        <address className="legals-address">
          <strong>Gigin Ltd</strong><br />
          The Old Rectory, Rectory Lane, Kingston, Cambridge, CB23 2NL<br />
          Email: <a href="mailto:toby@giginmusic.com">toby@giginmusic.com</a>
        </address>
      </section>

      <footer className="legals-footer">
        <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          Back to top
        </a>
      </footer>
    </div>
  );
};