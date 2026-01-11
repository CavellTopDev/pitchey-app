-- Seed Legal Document Templates and Clauses
-- Entertainment Industry Standard Templates

-- Insert Jurisdiction Compliance Rules
INSERT INTO jurisdiction_compliance (jurisdiction, jurisdiction_name, document_types, required_clauses, prohibited_clauses, signature_requirements, disclosure_requirements, entertainment_industry_rules, financial_regulations) VALUES 
(
    'US',
    'United States',
    '["nda", "investment_agreement", "term_sheet", "production_contract", "talent_agreement", "distribution_agreement"]',
    '{
        "investment_agreement": ["sec_disclaimer", "accredited_investor_verification", "risk_disclosure"],
        "production_contract": ["guild_compliance", "union_requirements", "labor_standards"],
        "nda": ["governing_law", "jurisdiction_clause"]
    }',
    '{
        "investment_agreement": ["guaranteed_returns", "risk_free_language"],
        "all": ["unconscionable_terms", "illegal_provisions"]
    }',
    '{
        "electronic_signatures_valid": true,
        "esign_act_compliant": true,
        "witness_requirements": false,
        "notarization_required": false
    }',
    '{
        "investment_agreements": ["sec_disclaimers", "risk_warnings", "accredited_investor_status"],
        "production_contracts": ["guild_requirements", "union_compliance", "labor_disclosures"]
    }',
    '{
        "wga_compliance": true,
        "sag_aftra_requirements": true,
        "dga_guidelines": true,
        "copyright_assignments": true,
        "moral_rights_waivers": true,
        "chain_of_title": true
    }',
    '{
        "securities_act_compliance": true,
        "accredited_investor_rules": true,
        "investment_adviser_act": true,
        "anti_money_laundering": true
    }'
),
(
    'UK',
    'United Kingdom',
    '["nda", "investment_agreement", "term_sheet", "production_contract", "talent_agreement", "distribution_agreement"]',
    '{
        "investment_agreement": ["fca_compliance", "risk_warnings", "cooling_off_period"],
        "production_contract": ["equity_diversity_requirements", "bfi_compliance"],
        "nda": ["gdpr_compliance", "data_protection_clauses"]
    }',
    '{
        "investment_agreement": ["guaranteed_returns", "misleading_projections"],
        "all": ["unfair_contract_terms", "penalty_clauses"]
    }',
    '{
        "electronic_signatures_valid": true,
        "eidas_compliant": true,
        "witness_requirements": false,
        "wet_signature_preference": true
    }',
    '{
        "investment_agreements": ["fca_warnings", "risk_disclosures", "cooling_off_rights"],
        "production_contracts": ["diversity_requirements", "bfi_guidelines"]
    }',
    '{
        "bfi_requirements": true,
        "bectu_compliance": true,
        "equity_guidelines": true,
        "copyright_designs_patents_act": true,
        "moral_rights_recognition": true,
        "tax_relief_compliance": true
    }',
    '{
        "fca_authorization": true,
        "mifid_compliance": true,
        "aml_regulations": true,
        "seis_eis_compliance": true
    }'
),
(
    'EU',
    'European Union',
    '["nda", "investment_agreement", "term_sheet", "production_contract", "talent_agreement", "distribution_agreement"]',
    '{
        "investment_agreement": ["mifid_compliance", "risk_categorization", "suitability_assessment"],
        "production_contract": ["gdpr_compliance", "worker_protection"],
        "nda": ["gdpr_compliance", "data_subject_rights"]
    }',
    '{
        "investment_agreement": ["guaranteed_returns", "inappropriate_advice"],
        "all": ["unfair_terms_directive_violations", "consumer_protection_violations"]
    }',
    '{
        "electronic_signatures_valid": true,
        "eidas_regulation_compliant": true,
        "qualified_signatures_preferred": true,
        "cross_border_recognition": true
    }',
    '{
        "investment_agreements": ["mifid_disclosures", "risk_classifications", "cost_disclosures"],
        "production_contracts": ["gdpr_notices", "worker_rights"]
    }',
    '{
        "creative_europe_compliance": true,
        "audiovisual_media_directive": true,
        "copyright_directive": true,
        "country_specific_quotas": true,
        "cultural_test_requirements": true
    }',
    '{
        "mifid_ii_compliance": true,
        "aml_4th_directive": true,
        "psd2_compliance": true,
        "gdpr_financial_data": true
    }'
);

-- Insert Legal Clauses Library
INSERT INTO legal_clauses (name, description, category, clause_text, variables, applicable_jurisdictions, applicable_document_types, risk_level, requires_legal_review) VALUES 

