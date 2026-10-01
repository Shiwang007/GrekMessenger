import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createDirectConversation,
  getConversation,
  listConversations,
} from "../controllers/conversation.controller.js";
import {
  createGroup,
  updateGroup,
  addMember,
  removeMember,
  changeMemberRole,
  transferOwnership,
  deleteGroup,
} from "../controllers/group.controller.js";

const router = Router();

// Static routes first
router.post("/direct", authenticate, createDirectConversation);
router.post("/groups", authenticate, createGroup);
router.get("/", authenticate, listConversations);

// Group membership and administration sub-routes
router.post("/:conversationId/members", authenticate, addMember);
router.delete("/:conversationId/members/:userId", authenticate, removeMember);
router.patch("/:conversationId/members/:userId/role", authenticate, changeMemberRole);
router.post("/:conversationId/transfer-ownership", authenticate, transferOwnership);

// Conversation instance routes
router.get("/:conversationId", authenticate, getConversation);
router.patch("/:conversationId", authenticate, updateGroup);
router.delete("/:conversationId", authenticate, deleteGroup);

export default router;
