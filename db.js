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
// ตรวจสอบ Generate Key
// ==========================================
async function verifyGenerateKey(generateKey, houseNumber) {

    const [rows] = await pool.query(
        `
        SELECT
            id,
            key_gen,
            state,
            houseNumber,
            timestamp
        FROM Generate_Keys
        WHERE key_gen = ?
            AND houseNumber = ?
            AND state = 'NON-ACTIVE'
        LIMIT 1
        `,
        [generateKey, houseNumber]
    );

    return rows[0] || null;
}

// ==========================================
// เปลี่ยนสถานะ Generate Key เป็นใช้งานแล้ว
// ==========================================
async function useGenerateKey(generateKey) {

    const [result] = await pool.query(
        `
        UPDATE Generate_Keys
        SET state = 'ACTIVE'
        WHERE key_gen = ?
            AND state = 'NON-ACTIVE'
        `,
        [generateKey]
    );

    return result;
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
// ค้นหาสมาชิกที่ต้องแจ้งเตือน
// 30 / 7 / 1 วันก่อนหมดอายุ
// ==========================================

async function findMembersForNotification() {

    const [rows] = await pool.query(
        `
        SELECT
            id,
            houseNumber,
            ownerName,
            memberExpireDate,
            Telegram_ID,
            notificationEnabled,

            DATEDIFF(
                DATE(memberExpireDate),
                CURDATE()
            ) AS daysRemaining

        FROM Users

        WHERE role = 'member'
        AND Telegram_ID IS NOT NULL
        AND notificationEnabled = 1
        AND memberExpireDate IS NOT NULL

        AND DATEDIFF(
                DATE(memberExpireDate),
                CURDATE()
                ) IN (30, 7, 1)
        `
    );

    return rows;
}

// ==========================================
// ดึงสมาชิกทั้งหมดสำหรับ Admin
// ==========================================
async function findAllMembers() {
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
        WHERE role = 'member'
        ORDER BY id
        `
    );

    return rows;
}

// ==========================================
// ค้นหาสมาชิกใกล้หมดอายุสำหรับ Admin
// ==========================================
async function findExpiringMembers() {

    const [rows] = await pool.query(
        `
        SELECT
            id,
            houseNumber,
            ownerName,
            memberStartDate,
            memberExpireDate,
            Telegram_ID,
            notificationEnabled,

            DATEDIFF(
                DATE(memberExpireDate),
                CURDATE()
            ) AS daysRemaining

        FROM Users

        WHERE role = 'member'
            AND memberExpireDate IS NOT NULL

            AND DATEDIFF(
                DATE(memberExpireDate),
                CURDATE()
                ) BETWEEN 1 AND 30

        ORDER BY memberExpireDate ASC
        `
    );

    return rows;
}

// ==========================================
// รายงานสมาชิกสำหรับ Admin
// ==========================================
async function getMemberReport() {

    const [rows] = await pool.query(
        `
        SELECT
            COUNT(*) AS totalMembers,

            SUM(
                CASE
                    WHEN memberExpireDate >= CURDATE()
                    THEN 1
                    ELSE 0
                END
            ) AS activeMembers,

            SUM(
                CASE
                    WHEN memberExpireDate < CURDATE()
                    THEN 1
                    ELSE 0
                END
            ) AS expiredMembers,

            SUM(
                CASE
                    WHEN memberExpireDate >= CURDATE()
                    AND DATEDIFF(
                            DATE(memberExpireDate),
                            CURDATE()
                        ) BETWEEN 0 AND 30
                    THEN 1
                    ELSE 0
                END
            ) AS expiringMembers,

            SUM(
                CASE
                    WHEN notificationEnabled = 1
                    THEN 1
                    ELSE 0
                END
            ) AS notificationOn,

            SUM(
                CASE
                    WHEN notificationEnabled = 0
                    THEN 1
                    ELSE 0
                END
            ) AS notificationOff

        FROM Users

        WHERE role = 'member'
        `
    );

    return rows[0];
}

// ==========================================
// Export Functions
// =========================================
module.exports = {
    pool,
    findMemberById,
    verifyGenerateKey,
    useGenerateKey,
    findMemberByTelegramId,
    linkTelegram,
    updateNotificationStatus,
    findMembersForNotification,
    findAllMembers,
    findExpiringMembers,
    getMemberReport
};