const mysql = require("mysql2/promise");

// ==========================================
// TiDB Connection
// ==========================================
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: {
        minVersion: "TLSv1.2"
    },

    waitForConnections: true,
    connectionLimit: 10
});


// ==========================================
// ค้นหาสมาชิกด้วย Member ID
// ==========================================
async function findMemberById(memberId) {

    const [rows] = await pool.query(
        `
        SELECT
            id,
            houseNumber,
            ownerName,
            role,
            memberStartDate,
            memberExpireDate,
            Telegram_ID,
            notificationEnabled
        FROM Users
        WHERE id = ?
        LIMIT 1
        `,
        [memberId]
    );

    return rows[0] || null;
}


// ==========================================
// ค้นหาสมาชิกด้วย Telegram ID
// ==========================================
async function findMemberByTelegramId(telegramId) {

    const [rows] = await pool.query(
        `
        SELECT
            id,
            houseNumber,
            ownerName,
            role,
            memberStartDate,
            memberExpireDate,
            Telegram_ID,
            notificationEnabled
        FROM Users
        WHERE Telegram_ID = ?
        LIMIT 1
        `,
        [telegramId]
    );

    return rows[0] || null;
}


// ==========================================
// เชื่อม Telegram ID กับสมาชิก
// ==========================================
async function linkTelegram(memberId, telegramId) {

    const [result] = await pool.query(
        `
        UPDATE Users
        SET Telegram_ID = ?
        WHERE id = ?
        `,
        [telegramId, memberId]
    );

    return result;
}


// ==========================================
// เปิด / ปิด การแจ้งเตือน
// ==========================================
async function updateNotificationStatus(telegramId, enabled) {

    const [result] = await pool.query(
        `
        UPDATE Users
        SET notificationEnabled = ?
        WHERE Telegram_ID = ?
        `,
        [enabled ? 1 : 0, telegramId]
    );

    return result;
}


// ==========================================
// Export Functions
// ==========================================
module.exports = {
    pool,
    findMemberById,
    findMemberByTelegramId,
    linkTelegram,
    updateNotificationStatus
};