-- Confidentiality Clauses
(
    'Standard NDA Confidentiality',
    'Basic confidentiality obligation for entertainment projects',
    'confidentiality',
    'The Receiving Party agrees to hold in confidence all Confidential Information disclosed by the Disclosing Party, including but not limited to: (a) the Project titled "{{project_title}}"; (b) financial information, budgets, and projections; (c) creative materials, scripts, treatments, and concepts; (d) business strategies, marketing plans, and distribution strategies; and (e) any other proprietary information marked as confidential or that would reasonably be considered confidential in the entertainment industry.',
    '{"project_title": {"type": "string", "required": true, "description": "Title of the project or pitch"}}',
    '["US", "UK", "EU", "CA"]',
    '["nda", "collaboration_agreement", "production_contract"]',
    'medium',
    false
),

-- Investment Agreement Clauses  
(
    'SEC Risk Disclosure',
    'SEC-compliant risk disclosure for investment opportunities',
    'risk_disclosure',
    'INVESTMENT RISK DISCLOSURE: This investment involves significant risks and is suitable only for investors who can afford to lose their entire investment. The entertainment industry is highly speculative and unpredictable. There can be no assurance that the Project will be successfully completed, distributed, or generate any revenue. Past performance of similar projects is not indicative of future results. You should carefully review all materials and consult with your financial, tax, and legal advisors before making any investment decision.',
    '{}',
    '["US"]',
    '["investment_agreement", "term_sheet"]',
    'critical',
    true
),

(
    'Accredited Investor Verification',
    'Verification that investor meets SEC accredited investor requirements',
    'investor_verification',
    'ACCREDITED INVESTOR REPRESENTATION: The Investor hereby represents and warrants that they are an "accredited investor" as defined in Rule 501(a) of Regulation D under the Securities Act of 1933, as amended. The Investor has sufficient knowledge and experience in financial and business matters to evaluate the merits and risks of this investment and is able to bear the economic risk of this investment.',
    '{}',
    '["US"]',
    '["investment_agreement", "term_sheet"]',
    'high',
    true
),

-- Production Contract Clauses
(
    'WGA Credit Requirements',
    'Writers Guild of America credit and compensation requirements',
    'guild_compliance',
    'WRITERS GUILD COMPLIANCE: All writing services shall be performed in accordance with the Writers Guild of America ("WGA") Minimum Basic Agreement. Writer shall receive appropriate screen credit as determined by WGA credit arbitration procedures. All payments shall comply with WGA minimum compensation requirements for {{project_budget_tier}} budget productions.',
    '{"project_budget_tier": {"type": "string", "required": true, "enum": ["low", "medium", "high"], "description": "Budget tier: low (<$2M), medium ($2M-$30M), high (>$30M)"}}',
    '["US"]',
    '["production_contract", "talent_agreement"]',
    'high',
    true
),

(
    'Chain of Title Warranty',
    'Warranty regarding ownership and chain of title for intellectual property',
    'intellectual_property',
    'CHAIN OF TITLE WARRANTY: {{warrantor_name}} hereby warrants and represents that: (a) they own or control all rights in and to the Property necessary to grant the rights herein; (b) the Property does not infringe upon any copyright, trademark, or other proprietary rights of any third party; (c) all necessary rights, consents, and permissions have been obtained from all writers, directors, and other contributors; and (d) complete chain of title documentation will be provided, including but not limited to copyright assignments, work-for-hire agreements, and all underlying rights agreements.',
    '{"warrantor_name": {"type": "string", "required": true, "description": "Name of party providing the warranty"}}',
    '["US", "UK", "EU", "CA"]',
    '["production_contract", "rights_agreement", "licensing_agreement"]',
    'critical',
    true
),

-- Termination Clauses
(
    'Project Development Termination',
    'Standard termination provisions for development agreements',
    'termination',
    'TERMINATION: Either party may terminate this Agreement upon {{notice_period}} days written notice if: (a) the other party materially breaches this Agreement and fails to cure such breach within {{cure_period}} days after written notice; (b) the other party becomes insolvent or files for bankruptcy; or (c) the Project has not entered principal photography within {{development_period}} months from the effective date. Upon termination, all rights shall revert to {{rights_holder}}, subject to any outstanding payment obligations.',
    '{
        "notice_period": {"type": "number", "required": true, "default": 30, "description": "Days of notice required for termination"},
        "cure_period": {"type": "number", "required": true, "default": 30, "description": "Days to cure a breach"},
        "development_period": {"type": "number", "required": true, "default": 24, "description": "Maximum development period in months"},
        "rights_holder": {"type": "string", "required": true, "description": "Party who retains rights upon termination"}
    }',
    '["US", "UK", "EU", "CA"]',
    '["production_contract", "collaboration_agreement", "rights_agreement"]',
    'medium',
    false
),

