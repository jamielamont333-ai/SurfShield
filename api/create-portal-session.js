// /api/create-portal-session.js
// Creates a Stripe Customer Portal session for the signed-in user.
// The portal is a hosted page where customers can:
//   - cancel their subscription
//   - update their payment method
//   - download invoices
//   - update email/billing details
// We just create a session and redirect the user to Stripe's portal URL.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The /account page sends the user's Supabase auth token in the
  // Authorization header. We validate it server-side to confirm the
  // request is from a real signed-in user, not a random visitor.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ error: 'not_signed_in', message: 'No auth token provided.' });
  }

  try {
    // Validate the token and identify the user.
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData || !userData.user) {
      return res.status(401).json({ error: 'invalid_session', message: 'Your session has expired. Please sign in again.' });
    }
    const userId = userData.user.id;

    // Find the user's most recent subscription so we can get the
    // Stripe customer ID. (If a user has multiple subs over time, the
    // most recent is the one we want to manage.)
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('Subscription lookup error:', subError);
      return res.status(500).json({ error: 'lookup_failed', message: 'Could not load your subscription.' });
    }

    if (!sub || !sub.stripe_customer_id) {
      return res.status(404).json({
        error: 'no_subscription',
        message: 'No subscription found on this account. If you just paid, give it a minute and try again.'
      });
    }

    // Create the portal session. After they're done, Stripe redirects
    // them back to /account.
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: 'https://www.getsurfshield.com/account'
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal session error:', err);
    return res.status(500).json({ error: 'portal_failed', message: err.message });
  }
};
