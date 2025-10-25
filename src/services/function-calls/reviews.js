import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

export async function submitReview(params) {
    try {
      const fn = httpsCallable(functions, "submitReview");
      const res = await fn(params);
      return res.data?.reviewId;
    } catch (error) {
      console.error("[CloudFn Error] submitReview:", error);
    }
  }
  
  export async function deleteReview(reviewId) {
    try {
      const fn = httpsCallable(functions, "deleteReview");
      const res = await fn({ reviewId });
      return res.data?.reviewId;
    } catch (error) {
      console.error("[CloudFn Error] deleteReview:", error);
    }
  }
  
  export async function logDispute(params) {
    try {
      const fn = httpsCallable(functions, "logDispute");
      const res = await fn(params);
      return res.data;
    } catch (error) {
      console.error("[CloudFn Error] logDispute:", error);
    }
  }