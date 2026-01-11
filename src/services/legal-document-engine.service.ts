/**
 * Legal Document Template Engine Service
 * Handles variable substitution, conditional clauses, and document generation
 * for entertainment industry legal documents
 */

export interface DocumentVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'text' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
  min?: number;
  max?: number;
  validation?: string; // Regex pattern
  format?: string; // For dates, currencies, etc.
}

export interface ConditionalClause {
  condition: string; // JavaScript-like condition string
  required_clauses?: string[];
  additional_clauses?: string[];
  modifications?: Record<string, any>;
  replacement_content?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template_content: any;
  variables: Record<string, DocumentVariable>;
  conditional_clauses?: Record<string, ConditionalClause>;
  jurisdictions: string[];
  compliance_requirements?: Record<string, any>;
  version: string;
  is_active: boolean;
}

export interface LegalClause {
  id: string;
  name: string;
  description: string;
  category: string;
  clause_text: string;
  variables: Record<string, DocumentVariable>;
  applicable_jurisdictions: string[];
  applicable_document_types: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_legal_review: boolean;
}

export interface GenerationContext {
  variables: Record<string, any>;
  jurisdiction: string;
  document_type: string;
  parties: Array<{
    id: string;
    name: string;
    type: 'creator' | 'investor' | 'production_company' | 'individual';
    email?: string;
    address?: string;
  }>;
  related_entities?: {
    pitch_id?: string;
    nda_id?: string;
    investment_id?: string;
  };
}

export interface GeneratedDocument {
  id: string;
  template_id: string;
  document_name: string;
  document_type: string;
  status: 'draft' | 'under_review' | 'approved' | 'executed' | 'cancelled' | 'expired';
  generated_content: any;
  template_variables: Record<string, any>;
  conditional_clauses_applied: string[];
  parties: any[];
  jurisdiction: string;
  compliance_status: 'pending' | 'compliant' | 'requires_review' | 'non_compliant';
  html_preview?: string;
  pdf_file_path?: string;
  docx_file_path?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    type: 'required' | 'format' | 'range' | 'enum' | 'custom';
  }>;
  warnings: Array<{
    field: string;
    message: string;
    type: 'compliance' | 'legal_review' | 'best_practice';
  }>;
}

export class LegalDocumentEngine {
  // AI-powered clause recommendation cache
  private static clauseRecommendationCache = new Map<string, string[]>();
  
  // Template version control
  private static templateVersions = new Map<string, DocumentTemplate[]>();
  
  // Document change tracking
  private static documentChangeHistory = new Map<string, Array<{
    timestamp: Date;
    changes: any;
    author: string;
    comment?: string;
  }>>();

