const express = require("express");
const path = require("path");
const ytdlpExec = require("yt-dlp-exec");
const ytdl = require("ytdl-core");
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

// Download using yt-dlp (primary method)
async function downloadWithYtDlp(url, outputPath, fileFormat) {
  return await ytdlpExec(url, {
    format: fileFormat === 'mp4' ? 'best[height<=720]' : 'bestaudio/best',
    output: outputPath,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true
  });
}

// Download using ytdl-core (fallback method)
function downloadWithYtdlCore(url, outputPath, fileFormat) {
  return new Promise((resolve, reject) => {
    const stream = ytdl(url, {
      filter: fileFormat === 'mp4' ? 'videoandaudio' : 'audioonly',
      quality: fileFormat === 'mp4' ? 'highest' : 'highestaudio',
    });
    
    stream.pipe(fs.createWriteStream(outputPath))
      .on('finish', resolve)
      .on('error', reject);
  });
}

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

  // Validate YouTube ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoID)) {
    return res.render("index", {
      success: false,
      message: "Invalid YouTube Video ID format.",
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

    // Try yt-dlp first, fallback to ytdl-core
    try {
      await downloadWithYtDlp(url, outputPath, fileFormat);
      console.log("Download completed with yt-dlp");
    } catch (ytdlpError) {
      console.log("yt-dlp failed, trying ytdl-core:", ytdlpError.message);
      await downloadWithYtdlCore(url, outputPath, fileFormat);
      console.log("Download completed with ytdl-core");
    }

    // Verify file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('Downloaded file not found');
    }

    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    console.log(`Download finished: ${filename} (${stats.size} bytes)`);
    
    return res.render("index", {
      success: true,
      song_title: videoID,
      song_link: `/${filename}`,
      format: fileFormat,
      message: ""
    });
  } catch (error) {
    console.error("Download error:", error);
    
    let errorMessage = "Error downloading video. Please check the Video ID and try again.";
    
    if (error.message.includes('Private video') || error.message.includes('Sign in')) {
      errorMessage = "This video is private or requires login.";
    } else if (error.message.includes('Not Found') || error.message.includes('unavailable')) {
      errorMessage = "Video not found. Please check the Video ID.";
    } else if (error.message.includes('too long')) {
      errorMessage = "Video is too long to process.";
    } else if (error.message.includes('Copyright')) {
      errorMessage = "This video cannot be downloaded due to copyright restrictions.";
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    platform: process.platform,
    node: process.version
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📁 Public directory: ${publicDir}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});