-- Financial Terms
(
    'Revenue Sharing Waterfall',
    'Standard entertainment industry revenue sharing waterfall',
    'financial',
    'REVENUE SHARING: Net receipts from all sources shall be distributed in the following order of priority: (1) Recoupment of all production costs and approved marketing expenses; (2) Payment of distribution fees at {{distribution_fee_percentage}}%; (3) Recoupment of investor contributions plus {{investor_premium}}% premium; (4) Creator participation of {{creator_percentage}}% of remaining net receipts; (5) Investor additional participation of {{investor_backend_percentage}}% of remaining net receipts; (6) All remaining proceeds to be distributed pro rata among all parties based on their respective participation percentages.',
    '{
        "distribution_fee_percentage": {"type": "number", "required": true, "default": 15, "min": 10, "max": 30},
        "investor_premium": {"type": "number", "required": true, "default": 20, "min": 0, "max": 50},
        "creator_percentage": {"type": "number", "required": true, "default": 50, "min": 25, "max": 75},
        "investor_backend_percentage": {"type": "number", "required": true, "default": 25, "min": 0, "max": 50}
    }',
    '["US", "UK", "EU", "CA"]',
    '["investment_agreement", "production_contract", "distribution_agreement"]',
    'high',
    true
),

-- Liability Limitations
(
    'Entertainment Industry Liability Cap',
    'Standard liability limitation for entertainment projects',
    'liability',
    'LIMITATION OF LIABILITY: Except for breaches of confidentiality, intellectual property infringement, or willful misconduct, the total liability of any party under this Agreement shall not exceed {{liability_cap_amount}}. IN NO EVENT SHALL ANY PARTY BE LIABLE FOR INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF PROFITS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.',
    '{"liability_cap_amount": {"type": "string", "required": true, "description": "Maximum liability amount (e.g., $100,000 or the total investment amount)"}}',
    '["US", "UK", "EU", "CA"]',
    '["investment_agreement", "production_contract", "collaboration_agreement"]',
    'medium',
    false
);

-- Insert Document Templates
INSERT INTO document_templates (name, description, category, template_content, variables, conditional_clauses, jurisdictions, compliance_requirements) VALUES 

-- Enhanced NDA Template
(
    'Entertainment Industry NDA',
    'Comprehensive Non-Disclosure Agreement for film and television projects with multi-party support',
    'nda',
    '{
        "title": "MUTUAL NON-DISCLOSURE AGREEMENT",
        "preamble": "This Mutual Non-Disclosure Agreement (\"Agreement\") is entered into on {{effective_date}} by and between {{party_names_formatted}} (collectively, the \"Parties\") regarding the confidential exchange of information related to the entertainment project tentatively titled \"{{project_title}}\" (the \"Project\").",
        "sections": [
            {
                "title": "1. DEFINITION OF CONFIDENTIAL INFORMATION", 
                "content": "{{confidentiality_clause}}"
            },
            {
                "title": "2. OBLIGATIONS OF RECEIVING PARTY",
                "content": "Each Party agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third parties without prior written consent; (c) use Confidential Information solely for evaluation purposes; (d) protect Confidential Information with the same degree of care used for their own confidential information, but in no case less than reasonable care."
            },
            {
                "title": "3. EXCEPTIONS",
                "content": "The obligations herein shall not apply to information that: (a) is or becomes publicly available through no breach of this Agreement; (b) was known to the receiving party prior to disclosure; (c) is independently developed without use of Confidential Information; (d) is required to be disclosed by law or court order, provided the disclosing party is given prompt notice."
            },
            {
                "title": "4. TERM AND TERMINATION",
                "content": "This Agreement shall remain in effect for {{nda_term}} years from the effective date, unless terminated earlier by mutual consent. The confidentiality obligations shall survive termination for an additional {{survival_period}} years."
            },
            {
                "title": "5. REMEDIES",
                "content": "The Parties acknowledge that any breach of this Agreement may cause irreparable harm and that monetary damages may be inadequate. Therefore, the non-breaching party shall be entitled to seek equitable relief, including injunction and specific performance, in addition to any other remedies available at law or equity."
            },
            {
                "title": "6. GOVERNING LAW AND JURISDICTION",
                "content": "This Agreement shall be governed by the laws of {{governing_jurisdiction}} without regard to conflict of law principles. Any disputes shall be subject to the exclusive jurisdiction of the courts in {{jurisdiction_location}}."
            }
        ],
        "signature_blocks": "{{signature_blocks}}"
    }',
    '{
        "effective_date": {"type": "date", "required": true, "description": "Effective date of the agreement"},
        "party_names_formatted": {"type": "string", "required": true, "description": "Formatted list of all parties"},
        "project_title": {"type": "string", "required": true, "description": "Title or working title of the project"},
        "nda_term": {"type": "number", "required": true, "default": 5, "min": 1, "max": 10, "description": "Term of NDA in years"},
        "survival_period": {"type": "number", "required": true, "default": 3, "min": 1, "max": 7, "description": "Survival period after termination in years"},
        "governing_jurisdiction": {"type": "string", "required": true, "enum": ["California", "New York", "England and Wales", "Ontario"], "description": "Governing law jurisdiction"},
        "jurisdiction_location": {"type": "string", "required": true, "description": "Physical jurisdiction for disputes"}
    }',
    '{
        "multi_party": {
            "condition": "party_count > 2",
            "modifications": {
                "preamble": "Multi-party language",
                "signature_blocks": "Multiple signature blocks"
            }
        },
        "international_parties": {
            "condition": "has_international_parties",
            "additional_clauses": ["currency_clause", "translation_clause"]
        }
    }',
    '["US", "UK", "EU", "CA"]',
    '{
        "US": {"required_clauses": ["governing_law", "jurisdiction_clause"]},
        "UK": {"required_clauses": ["gdpr_compliance", "data_protection_clauses"]},
        "EU": {"required_clauses": ["gdpr_compliance", "data_subject_rights"]}
    }'
),

