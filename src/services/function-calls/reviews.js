import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

export async function submitReview(params) {
    const fn = httpsCallable(functions, "submitReview");
    const res = await fn(params);
    return res.data?.reviewId;
}
  
export async function deleteReview(reviewId) {
    const fn = httpsCallable(functions, "deleteReview");
    const res = await fn({ reviewId });
    return res.data?.reviewId;
}

export async function logDispute(params) {
    const fn = httpsCallable(functions, "logDispute");
    const res = await fn(params);
    return res.data;
}