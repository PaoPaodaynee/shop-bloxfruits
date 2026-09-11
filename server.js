const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const ADMIN_USER = "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "otopi123";
const ADMIN_SECRET_KEY = "otopi_bi_mat_2026";
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://autophobia011_db_user:YoPOL0EN3zmSvT1Z@cluster0.toio2qu.mongodb.net/shop_blox?retryWrites=true&w=majority&appName=Cluster0";

const GTF_PARTNER_ID = process.env.GTF_PARTNER_ID || "3314076622";
const GTF_PARTNER_KEY = process.env.GTF_PARTNER_KEY || "";

// ==========================================
// 1. TẤT CẢ SCHEMAS & MODELS ĐẶT TRÊN ĐẦU
// ==========================================
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: { type: String, default: "user" }
}));

// SCHEMA DANH MỤC ACC (MỚI)
const Category = mongoose.model('Category', new mongoose.Schema({
    id: { type: Number, required: true },
    name: { type: String, required: true },
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    createdAt: { type: Date, default: Date.now }
}));

// SCHEMA ACC (CÓ THÊM TRƯỜNG CATEGORY)
const Account = mongoose.model('Account', new mongoose.Schema({
    id: { type: Number, required: true },
    category: { type: String, default: "Acc Blox Fruits VIP" }, // Tên danh mục của acc
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

const Card = mongoose.model('Card', new mongoose.Schema({
    requestId: String,
    username: String,
    telco: String,
    declaredAmount: Number,
    realAmount: Number,
    code: String,
    serial: String,
    status: { type: String, default: "pending" },
    message: String,
    createdAt: { type: Date, default: Date.now }
}));

const Deposit = mongoose.model('Deposit', new mongoose.Schema({
    username: String,
    amount: Number,
    method: String,
    createdAt: { type: Date, default: Date.now }
}));

const BoostService = mongoose.model('BoostService', new mongoose.Schema({
    id: { type: Number, required: true },
    name: String,
    price: Number,
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    active: { type: Boolean, default: true }
}));

const BoostOrder = mongoose.model('BoostOrder', new mongoose.Schema({
    id: { type: Number, required: true },
    username: String,
    serviceName: String,
    price: Number,
    robloxUser: String,
    robloxPass: String,
    note: String,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
}));

// ==========================================
// 2. KẾT NỐI DATABASE & TẠO DANH MỤC MẪU
// ==========================================
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log(">>> [DATABASE]: BẢO MẬT & KẾT NỐI THÀNH CÔNG!");
        try {
            // Tạo 3 danh mục mẫu nếu chưa có
            const catCount = await Category.countDocuments();
            if (catCount === 0) {
                await Category.create([
                    { id: 1, name: "Acc Blox Fruits Giá Rẻ (Học Sinh)", description: "Các tài khoản giá mềm từ 20k - 50k", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
                    { id: 2, name: "Acc Max Level + Godhuman", description: "Tài khoản max cấp độ 2550 kèm full võ vip", image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80" },
                    { id: 3, name: "Acc VIP Kitsune / Mochi V2", description: "Tài khoản sở hữu các trái ác quỷ hot nhất", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80" }
                ]);
            }

            const boostCount = await BoostService.countDocuments();
            if (boostCount === 0) {
                await BoostService.create([
                    { id: 1, name: "Cày Level 1 -> Max Level (2550)", price: 50000, description: "Cày siêu tốc 24h, bảo đảm an toàn 100%", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
                    { id: 2, name: "Lấy Melee Godhuman (Full nguyên liệu)", price: 70000, description: "Yêu cầu đủ 5M Beli & 5K Fragments", image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80" },
                    { id: 3, name: "Lấy Song Kiếm Oden (CDK)", price: 60000, description: "Yêu cầu có Yama và Tushita 350 mastery", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80" },
                    { id: 4, name: "Săn 2.5 Triệu Bounty (Bật PvP)", price: 40000, description: "Hoàn thành trong ngày, không tụt rank", image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80" }
                ]);
            }
        } catch (seedErr) {}
    })
    .catch(err => console.error(">>> [DATABASE LỖI]:", err.message));

// ==========================================
// 3. API ĐĂNG KÝ / ĐĂNG NHẬP / SỐ DƯ
// ==========================================
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Vui lòng nhập đủ thông tin!" });

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({ success: false, message: "Tên tài khoản từ 3-20 ký tự, không chứa dấu và ký tự lạ!" });
        }

        const existUser = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (existUser) return res.status(400).json({ success: false, message: "Tài khoản này đã tồn tại!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({ username, password: hashedPassword, balance: 0 });
        res.json({ success: true, message: "Đăng ký tài khoản thành công!", user: { username: newUser.username, balance: newUser.balance } });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

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

        const user = await User.findOne({ username: new RegExp('^' + cleanUser + '$', 'i') });
        if (!user) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });

        let isMatch = false;
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            isMatch = await bcrypt.compare(cleanPass, user.password);
        } else {
            isMatch = (user.password === cleanPass);
        }

        if (!isMatch) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });

        res.json({ success: true, isAdmin: false, message: "Đăng nhập thành công!", user: { username: user.username, balance: user.balance } });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

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

app.get('/api/top-deposits', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const top = await Deposit.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: "$username", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } },
            { $limit: 10 }
        ]);

        const result = top.map((t, idx) => ({
            rank: idx + 1,
            username: t._id,
            total: t.total
        }));

        res.json(result);
    } catch (e) {
        res.status(500).json([]);
    }
});

