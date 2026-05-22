import { Router } from "express";
import { spawn } from "node:child_process";
import { promises as fs, createReadStream, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSupabaseAdmin } from "../lib/supabase.js";

const router = Router();

const OVERLAY_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../templates/reel-overlay.gif");
const BGM_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../templates/bgm.mp3");
const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY ?? "";
const MINIMAX_API_KEY_ENV = process.env.MINIMAX_API_KEY ?? "";
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID ?? "";
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET ?? "";
const YOUTUBE_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN ?? "";

const tempVideoStore = new Map<string, { filePath: string; created: number }>();

async function getServiceAccountAccessToken(): Promise<string> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const sa = JSON.parse(json) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(sa.private_key, "base64url");
  const jwt = `${signingInput}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Service account token error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of tempVideoStore.entries()) {
    if (now - entry.created > 30 * 60 * 1000) {
      fs.unlink(entry.filePath).catch(() => {});
      tempVideoStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      filePath,
    ], { stdio: "pipe" });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.on("close", () => { resolve(parseFloat(output.trim()) || 15); });
  });
}

// Build a standard PCM WAV header
function buildWavHeader(pcmByteLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
  const header = Buffer.allocUnsafe(44);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmByteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);           // PCM subchunk size
  header.writeUInt16LE(1, 20);            // AudioFormat = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmByteLength, 40);
  return header;
}

interface TtsOptions {
  provider: "gemini" | "minimax";
  apiKey?: string;
  voice?: string;
}

// Gemini TTS — gemini-2.5-flash-preview-tts, returns raw PCM → wrapped in WAV
async function generateTTSGemini(text: string, wavPath: string, apiKey: string, voice: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || "Kore" },
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini TTS error ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
    error?: { message?: string };
  };

  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    throw new Error(data.error?.message ?? "Gemini TTS returned no audio data");
  }

  const pcm = Buffer.from(inlineData.data, "base64");
  const wavHeader = buildWavHeader(pcm.length, 24000, 1, 16);
  const wavBuffer = Buffer.concat([wavHeader, pcm]);

  await fs.writeFile(wavPath, wavBuffer);
  console.info(`[TTS] Gemini (${voice}) generated ${(wavBuffer.length / 1024).toFixed(0)}KB WAV`);
  return wavPath;
}

// MiniMax TTS — speech-02-hd, returns hex-encoded WAV
async function generateTTSMinimax(text: string, wavPath: string, apiKey: string, voice: string): Promise<string> {
  const res = await fetch("https://api.minimaxi.chat/v1/t2a_v2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "speech-02-hd",
      text,
      stream: false,
      voice_setting: {
        voice_id: voice || "Calm_Woman",
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "wav",
        channel: 1,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MiniMax TTS error ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = await res.json() as {
    data?: { audio?: string; status?: number };
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax TTS failed: ${data.base_resp.status_msg}`);
  }
  if (!data.data?.audio) {
    throw new Error("MiniMax TTS returned no audio data");
  }

  // MiniMax returns hex-encoded audio
  const audioBuffer = Buffer.from(data.data.audio, "hex");
  await fs.writeFile(wavPath, audioBuffer);
  console.info(`[TTS] MiniMax (${voice}) generated ${(audioBuffer.length / 1024).toFixed(0)}KB WAV`);
  return wavPath;
}

async function generateTTS(text: string, outputPath: string, opts: TtsOptions): Promise<string> {
  const wavPath = outputPath.replace(/\.(mp3|wav)$/, ".wav");
  const { provider, apiKey, voice } = opts;

  if (provider === "minimax") {
    const key = apiKey?.trim() || MINIMAX_API_KEY_ENV;
    if (!key) throw new Error("MiniMax API key not configured — enter it in TTS Settings");
    return generateTTSMinimax(text, wavPath, key, voice ?? "Tamil_Female_Tara");
  }

  // Default: Gemini
  const key = apiKey?.trim() || GEMINI_API_KEY_ENV;
  if (!key) throw new Error("Gemini API key not configured — enter it in TTS Settings");
  return generateTTSGemini(text, wavPath, key, voice ?? "Kore");
}

async function downloadImage(imageUrl: string, outputDir: string): Promise<string> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  const ext = contentType.includes("png") ? "png"
    : contentType.includes("webp") ? "webp"
    : "jpg";
  const outputPath = path.join(outputDir, `image.${ext}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
    proc.on("error", reject);
  });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const REELS_BUCKET = "reels";

async function ensureReelsBucket(): Promise<void> {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) return;
  const keyParts = serviceKey.split(".");
  console.info(`[storage] serviceKey parts=${keyParts.length} len=${serviceKey.length}`);
  try {
    const listRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      headers: { Authorization: `Bearer ${serviceKey}` },
    });
    if (!listRes.ok) {
      console.warn("[storage] Could not list buckets:", await listRes.text());
      return;
    }
    const buckets = await listRes.json() as Array<{ name: string }>;
    const exists = buckets.some((b) => b.name === REELS_BUCKET);
    if (!exists) {
      const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: REELS_BUCKET, name: REELS_BUCKET, public: true }),
      });
      if (createRes.ok) {
        console.info(`[storage] Created '${REELS_BUCKET}' bucket`);
      } else {
        console.warn("[storage] Could not create bucket:", await createRes.text());
      }
    }
  } catch (err) {
    console.warn("[storage] Could not ensure reels bucket:", err);
  }
}

// Upload video to Supabase Storage via REST API (bypasses client-side JWT issues)
async function uploadReelToStorage(videoPath: string, videoId: string): Promise<string | null> {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  console.info(`[storage] uploadReelToStorage — url=${supabaseUrl ? "set" : "MISSING"} key=${serviceKey ? `set(len=${serviceKey.length})` : "MISSING"}`);
  if (!supabaseUrl || !serviceKey) return null;
  try {
    const videoBuffer = await fs.readFile(videoPath);
    const objectPath = `${videoId}.mp4`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${REELS_BUCKET}/${objectPath}`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body: videoBuffer,
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error("[storage] Upload failed:", errText);
      return null;
    }
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${REELS_BUCKET}/${objectPath}`;
    console.info(`[storage] Reel uploaded → ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error("[storage] uploadReelToStorage error:", err);
    return null;
  }
}