  private static formatCurrency(amount: number | string, currency: string = 'USD'): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numAmount);
  }

  private static formatDate(date: string | Date, format: string = 'long'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: format as any,
    }).format(dateObj);
  }

  private static formatPartyNames(parties: Array<{ name: string; type: string }>): string {
    if (parties.length === 1) {
      return parties[0].name;
    }
    
    if (parties.length === 2) {
      return `${parties[0].name} and ${parties[1].name}`;
    }
    
    const lastParty = parties[parties.length - 1];
    const otherParties = parties.slice(0, -1);
    return `${otherParties.map(p => p.name).join(', ')}, and ${lastParty.name}`;
  }

  private static generateSignatureBlocks(parties: Array<{ name: string; type: string; email?: string }>): string {
    return parties.map((party, index) => `
      <div class="signature-block">
        <p><strong>${party.type.toUpperCase()}:</strong></p>
        <br><br>
        <div class="signature-line">
          <span>_________________________________</span>
        </div>
        <p>${party.name}</p>
        ${party.email ? `<p>Email: ${party.email}</p>` : ''}
        <p>Date: _________________</p>
      </div>
    `).join('\n\n');
  }

  public static validateVariables(
    variables: Record<string, any>, 
    schema: Record<string, DocumentVariable>
  ): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // Check required fields
    Object.entries(schema).forEach(([key, variable]) => {
      const value = variables[key];
      
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: key,
          message: `${variable.description} is required`,
          type: 'required'
        });
        return;
      }

      if (value !== undefined && value !== null && value !== '') {
        // Type validation
        switch (variable.type) {
          case 'number':
            if (isNaN(Number(value))) {
              errors.push({
                field: key,
                message: `${variable.description} must be a valid number`,
                type: 'format'
              });
            } else {
              const numValue = Number(value);
              if (variable.min !== undefined && numValue < variable.min) {
                errors.push({
                  field: key,
                  message: `${variable.description} must be at least ${variable.min}`,
                  type: 'range'
                });
              }
              if (variable.max !== undefined && numValue > variable.max) {
                errors.push({
                  field: key,
                  message: `${variable.description} must be no more than ${variable.max}`,
                  type: 'range'
                });
              }
            }
            break;

          case 'date':
            if (isNaN(Date.parse(value))) {
              errors.push({
                field: key,
                message: `${variable.description} must be a valid date`,
                type: 'format'
              });
            }
            break;

          case 'currency':
            if (isNaN(Number(value.toString().replace(/[^0-9.-]/g, '')))) {
              errors.push({
                field: key,
                message: `${variable.description} must be a valid currency amount`,
                type: 'format'
              });
            }
            break;

          case 'string':
            if (variable.enum && !variable.enum.includes(value)) {
              errors.push({
                field: key,
                message: `${variable.description} must be one of: ${variable.enum.join(', ')}`,
                type: 'enum'
              });
            }
            if (variable.validation) {
              const regex = new RegExp(variable.validation);
              if (!regex.test(value)) {
                errors.push({
                  field: key,
                  message: `${variable.description} format is invalid`,
                  type: 'format'
                });
              }
            }
            break;
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public static evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      // Simple condition evaluator (safe subset of JavaScript)
      // Replace variable names with their values
      let evaluableCondition = condition;
      
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        const safeValue = typeof value === 'string' ? `"${value}"` : String(value);
        evaluableCondition = evaluableCondition.replace(regex, safeValue);
      });

      // Only allow safe operations
      const safeOperations = /^[\w\s"'.,><=!&|()+-/*%\[\]]+$/;
      if (!safeOperations.test(evaluableCondition)) {
        console.warn('Unsafe condition detected:', condition);
        return false;
      }

      // Use Function constructor as a safer alternative to eval
      return new Function(`return ${evaluableCondition}`)();
    } catch (error) {
      console.error('Error evaluating condition:', condition, error);
      return false;
    }
  }

  public static substituteVariables(
    content: string, 
    variables: Record<string, any>,
    functions?: Record<string, (value: any) => string>
  ): string {
    let result = content;

    // Standard variable substitution
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      let substitutedValue = String(value || '');
      
      // Apply formatting based on variable type
      if (key.includes('_date') && value) {
        substitutedValue = this.formatDate(value);
      } else if (key.includes('_amount') && value) {
        substitutedValue = this.formatCurrency(value);
      }

      result = result.replace(regex, substitutedValue);
    });

    // Function-based substitutions
    if (functions) {
      Object.entries(functions).forEach(([key, func]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, func(variables));
      });
    }

    return result;
  }

  public static applyClauses(
    templateContent: any,
    availableClauses: LegalClause[],
    requiredClauses: string[],
    conditionalClauses: Record<string, ConditionalClause>,
    variables: Record<string, any>
  ): { content: any; appliedClauses: string[] } {
    const appliedClauses: string[] = [];
    let content = JSON.parse(JSON.stringify(templateContent)); // Deep clone

    // Apply required clauses
    requiredClauses.forEach(clauseName => {
      const clause = availableClauses.find(c => c.name.toLowerCase().replace(/\s+/g, '_') === clauseName);
      if (clause) {
        appliedClauses.push(clause.id);
        
        // Find appropriate place to insert clause
        if (content.sections && Array.isArray(content.sections)) {
          const clauseContent = this.substituteVariables(clause.clause_text, variables);
          content.sections.push({
            title: clause.name,
            content: clauseContent
          });
        }
      }
    });

    // Evaluate and apply conditional clauses
    Object.entries(conditionalClauses).forEach(([name, conditionalClause]) => {
      if (this.evaluateCondition(conditionalClause.condition, variables)) {
        // Apply required clauses for this condition
        if (conditionalClause.required_clauses) {
          conditionalClause.required_clauses.forEach(clauseName => {
            const clause = availableClauses.find(c => c.name.toLowerCase().replace(/\s+/g, '_') === clauseName);
            if (clause && !appliedClauses.includes(clause.id)) {
              appliedClauses.push(clause.id);
              
              if (content.sections && Array.isArray(content.sections)) {
                const clauseContent = this.substituteVariables(clause.clause_text, variables);
                content.sections.push({
                  title: clause.name,
                  content: clauseContent
                });
              }
            }
          });
        }

        // Apply content modifications
        if (conditionalClause.modifications) {
          Object.entries(conditionalClause.modifications).forEach(([key, modification]) => {
            if (content[key]) {
              content[key] = this.substituteVariables(String(modification), variables);
            }
          });
        }
      }
    });

    return { content, appliedClauses };
  }

  public static generateHTMLPreview(
    content: any,
    variables: Record<string, any>,
    parties: Array<{ name: string; type: string; email?: string }>
  ): string {
    const substitutedContent = this.substituteVariables(
      JSON.stringify(content),
      variables,
      {
        party_names_formatted: () => this.formatPartyNames(parties),
        signature_blocks: () => this.generateSignatureBlocks(parties),
        effective_date: () => this.formatDate(variables.effective_date || new Date()),
      }
    );

    const parsedContent = JSON.parse(substitutedContent);

    let html = `
      <html>
      <head>
        <meta charset="utf-8">
        <title>${parsedContent.title || 'Legal Document'}</title>
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            max-width: 8.5in; 
            margin: 0 auto; 
            padding: 1in;
            line-height: 1.6;
          }
          .title { 
            text-align: center; 
            font-weight: bold; 
            font-size: 18px; 
            margin-bottom: 30px;
            text-transform: uppercase;
          }
          .preamble { 
            margin-bottom: 30px; 
            text-align: justify;
            text-indent: 30px;
          }
          .section { 
            margin-bottom: 25px; 
          }
          .section-title { 
            font-weight: bold; 
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .section-content { 
            text-align: justify; 
            text-indent: 30px;
          }
          .signature-block { 
            margin: 40px 0; 
            page-break-inside: avoid;
          }
          .signature-line { 
            border-bottom: 1px solid #000; 
            width: 300px; 
            margin: 20px 0 5px 0;
          }
          @media print {
            body { padding: 0.5in; }
          }
        </style>
      </head>
      <body>
    `;

    if (parsedContent.title) {
      html += `<div class="title">${parsedContent.title}</div>`;
    }

    if (parsedContent.preamble) {
      html += `<div class="preamble">${parsedContent.preamble}</div>`;
    }

    if (parsedContent.sections && Array.isArray(parsedContent.sections)) {
      parsedContent.sections.forEach((section: any) => {
        html += `
          <div class="section">
            <div class="section-title">${section.title}</div>
            <div class="section-content">${section.content}</div>
          </div>
        `;
      });
    }

    if (parsedContent.signature_blocks) {
      html += `<div class="signatures">${parsedContent.signature_blocks}</div>`;
    }

    html += `
      </body>
      </html>
    `;

    return html;
  }

  public static validateCompliance(
    document: GeneratedDocument,
    jurisdictionRules: any,
    complianceRequirements: any
  ): {
    status: 'compliant' | 'requires_review' | 'non_compliant';
    issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      clause?: string;
      recommendation?: string;
    }>;
  } {
    const issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      clause?: string;
      recommendation?: string;
    }> = [];

    // Check jurisdiction-specific requirements
    if (jurisdictionRules && jurisdictionRules[document.jurisdiction]) {
      const rules = jurisdictionRules[document.jurisdiction];

      // Check required clauses
      if (rules.required_clauses && rules.required_clauses[document.document_type]) {
        const requiredClauses = rules.required_clauses[document.document_type];
        requiredClauses.forEach((requiredClause: string) => {
          if (!document.conditional_clauses_applied.includes(requiredClause)) {
            issues.push({
              type: 'error',
              message: `Missing required clause for ${document.jurisdiction}: ${requiredClause}`,
              clause: requiredClause,
              recommendation: `Add the ${requiredClause} clause to comply with ${document.jurisdiction} regulations`
            });
          }
        });
      }

      // Check prohibited clauses
      if (rules.prohibited_clauses && rules.prohibited_clauses[document.document_type]) {
        const prohibitedClauses = rules.prohibited_clauses[document.document_type];
        prohibitedClauses.forEach((prohibitedClause: string) => {
          if (document.conditional_clauses_applied.includes(prohibitedClause)) {
            issues.push({
              type: 'error',
              message: `Prohibited clause found for ${document.jurisdiction}: ${prohibitedClause}`,
              clause: prohibitedClause,
              recommendation: `Remove the ${prohibitedClause} clause to comply with ${document.jurisdiction} regulations`
            });
          }
        });
      }
    }

    // Check document-specific compliance requirements
    if (complianceRequirements && complianceRequirements[document.jurisdiction]) {
      const requirements = complianceRequirements[document.jurisdiction];

      // Investment agreement specific checks
      if (document.document_type === 'investment_agreement') {
        if (requirements.required_clauses?.includes('sec_disclaimer')) {
          const hasSecDisclaimer = document.conditional_clauses_applied.some(clause => 
            clause.includes('sec_risk_disclosure')
          );
          if (!hasSecDisclaimer) {
            issues.push({
              type: 'error',
              message: 'SEC risk disclosure required for investment agreements',
              recommendation: 'Add SEC-compliant risk disclosure language'
            });
          }
        }
      }

      // NDA specific checks
      if (document.document_type === 'nda') {
        if (requirements.required_clauses?.includes('gdpr_compliance')) {
          issues.push({
            type: 'warning',
            message: 'Ensure GDPR compliance for EU data subjects',
            recommendation: 'Review data protection clauses for GDPR compliance'
          });
        }
      }
    }

    // Determine overall status
    const hasErrors = issues.some(issue => issue.type === 'error');
    const hasWarnings = issues.some(issue => issue.type === 'warning');

    let status: 'compliant' | 'requires_review' | 'non_compliant';
    if (hasErrors) {
      status = 'non_compliant';
    } else if (hasWarnings) {
      status = 'requires_review';
    } else {
      status = 'compliant';
    }

    return { status, issues };
  }

  /**
   * AI-powered clause recommendation engine
   * Analyzes deal context and suggests appropriate legal clauses
   */
  public static async recommendClauses(
    documentType: string,
    jurisdiction: string,
    dealContext: {
      dealSize?: number;
      industryType?: string;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      internationalParties?: boolean;
      unionInvolved?: boolean;
      publicFunding?: boolean;
      distributionScope?: 'local' | 'national' | 'international';
    },
    availableClauses: LegalClause[]
  ): Promise<{
    recommended: Array<{
      clause: LegalClause;
      relevanceScore: number;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    warnings: Array<{
      message: string;
      severity: 'critical' | 'warning' | 'info';
    }>;
  }> {
    const cacheKey = `${documentType}-${jurisdiction}-${JSON.stringify(dealContext)}`;
    
    // Check cache first
    if (this.clauseRecommendationCache.has(cacheKey)) {
      const cachedClauseIds = this.clauseRecommendationCache.get(cacheKey)!;
      const cachedClauses = availableClauses.filter(c => cachedClauseIds.includes(c.id));
      return {
        recommended: cachedClauses.map(clause => ({
          clause,
          relevanceScore: 0.8, // Cached score
          reason: 'Previously recommended for similar deals',
          priority: 'medium' as const
        })),
        warnings: []
      };
    }

    const recommendations: Array<{
      clause: LegalClause;
      relevanceScore: number;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    const warnings: Array<{
      message: string;
      severity: 'critical' | 'warning' | 'info';
    }> = [];

    // Filter clauses by document type and jurisdiction
    const applicableClauses = availableClauses.filter(clause => 
      clause.applicable_document_types.includes(documentType) &&
      clause.applicable_jurisdictions.includes(jurisdiction)
    );

    // Score and recommend clauses based on context
    applicableClauses.forEach(clause => {
      let relevanceScore = 0;
      let reason = '';
      let priority: 'high' | 'medium' | 'low' = 'low';

      // Base scoring by category
      if (documentType === 'investment_agreement') {
        if (clause.category === 'risk_disclosure') {
          relevanceScore += 0.9;
          reason = 'Critical for investment compliance';
          priority = 'high';
        } else if (clause.category === 'financial') {
          relevanceScore += 0.8;
          reason = 'Essential for investment terms';
          priority = 'high';
        }
      } else if (documentType === 'production_contract') {
        if (clause.category === 'guild_compliance') {
          relevanceScore += 0.9;
          reason = 'Required for union compliance';
          priority = 'high';
        } else if (clause.category === 'intellectual_property') {
          relevanceScore += 0.85;
          reason = 'Critical for rights management';
          priority = 'high';
        }
      }

      // Context-based adjustments
      if (dealContext.dealSize && dealContext.dealSize > 1000000) {
        if (clause.category === 'liability' || clause.category === 'insurance') {
          relevanceScore += 0.2;
          reason += ' (High value deal requires enhanced protection)';
          priority = 'high';
        }
      }

      if (dealContext.internationalParties) {
        if (clause.category === 'currency' || clause.category === 'jurisdiction') {
          relevanceScore += 0.3;
          reason += ' (International parties require specific clauses)';
          priority = priority === 'high' ? 'high' : 'medium';
        }
      }

      if (dealContext.unionInvolved) {
        if (clause.category === 'guild_compliance' || clause.category === 'labor_standards') {
          relevanceScore += 0.4;
          reason += ' (Union involvement requires compliance clauses)';
          priority = 'high';
        }
      }

      if (dealContext.riskLevel === 'high' || dealContext.riskLevel === 'critical') {
        if (clause.category === 'termination' || clause.category === 'force_majeure') {
          relevanceScore += 0.25;
          reason += ' (High risk deal needs exit provisions)';
        }
      }

      // Risk-based warnings
      if (clause.risk_level === 'critical' && relevanceScore < 0.5) {
        warnings.push({
          message: `Consider including ${clause.name} - it's marked as critical risk`,
          severity: 'warning'
        });
      }

      if (clause.requires_legal_review && relevanceScore > 0.7) {
        warnings.push({
          message: `${clause.name} requires legal review before inclusion`,
          severity: 'info'
        });
      }

      // Only recommend if score is above threshold
      if (relevanceScore > 0.4) {
        recommendations.push({
          clause,
          relevanceScore,
          reason: reason || 'Standard for this document type',
          priority
        });
      }
    });

    // Sort by relevance score
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Cache the results
    const recommendedClauseIds = recommendations.slice(0, 10).map(r => r.clause.id);
    this.clauseRecommendationCache.set(cacheKey, recommendedClauseIds);

    return {
      recommended: recommendations.slice(0, 10), // Top 10 recommendations
      warnings
    };
  }

  /**
   * Risk assessment for unusual or non-standard terms
   */
  public static assessDocumentRisk(
    document: Partial<GeneratedDocument>,
    industry: string = 'entertainment'
  ): {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: Array<{
      factor: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
    }>;
    complianceScore: number; // 0-100
  } {
    const riskFactors: Array<{
      factor: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
    }> = [];

    let totalRiskScore = 0;
    let complianceScore = 100;

    // Check for unusual financial terms
    const content = JSON.stringify(document.generated_content || {}).toLowerCase();
    
    // High-risk terms detection
    const highRiskTerms = [
      { term: 'guaranteed return', risk: 'critical', desc: 'Guaranteed returns may violate securities laws' },
      { term: 'no risk', risk: 'high', desc: 'No-risk claims are misleading and prohibited' },
      { term: 'exclusive forever', risk: 'high', desc: 'Perpetual exclusive rights are unusual and risky' },
      { term: 'unlimited liability', risk: 'critical', desc: 'Unlimited liability exposes parties to excessive risk' },
      { term: 'waive all rights', risk: 'high', desc: 'Broad rights waivers may be unenforceable' }
    ];

    highRiskTerms.forEach(({ term, risk, desc }) => {
      if (content.includes(term)) {
        const riskLevel = risk as 'low' | 'medium' | 'high' | 'critical';
        riskFactors.push({
          factor: `Unusual Term: ${term}`,
          riskLevel,
          description: desc,
          recommendation: `Review and modify ${term} provisions with legal counsel`
        });
        
        totalRiskScore += riskLevel === 'critical' ? 4 : riskLevel === 'high' ? 3 : riskLevel === 'medium' ? 2 : 1;
        complianceScore -= riskLevel === 'critical' ? 25 : riskLevel === 'high' ? 15 : 10;
      }
    });

    // Check for missing standard protections
    const standardProtections = [
      { term: 'force majeure', factor: 'Missing Force Majeure', risk: 'medium' },
      { term: 'limitation of liability', factor: 'No Liability Cap', risk: 'high' },
      { term: 'governing law', factor: 'No Governing Law', risk: 'medium' },
      { term: 'dispute resolution', factor: 'No Dispute Resolution', risk: 'medium' }
    ];

    standardProtections.forEach(({ term, factor, risk }) => {
      if (!content.includes(term)) {
        const riskLevel = risk as 'low' | 'medium' | 'high' | 'critical';
        riskFactors.push({
          factor,
          riskLevel,
          description: `Document lacks standard ${term} provisions`,
          recommendation: `Add ${term} clause for better protection`
        });
        
        totalRiskScore += riskLevel === 'high' ? 3 : 2;
        complianceScore -= 10;
      }
    });

    // Industry-specific risk assessment
    if (industry === 'entertainment') {
      const entertainmentProtections = [
        { term: 'chain of title', factor: 'Missing Chain of Title', risk: 'critical' },
        { term: 'guild compliance', factor: 'No Guild Compliance', risk: 'high' },
        { term: 'moral rights', factor: 'Moral Rights Not Addressed', risk: 'medium' }
      ];

      entertainmentProtections.forEach(({ term, factor, risk }) => {
        if (document.document_type === 'production_contract' && !content.includes(term)) {
          const riskLevel = risk as 'low' | 'medium' | 'high' | 'critical';
          riskFactors.push({
            factor,
            riskLevel,
            description: `Critical entertainment industry protection missing: ${term}`,
            recommendation: `Add comprehensive ${term} provisions`
          });
          
          totalRiskScore += riskLevel === 'critical' ? 4 : riskLevel === 'high' ? 3 : 2;
          complianceScore -= riskLevel === 'critical' ? 20 : 15;
        }
      });
    }

    // Calculate overall risk
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (totalRiskScore >= 10) overallRisk = 'critical';
    else if (totalRiskScore >= 6) overallRisk = 'high';
    else if (totalRiskScore >= 3) overallRisk = 'medium';
    else overallRisk = 'low';

    return {
      overallRisk,
      riskFactors,
      complianceScore: Math.max(0, complianceScore)
    };
  }

  /**
   * Multi-language document generation support
   */
  public static async translateDocument(
    content: any,
    targetLanguage: string,
    legalTerminology: boolean = true
  ): Promise<{
    translatedContent: any;
    confidence: number;
    warnings: string[];
  }> {
    // This would integrate with a professional legal translation service
    // For now, return a placeholder implementation
    
    const warnings: string[] = [];
    
    if (legalTerminology) {
      warnings.push('Legal terminology translation requires professional review');
      warnings.push('Ensure translated document complies with local legal requirements');
    }

    // In production, this would call a translation API
    // that specializes in legal documents
    const translatedContent = {
      ...content,
      metadata: {
        originalLanguage: 'en',
        targetLanguage,
        translationDate: new Date().toISOString(),
        requiresLegalReview: true
      }
    };

    return {
      translatedContent,
      confidence: 0.85, // Mock confidence score
      warnings
    };
  }

  /**
   * Document comparison and change tracking
   */
  public static compareDocumentVersions(
    originalDocument: any,
    modifiedDocument: any
  ): {
    changes: Array<{
      type: 'addition' | 'deletion' | 'modification';
      field: string;
      originalValue?: any;
      newValue?: any;
      section?: string;
    }>;
    changesSummary: {
      totalChanges: number;
      additions: number;
      deletions: number;
      modifications: number;
    };
  } {
    const changes: Array<{
      type: 'addition' | 'deletion' | 'modification';
      field: string;
      originalValue?: any;
      newValue?: any;
      section?: string;
    }> = [];

    function deepCompare(obj1: any, obj2: any, path: string = ''): void {
      const keys1 = Object.keys(obj1 || {});
      const keys2 = Object.keys(obj2 || {});
      const allKeys = new Set([...keys1, ...keys2]);

      allKeys.forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];

        if (val1 === undefined && val2 !== undefined) {
          changes.push({
            type: 'addition',
            field: currentPath,
            newValue: val2,
            section: path.split('.')[0] || 'root'
          });
        } else if (val1 !== undefined && val2 === undefined) {
          changes.push({
            type: 'deletion',
            field: currentPath,
            originalValue: val1,
            section: path.split('.')[0] || 'root'
          });
        } else if (val1 !== val2) {
          if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
            deepCompare(val1, val2, currentPath);
          } else {
            changes.push({
              type: 'modification',
              field: currentPath,
              originalValue: val1,
              newValue: val2,
              section: path.split('.')[0] || 'root'
            });
          }
        }
      });
    }

    deepCompare(originalDocument, modifiedDocument);

    const changesSummary = {
      totalChanges: changes.length,
      additions: changes.filter(c => c.type === 'addition').length,
      deletions: changes.filter(c => c.type === 'deletion').length,
      modifications: changes.filter(c => c.type === 'modification').length
    };

    return {
      changes,
      changesSummary
    };
  }

  /**
   * Template version control and management
   */
  public static saveTemplateVersion(
    templateId: string,
    template: DocumentTemplate,
    authorId: string,
    comment?: string
  ): void {
    if (!this.templateVersions.has(templateId)) {
      this.templateVersions.set(templateId, []);
    }

    const versions = this.templateVersions.get(templateId)!;
    const newVersion = {
      ...template,
      version: `${versions.length + 1}.0`,
      created_at: new Date().toISOString(),
      created_by: authorId,
      version_comment: comment
    };

    versions.push(newVersion);
    this.templateVersions.set(templateId, versions);
  }

  public static getTemplateVersionHistory(templateId: string): DocumentTemplate[] {
    return this.templateVersions.get(templateId) || [];
  }

  /**
   * Document change history tracking
   */
  public static trackDocumentChange(
    documentId: string,
    changes: any,
    authorId: string,
    comment?: string
  ): void {
    if (!this.documentChangeHistory.has(documentId)) {
      this.documentChangeHistory.set(documentId, []);
    }

    const history = this.documentChangeHistory.get(documentId)!;
    history.push({
      timestamp: new Date(),
      changes,
      author: authorId,
      comment
    });

    this.documentChangeHistory.set(documentId, history);
  }

  public static getDocumentChangeHistory(documentId: string) {
    return this.documentChangeHistory.get(documentId) || [];
  }

  public static async generateDocument(
    template: DocumentTemplate,
    context: GenerationContext,
    availableClauses: LegalClause[]
  ): Promise<{
    document: Partial<GeneratedDocument>;
    validation: ValidationResult;
    compliance: ReturnType<typeof LegalDocumentEngine.validateCompliance>;
  }> {
    // Validate input variables
    const validation = this.validateVariables(context.variables, template.variables);
    
    if (!validation.isValid) {
      return {
        document: {},
        validation,
        compliance: { status: 'non_compliant', issues: [] }
      };
    }

    // Apply conditional clauses and substitutions
    const requiredClauses: string[] = [];
    const { content, appliedClauses } = this.applyClauses(
      template.template_content,
      availableClauses,
      requiredClauses,
      template.conditional_clauses || {},
      context.variables
    );

    // Generate HTML preview
    const htmlPreview = this.generateHTMLPreview(content, context.variables, context.parties);

    // Create document object
    const document: Partial<GeneratedDocument> = {
      template_id: template.id,
      document_name: `${template.name} - ${context.variables.project_title || 'Untitled'}`,
      document_type: template.category,
      status: 'draft',
      generated_content: content,
      template_variables: context.variables,
      conditional_clauses_applied: appliedClauses,
      parties: context.parties,
      jurisdiction: context.jurisdiction,
      html_preview: htmlPreview,
      compliance_status: 'pending'
    };

    // Validate compliance
    const compliance = this.validateCompliance(
      document as GeneratedDocument,
      null, // Would be loaded from database
      template.compliance_requirements
    );

    document.compliance_status = compliance.status;

    return {
      document,
      validation,
      compliance
    };
  }
}

export default LegalDocumentEngine;