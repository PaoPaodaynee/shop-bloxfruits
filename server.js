const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "otopi123"
};
const ADMIN_SECRET_KEY = "otopi_bi_mat_2026";

// Danh sách tài khoản người dùng
let users = [
    { username: "khach_vip_01", password: "123", balance: 50000, role: "user" }
];

let accounts = [
    {
        id: 1,
        title: "Acc Max Level + Trái Kitsune Full Skill",
        level: "Max (2550)",
        fruit: "Kitsune",
        melee: "Godhuman",
        price: 50000,
        sold: false,
        robloxUser: "roblox_pro_99",
        robloxPass: "MatKhauVip123@"
    }
];

// 1. ĐĂNG KÝ
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Thiếu thông tin!" });
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ success: false, message: "Tên tài khoản này đã tồn tại!" });
    }
    const newUser = { username, password, balance: 0, role: "user" }; // Tạo mới số dư là 0đ
    users.push(newUser);
    res.json({ success: true, message: "Đăng ký tài khoản thành công!", user: newUser });
});

// 2. ĐĂNG NHẬP
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        return res.json({
            success: true,
            isAdmin: true,
            message: "Xin chào Sếp OTOPI! Đang chuyển sang trang Quản trị...",
            adminToken: ADMIN_SECRET_KEY,
            user: { username: "ADMIN", role: "admin", balance: 999999999 }
        });
    }

    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
    res.json({ success: true, isAdmin: false, message: "Đăng nhập thành công!", user });
});

app.get('/api/accounts', (req, res) => {
    const available = accounts.filter(a => !a.sold).map(a => ({
        id: a.id,
        title: a.title,
        level: a.level,
        fruit: a.fruit,
        melee: a.melee,
        price: a.price
    }));
    res.json(available);
});

app.post('/api/buy', (req, res) => {
    const { accountId, username } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ success: false, message: "Vui lòng đăng nhập trước khi mua!" });

    const acc = accounts.find(a => a.id === accountId);
    if (!acc || acc.sold) return res.status(400).json({ success: false, message: "Acc không tồn tại hoặc đã bán!" });
    if (user.balance < acc.price) return res.status(400).json({ success: false, message: "Số dư không đủ! Hãy nạp thêm tiền." });

    user.balance -= acc.price;
    acc.sold = true;

    res.json({
        success: true,
        accountInfo: { username: acc.robloxUser, password: acc.robloxPass },
        newBalance: user.balance
    });
});

// --- BẢO MẬT & CHỨC NĂNG DÀNH RIÊNG CHO ADMIN ---
function checkAdminAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (token === ADMIN_SECRET_KEY) return next();
    return res.status(403).json({ success: false, message: "Không có quyền Admin!" });
}

// Lấy danh sách acc
app.get('/api/admin/accounts', checkAdminAuth, (req, res) => {
    res.json(accounts);
});

// Thêm acc mới
app.post('/api/admin/add', checkAdminAuth, (req, res) => {
    const { title, level, fruit, melee, price, robloxUser, robloxPass } = req.body;
    accounts.push({
        id: accounts.length + 1,
        title, level, fruit, melee,
        price: Number(price),
        sold: false,
        robloxUser, robloxPass
    });
    res.json({ success: true, message: "Đã đăng acc lên shop thành công!" });
});

// 3. API ADMIN: LẤY DANH SÁCH TẤT CẢ NGƯỜI DÙNG TRÊN WEB
app.get('/api/admin/users', checkAdminAuth, (req, res) => {
    // Ẩn mật khẩu khi gửi về
    const safeUsers = users.map(u => ({ username: u.username, balance: u.balance }));
    res.json(safeUsers);
});

// 4. API ADMIN: CỘNG HOẶC TRỪ TIỀN CHO KHÁCH HÀNG
app.post('/api/admin/adjust-balance', checkAdminAuth, (req, res) => {
    const { username, amount } = req.body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản này!" });

    user.balance += Number(amount);
    res.json({ success: true, message: `Đã cộng ${Number(amount).toLocaleString('vi-VN')} đ cho ${username}!` });
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
