require("dotenv").config();

const fs = require("fs");
const axios = require("axios");
const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { igdl } = require("ruhend-scraper");

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 requests
  message: { error: "Too many requests. Try again later." },
});

app.use("/download", limiter);

// Function to download the file from URL
const downloadFile = async (fileUrl, outputLocationPath) => {
  const writer = fs.createWriteStream(outputLocationPath);
  const response = await axios({
    url: fileUrl,
    method: "GET",
    responseType: "stream",
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

// Endpoint to fetch, download, and send media
app.post("/download", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Instagram URL is required." });
    }

    console.log("Fetching media for URL:", url);
    const result = await igdl(url);
    let data = result.data;

    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ error: "Media not found or download failed." });
    }

    const mediaUrl = data[0].url; // Extract media URL
    const fileExtension = mediaUrl.includes(".mp4") ? "mp4" : "jpg"; // Check file type
    const fileName = `downloaded_media_${Date.now()}.${fileExtension}`;
    const filePath = path.join(__dirname, "downloads", fileName);

    console.log("Downloading media...");
    await downloadFile(mediaUrl, filePath);
    console.log("Download complete:", filePath);

    res.json({
      message: "Download successful!",
      mediaUrl,
      downloadPath: `http://localhost:5000/downloads/${fileName}`,
    });

    // Optional: Auto-delete file after some time
    setTimeout(() => fs.unlinkSync(filePath), 60000); // Deletes file after 60 seconds
  } catch (error) {
    console.error("Error downloading media:", error.message);
    res
      .status(500)
      .json({ error: "Failed to process request. Try again later." });
  }
});

// Serve downloaded files
app.use("/downloads", express.static(path.join(__dirname, "downloads")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
