const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Bakong API Configuration (ដាក់ Token ពិត និង Account ID របស់អ្នក)
const BAKONG_TOKEN = 'eyJhbGciOiJIUzI1NiIs...'; 
const BAKONG_ACCOUNT_ID = 'samnang_mon@bkrt';

// Database ស្តុក Account ពិតប្រាកដ
let accountStock = {
    'netflix': [
        { id: 1, info: 'Email: netflix1@gmail.com | Pass: 123456' },
        { id: 2, info: 'Email: netflix2@gmail.com | Pass: 654321' }
    ],
    'youtube': [
        { id: 1, info: 'Email: yt1@gmail.com | Pass: ytpass123' }
    ]
};

// រក្សាទុកប្រវត្តិនៃការបង្កើត QR សម្រាប់ឆែកមើលទឹកប្រាក់
let pendingTransactions = {};

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="km">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Samnang Account Shop</title>
            <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
        </head>
        <body class="bg-gray-100 font-sans">
            <div class="container mx-auto px-4 py-8 max-w-2xl">
                <h1 class="text-3xl font-bold text-center text-blue-600 mb-2">Samnang Account Shop</h1>
                <p class="text-center text-gray-600 mb-8">ហាងលក់គណនីឌីជីថលស្វ័យប្រវត្តិ ២៤ម៉ោង</p>

                <div id="product-list" class="space-y-4">
                    <div class="bg-white p-4 rounded-xl shadow flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-lg">Netflix Premium 1 Month</h3>
                            <p class="text-green-600 font-semibold">$0.50</p>
                        </div>
                        <button onclick="buyProduct('netflix', 0.50, 'Netflix Premium 1 Month')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">ទិញឥឡូវនេះ</button>
                    </div>

                    <div class="bg-white p-4 rounded-xl shadow flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-lg">YouTube Premium 1 Month</h3>
                            <p class="text-green-600 font-semibold">$0.50</p>
                        </div>
                        <button onclick="buyProduct('youtube', 0.50, 'YouTube Premium 1 Month')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">ទិញឥឡូវនេះ</button>
                    </div>
                </div>

                <div id="payment-section" class="hidden bg-white p-6 rounded-xl shadow mt-6 text-center">
                    <h2 id="selected-product-title" class="text-xl font-bold mb-4"></h2>
                    <p class="text-gray-600 mb-2">សូមស្កេន KHQR ខាងក្រោមដើម្បីទូទាត់ប្រាក់៖</p>
                    <div class="flex justify-center my-4">
                        <canvas id="qrcode-canvas" class="border p-2 rounded"></canvas>
                    </div>
                    <p id="payment-status" class="text-orange-500 font-semibold animate-pulse">⏳ កំពុងរង់ចាំការបង់ប្រាក់...</p>
                </div>

                <div id="success-section" class="hidden bg-green-50 border border-green-200 p-6 rounded-xl shadow mt-6 text-center">
                    <h2 class="text-2xl font-bold text-green-700 mb-2">🎉 ទូទាត់ប្រាក់ជោគជ័យ!</h2>
                    <p class="text-gray-700 mb-4">ព័ត៌មានគណនីរបស់អ្នកគឺ៖</p>
                    <div id="account-result" class="bg-white p-4 rounded border font-mono text-lg text-blue-800 select-all font-bold"></div>
                </div>
            </div>

            <script>
                let checkInterval;
                async function buyProduct(productId, amount, title) {
                    document.getElementById('selected-product-title').innerText = 'ទូទាត់ប្រាក់សម្រាប់: ' + title + ' ($' + amount + ')';
                    document.getElementById('payment-section').classList.remove('hidden');
                    document.getElementById('success-section').classList.add('hidden');

                    try {
                        const res = await fetch('/api/create-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ productId, amount })
                        });
                        const data = await res.json();
                        if (data.success) {
                            QRCode.toCanvas(document.getElementById('qrcode-canvas'), data.qrString, { width: 220 });
                            startCheckingPayment(data.md5, productId);
                        } else {
                            alert(data.message);
                        }
                    } catch (err) {
                        alert('មានបញ្ហាក្នុងការតភ្ជាប់!');
                    }
                }

                function startCheckingPayment(md5, productId) {
                    if (checkInterval) clearInterval(checkInterval);
                    checkInterval = setInterval(async () => {
                        try {
                            const res = await fetch('/api/check-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ md5, productId })
                            });
                            const data = await res.json();
                            if (data.success && data.paid) {
                                clearInterval(checkInterval);
                                document.getElementById('payment-section').classList.add('hidden');
                                document.getElementById('success-section').classList.remove('hidden');
                                document.getElementById('account-result').innerText = data.accountInfo;
                            }
                        } catch (err) {
                            console.error('Checking...');
                        }
                    }, 3000);
                }
            </script>
        </body>
        </html>
    `);
});

// 1. បង្កើត KHQR ជាមួយ Bakong API
app.post('/api/create-payment', async (req, res) => {
    const { productId, amount } = req.body;
    
    if (!accountStock[productId] || accountStock[productId].length === 0) {
        return res.status(400).json({ success: false, message: 'ទំនិញនេះអស់ស្តុកហើយ!' });
    }

    try {
        const response = await axios.post('https://api-bakong.nbc.gov.kh/v1/generate_qr_for_deeplink', {
            account_info: BAKONG_ACCOUNT_ID,
            amount: amount,
            currency: 'USD',
            description: `Payment for ${productId}`
        }, {
            headers: {
                'Authorization': `Bearer ${BAKONG_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.responseCode === 0) {
            const md5 = response.data.data.md5;
            // រក្សាទុកสถานะថា QR នេះមិនទាន់បង់លុយទេ
            pendingTransactions[md5] = { productId, paid: false };

            res.json({
                success: true,
                qrString: response.data.data.qrString,
                md5: md5
            });
        } else {
            res.status(400).json({ success: false, message: 'បរាជ័យក្នុងការបង្កើត KHQR' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Bakong API Error' });
    }
});

// 2. ពិនិត្យទឹកប្រាក់ចូលពិតប្រាកដពី Bakong
app.post('/api/check-payment', async (req, res) => {
    const { md5, productId } = req.body;

    try {
        // ហៅ Bakong API ដើម្បីឆែកមើល Transaction តាមរយៈ md5
        const checkRes = await axios.post('https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5', {
            md5: md5
        }, {
            headers: {
                'Authorization': `Bearer ${BAKONG_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        // បើ Bakong ឆ្លើយតបមកវិញថាមានទឹកប្រាក់ចូលជោគជ័យ (responseCode === 0 គឺមានន័យថាបានបង់ប្រាក់)
        if (checkRes.data && checkRes.data.responseCode === 0) {
            // ទាញយក Account ពីក្នុងស្តុក
            const stockList = accountStock[productId];
            if (stockList && stockList.length > 0) {
                const purchasedAccount = stockList.shift(); // កាត់ស្តុកចេញ
                return res.json({
                    success: true,
                    paid: true,
                    accountInfo: purchasedAccount.info
                });
            } else {
                return res.json({ success: false, message: 'លុយចូលហើយ តែទំនិញអស់ស្តុក!' });
            }
        } else {
            // មិនទាន់មានលុយចូល
            res.json({ success: true, paid: false });
        }
    } catch (error) {
        // ករណីកំពុងរង់ចាំ ឬ Error ពី API
        res.json({ success: true, paid: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
