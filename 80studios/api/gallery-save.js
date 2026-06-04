export default async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const gallery = req.body;

    if (!gallery) {

      return res.status(400).json({
        success: false,
        error: "No gallery data received"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Gallery received",
      gallery
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
