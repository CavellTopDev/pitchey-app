import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib@1.17.1";
import { format } from "https://deno.land/std@0.208.0/datetime/mod.ts";

/**
 * Contract Management Service
 * Handles contract creation, templates, versioning, and signature tracking
 */

export interface ContractTemplate {
  id: string;
  name: string;
  type: 'nda' | 'investment' | 'production' | 'distribution' | 'licensing';
  content: string;
  variables: string[];
  clauses: ContractClause[];
  version: string;
  isActive: boolean;
}

export interface ContractClause {
  id: string;
  title: string;
  content: string;
  isRequired: boolean;
  order: number;
}

export interface Contract {
  id: string;
  templateId: string;
  pitchId?: string;
  investmentId?: string;
  parties: ContractParty[];
  status: 'draft' | 'pending_signature' | 'signed' | 'expired' | 'terminated';
  effectiveDate: Date;
  expiryDate?: Date;
  metadata: Record<string, any>;
}

export interface ContractParty {
  id: string;
  userId: string;
  role: 'creator' | 'investor' | 'production' | 'platform';
  signatureRequired: boolean;
  signedAt?: Date;
  ipAddress?: string;
}

export class ContractService {
  private db: Client;

  constructor(databaseUrl: string) {
    const url = new URL(databaseUrl);
    this.db = new Client({
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      hostname: url.hostname,
      port: parseInt(url.port || "5432"),
      tls: {
        enabled: url.searchParams.get("sslmode") === "require",
      },
    });
  }

  async connect() {
    await this.db.connect();
  }

  async disconnect() {
    await this.db.end();
  }

  /**
   * Create a new contract from template
   */
  async createContract(
    templateId: string,
    parties: Omit<ContractParty, 'id'>[],
    variables: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Contract> {
    try {
      const contractId = crypto.randomUUID();
      
      // Get template
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error("Template not found");
      }

      // Generate contract content from template
      const content = await this.generateContractContent(template, variables);

      // Create contract record
      await this.db.queryObject(`
        INSERT INTO contracts (
          id, template_id, content, status, metadata, created_at
        )
        VALUES ($1::uuid, $2::uuid, $3, 'draft', $4::jsonb, NOW())
      `, [contractId, templateId, content, JSON.stringify(metadata || {})]);

      // Add parties
      for (const party of parties) {
        await this.db.queryObject(`
          INSERT INTO contract_parties (
            id, contract_id, user_id, role, signature_required
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5)
        `, [
          crypto.randomUUID(),
          contractId,
          party.userId,
          party.role,
          party.signatureRequired
        ]);
      }

      // Create initial version
      await this.createVersion(contractId, content, 'Initial version');

      // Log to audit
      await this.db.queryObject(`
        INSERT INTO audit_log (
          user_id, action, resource_type, resource_id, metadata
        )
        VALUES ($1::uuid, 'contract_created', 'contract', $2::uuid, $3::jsonb)
      `, [
        parties[0]?.userId,
        contractId,
        JSON.stringify({ template: templateId, parties: parties.length })
      ]);

      return {
        id: contractId,
        templateId,
        parties: parties.map(p => ({ ...p, id: crypto.randomUUID() })),
        status: 'draft',
        effectiveDate: new Date(),
        metadata: metadata || {}
      };
    } catch (error) {
      console.error("Error creating contract:", error);
      throw error;
    }
  }

  /**
   * Generate contract content from template
   */
  private async generateContractContent(
    template: ContractTemplate,
    variables: Record<string, any>
  ): Promise<string> {
    let content = template.content;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }

    // Add clauses
    const clauses = await this.db.queryObject<ContractClause>(`
      SELECT * FROM contract_clauses 
      WHERE template_id = $1::uuid
      ORDER BY "order"
    `, [template.id]);

    for (const clause of clauses.rows) {
      content += `\n\n## ${clause.title}\n\n${clause.content}`;
    }

    // Add signature blocks
    content += '\n\n---\n\n## SIGNATURES\n\n';
    content += 'By signing below, all parties agree to the terms and conditions set forth in this agreement.\n\n';

