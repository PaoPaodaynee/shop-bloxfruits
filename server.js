const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// MẬT KHẨU QUẢN TRỊ ADMIN (Bạn có thể đổi mật khẩu tại đây)
const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "otopi123" // Đổi mật khẩu admin tùy thích ở đây
};
const ADMIN_SECRET_KEY = "otopi_bi_mat_2026";

// Dữ liệu người dùng
let users = [];

// Dữ liệu tài khoản Roblox Blox Fruits
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
    },
    {
        id: 2,
        title: "Acc Blox Fruit + Trái Leopard + Song Kiếm Oden",
        level: "Max (2550)",
        fruit: "Leopard",
        melee: "Superhuman",
        price: 40000,
        sold: false,
        robloxUser: "blox_king_vn",
        robloxPass: "PassGame2024"
    }
];

// --- CÁC ĐƯỜNG DẪN KHÁCH HÀNG ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Thiếu thông tin!" });
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ success: false, message: "Tên tài khoản này đã có người đăng ký!" });
    }
    const newUser = { username, password, balance: 100000 };
    users.push(newUser);
    res.json({ success: true, message: "Đăng ký thành công! Đã tặng bạn 100.000đ trải nghiệm.", user: newUser });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
    res.json({ success: true, message: "Đăng nhập thành công!", user });
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
    if (user.balance < acc.price) return res.status(400).json({ success: false, message: "Số dư không đủ!" });

    user.balance -= acc.price;
    acc.sold = true;

    res.json({
        success: true,
        accountInfo: { username: acc.robloxUser, password: acc.robloxPass },
        newBalance: user.balance
    });
});

// --- HỆ THỐNG XÁC THỰC DÀNH RIÊNG CHO ADMIN ---

// 1. Kiểm tra đăng nhập Admin
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        return res.json({ success: true, adminToken: ADMIN_SECRET_KEY });
    }
    return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu Admin!" });
});

// Hàm kiểm tra quyền Admin để chống người ngoài hack
function checkAdminAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (token === ADMIN_SECRET_KEY) {
        return next();
    }
    return res.status(403).json({ success: false, message: "Bạn không có quyền truy cập khu vực này!" });
}

// 2. Lấy kho acc (Bắt buộc phải có quyền Admin mới xem được mật khẩu Roblox)
app.get('/api/admin/accounts', checkAdminAuth, (req, res) => {
    res.json(accounts);
});

// 3. Thêm acc mới vào kho
app.post('/api/admin/add', checkAdminAuth, (req, res) => {
    const { title, level, fruit, melee, price, robloxUser, robloxPass } = req.body;
    accounts.push({
        id: accounts.length + 1,
        title, level, fruit, melee,
        price: Number(price),
        sold: false,
        robloxUser, robloxPass
    });
    res.json({ success: true, message: "Đã thêm acc mới lên shop thành công!" });
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