// ==========================================
// 4. API DANH MỤC & MUA BÁN ACC
// ==========================================

// Lấy danh sách danh mục cho khách xem
app.get('/api/categories', async (req, res) => {
    try {
        const cats = await Category.find().sort({ id: 1 });
        res.json(cats);
    } catch (e) {
        res.status(500).json([]);
    }
});

// Lấy danh sách acc (hỗ trợ lọc theo danh mục)
app.get('/api/accounts', async (req, res) => {
    try {
        const { category } = req.query;
        let query = { sold: false };
        if (category && category !== 'all') {
            query.category = category;
        }

        const accounts = await Account.find(query).select('id category title level fruit melee price image');
        res.json(accounts);
    } catch (e) {
        res.status(500).json([]);
    }
});

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

// ==========================================
// 5. API CÀY THUÊ CHO KHÁCH
// ==========================================
app.get('/api/boost-services', async (req, res) => {
    try {
        const services = await BoostService.find({ active: true }).sort({ id: 1 });
        res.json(services);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/boost-order', async (req, res) => {
    try {
        const { username, serviceId, robloxUser, robloxPass, note } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ success: false, message: "Vui lòng đăng nhập trước khi đặt cày!" });

        const service = await BoostService.findOne({ id: Number(serviceId), active: true });
        if (!service) return res.status(400).json({ success: false, message: "Gói cày thuê không tồn tại!" });

        if (!robloxUser || !robloxPass) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập tài khoản và mật khẩu Roblox để shop cày!" });
        }

        if (user.balance < service.price) {
            return res.status(400).json({ success: false, message: "Số dư không đủ! Vui lòng nạp thêm tiền." });
        }

        user.balance -= service.price;
        await user.save();

        const count = await BoostOrder.countDocuments();
        const newOrder = await BoostOrder.create({
            id: count + 1,
            username: user.username,
            serviceName: service.name,
            price: service.price,
            robloxUser: robloxUser.trim(),
            robloxPass: robloxPass.trim(),
            note: note ? note.trim() : "",
            status: "pending"
        });

        res.json({
            success: true,
            message: `Đặt cày gói "${service.name}" thành công! Shop sẽ sớm tiến hành cày.`,
            newBalance: user.balance,
            order: newOrder
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi đặt cày: " + e.message });
    }
});

app.get('/api/my-boost-orders', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json([]);
        const orders = await BoostOrder.find({ username }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json([]);
    }
});

