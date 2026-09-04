require("dotenv").config();

const db = require("./db");

const { Bot } = require("node-telegram-bot-api");
const { run } = require("node-telegram-bot-api/node");

const {
    findMemberById,
    findMemberByTelegramId,
    linkTelegram,
    updateNotificationStatus
} = require("./db");

const bot = new Bot(process.env.BOT_TOKEN);

// ==============================
// รายชื่อ Admin จำลอง
// ==============================

const ADMIN_IDS = [
    8780666584
];

// ==============================
// สมาชิกที่กำลังลงทะเบียน
// ==============================

const registeringUsers = new Map();

// สมาชิกที่รอยืนยันการลงทะเบียน
const pendingMembers = new Map();

console.log("🤖 Telegram Bot is starting...");


// ==============================
// ข้อมูลสมาชิกจำลอง
// ==============================

const mockMembers = {

    "8001": {
        id: 8001,
        houseNumber: "12",
        ownerName: "1",
        role: "member",
        memberStartDate: "2026-09-01",
        memberExpireDate: "2027-09-01"
    },

    "8002": {
        id: 8002,
        houseNumber: "111111111111",
        ownerName: "11111111",
        role: "member",
        memberStartDate: "2026-09-01",
        memberExpireDate: "2027-09-01"
    },

    "8003": {
        id: 8003,
        houseNumber: "999test",
        ownerName: "test",
        role: "member",
        memberStartDate: "2026-08-01",
        memberExpireDate: "2027-08-01"
    }

};


// ==============================
// เมนูหลัก Member
// ==============================

function showMainMenu(ctx) {

    return ctx.reply(
        `
🤖 ระบบจัดการสมาชิก

👋 ยินดีต้อนรับเข้าสู่ระบบ

ระบบสำหรับจัดการสมาชิก
และแจ้งเตือนวันหมดอายุสมาชิก

กรุณาเลือกเมนูที่ต้องการ
        `,
        {
            reply_markup: {
                keyboard: [

                    [
                        { text: "📝 ลงทะเบียน Telegram" }
                    ],

                    [
                        { text: "👤 ข้อมูลของฉัน" },
                        { text: "📅 วันหมดอายุสมาชิก" }
                    ],

                    [
                        { text: "🔔 การแจ้งเตือน" },
                        { text: "ℹ️ เกี่ยวกับระบบ" }
                    ]

                ],

                resize_keyboard: true
            }
        }
    );

}


// ==============================
// /start
// ==============================

bot.command("start", (ctx) => {

    const userId = ctx.from.id;

    // ตรวจสอบว่าเป็น Admin หรือไม่
    if (ADMIN_IDS.includes(userId)) {

        return ctx.reply(
            `
🛠️ ระบบจัดการสมาชิก — Admin

👋 ยินดีต้อนรับผู้ดูแลระบบ

กรุณาเลือกเมนูที่ต้องการ
            `,
            {
                reply_markup: {
                    keyboard: [

                        [
                            { text: "👥 สมาชิกทั้งหมด" },
                            { text: "📅 สมาชิกใกล้หมดอายุ" }
                        ],

                        [
                            { text: "🔔 ส่งการแจ้งเตือน" },
                            { text: "📊 รายงานสมาชิก" }
                        ]

                    ],

                    resize_keyboard: true
                }
            }
        );

    } else {

        return showMainMenu(ctx);

    }

});


// ==============================
// 👤 ข้อมูลของฉัน
// ==============================

bot.hears("👤 ข้อมูลของฉัน", async (ctx) => {

    const telegramId = ctx.from.id;

    try {

        const member = await findMemberByTelegramId(telegramId);

        // ยังไม่ได้ลงทะเบียน
        if (!member) {

            return ctx.reply(`
⚠️ ยังไม่ได้ลงทะเบียน Telegram

กรุณากด

📝 ลงทะเบียน Telegram

เพื่อลงทะเบียนก่อนใช้งาน
            `);

        }

        return ctx.reply(`
👤 ข้อมูลสมาชิก

🆔 รหัสสมาชิก: ${member.id}

👤 ชื่อ: ${member.ownerName}

🏠 บ้านเลขที่: ${member.houseNumber}

🟢 สถานะ: ${member.role}

📅 วันที่เริ่มสมาชิก: ${member.memberStartDate}

📅 วันหมดอายุ: ${member.memberExpireDate}
        `);

    } catch (error) {

        console.error("❌ Error getting member information:");
        console.error(error);

        return ctx.reply(`
❌ ไม่สามารถดึงข้อมูลสมาชิกได้

กรุณาลองใหม่อีกครั้ง
        `);

    }

});


