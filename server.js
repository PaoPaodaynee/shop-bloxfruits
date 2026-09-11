const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

let userBalance = 100000;

// Danh sách các tài khoản Blox Fruits
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

// --- CÁC ĐƯỜNG DẪN DÀNH CHO KHÁCH HÀNG ---
app.get('/api/user', (req, res) => {
    res.json({ balance: userBalance });
});

app.get('/api/accounts', (req, res) => {
    // Chỉ lấy acc CHƯA BÁN cho khách xem
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
    const { accountId } = req.body;
    const acc = accounts.find(a => a.id === accountId);

    if (!acc || acc.sold) return res.status(400).json({ success: false, message: "Acc không tồn tại hoặc đã bán!" });
    if (userBalance < acc.price) return res.status(400).json({ success: false, message: "Số dư không đủ!" });

    userBalance -= acc.price;
    acc.sold = true;

    res.json({
        success: true,
        accountInfo: { username: acc.robloxUser, password: acc.robloxPass },
        newBalance: userBalance
    });
});

// --- CÁC ĐƯỜNG DẪN DÀNH RIÊNG CHO TRANG ADMIN ---

// Lấy TẤT CẢ acc (kể cả acc đã bán để Admin quản lý)
app.get('/api/admin/accounts', (req, res) => {
    res.json(accounts);
});

// Thêm Acc Mới
app.post('/api/admin/add', (req, res) => {
    const { title, level, fruit, melee, price, robloxUser, robloxPass } = req.body;
    
    const newAcc = {
        id: accounts.length + 1,
        title,
        level,
        fruit,
        melee,
        price: Number(price),
        sold: false,
        robloxUser,
        robloxPass
    };

    accounts.push(newAcc);
    res.json({ success: true, message: "Thêm tài khoản thành công!" });
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai: http://localhost:${PORT}`);
});