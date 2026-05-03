// Thin re-export — mọi logic đều nằm trong rbac.js
const {
  authenticate,
  requireAdmin,
  requireTeacherOrAdmin,
  requireRole,
} = require("./rbac");

module.exports = {
  authenticateToken:     authenticate,
  requireAdmin,
  requireTeacherOrAdmin,
  requireRole,
};
