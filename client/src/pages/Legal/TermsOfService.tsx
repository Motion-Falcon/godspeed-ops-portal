import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../contexts/language/language-provider';
import '../../styles/pages/LegalPages.css';

export function TermsOfService() {
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
          <h1 className="legal-page-title">{t('legal.termsOfService')}</h1>
          <p className="legal-page-effective-date">
            {t('legal.effectiveDate')}: 09.09.2025
          </p>
          <p className="legal-page-company">
            {t('legal.company')}: AllStaff Inc.
          </p>
        </div>

        <div className="legal-page-body">
          <p>
            These Terms and Conditions ("Terms") constitute a legally binding agreement between
            a user and any person, business, or organization accessing or using our online platform
            and services for HR placement, recruitment, and hiring (the "Services"). By using our
            Website or Services, you ("User," "Client," or "Candidate") agree to these Terms. If you do
            not agree, please discontinue use of our Services.
          </p>

          <h2>1. Scope of Services</h2>
          <h3>1.1. AllStaff Inc. provides an online platform for:</h3>
          <ul>
            <li>Candidate sourcing, screening, and placement.</li>
            <li>HR consulting and advisory services.</li>
            <li>Job postings and employer branding support.</li>
            <li>Access to applicant tracking and hiring tools.</li>
          </ul>
          <p>
            <strong>1.2.</strong> We act as a facilitator between employers (Clients) and job seekers (Candidates).
            We do not guarantee employment, candidate success, or retention beyond the initial
            placement.
          </p>

          <h2>2. Eligibility</h2>
          <h3>2.1. To use our Services, you must be:</h3>
          <ul>
            <li>At least 18 years old.</li>
            <li>Legally able to enter into binding contracts under Canadian law.</li>
            <li>An authorized representative if acting on behalf of a business entity.</li>
          </ul>
          <p>
            <strong>2.2.</strong> By registering, you warrant that all information provided is truthful, accurate, and
            current.
          </p>

          <h2>3. User Accounts</h2>
          <h3>3.1. Users may be required to create an account. You agree to:</h3>
          <ul>
            <li>Maintain confidentiality of your login credentials.</li>
            <li>Assume responsibility for all activities under your account.</li>
            <li>Notify us of any unauthorized access immediately.</li>
          </ul>
          <p>
            <strong>3.2.</strong> We reserve the right to suspend or terminate accounts that violate these Terms or
            applicable laws.
          </p>

          <h2>4. Employer/Client Obligations</h2>
          <h3>4.1. Employers agree to:</h3>
          <ul>
            <li>Provide accurate job descriptions and hiring requirements.</li>
            <li>Use candidate information strictly for lawful hiring purposes.</li>
            <li>Not discriminate based on race, gender, religion, disability, or other protected
            grounds per the Canadian Human Rights Act and Employment Equity Act.</li>
          </ul>
          <p>
            <strong>4.2.</strong> Employers are solely responsible for final hiring decisions. AllStaff Inc. is
            not liable for employment outcomes, workplace behaviour, or performance of hired
            candidates.
          </p>

          <h2>5. Candidate Obligations</h2>
          <h3>5.1. Candidates agree to:</h3>
          <ul>
            <li>Provide truthful and accurate resumes, qualifications, and background details.</li>
            <li>Not misrepresent their skills, employment history, or eligibility to work in Canada.</li>
            <li>Comply with applicable employment and immigration regulations.</li>
          </ul>
          <p>
            <strong>5.2.</strong> Candidates understand that submission of a resume/application does not
            guarantee interviews or job offers.
          </p>

          <h2>6. Fees and Payments</h2>
          <p>
            <strong>6.1.</strong> Employers may be charged placement fees, subscription fees, or other service
            charges as agreed in separate contracts or order forms.
          </p>
          <h3>6.2. Unless otherwise specified:</h3>
          <ul>
            <li>All fees are quoted in Canadian Dollars (CAD).</li>
            <li>Payments are due within the agreed period.</li>
            <li>Late payments may incur interest or penalties.</li>
          </ul>
          <p>
            <strong>6.3.</strong> No refunds are provided once Services have been rendered, unless required under
            applicable consumer protection laws.
          </p>

          <h2>7. Service Availability</h2>
          <p>
            <strong>7.1.</strong> We strive to keep our Services accessible 24/7 but do not guarantee uninterrupted
            availability.
          </p>
          <p>
            <strong>7.2.</strong> We may modify, suspend, or discontinue Services with or without notice for
            maintenance, upgrades, or external reasons beyond our control.
          </p>

          <h2>8. Privacy and Data Protection</h2>
          <p>
            <strong>8.1.</strong> We collect, store, and process personal data in accordance with the Personal
            Information Protection and Electronic Documents Act (PIPEDA) of Canada.
          </p>
          <p>
            <strong>8.2.</strong> Our Privacy Policy explains how we handle applicant and employer data. By using
            our Services, you consent to such data practices.
          </p>
          <p>
            <strong>8.3.</strong> Users are prohibited from selling, misusing, or unlawfully disclosing
            candidate/employer data obtained from our Services.
          </p>

          <h2>9. Intellectual Property</h2>
          <p>
            <strong>9.1.</strong> All content on our Website and platform — including text, graphics, trademarks, and
            software — remains the property of AllStaff Inc..
          </p>
          <p>
            <strong>9.2.</strong> Users may not copy, redistribute, reverse engineer, or exploit our intellectual
            property without written consent.
          </p>

          <h2>10. Third-Party Services</h2>
          <p>
            <strong>10.1.</strong> We may integrate with third-party platforms (e.g., job boards, payroll providers,
            background verification services).
          </p>
          <p>
            <strong>10.2.</strong> We are not liable for the functionality, reliability, or data protection of such
            third-party services.
          </p>

          <h2>11. Limitation of Liability</h2>
          <h3>11.1. To the maximum extent permitted by law:</h3>
          <ul>
            <li>We disclaim any warranties (express or implied).</li>
            <li>We are not responsible for employment outcomes, losses, reputational damage,
            or indirect liabilities.</li>
            <li>Our liability is limited to direct damages not exceeding the fees paid to us in the
            past six months.</li>
          </ul>

          <h2>12. Indemnification</h2>
          <h3>12.1. You agree to indemnify and hold AllStaff Inc., its directors, employees, and
          affiliates harmless from any claims, damages, or expenses arising from your:</h3>
          <ul>
            <li>Use of the Services.</li>
            <li>Violation of these Terms.</li>
            <li>Employment decisions, workplace disputes, or recruiting practices.</li>
          </ul>

          <h2>13. Disclaimer of Employment Relationship</h2>
          <p>
            <strong>13.1.</strong> We are not an employer of Candidates unless explicitly stated in a direct
            employment agreement.
          </p>
          <p>
            <strong>13.2.</strong> The employment relationship exists solely between the Employer and the
            Candidate. We do not control wages, working conditions, or employment terms once
            placement is completed.
          </p>

          <h2>14. Termination</h2>
          <h3>14.1. We may suspend or terminate a User's account for:</h3>
          <ul>
            <li>Breach of these Terms.</li>
            <li>Misuse of Services.</li>
            <li>Fraudulent or illegal activity.</li>
          </ul>
          <p>
            <strong>14.2.</strong> Upon termination, outstanding fees remain payable and certain obligations
            (confidentiality, data protection, indemnity) will survive.
          </p>

          <h2>15. Governing Law and Jurisdiction</h2>
          <p>
            <strong>15.1.</strong> These Terms shall be governed by and construed in accordance with the laws of
            the Province of Ontario, Canada and the federal laws of Canada.
          </p>
          <p>
            <strong>15.2.</strong> Any disputes shall be resolved in the courts of Ontario, Canada.
          </p>

          <h2>16. Changes to Terms</h2>
          <p>
            <strong>16.1.</strong> We reserve the right to update or change these Terms at any time.
          </p>
          <p>
            <strong>16.2.</strong> Continued use of Services after such updates constitutes acceptance of the
            revised Terms.
          </p>

          <div className="legal-page-contact-section">
            <h3>17. Contact Information</h3>
            <div className="legal-page-contact-info">
              <p>For any questions or concerns regarding these Terms, please contact:</p>
              <p><strong>AllStaff Inc.</strong></p>
              <p>4096 Meadowbrook Drive, Suite 121, London, ON N6L 1G4</p>
              <p>accounting@allstaff.ca</p>
              <p>519-432-7772</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
