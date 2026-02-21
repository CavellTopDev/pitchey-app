import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => { void navigate('/'); }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>Effective Date:</strong> January 1, 2025
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 mb-4">
                By accessing or using Pitchey ("the Platform"), you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
              <p className="text-gray-600 mb-4">
                Pitchey is a platform connecting content creators with potential investors for film, TV, and media projects. 
                We provide tools for pitch submission, evaluation, and investment facilitation.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">3.1 Account Registration</h3>
              <p className="text-gray-600 mb-4">
                You must provide accurate, complete, and current information during registration. 
                You are responsible for maintaining the confidentiality of your account credentials.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">3.2 Account Types</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4">
                <li>Creator accounts: For submitting and managing pitches</li>
                <li>Investor accounts: For browsing and investing in projects</li>
                <li>Admin accounts: For platform management (internal use only)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Content Guidelines</h2>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.1 Pitch Content</h3>
              <p className="text-gray-600 mb-4">
                All submitted pitches must be original work or properly licensed content. 
                Creators retain intellectual property rights to their submissions.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.2 Prohibited Content</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4">
                <li>Copyrighted material without proper authorization</li>
                <li>Defamatory, offensive, or illegal content</li>
                <li>Misleading or fraudulent information</li>
                <li>Content violating third-party rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Investment Terms</h2>
              <p className="text-gray-600 mb-4">
                Pitchey facilitates connections between creators and investors but does not guarantee funding. 
                All investment decisions and agreements are between individual parties.
              </p>
              <p className="text-gray-600 mb-4">
                Platform fees may apply to successful funding transactions. 
                Current fee structure is available in the Pricing section.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Intellectual Property</h2>
              <p className="text-gray-600 mb-4">
                Creators maintain ownership of their pitch content. By submitting to Pitchey, 
                creators grant us a limited license to display and promote their pitches on the platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Privacy and Data Protection</h2>
              <p className="text-gray-600 mb-4">
                Your privacy is important to us. Please review our Privacy Policy for information 
                about how we collect, use, and protect your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Limitation of Liability</h2>
              <p className="text-gray-600 mb-4">
                Pitchey is provided "as is" without warranties of any kind. We are not liable for 
                indirect, incidental, or consequential damages arising from your use of the platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Dispute Resolution</h2>
              <p className="text-gray-600 mb-4">
                Any disputes arising from these terms shall be resolved through binding arbitration 
                in accordance with applicable laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Modifications</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to modify these terms at any time. Continued use of the platform 
                after changes constitutes acceptance of the modified terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Information</h2>
              <p className="text-gray-600 mb-4">
                For questions about these Terms of Service, please contact us through our Contact page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}