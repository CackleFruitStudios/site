export default async function handler(request, response) {
  response.status(200).json({
    ok: true,
    message: "R2 presign endpoint is connected.",
    bucket: process.env.R2_BUCKET_NAME || null,
    hasAccountId: Boolean(process.env.R2_ACCOUNT_ID),
    hasAccessKey: Boolean(process.env.R2_ACCESS_KEY_ID),
    hasSecretKey: Boolean(process.env.R2_SECRET_ACCESS_KEY)
  });
}