-- Investment Agreement Template
(
    'Film Investment Agreement',
    'Comprehensive investment agreement for film and television projects with SEC compliance',
    'investment_agreement',
    '{
        "title": "INVESTMENT AGREEMENT",
        "preamble": "This Investment Agreement (\"Agreement\") is made on {{effective_date}} between {{company_name}}, a {{company_jurisdiction}} corporation (\"Company\"), and {{investor_name}} (\"Investor\") regarding an investment in the motion picture project tentatively titled \"{{project_title}}\" (the \"Picture\").",
        "sections": [
            {
                "title": "1. INVESTMENT TERMS",
                "content": "Investor agrees to invest {{investment_amount}} in exchange for {{equity_percentage}}% of the net receipts and {{equity_percentage}}% of any profits from the Picture. The investment shall be paid in {{payment_schedule}}."
            },
            {
                "title": "2. USE OF FUNDS",
                "content": "Investment funds shall be used exclusively for: (a) production costs of the Picture; (b) approved marketing and distribution expenses; (c) completion bond premiums; and (d) other costs directly related to the Picture as detailed in the attached budget."
            },
            {
                "title": "3. REPRESENTATIONS AND WARRANTIES",
                "content": "{{accredited_investor_clause}} Company represents that it has all necessary rights to produce the Picture and that the script and underlying materials do not infringe any third-party rights."
            },
            {
                "title": "4. RISK DISCLOSURES",
                "content": "{{sec_risk_disclosure}}"
            },
            {
                "title": "5. REVENUE SHARING",
                "content": "{{revenue_sharing_waterfall}}"
            },
            {
                "title": "6. REPORTING AND ACCOUNTING",
                "content": "Company shall provide quarterly financial reports and annual audited statements. Investor shall have the right to audit the books and records upon reasonable notice."
            },
            {
                "title": "7. COMPLETION AND DELIVERY",
                "content": "Company shall use commercially reasonable efforts to complete production by {{completion_date}}. If production is not completed within {{extension_period}} months thereafter, Investor may terminate this Agreement and seek return of invested funds."
            }
        ]
    }',
    '{
        "effective_date": {"type": "date", "required": true},
        "company_name": {"type": "string", "required": true},
        "company_jurisdiction": {"type": "string", "required": true},
        "investor_name": {"type": "string", "required": true},
        "project_title": {"type": "string", "required": true},
        "investment_amount": {"type": "currency", "required": true},
        "equity_percentage": {"type": "number", "required": true, "min": 1, "max": 100},
        "payment_schedule": {"type": "string", "required": true, "enum": ["upon_execution", "in_installments", "upon_milestones"]},
        "completion_date": {"type": "date", "required": true},
        "extension_period": {"type": "number", "required": true, "default": 6}
    }',
    '{
        "accredited_investor_required": {
            "condition": "investment_amount >= 50000",
            "required_clauses": ["accredited_investor_verification"]
        },
        "sec_compliance": {
            "condition": "jurisdiction == US",
            "required_clauses": ["sec_risk_disclosure"]
        }
    }',
    '["US", "UK", "CA"]',
    '{
        "US": {"required_clauses": ["sec_risk_disclosure", "accredited_investor_verification"]},
        "UK": {"required_clauses": ["fca_compliance", "risk_warnings"]},
        "CA": {"required_clauses": ["osc_compliance", "risk_disclosures"]}
    }'
),

