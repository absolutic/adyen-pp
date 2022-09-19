const express = require("express");
const path = require("path");
const hbs = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");
const { Client, Config, CheckoutAPI } = require("@adyen/api-library");
const app = express();

// 4111111145551142 visa
// 6036280000000000000 givex

// Set up request logging
app.use(morgan("dev"));
// Parse JSON bodies
app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
// Serve client from build folder
app.use(express.static(path.join(__dirname, "/public")));

// Enables environment variables by parsing the .env file and assigning it to process.env
dotenv.config({
  path: "./.env",
});

// Adyen Node.js API library boilerplate (configuration, etc.)
const config = new Config();
config.apiKey = process.env.API_KEY;
const client = new Client({ config });
client.setEnvironment("TEST");
const checkout = new CheckoutAPI(client);

app.engine(
  "handlebars",
  hbs({
    defaultLayout: "main",
    layoutsDir: __dirname + "/views/layouts",
    partialsDir: __dirname + "/views/partials",
  })
);

app.set("view engine", "handlebars");

const paymentDataStore = {};

// Get payment methods
app.get("/", async (req, res) => {
  try {
    const response = await checkout.paymentMethods({
      channel: "Web",
      merchantAccount: process.env.MERCHANT_ACCOUNT,
    });
    res.render("payment", {
      clientKey: process.env.CLIENT_KEY,
      response: JSON.stringify(response),
    });
    console.log("payment methods");
    console.log(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.post("/api/initiatePayment", async (req, res) => {
  try {
    const orderRef = uuid();
    // Ideally the data passed here should be computed based on business logic
    const response = await checkout.payments({
      amount: { currency: "EUR", value: 50 * 100 }, // value is 10€ in minor units
      reference: orderRef,
      merchantAccount: process.env.MERCHANT_ACCOUNT,
      channel: "Web",
      additionalData: {
        allow3DS2: true,
      },
      returnUrl: `http://localhost:8080/api/handleShopperRedirect?orderRef=${orderRef}`,
      browserInfo: req.body.browserInfo,
      paymentMethod: req.body.paymentMethod,
      order: req.body.order,
    });

    let resultCode = response.resultCode;
    let action = null;

    if (response.action) {
      action = response.action;
      paymentDataStore[orderRef] = action.paymentData;
    }
    res.json({ resultCode, action, order: response.order });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.all("/api/handleShopperRedirect", async (req, res) => {
  // Create the payload for submitting payment details
  const payload = {};
  payload["details"] = req.method === "GET" ? req.query : req.body;

  const orderRef = req.query.orderRef;
  payload["paymentData"] = paymentDataStore[orderRef];
  delete paymentDataStore[orderRef];

  try {
    const response = await checkout.paymentsDetails(payload);
    // Conditionally handle different result codes for the shopper
    switch (response.resultCode) {
      case "Authorised":
        res.redirect("/success");
        break;
      case "Pending":
      case "Received":
        res.redirect("/pending");
        break;
      case "Refused":
        res.redirect("/failed");
        break;
      default:
        res.redirect("/error");
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.redirect("/error");
  }
});

// Handle submitting additional details
app.post("/api/submitAdditionalDetails", async (req, res) => {
  // Create the payload for submitting payment details
  const payload = {};
  payload["details"] = req.body.details;
  payload["paymentData"] = req.body.paymentData;

  try {
    // Return the response back to client (for further action handling or presenting result to shopper)
    const response = await checkout.paymentsDetails(payload);
    let resultCode = response.resultCode;
    let action = response.action || null;

    res.json({ action, resultCode });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

const URL_BASE = `${config.checkoutEndpoint}/${Client.CHECKOUT_API_VERSION}`;

app.post("/api/balanceCheck", async (req, res) => {
  console.log("Balance check");
  try {
    const request = {
      paymentMethod: {
        type: "givex",
        number: "6036280000000000000",
        cvc: "123",
      },
      merchantAccount: process.env.MERCHANT_ACCOUNT,
    };
    const response = await client.httpClient.request(
      `${URL_BASE}/paymentMethods/balance`,
      JSON.stringify(request),
      config,
      true,
      {}
    );
    //console.log(response);
    res.json({
      balance: {
        value: 50 * 100,
        currency: "EUR",
      },
    });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.post("/api/orderRequest", async (req, res) => {
  const request = {
    reference: "1234",
    amount: {
      value: 100 * 100,
      currency: "EUR",
    },
    merchantAccount: process.env.MERCHANT_ACCOUNT,
  };
  try {
    const response = await client.httpClient.request(
      `${URL_BASE}/orders`,
      JSON.stringify(request),
      config,
      true,
      {}
    );
    res.json(JSON.parse(response));
    return response;
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.post("/api/orderCancel", async (req, res) => {
  const orderCancel = {
    order: {
      pspReference: "12345",
      orderData: "12345",
    },
    merchantAccount: process.env.MERCHANT_ACCOUNT,
  };
  try {
    const response = client.httpClient.request(
      "/orders/cancel",
      JSON.stringify(request),
      config
    );
    console.log(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

// Authorised result page
app.get("/success", (req, res) => res.render("success"));

// Pending result page
app.get("/pending", (req, res) => res.render("pending"));

// Error result page
app.get("/error", (req, res) => res.render("error"));

// Refused result page
app.get("/failed", (req, res) => res.render("failed"));

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
