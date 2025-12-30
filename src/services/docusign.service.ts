import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * DocuSign Integration Service
 * Handles advanced e-signature workflows with DocuSign API
 */

interface EnvelopeData {
  contractId: string;
  templateId: string;
  recipients: Recipient[];
  documents: Document[];
  customFields?: CustomField[];
}

interface Recipient {
  userId: string;
  email: string;
  name: string;
  role: string;
  routingOrder: number;
  tabs?: {
    signHere?: SignatureTab[];
    initialHere?: InitialTab[];
    dateSigned?: DateTab[];
    textTabs?: TextTab[];
  };
}

interface Document {
  documentId: string;
  name: string;
  fileExtension: string;
  documentBase64: string;
}

interface SignatureTab {
  anchorString: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  anchorUnits?: 'pixels' | 'inches';
}

interface InitialTab {
  anchorString: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
}

interface DateTab {
  anchorString: string;
  value?: string;
}

interface TextTab {
  anchorString: string;
  value: string;
  locked?: boolean;
}

interface CustomField {
  name: string;
  value: string;
  required: boolean;
}

export class DocuSignService {
  private db: Client;
  private baseUrl: string;
  private accountId: string;
  private integrationKey: string;
  private userId: string;
  private rsaPrivateKey: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(databaseUrl: string) {
    // Initialize database connection
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

    // DocuSign configuration from environment
    this.baseUrl = Deno.env.get("DOCUSIGN_BASE_URL") || "https://demo.docusign.net/restapi";
    this.accountId = Deno.env.get("DOCUSIGN_ACCOUNT_ID") || "";
    this.integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY") || "";
    this.userId = Deno.env.get("DOCUSIGN_USER_ID") || "";
    this.rsaPrivateKey = Deno.env.get("DOCUSIGN_RSA_PRIVATE_KEY") || "";
  }

  async connect() {
    await this.db.connect();
  }

  async disconnect() {
    await this.db.end();
  }

  /**
   * Get JWT access token for DocuSign API
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      // Create JWT assertion
      const header = {
        alg: "RS256",
        typ: "JWT",
      };

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: this.integrationKey,
        sub: this.userId,
        aud: "account-d.docusign.com",
        iat: now,
        exp: now + 3600, // 1 hour expiry
        scope: "signature impersonation",
      };

      // In production, use proper JWT library
      const jwt = await this.createJWT(header, payload);

      // Exchange JWT for access token
      const response = await fetch("https://account-d.docusign.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        throw new Error(`DocuSign auth failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

      return this.accessToken!;
    } catch (error) {
      console.error("Error getting DocuSign access token:", error);
      throw error;
    }
  }

  /**
   * Create JWT token (simplified - use proper library in production)
   */
  private async createJWT(header: any, payload: any): Promise<string> {
    // This is a placeholder - in production, use a proper JWT library
    // with RSA signature support
    const headerBase64 = btoa(JSON.stringify(header));
    const payloadBase64 = btoa(JSON.stringify(payload));
    const signature = "placeholder_signature"; // Would be RSA signature
    
    return `${headerBase64}.${payloadBase64}.${signature}`;
  }

  /**
   * Create and send envelope for signature
   */
  async createEnvelope(data: EnvelopeData): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();

      // Prepare envelope definition
      const envelopeDefinition = {
        emailSubject: "Please sign this contract",
        status: "sent", // Send immediately
        documents: data.documents,
        recipients: {
          signers: data.recipients.map(r => ({
            email: r.email,
            name: r.name,
            recipientId: r.userId,
            routingOrder: r.routingOrder,
            tabs: r.tabs,
            clientUserId: r.userId, // For embedded signing
          })),
        },
        customFields: {
          textCustomFields: data.customFields?.map(f => ({
            name: f.name,
            value: f.value,
            required: f.required.toString(),
          })),
        },
      };

