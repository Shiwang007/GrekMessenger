import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { searchUsers, getUserPresence } from "../controllers/user.controller.js";

const router = Router();

router.get("/search", authenticate, searchUsers);
router.get("/:userId/presence", authenticate, getUserPresence);

export default router;
