/* eslint-disable @typescript-eslint/no-explicit-any */
import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const R2_PART_SIZE = 64 * 1024 * 1024;

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface R2UploadOptions {
  key: string;
  body: Readable | NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
}

export function getR2StorageConfig(): R2StorageConfig | null {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createR2Client(config: R2StorageConfig) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function r2KeyForRendition(
  mediaId: string,
  driveFileId: string,
  kind: "video" | "audio",
  index?: number,
) {
  const suffix = kind === "audio" ? `audio-${index ?? 0}` : "video";
  return `hls/${mediaId}/${driveFileId}/${suffix}.mp4`;
}

export function r2KeyForOriginal(mediaId: string, driveFileId: string) {
  return `originals/${mediaId}/${driveFileId}/source`;
}

export async function uploadR2Object(options: R2UploadOptions) {
  const config = getR2StorageConfig();
  if (!config) return null;

  const upload = new Upload({
    client: createR2Client(config),
    params: {
      Bucket: config.bucket,
      Key: options.key,
      Body: options.body as any,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
      CacheControl: "public, max-age=31536000, immutable",
    },
    partSize: R2_PART_SIZE,
    queueSize: 2,
    leavePartsOnError: false,
  });

  const result = await upload.done();
  return result.ETag?.replaceAll('"', "") ?? null;
}

export async function uploadR2File(
  localPath: string,
  key: string,
  contentType: string,
  contentLength: number,
) {
  return uploadR2Object({
    key,
    body: createReadStream(localPath),
    contentType,
    contentLength,
  });
}

export async function uploadR2Stream(
  body: Readable | NodeJS.ReadableStream,
  key: string,
  contentType: string,
  contentLength?: number,
) {
  return uploadR2Object({ key, body, contentType, contentLength });
}
