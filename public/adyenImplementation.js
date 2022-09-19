const paymentMethodsResponse = JSON.parse(
  document.getElementById("paymentMethodsResponse").innerHTML
);
const clientKey = document.getElementById("clientKey").innerHTML;

const giftcardConfiguration = {
  async onBalanceCheck(resolve, reject, data) {
    // Make a POST /paymentMethods/balance request
    try {
      const response = await callServer("/api/balanceCheck", {});
      resolve(response); /*interface PaymentAmount {
        value: number;
        currency: string;
    } */
      // typeof { balance: PaymentAmount; transactionLimit?: PaymentAmount; }
      //return handleServerResponse(response, component);
    } catch (error) {
      reject(error);
    }
  },
  async onOrderRequest(resolve, reject, data) {
    try {
      const response = await callServer("/api/orderRequest", {});
      resolve(response); /*interface PaymentAmount {
        value: number;
        currency: string;
    } */
      // typeof { balance: PaymentAmount; transactionLimit?: PaymentAmount; }
      //return handleServerResponse(response, component);
    } catch (error) {
      reject(error);
    }
    // Make a POST /orders request
    // Create an order for the total transaction amount
    //handleSubmit(state, component, "/api/orderRequest");
    // typeof { orderData: string; pspReference: string }
    //resolve(OrderResponse);
  },
  onOrderCancel: function (Order) {
    // Make a POST /orders/cancel request
    handleSubmit(state, component, "/api/orderCancel");
  },
  amount: { value: 100 * 100, currency: "EUR" },
};

const configuration = {
  clientKey,
  locale: "en_US",
  environment: "test",
  paymentMethodsResponse: {
    paymentMethods: [
      {
        brands: ["visa", "mc", "amex"],
        name: "Credit Card",
        type: "scheme",
      },
      {
        name: "Afterpay",
        type: "afterpaytouch",
      },
      {
        brands: ["amex", "mc", "visa"],
        configuration: {
          merchantId: "000000000204413",
          merchantName: "ProvidoorAusPtyLtdECOM",
        },
        name: "Apple Pay",
        type: "applepay",
      },
      { brand: "givex", name: "Givex", type: "giftcard" },
      {
        configuration: {
          gatewayMerchantId: "ProvidoorAusPtyLtdECOM",
          merchantId: "50",
        },
        name: "Google Pay",
        type: "paywithgoogle",
      },
    ],
  },
  paymentMethodsConfiguration: {
    card: {
      hasHolderName: true,
    },
    giftcard: giftcardConfiguration,
  },
  onSubmit: (state, component) => {
    handleSubmit(state, component, "/api/initiatePayment");
  },
  onAdditionalDetails: (state, component) => {
    handleSubmit(state, component, "/api/submitAdditionalDetails");
  },
};

async function callServer(url, data) {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.json();
  } catch (error) {
    console.error(error);
  }
}

// Event handlers called when the shopper selects the pay button,
// or when additional information is required to complete the payment
async function handleSubmit(state, component, url) {
  try {
    const response = await callServer(url, state.data);
    component.handleResponse(response);
  } catch (error) {
    console.error(error);
  }
}

const checkoutPromise = new AdyenCheckout(configuration);

checkoutPromise.then((checkout) => {
  const integration = checkout
    .create("dropin")
    .mount(document.getElementById("dropin"));
});
