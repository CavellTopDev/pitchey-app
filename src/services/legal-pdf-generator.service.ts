/**
 * Legal Document PDF Generator Service
 * Generates professional PDF documents from HTML templates
 * Optimized for Cloudflare Workers environment
 */

export interface PDFGenerationOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  header?: {
    height?: string;
    contents?: string;
  };
  footer?: {
    height?: string;
    contents?: string;
  };
  quality?: 'low' | 'medium' | 'high';
  watermark?: {
    text: string;
    opacity?: number;
    fontSize?: number;
    color?: string;
  };
}

export interface DocxGenerationOptions {
  template?: 'standard' | 'letterhead' | 'legal';
  includeStyles?: boolean;
  pageNumbers?: boolean;
  headerText?: string;
  footerText?: string;
}

export interface PDFGenerationResult {
  success: boolean;
  pdfBuffer?: Uint8Array;
  docxBuffer?: Uint8Array;
  filePath?: string;
  fileSize?: number;
  pageCount?: number;
  error?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export class LegalPDFGenerator {
  private static readonly DEFAULT_PDF_OPTIONS: PDFGenerationOptions = {
    format: 'Letter',
    orientation: 'portrait',
    margins: {
      top: '1in',
      right: '1in',
      bottom: '1in',
      left: '1in'
    },
    quality: 'high'
  };

  // Professional PDF templates for different document types
  private static readonly DOCUMENT_TEMPLATES = {
    investment_agreement: {
      coverPage: true,
      tableOfContents: true,
      signaturePages: true,
      legalNotices: true,
      formatting: 'formal'
    },
    production_contract: {
      coverPage: true,
      tableOfContents: false,
      signaturePages: true,
      legalNotices: true,
      formatting: 'standard'
    },
    nda: {
      coverPage: false,
      tableOfContents: false,
      signaturePages: true,
      legalNotices: false,
      formatting: 'simple'
    }
  } as const;

  private static readonly LEGAL_STYLES = `
    <style>
      @page {
        margin: 1in;
        size: letter;
        @bottom-center {
          content: "Page " counter(page) " of " counter(pages);
          font-family: 'Times New Roman', serif;
          font-size: 10pt;
          color: #666;
        }
      }
      
      body {
        font-family: 'Times New Roman', serif;
        font-size: 12pt;
        line-height: 1.6;
        color: #000;
        margin: 0;
        padding: 0;
      }
      
      .document-header {
        text-align: center;
        margin-bottom: 40px;
        page-break-after: avoid;
      }
      
      .document-title {
        font-size: 16pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 20px;
      }
      
      .document-subtitle {
        font-size: 12pt;
        margin-bottom: 10px;
      }
      
      .preamble {
        text-align: justify;
        text-indent: 0.5in;
        margin-bottom: 30px;
        page-break-after: avoid;
      }
      
      .section {
        margin-bottom: 25px;
        page-break-inside: avoid;
      }
      
      .section-title {
        font-weight: bold;
        font-size: 12pt;
        text-transform: uppercase;
        margin-bottom: 10px;
        page-break-after: avoid;
      }
      
      .section-content {
        text-align: justify;
        text-indent: 0.5in;
        line-height: 1.6;
      }
      
      .subsection {
        margin: 15px 0;
        margin-left: 0.5in;
      }
      
      .subsection-title {
        font-weight: bold;
        margin-bottom: 5px;
      }
      
      .clause {
        margin: 10px 0;
        text-align: justify;
      }
      
      .signature-page {
        page-break-before: always;
        margin-top: 50px;
      }
      
      .signature-block {
        margin: 40px 0;
        page-break-inside: avoid;
      }
      
      .signature-line {
        border-bottom: 1px solid #000;
        width: 300px;
        height: 1px;
        margin: 30px 0 10px 0;
      }
      
      .signature-name {
        font-weight: bold;
        margin-bottom: 5px;
      }
      
      .signature-title {
        font-style: italic;
        margin-bottom: 5px;
      }
      
      .signature-date {
        margin-top: 10px;
      }
      
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 72pt;
        color: rgba(200, 200, 200, 0.3);
        z-index: -1;
        pointer-events: none;
      }
      
      .confidential-header {
        position: fixed;
        top: 0.5in;
        right: 1in;
        font-size: 10pt;
        color: #666;
        z-index: 100;
      }
      
      .page-numbering {
        position: fixed;
        bottom: 0.5in;
        right: 1in;
        font-size: 10pt;
        color: #666;
      }
      
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 15px 0;
      }
      
      th, td {
        border: 1px solid #000;
        padding: 8px;
        text-align: left;
      }
      
      th {
        background-color: #f5f5f5;
        font-weight: bold;
      }
      
      .highlight {
        background-color: #ffff99;
        padding: 2px;
      }
      
      .redline {
        background-color: #ffeeee;
        text-decoration: line-through;
      }
      
      .addition {
        background-color: #eeffee;
        text-decoration: underline;
      }
      
      .legal-warning {
        border: 2px solid #ff6b6b;
        background-color: #fff5f5;
        padding: 15px;
        margin: 20px 0;
        border-radius: 5px;
      }
      
      .compliance-note {
        border: 2px solid #4ecdc4;
        background-color: #f0fffe;
        padding: 10px;
        margin: 15px 0;
        border-radius: 3px;
        font-size: 10pt;
      }
      
      @media print {
        .no-print {
          display: none !important;
        }
        
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
      
      /* Entertainment industry specific styles */
      .guild-notice {
        border: 1px solid #2196F3;
        background-color: #f3f9ff;
        padding: 10px;
        margin: 15px 0;
        font-size: 11pt;
        border-radius: 3px;
      }
      
      .rights-table {
        width: 100%;
        margin: 20px 0;
        font-size: 11pt;
      }
      
      .rights-table th {
        background-color: #e8f4f8;
      }
      
      .financial-terms {
        border: 2px solid #4CAF50;
        background-color: #f8fff8;
        padding: 15px;
        margin: 20px 0;
        border-radius: 5px;
      }
      
      .risk-disclosure {
        border: 3px solid #FF5722;
        background-color: #fff8f6;
        padding: 20px;
        margin: 25px 0;
        border-radius: 8px;
        font-weight: bold;
      }
    </style>
  `;

  /**
   * Generate PDF using a simplified HTML-to-PDF approach
   * This is a placeholder implementation - in production, you'd use:
   * - Puppeteer in a Worker
   * - External PDF service API
   * - Browser automation service
   */
  private static async generatePDFBuffer(
    htmlContent: string,
    options: PDFGenerationOptions = {}
  ): Promise<Uint8Array> {
    const mergedOptions = { ...this.DEFAULT_PDF_OPTIONS, ...options };
    
    // Create complete HTML document with legal styles
    const styledHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Legal Document</title>
        ${this.LEGAL_STYLES}
        ${options.watermark ? `
          <style>
            .watermark::before {
              content: "${options.watermark.text}";
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: ${options.watermark.fontSize || 72}pt;
              color: ${options.watermark.color || 'rgba(200, 200, 200, ' + (options.watermark.opacity || 0.3) + ')'};
              z-index: -1;
              pointer-events: none;
            }
          </style>
        ` : ''}
      </head>
      <body>
        ${options.watermark ? '<div class="watermark"></div>' : ''}
        ${htmlContent}
      </body>
      </html>
    `;

    // In a real implementation, this would call a PDF generation service
    // For now, return the HTML as a UTF-8 encoded buffer as a placeholder
    return new TextEncoder().encode(styledHTML);
  }

  /**
   * Generate DOCX format (simplified implementation)
   */
  private static async generateDOCXBuffer(
    htmlContent: string,
    options: DocxGenerationOptions = {}
  ): Promise<Uint8Array> {
    // This is a placeholder implementation
    // In production, you'd use libraries like:
    // - docx (for creating DOCX from scratch)
    // - mammoth (for HTML to DOCX conversion)
    // - pandoc service
    
    const docxContent = this.htmlToDocxPlaceholder(htmlContent, options);
    return new TextEncoder().encode(docxContent);
  }

  private static htmlToDocxPlaceholder(
    htmlContent: string,
    options: DocxGenerationOptions
  ): string {
    // Very basic HTML to DOCX-like format conversion
    // This would be replaced with proper DOCX generation
    
    let docxContent = htmlContent;

    // Remove HTML tags and convert to plain text with formatting indicators
    docxContent = docxContent
      .replace(/<title[^>]*>(.*?)<\/title>/gi, '[$1 - Document Title]\n\n')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n**$1**\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n*$1*\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
      .replace(/<br\s*\/?>/gi, '\n');

    // Iteratively remove HTML tags to handle nested/malformed tags
    let previous = '';
    while (previous !== docxContent) {
      previous = docxContent;
      docxContent = docxContent.replace(/<[^>]*>/g, '');
    }

    docxContent = docxContent
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up extra newlines
      .trim();
    
    if (options.headerText) {
      docxContent = `${options.headerText}\n\n${docxContent}`;
    }
    
    if (options.footerText) {
      docxContent = `${docxContent}\n\n${options.footerText}`;
    }
    
    return docxContent;
  }

  public static async generatePDF(
    htmlContent: string,
    metadata?: PDFGenerationResult['metadata'],
    options?: PDFGenerationOptions
  ): Promise<PDFGenerationResult> {
    try {
      const pdfBuffer = await this.generatePDFBuffer(htmlContent, options);
      
      return {
        success: true,
        pdfBuffer,
        fileSize: pdfBuffer.length,
        pageCount: this.estimatePageCount(htmlContent),
        metadata: {
          title: metadata?.title || 'Legal Document',
          author: metadata?.author || 'Pitchey Legal Document System',
          subject: metadata?.subject || 'Entertainment Industry Legal Document',
          creator: 'Pitchey Document Automation',
          producer: 'Pitchey Legal PDF Generator',
          creationDate: new Date(),
          modificationDate: new Date(),
          ...metadata
        }
      };
    } catch (error) {
      console.error('PDF generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed'
      };
    }
  }

  public static async generateDOCX(
    htmlContent: string,
    options?: DocxGenerationOptions
  ): Promise<PDFGenerationResult> {
    try {
      const docxBuffer = await this.generateDOCXBuffer(htmlContent, options);
      
      return {
        success: true,
        docxBuffer,
        fileSize: docxBuffer.length
      };
    } catch (error) {
      console.error('DOCX generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'DOCX generation failed'
      };
    }
  }

  public static async generateBothFormats(
    htmlContent: string,
    pdfOptions?: PDFGenerationOptions,
    docxOptions?: DocxGenerationOptions,
    metadata?: PDFGenerationResult['metadata']
  ): Promise<PDFGenerationResult> {
    try {
      const [pdfResult, docxResult] = await Promise.all([
        this.generatePDF(htmlContent, metadata, pdfOptions),
        this.generateDOCX(htmlContent, docxOptions)
      ]);

      if (!pdfResult.success || !docxResult.success) {
        return {
          success: false,
          error: `PDF: ${pdfResult.error || 'Success'}, DOCX: ${docxResult.error || 'Success'}`
        };
      }

      return {
        success: true,
        pdfBuffer: pdfResult.pdfBuffer,
        docxBuffer: docxResult.docxBuffer,
        fileSize: (pdfResult.fileSize || 0) + (docxResult.fileSize || 0),
        pageCount: pdfResult.pageCount,
        metadata: pdfResult.metadata
      };
    } catch (error) {
      console.error('Document generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document generation failed'
      };
    }
  }

  private static estimatePageCount(htmlContent: string): number {
    // Rough estimation based on content length
    // This would be more accurate with actual PDF generation
    let stripped = htmlContent;
    let previous = '';
    while (previous !== stripped) {
      previous = stripped;
      stripped = stripped.replace(/<[^>]*>/g, '');
    }
    const textLength = stripped.length;
    const averageCharactersPerPage = 2500; // Estimated for 12pt Times New Roman
    return Math.max(1, Math.ceil(textLength / averageCharactersPerPage));
  }

  public static addLegalWatermark(
    htmlContent: string,
    watermarkText: string = 'CONFIDENTIAL',
    options?: { opacity?: number; fontSize?: number; color?: string }
  ): string {
    const watermarkOptions = {
      opacity: options?.opacity || 0.1,
      fontSize: options?.fontSize || 72,
      color: options?.color || '#cccccc'
    };

    const watermarkStyle = `
      <style>
        .legal-watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: ${watermarkOptions.fontSize}pt;
          color: ${watermarkOptions.color};
          opacity: ${watermarkOptions.opacity};
          z-index: -1;
          pointer-events: none;
          font-weight: bold;
          user-select: none;
        }
      </style>
    `;

    const watermarkDiv = `<div class="legal-watermark">${watermarkText}</div>`;

    // Insert watermark style in head and div in body
    return htmlContent
      .replace('</head>', `${watermarkStyle}</head>`)
      .replace('<body>', `<body>${watermarkDiv}`);
  }

  public static addConfidentialityNotice(htmlContent: string): string {
    const confidentialityNotice = `
      <div class="confidential-header">
        CONFIDENTIAL & PROPRIETARY
      </div>
    `;

    return htmlContent.replace('<body>', `<body>${confidentialityNotice}`);
  }

  public static addRedlining(
    htmlContent: string,
    changes: Array<{
      type: 'addition' | 'deletion' | 'modification';
      original?: string;
      replacement?: string;
      comment?: string;
    }>
  ): string {
    let redlinedContent = htmlContent;

    changes.forEach(change => {
      switch (change.type) {
        case 'addition':
          if (change.replacement) {
            redlinedContent = redlinedContent.replace(
              change.replacement,
              `<span class="addition">${change.replacement}</span>`
            );
          }
          break;

        case 'deletion':
          if (change.original) {
            redlinedContent = redlinedContent.replace(
              change.original,
              `<span class="redline">${change.original}</span>`
            );
          }
          break;

        case 'modification':
          if (change.original && change.replacement) {
            redlinedContent = redlinedContent.replace(
              change.original,
              `<span class="redline">${change.original}</span><span class="addition">${change.replacement}</span>`
            );
          }
          break;
      }
    });

    return redlinedContent;
  }

  public static createSignaturePage(
    parties: Array<{
      name: string;
      title?: string;
      company?: string;
      address?: string;
      signatureRequired?: boolean;
    }>,
    documentTitle: string,
    executionDate?: Date
  ): string {
    const formattedDate = executionDate 
      ? executionDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : '___________________';

    let signaturePage = `
      <div class="signature-page">
        <div class="document-header">
          <div class="document-title">SIGNATURE PAGE</div>
          <div class="document-subtitle">${documentTitle}</div>
        </div>
        
        <p>IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.</p>
        
        <p><strong>Date of Execution:</strong> ${formattedDate}</p>
        
        <div class="signature-blocks">
    `;

    parties.forEach((party, index) => {
      signaturePage += `
        <div class="signature-block">
          <div class="signature-name">${party.company || party.name}</div>
          ${party.company ? `<div class="signature-title">By: ${party.name}</div>` : ''}
          ${party.title ? `<div class="signature-title">Title: ${party.title}</div>` : ''}
          
          <div class="signature-line"></div>
          <div>Signature</div>
          
          <div style="margin-top: 20px;">
            <div>Date: _________________</div>
          </div>
          
          ${party.address ? `
            <div style="margin-top: 15px; font-size: 10pt;">
              ${party.address}
            </div>
          ` : ''}
        </div>
        
        ${index < parties.length - 1 ? '<br><br>' : ''}
      `;
    });

    signaturePage += `
        </div>
      </div>
    `;

    return signaturePage;
  }

  /**
   * Generate professional cover page for legal documents
   */
  public static createCoverPage(
    documentTitle: string,
    documentType: string,
    parties: Array<{
      name: string;
      role?: string;
      company?: string;
    }>,
    metadata?: {
      date?: Date;
      jurisdiction?: string;
      dealValue?: string;
      confidentialityLevel?: string;
    }
  ): string {
    const currentDate = metadata?.date || new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div class="cover-page">
        <div class="cover-header">
          ${metadata?.confidentialityLevel ? `
            <div class="confidentiality-notice">
              <strong>${metadata.confidentialityLevel.toUpperCase()}</strong>
            </div>
          ` : ''}
        </div>
        
        <div class="cover-content">
          <div class="document-title">
            <h1>${documentTitle}</h1>
            <h2>${documentType.replace('_', ' ').toUpperCase()}</h2>
          </div>
          
          <div class="parties-section">
            <h3>PARTIES</h3>
            ${parties.map(party => `
              <div class="party-info">
                <div class="party-name">${party.name}</div>
                ${party.company ? `<div class="party-company">${party.company}</div>` : ''}
                ${party.role ? `<div class="party-role">(${party.role})</div>` : ''}
              </div>
            `).join('')}
          </div>
          
          <div class="document-metadata">
            <div class="metadata-item">
              <strong>Date:</strong> ${formattedDate}
            </div>
            ${metadata?.jurisdiction ? `
              <div class="metadata-item">
                <strong>Jurisdiction:</strong> ${metadata.jurisdiction}
              </div>
            ` : ''}
            ${metadata?.dealValue ? `
              <div class="metadata-item">
                <strong>Deal Value:</strong> ${metadata.dealValue}
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="cover-footer">
          <div class="legal-notice">
            This document contains confidential and proprietary information. 
            Unauthorized disclosure is strictly prohibited and may result in legal action.
          </div>
        </div>
      </div>
      
      <style>
        .cover-page {
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-after: always;
          text-align: center;
          padding: 2in 1in;
        }
        
        .confidentiality-notice {
          font-size: 18pt;
          font-weight: bold;
          color: #d32f2f;
          border: 3px solid #d32f2f;
          padding: 20px;
          margin-bottom: 50px;
          background-color: #ffebee;
        }
        
        .document-title h1 {
          font-size: 32pt;
          font-weight: bold;
          margin: 50px 0 20px 0;
          color: #1a1a1a;
          text-transform: uppercase;
          letter-spacing: 3px;
        }
        
        .document-title h2 {
          font-size: 18pt;
          font-weight: normal;
          margin: 0 0 60px 0;
          color: #666;
        }
        
        .parties-section {
          margin: 60px 0;
        }
        
        .parties-section h3 {
          font-size: 16pt;
          font-weight: bold;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        
        .party-info {
          margin: 20px 0;
          padding: 20px;
          border: 1px solid #ddd;
          background-color: #fafafa;
        }
        
        .party-name {
          font-size: 14pt;
          font-weight: bold;
          color: #333;
        }
        
        .party-company {
          font-size: 12pt;
          color: #666;
          margin-top: 5px;
        }
        
        .party-role {
          font-size: 10pt;
          color: #888;
          font-style: italic;
          margin-top: 5px;
        }
        
        .document-metadata {
          margin: 40px 0;
          text-align: left;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .metadata-item {
          margin: 10px 0;
          font-size: 12pt;
          padding: 8px;
          border-bottom: 1px dotted #ccc;
        }
        
        .legal-notice {
          font-size: 10pt;
          color: #666;
          font-style: italic;
          line-height: 1.4;
          margin-top: 40px;
          padding: 20px;
          border-top: 1px solid #ddd;
        }
      </style>
    `;
  }

  /**
   * Generate table of contents for complex legal documents
   */
  public static createTableOfContents(
    sections: Array<{
      title: string;
      page?: number;
      subsections?: Array<{
        title: string;
        page?: number;
      }>;
    }>
  ): string {
    return `
      <div class="table-of-contents">
        <div class="toc-header">
          <h1>TABLE OF CONTENTS</h1>
        </div>
        
        <div class="toc-content">
          ${sections.map((section, index) => `
            <div class="toc-section">
              <div class="toc-entry">
                <span class="toc-number">${index + 1}.</span>
                <span class="toc-title">${section.title}</span>
                <span class="toc-dots">...................................................</span>
                <span class="toc-page">${section.page || (index + 2)}</span>
              </div>
              
              ${section.subsections ? section.subsections.map((subsection, subIndex) => `
                <div class="toc-subsection">
                  <span class="toc-number">${index + 1}.${subIndex + 1}</span>
                  <span class="toc-title">${subsection.title}</span>
                  <span class="toc-dots">...................................</span>
                  <span class="toc-page">${subsection.page || (index + 2)}</span>
                </div>
              `).join('') : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      <style>
        .table-of-contents {
          page-break-after: always;
          padding: 1in;
        }
        
        .toc-header h1 {
          text-align: center;
          font-size: 18pt;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 50px;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
        }
        
        .toc-section {
          margin-bottom: 15px;
        }
        
        .toc-entry {
          display: flex;
          align-items: baseline;
          margin-bottom: 8px;
          font-size: 12pt;
        }
        
        .toc-subsection {
          display: flex;
          align-items: baseline;
          margin-left: 30px;
          margin-bottom: 5px;
          font-size: 11pt;
          color: #666;
        }
        
        .toc-number {
          font-weight: bold;
          min-width: 40px;
        }
        
        .toc-title {
          flex: 1;
          margin-right: 10px;
        }
        
        .toc-dots {
          flex: 1;
          border-bottom: 1px dotted #999;
          margin: 0 10px;
          height: 0;
        }
        
        .toc-page {
          font-weight: bold;
          min-width: 30px;
          text-align: right;
        }
      </style>
    `;
  }

  /**
   * Enhanced document generation with professional templates
   */
  public static async generateProfessionalPDF(
    htmlContent: string,
    documentType: keyof typeof LegalPDFGenerator.DOCUMENT_TEMPLATES,
    documentInfo: {
      title: string;
      parties: Array<{
        name: string;
        role?: string;
        company?: string;
      }>;
      metadata?: any;
      sections?: Array<{
        title: string;
        subsections?: Array<{ title: string }>;
      }>;
    },
    options?: PDFGenerationOptions
  ): Promise<PDFGenerationResult> {
    const template = this.DOCUMENT_TEMPLATES[documentType];
    const mergedOptions = { ...this.DEFAULT_PDF_OPTIONS, ...options };
    
    let fullDocument = '';

    // Add cover page if required
    if (template.coverPage) {
      fullDocument += this.createCoverPage(
        documentInfo.title,
        documentType,
        documentInfo.parties,
        documentInfo.metadata
      );
    }

    // Add table of contents if required
    if (template.tableOfContents && documentInfo.sections) {
      fullDocument += this.createTableOfContents(documentInfo.sections);
    }

    // Add main document content
    fullDocument += `
      <div class="main-document">
        ${htmlContent}
      </div>
    `;

    // Add signature pages if required
    if (template.signaturePages) {
      fullDocument += this.createSignaturePage(
        documentInfo.parties,
        documentInfo.title,
        documentInfo.metadata?.executionDate
      );
    }

    // Add legal notices if required
    if (template.legalNotices) {
      fullDocument += this.createLegalNotices(documentType);
    }

    // Generate the styled document
    const styledHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${documentInfo.title}</title>
        ${this.LEGAL_STYLES}
        ${this.getTemplateStyles(template.formatting)}
      </head>
      <body>
        ${fullDocument}
      </body>
      </html>
    `;

    // Generate PDF buffer (placeholder implementation)
    const pdfBuffer = new TextEncoder().encode(styledHTML);

    return {
      success: true,
      pdfBuffer,
      fileSize: pdfBuffer.length,
      pageCount: this.estimatePageCount(styledHTML),
      metadata: {
        title: documentInfo.title,
        author: 'Pitchey Legal Document System',
        subject: `${documentType.replace('_', ' ')} - Professional Legal Document`,
        creator: 'Pitchey Advanced PDF Generator',
        producer: 'Pitchey Legal Automation Platform',
        creationDate: new Date(),
        modificationDate: new Date()
      }
    };
  }

  /**
   * Create legal notices and disclaimers
   */
  private static createLegalNotices(documentType: string): string {
    const notices = {
      investment_agreement: `
        <div class="legal-notices">
          <div class="page-break"></div>
          <h2>IMPORTANT LEGAL NOTICES</h2>
          
          <div class="notice-section">
            <h3>Securities Law Disclaimer</h3>
            <p>This document has been prepared for private placement to accredited investors only. 
            The securities described herein have not been registered under the Securities Act of 1933 
            and may not be offered or sold except pursuant to an exemption from registration.</p>
          </div>
          
          <div class="notice-section">
            <h3>Risk Warning</h3>
            <p>Investment in entertainment projects involves substantial risks and is suitable only for 
            investors who can afford to lose their entire investment. Past performance is not indicative 
            of future results.</p>
          </div>
          
          <div class="notice-section">
            <h3>Professional Advice</h3>
            <p>All parties should consult with their own legal, tax, and financial advisors before 
            entering into this agreement. This document does not constitute legal or financial advice.</p>
          </div>
        </div>
      `,
      production_contract: `
        <div class="legal-notices">
          <div class="page-break"></div>
          <h2>GUILD AND INDUSTRY NOTICES</h2>
          
          <div class="notice-section">
            <h3>Guild Compliance</h3>
            <p>This agreement is subject to all applicable guild agreements including but not limited to 
            WGA, DGA, SAG-AFTRA collective bargaining agreements and their successors.</p>
          </div>
          
          <div class="notice-section">
            <h3>Chain of Title</h3>
            <p>Producer warrants that all necessary rights, permissions, and clearances have been obtained 
            for the underlying material and that the chain of title is complete and unencumbered.</p>
          </div>
        </div>
      `,
      nda: `
        <div class="legal-notices">
          <h3>Confidentiality Notice</h3>
          <p>This agreement contains confidential and proprietary information. Any breach of 
          confidentiality may result in irreparable harm and legal action.</p>
        </div>
      `
    };

    return notices[documentType as keyof typeof notices] || '';
  }

  /**
   * Get template-specific CSS styles
   */
  private static getTemplateStyles(formatting: string): string {
    const styles = {
      formal: `
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            line-height: 1.8;
            font-size: 11pt;
          }
          .main-document {
            counter-reset: page;
          }
          .section-title {
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 30px 0 15px 0;
            border-bottom: 2px solid #333;
            padding-bottom: 5px;
          }
          .subsection {
            margin: 20px 0 15px 30px;
          }
          .page-break { page-break-before: always; }
          .legal-notices {
            font-size: 10pt;
            line-height: 1.6;
            margin-top: 40px;
          }
          .notice-section {
            margin: 25px 0;
            padding: 15px;
            border-left: 4px solid #2196F3;
            background-color: #f8f9fa;
          }
        </style>
      `,
      standard: `
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            line-height: 1.6;
            font-size: 12pt;
          }
          .section-title {
            font-size: 13pt;
            font-weight: bold;
            margin: 25px 0 10px 0;
          }
          .page-break { page-break-before: always; }
        </style>
      `,
      simple: `
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            line-height: 1.5;
            font-size: 12pt;
          }
          .section-title {
            font-weight: bold;
            margin: 20px 0 8px 0;
          }
        </style>
      `
    };

    return styles[formatting as keyof typeof styles] || styles.standard;
  }

  /**
   * Generate document with electronic signature placeholders
   */
  public static createElectronicSignatureDocument(
    htmlContent: string,
    signers: Array<{
      name: string;
      email: string;
      role: string;
      signatureRequired: boolean;
      signatureMethod?: 'docusign' | 'adobe_sign' | 'hellosign';
    }>,
    metadata?: {
      documentId?: string;
      expirationDate?: Date;
    }
  ): string {
    const signatureSection = `
      <div class="electronic-signatures">
        <div class="page-break"></div>
        <div class="signature-header">
          <h2>ELECTRONIC SIGNATURE AUTHENTICATION</h2>
          <p>This document has been prepared for electronic signature. Each signatory will receive 
          secure access to sign via their designated electronic signature platform.</p>
          
          ${metadata?.documentId ? `
            <div class="document-info">
              <strong>Document ID:</strong> ${metadata.documentId}
            </div>
          ` : ''}
          
          ${metadata?.expirationDate ? `
            <div class="document-info">
              <strong>Signature Deadline:</strong> ${metadata.expirationDate.toLocaleDateString()}
            </div>
          ` : ''}
        </div>
        
        <div class="signers-list">
          <h3>Required Signatures</h3>
          ${signers.map((signer, index) => `
            <div class="signer-info">
              <div class="signer-details">
                <div class="signer-name"><strong>${signer.name}</strong></div>
                <div class="signer-email">${signer.email}</div>
                <div class="signer-role">${signer.role}</div>
                ${signer.signatureMethod ? `
                  <div class="signature-method">Via: ${signer.signatureMethod}</div>
                ` : ''}
              </div>
              
              <div class="signature-placeholder">
                <div class="signature-box">
                  [Electronic Signature Required]
                </div>
                <div class="signature-status">Status: Pending</div>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="signature-footer">
          <p><em>Note: This document will only be considered executed when all required 
          electronic signatures have been completed and verified.</em></p>
        </div>
      </div>
      
      <style>
        .electronic-signatures {
          margin-top: 50px;
          padding: 30px;
          border: 2px solid #e0e0e0;
          background-color: #fafafa;
        }
        
        .signature-header h2 {
          color: #1976d2;
          border-bottom: 2px solid #1976d2;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        
        .document-info {
          margin: 10px 0;
          padding: 8px;
          background-color: #e3f2fd;
          border-left: 4px solid #1976d2;
        }
        
        .signers-list h3 {
          margin: 30px 0 20px 0;
          font-size: 14pt;
        }
        
        .signer-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 15px 0;
          padding: 15px;
          border: 1px solid #ddd;
          background-color: white;
          border-radius: 5px;
        }
        
        .signer-details {
          flex: 1;
        }
        
        .signer-name {
          font-size: 13pt;
          margin-bottom: 5px;
        }
        
        .signer-email {
          color: #666;
          font-size: 11pt;
        }
        
        .signer-role {
          color: #888;
          font-size: 10pt;
          font-style: italic;
        }
        
        .signature-method {
          color: #1976d2;
          font-size: 10pt;
          margin-top: 5px;
        }
        
        .signature-placeholder {
          text-align: center;
          margin-left: 30px;
        }
        
        .signature-box {
          width: 200px;
          height: 60px;
          border: 2px dashed #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-style: italic;
          color: #666;
          background-color: #f9f9f9;
        }
        
        .signature-status {
          margin-top: 8px;
          font-size: 10pt;
          color: #ff9800;
          font-weight: bold;
        }
        
        .signature-footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          font-size: 10pt;
          color: #666;
        }
      </style>
    `;

    return htmlContent + signatureSection;
  }
}

export default LegalPDFGenerator;