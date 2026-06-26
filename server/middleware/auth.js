import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    const decodedata = jwt.verify(token, process.env.JWT_SECRET);

    if (!decodedata?.id) {
      console.warn("[auth] Token does not contain a user ID", {
        method: req.method,
        path: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    req.userid = String(decodedata.id);
    console.info("[auth] Authenticated request", {
      method: req.method,
      path: req.originalUrl,
      currentUser: req.userid,
    });
    next();
  } catch (error) {
    console.error("[auth] Authentication failed", {
      method: req.method,
      path: req.originalUrl,
      message: error.message,
    });
    return res.status(401).json({
      success: false,
      message: "You must be logged in",
    });
  }
};

export default auth;
