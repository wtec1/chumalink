


// testing inline payment app. developers will follow it to custom

require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));

const API_KEY = process.env.CHUMAPAY_API_KEY;
const BASE_URL = process.env.CHUMAPAY_BASE_URL || 'http://localhost:5000';  // to be replaced with actual url


// 🔍 PREVIEW (sender only)
app.post('/preview', async (req, res) => {
  try {
    const { amount, sender_id } = req.body;

    if (!amount || !sender_id) {
      return res.json({ error: 'Missing fields' });
    }

    const response = await fetch(`${BASE_URL}/api/send?preview=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ sender_id, amount }) // ✅ FIXED
    });

    const data = await response.json();
    res.json(data);

  } catch {
    res.json({ error: 'Preview failed' });
  }
});

// 🚀 PAYMENT ROUTE (sender only)
app.post('/pay', async (req, res) => {
  try {
    const { sender_id, amount, pin } = req.body;

    // ✅ validation
    if (
      !sender_id?.trim() ||
      !amount ||
      Number(amount) <= 0 ||
      !pin?.trim()
    ) {
      return res.redirect('/inline?error=Missing fields');
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);

       // define the amount to use

    // const expectedAmount = 500;

    // if (Number(req.body.amount) !== expectedAmount) {
    //   return res.redirect('/pay?error=invalid_amount');
    // }
// amount code ends here

    const response = await fetch(`${BASE_URL}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ sender_id, amount, pin }), // ✅ FIXED
      signal: controller.signal
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return res.redirect('/pay?error=Invalid API response');   //redirection page when error
    }

    if (response.ok && data.success) {
      return res.redirect(
        `/result?status=success&tx=${data.transaction_id || ''}`   //redirection page (where you are sending client after payment)
      );
    }

    return res.redirect(
      `/failure?error=${encodeURIComponent(data.error || 'Payment failed')}`
    );

  } catch (err) {
    return res.redirect(
      `/pay?error=${encodeURIComponent(err.message)}`
    );
  }
});

// home
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/inline', (req, res) => {
  res.render('inline', {
    tx: req.query.tx || null,
    status: req.query.status || 'inline payment'
  });
});

app.get('/result', (req, res) => {
  res.render('result', {
    tx: req.query.tx || null,
    status: req.query.status || 'success'
  });
});

// ❌ FAILURE PAGE
app.get('/failure', (req, res) => {
  res.render('failure', {
    error: req.query.error || null
  });
});



// 🟢 START SERVER
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Client app running on http://localhost:${PORT}`);
  console.log(`Using API: ${BASE_URL}`);
});