import crypto from "crypto";

function hmac(key, data) {
  return crypto
    .createHmac("sha256", key)
    .update(data)
    .digest();
}

function sha256(data) {
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex");
}

function encodeRfc3986(value) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, char =>
      "%" + char.charCodeAt(0).toString(16).toUpperCase()
    );
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac("AWS4" + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      filename,
      folder = "test-uploads",
      contentType = "application/octet-stream"
    } = request.body;

    if (!filename) {
      return response.status(400).json({
        ok: false,
        error: "Missing filename"
      });
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      return response.status(500).json({
        ok: false,
        error: "Missing R2 environment variables"
      });
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeFolder = folder
      .split("/")
      .map(part => part.replace(/[^a-zA-Z0-9._-]/g, "-"))
      .filter(Boolean)
      .join("/");

    const objectKey = `${safeFolder}/${Date.now()}-${safeFilename}`;

    const method = "PUT";
    const service = "s3";
    const region = "auto";
    const algorithm = "AWS4-HMAC-SHA256";
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}/${bucket}/${objectKey}`;

    const now = new Date();
    const amzDate = now
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, "");

    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${accessKeyId}/${credentialScope}`;

    const expires = 900;

    const canonicalUri = `/${bucket}/${objectKey}`
      .split("/")
      .map(part => encodeRfc3986(part))
      .join("/");

    const queryParams = {
      "X-Amz-Algorithm": algorithm,
      "X-Amz-Credential": credential,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expires),
      "X-Amz-SignedHeaders": "host"
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(key =>
        `${encodeRfc3986(key)}=${encodeRfc3986(queryParams[key])}`
      )
      .join("&");

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = "host";
    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join("\n");

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      sha256(canonicalRequest)
    ].join("\n");

    const signingKey = getSigningKey(
      secretAccessKey,
      dateStamp,
      region,
      service
    );

    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    const uploadUrl =
      `${endpoint}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    const publicUrl =
      `https://pub-6f2a633f65d94c21ac63975ce07c6c7c.r2.dev/${objectKey}`;

    return response.status(200).json({
      ok: true,
      method,
      objectKey,
      uploadUrl,
      publicUrl,
      contentType
    });

  } catch (error) {
    return response.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
