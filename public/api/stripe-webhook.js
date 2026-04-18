import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const session = event.data.object;
    const customerId = session.customer;
    const subId = session.subscription || session.id;
    const proToken = Buffer.from(`${customerId}:${subId}:${Date.now()}`).toString('base64');
    const expiryMs = Date.now() + (31 * 24 * 60 * 60 * 1000);
    console.log('Pro activated for customer:', customerId);
    return res.status(200).json({ received: true, proToken, expiryMs });
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    event.type === 'invoice.payment_failed'
  ) {
    console.log('Subscription ended for:', event.data.object.customer);
    return res.status(200).json({ received: true, downgraded: true });
  }

  return res.status(200).json({ received: true });
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export const config = {
  api: { bodyParser: false }
};
