import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from "livekit-server-sdk";
import { env } from "../env.js";

// S3-compatible client for R2 — used for delete only (egress handles uploads)
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const egressClient = new EgressClient(
  env.LIVEKIT_URL,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET
);

export function recordingKey(callId: string): string {
  return `recordings/${callId}.ogg`;
}

export async function startCallRecording(
  roomName: string,
  callId: string
): Promise<{ egressId: string; recordingKey: string }> {
  const key = recordingKey(callId);

  const s3Upload = new S3Upload({
    accessKey: env.R2_ACCESS_KEY_ID,
    secret: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: "auto",
  });

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.OGG,
    filepath: key,
    output: { case: "s3", value: s3Upload },
  });

  const egress = await egressClient.startRoomCompositeEgress(roomName, output, {
    audioOnly: true,
  });

  console.log(`[storage] egress started: ${egress.egressId} for room ${roomName}`);
  return { egressId: egress.egressId, recordingKey: key };
}

export async function stopCallRecording(egressId: string): Promise<void> {
  await egressClient.stopEgress(egressId);
  console.log(`[storage] egress stopped: ${egressId}`);
}

export async function getPresignedRecordingUrl(callId: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: recordingKey(callId) }),
    { expiresIn: 3600 }
  );
}

export async function deleteRecording(callId: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: recordingKey(callId),
    })
  );
}
