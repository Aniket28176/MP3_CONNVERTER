const express = require("express");
const path = require("path");
const ytdlpExec = require("yt-dlp-exec"); // cross-platform import
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure public folder exists
const publicDir = path.join(__dirname, "public");
try {
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
} catch (err) {
  console.error("Error creating public directory:", err);
}

// Middleware
app.set("view engine", "ejs");
app.use(express.static(publicDir));
app.use(bodyParser.urlencoded({ extended: true }));

// Home page
app.get("/", (req, res) => {
  res.render("index", {
    success: null,
    message: "",
    song_title: "",
    song_link: "",
    format: ""
  });
});

// Convert route
app.post("/convert", async (req, res) => {
  const { videoID, format } = req.body;

  if (!videoID) {
    return res.render("index", {
      success: false,
      message: "Please enter a valid YouTube Video ID.",
      song_title: "",
      song_link: "",
      format: format || "webm"
    });
  }

  const fileFormat = format === "mp4" ? "mp4" : "webm";
  const url = `https://www.youtube.com/watch?v=${videoID}`;
  const filename = `${videoID}.${fileFormat}`;
  const outputPath = path.join(publicDir, filename);

  try {
    console.log(`Starting download: ${url} → ${filename}`);

    // Ensure callable function
    const ytdlp = ytdlpExec.default || ytdlpExec;

    // ✅ Render-ready: no executablePath, just update: true
    await ytdlp(url, {
      format: "bestaudio/best",
      output: outputPath,
      update: true // automatically downloads binary if missing
    });

    console.log(`Download finished: ${filename}`);
    return res.render("index", {
      success: true,
      song_title: videoID,
      song_link: `/${filename}`,
      format: fileFormat,
      message: ""
    });
  } catch (error) {
    console.error("Download error:", error);
    return res.render("index", {
      success: false,
      message: "Error downloading video. Make sure the Video ID is correct.",
      song_title: "",
      song_link: "",
      format: fileFormat
    });
  }
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));