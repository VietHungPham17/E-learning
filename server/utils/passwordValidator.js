/**
 * passwordValidator.js
 * Module kiểm tra độ phức tạp mật khẩu dùng chung toàn server.
 *
 * Chính sách mật khẩu:
 *  - Tối thiểu 8 ký tự
 *  - Ít nhất 1 chữ hoa (A-Z)
 *  - Ít nhất 1 chữ thường (a-z)
 *  - Ít nhất 1 chữ số (0-9)
 *  - Ít nhất 1 ký tự đặc biệt (!@#$%^&*...)
 */

const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: /[A-Z]/,
  requireLowercase: /[a-z]/,
  requireNumber: /[0-9]/,
  requireSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
};

/**
 * Kiểm tra mật khẩu có đủ điều kiện không.
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validatePassword = (password) => {
  const errors = [];

  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Mật khẩu không được để trống"] };
  }

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Mật khẩu phải có ít nhất ${PASSWORD_RULES.minLength} ký tự`);
  }
  if (!PASSWORD_RULES.requireUppercase.test(password)) {
    errors.push("Mật khẩu phải có ít nhất 1 chữ hoa (A-Z)");
  }
  if (!PASSWORD_RULES.requireLowercase.test(password)) {
    errors.push("Mật khẩu phải có ít nhất 1 chữ thường (a-z)");
  }
  if (!PASSWORD_RULES.requireNumber.test(password)) {
    errors.push("Mật khẩu phải có ít nhất 1 chữ số (0-9)");
  }
  if (!PASSWORD_RULES.requireSpecial.test(password)) {
    errors.push("Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...)");
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Express middleware — validate req.body.password (dùng cho signup).
 */
const validatePasswordMiddleware = (req, res, next) => {
  const { password } = req.body;
  const result = validatePassword(password);
  if (!result.valid) {
    return res.status(400).json({ message: result.errors[0], errors: result.errors });
  }
  next();
};

/**
 * Express middleware — validate req.body.newPassword (dùng cho changePassword / resetPassword).
 */
const validateNewPasswordMiddleware = (req, res, next) => {
  const { newPassword } = req.body;
  const result = validatePassword(newPassword);
  if (!result.valid) {
    return res.status(400).json({ message: result.errors[0], errors: result.errors });
  }
  next();
};

module.exports = {
  validatePassword,
  validatePasswordMiddleware,
  validateNewPasswordMiddleware,
};
