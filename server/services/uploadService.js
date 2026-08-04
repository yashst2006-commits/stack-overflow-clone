import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define upload folders
const uploadDir = path.join(__dirname, "..", "uploads");
const imagesDir = path.join(uploadDir, "images");
const videosDir = path.join(uploadDir, "videos");

// Create upload folders dynamically if they do not exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// Storage configuration - memoryStorage to upload directly to Cloudinary
const storage = multer.memoryStorage();

// File filter validation
const fileFilter = (req, file, cb) => {
  const allowedImageExts = /jpeg|jpg|png|webp/;
  const allowedVideoExts = /mp4|mov|webm/;

  const mimeType = file.mimetype;
  const extName = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "image") {
    const isValidMime = mimeType.startsWith("image/");
    const isValidExt = allowedImageExts.test(extName);
    if (isValidMime && isValidExt) {
      return cb(null, true);
    }
    return cb(new Error("Invalid image format. Supported formats: jpg, jpeg, png, webp"));
  } else if (file.fieldname === "video") {
    const isValidMime = mimeType.startsWith("video/") || mimeType === "video/quicktime";
    const isValidExt = allowedVideoExts.test(extName);
    if (isValidMime && isValidExt) {
      return cb(null, true);
    }
    return cb(new Error("Invalid video format. Supported formats: mp4, mov, webm"));
  } else {
    return cb(new Error("Unexpected field name"));
  }
};

// Initialize multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    // Total file size limit: 50MB (to allow video uploads)
    fileSize: 50 * 1024 * 1024,
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);
