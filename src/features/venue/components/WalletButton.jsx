import { Elements, useStripe, useElements, PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import { confirmPaymentIntent } from "../../../services/functions";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const WalletButton = ({ amountToCharge, gigData, onSucceeded }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [pr, setPr] = useState(null);

  useEffect(() => {
    if (!stripe) return;
    const paymentRequest = stripe.paymentRequest({
      country: "GB",
      currency: "gbp",
      total: {
        label: `Gigin gig payment`,
        amount: amountToCharge,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });
    paymentRequest.canMakePayment().then(result => {
      if (result) setPr(paymentRequest);
    });
    paymentRequest.on("paymentmethod", async (ev) => {
      try {
        const { data } = await confirmPaymentIntent({ amountToCharge, gigData });
        const { error } = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: ev.paymentMethod.id,
        }, { handleActions: true });
        if (error) {
          ev.complete("fail");
          toast.error(error.message || "Payment failed");
          return;
        }
        ev.complete("success");
        onSucceeded?.(data.paymentIntentId);
      } catch (err) {
        console.error(err);
        ev.complete("fail");
        toast.error("Payment failed");
      }
    });
  }, [stripe, amountToCharge, gigData]);

  if (!pr) return null;

  return (
    <PaymentRequestButtonElement
      options={{
        paymentRequest: pr,
        style: { paymentRequestButton: { type: "default", theme: "dark", height: "44px" } }
      }}
    />
  );
}