// Upload video to Cloudflare R2 (S3-compatible) — used when Supabase storage is unavailable
async function uploadReelToR2(videoPath: string, videoId: string): Promise<string | null> {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.R2_BUCKET_NAME || "").trim();
  const publicUrl = (process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || "").trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.warn("[r2] R2 credentials not fully configured, skipping");
    return null;
  }

  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const objectKey = `reels/${videoId}.mp4`;
    const videoBuffer = await fs.readFile(videoPath);

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: videoBuffer,
      ContentType: "video/mp4",
    }));

    const baseUrl = publicUrl.replace(/\/$/, "");
    const url = `${baseUrl}/${objectKey}`;
    console.info(`[r2] Reel uploaded → ${url}`);
    return url;
  } catch (err) {
    console.error("[r2] Upload error:", err);
    return null;
  }
}

// Try R2 first (Supabase may be quota-restricted), then fall back to Supabase
async function uploadReelToBestStorage(videoPath: string, videoId: string): Promise<string | null> {
  const r2Url = await uploadReelToR2(videoPath, videoId);
  if (r2Url) return r2Url;
  console.warn("[storage] R2 failed or not configured, trying Supabase...");
  return uploadReelToStorage(videoPath, videoId);
}

async function renderReel(
  imageUrl: string,
  voiceoverText: string,
  ttsOpts: TtsOptions = { provider: "gemini" },
): Promise<{ videoPath: string; tmpDir: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "trichy-reel-"));
  const audioFile = path.join(tmpDir, "voiceover.wav");
  const outputFile = path.join(tmpDir, "reel.mp4");

  const [imageFile, actualAudioFile] = await Promise.all([
    downloadImage(imageUrl, tmpDir),
    generateTTS(voiceoverText, audioFile, ttsOpts),
  ]);

  const audioDuration = await getVideoDuration(actualAudioFile);
  // Add 1s padding so video doesn't cut before audio fades.
  // Cap at 88s — Instagram Reels hard limit is 90s.
  const reelDuration = Math.min(Math.max(audioDuration + 1, 10), 88);
  console.info(`[reel] audioDuration=${audioDuration.toFixed(2)}s reelDuration=${reelDuration.toFixed(2)}s`);

  // GIF overlay: 30fps (Instagram requires ≥23fps). Trim to first 10s (300 frames) then loop forever.
  // News image fills the full 1080x1920 background.
  // GIF is composited on top as a looping branded overlay.
  const REEL_FPS = 30;
  const gifLoopFrames = 10 * REEL_FPS; // 300 frames at 30fps = 10 second loop

  await runFFmpeg([
    "-y",
    "-loop", "1",
    "-t", String(reelDuration + 2),    // static image runs long enough
    "-i", imageFile,                   // input 0: news photo (background)
    "-i", OVERLAY_PATH,               // input 1: branded GIF overlay
    "-i", actualAudioFile,            // input 2: TTS voiceover
    "-stream_loop", "-1",
    "-i", BGM_PATH,                   // input 3: background music (loops if needed)
    "-filter_complex",
    // [bg] scale to 1080x1920 cover, normalise to 30fps, force yuv420p (limited range, NOT yuvj420p)
    `[0:v]fps=${REEL_FPS},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p[bg];` +
    // [ov] trim GIF to 10s, normalise to 30fps, loop forever, reduce to 50% opacity via lut alpha channel
    `[1:v]trim=end=10,setpts=PTS-STARTPTS,fps=${REEL_FPS},loop=-1:${gifLoopFrames}:0,setpts=N/FRAME_RATE/TB,format=yuva420p,` +
    `lut=a='val*0.5'[ov];` +
    // composite: photo visible behind semi-transparent GIF
    "[bg][ov]overlay=0:0,format=yuv420p[v];" +
    // audio: TTS (24kHz mono) + BGM (44.1kHz stereo) → both resampled to 48kHz stereo, then mixed.
    // Explicit stereo upmix on TTS before amix avoids channel-layout ambiguity in Instagram's decoder.
    "[2:a]volume=1.0,aresample=48000,aformat=channel_layouts=stereo[tts];" +
    "[3:a]volume=0.14,aresample=48000,aformat=channel_layouts=stereo[bgm];" +
    "[tts][bgm]amix=inputs=2:duration=first:dropout_transition=2,aformat=sample_rates=48000:channel_layouts=stereo[a]",
    "-map", "[v]",
    "-map", "[a]",
    // libx264: H.264 High profile, Level 4.0 — required for 1080x1920@30fps.
    // Level 3.1 only supports ~108k MB/s; 1080x1920@30fps needs ~243k MB/s → Level 4.0 minimum.
    // Instagram recommends High profile. No B-frames for broad decoder compat.
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level:v", "4.0",
    "-bf", "0",
    "-b:v", "3500k",
    "-maxrate", "4000k",
    "-bufsize", "4000k",
    "-pix_fmt", "yuv420p",
    "-color_range", "tv",
    "-colorspace", "bt709",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-r", String(REEL_FPS),
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
    "-t", String(reelDuration),
    "-movflags", "+faststart",
    outputFile,
  ]);

  // Log the actual video properties so we can verify format in production
  try {
    const probeProc = spawn("ffprobe", [
      "-v", "quiet", "-print_format", "json", "-show_streams", outputFile,
    ]);
    let probeOut = "";
    probeProc.stdout.on("data", (d: Buffer) => { probeOut += d.toString(); });
    await new Promise<void>((resolve) => probeProc.on("close", resolve));
    const probe = JSON.parse(probeOut) as { streams?: Array<{ codec_type?: string; codec_name?: string; r_frame_rate?: string; width?: number; height?: number; sample_rate?: string; channels?: number; pix_fmt?: string; color_range?: string; color_space?: string; color_primaries?: string; color_transfer?: string; profile?: string; bit_rate?: string }> };
    const vs = probe.streams?.find((s) => s.codec_type === "video");
    const as = probe.streams?.find((s) => s.codec_type === "audio");
    const fileStat = await fs.stat(outputFile).catch(() => null);
    const fileSizeMb = fileStat ? (fileStat.size / 1024 / 1024).toFixed(1) : "?";
    console.info(`[reel] video=${vs?.codec_name} ${vs?.width}x${vs?.height} fps=${vs?.r_frame_rate} profile=${vs?.profile} bitrate=${vs?.bit_rate ? Math.round(Number(vs.bit_rate)/1000)+"kbps" : "?"} pix_fmt=${vs?.pix_fmt} color_range=${vs?.color_range} | audio=${as?.codec_name} ${as?.sample_rate}Hz ch=${as?.channels} | size=${fileSizeMb}MB`);
  } catch { /* non-fatal */ }

  return { videoPath: outputFile, tmpDir };
}

