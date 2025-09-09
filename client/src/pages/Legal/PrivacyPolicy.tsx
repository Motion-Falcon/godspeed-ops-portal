import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../contexts/language/language-provider';
import '../../styles/pages/LegalPages.css';

export function PrivacyPolicy() {
  const { t } = useLanguage();

  const handleGoBack = () => {
    window.close();
  };

  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <button 
          onClick={handleGoBack}
          className="legal-page-back-link"
        >
          <ArrowLeft size={16} />
          {t('legal.goBack')}
        </button>

        <div className="legal-page-header">
          <h1 className="legal-page-title">{t('legal.privacyPolicy')}</h1>
          <p className="legal-page-effective-date">
            {t('legal.effectiveDate')}: 09.09.2025
          </p>
          <p className="legal-page-company">
            {t('legal.company')}: Godspeed Group ("Company," "we," "our," "us")
          </p>
        </div>

        <div className="legal-page-body">
          <p>
            Godspeed Group is committed to protecting the privacy and personal information of all 
            individuals who use our website and Services. This Privacy Policy explains how we 
            collect, use, disclose, and safeguard personal information in compliance with the 
            Personal Information Protection and Electronic Documents Act (PIPEDA) and other 
            applicable Canadian laws.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We may collect and process the following types of personal information:</p>
          
          <h3>1.1. Contact Information</h3>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Telephone number</li>
          </ul>

          <h3>1.2. Application & Employment Information</h3>
          <ul>
            <li>Resumes, CVs, cover letters</li>
            <li>Proof of identity (government-issued ID, work permit, visa documents, etc. as required)</li>
            <li>Educational and professional certifications</li>
            <li>Employment history and references</li>
          </ul>

          <h3>1.3. Technical Information</h3>
          <ul>
            <li>IP address, browser type, and device used to access our website (for site security and analytics).</li>
          </ul>

          <h2>2. Purpose of Collection</h2>
          <p>We collect and use personal information strictly for the following purposes:</p>
          <ul>
            <li>Screening and evaluating candidates for potential employment opportunities.</li>
            <li>Sharing candidate applications with employers/clients who have engaged our Services.</li>
            <li>Verifying applicant qualifications and conducting background/reference checks (where permitted by law).</li>
            <li>Communicating with candidates and clients regarding hiring processes.</li>
            <li>Meeting legal and regulatory requirements.</li>
          </ul>
          <p>
            We will not use personal information for unrelated or unauthorized purposes without 
            obtaining consent.
          </p>

          <h2>3. Consent</h2>
          <p>
            By submitting your information, you consent to the collection, use, and disclosure of 
            personal information as outlined in this Policy.
          </p>
          <ul>
            <li>Candidates provide consent when submitting applications, resumes, IDs, or other information for hiring purposes.</li>
            <li>Employers/Clients consent when providing company or HR-related details for recruitment services.</li>
          </ul>
          <p>
            You may withdraw consent at any time by contacting us (see Section 10). However, 
            withdrawing consent may affect our ability to provide Services.
          </p>

          <h2>4. Disclosure of Information</h2>
          <p>We may share candidate information with:</p>
          <ul>
            <li>Employers or organizations seeking candidates through our platform.</li>
            <li>Third parties such as background-check providers or credential verification partners (only with consent/where legally required).</li>
            <li>Service providers who assist with IT hosting, data storage, or communications (bound by confidentiality agreements).</li>
          </ul>
          <p>
            We will not sell, rent, or trade personal information to third parties for marketing 
            purposes.
          </p>

          <h2>5. Data Retention</h2>
          <ul>
            <li>Resumes, IDs, and application documents are retained only as long as necessary for recruitment purposes or as required by law.</li>
            <li>If you request deletion of your information, we will securely remove it from our systems within a reasonable timeframe (unless required to keep it under legal obligations).</li>
          </ul>

          <h2>6. Data Security</h2>
          <p>
            We take appropriate technical and organizational safeguards to protect collected 
            information, including:
          </p>
          <ul>
            <li>Secure servers and encrypted storage solutions through vendors.</li>
            <li>Restricted access to personal information by authorized personnel only.</li>
            <li>Regular monitoring for unauthorized access or disclosure.</li>
          </ul>
          <p>
            While we implement strong security measures, no electronic transmission or storage 
            can be guaranteed 100% secure.
          </p>

          <h2>7. Access and Correction Rights</h2>
          <p>Under PIPEDA and applicable provincial laws, you have the right to:</p>
          <ul>
            <li>Access the personal information we hold about you.</li>
            <li>Request corrections if information is inaccurate or incomplete.</li>
            <li>Withdraw consent for processing (subject to applicable limitations).</li>
          </ul>
          <p>To exercise these rights, contact us using the details in Section 10.</p>

          <h2>8. Children's Privacy</h2>
          <p>
            Our Services are not designed for individuals under 18 years of age. We do not 
            knowingly collect or process personal information of minors without parental/legal 
            guardian consent.
          </p>

          <h2>9. International Data Transfers</h2>
          <p>
            Where information is stored or processed outside of Canada (e.g., cloud servers), it may 
            be subject to foreign laws. We ensure third-party service providers uphold comparable 
            standards of data protection.
          </p>

          <div className="legal-page-contact-section">
            <h3>10. Contact Us</h3>
            <div className="legal-page-contact-info">
              <p>For privacy-related inquiries, corrections, or withdrawal of consent, please contact:</p>
              <p><strong>Godspeed Group</strong></p>
              <p>2795 Slough Street, Mississauga, ON L4T 1G2</p>
              <p>info@godspeedxp.com</p>
              <p>905-956-9525</p>
              <p>
                We will respond within a reasonable timeframe, in accordance with Canadian privacy 
                legislation.
              </p>
            </div>
          </div>

          <h2>11. Updates to Privacy Policy</h2>
          <p>
            We may update this Policy periodically to reflect legal changes or operational needs. 
            Updates will be posted on our Website, and "Effective Date" will be revised.
          </p>
        </div>
      </div>
    </div>
  );
}
