// Global key for canMakePayment cache.
const canMakePaymentCache = 'canMakePaymentCache';

/**
 * Check whether can make payment with Google Pay or not. It will check session storage
 * cache first and use the cache directly if it exists. Otherwise, it will call
 * canMakePayment method from PaymentRequest object and return the result, the
 * result will also be stored in the session storage cache for future usage.
 *
 * @private
 * @param {PaymentRequest} request The payment request object.
 * @return {Promise} a promise containing the result of whether can make payment.
 */
function checkCanMakePayment(request) {
    // Check canMakePayment cache, use cache result directly if it exists.
    if (sessionStorage.hasOwnProperty(canMakePaymentCache)) {
        return Promise.resolve(JSON.parse(sessionStorage[canMakePaymentCache]));
    }

    // If canMakePayment() isn't available, default to assume the method is
    // supported.
    var canMakePaymentPromise = Promise.resolve(true);

    // Feature detect canMakePayment().
    if (request.canMakePayment) {
        canMakePaymentPromise = request.canMakePayment();
    }

    return canMakePaymentPromise
        .then((result) => {
            // Store the result in cache for future usage.
            sessionStorage[canMakePaymentCache] = result;
            return result;
        })
        .catch((err) => {
            console.log('Error calling canMakePayment: ' + err);
        });
}

/** Launches payment request flow when user taps on buy button. */
function onBuyClicked() {
    console.log('Buy button clicked');

    // Fetch the total amount dynamically
    jQuery.ajax({
        url: wc_ajax.ajax_url,
        type: 'POST',
        data: { action: 'get_cart_total' },
        success: function(response) {
            if (response.success) {
                var amount = parseFloat(response.data.total);

                // Check if amount is a valid number
                if (isNaN(amount) || amount <= 0) {
                    console.log('Invalid amount');
                    return;
                }

                console.log('Buy button clicked with amount: ' + amount);

                if (!window.PaymentRequest) {
                    console.log('Web payments are not supported in this browser.');
                    return;
                }

                // Create supported payment method.
                const supportedInstruments = [
                    {
                        supportedMethods: ['https://tez.google.com/pay'],
                        data: {
                            pa: 'vaseegrahveda@kvb',
                            pn: 'Vaseegrah Veda',
                            tr: '1894ZXCV',  // Your custom transaction reference ID
                            url: 'https://google.com',
                            mc: '5799', //Your merchant category code
                            tn: 'Purchase in Merchant',
                        },
                    }
                ];

                const totalAmount = amount;
                console.log('Total Amount: ' + totalAmount);

                const details = {
                    total: {
                        label: 'Total (including shipping)',
                        amount: {
                            currency: 'INR',
                            value: totalAmount.toFixed(2),
                        },
                    },
                };

                // Create payment request object.
                let request = null;
                try {
                    request = new PaymentRequest(supportedInstruments, details);
                } catch (e) {
                    console.log('Payment Request Error: ' + e.message);
                    return;
                }
                if (!request) {
                    console.log('Web payments are not supported in this browser.');
                    return;
                }

                var canMakePaymentPromise = checkCanMakePayment(request);
                canMakePaymentPromise
                    .then((result) => {
                        showPaymentUI(request, result);
                    })
                    .catch((err) => {
                        console.log('Error calling checkCanMakePayment: ' + err);
                    });
            } else {
                console.log('Error fetching cart total: ' + response.data);
            }
        }
    });
}

/**
 * Show the payment request UI.
 *
 * @private
 * @param {PaymentRequest} request The payment request object.
 * @param {Promise} canMakePayment The promise for whether can make payment.
 */
function showPaymentUI(request, canMakePayment) {
    if (!canMakePayment) {
        handleNotReadyToPay();
        return;
    }

    // Set payment timeout.
    let paymentTimeout = window.setTimeout(function () {
        window.clearTimeout(paymentTimeout);
        request.abort()
            .then(function () {
                console.log('Payment timed out after 20 minutes.');
            })
            .catch(function () {
                console.log('Unable to abort, user is in the process of paying.');
            });
    }, 20 * 60 * 1000); /* 20 minutes */

    request.show()
        .then(function (instrument) {
            window.clearTimeout(paymentTimeout);
            processResponse(instrument); // Handle response from browser.
        })
        .catch(function (err) {
            console.log(err);
        });
}

/** Handle Google Pay not ready to pay case. */
function handleNotReadyToPay() {
    alert('Google Pay is not ready to pay.');
}

/**
 * Process the response from browser.
 *
 * @private
 * @param {PaymentResponse} instrument The payment instrument that was authed.
 */
function processResponse(instrument) {
    var instrumentString = instrumentToJsonString(instrument);
    console.log(instrumentString);

    fetch('/buy', {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: instrumentString,
    })
        .then(function (buyResult) {
            if (buyResult.ok) {
                return buyResult.json();
            }
            console.log('Error sending instrument to server.');
        })
        .then(function (buyResultJson) {
            completePayment(instrument, buyResultJson.status, buyResultJson.message);
        })
        .catch(function (err) {
            console.log('Unable to process payment. ' + err);
        });
}

/**
 * Notify browser that the instrument authorization has completed.
 *
 * @private
 * @param {PaymentResponse} instrument The payment instrument that was authed.
 * @param {string} result Whether the auth was successful. Should be either
 * 'success' or 'fail'.
 * @param {string} msg The message to log in console.
 */
function completePayment(instrument, result, msg) {
    instrument.complete(result)
        .then(function () {
            console.log('Payment succeeds.');
            console.log(msg);
        })
        .catch(function (err) {
            console.log(err);
        });
}

/**
 * Converts the payment response into a JSON string.
 *
 * @private
 * @param {PaymentResponse} paymentResponse The payment response to convert.
 * @return {string} The string representation of the payment response.
 */
function instrumentToJsonString(paymentResponse) {
    // PaymentResponse is an interface, JSON.stringify works only on dictionaries.
    var paymentResponseDictionary = {
        methodName: paymentResponse.methodName,
        details: paymentResponse.details,
        shippingAddress: addressToJsonString(paymentResponse.shippingAddress),
        shippingOption: paymentResponse.shippingOption,
        payerName: paymentResponse.payerName,
        payerPhone: paymentResponse.payerPhone,
        payerEmail: paymentResponse.payerEmail,
    };
    return JSON.stringify(paymentResponseDictionary, undefined, 2);
}

/**
 * Converts the address into a JSON string.
 *
 * @private
 * @param {PaymentAddress} address The address to convert.
 * @return {string} The string representation of the address.
 */
function addressToJsonString(address) {
    if (!address) {
        return null;
    }
    var addressDictionary = {
        country: address.country,
        addressLine: address.addressLine,
        region: address.region,
        city: address.city,
        dependentLocality: address.dependentLocality,
        postalCode: address.postalCode,
        sortingCode: address.sortingCode,
        languageCode: address.languageCode,
        organization: address.organization,
        recipient: address.recipient,
        phone: address.phone,
    };
    return JSON.stringify(addressDictionary, undefined, 2);
}