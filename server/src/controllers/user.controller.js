import * as userService from "../services/user.service.js";

export async function searchUsers(req, res, next) {
  try {
    const result = await userService.searchUsers({
      currentUserId: req.user.id,
      query: req.query.q,
      limit: req.query.limit,
      cursor: req.query.cursor,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "INVALID_CURSOR") {
      return res.status(400).json({
        error: {
          code: "INVALID_CURSOR",
          message: "Invalid search cursor.",
        },
      });
    }

    next(error);
  }
}

export async function getUserPresence(req, res, next) {
  try {
    const { userId } = req.params;
    const { getPresence } = await import("../presence/presenceService.js");
    const presence = await getPresence(userId);
    return res.status(200).json({ presence });
  } catch (error) {
    next(error);
  }
}

