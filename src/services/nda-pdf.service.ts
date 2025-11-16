// NDA PDF Generation Service
// Generates PDF documents for signed NDAs using browser-based rendering

export interface NDADocumentData {
  id: number;
  pitchTitle: string;
  signerName: string;
  signerEmail: string;
  signerCompany?: string;
  creatorName: string;
  creatorEmail: string;
  signedAt: Date;
  ndaType: 'basic' | 'enhanced' | 'custom';
  customTerms?: string;
  expiresAt?: Date;
  pitchDescription?: string;
}

export class NDAFPDFGenerationService {
  /**
   * Generate HTML content for NDA document
   */
  private static generateNDAHTML(data: NDADocumentData): string {
    const formattedSignedDate = data.signedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedExpiryDate = data.expiresAt?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) || 'No expiration date';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Non-Disclosure Agreement - ${data.pitchTitle}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #2c5530;
            padding-bottom: 20px;
        }
        .header h1 {
            font-size: 24px;
            color: #2c5530;
            margin: 0;
        }
        .document-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-left: 4px solid #2c5530;
            margin-bottom: 30px;
        }
        .parties {
            margin: 30px 0;
        }
        .party {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #fafafa;
            border-radius: 5px;
        }
        .party h3 {
            margin-top: 0;
            color: #2c5530;
        }
        .terms {
            margin: 30px 0;
        }
        .terms h2 {
            color: #2c5530;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
        }
        .terms ol {
            counter-reset: section;
        }
        .terms li {
            margin-bottom: 15px;
            padding-left: 10px;
        }
        .signature-section {
            margin-top: 50px;
            border: 2px solid #2c5530;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .signature-block {
            margin: 20px 0;
        }
        .signature-line {
            border-bottom: 1px solid #666;
            margin: 10px 0;
            padding-bottom: 5px;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        .confidentiality-notice {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>NON-DISCLOSURE AGREEMENT</h1>
        <p><strong>Regarding: "${data.pitchTitle}"</strong></p>
    </div>

    <div class="document-info">
        <p><strong>NDA ID:</strong> ${data.id}</p>
        <p><strong>Agreement Type:</strong> ${data.ndaType.charAt(0).toUpperCase() + data.ndaType.slice(1)}</p>
        <p><strong>Date of Agreement:</strong> ${formattedSignedDate}</p>
        <p><strong>Expiration Date:</strong> ${formattedExpiryDate}</p>
    </div>

    <div class="parties">
        <h2>PARTIES TO THIS AGREEMENT</h2>
        
        <div class="party">
            <h3>Disclosing Party (Creator)</h3>
            <p><strong>Name:</strong> ${data.creatorName}</p>
            <p><strong>Email:</strong> ${data.creatorEmail}</p>
        </div>

        <div class="party">
            <h3>Receiving Party (Viewer)</h3>
            <p><strong>Name:</strong> ${data.signerName}</p>
            <p><strong>Email:</strong> ${data.signerEmail}</p>
            ${data.signerCompany ? `<p><strong>Company:</strong> ${data.signerCompany}</p>` : ''}
        </div>
    </div>

    <div class="confidentiality-notice">
        <strong>⚠️ CONFIDENTIALITY NOTICE:</strong> This document contains confidential and proprietary information. 
        By accessing this information, you agree to maintain its confidentiality as outlined in the terms below.
    </div>

    <div class="terms">
        <h2>TERMS AND CONDITIONS</h2>
        
        <ol>
            <li><strong>Definition of Confidential Information:</strong> 
                For purposes of this Agreement, "Confidential Information" shall include all information, 
                documents, materials, and data relating to the creative project "${data.pitchTitle}" including but not limited to:
                <ul>
                    <li>Scripts, treatments, and story concepts</li>
                    <li>Character descriptions and development</li>
                    <li>Plot outlines and narrative structure</li>
                    <li>Visual elements, mood boards, and artistic concepts</li>
                    <li>Budget information and financial projections</li>
                    <li>Marketing strategies and target audience analysis</li>
                    <li>Any other proprietary creative or business information</li>
                </ul>
            </li>

            <li><strong>Obligation of Confidentiality:</strong> 
                The Receiving Party agrees to hold and maintain in confidence all Confidential Information 
                and not to disclose such information to any third party without the prior written consent of the Disclosing Party.</li>

            <li><strong>Use Restrictions:</strong> 
                The Receiving Party may use the Confidential Information solely for the purpose of evaluating 
                potential business opportunities with the Disclosing Party and for no other purpose.</li>

            <li><strong>Non-Competition:</strong> 
                The Receiving Party agrees not to use any Confidential Information to compete with, 
                replicate, or create derivative works based on the disclosed project without explicit written permission.</li>

            <li><strong>Return of Materials:</strong> 
                Upon termination of discussions or upon request by the Disclosing Party, 
                the Receiving Party agrees to return or destroy all materials containing Confidential Information.</li>

            <li><strong>Duration:</strong> 
                This Agreement shall remain in effect for a period of ${data.expiresAt ? 'until ' + formattedExpiryDate : 'five (5) years from the date of signing'}, 
                unless terminated earlier by mutual agreement or extended by written consent.</li>

            <li><strong>Legal Remedies:</strong> 
                The Receiving Party acknowledges that any breach of this Agreement may cause irreparable harm to the Disclosing Party, 
                entitling them to seek injunctive relief and monetary damages.</li>

            <li><strong>Governing Law:</strong> 
                This Agreement shall be governed by and construed in accordance with the laws of [Jurisdiction], 
                and any disputes shall be subject to the exclusive jurisdiction of the courts therein.</li>
        </ol>

        ${data.customTerms ? `
        <h3>Additional Terms</h3>
        <div style="border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9;">
            ${data.customTerms.split('\n').map(term => `<p>${term}</p>`).join('')}
        </div>
        ` : ''}
    </div>

    <div class="signature-section">
        <h2>ELECTRONIC SIGNATURE CONFIRMATION</h2>
        
        <div class="signature-block">
            <p><strong>This NDA was electronically signed and executed on ${formattedSignedDate}</strong></p>
            
            <div class="signature-line">
                Receiving Party: ${data.signerName}
            </div>
            <p>Email: ${data.signerEmail}</p>
            <p>Date: ${formattedSignedDate}</p>
            
            <div class="signature-line">
                Disclosing Party: ${data.creatorName}
            </div>
            <p>Email: ${data.creatorEmail}</p>
            <p>Date: ${formattedSignedDate}</p>
        </div>

        <p style="font-size: 12px; color: #666; margin-top: 20px;">
            This electronic signature has the same legal effect as a handwritten signature. 
            Both parties acknowledge and agree to be bound by the terms of this Agreement.
        </p>
    </div>

    <div class="footer">
        <p>Generated by Pitchey Platform | Document ID: NDA-${data.id}</p>
        <p>This is a legally binding agreement. Please retain this document for your records.</p>
        <p>For questions regarding this NDA, please contact support@pitchey.com</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate a simple text-based PDF content for basic rendering
   * This is a fallback when browser-based rendering isn't available
   */
  static generateSimplePDFContent(data: NDADocumentData): string {
    const formattedSignedDate = data.signedAt.toLocaleDateString();
    const formattedExpiryDate = data.expiresAt?.toLocaleDateString() || 'No expiration';

    return `
NON-DISCLOSURE AGREEMENT
========================

Project: ${data.pitchTitle}
NDA ID: ${data.id}
Type: ${data.ndaType.toUpperCase()}
Date: ${formattedSignedDate}
Expires: ${formattedExpiryDate}

PARTIES:
--------
Disclosing Party: ${data.creatorName} (${data.creatorEmail})
Receiving Party: ${data.signerName} (${data.signerEmail})
${data.signerCompany ? `Company: ${data.signerCompany}` : ''}

CONFIDENTIALITY TERMS:
----------------------
1. All information regarding "${data.pitchTitle}" is strictly confidential
2. Information may only be used for evaluation purposes
3. No disclosure to third parties without written consent
4. No competitive use or derivative works permitted
5. Materials must be returned upon request

ELECTRONIC SIGNATURE:
---------------------
This agreement was electronically executed on ${formattedSignedDate}
Parties acknowledge this has the same legal effect as handwritten signature.

${data.customTerms ? `\nADDITIONAL TERMS:\n${data.customTerms}` : ''}

Document generated by Pitchey Platform
For support: support@pitchey.com
`;
  }

  /**
   * Generate NDA document URL for download
   * In production, this would generate a PDF and store it in S3/R2
   */
  static async generateNDADocument(data: NDADocumentData): Promise<{
    documentUrl: string;
    htmlContent: string;
    textContent: string;
  }> {
    try {
      const htmlContent = this.generateNDAHTML(data);
      const textContent = this.generateSimplePDFContent(data);
      
      // In production, you would:
      // 1. Use puppeteer/playwright to render HTML to PDF
      // 2. Upload PDF to storage (S3/R2)
      // 3. Return the permanent URL
      
      // For now, return a mock URL and content
      const documentUrl = `/api/nda/documents/${data.id}/download`;
      
      return {
        documentUrl,
        htmlContent,
        textContent
      };
    } catch (error) {
      console.error('Error generating NDA document:', error);
      throw new Error('Failed to generate NDA document');
    }
  }

  /**
   * Get document download URL
   */
  static getDocumentDownloadUrl(ndaId: number): string {
    return `/api/nda/documents/${ndaId}/download`;
  }

  /**
   * Validate NDA document data
   */
  static validateNDAData(data: Partial<NDADocumentData>): boolean {
    return !!(
      data.id &&
      data.pitchTitle &&
      data.signerName &&
      data.signerEmail &&
      data.creatorName &&
      data.creatorEmail &&
      data.signedAt &&
      data.ndaType
    );
  }
}

export default NDAFPDFGenerationService;