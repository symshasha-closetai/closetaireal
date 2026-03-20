// Shared R2 S3-compatible helper for edge functions
// Uses raw fetch with AWS Signature V4 via aws4fetch

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

let _client: AwsClient | null = null;

function getClient(): AwsClient {
  if (_client) return _client;
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!accessKeyId || !secretAccessKey) throw new Error("R2 credentials not configured");
  _client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3" });
  return _client;
}

function getEndpoint(): string {
  const endpoint = Deno.env.get("R2_ENDPOINT");
  if (!endpoint) throw new Error("R2_ENDPOINT not configured");
  return endpoint;
}

function getBucket(): string {
  const bucket = Deno.env.get("R2_BUCKET_NAME");
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured");
  return bucket;
}

function getPublicUrl(): string {
  const url = Deno.env.get("R2_PUBLIC_URL");
  if (!url) throw new Error("R2_PUBLIC_URL not configured");
  return url.replace(/\/$/, "");
}

export function r2PublicUrl(path: string): string {
  return `${getPublicUrl()}/${path}`;
}

export async function r2Upload(path: string, body: Uint8Array | ArrayBuffer, contentType = "image/png"): Promise<string> {
  const client = getClient();
  const url = `${getEndpoint()}/${getBucket()}/${path}`;
  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed (${res.status}): ${text}`);
  }
  // Consume body
  await res.text();
  return r2PublicUrl(path);
}

export async function r2Delete(paths: string[]): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  const endpoint = getEndpoint();
  for (const path of paths) {
    const url = `${endpoint}/${bucket}/${path}`;
    const res = await client.fetch(url, { method: "DELETE" });
    await res.text(); // consume
  }
}

export async function r2List(prefix: string): Promise<string[]> {
  const client = getClient();
  const url = `${getEndpoint()}/${getBucket()}?list-type=2&prefix=${encodeURIComponent(prefix)}`;
  const res = await client.fetch(url, { method: "GET" });
  const xml = await res.text();
  // Simple XML parse for Key elements
  const keys: string[] = [];
  const regex = /<Key>([^<]+)<\/Key>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

export async function r2Head(path: string): Promise<boolean> {
  const client = getClient();
  const url = `${getEndpoint()}/${getBucket()}/${path}`;
  const res = await client.fetch(url, { method: "HEAD" });
  await res.text();
  return res.ok;
}

export async function r2Download(path: string): Promise<Uint8Array | null> {
  const client = getClient();
  const url = `${getEndpoint()}/${getBucket()}/${path}`;
  const res = await client.fetch(url, { method: "GET" });
  if (!res.ok) {
    await res.text();
    return null;
  }
  return new Uint8Array(await res.arrayBuffer());
}
