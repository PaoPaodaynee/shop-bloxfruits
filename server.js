const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/ctv.html', (req, res) => res.sendFile(path.join(__dirname, 'ctv.html')));

const ADMIN_USER = "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "";
if (!ADMIN_PASS) {
    console.warn(">>> [CẢNH BÁO]: Chưa set biến môi trường ADMIN_PASSWORD!");
}
const MONGO_URI = process.env.MONGO_URI || "";
if (!MONGO_URI) {
    console.error(">>> [LỖI]: Chưa set biến môi trường MONGO_URI!");
}

const GTF_PARTNER_ID = process.env.GTF_PARTNER_ID || "3314076622";
const GTF_PARTNER_KEY = process.env.GTF_PARTNER_KEY || "";
const SEPAY_WEBHOOK_TOKEN = process.env.SEPAY_WEBHOOK_TOKEN || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE_THIS_SECRET_KEY_IN_ENV";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64url(input) {
    return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(input) {
    input = input.replace(/-/g, '+').replace(/_/g, '/');
    while (input.length % 4) input += '=';
    return Buffer.from(input, 'base64').toString('utf8');
}

function signToken(payload) {
    const body = { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
    const payloadB64 = base64url(JSON.stringify(body));
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('hex');
    return `${payloadB64}.${sig}`;
}

function verifyToken(token) {
    try {
        if (!token || !SESSION_SECRET) return null;
        const [payloadB64, sig] = token.split('.');
        if (!payloadB64 || !sig) return null;
        const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('hex');
        if (!safeCompare(sig, expectedSig)) return null;
        const payload = JSON.parse(base64urlDecode(payloadB64));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

function extractToken(req) {
    const authHeader = req.headers['authorization'] || "";
    return authHeader.replace(/^Bearer\s+/i, '').trim();
}

function requireAuth(req, res, next) {
    const token = extractToken(req);
    const payload = verifyToken(token);
    if (!payload || !payload.username) {
        return res.status(401).json({ success: false, message: "Phiên đăng nhập hết hạn hoặc không hợp lệ!" });
    }
    req.authUser = payload;
    next();
}

function safeCompare(a, b) {
    if (!a || !b) return false;
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// Rate Limiter
const rateLimitStore = new Map();
function rateLimit({ windowMs, max, message }) {
    return (req, res, next) => {
        const key = req.ip + '|' + req.path;
        const now = Date.now();
        let entry = rateLimitStore.get(key);
        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
        }
        entry.count++;
        rateLimitStore.set(key, entry);

        if (entry.count > max) {
            return res.status(429).json({
                success: false,
                message: message || "Bạn thao tác quá nhanh, vui lòng thử lại sau!"
            });
        }
        next();
    };
}

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetAt) rateLimitStore.delete(key);
    }
}, 10 * 60 * 1000);

// ==========================================
// SCHEMAS & MODELS
// ==========================================
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    role: { type: String, default: "user" }
}));

const Category = mongoose.model('Category', new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    createdAt: { type: Date, default: Date.now }
}));

const Account = mongoose.model('Account', new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    category: { type: String, default: "Acc Blox Fruits VIP" },
    title: String,
    level: String,
    fruit: String,
    melee: String,
    price: { type: Number, required: true },
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
    requestId: { type: String, unique: true },
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
    transactionId: { type: String, unique: true, sparse: true },
    username: String,
    amount: Number,
    method: String,
    createdAt: { type: Date, default: Date.now }
}));

const BoostService = mongoose.model('BoostService', new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: String,
    price: Number,
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    active: { type: Boolean, default: true }
}));

const BoostOrder = mongoose.model('BoostOrder', new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    username: String,
    serviceName: String,
    price: Number,
    robloxUser: String,
    robloxPass: String,
    note: String,
    assignedTo: { type: String, default: "" },
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
}));

const ItemProduct = mongoose.model('ItemProduct', new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    type: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    active: { type: Boolean, default: true }
}));

