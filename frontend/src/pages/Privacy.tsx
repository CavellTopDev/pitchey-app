import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>Effective Date:</strong> January 1, 2025
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-600 mb-4">
                Pitchey ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
                explains how we collect, use, disclose, and safeguard your information when you use our platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.1 Personal Information</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4">
                <li>Name and contact information (email, phone number)</li>
                <li>Account credentials and profile information</li>
                <li>Payment and billing information</li>
                <li>Professional background and experience (for creators and investors)</li>
              </ul>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.2 Project Information</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4">
                <li>Pitch content, scripts, and creative materials</li>
                <li>Investment preferences and history</li>
                <li>Communication between users regarding projects</li>
              </ul>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.3 Technical Information</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4">
                <li>IP address and device information</li>
                <li>Browser type and operating system</li>
                <li>Usage data and platform interactions</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">We use collected information to:</p>
              <ul className="list-disc list-inside text-gray-600 mb-4">
                <li>Provide and maintain our services</li>
                <li>Process transactions and manage accounts</li>
                <li>Connect creators with investors</li>
                <li>Send notifications about platform activities</li>
                <li>Improve our services and user experience</li>
                <li>Comply with legal obligations</li>
                <li>Prevent fraud and ensure platform security</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Information Sharing</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.1 With Other Users</h3>
              <p className="text-gray-600 mb-4">
                Creator profiles and pitch information are visible to registered investors. 
                Investor profiles may be visible to creators whose projects they've expressed interest in.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.2 Service Providers</h3>
              <p className="text-gray-600 mb-4">
                We may share information with third-party service providers who help us operate our platform, 
                including payment processors, hosting services, and analytics providers.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.3 Legal Requirements</h3>
              <p className="text-gray-600 mb-4">
                We may disclose information when required by law, court order, or to protect our rights 
                and the safety of our users.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
              <p className="text-gray-600 mb-4">
                We implement appropriate technical and organizational measures to protect your information, including:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4">
                <li>Encryption of sensitive data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and authentication measures</li>
                <li>Secure data storage and backup procedures</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Your Rights and Choices</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.1 Access and Correction</h3>
              <p className="text-gray-600 mb-4">
                You can access and update your personal information through your account settings.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.2 Data Deletion</h3>
              <p className="text-gray-600 mb-4">
                You may request deletion of your account and associated data, subject to legal retention requirements.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.3 Communication Preferences</h3>
              <p className="text-gray-600 mb-4">
                You can manage your email notification preferences in your account settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Cookies and Tracking</h2>
              <p className="text-gray-600 mb-4">
                We use cookies and similar technologies to enhance user experience, analyze usage, and provide 
                personalized content. You can manage cookie preferences through your browser settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Children's Privacy</h2>
              <p className="text-gray-600 mb-4">
                Our services are not intended for users under 18 years of age. We do not knowingly collect 
                personal information from children.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. International Data Transfers</h2>
              <p className="text-gray-600 mb-4">
                Your information may be transferred to and processed in countries other than your own. 
                We ensure appropriate safeguards are in place for such transfers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to This Policy</h2>
              <p className="text-gray-600 mb-4">
                We may update this Privacy Policy periodically. We will notify you of significant changes 
                through the platform or via email.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us 
                through our Contact page or email us at privacy@pitchey.com
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. California Privacy Rights</h2>
              <p className="text-gray-600 mb-4">
                California residents have additional rights under the California Consumer Privacy Act (CCPA), 
                including the right to know, delete, and opt-out of the sale of personal information.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}