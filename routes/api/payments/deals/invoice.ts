import { HandlerContext } from "$fresh/server.ts";
import { db } from "@/db/client.ts";
import { deals, invoices } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

interface CreateInvoiceRequest {
  dealId: number;
  billingAddress?: {
    name: string;
    company?: string;
    address: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  dueDate?: string; // ISO date string
}

function generateInvoiceNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `INV-${timestamp}-${random}`.toUpperCase();
}

export const handler = {
  async POST(req: Request, ctx: HandlerContext) {
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
      const body: CreateInvoiceRequest = await req.json();

      if (!body.dealId) {
        return new Response(JSON.stringify({ error: "Deal ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get deal and verify user ownership
      const deal = await db.query.deals.findFirst({
        where: and(
          eq(deals.id, body.dealId),
          eq(deals.creatorId, userId)
        ),
        with: {
          pitch: {
            columns: {
              title: true,
            }
          },
          investor: {
            columns: {
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
            }
          }
        }
      });

      if (!deal) {
        return new Response(JSON.stringify({ error: "Deal not found or not authorized" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if invoice already exists for this deal
      const existingInvoice = await db.query.invoices.findFirst({
        where: eq(invoices.dealId, body.dealId),
      });

      if (existingInvoice) {
        return new Response(JSON.stringify({ error: "Invoice already exists for this deal" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      const invoiceNumber = generateInvoiceNumber();
      const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Create invoice
      const [invoice] = await db.insert(invoices).values({
        userId,
        dealId: body.dealId,
        invoiceNumber,
        amount: deal.successFeeAmount,
        currency: deal.currency,
        status: "draft",
        issuedAt: new Date(),
        dueAt: dueDate,
        description: `Success fee for ${deal.pitch.title} - Deal #${deal.id}`,
        lineItems: [
          {
            description: `Success fee (${deal.successFeePercentage}%) for deal: ${deal.pitch.title}`,
            quantity: 1,
            unitPrice: deal.successFeeAmount,
            amount: deal.successFeeAmount,
          }
        ],
        billingAddress: body.billingAddress || {
          name: `${deal.investor.firstName} ${deal.investor.lastName}`.trim() || deal.investor.email,
          company: deal.investor.companyName || "",
          address: "",
          city: "",
          postalCode: "",
          country: "",
        },
      }).returning();

      const response = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dealId: body.dealId,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        description: invoice.description,
        lineItems: invoice.lineItems,
        billingAddress: invoice.billingAddress,
        deal: {
          id: deal.id,
          pitchTitle: deal.pitch.title,
          dealValue: deal.dealValue,
          successFeeAmount: deal.successFeeAmount,
          investor: {
            name: `${deal.investor.firstName} ${deal.investor.lastName}`.trim(),
            email: deal.investor.email,
            company: deal.investor.companyName,
          },
        },
      };

      return new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Create invoice error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to create invoice",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

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
      const dealId = url.searchParams.get("dealId");
      const status = url.searchParams.get("status");

      let whereCondition = eq(invoices.userId, userId);

      if (dealId) {
        whereCondition = and(whereCondition, eq(invoices.dealId, parseInt(dealId)));
      }

      if (status) {
        whereCondition = and(whereCondition, eq(invoices.status, status as any));
      }

      const userInvoices = await db.query.invoices.findMany({
        where: whereCondition,
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
          amount: invoice.amount,
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
          deal: invoice.deal ? {
            id: invoice.deal.id,
            pitchTitle: invoice.deal.pitch.title,
            dealValue: invoice.deal.dealValue,
            successFeeAmount: invoice.deal.successFeeAmount,
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