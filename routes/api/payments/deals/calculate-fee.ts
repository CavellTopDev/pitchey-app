import { HandlerContext } from "$fresh/server.ts";
import { calculateSuccessFee, SUCCESS_FEE_PERCENTAGE } from "../../../../utils/stripe.ts";

interface CalculateFeeRequest {
  dealValue: number;
  currency?: string;
}

export const handler = {
  async POST(req: Request, ctx: HandlerContext) {
    try {
      const body: CalculateFeeRequest = await req.json();

      // Validate deal value
      if (!body.dealValue || body.dealValue <= 0) {
        return new Response(JSON.stringify({ error: "Invalid deal value" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const successFeeAmount = calculateSuccessFee(body.dealValue);

      const response = {
        dealValue: body.dealValue,
        currency: body.currency || "USD",
        successFeePercentage: SUCCESS_FEE_PERCENTAGE,
        successFeeAmount,
        creatorReceives: body.dealValue - successFeeAmount,
        breakdown: {
          originalDealValue: body.dealValue,
          successFeePercentage: SUCCESS_FEE_PERCENTAGE,
          successFeeAmount,
          netToCreator: body.dealValue - successFeeAmount,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Calculate fee error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to calculate success fee",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async GET(req: Request, ctx: HandlerContext) {
    try {
      const url = new URL(req.url);
      const dealValue = parseFloat(url.searchParams.get("dealValue") || "0");
      const currency = url.searchParams.get("currency") || "USD";

      if (!dealValue || dealValue <= 0) {
        return new Response(JSON.stringify({ error: "Invalid deal value parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const successFeeAmount = calculateSuccessFee(dealValue);

      const response = {
        dealValue,
        currency,
        successFeePercentage: SUCCESS_FEE_PERCENTAGE,
        successFeeAmount,
        creatorReceives: dealValue - successFeeAmount,
        breakdown: {
          originalDealValue: dealValue,
          successFeePercentage: SUCCESS_FEE_PERCENTAGE,
          successFeeAmount,
          netToCreator: dealValue - successFeeAmount,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Calculate fee error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to calculate success fee",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};