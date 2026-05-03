const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;

async function createAdmin() {
  const client = StreamChat.getInstance(api_key, api_secret);

  try {
    const { users } = await client.queryUsers(
      {},
      { created_at: -1 },
      { limit: 10 }
    );

    if (users.length === 0) {
      console.log(
        "Không có user nào trong hệ thống. Vui lòng đăng ký tài khoản trước."
      );
      return;
    }

    console.log("Danh sách users hiện có:");
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Username: ${user.name}`);
      console.log(`   Full Name: ${user.fullName}`);
      console.log(`   Role: ${user.role || "student"}`);
      console.log("");
    });

    const userId = users[0].id;

    console.log(`\nĐang cập nhật user ${userId} thành admin...`);

    await client.partialUpdateUser({
      id: userId,
      set: {
        role: "admin",
      },
    });

    console.log(`✓ User ${userId} đã được cập nhật thành admin!`);
    console.log("\nVui lòng đăng xuất và đăng nhập lại để áp dụng thay đổi.");
  } catch (error) {
    console.error("Lỗi:", error.message);
  }
}

createAdmin();