async function publishInstagramReel(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
): Promise<{ success: boolean; error?: string; mediaId?: string }> {
  type IGError = { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };

  async function attempt(): Promise<string> {
    // Step 1: Create media container — Instagram fetches the video from videoUrl directly.
    // URL-based ingestion is simpler and more reliable than the rupload binary API.
    console.log(`[instagram] creating container with video_url=${videoUrl}`);
    const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        access_token: accessToken,
      }),
    });

    const createData = (await createRes.json()) as { id?: string; error?: IGError };
    if (!createData.id) {
      const e = createData.error;
      const detail = e ? `[code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}] ${e.message ?? "Unknown error"}` : "Failed to create media container";
      console.error("Instagram createMedia error:", JSON.stringify(createData));
      throw new Error(detail);
    }

    const containerId = createData.id;
    console.log(`[instagram] container created: ${containerId} — polling for FINISHED`);

    // Step 2: Poll until Instagram finishes ingesting and processing the video (up to 2.5 min).
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${accessToken}`,
      );
      const rawBody = await statusRes.text();
      let statusData: { status_code?: string; status?: string; error?: IGError } = {};
      try { statusData = JSON.parse(rawBody) as typeof statusData; } catch { /* ignore */ }
      console.log(`[instagram] status attempt ${i + 1}: ${statusData.status_code} ${statusData.status ?? ""}`);
      if (statusData.status_code === "FINISHED") break;
      if (statusData.status_code === "ERROR") {
        throw new Error(`Instagram processing failed — ${statusData.status ?? "ERROR"}. Ensure video is MP4 H.264 AAC 9:16.`);
      }
      if (i === 29) throw new Error("Instagram processing timed out after 2.5 minutes");
    }

    // Step 3: Publish the processed container.
    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    });

    const publishData = (await publishRes.json()) as { id?: string; error?: IGError };
    if (!publishData.id) {
      const e = publishData.error;
      const detail = e ? `[code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}] ${e.message ?? "Unknown error"}` : "Failed to publish reel";
      console.error("Instagram publishMedia error:", JSON.stringify(publishData));
      throw new Error(detail);
    }

    console.log(`[instagram] Reel published: ${publishData.id}`);
    return publishData.id;
  }

  try {
    try {
      const mediaId = await attempt();
      return { success: true, mediaId };
    } catch (firstErr) {
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      if (!firstMsg.toLowerCase().includes("timed out")) throw firstErr;
      console.log("[instagram] attempt 1 timed out, retrying after 10s...");
      await new Promise((r) => setTimeout(r, 10000));
      const mediaId = await attempt();
      return { success: true, mediaId };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[instagram] publishInstagramReel failed:", msg);
    return { success: false, error: msg };
  }
}

async function publishYouTubeShort(
  videoPath: string,
  title: string,
  description: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ success: boolean; error?: string; videoId?: string }> {
  const ytClientId = clientId || YOUTUBE_CLIENT_ID;
  const ytClientSecret = clientSecret || YOUTUBE_CLIENT_SECRET;
  const ytRefreshToken = refreshToken || YOUTUBE_REFRESH_TOKEN;

  if (!ytClientId || !ytClientSecret || !ytRefreshToken) {
    return { success: false, error: "YouTube credentials not configured (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN)" };
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: ytClientId,
        client_secret: ytClientSecret,
        refresh_token: ytRefreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description ?? tokenData.error ?? "Failed to get YouTube access token");
    }

    const accessToken = tokenData.access_token;
    const videoBuffer = await fs.readFile(videoPath);
    const boundary = `boundary_${Date.now()}`;

    const metadata = JSON.stringify({
      snippet: {
        title: title.slice(0, 100),
        description: `${description}\n\n#Shorts #TamilNews #TrichyInsight #திருச்சி`,
        categoryId: "25",
        tags: ["Shorts", "Tamil", "News", "Trichy", "TrichyInsight"],
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    });

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`),
      videoBuffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      },
    );

    const ytData = (await uploadRes.json()) as { id?: string; error?: { message?: string } };
    if (!ytData.id) throw new Error(ytData.error?.message ?? `YouTube upload failed (${uploadRes.status})`);

    return { success: true, videoId: ytData.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

router.get("/reels/temp/:id", (req, res) => {
  const id = req.params.id as string;
  const entry = tempVideoStore.get(id);
  if (!entry) return res.status(404).json({ error: "Video not found or expired" });

  const stat = statSync(entry.filePath);
  res.set({
    "Content-Type": "video/mp4",
    "Content-Length": String(stat.size),
    "Content-Disposition": `inline; filename="${id}.mp4"`,
    "Cache-Control": "no-cache",
    "Accept-Ranges": "bytes",
  });
  createReadStream(entry.filePath).pipe(res);
});

router.post("/reels/render-publish-stream", async (req, res) => {
  const {
    article,
    voiceoverScript,
    imageUrl,
    caption,
    publishToInstagram = false,
    publishToYoutube = false,
    publishToFacebook = false,
    instagram,
    youtube,
    facebook,
    tts,
  } = req.body as {
    article: { title: string; excerpt?: string; category?: string; slug?: string };
    voiceoverScript: string;
    imageUrl: string;
    caption?: string;
    publishToInstagram?: boolean;
    publishToYoutube?: boolean;
    publishToFacebook?: boolean;
    instagram?: { igUserId: string; accessToken: string };
    youtube?: { refreshToken?: string; clientId?: string; clientSecret?: string };
    facebook?: { pageId: string; accessToken: string };
    tts?: { provider?: "gemini" | "minimax"; apiKey?: string; voice?: string };
  };

  if (!voiceoverScript?.trim()) {
    res.status(400).json({ error: "voiceoverScript is required" });
    return;
  }
  if (!imageUrl?.trim()) {
    res.status(400).json({ error: "imageUrl is required" });
    return;
  }

  res.set({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-store",
    "X-Accel-Buffering": "no",
    "Transfer-Encoding": "chunked",
  });
  res.flushHeaders();

  const emit = (event: object) => {
    try { res.write(JSON.stringify(event) + "\n"); } catch { /* client disconnected */ }
  };

  let tmpDir: string | null = null;

  try {
    const ttsOpts: TtsOptions = {
      provider: tts?.provider ?? "gemini",
      apiKey: tts?.apiKey,
      voice: tts?.voice,
    };

    const tmpDirPath = await fs.mkdtemp(path.join(os.tmpdir(), "trichy-reel-"));
    tmpDir = tmpDirPath;
    const audioFile = path.join(tmpDirPath, "voiceover.wav");
    const outputFile = path.join(tmpDirPath, "reel.mp4");

    emit({ step: "voiceover", status: "running" });
    const [imageFile, actualAudioFile] = await Promise.all([
      downloadImage(imageUrl, tmpDirPath),
      generateTTS(voiceoverScript.trim(), audioFile, ttsOpts),
    ]);
    emit({ step: "voiceover", status: "done" });

    emit({ step: "render", status: "running" });
    const audioDuration = await getVideoDuration(actualAudioFile);
    // Cap at 88s — Instagram Reels hard limit is 90s.
    const reelDuration = Math.min(Math.max(audioDuration + 1, 10), 88);
    console.info(`[reel/stream] audioDuration=${audioDuration.toFixed(2)}s reelDuration=${reelDuration.toFixed(2)}s`);
    const REEL_FPS = 30;
    const gifLoopFrames = 10 * REEL_FPS;

    await runFFmpeg([
      "-y",
      "-loop", "1",
      "-t", String(reelDuration + 2),
      "-i", imageFile,
      "-i", OVERLAY_PATH,
      "-i", actualAudioFile,
      "-stream_loop", "-1",
      "-i", BGM_PATH,
      "-filter_complex",
      `[0:v]fps=${REEL_FPS},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p[bg];` +
      `[1:v]trim=end=10,setpts=PTS-STARTPTS,fps=${REEL_FPS},loop=-1:${gifLoopFrames}:0,setpts=N/FRAME_RATE/TB,format=yuva420p,` +
      `lut=a='val*0.5'[ov];` +
      "[bg][ov]overlay=0:0,format=yuv420p[v];" +
      "[2:a]volume=1.0,aresample=48000,aformat=channel_layouts=stereo[tts];" +
      "[3:a]volume=0.14,aresample=48000,aformat=channel_layouts=stereo[bgm];" +
      "[tts][bgm]amix=inputs=2:duration=first:dropout_transition=2,aformat=sample_rates=48000:channel_layouts=stereo[a]",
      "-map", "[v]",
      "-map", "[a]",
      // High profile, Level 4.0 — required for 1080x1920@30fps (~243k MB/s; Level 3.1 max is 108k).
      // Instagram recommends High profile. No B-frames for broad decoder compat.
      "-c:v", "libx264", "-preset", "veryfast",
      "-profile:v", "high", "-level:v", "4.0",
      "-b:v", "3500k", "-maxrate", "4000k", "-bufsize", "4000k",
      "-bf", "0",
      "-pix_fmt", "yuv420p",
      "-color_range", "tv",
      "-colorspace", "bt709",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-r", String(REEL_FPS),
      "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
      "-t", String(reelDuration),
      "-movflags", "+faststart",
      outputFile,
    ]);
    // Log video properties for diagnostics
    try {
      const probeProc = spawn("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_streams", outputFile]);
      let probeOut = "";
      probeProc.stdout.on("data", (d: Buffer) => { probeOut += d.toString(); });
      await new Promise<void>((resolve) => probeProc.on("close", resolve));
      const probe = JSON.parse(probeOut) as { streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string; profile?: string; pix_fmt?: string; color_range?: string; bit_rate?: string; sample_rate?: string; channels?: number }> };
      const vs = probe.streams?.find((s) => s.codec_type === "video");
      const as = probe.streams?.find((s) => s.codec_type === "audio");
      const fileStat = await fs.stat(outputFile).catch(() => null);
      const fileSizeMb = fileStat ? (fileStat.size / 1024 / 1024).toFixed(1) : "?";
      console.info(`[reel/stream] video=${vs?.codec_name} ${vs?.width}x${vs?.height} fps=${vs?.r_frame_rate} profile=${vs?.profile} bitrate=${vs?.bit_rate ? Math.round(Number(vs.bit_rate)/1000)+"kbps" : "?"} pix_fmt=${vs?.pix_fmt} color_range=${vs?.color_range} | audio=${as?.codec_name} ${as?.sample_rate}Hz ch=${as?.channels} | size=${fileSizeMb}MB`);
    } catch { /* non-fatal */ }
    emit({ step: "render", status: "done" });

    const videoId = crypto.randomUUID();
    tempVideoStore.set(videoId, { filePath: outputFile, created: Date.now() });
    const domain = (process.env.REPLIT_DOMAINS ?? "").split(",")[0].trim() || process.env.PUBLIC_API_URL || "localhost:8080";
    const tempVideoUrl = `https://${domain}/api/reels/temp/${videoId}`;

    let publicVideoUrl = tempVideoUrl;

    if (publishToInstagram || publishToFacebook) {
      emit({ step: "upload", status: "running" });
      const storageUrl = await uploadReelToBestStorage(outputFile, videoId);
      publicVideoUrl = storageUrl ?? tempVideoUrl;
      emit({ step: "upload", status: storageUrl ? "done" : "error", detail: storageUrl ? undefined : "Storage upload failed, using temp URL" });
    }

    const postCaption = caption?.trim() ||
      `${article.title}\n\n${article.excerpt ?? ""}\n\n#TrichyInsight #TamilNews #திருச்சி #Trichy`.trim();

    if (publishToInstagram) {
      const igUserId = instagram?.igUserId || process.env.INSTAGRAM_USER_ID || "";
      const igAccessToken = instagram?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || "";
      if (!igUserId || !igAccessToken) {
        emit({ step: "instagram", status: "error", error: "Instagram credentials missing. Set INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN secrets." });
      } else {
        emit({ step: "instagram", status: "running" });
        // Use our own server's temp URL — Instagram fetches directly from it.
        // Replit's domain is publicly accessible; Supabase Storage URLs are blocked by
        // Cloudflare Bot Management on Instagram's ingest servers.
        console.info(`[instagram] URL-based ingestion via tempVideoUrl=${tempVideoUrl}`);
        const igResult = await publishInstagramReel(igUserId, igAccessToken, tempVideoUrl, postCaption);
        emit({
          step: "instagram",
          status: igResult.success ? "done" : "error",
          mediaId: igResult.mediaId,
          error: igResult.error,
        });
      }
    }

    if (publishToYoutube) {
      emit({ step: "youtube", status: "running" });
      const ytResult = await publishYouTubeShort(
        outputFile,
        article.title,
        postCaption,
        youtube?.refreshToken ?? "",
        youtube?.clientId ?? "",
        youtube?.clientSecret ?? "",
      );
      emit({
        step: "youtube",
        status: ytResult.success ? "done" : "error",
        videoId: ytResult.videoId,
        error: ytResult.error,
      });
    }

    if (publishToFacebook) {
      if (!facebook?.pageId || !facebook?.accessToken) {
        emit({ step: "facebook", status: "error", error: "Facebook credentials missing. Open the Channels tab → Facebook and connect your Page." });
      } else {
        emit({ step: "facebook", status: "running" });
        const description = [`📰 ${article.title}`, article.excerpt ?? "", "— Trichy Insight"].filter(Boolean).join("\n");
        let fbResult: { success: boolean; error?: string; postId?: string };
        try {
          const startRes = await fetch(`https://graph.facebook.com/v21.0/${facebook.pageId}/video_reels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ upload_phase: "start", access_token: facebook.accessToken }),
          });
          const startJson = await startRes.json() as { video_id?: string; upload_url?: string; error?: { message: string } };
          if (startJson.video_id && startJson.upload_url) {
            const videoBuffer = await fs.readFile(outputFile);
            const uploadRes = await fetch(startJson.upload_url, {
              method: "POST",
              headers: { Authorization: `OAuth ${facebook.accessToken}`, "Content-Type": "video/mp4", offset: "0", file_size: String(videoBuffer.length) },
              body: videoBuffer,
            });
            if (!uploadRes.ok) {
              const uploadText = await uploadRes.text();
              fbResult = { success: false, error: `Facebook video upload failed (${uploadRes.status}): ${uploadText}` };
            } else {
              const finishRes = await fetch(`https://graph.facebook.com/v21.0/${facebook.pageId}/video_reels`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ upload_phase: "finish", video_id: startJson.video_id, video_state: "PUBLISHED", description, access_token: facebook.accessToken }),
              });
              const finishJson = await finishRes.json() as { success?: boolean; error?: { message: string } };
              fbResult = finishJson.error ? { success: false, error: finishJson.error.message } : { success: true, postId: startJson.video_id };
            }
          } else {
            fbResult = { success: false, error: startJson.error?.message ?? "Facebook Reel start failed" };
          }
        } catch (fbErr) {
          fbResult = { success: false, error: fbErr instanceof Error ? fbErr.message : String(fbErr) };
        }
        emit({ step: "facebook", status: fbResult.success ? "done" : "error", postId: fbResult.postId, error: fbResult.error });
      }
    }

    emit({ step: "complete", success: true, videoUrl: publicVideoUrl, videoId });
    res.end();
  } catch (err) {
    console.error("[reels/render-publish-stream] error:", err);
    if (tmpDir) fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    emit({ step: "error", error: err instanceof Error ? err.message : String(err) });
    res.end();
  }
});

