import { post } from '../http';

export async function cancelTask({ taskName, gigId, venueId }) {
  const data = await post('/tasks/cancelCloudTask', { body: { taskName, gigId, venueId } });
  return data?.success || false;
}