const ItemOrder = mongoose.model('ItemOrder', new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    username: String,
    productType: String,
    productName: String,
    price: Number,
    robloxUsername: String,
    note: String,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
}));

// TÚI MÙ (MYSTERY BOX)
const MysteryBox = mongoose.model('MysteryBox', new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}));

const MysteryAccount = mongoose.model('MysteryAccount', new mongoose.Schema({
    boxId: { type: Number, required: true, index: true },
    robloxUser: { type: String, required: true },
    robloxPass: { type: String, required: true },
    sold: { type: Boolean, default: false, index: true },
    soldTo: String,
    soldAt: Date
}));

mongoose.connect(MONGO_URI)
    .then(() => console.log(">>> [DATABASE]: KẾT NỐI DATABASE THÀNH CÔNG!"))
    .catch(err => console.error(">>> [DATABASE LỖI]:", err.message));

// ==========================================
// AUTH ROUTES
// ==========================================
app.post('/api/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 8 }), async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Vui lòng nhập đủ thông tin!" });
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({ success: false, message: "Tên tài khoản từ 3-20 ký tự, không dấu!" });
        }
        const existUser = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (existUser) return res.status(400).json({ success: false, message: "Tài khoản này đã tồn tại!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await User.create({ username, password: hashedPassword, balance: 0, role: "user" });
        const token = signToken({ username: newUser.username, role: newUser.role });
        res.json({ success: true, message: "Đăng ký thành công!", token, user: { username: newUser.username, balance: newUser.balance, role: newUser.role } });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi máy chủ!" });
    }
});

app.post('/api/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = (username || "").trim().toLowerCase();
        const cleanPass = (password || "").trim();

        if (cleanUser === "admin" && ADMIN_PASS && cleanPass === ADMIN_PASS.trim()) {
            const adminToken = signToken({ username: "ADMIN", role: "admin" });
            return res.json({
                success: true,
                isAdmin: true,
                message: "Xin chào Quản trị viên!",
                adminToken,
                token: adminToken,
                user: { username: "ADMIN", role: "admin", balance: 999999999 }
            });
        }

        const user = await User.findOne({ username: new RegExp('^' + cleanUser + '$', 'i') });
        if (!user) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });

        const isMatch = await bcrypt.compare(cleanPass, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });

        const token = signToken({ username: user.username, role: user.role });
        res.json({
            success: true,
            isAdmin: false,
            message: "Đăng nhập thành công!",
            token,
            user: { username: user.username, balance: user.balance, role: user.role }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi máy chủ!" });
    }
});

app.get('/api/user-balance', requireAuth, async (req, res) => {
    try {
        if (req.authUser.role === 'admin') {
            return res.json({ balance: 999999999, role: "admin" });
        }
        const user = await User.findOne({ username: new RegExp('^' + req.authUser.username + '$', 'i') });
        res.json({ balance: user ? user.balance : 0, role: user ? user.role : "user" });
    } catch (e) {
        res.json({ balance: 0, role: "user" });
    }
});