// ==========================================
// 6. NẠP THẺ & WEBHOOKS
// ==========================================
app.post('/api/topup-card', async (req, res) => {
    try {
        const { username, telco, amount, code, serial } = req.body;
        if (!username || !telco || !amount || !code || !serial) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
        }

        const cleanCode = code.trim();
        const cleanSerial = serial.trim();
        const declared = Number(amount);
        const requestId = Date.now().toString() + Math.floor(Math.random() * 1000);

        const sign = crypto.createHash('md5')
            .update(GTF_PARTNER_KEY + cleanCode + cleanSerial)
            .digest('hex');

        await Card.create({
            requestId,
            username,
            telco: telco.toUpperCase(),
            declaredAmount: declared,
            realAmount: Math.round(declared * 0.8),
            code: cleanCode,
            serial: cleanSerial,
            status: "pending",
            message: "Đang xử lý..."
        });

        try {
            await fetch('https://gachthefast.com/chargingws/v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telco: telco.toUpperCase(),
                    code: cleanCode,
                    serial: cleanSerial,
                    amount: declared,
                    request_id: requestId,
                    partner_id: GTF_PARTNER_ID,
                    sign: sign,
                    command: 'charging'
                })
            });
        } catch (apiErr) {}

        res.json({
            success: true,
            message: "Thẻ đã được gửi lên hệ thống! Vui lòng chờ 5-30 giây để tự động cộng tiền."
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi gửi thẻ: " + e.message });
    }
});

app.all('/api/webhook/gachthefast', async (req, res) => {
    try {
        const data = req.method === 'POST' ? req.body : req.query;
        const status = Number(data.status);
        const requestId = data.request_id;
        const realAmount = Number(data.amount) || Number(data.value) || 0;

        let card = await Card.findOne({ requestId });
        if (!card && data.code && data.serial) {
            card = await Card.findOne({ code: data.code, serial: data.serial });
        }

        if (!card || card.status === 'success') {
            return res.status(200).send("OK");
        }

        if (status === 1 || status === 3) {
            const user = await User.findOne({ username: new RegExp('^' + card.username + '$', 'i') });
            const amountToAdd = realAmount > 0 ? realAmount : Math.round(card.declaredAmount * 0.8);

            if (user) {
                user.balance += amountToAdd;
                await user.save();

                await Deposit.create({
                    username: user.username,
                    amount: amountToAdd,
                    method: "card"
                });
            }

            card.status = 'success';
            card.realAmount = amountToAdd;
            card.message = "Nạp thẻ thành công!";
            await card.save();
        } else if (status === 2 || status === 4) {
            card.status = 'failed';
            card.message = data.message || "Thẻ sai!";
            await card.save();
        }

        return res.status(200).send("OK");
    } catch (e) {
        res.status(500).send("Error");
    }
});

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

                await Deposit.create({
                    username: user.username,
                    amount: amount,
                    method: "bank"
                });

                return res.json({ success: true });
            }
        }
        res.json({ success: false });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// ==========================================
// 7. ADMIN ROUTES
// ==========================================
function checkAdminAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (token === ADMIN_SECRET_KEY) return next();
    return res.status(403).json({ success: false, message: "Không có quyền Admin!" });
}