router.post("/reels/render-publish", async (req, res) => {
  const {
    article,
    voiceoverScript,
    imageUrl,
    caption,
    publishToInstagram = false,
    publishToYoutube = false,
    publishToFacebook = false,
    instagram,
    youtube,
    facebook,
    tts,
  } = req.body as {
    article: { title: string; excerpt?: string; category?: string; slug?: string };
    voiceoverScript: string;
    imageUrl: string;
    caption?: string;
    publishToInstagram?: boolean;
    publishToYoutube?: boolean;
    publishToFacebook?: boolean;
    instagram?: { igUserId: string; accessToken: string };
    youtube?: { refreshToken?: string; clientId?: string; clientSecret?: string };
    facebook?: { pageId: string; accessToken: string };
    tts?: { provider?: "gemini" | "minimax"; apiKey?: string; voice?: string };
  };

  if (!voiceoverScript?.trim()) {
    return res.status(400).json({ error: "voiceoverScript is required" });
  }
  if (!imageUrl?.trim()) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  let tmpDir: string | null = null;

  try {
    const ttsOpts: TtsOptions = {
      provider: tts?.provider ?? "gemini",
      apiKey: tts?.apiKey,
      voice: tts?.voice,
    };
    const rendered = await renderReel(imageUrl, voiceoverScript.trim(), ttsOpts);
    tmpDir = rendered.tmpDir;
    const { videoPath } = rendered;

    const videoId = crypto.randomUUID();
    tempVideoStore.set(videoId, { filePath: videoPath, created: Date.now() });

    const domain = (process.env.REPLIT_DOMAINS ?? "").split(",")[0].trim() || process.env.PUBLIC_API_URL || "localhost:8080";
    const tempVideoUrl = `https://${domain}/api/reels/temp/${videoId}`;
    console.info(`[reel] tempVideoUrl=${tempVideoUrl}`);

    // Upload to R2 (primary) or Supabase (fallback) for a stable public URL
    const storageUrl = (publishToInstagram || publishToFacebook)
      ? await uploadReelToBestStorage(videoPath, videoId)
      : null;
    const publicVideoUrl = storageUrl ?? tempVideoUrl;
    console.info(`[reel] publicVideoUrl=${publicVideoUrl} (${storageUrl ? "r2/supabase" : "temp"})`);

    const postCaption = caption?.trim() ||
      `${article.title}\n\n${article.excerpt ?? ""}\n\n#TrichyInsight #TamilNews #திருச்சி #Trichy`.trim();

    let instagramResult: { success: boolean; error?: string; mediaId?: string } | null = null;
    let youtubeResult: { success: boolean; error?: string; videoId?: string } | null = null;
    let facebookResult: { success: boolean; error?: string; postId?: string } | null = null;

    if (publishToInstagram) {
      const igUserId = instagram?.igUserId || process.env.INSTAGRAM_USER_ID || "";
      const igAccessToken = instagram?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || "";
      if (!igUserId || !igAccessToken) {
        instagramResult = {
          success: false,
          error: "Instagram credentials missing. Set INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN secrets.",
        };
      } else {
        // Always use tempVideoUrl for Instagram — Supabase Storage is blocked by Cloudflare Bot Management
        // on Instagram's ingest servers. Our Replit server is publicly accessible without restrictions.
        instagramResult = await publishInstagramReel(
          igUserId,
          igAccessToken,
          tempVideoUrl,
          postCaption,
        );
      }
    }

    if (publishToYoutube) {
      youtubeResult = await publishYouTubeShort(
        videoPath,
        article.title,
        postCaption,
        youtube?.refreshToken ?? "",
        youtube?.clientId ?? "",
        youtube?.clientSecret ?? "",
      );
    }

    if (publishToFacebook) {
      if (!facebook?.pageId || !facebook?.accessToken) {
        facebookResult = {
          success: false,
          error: "Facebook credentials missing. Open the Channels tab → Facebook and connect your Page.",
        };
      } else {
        const description = [`📰 ${article.title}`, article.excerpt ?? "", "— Trichy Insight"].filter(Boolean).join("\n");

        // Step 1: Start upload session
        const startRes = await fetch(
          `https://graph.facebook.com/v21.0/${facebook.pageId}/video_reels`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ upload_phase: "start", access_token: facebook.accessToken }),
          },
        );
        const startJson = await startRes.json() as { video_id?: string; upload_url?: string; error?: { message: string } };
        console.info("[facebook] start response:", JSON.stringify(startJson));

        if (startJson.video_id && startJson.upload_url) {
          // Step 2: Upload video binary to the upload_url
          const videoBuffer = await fs.readFile(videoPath);
          const uploadRes = await fetch(startJson.upload_url, {
            method: "POST",
            headers: {
              Authorization: `OAuth ${facebook.accessToken}`,
              "Content-Type": "video/mp4",
              offset: "0",
              file_size: String(videoBuffer.length),
            },
            body: videoBuffer,
          });
          const uploadText = await uploadRes.text();
          console.info("[facebook] upload response:", uploadRes.status, uploadText);

          if (!uploadRes.ok) {
            facebookResult = { success: false, error: `Facebook video upload failed (${uploadRes.status}): ${uploadText}` };
          } else {
            // Step 3: Finish and publish
            const finishRes = await fetch(
              `https://graph.facebook.com/v21.0/${facebook.pageId}/video_reels`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  upload_phase: "finish",
                  video_id: startJson.video_id,
                  video_state: "PUBLISHED",
                  description,
                  access_token: facebook.accessToken,
                }),
              },
            );
            const finishJson = await finishRes.json() as { success?: boolean; error?: { message: string } };
            console.info("[facebook] finish response:", JSON.stringify(finishJson));
            facebookResult = finishJson.error
              ? { success: false, error: finishJson.error.message }
              : { success: true, postId: startJson.video_id };
          }
        } else {
          facebookResult = { success: false, error: startJson.error?.message ?? "Facebook Reel start failed" };
        }
      }
    }

    if (!publishToInstagram && !publishToYoutube && !publishToFacebook) {
      return res.json({
        success: true,
        videoUrl: tempVideoUrl,
        videoId,
        message: "Video rendered. Use videoUrl to download or trigger publish.",
        instagram: null,
        youtube: null,
        facebook: null,
      });
    }

    const allDone = [instagramResult, youtubeResult, facebookResult].filter(Boolean);
    const anySuccess = allDone.some((r) => r?.success);

    return res.json({
      success: anySuccess,
      videoUrl: publicVideoUrl,
      videoId,
      instagram: instagramResult,
      youtube: youtubeResult,
      facebook: facebookResult,
    });
  } catch (err) {
    console.error("[reels/render-publish] error:", err);
    if (tmpDir) {
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
    // Return 200 with success:false so the proxy never intercepts with HTML
    const msg = err instanceof Error ? err.message : String(err);
    return res.json({ success: false, error: msg });
  }
});

