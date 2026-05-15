const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const seedDatabase = async () => {
  try {
    console.log('Seeding database...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await query(
      `INSERT INTO users (username, email, password_hash, role, trust_score) 
       VALUES ('admin', 'admin@trustescrow.com', $1, 'admin', 100)
       ON CONFLICT (email) DO NOTHING`,
      [adminPassword]
    );

    // Create moderator user
    const modPassword = await bcrypt.hash('mod123', 10);
    await query(
      `INSERT INTO users (username, email, password_hash, role, trust_score) 
       VALUES ('moderator', 'mod@trustescrow.com', $1, 'moderator', 80)
       ON CONFLICT (email) DO NOTHING`,
      [modPassword]
    );

    // Create arbitrator user
    const arbPassword = await bcrypt.hash('arb123', 10);
    await query(
      `INSERT INTO users (username, email, password_hash, role, trust_score) 
       VALUES ('arbitrator', 'arb@trustescrow.com', $1, 'arbitrator', 90)
       ON CONFLICT (email) DO NOTHING`,
      [arbPassword]
    );

    // Create demo buyer
    const buyerPassword = await bcrypt.hash('buyer123', 10);
    const buyerResult = await query(
      `INSERT INTO users (username, email, password_hash, role, trust_score) 
       VALUES ('demo_buyer', 'buyer@example.com', $1, 'user', 75)
       ON CONFLICT (email) DO UPDATE SET trust_score = 75 RETURNING id`,
      [buyerPassword]
    );
    
    const buyerId = buyerResult.rows[0].id;
    
    // Create wallet for buyer
    await query(
      `INSERT INTO wallets (user_id, balance) 
       VALUES ($1, 10000.00)
       ON CONFLICT (user_id) DO UPDATE SET balance = 10000.00`,
      [buyerId]
    );

    // Create demo seller
    const sellerPassword = await bcrypt.hash('seller123', 10);
    const sellerResult = await query(
      `INSERT INTO users (username, email, password_hash, role, trust_score) 
       VALUES ('demo_seller', 'seller@example.com', $1, 'user', 85)
       ON CONFLICT (email) DO UPDATE SET trust_score = 85 RETURNING id`,
      [sellerPassword]
    );
    
    const sellerId = sellerResult.rows[0].id;
    
    // Create wallet for seller
    await query(
      `INSERT INTO wallets (user_id, balance) 
       VALUES ($1, 5000.00)
       ON CONFLICT (user_id) DO UPDATE SET balance = 5000.00`,
      [sellerId]
    );

    console.log('✓ Seed data inserted successfully');
    console.log('\nDemo Credentials:');
    console.log('Admin: admin@trustescrow.com / admin123');
    console.log('Moderator: mod@trustescrow.com / mod123');
    console.log('Arbitrator: arb@trustescrow.com / arb123');
    console.log('Buyer: buyer@example.com / buyer123');
    console.log('Seller: seller@example.com / seller123');
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
};

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedDatabase };
