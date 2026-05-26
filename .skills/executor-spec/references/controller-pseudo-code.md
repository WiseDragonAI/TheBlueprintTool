```ts
async function submitCheckoutController({
  action_payload,
  runtime_state,
  data_model,
}: {
  action_payload: {
    submit_requested: true
  }
  runtime_state: {
    checkout_status: 'idle' | 'submitting' | 'failed' | 'completed'
    has_selected_shipping_option: boolean
  }
  data_model: {
    cart_exists: boolean
    user_exists: boolean
    inventory_available: boolean
  }
}) {
  telemetry('submit-checkout-controller-started')

  const cart = resolveCart()

  if (!cart) {
    telemetry('submit-checkout-cart-missing')
    showCheckoutError()
    return
  }

  const user = resolveCurrentUser()

  if (!user) {
    telemetry('submit-checkout-user-missing')
    redirectToLogin()
    return
  }

  const user_owns_cart = validateCartOwnership()

  if (!user_owns_cart) {
    telemetry('submit-checkout-cart-ownership-rejected')
    showCheckoutError()
    return
  }

  const checkout_status = resolveCheckoutStatus()

  if (checkout_status === 'submitting') {
    telemetry('submit-checkout-already-submitting')
    showCheckoutPendingFeedback()
    return
  }

  const shipping_option_id = resolveSelectedShippingOption()

  if (!shipping_option_id) {
    telemetry('submit-checkout-shipping-option-missing')
    showCheckoutError()
    return
  }

  const inventory_check = validateInventoryAvailability()

  if (!inventory_check.ok) {
    telemetry('submit-checkout-inventory-rejected')
    showCheckoutError()
    return
  }

  telemetry('submit-checkout-accepted')

  setCheckoutStatus()

  const payment_result = await authorizePayment()

  if (!payment_result.ok) {
    telemetry('submit-checkout-payment-rejected')
    setCheckoutStatus()
    showCheckoutError()
    return
  }

  const order = await createOrder()

  telemetry('submit-checkout-order-created')

  setCheckoutStatus()

  navigateToOrderConfirmation()

  showCheckoutSuccess()

  telemetry('submit-checkout-controller-completed')
}
```
