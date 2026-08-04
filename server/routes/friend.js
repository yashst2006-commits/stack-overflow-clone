import express from "express";

import {
  acceptRequest,
  countFriends,
  listFriends,
  rejectRequest,
  removeFriend,
  sendRequest,
} from "../controller/friend.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);
router.post("/request", sendRequest);
router.post("/accept", acceptRequest);
router.post("/reject", rejectRequest);
router.get("/list", listFriends);
router.delete("/remove/:friendId", removeFriend);
router.get("/count", countFriends);

export default router;
