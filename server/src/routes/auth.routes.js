import { Router } from "express";

import {
  signup,
  login,
  refresh,
  logout,
  me,
} from "../controllers/auth.controller.js";

import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