router.delete("/reels/temp/:id", (req, res) => {
  const id = req.params.id as string;
  const entry = tempVideoStore.get(id);
  if (entry) {
    fs.unlink(entry.filePath).catch(() => {});
    tempVideoStore.delete(id);
  }
  return res.json({ success: true });
});

// ─── Auto-publish: triggered on article publish ───────────────────────────────
// Reads channel config + article from Supabase, renders reel in background,
// posts to Instagram Reels and Facebook Reels. Returns immediately.
router.post("/reels/auto-publish", async (req, res) => {
  const { articleId } = req.body as { articleId?: string };
  if (!articleId) return res.status(400).json({ error: "articleId required" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase env vars not configured on server" });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: article } = await supabase
    .from("news_posts")
    .select("id, title, slug, category, excerpt, cover_image_url")
    .eq("id", articleId)
    .single();

  if (!article) return res.status(404).json({ error: "Article not found" });
  if (!article.cover_image_url) return res.status(400).json({ error: "Article has no cover image — reel requires an image" });

  const { data: channelRow } = await supabase
    .from("channel_settings")
    .select("settings")
    .eq("id", 1)
    .single();

  const settings = (channelRow?.settings ?? {}) as Record<string, unknown>;
  const igCfg = settings.instagram as { enabled?: boolean; igUserId?: string; accessToken?: string } | undefined;
  const fbCfg = settings.facebook as { enabled?: boolean; pageId?: string; accessToken?: string } | undefined;

  const igEnabled = !!(igCfg?.enabled && igCfg.igUserId && igCfg.accessToken);
  const fbEnabled = !!(fbCfg?.enabled && fbCfg.pageId && fbCfg.accessToken);

  if (!igEnabled && !fbEnabled) {
    return res.json({ success: false, message: "No Instagram or Facebook channel enabled — reel skipped" });
  }

  // Return immediately — rendering happens in the background
  res.json({ success: true, message: "Reel is being rendered and will be auto-posted to Facebook & Instagram" });

  // ── Background render + publish ──────────────────────────────────────────
  return void (async () => {
    try {
      const voiceoverScript = article.excerpt?.trim()
        ? `${article.title}.\n\n${article.excerpt}\n\nதிருச்சி இன்சைட் — உங்கள் உள்ளூர் செய்திகளுக்கு.`
        : `${article.title}.\n\nதிருச்சி இன்சைட் — உங்கள் உள்ளூர் செய்திகளுக்கு.`;

      const { videoPath, tmpDir } = await renderReel(
        article.cover_image_url!,
        voiceoverScript,
      );

      const videoId = crypto.randomUUID();
      tempVideoStore.set(videoId, { filePath: videoPath, created: Date.now() });
      const domain = (process.env.REPLIT_DOMAINS ?? "").split(",")[0].trim() || process.env.PUBLIC_API_URL || "localhost:8080";
      const publicVideoUrl = `https://${domain}/api/reels/temp/${videoId}`;
      console.info(`[auto-reel] publicVideoUrl=${publicVideoUrl}`);

      const caption = [
        article.title,
        article.excerpt ?? "",
        `#TrichyInsight #TamilNews #திருச்சி #Trichy #${article.category}`,
      ].filter(Boolean).join("\n\n");

      const results: Record<string, unknown> = {};

      // Instagram Reels
      if (igEnabled) {
        results.instagram = await publishInstagramReel(
          igCfg!.igUserId!,
          igCfg!.accessToken!,
          publicVideoUrl,
          caption,
        );
      }

      // Facebook Reels
      if (fbEnabled) {
        const description = [`📰 ${article.title}`, article.excerpt ?? "", "— Trichy Insight"].filter(Boolean).join("\n");

        // Step 1: Start upload session
        const startRes = await fetch(
          `https://graph.facebook.com/v21.0/${fbCfg!.pageId}/video_reels`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ upload_phase: "start", access_token: fbCfg!.accessToken }),
          },
        );
        const startJson = await startRes.json() as { video_id?: string; upload_url?: string; error?: { message: string } };
        console.info("[facebook-auto] start response:", JSON.stringify(startJson));

        if (startJson.video_id && startJson.upload_url) {
          // Step 2: Upload video binary
          const videoBuffer = await fs.readFile(videoPath);
          const uploadRes = await fetch(startJson.upload_url, {
            method: "POST",
            headers: {
              Authorization: `OAuth ${fbCfg!.accessToken}`,
              "Content-Type": "video/mp4",
              offset: "0",
              file_size: String(videoBuffer.length),
            },
            body: videoBuffer,
          });
          const uploadText = await uploadRes.text();
          console.info("[facebook-auto] upload response:", uploadRes.status, uploadText);

          if (!uploadRes.ok) {
            results.facebook = { success: false, error: `Facebook video upload failed (${uploadRes.status}): ${uploadText}` };
          } else {
            // Step 3: Finish and publish
            const finishRes = await fetch(
              `https://graph.facebook.com/v21.0/${fbCfg!.pageId}/video_reels`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  upload_phase: "finish",
                  video_id: startJson.video_id,
                  video_state: "PUBLISHED",
                  description,
                  access_token: fbCfg!.accessToken,
                }),
              },
            );
            const finishJson = await finishRes.json() as { success?: boolean; error?: { message: string } };
            console.info("[facebook-auto] finish response:", JSON.stringify(finishJson));
            results.facebook = finishJson.error
              ? { success: false, error: finishJson.error.message }
              : { success: true, postId: startJson.video_id };
          }
        } else {
          results.facebook = { success: false, error: startJson.error?.message ?? "Reel start failed" };
        }
      }

      console.info(`[auto-reel] article=${articleId} results=`, JSON.stringify(results));

      // Clean up temp file after Facebook/Instagram have had time to fetch it (5 min)
      setTimeout(() => {
        const entry = tempVideoStore.get(videoId);
        if (entry) {
          fs.unlink(entry.filePath).catch(() => {});
          tempVideoStore.delete(videoId);
        }
        fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }, 5 * 60 * 1000);
    } catch (err) {
      console.error(`[auto-reel] failed article=${articleId}:`, err instanceof Error ? err.message : err);
    }
  })();
});

// Ensure the Supabase Storage bucket exists when the module loads
ensureReelsBucket().catch(() => {});

export default router;
