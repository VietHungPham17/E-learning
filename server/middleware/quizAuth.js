// Thin re-export — mọi logic đều nằm trong rbac.js
const {
  authenticate,
  requireRole,
  requireTeacherOrAdmin,
  requireStudent,
} = require("./rbac");

module.exports = {
  authRequired:         authenticate,
  requireRole,
  requireAdminOrTeacher: requireTeacherOrAdmin,
  requireStudent,
};