      // Create envelope
      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ envelopeDefinition }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create envelope: ${response.statusText}`);
      }

      const result = await response.json();
      const envelopeId = result.envelopeId;

      // Store envelope mapping
      await this.db.queryObject(`
        INSERT INTO docusign_envelopes (
          id, contract_id, envelope_id, status, created_at
        )
        VALUES ($1::uuid, $2::uuid, $3, 'sent', NOW())
      `, [crypto.randomUUID(), data.contractId, envelopeId]);

      // Log to audit
      await this.db.queryObject(`
        INSERT INTO audit_log (
          user_id, action, resource_type, resource_id, metadata
        )
        VALUES ($1::uuid, 'docusign_envelope_created', 'envelope', $2::uuid, $3::jsonb)
      `, [
        data.recipients[0]?.userId,
        envelopeId,
        JSON.stringify({ contract_id: data.contractId, recipients: data.recipients.length })
      ]);

      return envelopeId;
    } catch (error) {
      console.error("Error creating DocuSign envelope:", error);
      throw error;
    }
  }

  /**
   * Get embedded signing URL
   */
  async getSigningUrl(
    envelopeId: string,
    userId: string,
    returnUrl: string
  ): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();

      // Get user details
      const user = await this.db.queryObject<{ email: string; name: string }>(`
        SELECT email, name FROM users WHERE id = $1::uuid
      `, [userId]);

      if (!user.rows[0]) {
        throw new Error("User not found");
      }

      // Create recipient view (embedded signing)
      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/views/recipient`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            authenticationMethod: "password",
            clientUserId: userId,
            email: user.rows[0].email,
            userName: user.rows[0].name,
            returnUrl: returnUrl,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create signing URL: ${response.statusText}`);
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error("Error getting signing URL:", error);
      throw error;
    }
  }

  /**
   * Check envelope status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get envelope status: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update status in database
      await this.db.queryObject(`
        UPDATE docusign_envelopes
        SET status = $1, updated_at = NOW()
        WHERE envelope_id = $2
      `, [result.status, envelopeId]);

      return result.status;
    } catch (error) {
      console.error("Error getting envelope status:", error);
      throw error;
    }
  }

  /**
   * Download signed documents
   */
  async downloadDocuments(envelopeId: string): Promise<Uint8Array> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download documents: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      console.error("Error downloading documents:", error);
      throw error;
    }
  }

  /**
   * Process webhook event from DocuSign
   */
  async processWebhook(event: any): Promise<void> {
    try {
      const { envelopeId, status, recipientEvents } = event;

      // Update envelope status
      await this.db.queryObject(`
        UPDATE docusign_envelopes
        SET status = $1, updated_at = NOW()
        WHERE envelope_id = $2
      `, [status, envelopeId]);

      // Get contract ID
      const envelope = await this.db.queryObject<{ contract_id: string }>(`
        SELECT contract_id FROM docusign_envelopes
        WHERE envelope_id = $1
      `, [envelopeId]);

      if (!envelope.rows[0]) {
        console.error("Envelope not found:", envelopeId);
        return;
      }

      const contractId = envelope.rows[0].contract_id;

      // Process recipient events
      if (recipientEvents && Array.isArray(recipientEvents)) {
        for (const recipientEvent of recipientEvents) {
          if (recipientEvent.status === "completed") {
            // Record signature
            await this.db.queryObject(`
              INSERT INTO contract_signatures (
                id, contract_id, user_id, 
                signature_data, signature_provider, signed_at
              )
              VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'docusign', NOW())
            `, [
              crypto.randomUUID(),
              contractId,
              recipientEvent.clientUserId,
              JSON.stringify({
                envelope_id: envelopeId,
                recipient_id: recipientEvent.recipientId,
              })
            ]);

            // Update contract party
            await this.db.queryObject(`
              UPDATE contract_parties
              SET signed_at = NOW(),
                  docusign_status = 'completed'
              WHERE contract_id = $1::uuid
                AND user_id = $2::uuid
            `, [contractId, recipientEvent.clientUserId]);
          }
        }
      }

      // Check if all signatures are complete
      if (status === "completed") {
        await this.markContractComplete(contractId, envelopeId);
      }
    } catch (error) {
      console.error("Error processing DocuSign webhook:", error);
      throw error;
    }
  }

  /**
   * Mark contract as complete and download signed copy
   */
  private async markContractComplete(contractId: string, envelopeId: string): Promise<void> {
    try {
      // Download signed documents
      const signedPdf = await this.downloadDocuments(envelopeId);

      // Store signed document
      const documentId = crypto.randomUUID();
      await this.db.queryObject(`
        INSERT INTO contract_documents (
          id, contract_id, type, file_name, file_data, created_at
        )
        VALUES ($1::uuid, $2::uuid, 'signed', $3, $4, NOW())
      `, [
        documentId,
        contractId,
        `contract-${contractId}-signed.pdf`,
        signedPdf
      ]);

      // Update contract status
      await this.db.queryObject(`
        UPDATE contracts
        SET status = 'signed',
            signed_document_id = $1::uuid,
            effective_date = NOW()
        WHERE id = $2::uuid
      `, [documentId, contractId]);

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
          VALUES ($1::uuid, $2::uuid, 'contract_completed', $3, $4, $5::jsonb)
        `, [
          crypto.randomUUID(),
          party.user_id,
          'Contract Fully Executed',
          'All parties have signed the contract via DocuSign',
          JSON.stringify({ 
            contract_id: contractId, 
            document_id: documentId,
            envelope_id: envelopeId 
          })
        ]);
      }

      // Log completion
      await this.db.queryObject(`
        INSERT INTO audit_log (
          user_id, action, resource_type, resource_id, metadata
        )
        VALUES ($1::uuid, 'contract_completed_docusign', 'contract', $2::uuid, $3::jsonb)
      `, [
        parties.rows[0]?.user_id,
        contractId,
        JSON.stringify({ envelope_id: envelopeId, document_id: documentId })
      ]);
    } catch (error) {
      console.error("Error marking contract complete:", error);
      throw error;
    }
  }

  /**
   * Create template in DocuSign
   */
  async createTemplate(
    name: string,
    description: string,
    document: Document,
    recipientRoles: any[]
  ): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description,
            shared: "true",
            documents: [document],
            recipients: {
              signers: recipientRoles,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create template: ${response.statusText}`);
      }

      const result = await response.json();
      return result.templateId;
    } catch (error) {
      console.error("Error creating DocuSign template:", error);
      throw error;
    }
  }

  /**
   * Void an envelope
   */
  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "voided",
            voidedReason: reason,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to void envelope: ${response.statusText}`);
      }

      // Update database
      await this.db.queryObject(`
        UPDATE docusign_envelopes
        SET status = 'voided',
            void_reason = $1,
            updated_at = NOW()
        WHERE envelope_id = $2
      `, [reason, envelopeId]);
    } catch (error) {
      console.error("Error voiding envelope:", error);
      throw error;
    }
  }
}