// QUẢN LÝ DANH MỤC TRONG ADMIN
app.get('/api/admin/categories', checkAdminAuth, async (req, res) => {
    try {
        const cats = await Category.find().sort({ id: 1 });
        res.json(cats);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/category/add', checkAdminAuth, async (req, res) => {
    try {
        const { name, description, image } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Tên mục không được để trống!" });

        const count = await Category.countDocuments();
        await Category.create({
            id: count + 1,
            name: name.trim(),
            description: description || "",
            image: image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80"
        });
        res.json({ success: true, message: "Đã tạo mục mới thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tạo mục: " + e.message });
    }
});

app.delete('/api/admin/category/:id', checkAdminAuth, async (req, res) => {
    try {
        await Category.findOneAndDelete({ id: Number(req.params.id) });
        res.json({ success: true, message: "Đã xóa mục!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xóa mục!" });
    }
});

// QUẢN LÝ KHO ACC & BULK ADD
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
        const { category, title, level, fruit, melee, price, image, robloxUser, robloxPass } = req.body;
        const count = await Account.countDocuments();
        await Account.create({
            id: count + 1,
            category: category || "Acc Blox Fruits VIP",
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
        const { category, bulkText, title, price, level, fruit, melee, image } = req.body;
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
                    category: category || "Acc Blox Fruits VIP",
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

// CÀY THUÊ ADMIN
app.get('/api/admin/boost-services', checkAdminAuth, async (req, res) => {
    try {
        const services = await BoostService.find().sort({ id: 1 });
        res.json(services);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/boost-service/add', checkAdminAuth, async (req, res) => {
    try {
        const { name, price, description, image } = req.body;
        const count = await BoostService.countDocuments();
        await BoostService.create({
            id: count + 1,
            name,
            price: Number(price),
            description: description || "",
            image: image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
            active: true
        });
        res.json({ success: true, message: "Đã tạo gói cày thuê mới!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tạo gói cày!" });
    }
});

app.delete('/api/admin/boost-service/:id', checkAdminAuth, async (req, res) => {
    try {
        await BoostService.findOneAndDelete({ id: Number(req.params.id) });
        res.json({ success: true, message: "Đã xóa gói cày thuê!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xóa gói cày!" });
    }
});

app.get('/api/admin/boost-orders', checkAdminAuth, async (req, res) => {
    try {
        const orders = await BoostOrder.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/boost-order/status', checkAdminAuth, async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await BoostOrder.findOne({ id: Number(orderId) });
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn cày!" });

        if (status === 'cancelled' && order.status !== 'cancelled') {
            const user = await User.findOne({ username: order.username });
            if (user) {
                user.balance += order.price;
                await user.save();
            }
        }

        order.status = status;
        await order.save();

        res.json({ success: true, message: `Đã cập nhật trạng thái đơn cày sang "${status}"!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật đơn cày!" });
    }
});

app.get('/api/admin/orders', checkAdminAuth, async (req, res) => {
    try {
        const orders = await Order.find().sort({ boughtAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.get('/api/admin/cards', checkAdminAuth, async (req, res) => {
    try {
        const cards = await Card.find().sort({ createdAt: -1 });
        res.json(cards);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/card-action', checkAdminAuth, async (req, res) => {
    try {
        const { cardId, action } = req.body;
        const card = await Card.findById(cardId);
        if (!card || card.status !== 'pending') return res.status(400).json({ success: false, message: "Thẻ không hợp lệ!" });

        if (action === 'approve') {
            const user = await User.findOne({ username: new RegExp('^' + card.username + '$', 'i') });
            if (user) {
                user.balance += card.realAmount;
                await user.save();

                await Deposit.create({
                    username: user.username,
                    amount: card.realAmount,
                    method: "card_manual"
                });
            }
            card.status = 'success';
            await card.save();
            return res.json({ success: true, message: `Đã duyệt thẻ +${card.realAmount}đ!` });
        } else {
            card.status = 'failed';
            await card.save();
            return res.json({ success: true, message: "Đã hủy thẻ!" });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
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
        const { username, amount, type } = req.body;
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });

        const numAmount = Math.abs(Number(amount));
        if (!numAmount || numAmount <= 0) return res.status(400).json({ success: false, message: "Số tiền nhập không hợp lệ!" });

        if (type === 'subtract') {
            if (user.balance < numAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Số dư của khách chỉ có ${user.balance.toLocaleString('vi-VN')} đ, không đủ để trừ ${numAmount.toLocaleString('vi-VN')} đ!`
                });
            }
            user.balance -= numAmount;
            await user.save();
            return res.json({
                success: true,
                message: `Đã TRỪ ${numAmount.toLocaleString('vi-VN')} đ của ${username}! Số dư còn lại: ${user.balance.toLocaleString('vi-VN')} đ`
            });
        } else {
            user.balance += numAmount;
            await user.save();

            await Deposit.create({
                username: user.username,
                amount: numAmount,
                method: "admin"
            });

            return res.json({
                success: true,
                message: `Đã CỘNG ${numAmount.toLocaleString('vi-VN')} đ cho ${username}! Số dư mới: ${user.balance.toLocaleString('vi-VN')} đ`
            });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
