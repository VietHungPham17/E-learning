const Notification = require("../models/Notification");

// GET /notifications?channelIds=id1,id2,...
const getNotifications = async (req, res) => {
  try {
    const { channelIds } = req.query;
    if (!channelIds) return res.json([]);

    const ids = channelIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);

    if (ids.length === 0) return res.json([]);

    const notifications = await Notification.find({ channelId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(notifications);
  } catch (error) {
    console.error("[GET NOTIFICATIONS ERROR]", error);
    res.status(500).json({ message: "Error fetching notifications" });
  }
};

module.exports = { getNotifications };
