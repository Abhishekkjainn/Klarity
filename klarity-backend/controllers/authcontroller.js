// src/controllers/auth.controller.js
const authService = require('../services/authservice');
const AppError = require('../utils/AppError');

const signAndSendToken = (user, statusCode, res) => {
  const token = authService.generateToken(user.id);

  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true, // The cookie cannot be accessed by client-side JS
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    sameSite: 'lax',
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password_hash = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.register = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please provide email and password.', 400));
    }
    if (password.length < 8) {
        return next(new AppError('Password must be at least 8 characters long.', 400));
    }

    const newUser = await authService.register(email, password);
    signAndSendToken(newUser, 201, res);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please provide email and password.', 400));
    }

    const user = await authService.login(email, password);
    signAndSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000), // expire in 10 seconds
        httpOnly: true,
    });
    res.status(200).json({ status: 'success' });
};

// Controller for a protected route to get current user info
exports.getMe = async (req, res, next) => {
    // The user object is attached in the authMiddleware
    // We can add more logic here to fetch fresh user data if needed
    res.status(200).json({
        status: 'success',
        data: {
            user: req.user,
        },
    });
};