app.get('/api/top-deposits', async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const top = await Deposit.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: "$username", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } },
            { $limit: 10 }
        ]);
        res.json(top.map((t, idx) => ({ rank: idx + 1, username: t._id, total: t.total })));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        res.json(await Category.find().sort({ id: 1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.get('/api/accounts', async (req, res) => {
    try {
        const { category } = req.query;
        let query = { sold: false };
        if (category && category !== 'all') query.category = category;
        res.json(await Account.find(query).select('id category title level fruit melee price image'));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/buy', requireAuth, async (req, res) => {
    try {
        const { accountId } = req.body;
        const targetAccId = Number(accountId);

        const acc = await Account.findOne({ id: targetAccId, sold: false });
        if (!acc) {
            return res.status(400).json({ success: false, message: "Acc không tồn tại hoặc đã có người mua!" });
        }

        const updatedUser = await User.findOneAndUpdate(
            { username: req.authUser.username, balance: { $gte: acc.price } },
            { $inc: { balance: -acc.price } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ success: false, message: "Số dư tài khoản không đủ!" });
        }

        const lockedAcc = await Account.findOneAndUpdate(
            { id: targetAccId, sold: false },
            { $set: { sold: true } },
            { new: true }
        );

        if (!lockedAcc) {
            await User.updateOne({ username: req.authUser.username }, { $inc: { balance: acc.price } });
            return res.status(400).json({ success: false, message: "Tài khoản vừa bị người khác mua mất! Tiền đã được hoàn lại ví." });
        }

        await Order.create({
            username: req.authUser.username,
            accId: lockedAcc.id,
            title: lockedAcc.title,
            price: lockedAcc.price,
            robloxUser: lockedAcc.robloxUser,
            robloxPass: lockedAcc.robloxPass
        });

        res.json({
            success: true,
            accountInfo: { username: lockedAcc.robloxUser, password: lockedAcc.robloxPass },
            newBalance: updatedUser.balance
        });
    } catch (e) {
        console.error(">>> [BUY ERROR]:", e);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi giao dịch!" });
    }
});

app.get('/api/my-orders', requireAuth, async (req, res) => {
    try {
        res.json(await Order.find({ username: req.authUser.username }).sort({ boughtAt: -1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

// ==========================================
// CÀY THUÊ
// ==========================================
app.get('/api/boost-services', async (req, res) => {
    try {
        res.json(await BoostService.find({ active: true }).sort({ id: 1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/boost-order', requireAuth, async (req, res) => {
    try {
        const { serviceId, robloxUser, robloxPass, note } = req.body;
        if (!robloxUser || !robloxPass) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập tài khoản và mật khẩu Roblox!" });
        }

        const service = await BoostService.findOne({ id: Number(serviceId), active: true });
        if (!service) return res.status(400).json({ success: false, message: "Gói cày không tồn tại!" });

        const updatedUser = await User.findOneAndUpdate(
            { username: req.authUser.username, balance: { $gte: service.price } },
            { $inc: { balance: -service.price } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ success: false, message: "Số dư không đủ!" });
        }

        const newOrder = await BoostOrder.create({
            id: Date.now(),
            username: req.authUser.username,
            serviceName: service.name,
            price: service.price,
            robloxUser: robloxUser.trim(),
            robloxPass: robloxPass.trim(),
            note: note ? note.trim() : "",
            status: "pending"
        });

        res.json({
            success: true,
            message: `Đặt cày gói "${service.name}" thành công!`,
            newBalance: updatedUser.balance,
            order: newOrder
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tạo đơn cày!" });
    }
});

app.get('/api/my-boost-orders', requireAuth, async (req, res) => {
    try {
        res.json(await BoostOrder.find({ username: req.authUser.username }).sort({ createdAt: -1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

// ==========================================
// CỔNG CTV
// ==========================================
function checkCtvAuth(req, res, next) {
    requireAuth(req, res, async () => {
        try {
            const user = await User.findOne({ username: req.authUser.username });
            if (!user || (user.role !== 'ctv' && user.role !== 'admin')) {
                return res.status(403).json({ success: false, message: "Bạn không có quyền CTV!" });
            }
            req.ctvUser = user;
            next();
        } catch (e) {
            res.status(500).json({ success: false, message: "Lỗi xác thực CTV!" });
        }
    });
}

app.get('/api/ctv/orders', checkCtvAuth, async (req, res) => {
    try {
        const orders = await BoostOrder.find({
            $or: [{ status: 'pending' }, { assignedTo: req.ctvUser.username }]
        }).sort({ createdAt: -1 });
        res.json({ success: true, ctvName: req.ctvUser.username, orders });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tải đơn cày!" });
    }
});

app.post('/api/ctv/claim', checkCtvAuth, async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await BoostOrder.findOneAndUpdate(
            { id: Number(orderId), status: 'pending' },
            { $set: { status: 'processing', assignedTo: req.ctvUser.username } },
            { new: true }
        );
        if (!order) return res.status(400).json({ success: false, message: "Đơn không tồn tại hoặc đã bị CTV khác nhận!" });
        res.json({ success: true, message: `Bạn đã nhận cày đơn #${orderId} thành công!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi nhận đơn!" });
    }
});

app.post('/api/ctv/complete', checkCtvAuth, async (req, res) => {
    try {
        const { orderId } = req.body;
        const query = { id: Number(orderId), status: 'processing' };
        if (req.ctvUser.role !== 'admin') query.assignedTo = req.ctvUser.username;

        const order = await BoostOrder.findOneAndUpdate(query, { $set: { status: 'completed' } }, { new: true });
        if (!order) return res.status(400).json({ success: false, message: "Không tìm thấy đơn hoặc bạn không phải người nhận!" });
        res.json({ success: true, message: `Đã hoàn thành đơn cày #${orderId}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật!" });
    }
});

// ==========================================
// GAMEPASS & VẬT PHẨM
// ==========================================
app.get('/api/items', async (req, res) => {
    try {
        let query = { active: true };
        if (req.query.type) query.type = req.query.type;
        res.json(await ItemProduct.find(query).sort({ price: 1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/item-order', requireAuth, async (req, res) => {
    try {
        const { itemId, robloxUsername, note } = req.body;
        if (!robloxUsername) return res.status(400).json({ success: false, message: "Nhập tên Roblox nhận đồ!" });

        const item = await ItemProduct.findOne({ id: Number(itemId), active: true });
        if (!item) return res.status(400).json({ success: false, message: "Vật phẩm không tồn tại!" });

        const updatedUser = await User.findOneAndUpdate(
            { username: req.authUser.username, balance: { $gte: item.price } },
            { $inc: { balance: -item.price } },
            { new: true }
        );

        if (!updatedUser) return res.status(400).json({ success: false, message: "Số dư không đủ!" });

        const newOrder = await ItemOrder.create({
            id: Date.now(),
            username: req.authUser.username,
            productType: item.type,
            productName: item.name,
            price: item.price,
            robloxUsername: robloxUsername.trim(),
            note: note ? note.trim() : "",
            status: "pending"
        });

        res.json({ success: true, message: "Đặt mua thành công!", newBalance: updatedUser.balance, order: newOrder });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi giao dịch!" });
    }
});

app.get('/api/my-item-orders', requireAuth, async (req, res) => {
    try {
        res.json(await ItemOrder.find({ username: req.authUser.username }).sort({ createdAt: -1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

// ==========================================
// 🎁 TÚI MÙ (MYSTERY BOX) - CLIENT API
// ==========================================
app.get('/api/mystery-boxes', async (req, res) => {
    try {
        const boxes = await MysteryBox.find({ active: true }).sort({ price: 1 });
        const result = await Promise.all(boxes.map(async (b) => {
            const stock = await MysteryAccount.countDocuments({ boxId: b.id, sold: false });
            return {
                id: b.id,
                name: b.name,
                price: b.price,
                description: b.description,
                image: b.image,
                stock: stock
            };
        }));
        res.json(result);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/mystery-box/buy', requireAuth, async (req, res) => {
    try {
        const { boxId } = req.body;
        const targetBoxId = Number(boxId);

        const box = await MysteryBox.findOne({ id: targetBoxId, active: true });
        if (!box) return res.status(400).json({ success: false, message: "Túi mù không tồn tại!" });

        const sampleAcc = await MysteryAccount.aggregate([
            { $match: { boxId: targetBoxId, sold: false } },
            { $sample: { size: 1 } }
        ]);

        if (!sampleAcc || sampleAcc.length === 0) {
            return res.status(400).json({ success: false, message: "Túi mù này đã hết acc trong kho! Vui lòng chờ shop nạp thêm." });
        }

        const updatedUser = await User.findOneAndUpdate(
            { username: req.authUser.username, balance: { $gte: box.price } },
            { $inc: { balance: -box.price } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ success: false, message: "Số dư không đủ để mở túi mù này!" });
        }

        const pickedId = sampleAcc[0]._id;
        const lockedAcc = await MysteryAccount.findOneAndUpdate(
            { _id: pickedId, sold: false },
            { $set: { sold: true, soldTo: req.authUser.username, soldAt: new Date() } },
            { new: true }
        );

        if (!lockedAcc) {
            await User.updateOne({ username: req.authUser.username }, { $inc: { balance: box.price } });
            return res.status(400).json({ success: false, message: "Có tranh chấp mở túi mù, vui lòng thử lại!" });
        }

        await Order.create({
            username: req.authUser.username,
            accId: box.id,
            title: `[Túi Mù] ${box.name}`,
            price: box.price,
            robloxUser: lockedAcc.robloxUser,
            robloxPass: lockedAcc.robloxPass
        });

        res.json({
            success: true,
            message: `🎉 Chúc mừng bạn đã mở được acc từ túi mù "${box.name}"!`,
            accountInfo: { username: lockedAcc.robloxUser, password: lockedAcc.robloxPass },
            newBalance: updatedUser.balance
        });
    } catch (e) {
        console.error(">>> [MYSTERY BOX BUY ERROR]:", e);
        res.status(500).json({ success: false, message: "Lỗi mở túi mù!" });
    }
});

// ==========================================
// NẠP THẺ & WEBHOOK
// ==========================================
app.post('/api/topup-card', requireAuth, async (req, res) => {
    try {
        const { telco, amount, code, serial } = req.body;
        if (!telco || !amount || !code || !serial) return res.status(400).json({ success: false, message: "Thiếu thông tin thẻ!" });

        const cleanCode = code.trim();
        const cleanSerial = serial.trim();
        const declared = Number(amount);
        const requestId = Date.now().toString() + Math.floor(Math.random() * 1000);

        const sign = crypto.createHash('md5').update(GTF_PARTNER_KEY + cleanCode + cleanSerial).digest('hex');

        await Card.create({
            requestId,
            username: req.authUser.username,
            telco: telco.toUpperCase(),
            declaredAmount: declared,
            realAmount: Math.round(declared * 0.8),
            code: cleanCode,
            serial: cleanSerial,
            status: "pending",
            message: "Đang xử lý..."
        });

        fetch('https://gachthefast.com/chargingws/v2', {
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
        }).catch(() => {});

        res.json({ success: true, message: "Đã gửi thẻ cào lên hệ thống kiểm tra!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi gửi thẻ!" });
    }
});

app.all('/api/webhook/gachthefast', async (req, res) => {
    try {
        const data = req.method === 'POST' ? req.body : req.query;
        const status = Number(data.status);
        const requestId = data.request_id;
        const realAmount = Number(data.amount) || Number(data.value) || 0;

        let card = await Card.findOne({ requestId });
        if (!card && data.code && data.serial) card = await Card.findOne({ code: data.code, serial: data.serial });
        if (!card || card.status === 'success') return res.status(200).send("OK");

        if (!GTF_PARTNER_KEY) return res.status(401).send("Unauthorized");
        const expectedSign = crypto.createHash('md5').update(GTF_PARTNER_KEY + card.code + card.serial).digest('hex');
        if (!data.sign || !safeCompare(data.sign, expectedSign)) return res.status(401).send("Unauthorized");

        if (status === 1 || status === 3) {
            const amountToAdd = realAmount > 0 ? realAmount : Math.round(card.declaredAmount * 0.8);
            await User.updateOne({ username: card.username }, { $inc: { balance: amountToAdd } });
            await Deposit.create({ username: card.username, amount: amountToAdd, method: "card" });
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
        const authHeader = req.headers['authorization'] || "";
        const receivedToken = authHeader.replace(/^Apikey\s+/i, '').trim();

        if (!SEPAY_WEBHOOK_TOKEN || !safeCompare(receivedToken, SEPAY_WEBHOOK_TOKEN)) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const data = req.body;
        const transactionId = String(data.id || data.referenceCode || "");
        const content = data.content || data.description || "";
        const amount = Number(data.transferAmount) || 0;

        if (!transactionId) return res.status(400).json({ success: false, message: "Missing transaction ID" });

        const existed = await Deposit.findOne({ transactionId });
        if (existed) {
            return res.status(200).json({ success: true, message: "Transaction already processed" });
        }

        const match = content.match(/OTOPI\s*([A-Za-z0-9_]+)/i);
        if (match && match[1] && amount > 0) {
            const targetUsername = match[1].trim();
            const updatedUser = await User.findOneAndUpdate(
                { username: new RegExp('^' + targetUsername + '$', 'i') },
                { $inc: { balance: amount } },
                { new: true }
            );

            if (updatedUser) {
                await Deposit.create({
                    transactionId,
                    username: updatedUser.username,
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
// ADMIN ROUTES
// ==========================================
function checkAdminAuth(req, res, next) {
    const token = extractToken(req);
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Không có quyền Admin!" });
    }
    next();
}

app.post('/api/admin/set-role', checkAdminAuth, async (req, res) => {
    try {
        const { username, role } = req.body;
        if (!['user', 'ctv'].includes(role)) return res.status(400).json({ success: false, message: "Quyền không hợp lệ!" });
        const user = await User.findOneAndUpdate({ username: new RegExp('^' + username + '$', 'i') }, { $set: { role } }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user!" });
        res.json({ success: true, message: `Đã đổi quyền của ${username} thành ${role}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi đổi quyền!" });
    }
});

app.get('/api/admin/categories', checkAdminAuth, async (req, res) => {
    try {
        res.json(await Category.find().sort({ id: 1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/category/add', checkAdminAuth, async (req, res) => {
    try {
        const { name, description, image } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Tên mục không được trống!" });
        await Category.create({ id: Date.now(), name: name.trim(), description: description || "", image: image || "" });
        res.json({ success: true, message: "Tạo mục thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tạo mục!" });
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

app.get('/api/admin/items', checkAdminAuth, async (req, res) => {
    try {
        res.json(await ItemProduct.find().sort({ type: 1, id: 1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/item/add', checkAdminAuth, async (req, res) => {
    try {
        const { type, name, price, description, image } = req.body;
        await ItemProduct.create({ id: Date.now(), type, name: name.trim(), price: Number(price), description, image, active: true });
        res.json({ success: true, message: "Đã thêm sản phẩm!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi thêm sản phẩm!" });
    }
});

app.delete('/api/admin/item/:id', checkAdminAuth, async (req, res) => {
    try {
        await ItemProduct.findOneAndDelete({ id: Number(req.params.id) });
        res.json({ success: true, message: "Đã xóa sản phẩm!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xóa!" });
    }
});

app.get('/api/admin/item-orders', checkAdminAuth, async (req, res) => {
    try {
        res.json(await ItemOrder.find().sort({ createdAt: -1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/item-order/status', checkAdminAuth, async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await ItemOrder.findOne({ id: Number(orderId) });
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn!" });

        if (status === 'cancelled' && order.status !== 'cancelled') {
            await User.updateOne({ username: order.username }, { $inc: { balance: order.price } });
        }
        order.status = status;
        await order.save();
        res.json({ success: true, message: "Đã cập nhật đơn!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật!" });
    }
});

app.get('/api/admin/accounts', checkAdminAuth, async (req, res) => {
    try {
        res.json(await Account.find().sort({ id: -1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/add', checkAdminAuth, async (req, res) => {
    try {
        const { category, title, level, fruit, melee, price, image, robloxUser, robloxPass } = req.body;
        await Account.create({
            id: Date.now(),
            category: category || "Acc Blox Fruits VIP",
            title, level, fruit, melee,
            price: Number(price),
            image, sold: false,
            robloxUser, robloxPass
        });
        res.json({ success: true, message: "Đăng acc thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi đăng acc!" });
    }
});

app.post('/api/admin/add-bulk', checkAdminAuth, async (req, res) => {
    try {
        const { category, bulkText, title, price, level, fruit, melee, image } = req.body;
        if (!bulkText) return res.status(400).json({ success: false, message: "Chưa nhập danh sách!" });

        const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const newAccounts = [];
        let baseId = Date.now();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.includes('|') ? line.split('|') : line.split(':');
            const u = parts[0]?.trim();
            const p = parts[1]?.trim();
            if (u && p) {
                newAccounts.push({
                    id: baseId + i,
                    category: category || "Acc Blox Fruits VIP",
                    title: title || `Acc Blox Fruits VIP #${i + 1}`,
                    price: Number(price) || 50000,
                    level: level || "Max (2550)",
                    fruit: fruit || "Ngẫu Nhiên",
                    melee: melee || "Godhuman",
                    image: image || "",
                    robloxUser: u,
                    robloxPass: p,
                    sold: false
                });
            }
        }
        await Account.insertMany(newAccounts);
        res.json({ success: true, message: `Thêm thành công ${newAccounts.length} acc!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi nhập hàng loạt!" });
    }
});

app.delete('/api/admin/account/:id', checkAdminAuth, async (req, res) => {
    try {
        await Account.findOneAndDelete({ id: Number(req.params.id) });
        res.json({ success: true, message: "Đã xóa acc!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xóa acc!" });
    }
});

app.get('/api/admin/boost-services', checkAdminAuth, async (req, res) => {
    try {
        res.json(await BoostService.find().sort({ id: 1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/boost-service/add', checkAdminAuth, async (req, res) => {
    try {
        const { name, price, description, image } = req.body;
        await BoostService.create({ id: Date.now(), name, price: Number(price), description, image, active: true });
        res.json({ success: true, message: "Tạo gói cày thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tạo gói cày!" });
    }
});

app.delete('/api/admin/boost-service/:id', checkAdminAuth, async (req, res) => {
    try {
        await BoostService.findOneAndDelete({ id: Number(req.params.id) });
        res.json({ success: true, message: "Đã xóa gói cày!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xóa gói cày!" });
    }
});

app.get('/api/admin/boost-orders', checkAdminAuth, async (req, res) => {
    try {
        res.json(await BoostOrder.find().sort({ createdAt: -1 }));
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
            await User.updateOne({ username: order.username }, { $inc: { balance: order.price } });
        }
        order.status = status;
        await order.save();
        res.json({ success: true, message: "Cập nhật đơn cày thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật!" });
    }
});

// ==========================================
// 🎁 TÚI MÙ (MYSTERY BOX) - ADMIN API
// ==========================================
app.get('/api/admin/mystery-boxes', checkAdminAuth, async (req, res) => {
    try {
        const boxes = await MysteryBox.find().sort({ id: -1 });
        const result = await Promise.all(boxes.map(async (b) => {
            const total = await MysteryAccount.countDocuments({ boxId: b.id });
            const remaining = await MysteryAccount.countDocuments({ boxId: b.id, sold: false });
            return {
                id: b.id,
                name: b.name,
                price: b.price,
                description: b.description,
                image: b.image,
                totalAcc: total,
                remainingAcc: remaining
            };
        }));
        res.json(result);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/mystery-box/create', checkAdminAuth, async (req, res) => {
    try {
        const { name, price, description, image } = req.body;
        if (!name || !price) return res.status(400).json({ success: false, message: "Thiếu tên hoặc giá túi mù!" });

        await MysteryBox.create({
            id: Date.now(),
            name: name.trim(),
            price: Number(price),
            description: description ? description.trim() : "",
            image: image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
            active: true
        });

        res.json({ success: true, message: "Tạo Túi Mù mới thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tạo túi mù!" });
    }
});

app.post('/api/admin/mystery-box/add-accs', checkAdminAuth, async (req, res) => {
    try {
        const { boxId, bulkText } = req.body;
        if (!boxId || !bulkText) return res.status(400).json({ success: false, message: "Vui lòng chọn Túi Mù và nhập danh sách acc!" });

        const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const newAccs = [];

        for (let line of lines) {
            const parts = line.includes('|') ? line.split('|') : line.split(':');
            const u = parts[0]?.trim();
            const p = parts[1]?.trim();
            if (u && p) {
                newAccs.push({
                    boxId: Number(boxId),
                    robloxUser: u,
                    robloxPass: p,
                    sold: false
                });
            }
        }

        if (newAccs.length === 0) {
            return res.status(400).json({ success: false, message: "Không tìm thấy acc hợp lệ (định dạng user|pass)!" });
        }

        await MysteryAccount.insertMany(newAccs);
        res.json({ success: true, message: `Thành công! Đã nạp thêm ${newAccs.length} acc vào Túi Mù!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi nạp acc vào túi mù!" });
    }
});

app.delete('/api/admin/mystery-box/:id', checkAdminAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        await MysteryBox.findOneAndDelete({ id });
        await MysteryAccount.deleteMany({ boxId: id });
        res.json({ success: true, message: "Đã xóa Túi Mù và toàn bộ acc trong túi!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xóa túi mù!" });
    }
});

app.get('/api/admin/orders', checkAdminAuth, async (req, res) => {
    try {
        res.json(await Order.find().sort({ boughtAt: -1 }));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.get('/api/admin/cards', checkAdminAuth, async (req, res) => {
    try {
        res.json(await Card.find().sort({ createdAt: -1 }));
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
            await User.updateOne({ username: card.username }, { $inc: { balance: card.realAmount } });
            await Deposit.create({ username: card.username, amount: card.realAmount, method: "card_manual" });
            card.status = 'success';
            await card.save();
            return res.json({ success: true, message: `Duyệt thẻ thành công +${card.realAmount}đ!` });
        } else {
            card.status = 'failed';
            await card.save();
            return res.json({ success: true, message: "Đã hủy thẻ!" });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi duyệt thẻ!" });
    }
});

app.get('/api/admin/users', checkAdminAuth, async (req, res) => {
    try {
        res.json(await User.find().select('username balance role'));
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/adjust-balance', checkAdminAuth, async (req, res) => {
    try {
        const { username, amount, type } = req.body;
        const numAmount = Math.abs(Number(amount));
        if (!numAmount || numAmount <= 0) return res.status(400).json({ success: false, message: "Số tiền không hợp lệ!" });

        if (type === 'subtract') {
            const updated = await User.findOneAndUpdate(
                { username: new RegExp('^' + username + '$', 'i'), balance: { $gte: numAmount } },
                { $inc: { balance: -numAmount } },
                { new: true }
            );
            if (!updated) return res.status(400).json({ success: false, message: "Số dư khách không đủ để trừ!" });
            return res.json({ success: true, message: `Đã trừ ${numAmount}đ của ${username}!` });
        } else {
            await User.updateOne({ username: new RegExp('^' + username + '$', 'i') }, { $inc: { balance: numAmount } });
            await Deposit.create({ username, amount: numAmount, method: "admin" });
            return res.json({ success: true, message: `Đã cộng ${numAmount}đ cho ${username}!` });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi chỉnh số dư!" });
    }
});

app.listen(PORT, () => {
    console.log(`Web đang chạy tại cổng ${PORT}`);
});
