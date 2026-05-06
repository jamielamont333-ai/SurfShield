// api/test-supabase.js
// Temporary endpoint to verify Supabase connection works.
// Returns a count of rows in the users table.
// Delete this file once we've confirmed connectivity.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify env vars are present
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({
        error: 'Missing Supabase configuration',
        hasUrl: !!supabaseUrl,
        hasSecretKey: !!supabaseSecretKey
      });
    }

    // Create Supabase client with the secret key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Test 1: Count users (should be 0 since we haven't added any)
    const { count: userCount, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('Users query failed:', usersError);
      return res.status(500).json({
        error: 'Could not query users table',
        details: usersError.message
      });
    }

    // Test 2: Count subscriptions
    const { count: subscriptionCount, error: subsError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true });

    if (subsError) {
      console.error('Subscriptions query failed:', subsError);
      return res.status(500).json({
        error: 'Could not query subscriptions table',
        details: subsError.message
      });
    }

    // Test 3: Count licenses
    const { count: licenseCount, error: licensesError } = await supabase
      .from('licenses')
      .select('*', { count: 'exact', head: true });

    if (licensesError) {
      console.error('Licenses query failed:', licensesError);
      return res.status(500).json({
        error: 'Could not query licenses table',
        details: licensesError.message
      });
    }

    // All good
    return res.status(200).json({
      success: true,
      message: 'Supabase connection working perfectly!',
      tables: {
        users: userCount ?? 0,
        subscriptions: subscriptionCount ?? 0,
        licenses: licenseCount ?? 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Test endpoint error:', err);
    return res.status(500).json({
      error: 'Unexpected error',
      details: err.message
    });
  }
}
