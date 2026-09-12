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
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "";
if (!ADMIN_PASS) {
    console.warn(">>> [CẢNH BÁO]: Chưa set biến môi trường ADMIN_PASSWORD trên Render! Đăng nhập admin sẽ bị VÔ HIỆU HÓA cho đến khi bạn set.");
}
const ADMIN_SECRET_KEY = "otopi_bi_mat_2026";
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://autophobia011_db_user:YoPOL0EN3zmSvT1Z@cluster0.toio2qu.mongodb.net/shop_blox?retryWrites=true&w=majority&appName=Cluster0";

const GTF_PARTNER_ID = process.env.GTF_PARTNER_ID || "3314076622";
const GTF_PARTNER_KEY = process.env.GTF_PARTNER_KEY || "5f8a7bbd94f22b62bcaf15b811849628";

// Token/API-key riêng để xác thực webhook SePay (lấy từ Dashboard SePay > Cấu hình Webhook)
const SEPAY_WEBHOOK_TOKEN = process.env.SEPAY_WEBHOOK_TOKEN || "otopisutio";

// So sánh chuỗi an toàn (chống timing attack) dùng để check token/sign webhook
function safeCompare(a, b) {
    if (!a || !b) return false;
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// ==========================================
// 1. SCHEMAS & MODELS (HỆ THỐNG ROLE MỚI)
// ==========================================
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: { type: String, default: "user" } // "user", "ctv", "admin"
}));

const Category = mongoose.model('Category', new mongoose.Schema({
    id: { type: Number, required: true },
    name: { type: String, required: true },
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    createdAt: { type: Date, default: Date.now }
}));

