


// testing inline payment app. developers will follow it to custom

require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();



const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true'
});


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

     // define the amount to use

    const expectedAmount = 500;

if (Number(req.body.amount) !== expectedAmount) {
  return res.redirect('/pay?error=invalid_amount');
}
// amount code ends here

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

// 🚀 PAYMENT ROUTE (sender only) with or without webhook

// app.post('/pay', async (req, res) => {
//   try {
//     const { sender_id, amount, pin } = req.body;

//     // ✅ validation
//     if (
//       !sender_id?.trim() ||
//       !amount ||
//       Number(amount) <= 0 ||
//       !pin?.trim()
//     ) {
//       return res.redirect('/inline?error=Missing fields');
//     }

//     // ✅ get developer settings
//     const devRes = await fetch(`${BASE_URL}/api/developer/me`, {
//       headers: {
//         Authorization: `Bearer ${API_KEY}`
//       }
//     });

//     const developer = await devRes.json();

//     const successUrl = developer?.success_url || '/result';   //redirect users after pay
//     const failureUrl = developer?.failure_url || '/failure';               // to failure page

//     // ✅ call API
//     const controller = new AbortController();
//     setTimeout(() => controller.abort(), 8000);

//     const response = await fetch(`${BASE_URL}/api/send`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${API_KEY}`
//       },
//       body: JSON.stringify({ sender_id, amount, pin }),
//       signal: controller.signal
//     });

//     // ✅ safe parse
//     let data;
//     try {
//       const text = await response.text();
//       console.log('API RAW RESPONSE:', text);
//       data = JSON.parse(text);
//     } catch {
//       return res.redirect(`${failureUrl}?error=invalid_api_response`);
//     }

//     // ✅ success
//     if (response.ok && data.success) {
//       return res.redirect(
//         `${successUrl}?status=success&tx=${data.transaction_id || ''}`
//       );
//     }

//     // ❌ failure
//     return res.redirect(
//       `${failureUrl}?error=${encodeURIComponent(data.error || 'payment_failed')}`
//     );

//   } catch (err) {
//     return res.redirect(
//       `/pay?error=${encodeURIComponent(err.message)}`
//     );
//   }
// });


// if you want to direct user to result.ejs after db is updated then follow logic below

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

    // define the amount to use

//     const expectedAmount = 6000;

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
      body: JSON.stringify({ sender_id, amount, pin })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return res.redirect(
        `/failure?error=${encodeURIComponent(data.error || 'payment_failed')}`
      );
    }

    const tx = data.transaction_id;

    // 🔐 wait for webhook to save DB
    let attempts = 0;
    let verified = false;

    while (attempts < 10) {
      const check = await pool.query(
        `SELECT status FROM webhook_events WHERE transaction_id=$1`,
        [tx]
      );

      if (check.rows.length && check.rows[0].status === 'SUCCESS') {
        verified = true;
        break;
      }

      await new Promise(r => setTimeout(r, 1000)); // wait 1s
      attempts++;
    }

    if (!verified) {
      return res.redirect(`/failure?error=not_verified`);
    }

    // ✅ only after DB update
    return res.redirect(`/result?status=success&tx=${tx}`);

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

      app.get('/pay', (req, res) => {
       res.render('pay', {
          error: req.query.error || null
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

    // webhook testing 
    // app.post('/webhook', (req, res) => {
    //   console.log('WEBHOOK HIT:', req.body);
    //   res.sendStatus(200);
    // });


// if you want to direct user to result.ejs after db is updated then follow logic below
    app.post('/webhook', async (req, res) => {
  const { status, transaction_id, amount } = req.body;

  await pool.query(
    `INSERT INTO webhook_events (transaction_id, status, amount)
     VALUES ($1,$2,$3)`,
    [transaction_id, status, amount]
  );

  console.log('WEBHOOK SAVED');
  res.sendStatus(200);
});


// 🟢 START SERVER
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Client app running on http://localhost:${PORT}`);
  console.log(`Using API: ${BASE_URL}`);
});