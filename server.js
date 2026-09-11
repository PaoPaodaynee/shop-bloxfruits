const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const ADMIN_USER = "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "otopi123";
const ADMIN_SECRET_KEY = "otopi_bi_mat_2026";
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://autophobia011_db_user:YoPOL0EN3zmSvT1Z@cluster0.toio2qu.mongodb.net/shop_blox?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log(">>> [DATABASE]: KẾT NỐI THÀNH CÔNG!"))
    .catch(err => console.error(">>> [DATABASE LỖI]:", err.message));

// SCHEMAS
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: { type: String, default: "user" }
}));

const Account = mongoose.model('Account', new mongoose.Schema({
    id: { type: Number, required: true },
    title: String,
    level: String,
    fruit: String,
    melee: String,
    price: Number,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    sold: { type: Boolean, default: false },
    robloxUser: String,
    robloxPass: String
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    username: String,
    accId: Number,
    title: String,
    price: Number,
    robloxUser: String,
    robloxPass: String,
    boughtAt: { type: Date, default: Date.now }
}));

// SCHEMA LƯU THẺ CÀO KHÁCH NẠP
const Card = mongoose.model('Card', new mongoose.Schema({
    username: String,
    telco: String,
    declaredAmount: Number,
    realAmount: Number,
    code: String,
    serial: String,
    status: { type: String, default: "pending" }, // pending, success, failed
    createdAt: { type: Date, default: Date.now }
}));

// 1. ĐĂNG KÝ
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Vui lòng nhập đủ thông tin!" });

        const existUser = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (existUser) return res.status(400).json({ success: false, message: "Tài khoản này đã tồn tại!" });

        const newUser = await User.create({ username, password, balance: 100000 });
        res.json({ success: true, message: "Đăng ký thành công! Đã tặng bạn 100.000đ trải nghiệm.", user: newUser });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

// 2. ĐĂNG NHẬP
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = (username || "").trim().toLowerCase();
        const cleanPass = (password || "").trim();

        if (cleanUser === "admin" && (cleanPass === (ADMIN_PASS || "").trim() || cleanPass === "otopi123")) {
            return res.json({
                success: true,
                isAdmin: true,
                message: "Xin chào Sếp OTOPI! Đang bay sang trang Quản trị...",
                adminToken: ADMIN_SECRET_KEY,
                user: { username: "ADMIN", role: "admin", balance: 999999999 }
            });
        }

        const user = await User.findOne({ username: new RegExp('^' + cleanUser + '$', 'i'), password: cleanPass });
        if (!user) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });

        res.json({ success: true, isAdmin: false, message: "Đăng nhập thành công!", user });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

// API LẤY SỐ DƯ TỰ ĐỘNG
app.get('/api/user-balance', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json({ balance: 0 });
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        res.json({ balance: user ? user.balance : 0 });
    } catch (e) {
        res.json({ balance: 0 });
    }
});

// 3. LẤY ACC
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await Account.find({ sold: false }).select('id title level fruit melee price image');
        res.json(accounts);
    } catch (e) {
        res.status(500).json([]);
    }
});

// 4. MUA ACC
app.post('/api/buy', async (req, res) => {
    try {
        const { accountId, username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ success: false, message: "Vui lòng đăng nhập trước khi mua!" });

        const acc = await Account.findOne({ id: accountId });
        if (!acc || acc.sold) return res.status(400).json({ success: false, message: "Acc không tồn tại hoặc đã bán!" });
        if (user.balance < acc.price) return res.status(400).json({ success: false, message: "Số dư không đủ! Hãy nạp thêm tiền." });

        user.balance -= acc.price;
        await user.save();

        acc.sold = true;
        await acc.save();

        await Order.create({
            username: user.username,
            accId: acc.id,
            title: acc.title,
            price: acc.price,
            robloxUser: acc.robloxUser,
            robloxPass: acc.robloxPass
        });

        res.json({
            success: true,
            accountInfo: { username: acc.robloxUser, password: acc.robloxPass },
            newBalance: user.balance
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi mua acc: " + e.message });
    }
});

app.get('/api/my-orders', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json([]);
        const orders = await Order.find({ username }).sort({ boughtAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json([]);
    }
});

// 5. KHÁCH NẠP THẺ CÀO
app.post('/api/topup-card', async (req, res) => {
    try {
        const { username, telco, amount, code, serial } = req.body;
        if (!username || !telco || !amount || !code || !serial) {
            return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin thẻ cào!" });
        }

        // Tính số tiền thực nhận sau chiết khấu nhà mạng (thường nhận 80% giá trị thẻ)
        const declared = Number(amount);
        const received = Math.round(declared * 0.8); // Nhận 80%

        await Card.create({
            username,
            telco,
            declaredAmount: declared,
            realAmount: received,
            code: code.trim(),
            serial: serial.trim(),
            status: "pending"
        });

        res.json({
            success: true,
            message: `Gửi thẻ ${telco} ${declared.toLocaleString('vi-VN')}đ thành công! Thẻ đang được xử lý, bạn sẽ nhận được ${received.toLocaleString('vi-VN')}đ sau khi duyệt.`
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi gửi thẻ: " + e.message });
    }
});

// WEBHOOK SEPAY (BANK TỰ ĐỘNG)
app.post('/api/webhook/sepay', async (req, res) => {
    try {
        const data = req.body;
        const content = data.content || data.description || "";
        const amount = Number(data.transferAmount) || 0;
        const match = content.match(/OTOPI\s*([A-Za-z0-9_]+)/i);

        if (match && match[1] && amount > 0) {
            const targetUsername = match[1].trim();
            const user = await User.findOne({ username: new RegExp('^' + targetUsername + '$', 'i') });

            if (user) {
                user.balance += amount;
                await user.save();
                console.log(`>>> [TỰ ĐỘNG]: Đã cộng ${amount} đ cho ${user.username}!`);
                return res.json({ success: true, message: "Thành công" });
            }
        }
        res.json({ success: false });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// BẢO MẬT ADMIN
function checkAdminAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (token === ADMIN_SECRET_KEY) return next();
    return res.status(403).json({ success: false, message: "Không có quyền Admin!" });
}

// LẤY DANH SÁCH THẺ CÀO CHỜ DUYỆT
app.get('/api/admin/cards', checkAdminAuth, async (req, res) => {
    try {
        const cards = await Card.find().sort({ createdAt: -1 });
        res.json(cards);
    } catch (e) {
        res.status(500).json([]);
    }
});

// ADMIN XỬ LÝ THẺ (DUYỆT HOẶC HỦY)
app.post('/api/admin/card-action', checkAdminAuth, async (req, res) => {
    try {
        const { cardId, action } = req.body;
        const card = await Card.findById(cardId);
        if (!card || card.status !== 'pending') return res.status(400).json({ success: false, message: "Thẻ không hợp lệ hoặc đã xử lý rồi!" });

        if (action === 'approve') {
            const user = await User.findOne({ username: new RegExp('^' + card.username + '$', 'i') });
            if (user) {
                user.balance += card.realAmount;
                await user.save();
            }
            card.status = 'success';
            await card.save();
            return res.json({ success: true, message: `Đã duyệt thẻ và cộng ${card.realAmount.toLocaleString('vi-VN')}đ cho ${card.username}!` });
        } else {
            card.status = 'failed';
            await card.save();
            return res.json({ success: true, message: "Đã hủy thẻ sai!" });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.get('/api/admin/accounts', checkAdminAuth, async (req, res) => {
    try {
        const accounts = await Account.find().sort({ id: -1 });
        res.json(accounts);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/add', checkAdminAuth, async (req, res) => {
    try {
        const { title, level, fruit, melee, price, image, robloxUser, robloxPass } = req.body;
        const count = await Account.countDocuments();
        await Account.create({
            id: count + 1,
            title, level, fruit, melee,
            price: Number(price),
            image: image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
            sold: false,
            robloxUser, robloxPass
        });
        res.json({ success: true, message: "Đã đăng acc thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.post('/api/admin/add-bulk', checkAdminAuth, async (req, res) => {
    try {
        const { bulkText, title, price, level, fruit, melee, image } = req.body;
        if (!bulkText) return res.status(400).json({ success: false, message: "Chưa nhập danh sách!" });

        const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let count = await Account.countDocuments();
        const newAccounts = [];

        for (let line of lines) {
            const parts = line.includes('|') ? line.split('|') : line.split(':');
            const u = parts[0]?.trim();
            const p = parts[1]?.trim();
            if (u && p) {
                count++;
                newAccounts.push({
                    id: count,
                    title: title || `Acc Blox Fruits VIP #${count}`,
                    price: Number(price) || 50000,
                    level: level || "Max (2550)",
                    fruit: fruit || "Ngẫu Nhiên",
                    melee: melee || "Godhuman",
                    image: image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
                    robloxUser: u,
                    robloxPass: p,
                    sold: false
                });
            }
        }
        await Account.insertMany(newAccounts);
        res.json({ success: true, message: `Thành công! Đã thêm ${newAccounts.length} acc vào shop!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.delete('/api/admin/account/:id', checkAdminAuth, async (req, res) => {
    try {
        await Account.findOneAndDelete({ id: Number(req.params.id) });
        res.json({ success: true, message: "Đã xóa acc!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xóa!" });
    }
});

app.get('/api/admin/users', checkAdminAuth, async (req, res) => {
    try {
        const users = await User.find().select('username balance');
        res.json(users);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/adjust-balance', checkAdminAuth, async (req, res) => {
    try {
        const { username, amount } = req.body;
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });

        user.balance += Number(amount);
        await user.save();
        res.json({ success: true, message: `Đã cộng ${Number(amount).toLocaleString('vi-VN')} đ cho ${username}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
