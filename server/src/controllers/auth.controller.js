import * as authService from "../services/auth.service.js";
import { refreshCookieOptions } from "../utils/cookies.js";

export async function signup(req, res, next) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        message: "Email, password and name are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const user = await authService.signup({
      email,
      password,
      name,
    });

    return res.status(201).json({
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await authService.login({
      email,
      password,
    });

    res.cookie(
      "refresh_token",
      result.refreshToken,
      refreshCookieOptions
    );

    return res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refresh_token;

    const result = await authService.refreshSession(rawRefreshToken);

    res.cookie(
      "refresh_token",
      result.refreshToken,
      refreshCookieOptions
    );

    return res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refresh_token;

    await authService.logout(rawRefreshToken);

    res.clearCookie("refresh_token", refreshCookieOptions);

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.id);

    return res.status(200).json({
      user,
    });
  } catch (error) {
    next(error);
  }
}
