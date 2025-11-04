import { request, httpClient } from './client';

export { request };

export const get = httpClient.get;
export const post = httpClient.post;
export const put = httpClient.put;
export const patch = httpClient.patch;
export const del = httpClient.delete;

export default httpClient;