// ==============================
// 📅 วันหมดอายุสมาชิก
// ==============================

bot.hears("📅 วันหมดอายุสมาชิก", async (ctx) => {

    const telegramId = ctx.from.id;

    try {

        const member = await findMemberByTelegramId(telegramId);

        // ยังไม่ได้ลงทะเบียน
        if (!member) {

            return ctx.reply(`
⚠️ ยังไม่ได้ลงทะเบียน Telegram

กรุณากด

📝 ลงทะเบียน Telegram

เพื่อลงทะเบียนก่อนใช้งาน
            `);

        }

        // วันที่หมดอายุจาก TiDB
        const expireDate = new Date(member.memberExpireDate);

        // วันที่ปัจจุบัน
        const today = new Date();

        // ตัดเวลาออก เหลือเฉพาะวันที่
        today.setHours(0, 0, 0, 0);
        expireDate.setHours(0, 0, 0, 0);

        // คำนวณจำนวนวัน
        const diffTime = expireDate - today;
        const diffDays = Math.ceil(
            diffTime / (1000 * 60 * 60 * 24)
        );

        let status;
        let message;

        if (diffDays < 0) {

            status = "🔴 หมดอายุแล้ว";
            message = `หมดอายุมาแล้ว ${Math.abs(diffDays)} วัน`;

        } else if (diffDays === 0) {

            status = "🔴 หมดอายุวันนี้";
            message = "สมาชิกของคุณหมดอายุวันนี้";

        } else if (diffDays <= 30) {

            status = "🟡 ใกล้หมดอายุ";
            message = `เหลือเวลาอีก ${diffDays} วัน`;

        } else {

            status = "🟢 ยังไม่หมดอายุ";
            message = `เหลือเวลาอีก ${diffDays} วัน`;

        }

        // แปลงวันที่เป็น DD/MM/YYYY
        const formattedDate =
            expireDate.toLocaleDateString("th-TH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });

        return ctx.reply(`
📅 วันหมดอายุสมาชิก

👤 ชื่อ: ${member.ownerName}

🆔 รหัสสมาชิก: ${member.id}

🏠 บ้านเลขที่: ${member.houseNumber}

📅 วันหมดอายุ:
${formattedDate}

${status}

⏳ ${message}
        `);

    } catch (error) {

        console.error("❌ Error getting expiration date:");
        console.error(error);

        return ctx.reply(`
❌ ไม่สามารถตรวจสอบวันหมดอายุได้

กรุณาลองใหม่อีกครั้ง
        `);

    }

});

// ==============================
// 🔔 การแจ้งเตือน
// ==============================

bot.hears("🔔 การแจ้งเตือน", async (ctx) => {

    const telegramId = ctx.from.id;

    try {

        const member = await findMemberByTelegramId(telegramId);

        // ยังไม่ได้ลงทะเบียน
        if (!member) {

            return ctx.reply(`
⚠️ ยังไม่ได้ลงทะเบียน Telegram

กรุณากด

📝 ลงทะเบียน Telegram

เพื่อลงทะเบียนก่อนใช้งาน
            `);

        }

        console.log("========== NOTIFICATION DEBUG ==========");
        console.log("Telegram ID:", telegramId);
        console.log("Member:", member);
        console.log("notificationEnabled:", member.notificationEnabled);
        console.log("type:", typeof member.notificationEnabled);
        console.log("=========================================");

        const isEnabled =
            member.notificationEnabled === 1 ||
            member.notificationEnabled === true ||
            String(member.notificationEnabled) === "1";

        if (isEnabled) {

            return ctx.reply(`
🔔 การแจ้งเตือน

👤 สมาชิก: ${member.ownerName}

🟢 สถานะ: เปิดใช้งาน

ระบบจะแจ้งเตือนก่อนสมาชิกหมดอายุ

📢 ก่อนหมดอายุ 30 วัน
📢 ก่อนหมดอายุ 7 วัน
📢 ก่อนหมดอายุ 1 วัน
            `, {

                reply_markup: {

                    inline_keyboard: [
                        [
                            {
                                text: "🔕 ปิดการแจ้งเตือน",
                                callback_data: "notification_off"
                            }
                        ]
                    ]

                }

            });

        } else {

            return ctx.reply(`
🔔 การแจ้งเตือน

👤 สมาชิก: ${member.ownerName}

🔴 สถานะ: ปิดใช้งาน

ขณะนี้ระบบจะไม่ส่งการแจ้งเตือนวันหมดอายุ
            `, {

                reply_markup: {

                    inline_keyboard: [
                        [
                            {
                                text: "🔔 เปิดการแจ้งเตือน",
                                callback_data: "notification_on"
                            }
                        ]
                    ]

                }

            });

        }

    } catch (error) {

        console.error("❌ Error getting notification status:");
        console.error(error);

        return ctx.reply(`
❌ ไม่สามารถตรวจสอบสถานะการแจ้งเตือนได้
กรุณาลองใหม่อีกครั้ง
        `);

    }

});


// ==============================
// ℹ️ เกี่ยวกับระบบ
// ==============================

bot.hears("ℹ️ เกี่ยวกับระบบ", (ctx) => {

    return ctx.reply(`
ℹ️ เกี่ยวกับระบบ

🤖 ระบบจัดการสมาชิก

ระบบนี้ใช้สำหรับ

• ตรวจสอบข้อมูลสมาชิก
• ตรวจสอบวันหมดอายุ
• แจ้งเตือนสมาชิก
• จัดการข้อมูลสมาชิก

Version: 1.0.0
    `);

});


// ==============================
// ตรวจสอบ Telegram ID
// ==============================

bot.command("myid", (ctx) => {

    return ctx.reply(`
🆔 Telegram ID ของคุณ

${ctx.from.id}
    `);

});


// ==========================================================
// ADMIN
// ==========================================================


// ==============================
// 👥 สมาชิกทั้งหมด
// ==============================

bot.hears("👥 สมาชิกทั้งหมด", (ctx) => {

    return ctx.reply(`
👥 สมาชิกทั้งหมด

1. สมชาย ใจดี
   🆔 M001
   🟢 ปกติ

2. สมหญิง ใจดี
   🆔 M002
   🟢 ปกติ

3. มานะ ใจดี
   🆔 M003
   🟡 ใกล้หมดอายุ
    `);

});


// ==============================
// 📅 สมาชิกใกล้หมดอายุ
// ==============================

bot.hears("📅 สมาชิกใกล้หมดอายุ", (ctx) => {

    return ctx.reply(`
📅 สมาชิกใกล้หมดอายุ

🟡 สมหญิง ใจดี

วันหมดอายุ: 25/09/2026

เหลือ: 23 วัน


🟡 มานะ ใจดี

วันหมดอายุ: 20/09/2026

เหลือ: 18 วัน
    `);

});


// ==============================
// 🔔 ส่งการแจ้งเตือน
// ==============================

bot.hears("🔔 ส่งการแจ้งเตือน", (ctx) => {

    return ctx.reply(`
🔔 ส่งการแจ้งเตือน

📢 ระบบพร้อมส่งการแจ้งเตือน

สมาชิกที่ใกล้หมดอายุ:

2 คน

สามารถส่งการแจ้งเตือนได้ในขั้นตอนถัดไป
    `);

});


// ==============================
// 📊 รายงานสมาชิก
// ==============================

bot.hears("📊 รายงานสมาชิก", (ctx) => {

    return ctx.reply(`
📊 รายงานสมาชิก

👥 สมาชิกทั้งหมด: 3 คน

🟢 สมาชิกปกติ: 2 คน

🟡 ใกล้หมดอายุ: 1 คน

🔴 หมดอายุแล้ว: 0 คน
    `);

});


// ==========================================================
// MEMBER REGISTRATION
// ==========================================================


// ==============================
// 📝 ลงทะเบียน Telegram
// ==============================

bot.hears("📝 ลงทะเบียน Telegram", async (ctx) => {

    const telegramId = ctx.from.id;

    // ตรวจสอบก่อนว่า Telegram นี้ลงทะเบียนไว้แล้วหรือยัง
    const existingMember = await findMemberByTelegramId(telegramId);

    if (existingMember) {

        return ctx.reply(`
⚠️ Telegram นี้ลงทะเบียนไว้แล้ว

👤 ชื่อ: ${existingMember.ownerName}

🆔 รหัสสมาชิก: ${existingMember.id}

🏠 บ้านเลขที่: ${existingMember.houseNumber}

หากต้องการเปลี่ยนสมาชิก
กรุณาติดต่อผู้ดูแลระบบ
        `);

    }

    registeringUsers.set(telegramId, true);

    return ctx.reply(`
📝 ลงทะเบียน Telegram

กรุณากรอกรหัสสมาชิกของคุณ

ตัวอย่าง:

8001

💡 รหัสสมาชิกคือ ID ที่อยู่ในระบบสมาชิก
    `);

});


// ==============================
// รับรหัสสมาชิก
// ==============================

bot.on("message", async (ctx) => {

    const telegramId = ctx.from.id;

    // ป้องกันไม่ให้ปุ่มลงทะเบียนถูกนำไปค้นเป็นรหัสสมาชิก
    if (ctx.message?.text === "📝 ลงทะเบียน Telegram") {
        return;
    }

    // ถ้าไม่ได้อยู่ในขั้นตอนลงทะเบียน ไม่ต้องทำอะไร
    if (!registeringUsers.has(telegramId)) {
        return;
    }

    const memberId = ctx.message?.text?.trim();

    if (!memberId) {
        return;
    }

    try {

        // ==========================================
        // ค้นหาสมาชิกจาก TiDB
        // ==========================================

        const member = await findMemberById(memberId);

        // ไม่พบสมาชิก
        if (!member) {

            return ctx.reply(`
❌ ไม่พบข้อมูลสมาชิก

รหัสสมาชิก: ${memberId}

กรุณาตรวจสอบรหัสสมาชิกอีกครั้ง
            `);

        }

        // ==========================================
        // ตรวจสอบว่าสมาชิกนี้ผูก Telegram อื่นอยู่แล้วหรือยัง
        // ==========================================

        if (member.Telegram_ID) {

            return ctx.reply(`
⚠️ สมาชิกนี้ลงทะเบียน Telegram ไว้แล้ว

👤 ชื่อ: ${member.ownerName}

🆔 รหัสสมาชิก: ${member.id}

🏠 บ้านเลขที่: ${member.houseNumber}

หากเป็นเจ้าของบัญชี
กรุณาติดต่อผู้ดูแลระบบ
            `);

        }

        // ==========================================
        // เก็บข้อมูลรอยืนยัน
        // ==========================================

        pendingMembers.set(telegramId, member);

        return ctx.reply(`
🔎 พบข้อมูลสมาชิก

👤 ชื่อ: ${member.ownerName}

🆔 รหัสสมาชิก: ${member.id}

🏠 บ้านเลขที่: ${member.houseNumber}

🟢 สถานะ: ${member.role}

📅 วันที่เริ่มสมาชิก: ${member.memberStartDate}

📅 วันหมดอายุ: ${member.memberExpireDate}

กรุณาตรวจสอบข้อมูล
        `, {

            reply_markup: {

                inline_keyboard: [

                    [
                        {
                            text: "✅ ยืนยัน",
                            callback_data: "confirm_register"
                        },

                        {
                            text: "❌ ยกเลิก",
                            callback_data: "cancel_register"
                        }
                    ]

                ]

            }

        });

    } catch (error) {

        console.error("❌ Error finding member:");
        console.error(error);

        return ctx.reply(`
❌ เกิดข้อผิดพลาดในการค้นหาข้อมูล

กรุณาลองใหม่อีกครั้ง
        `);

    }

});

// ==============================
// ปุ่มต่าง ๆ
// ==============================

bot.on("callback_query", async (ctx) => {

    const telegramId = ctx.from.id;
    const action = ctx.callbackQuery.data;

    // ==========================================
    // ปิดการแจ้งเตือน
    // ==========================================

    if (action === "notification_off") {

        try {

            const result = await updateNotificationStatus(
                telegramId,
                false
            );

            console.log(
                "🔕 Notification OFF | Telegram ID:",
                telegramId,
                "| affectedRows:",
                result.affectedRows
            );

            // ตรวจสอบว่าอัปเดตสำเร็จจริง
            if (result.affectedRows === 0) {

                return ctx.answerCallbackQuery({
                    text: "ไม่พบสมาชิกของ Telegram นี้"
                });

            }

            // ดึงข้อมูลล่าสุดจาก TiDB
            const member = await findMemberByTelegramId(telegramId);

            if (!member) {

                return ctx.answerCallbackQuery({
                    text: "ไม่พบข้อมูลสมาชิก"
                });

            }

            await ctx.answerCallbackQuery({
                text: "ปิดการแจ้งเตือนแล้ว"
            });

            return ctx.reply(`
🔕 ปิดการแจ้งเตือนสำเร็จ

👤 สมาชิก: ${member.ownerName}

🔴 สถานะ: ปิดใช้งาน

ขณะนี้ระบบจะไม่ส่ง
การแจ้งเตือนวันหมดอายุ

หากต้องการเปิดอีกครั้ง
กดเมนู 🔔 การแจ้งเตือน
            `);

        } catch (error) {

            console.error("❌ Error turning notification off:");
            console.error(error);

            return ctx.answerCallbackQuery({
                text: "เกิดข้อผิดพลาด"
            });

        }

    }


    // ==========================================
    // เปิดการแจ้งเตือน
    // ==========================================

    if (action === "notification_on") {

        try {

            const result = await updateNotificationStatus(
                telegramId,
                true
            );

            console.log(
                "🔔 Notification ON | Telegram ID:",
                telegramId,
                "| affectedRows:",
                result.affectedRows
            );

            // ตรวจสอบว่าอัปเดตสำเร็จจริง
            if (result.affectedRows === 0) {

                return ctx.answerCallbackQuery({
                    text: "ไม่พบสมาชิกของ Telegram นี้"
                });

            }

            // ดึงข้อมูลล่าสุดจาก TiDB
            const member = await findMemberByTelegramId(telegramId);

            if (!member) {

                return ctx.answerCallbackQuery({
                    text: "ไม่พบข้อมูลสมาชิก"
                });

            }

            await ctx.answerCallbackQuery({
                text: "เปิดการแจ้งเตือนแล้ว"
            });

            return ctx.reply(`
🔔 เปิดการแจ้งเตือนสำเร็จ!

👤 สมาชิก: ${member.ownerName}

🟢 สถานะ: เปิดใช้งาน

ระบบจะแจ้งเตือนก่อนสมาชิกหมดอายุ

📢 ก่อนหมดอายุ 30 วัน
📢 ก่อนหมดอายุ 7 วัน
📢 ก่อนหมดอายุ 1 วัน
            `);

        } catch (error) {

            console.error("❌ Error turning notification on:");
            console.error(error);

            return ctx.answerCallbackQuery({
                text: "เกิดข้อผิดพลาด"
            });

        }

    }


    // ==========================================
    // ยืนยันการลงทะเบียน
    // ==========================================

    if (action === "confirm_register") {

        const member = pendingMembers.get(telegramId);

        if (!member) {

            return ctx.answerCallbackQuery({
                text: "ไม่พบข้อมูลการลงทะเบียน"
            });

        }

        try {

            await linkTelegram(member.id, telegramId);

            console.log("=================================");
            console.log("✅ Registration successful");
            console.log("Telegram ID:", telegramId);
            console.log("Member ID:", member.id);
            console.log("Owner:", member.ownerName);
            console.log("House:", member.houseNumber);
            console.log("=================================");

            registeringUsers.delete(telegramId);
            pendingMembers.delete(telegramId);

            await ctx.answerCallbackQuery({
                text: "ลงทะเบียนสำเร็จ!"
            });

            return ctx.reply(`
✅ ลงทะเบียนสำเร็จ!

👤 ชื่อ: ${member.ownerName}

🆔 รหัสสมาชิก: ${member.id}

🏠 บ้านเลขที่: ${member.houseNumber}

📅 วันหมดอายุ: ${member.memberExpireDate}

🎉 บัญชี Telegram ของคุณ
เชื่อมต่อกับข้อมูลสมาชิกเรียบร้อยแล้ว
            `);

        } catch (error) {

            console.error("❌ Error linking Telegram:");
            console.error(error);

            return ctx.answerCallbackQuery({
                text: "เกิดข้อผิดพลาดในการลงทะเบียน"
            });

        }

    }


    // ==========================================
    // ยกเลิก
    // ==========================================

    if (action === "cancel_register") {

        registeringUsers.delete(telegramId);
        pendingMembers.delete(telegramId);

        await ctx.answerCallbackQuery({
            text: "ยกเลิกการลงทะเบียนแล้ว"
        });

        return ctx.reply(`
❌ ยกเลิกการลงทะเบียนแล้ว

หากต้องการลงทะเบียนใหม่
กดปุ่ม

📝 ลงทะเบียน Telegram
        `);

    }

});

// ==============================
// เริ่ม Bot
// ==============================

run(bot);