import crypto from "crypto";

export default async function handler(request, response) {

  if (request.method !== "POST") {

    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {

      filename,
      folder = "test-uploads"

    } = request.body;

    if (!filename) {

      return response.status(400).json({
        error: "Missing filename"
      });
    }

    const accountId =
      process.env.R2_ACCOUNT_ID;

    const bucket =
      process.env.R2_BUCKET_NAME;

    const objectKey =
      `${folder}/${Date.now()}-${filename}`;

    const uploadUrl =
      `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${objectKey}`;

    return response.status(200).json({

      ok: true,

      objectKey,

      uploadUrl,

      publicUrl:
        `https://pub-6f2a633f65d94c21ac63975ce07c6c7c.r2.dev/${objectKey}`

    });

  } catch (error) {

    return response.status(500).json({

      ok: false,

      error: error.message
    });
  }
}
