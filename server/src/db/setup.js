
import "dotenv/config";
import { pool } from "./pool.js";

const sql = `
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS equipment (
  id BIGSERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  rental_price NUMERIC(12,2) NOT NULL CHECK (rental_price >= 0),
  rental_type TEXT NOT NULL CHECK (rental_type IN ('Daily','Weekly','Monthly')),
  available_quantity INTEGER NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
  condition TEXT DEFAULT 'Good',
  brand TEXT DEFAULT '',
  model TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS equipment_status_idx ON equipment(status);
CREATE INDEX IF NOT EXISTS equipment_category_idx ON equipment(category);
CREATE INDEX IF NOT EXISTS equipment_owner_idx ON equipment(owner_id);
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, equipment_id)
);
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  equipment_id BIGINT NOT NULL REFERENCES equipment(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  contact_number TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  notes TEXT DEFAULT '',
  total_amount NUMERIC(12,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  booking_status TEXT NOT NULL DEFAULT 'Pending',
  stripe_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO reviews(customer_name,rating,comment)
SELECT * FROM (VALUES
 ('Nadia Rahman',5,'The booking process was clear and the equipment arrived on time.'),
 ('Rafi Ahmed',5,'A practical way to rent professional tools without buying them.'),
 ('Mitu Sarker',4,'Helpful owner and flexible rental period.'),
 ('Tanvir Hasan',5,'Smooth experience and transparent pricing.')
) AS v(customer_name,rating,comment)
WHERE NOT EXISTS (SELECT 1 FROM reviews);
INSERT INTO equipment(owner_id,name,description,category,location,rental_price,rental_type,available_quantity,condition,brand,model,image_url,terms,status)
SELECT 'geargrid-demo-owner', v.name, v.description, v.category, v.location, v.price, v.rental_type, v.qty, 'Good', v.brand, v.model, v.image, 'Handle equipment responsibly and return it in the same condition.', 'Approved'
FROM (VALUES
 ('Mini Excavator','Compact excavator for landscaping and small construction projects.','Construction Equipment','Dhaka',95.00,'Daily',2,'CAT','301.7','https://images.unsplash.com/photo-1580901368919-7738efb0f87e?w=900'),
 ('Mirrorless Camera Kit','A versatile camera kit for events, portraits and content production.','Photography Equipment','Dhaka',45.00,'Daily',3,'Sony','A7 III','https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900'),
 ('Utility Pickup','Reliable pickup for moving equipment and materials.','Vehicles & Transportation','Savar',70.00,'Daily',1,'Toyota','Hilux','https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=900'),
 ('Power Tiller','Field-ready tiller for seasonal agricultural work.','Agriculture Equipment','Gazipur',32.00,'Daily',2,'Kubota','K1 Series','https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900'),
 ('Portable Generator','Quiet portable generator for backup power and outdoor work.','Electronics','Narayanganj',28.00,'Daily',4,'Honda','EU30is','https://images.unsplash.com/photo-1473341304170-9719d5f9c9c6?w=900'),
 ('Event Sound System','Speaker and mixer package for small and medium events.','Event Equipment','Dhaka',110.00,'Daily',2,'JBL','EON Series','https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900')
) AS v(name,description,category,location,price,rental_type,qty,brand,model,image)
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE owner_id='geargrid-demo-owner');
`;
try {
  await pool.query(sql);
  console.log("Application database tables are ready.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
