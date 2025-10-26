const express = require("express");
const path = require("path");
const ytdlpExec = require("yt-dlp-exec");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure public folder exists
const publicDir = path.join(__dirname, "public");
try {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
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

    // Configure yt-dlp for Render.com environment
    await ytdlpExec(url, {
      format: fileFormat === 'mp4' ? 'best[height<=720]' : 'bestaudio/best',
      output: outputPath,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:googlebot'
      ]
    });

    console.log(`Download finished: ${filename}`);
    
    // Check if file was actually created
    if (!fs.existsSync(outputPath)) {
      throw new Error('Downloaded file not found');
    }

    return res.render("index", {
      success: true,
      song_title: videoID,
      song_link: `/${filename}`,
      format: fileFormat,
      message: ""
    });
  } catch (error) {
    console.error("Download error:", error);
    
    let errorMessage = "Error downloading video. Make sure the Video ID is correct.";
    
    if (error.message.includes('Private video') || error.message.includes('Sign in')) {
      errorMessage = "This video is private or requires login.";
    } else if (error.message.includes('Not Found') || error.message.includes('unavailable')) {
      errorMessage = "Video not found. Please check the Video ID.";
    } else if (error.message.includes('too long')) {
      errorMessage = "Video is too long to process.";
    }

    return res.render("index", {
      success: false,
      message: errorMessage,
      song_title: "",
      song_link: "",
      format: fileFormat
    });
  }
});

// File cleanup endpoint (optional) to prevent storage filling up
app.post("/cleanup", (req, res) => {
  try {
    const files = fs.readdirSync(publicDir);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    files.forEach(file => {
      if (file.endsWith('.webm') || file.endsWith('.mp4')) {
        const filePath = path.join(publicDir, file);
        const stats = fs.statSync(filePath);
        
        // Delete files older than 1 hour
        if (now - stats.mtime.getTime() > oneHour) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old file: ${file}`);
        }
      }
    });
    
    res.json({ success: true, message: "Cleanup completed" });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.json({ success: false, message: "Cleanup failed" });
  }
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📁 Public directory: ${publicDir}`);
});