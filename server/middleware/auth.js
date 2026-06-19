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

    const token = authorization.split(" ")[1];
    let decodedata = jwt.verify(token, process.env.JWT_SECRET);
    req.userid = decodedata?.id;
    next();
  } catch (error) {
    console.error("Authentication failed:", error);
    return res.status(401).json({
      success: false,
      message: "You must be logged in",
    });
  }
};
export default auth
