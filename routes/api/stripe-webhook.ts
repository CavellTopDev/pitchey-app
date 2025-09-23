import { define } from "../../utils.ts";
import { StripeService } from "@/services/stripe.service.ts";

export const handler = define.handlers({
  async POST(req) {
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      return new Response("No signature", { status: 400 });
    }
    
    const payload = await req.text();
    
    try {
      await StripeService.handleWebhook(payload, signature);
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Webhook error", { status: 400 });
    }
  },
});