const Account = mongoose.model('Account', new mongoose.Schema({
    id: { type: Number, required: true },
    category: { type: String, default: "Acc Blox Fruits VIP" },
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

// ĐƠN CÀY THUÊ (CÓ THÊM NGƯỜI NHẬN CÀY assignedTo)
const BoostOrder = mongoose.model('BoostOrder', new mongoose.Schema({
    id: { type: Number, required: true },
    username: String,
    serviceName: String,
    price: Number,
    robloxUser: String,
    robloxPass: String,
    note: String,
    assignedTo: { type: String, default: "" }, // Tên CTV thợ cày nhận đơn
    status: { type: String, default: "pending" }, // pending, processing, completed, cancelled
    createdAt: { type: Date, default: Date.now }
}));

const ItemProduct = mongoose.model('ItemProduct', new mongoose.Schema({
    id: { type: Number, required: true },
    type: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    image: { type: String, default: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80" },
    active: { type: Boolean, default: true }
}));

const ItemOrder = mongoose.model('ItemOrder', new mongoose.Schema({
    id: { type: Number, required: true },
    username: String,
    productType: String,
    productName: String,
    price: Number,
    robloxUsername: String,
    note: String,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
}));

// ==========================================
// 2. KẾT NỐI DATABASE
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => console.log(">>> [DATABASE]: BẢO MẬT & KẾT NỐI THÀNH CÔNG!"))
    .catch(err => console.error(">>> [DATABASE LỖI]:", err.message));

// ==========================================
// 3. API ĐĂNG KÝ / ĐĂNG NHẬP / ROLE
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

        const newUser = await User.create({ username, password: hashedPassword, balance: 0, role: "user" });
        res.json({ success: true, message: "Đăng ký thành công!", user: { username: newUser.username, balance: newUser.balance, role: newUser.role } });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = (username || "").trim().toLowerCase();
        const cleanPass = (password || "").trim();

        // Đăng nhập Admin (CHỈ chấp nhận mật khẩu lấy từ biến môi trường ADMIN_PASSWORD)
        if (cleanUser === "admin" && ADMIN_PASS && cleanPass === ADMIN_PASS.trim()) {
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

        res.json({
            success: true,
            isAdmin: false,
            message: "Đăng nhập thành công!",
            user: { username: user.username, balance: user.balance, role: user.role }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.get('/api/user-balance', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json({ balance: 0, role: "user" });
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        res.json({ balance: user ? user.balance : 0, role: user ? user.role : "user" });
    } catch (e) {
        res.json({ balance: 0, role: "user" });
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
// 4. DANH MỤC & MUA ACC
// ==========================================
app.get('/api/categories', async (req, res) => {
    try {
        const cats = await Category.find().sort({ id: 1 });
        res.json(cats);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.get('/api/accounts', async (req, res) => {
    try {
        const { category } = req.query;
        let query = { sold: false };
        if (category && category !== 'all') query.category = category;
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
// 5. CÀY THUÊ (CHO KHÁCH HÀNG)
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
// ⚡ 6. CỔNG API DÀNH RIÊNG CHO CTV THỢ CÀY (MỚI)
// ==========================================

// Kiểm tra quyền CTV
async function checkCtvAuth(req, res, next) {
    try {
        const username = req.headers['x-ctv-user'] || req.query.ctvUser || req.body.ctvUser;
        if (!username) return res.status(401).json({ success: false, message: "Chưa đăng nhập tài khoản CTV!" });

        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (!user || (user.role !== 'ctv' && user.role !== 'admin')) {
            return res.status(403).json({ success: false, message: "Tài khoản của bạn chưa được cấp quyền CTV Thợ Cày!" });
        }

        req.ctvUser = user;
        next();
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xác thực CTV!" });
    }
}

// CTV xem danh sách đơn cày (chờ cày & đơn của mình nhận)
app.get('/api/ctv/orders', checkCtvAuth, async (req, res) => {
    try {
        // Lấy các đơn đang chờ nhận (pending) HOẶC đơn chính CTV này đang cày (processing)
        const orders = await BoostOrder.find({
            $or: [
                { status: 'pending' },
                { assignedTo: req.ctvUser.username }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, ctvName: req.ctvUser.username, orders });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi tải đơn cày!" });
    }
});

// CTV bấm nhận đơn cày
app.post('/api/ctv/claim', checkCtvAuth, async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await BoostOrder.findOne({ id: Number(orderId) });
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn cày!" });

        if (order.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Đơn này đã được nhận bởi ${order.assignedTo || 'thợ khác'} rồi!` });
        }

        order.status = 'processing';
        order.assignedTo = req.ctvUser.username;
        await order.save();

        res.json({ success: true, message: `Bạn đã nhận cày thành công đơn #${orderId}! Hãy bắt đầu vào acc cày cho khách.` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi nhận đơn!" });
    }
});

// CTV bấm hoàn thành đơn cày
app.post('/api/ctv/complete', checkCtvAuth, async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await BoostOrder.findOne({ id: Number(orderId) });
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn cày!" });

        if (order.assignedTo !== req.ctvUser.username && req.ctvUser.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Bạn không phải người nhận đơn này!" });
        }

        order.status = 'completed';
        await order.save();

        res.json({ success: true, message: `Chúc mừng bạn đã hoàn thành đơn cày #${orderId}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật!" });
    }
});

// ==========================================
// 7. GAMEPASS & TRÁI RƯƠNG
// ==========================================
app.get('/api/items', async (req, res) => {
    try {
        const { type } = req.query;
        let query = { active: true };
        if (type) query.type = type;
        const items = await ItemProduct.find(query).sort({ price: 1 });
        res.json(items);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/item-order', async (req, res) => {
    try {
        const { username, itemId, robloxUsername, note } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ success: false, message: "Vui lòng đăng nhập trước khi mua!" });

        const item = await ItemProduct.findOne({ id: Number(itemId), active: true });
        if (!item) return res.status(400).json({ success: false, message: "Vật phẩm không tồn tại hoặc đã dừng bán!" });

        if (!robloxUsername) return res.status(400).json({ success: false, message: "Vui lòng nhập tên nhân vật Roblox nhận đồ!" });

        if (user.balance < item.price) return res.status(400).json({ success: false, message: "Số dư không đủ!" });

        user.balance -= item.price;
        await user.save();

        const count = await ItemOrder.countDocuments();
        const newOrder = await ItemOrder.create({
            id: count + 1,
            username: user.username,
            productType: item.type,
            productName: item.name,
            price: item.price,
            robloxUsername: robloxUsername.trim(),
            note: note ? note.trim() : "",
            status: "pending"
        });

        res.json({
            success: true,
            message: `Mua "${item.name}" thành công! Shop sẽ giao đồ cho "${robloxUsername}" sớm nhất.`,
            newBalance: user.balance,
            order: newOrder
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi mua hàng: " + e.message });
    }
});

app.get('/api/my-item-orders', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json([]);
        const orders = await ItemOrder.find({ username }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json([]);
    }
});

// ==========================================
// 8. NẠP THẺ & WEBHOOKS
// ==========================================
app.post('/api/topup-card', async (req, res) => {
    try {
        const { username, telco, amount, code, serial } = req.body;
        if (!username || !telco || !amount || !code || !serial) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đủ thông tin!" });
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

        res.json({ success: true, message: "Thẻ đã gửi lên hệ thống! Đang tự động xử lý." });
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
        if (!card && data.code && data.serial) card = await Card.findOne({ code: data.code, serial: data.serial });

        if (!card || card.status === 'success') return res.status(200).send("OK");

        // XÁC THỰC CHỮ KÝ: đối chiếu sign gửi kèm với sign tự tính từ code/serial đã lưu + partner key.
        // (Nếu nhà cung cấp gachthefast dùng công thức sign khác, hãy đối chiếu lại tài liệu API của họ
        // và sửa dòng tính expectedSign bên dưới cho khớp.)
        if (!GTF_PARTNER_KEY) {
            console.warn(">>> [GACHTHEFAST WEBHOOK]: Chưa cấu hình GTF_PARTNER_KEY, từ chối webhook để an toàn!");
            return res.status(401).send("Unauthorized");
        }
        const expectedSign = crypto.createHash('md5')
            .update(GTF_PARTNER_KEY + card.code + card.serial)
            .digest('hex');

        if (!data.sign || !safeCompare(data.sign, expectedSign)) {
            console.warn(">>> [GACHTHEFAST WEBHOOK]: Chữ ký không hợp lệ, từ chối request!", requestId);
            return res.status(401).send("Unauthorized");
        }

        if (status === 1 || status === 3) {
            const user = await User.findOne({ username: new RegExp('^' + card.username + '$', 'i') });
            const amountToAdd = realAmount > 0 ? realAmount : Math.round(card.declaredAmount * 0.8);
            if (user) {
                user.balance += amountToAdd;
                await user.save();
                await Deposit.create({ username: user.username, amount: amountToAdd, method: "card" });
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
        // XÁC THỰC: SePay gửi header Authorization: "Apikey <token>".
        // Bắt buộc phải trùng với SEPAY_WEBHOOK_TOKEN đã cấu hình, nếu không có/sai -> từ chối.
        const authHeader = req.headers['authorization'] || "";
        const receivedToken = authHeader.replace(/^Apikey\s+/i, '').trim();

        if (!SEPAY_WEBHOOK_TOKEN || !safeCompare(receivedToken, SEPAY_WEBHOOK_TOKEN)) {
            console.warn(">>> [SEPAY WEBHOOK]: Từ chối request - token không hợp lệ hoặc chưa cấu hình SEPAY_WEBHOOK_TOKEN!");
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

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
                await Deposit.create({ username: user.username, amount: amount, method: "bank" });
                return res.json({ success: true });
            }
        }
        res.json({ success: false });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// ==========================================
// 9. ADMIN ROUTES
// ==========================================
function checkAdminAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (token === ADMIN_SECRET_KEY) return next();
    return res.status(403).json({ success: false, message: "Không có quyền Admin!" });
}

// ADMIN PHONG CHỨC ROLE (USER <-> CTV)
app.post('/api/admin/set-role', checkAdminAuth, async (req, res) => {
    try {
        const { username, role } = req.body;
        if (!['user', 'ctv'].includes(role)) return res.status(400).json({ success: false, message: "Quyền không hợp lệ!" });

        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });

        user.role = role;
        await user.save();

        res.json({ success: true, message: `Đã đổi quyền của ${username} thành "${role === 'ctv' ? 'Cộng Tác Viên (Thợ Cày)' : 'Thành Viên Thường'}"!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi đổi quyền!" });
    }
});

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
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
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
        const items = await ItemProduct.find().sort({ type: 1, id: 1 });
        res.json(items);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/item/add', checkAdminAuth, async (req, res) => {
    try {
        const { type, name, price, description, image } = req.body;
        if (!name || !price || !type) return res.status(400).json({ success: false, message: "Thiếu thông tin!" });
        const count = await ItemProduct.countDocuments();
        await ItemProduct.create({
            id: count + 1,
            type,
            name: name.trim(),
            price: Number(price),
            description: description || "",
            image: image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
            active: true
        });
        res.json({ success: true, message: "Đã thêm sản phẩm thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
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
        const orders = await ItemOrder.find().sort({ createdAt: -1 });
        res.json(orders);
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
            const user = await User.findOne({ username: order.username });
            if (user) {
                user.balance += order.price;
                await user.save();
            }
        }

        order.status = status;
        await order.save();
        res.json({ success: true, message: `Đã cập nhật đơn #${orderId}!` });
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
        res.status(500).json({ success: false, message: "Lỗi cập nhật!" });
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
                await Deposit.create({ username: user.username, amount: card.realAmount, method: "card_manual" });
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

// LẤY DANH SÁCH USER (KÈM ROLE)
app.get('/api/admin/users', checkAdminAuth, async (req, res) => {
    try {
        const users = await User.find().select('username balance role');
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
                return res.status(400).json({ success: false, message: `Số dư khách chỉ có ${user.balance.toLocaleString('vi-VN')} đ!` });
            }
            user.balance -= numAmount;
            await user.save();
            return res.json({ success: true, message: `Đã TRỪ ${numAmount.toLocaleString('vi-VN')} đ của ${username}!` });
        } else {
            user.balance += numAmount;
            await user.save();
            await Deposit.create({ username: user.username, amount: numAmount, method: "admin" });
            return res.json({ success: true, message: `Đã CỘNG ${numAmount.toLocaleString('vi-VN')} đ cho ${username}!` });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi: " + e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Web dang chay tai port ${PORT}`);
});
