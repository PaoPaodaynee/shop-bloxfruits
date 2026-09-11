const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// LẤY MẬT KHẨU BÍ MẬT TỪ RENDER (KHÔNG LO LỘ TRÊN GITHUB)
const ADMIN_USER = "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "otopi123";
const ADMIN_SECRET_KEY = "otopi_bi_mat_2026";
const MONGO_URI = process.env.MONGO_URI;

// --- KẾT NỐI DATABASE MONGODB VĨNH VIỄN ---
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log(">>> [DATABASE]: ĐÃ KẾT NỐI MONGODB ATLAS THÀNH CÔNG! Dữ liệu từ nay lưu vĩnh viễn.");
        // Tạo sẵn 1 acc mẫu nếu database đang trống
        const count = await Account.countDocuments();
        if (count === 0) {
            await Account.create({
                id: 1,
                title: "Acc Max Level + Trái Kitsune Full Skill (Acc Mẫu)",
                level: "Max (2550)",
                fruit: "Kitsune",
                melee: "Godhuman",
                price: 50000,
                sold: false,
                robloxUser: "roblox_vip_01",
                robloxPass: "MatKhauVip123@"
            });
        }
    })
    .catch(err => console.error("Lỗi kết nối MongoDB:", err));

// --- TẠO KHUÔN DỮ LIỆU (DATABASE SCHEMAS) ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: { type: String, default: "user" },
    createdAt: { type: Date, default: Date.now }
}));

const Account = mongoose.model('Account', new mongoose.Schema({
    id: { type: Number, required: true },
    title: String,
    level: String,
    fruit: String,
    melee: String,
    price: Number,
    sold: { type: Boolean, default: false },
    robloxUser: String,
    robloxPass: String
}));

// --- CÁC ĐƯỜNG DẪN API ---

// 1. ĐĂNG KÝ (Lưu vào Database)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Thiếu thông tin!" });

        const existUser = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (existUser) return res.status(400).json({ success: false, message: "Tên tài khoản này đã có người đăng ký!" });

        // Tạo tài khoản mới, lưu vĩnh viễn vào MongoDB (tặng sẵn 100k trải nghiệm)
        const newUser = await User.create({ username, password, balance: 100000 });
        res.json({ success: true, message: "Đăng ký thành công! Đã tặng bạn 100.000đ trải nghiệm.", user: newUser });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
});

// 2. ĐĂNG NHẬP
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Nếu là nick Sếp
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            return res.json({
                success: true,
                isAdmin: true,
                message: "Xin chào Sếp OTOPI! Đang chuyển sang trang Quản trị...",
                adminToken: ADMIN_SECRET_KEY,
                user: { username: "ADMIN", role: "admin", balance: 999999999 }
            });
        }

        // Kiểm tra khách hàng trong Database
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i'), password });
        if (!user) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });

        res.json({ success: true, isAdmin: false, message: "Đăng nhập thành công!", user });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
});

// 3. LẤY DANH SÁCH ACC ĐANG BÁN CHO KHÁCH
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await Account.find({ sold: false }).select('id title level fruit melee price');
        res.json(accounts);
    } catch (e) {
        res.status(500).json([]);
    }
});

// 4. MUA ACC (Trừ tiền và lưu trạng thái vào Database)
app.post('/api/buy', async (req, res) => {
    try {
        const { accountId, username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ success: false, message: "Vui lòng đăng nhập trước khi mua!" });

        const acc = await Account.findOne({ id: accountId });
        if (!acc || acc.sold) return res.status(400).json({ success: false, message: "Acc không tồn tại hoặc đã bán!" });
        if (user.balance < acc.price) return res.status(400).json({ success: false, message: "Số dư không đủ! Hãy nạp thêm tiền." });

        // Trừ tiền và cập nhật trạng thái đã bán
        user.balance -= acc.price;
        await user.save();

        acc.sold = true;
        await acc.save();

        res.json({
            success: true,
            accountInfo: { username: acc.robloxUser, password: acc.robloxPass },
            newBalance: user.balance
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Giao dịch thất bại!" });
    }
});

// --- BẢO MẬT & API DÀNH RIÊNG CHO ADMIN ---
function checkAdminAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (token === ADMIN_SECRET_KEY) return next();
    return res.status(403).json({ success: false, message: "Không có quyền Admin!" });
}

// Lấy tất cả acc
app.get('/api/admin/accounts', checkAdminAuth, async (req, res) => {
    const accounts = await Account.find().sort({ id: -1 });
    res.json(accounts);
});

// Thêm acc mới vào Database
app.post('/api/admin/add', checkAdminAuth, async (req, res) => {
    try {
        const { title, level, fruit, melee, price, robloxUser, robloxPass } = req.body;
        const count = await Account.countDocuments();
        
        await Account.create({
            id: count + 1,
            title, level, fruit, melee,
            price: Number(price),
            sold: false,
            robloxUser, robloxPass
        });

        res.json({ success: true, message: "Đã lưu acc vĩnh viễn vào Database!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi lưu dữ liệu!" });
    }
});

// Lấy danh sách khách hàng trong Database
app.get('/api/admin/users', checkAdminAuth, async (req, res) => {
    const users = await User.find().select('username balance');
    res.json(users);
});

// Admin cộng tiền cho khách (Lưu vĩnh viễn vào Database)
app.post('/api/admin/adjust-balance', checkAdminAuth, async (req, res) => {
    try {
        const { username, amount } = req.body;
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });

        user.balance += Number(amount);
        await user.save();

        res.json({ success: true, message: `Đã cộng ${Number(amount).toLocaleString('vi-VN')} đ cho ${username} vào Database!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi cộng tiền!" });
    }
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
