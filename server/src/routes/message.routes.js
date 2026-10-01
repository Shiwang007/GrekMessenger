import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createMessage,
  listMessages,
} from "../controllers/message.controller.js";
import {
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
} from "../controllers/reaction.controller.js";

const router = Router();

router.post(
  "/:conversationId/messages",
  authenticate,
  createMessage
);

router.get(
  "/:conversationId/messages",
  authenticate,
  listMessages
);

router.patch(
  "/:conversationId/messages/:messageId",
  authenticate,
  editMessage
);

router.delete(
  "/:conversationId/messages/:messageId",
  authenticate,
  deleteMessage
);

router.post(
  "/:conversationId/messages/:messageId/reactions",
  authenticate,
  addReaction
);

router.delete(
  "/:conversationId/messages/:messageId/reactions/:emoji",
  authenticate,
  removeReaction
);

export default router;