    return content;
  }

  /**
   * Send contract for signatures
   */
  async sendForSignature(contractId: string, message?: string): Promise<void> {
    try {
      // Update contract status
      await this.db.queryObject(`
        UPDATE contracts 
        SET status = 'pending_signature',
            sent_for_signature_at = NOW()
        WHERE id = $1::uuid
      `, [contractId]);

      // Get all parties requiring signature
      const parties = await this.db.queryObject<{
        user_id: string;
        email: string;
        name: string;
      }>(`
        SELECT cp.user_id, u.email, u.name
        FROM contract_parties cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.contract_id = $1::uuid
          AND cp.signature_required = true
          AND cp.signed_at IS NULL
      `, [contractId]);

      // Send signature requests
      for (const party of parties.rows) {
        await this.createSignatureRequest(contractId, party.user_id, party.email);
        
        // Create notification
        await this.db.queryObject(`
          INSERT INTO notifications (
            id, user_id, type, title, message, metadata
          )
          VALUES ($1::uuid, $2::uuid, 'signature_request', $3, $4, $5::jsonb)
        `, [
          crypto.randomUUID(),
          party.user_id,
          'Signature Required',
          message || 'You have a new contract to sign',
          JSON.stringify({ contract_id: contractId })
        ]);
      }
    } catch (error) {
      console.error("Error sending for signature:", error);
      throw error;
    }
  }

  /**
   * Sign a contract
   */
  async signContract(
    contractId: string,
    userId: string,
    signature: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      // Verify user is a party to the contract
      const party = await this.db.queryObject<{ id: string }>(`
        SELECT id FROM contract_parties
        WHERE contract_id = $1::uuid
          AND user_id = $2::uuid
          AND signature_required = true
      `, [contractId, userId]);

      if (!party.rows[0]) {
        throw new Error("User is not authorized to sign this contract");
      }

      // Record signature
      await this.db.queryObject(`
        INSERT INTO contract_signatures (
          id, contract_id, user_id, signature_data, ip_address, signed_at
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, NOW())
      `, [
        crypto.randomUUID(),
        contractId,
        userId,
        signature,
        ipAddress
      ]);

      // Update party record
      await this.db.queryObject(`
        UPDATE contract_parties
        SET signed_at = NOW(),
            ip_address = $1
        WHERE contract_id = $2::uuid
          AND user_id = $3::uuid
      `, [ipAddress, contractId, userId]);

      // Check if all required signatures are collected
      const unsigned = await this.db.queryObject<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM contract_parties
        WHERE contract_id = $1::uuid
          AND signature_required = true
          AND signed_at IS NULL
      `, [contractId]);

      if (unsigned.rows[0]?.count === 0) {
        // All signatures collected - activate contract
        await this.activateContract(contractId);
      }

      // Log to audit
      await this.db.queryObject(`
        INSERT INTO audit_log (
          user_id, action, resource_type, resource_id, metadata
        )
        VALUES ($1::uuid, 'contract_signed', 'contract', $2::uuid, $3::jsonb)
      `, [
        userId,
        contractId,
        JSON.stringify({ ip_address: ipAddress })
      ]);
    } catch (error) {
      console.error("Error signing contract:", error);
      throw error;
    }
  }

  /**
   * Activate a fully signed contract
   */
  private async activateContract(contractId: string): Promise<void> {
    await this.db.queryObject(`
      UPDATE contracts
      SET status = 'signed',
          effective_date = NOW()
      WHERE id = $1::uuid
    `, [contractId]);

    // Notify all parties
    const parties = await this.db.queryObject<{ user_id: string }>(`
      SELECT user_id FROM contract_parties
      WHERE contract_id = $1::uuid
    `, [contractId]);

    for (const party of parties.rows) {
      await this.db.queryObject(`
        INSERT INTO notifications (
          id, user_id, type, title, message, metadata
        )
        VALUES ($1::uuid, $2::uuid, 'contract_signed', $3, $4, $5::jsonb)
      `, [
        crypto.randomUUID(),
        party.user_id,
        'Contract Fully Executed',
        'All parties have signed the contract',
        JSON.stringify({ contract_id: contractId })
      ]);
    }
  }

  /**
   * Create a contract version (for amendments)
   */
  async createVersion(contractId: string, content: string, changeNote: string): Promise<void> {
    try {
      const versionNumber = await this.getNextVersionNumber(contractId);
      
      await this.db.queryObject(`
        INSERT INTO contract_versions (
          id, contract_id, version_number, content, change_note, created_at
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, NOW())
      `, [
        crypto.randomUUID(),
        contractId,
        versionNumber,
        content,
        changeNote
      ]);
    } catch (error) {
      console.error("Error creating contract version:", error);
      throw error;
    }
  }

  /**
   * Get next version number for contract
   */
  private async getNextVersionNumber(contractId: string): Promise<string> {
    const result = await this.db.queryObject<{ max_version: string }>(`
      SELECT MAX(version_number) as max_version
      FROM contract_versions
      WHERE contract_id = $1::uuid
    `, [contractId]);

    const currentVersion = result.rows[0]?.max_version || '0.0';
    const [major, minor] = currentVersion.split('.').map(Number);
    return `${major}.${minor + 1}`;
  }

  /**
   * Generate PDF of contract
   */
  async generatePDF(contractId: string): Promise<Uint8Array> {
    try {
      // Get contract details
      const contract = await this.db.queryObject<{
        content: string;
        created_at: Date;
      }>(`
        SELECT content, created_at
        FROM contracts
        WHERE id = $1::uuid
      `, [contractId]);

      if (!contract.rows[0]) {
        throw new Error("Contract not found");
      }

      // Get signatures
      const signatures = await this.db.queryObject<{
        name: string;
        signed_at: Date;
      }>(`
        SELECT u.name, cp.signed_at
        FROM contract_parties cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.contract_id = $1::uuid
          AND cp.signed_at IS NOT NULL
        ORDER BY cp.signed_at
      `, [contractId]);

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 12;

      // Add content
      page.drawText('CONTRACT AGREEMENT', {
        x: 50,
        y: height - 50,
        size: 18,
      });

      page.drawText(`Date: ${format(contract.rows[0].created_at, "yyyy-MM-dd")}`, {
        x: 50,
        y: height - 80,
        size: fontSize,
      });

      // Add contract content (simplified - would need proper text wrapping)
      const lines = contract.rows[0].content.split('\n');
      let yPosition = height - 120;
      
      for (const line of lines) {
        if (yPosition < 50) {
          // Add new page if needed
          const newPage = pdfDoc.addPage();
          yPosition = newPage.getHeight() - 50;
        }
        
        page.drawText(line.substring(0, 80), {
          x: 50,
          y: yPosition,
          size: fontSize,
        });
        yPosition -= 20;
      }

      // Add signatures
      if (signatures.rows.length > 0) {
        yPosition -= 40;
        page.drawText('SIGNATURES:', {
          x: 50,
          y: yPosition,
          size: 14,
        });
        yPosition -= 30;

        for (const sig of signatures.rows) {
          page.drawText(`${sig.name} - Signed on ${format(sig.signed_at, "yyyy-MM-dd HH:mm")}`, {
            x: 50,
            y: yPosition,
            size: fontSize,
          });
          yPosition -= 25;
        }
      }

      // Serialize PDF
      const pdfBytes = await pdfDoc.save();
      return pdfBytes;
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  private async getTemplate(templateId: string): Promise<ContractTemplate | null> {
    const result = await this.db.queryObject<ContractTemplate>(`
      SELECT * FROM contract_templates
      WHERE id = $1::uuid AND is_active = true
    `, [templateId]);
    
    return result.rows[0] || null;
  }

  /**
   * Create signature request
   */
  private async createSignatureRequest(
    contractId: string,
    userId: string,
    email: string
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    const token = crypto.randomUUID();

    await this.db.queryObject(`
      INSERT INTO signature_requests (
        id, contract_id, user_id, token, expires_at, created_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NOW() + INTERVAL '7 days', NOW())
    `, [requestId, contractId, userId, token]);

    // In production, this would send an email with the signature link
    console.log(`Signature request created for ${email}: ${token}`);
  }

  /**
   * Check contract expiry
   */
  async checkExpiredContracts(): Promise<void> {
    try {
      // Find and update expired contracts
      const expired = await this.db.queryObject<{ id: string }>(`
        UPDATE contracts
        SET status = 'expired'
        WHERE status = 'signed'
          AND expiry_date < NOW()
          AND status != 'expired'
        RETURNING id
      `);

      // Notify parties of expired contracts
      for (const contract of expired.rows) {
        const parties = await this.db.queryObject<{ user_id: string }>(`
          SELECT user_id FROM contract_parties
          WHERE contract_id = $1::uuid
        `, [contract.id]);

        for (const party of parties.rows) {
          await this.db.queryObject(`
            INSERT INTO notifications (
              id, user_id, type, title, message, metadata
            )
            VALUES ($1::uuid, $2::uuid, 'contract_expired', $3, $4, $5::jsonb)
          `, [
            crypto.randomUUID(),
            party.user_id,
            'Contract Expired',
            'A contract you are party to has expired',
            JSON.stringify({ contract_id: contract.id })
          ]);
        }
      }
    } catch (error) {
      console.error("Error checking expired contracts:", error);
    }
  }

  /**
   * Get contracts for user
   */
  async getUserContracts(userId: string, status?: string): Promise<any[]> {
    try {
      const query = status
        ? `SELECT c.*, cp.role, cp.signed_at
           FROM contracts c
           JOIN contract_parties cp ON c.id = cp.contract_id
           WHERE cp.user_id = $1::uuid AND c.status = $2
           ORDER BY c.created_at DESC`
        : `SELECT c.*, cp.role, cp.signed_at
           FROM contracts c
           JOIN contract_parties cp ON c.id = cp.contract_id
           WHERE cp.user_id = $1::uuid
           ORDER BY c.created_at DESC`;

      const params = status ? [userId, status] : [userId];
      const result = await this.db.queryObject(query, params);
      
      return result.rows;
    } catch (error) {
      console.error("Error getting user contracts:", error);
      throw error;
    }
  }
}