-- Production Contract Template
(
    'Production Services Agreement',
    'Comprehensive production services agreement with guild compliance and rights management',
    'production_contract',
    '{
        "title": "PRODUCTION SERVICES AGREEMENT",
        "preamble": "This Production Services Agreement (\"Agreement\") is entered into on {{effective_date}} between {{production_company_name}} (\"Producer\") and {{service_provider_name}} (\"Service Provider\") for services related to the {{project_type}} tentatively titled \"{{project_title}}\" (the \"Project\").",
        "sections": [
            {
                "title": "1. SERVICES AND DELIVERABLES",
                "content": "Service Provider shall provide {{services_description}} in accordance with the attached Statement of Work. All services shall be performed in a professional manner consistent with industry standards."
            },
            {
                "title": "2. COMPENSATION",
                "content": "Producer shall pay Service Provider {{compensation_amount}} payable according to the following schedule: {{payment_schedule}}. All payments are subject to standard payroll deductions and applicable guild requirements."
            },
            {
                "title": "3. GUILD COMPLIANCE",
                "content": "{{wga_compliance_clause}} All services shall comply with applicable guild agreements and industry standards."
            },
            {
                "title": "4. INTELLECTUAL PROPERTY AND CHAIN OF TITLE",
                "content": "{{chain_of_title_warranty}} All work created shall be deemed work-for-hire owned by Producer, subject to applicable guild requirements for credit and residuals."
            },
            {
                "title": "5. CONFIDENTIALITY",
                "content": "Service Provider acknowledges that they may have access to confidential information and agrees to maintain strict confidentiality regarding all aspects of the Project."
            },
            {
                "title": "6. TERMINATION",
                "content": "{{project_development_termination}}"
            }
        ]
    }',
    '{
        "effective_date": {"type": "date", "required": true},
        "production_company_name": {"type": "string", "required": true},
        "service_provider_name": {"type": "string", "required": true},
        "project_type": {"type": "string", "required": true, "enum": ["feature_film", "television_series", "documentary", "short_film", "web_series"]},
        "project_title": {"type": "string", "required": true},
        "services_description": {"type": "text", "required": true},
        "compensation_amount": {"type": "currency", "required": true},
        "payment_schedule": {"type": "string", "required": true}
    }',
    '{
        "guild_services": {
            "condition": "service_type in [writing, directing, producing]",
            "required_clauses": ["wga_compliance", "dga_compliance", "pga_compliance"]
        },
        "high_budget": {
            "condition": "project_budget >= 2000000",
            "required_clauses": ["completion_bond_clause", "insurance_requirements"]
        }
    }',
    '["US", "UK", "CA"]',
    '{
        "US": {"required_clauses": ["guild_compliance", "chain_of_title_warranty"]},
        "UK": {"required_clauses": ["equity_diversity_requirements", "bfi_compliance"]},
        "CA": {"required_clauses": ["telefilm_compliance", "crtc_requirements"]}
    }'
);

-- Link templates with appropriate clauses
INSERT INTO template_clauses (template_id, clause_id, is_required, is_conditional, order_index) 
SELECT 
    t.id as template_id,
    c.id as clause_id,
    CASE 
        WHEN c.category IN ('confidentiality') AND t.category = 'nda' THEN true
        WHEN c.category IN ('risk_disclosure', 'investor_verification') AND t.category = 'investment_agreement' THEN true
        WHEN c.category IN ('guild_compliance', 'intellectual_property') AND t.category = 'production_contract' THEN true
        ELSE false
    END as is_required,
    CASE
        WHEN c.category IN ('financial', 'termination', 'liability') THEN true
        ELSE false
    END as is_conditional,
    ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY c.category) as order_index
FROM document_templates t
CROSS JOIN legal_clauses c
WHERE 
    (t.category = 'nda' AND c.category IN ('confidentiality', 'termination', 'liability')) OR
    (t.category = 'investment_agreement' AND c.category IN ('risk_disclosure', 'investor_verification', 'financial', 'liability')) OR
    (t.category = 'production_contract' AND c.category IN ('guild_compliance', 'intellectual_property', 'termination', 'financial'));