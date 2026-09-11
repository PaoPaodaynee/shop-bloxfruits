const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Tự động nhận diện giao diện dù nằm ở thư mục public hay nằm ở ngoài
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

let userBalance = 100000;

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

// Đường dẫn trang chủ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    });
});

app.get('/api/user', (req, res) => {
    res.json({ balance: userBalance });
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

app.get('/api/admin/accounts', (req, res) => {
    res.json(accounts);
});

app.post('/api/admin/add', (req, res) => {
    const { title, level, fruit, melee, price, robloxUser, robloxPass } = req.body;
    accounts.push({
        id: accounts.length + 1,
        title, level, fruit, melee,
        price: Number(price),
        sold: false,
        robloxUser, robloxPass
    });
    res.json({ success: true, message: "Thành công!" });
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
