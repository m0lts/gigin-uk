import { Elements, useStripe, useElements, PaymentRequestButtonElement, ExpressCheckoutElement } from "@stripe/react-stripe-js";
import { confirmPaymentIntent } from "../../../services/functions";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const WalletButton = ({ amountToCharge, gigData, onSucceeded }) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleConfirm = async (event) => {
    const { resolve, reject } = event;
    console.log('event', event)
    try {
      const { data } = await createGigPaymentIntent({ amountToCharge, gigData });
      console.log('data', data)
      const clientSecret = data?.clientSecret;
      if (!clientSecret) throw new Error('No client secret returned');
      const { error, paymentIntent } = await stripe.confirmPayment({
        clientSecret,
        elements,
        redirect: 'if_required',
      });
      if (error) {
        console.log('error', error)
        reject(error);
        toast.error(error.message || 'Payment failed');
        return;
      }
      console.log('paymentIntent', paymentIntent)
      resolve();
      onSucceeded?.(paymentIntent?.id || data?.paymentIntentId);
    } catch (err) {
      console.error(err);
      reject(err);
      toast.error('Payment failed');
    }
  };

  if (!stripe || !elements) return null;

  return (
    <ExpressCheckoutElement
      onConfirm={handleConfirm}
      options={{
        paymentMethodOrder: ['apple_pay', 'google_pay', 'link'],
        buttonType: { type: 'default' },
        buttonHeight: 44,
      }}
    />
  );
}