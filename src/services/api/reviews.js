import { post } from '../http';

export function submitReview({ reviewer, musicianId, venueId, gigId, rating, reviewText }) {
  return post('/reviews/submitReview', { body: { reviewer, musicianId, venueId, gigId, rating, reviewText } });
}

export function logDispute({ gigId, venueId, musicianId, reason, message, attachments }) {
  return post('/reviews/logDispute', { body: { gigId, venueId, musicianId, reason, message, attachments } });
}

export function deleteReview({ reviewId }) {
  return post('/reviews/deleteReview', { body: { reviewId } });
}


