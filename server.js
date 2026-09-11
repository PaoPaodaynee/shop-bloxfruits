const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Danh sách người dùng của Shop (Mỗi người có tài khoản và số dư riêng)
// Mặc định tạo sẵn 1 nick admin (user: admin / pass: 123456)
let users = [
    { username: "admin", password: "123", balance: 500000 }
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

// --- 1. API ĐĂNG KÝ ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
    }
    const existUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existUser) {
        return res.status(400).json({ success: false, message: "Tên tài khoản này đã có người dùng!" });
    }

    // Tạo tài khoản mới, tặng sẵn 100k vào số dư để test mua hàng
    const newUser = { username, password, balance: 100000 };
    users.push(newUser);

    res.json({ success: true, message: "Đăng ký thành công! Đã tặng bạn 100.000đ trải nghiệm.", user: newUser });
});

// --- 2. API ĐĂNG NHẬP ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: "Sai tên tài khoản hoặc mật khẩu!" });
    }
    res.json({ success: true, message: "Đăng nhập thành công!", user });
});

// --- 3. API LẤY DANH SÁCH ACC ---
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

// --- 4. API MUA ACC (Đã gắn với tài khoản đang đăng nhập) ---
app.post('/api/buy', (req, res) => {
    const { accountId, username } = req.body;
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ success: false, message: "Bạn phải đăng nhập tài khoản trước khi mua!" });
    }

    const acc = accounts.find(a => a.id === accountId);
    if (!acc || acc.sold) {
        return res.status(400).json({ success: false, message: "Acc không tồn tại hoặc đã có người mua!" });
    }

    if (user.balance < acc.price) {
        return res.status(400).json({ success: false, message: "Số dư của bạn không đủ, vui lòng nạp thêm!" });
    }

    // Trừ tiền của đúng người này
    user.balance -= acc.price;
    acc.sold = true;

    res.json({
        success: true,
        accountInfo: { username: acc.robloxUser, password: acc.robloxPass },
        newBalance: user.balance
    });
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
