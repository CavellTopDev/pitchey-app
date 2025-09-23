import { HandlerContext } from "$fresh/server.ts";
import { db } from "@/db/client.ts";
import { invoices } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

export const handler = {
  async GET(req: Request, ctx: HandlerContext) {
    try {
      // Authenticate user
      const authResult = await authMiddleware(req);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = authResult.userId!;
      const url = new URL(req.url);
      const invoiceId = url.searchParams.get("id");
      const format = url.searchParams.get("format"); // pdf, json

      if (invoiceId) {
        // Get specific invoice
        const invoice = await db.query.invoices.findFirst({
          where: and(
            eq(invoices.id, parseInt(invoiceId)),
            eq(invoices.userId, userId)
          ),
          with: {
            deal: {
              with: {
                pitch: {
                  columns: {
                    title: true,
                  }
                },
                investor: {
                  columns: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    companyName: true,
                  }
                }
              }
            }
          }
        });

        if (!invoice) {
          return new Response(JSON.stringify({ error: "Invoice not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (format === "pdf") {
          // If PDF URL exists, redirect to it
          if (invoice.pdfUrl) {
            return Response.redirect(invoice.pdfUrl, 302);
          }
          
          // Generate PDF on-the-fly (simplified version)
          const pdfContent = generateInvoicePDF(invoice);
          
          return new Response(pdfContent, {
            status: 200,
            headers: { 
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
            },
          });
        }

        // Return JSON format
        return new Response(JSON.stringify({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          dealId: invoice.dealId,
          amount: parseFloat(invoice.amount),
          currency: invoice.currency,
          status: invoice.status,
          issuedAt: invoice.issuedAt,
          dueAt: invoice.dueAt,
          paidAt: invoice.paidAt,
          description: invoice.description,
          lineItems: invoice.lineItems,
          billingAddress: invoice.billingAddress,
          pdfUrl: invoice.pdfUrl,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
          deal: invoice.deal ? {
            id: invoice.deal.id,
            pitchTitle: invoice.deal.pitch.title,
            dealValue: parseFloat(invoice.deal.dealValue),
            successFeeAmount: parseFloat(invoice.deal.successFeeAmount),
            investor: {
              name: `${invoice.deal.investor.firstName} ${invoice.deal.investor.lastName}`.trim(),
              email: invoice.deal.investor.email,
              company: invoice.deal.investor.companyName,
            },
          } : null,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      } else {
        // Get all invoices for user
        const userInvoices = await db.query.invoices.findMany({
          where: eq(invoices.userId, userId),
          with: {
            deal: {
              with: {
                pitch: {
                  columns: {
                    title: true,
                  }
                },
                investor: {
                  columns: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    companyName: true,
                  }
                }
              }
            }
          },
          orderBy: invoices.createdAt,
        });

        return new Response(JSON.stringify({
          invoices: userInvoices.map(invoice => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            dealId: invoice.dealId,
            amount: parseFloat(invoice.amount),
            currency: invoice.currency,
            status: invoice.status,
            issuedAt: invoice.issuedAt,
            dueAt: invoice.dueAt,
            paidAt: invoice.paidAt,
            description: invoice.description,
            lineItems: invoice.lineItems,
            billingAddress: invoice.billingAddress,
            pdfUrl: invoice.pdfUrl,
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
            deal: invoice.deal ? {
              id: invoice.deal.id,
              pitchTitle: invoice.deal.pitch.title,
              dealValue: parseFloat(invoice.deal.dealValue),
              successFeeAmount: parseFloat(invoice.deal.successFeeAmount),
              investor: {
                name: `${invoice.deal.investor.firstName} ${invoice.deal.investor.lastName}`.trim(),
                email: invoice.deal.investor.email,
                company: invoice.deal.investor.companyName,
              },
            } : null,
          })),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

    } catch (error) {
      console.error("Get invoices error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to get invoices",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Simplified PDF generation (in a real implementation, use a proper PDF library)
function generateInvoicePDF(invoice: any): string {
  // This is a placeholder - in a real implementation, you would use a library like jsPDF or puppeteer
  const pdfContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
72 720 Td
(INVOICE ${invoice.invoiceNumber}) Tj
0 -20 Td
(Amount: ${invoice.currency} ${invoice.amount}) Tj
0 -20 Td
(Due Date: ${invoice.dueAt}) Tj
0 -20 Td
(Description: ${invoice.description}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000185 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
400
%%EOF
`;
  
  return pdfContent;
}