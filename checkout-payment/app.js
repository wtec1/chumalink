// server.js for ChumaPay checkout page

require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// policy


const API_KEY = process.env.CHUMAPAY_API_KEY;
const BASE_URL = process.env.CHUMAPAY_BASE_URL || 'http://localhost:5000';  //to be replaced with actual chumaLink url

// 🚀 CREATE CHECKOUT
app.post('/pay', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.redirect(`/failure?error=invalid_amount`);
    }

       // define the amount to use

    // const expectedAmount = 500;

    // if (Number(req.body.amount) !== expectedAmount) {
    //   return res.redirect('/pay?error=invalid_amount');
    // }
// amount code ends here

    const response = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        amount: Number(amount),
        reference: `live_${Date.now()}`,
        success_url: 'http://localhost:4000/success',
        failure_url: 'http://localhost:4000/failure'
      })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return res.redirect(`/failure?error=invalid_api_response`);
    }

    // ✅ go to hosted checkout
    if (response.ok && data.checkout_url) {
      return res.redirect(data.checkout_url);
    }
    

    // ❌ API failed → go to failure page
    return res.redirect(
      `/failure?error=${encodeURIComponent(data.error || 'checkout_failed')}`
    );

  } catch (err) {
    console.error(err.message);
    return res.redirect(
      `/failure?error=${encodeURIComponent(err.message)}`
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

app.get('/success', (req, res) => {
  res.render('success', {
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


// app.get('/result', (req, res) => {
//   res.render('result');
// });


// // ✅ SUCCESS PAGE
// app.get('/success', (req, res) => {
//   res.render('success', {
//     tx: req.query.tx || null
//   });
// });



// 🟢 START SERVER
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Client app running on http://localhost:${PORT}`);
  console.log(`Using API: ${BASE_URL}`);
});