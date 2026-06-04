// force vercel deploy

export default async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  console.log(
    "gallery-save called"
  );

  return res.status(200).json({
    success: true,
    message: "gallery-save endpoint online"
  });
}
