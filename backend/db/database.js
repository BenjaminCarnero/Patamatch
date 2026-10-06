require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
// Removed dns override to prevent Vercel ENOTFOUND

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

let dbInitialized = false;

async function initDatabase() {
  if (dbInitialized) return pool;

  console.log('📦 Connecting to PostgreSQL...');

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      city TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      species TEXT NOT NULL DEFAULT '',
      breed TEXT DEFAULT '',
      age TEXT DEFAULT '',
      size TEXT DEFAULT '',
      location TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      badge TEXT DEFAULT NULL,
      badge_color TEXT DEFAULT NULL,
      description TEXT DEFAULT '',
      is_adopted INTEGER DEFAULT 0,
      adopted_quote TEXT DEFAULT '',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lost_pets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      breed TEXT DEFAULT '',
      location TEXT DEFAULT '',
      last_seen TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      badge TEXT DEFAULT NULL,
      marker_top TEXT DEFAULT '50%',
      marker_left TEXT DEFAULT '50%',
      marker_image TEXT DEFAULT '',
      is_found INTEGER DEFAULT 0,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      category TEXT DEFAULT 'tips',
      tags TEXT DEFAULT '[]',
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stories (
      id SERIAL PRIMARY KEY,
      pet_name TEXT NOT NULL,
      author_name TEXT DEFAULT '',
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      badge TEXT DEFAULT '',
      is_approved INTEGER DEFAULT 0,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      pet_id INTEGER NOT NULL,
      UNIQUE(user_id, pet_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carnets (
      id SERIAL PRIMARY KEY,
      pet_name TEXT NOT NULL,
      species TEXT DEFAULT '',
      breed TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      color_markings TEXT DEFAULT '',
      microchip_id TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      qr_url TEXT DEFAULT '',
      birth_date TEXT DEFAULT '',
      vaccinations TEXT DEFAULT '[]',
      medical_history TEXT DEFAULT '[]',
      vet_name TEXT DEFAULT '',
      vet_clinic TEXT DEFAULT '',
      vet_phone TEXT DEFAULT '',
      vet_image TEXT DEFAULT '',
      owner_name TEXT DEFAULT '',
      owner_city TEXT DEFAULT '',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      pet_id INTEGER NOT NULL,
      adopter_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
      FOREIGN KEY (adopter_id) REFERENCES users(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      related_id INTEGER,
      text TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Donaciones. No hay pasarela de pago —eso queda fuera del alcance del MVP—,
  // así que el sistema registra y hace seguimiento, no cobra: la donación nace
  // 'comprometida' y el refugio la marca 'recibida' cuando efectivamente llega.
  // Es como funciona el seguimiento real de donaciones en especie, y evita
  // simular un cobro que no ocurre.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      donor_id INTEGER NOT NULL,
      refugio_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      monto NUMERIC,
      descripcion TEXT DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'comprometida',
      notas TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      recibida_at TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES users(id),
      FOREIGN KEY (refugio_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'donations_tipo_check') THEN
        ALTER TABLE donations ADD CONSTRAINT donations_tipo_check
          CHECK (tipo IN ('dinero', 'especie'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'donations_estado_check') THEN
        ALTER TABLE donations ADD CONSTRAINT donations_estado_check
          CHECK (estado IN ('comprometida', 'recibida', 'cancelada'));
      END IF;
    END $$;
  `);

  // Refugios aportados por la comunidad. Los refugios chicos (de pueblo, de una
  // casa, de un perfil de Instagram) no figuran en ninguna base de mapas, así que
  // la única forma de tenerlos es que los cargue quien los conoce. Cada
  // sugerencia nace 'pendiente' y un admin la aprueba antes de que se vea en el
  // mapa. Se guarda un link de verificación (su perfil o web) y NO un teléfono:
  // muchos son casas particulares y no corresponde publicar datos de contacto
  // privados que cargó un tercero. Si 'approximate' = 1, el mapa muestra el
  // punto redondeado (~100 m) en vez del exacto.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shelter_suggestions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      lat NUMERIC NOT NULL,
      lng NUMERIC NOT NULL,
      approximate INTEGER NOT NULL DEFAULT 1,
      url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pendiente',
      review_note TEXT NOT NULL DEFAULT '',
      reviewed_by INTEGER,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )
  `);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shelter_suggestions_status_check') THEN
        ALTER TABLE shelter_suggestions ADD CONSTRAINT shelter_suggestions_status_check
          CHECK (status IN ('pendiente', 'aprobado', 'rechazado'));
      END IF;
    END $$;
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shelter_suggestions_status ON shelter_suggestions (status)`);

  // Estado de la solicitud de adopción. El chat ya vincula mascota, adoptante y
  // dueño, así que es la solicitud: no hace falta una tabla aparte, solo darle
  // un estado que el refugio pueda aprobar o rechazar desde el backoffice.
  await pool.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendiente'`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chats_status_check') THEN
        ALTER TABLE chats ADD CONSTRAINT chats_status_check
          CHECK (status IN ('pendiente', 'aprobada', 'rechazada'));
      END IF;
    END $$;
  `);

  // Voluntariado, centrado en hogares de tránsito: el cuello de botella real
  // del rescate no es gente dispuesta a adoptar, es dónde alojar al animal
  // mientras espera. Por eso la ficha no guarda "disponibilidad horaria" sino
  // capacidad y qué tipo de animal puede recibir: alojar es 24/7 durante
  // semanas, no una franja de un día.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS volunteers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      capacity INTEGER NOT NULL DEFAULT 1,
      accepts_species TEXT NOT NULL DEFAULT 'ambos',
      accepts_sizes TEXT NOT NULL DEFAULT '[]',
      has_yard INTEGER DEFAULT 0,
      has_other_pets INTEGER DEFAULT 0,
      max_weeks INTEGER,
      notes TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Columnas agregadas después de la primera versión de la tabla.
  await pool.query(`ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS accepts_species TEXT NOT NULL DEFAULT 'ambos'`);
  await pool.query(`ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS accepts_sizes TEXT NOT NULL DEFAULT '[]'`);
  await pool.query(`ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS has_yard INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS has_other_pets INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS max_weeks INTEGER`);

  // Estadía de un animal en un hogar de tránsito. Es lo que ocupa cupo.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS foster_stays (
      id SERIAL PRIMARY KEY,
      volunteer_id INTEGER NOT NULL,
      pet_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      start_date DATE DEFAULT CURRENT_DATE,
      end_date DATE,
      status TEXT NOT NULL DEFAULT 'activa',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'foster_stays_status_check') THEN
        ALTER TABLE foster_stays ADD CONSTRAINT foster_stays_status_check
          CHECK (status IN ('activa', 'finalizada', 'cancelada'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS volunteer_tasks (
      id SERIAL PRIMARY KEY,
      volunteer_id INTEGER,
      created_by INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      task_date DATE,
      status TEXT NOT NULL DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'volunteer_tasks_status_check') THEN
        ALTER TABLE volunteer_tasks ADD CONSTRAINT volunteer_tasks_status_check
          CHECK (status IN ('pendiente', 'aceptada', 'completada', 'cancelada'));
      END IF;
    END $$;
  `);

  // Roles (RF-03): usuario = adoptante (por defecto), voluntario = se anota
  // solo, refugio = organización verificada con backoffice, admin = equipo
  // PataMatch, único que puede verificar refugios y moderar.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'usuario'`);
  // La restricción vive en la base y no solo en el código: si algún día se
  // escribe desde otro lado, un rol inválido no puede entrar igual.
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('usuario', 'voluntario', 'refugio', 'admin'));
      END IF;
    END $$;
  `);

  // Geolocation columns (RF-09: alertas por cercanía).
  // users.lat/lng = "mi zona", el punto que el usuario fija en su perfil.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lat NUMERIC`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lng NUMERIC`);

  // lost_pets.marker_top/marker_left guardaban lat/lng como TEXT, con nombres
  // heredados de un diseño viejo (posicionar un pin en % sobre una imagen).
  // Se migran a columnas numéricas reales para poder calcular distancias.
  await pool.query(`ALTER TABLE lost_pets ADD COLUMN IF NOT EXISTS lat NUMERIC`);
  await pool.query(`ALTER TABLE lost_pets ADD COLUMN IF NOT EXISTS lng NUMERIC`);
  await pool.query(`
    UPDATE lost_pets
    SET lat = marker_top::NUMERIC, lng = marker_left::NUMERIC
    WHERE lat IS NULL
      AND marker_top ~ '^-?[0-9]+(\\.[0-9]+)?$'
      AND marker_left ~ '^-?[0-9]+(\\.[0-9]+)?$'
  `);

  // Estado de salud de la mascota en adopción (cartel del catálogo). No es lo
  // mismo que 'badge' (etiqueta editorial tipo "Urgente"): esto dice si el animal
  // se puede llevar hoy o si está atravesando una situación médica.
  //   disponible          → sin restricciones
  //   con_cuidado         → salió hace poco de una operación, se adopta con cuidados
  //   en_reposo           → recién operado, todavía no puede irse
  //   cirugia_programada  → tiene una operación en camino
  await pool.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'disponible'`);
  await pool.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS health_note TEXT DEFAULT ''`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_health_status_check') THEN
        ALTER TABLE pets ADD CONSTRAINT pets_health_status_check
          CHECK (health_status IN ('disponible', 'con_cuidado', 'en_reposo', 'cirugia_programada'));
      END IF;
    END $$;
  `);

  // Carnet digital de cada animal del catálogo: uno por mascota. Es distinto de
  // 'carnets', que es el carnet de la mascota propia de un usuario. Las listas
  // (vacunas, enfermedades, historial) se guardan como JSON en texto, igual que
  // en 'carnets', porque siempre se leen enteras.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pet_carnets (
      id SERIAL PRIMARY KEY,
      pet_id INTEGER NOT NULL UNIQUE,
      gender TEXT DEFAULT '',
      birth_date TEXT DEFAULT '',
      color_markings TEXT DEFAULT '',
      microchip_id TEXT DEFAULT '',
      weight_kg NUMERIC,
      spayed_neutered INTEGER DEFAULT 0,
      vaccinations TEXT DEFAULT '[]',
      diseases TEXT DEFAULT '[]',
      treatments TEXT DEFAULT '',
      allergies TEXT DEFAULT '',
      medical_history TEXT DEFAULT '[]',
      vet_name TEXT DEFAULT '',
      vet_clinic TEXT DEFAULT '',
      vet_phone TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    )
  `);

  // Seed if empty
  const res = await pool.query('SELECT COUNT(*) as count FROM users');
  const count = parseInt(res.rows[0].count, 10);
  if (count === 0) {
    await seedDatabase();
  }

  // Ensure every demo user has a carnet
  try {
    const demoUsers = await queryAll("SELECT id, name, email FROM users WHERE email IN ('demo@patamatch.com', 'david@patamatch.com', 'sarah@patamatch.com')");
    for (const u of demoUsers) {
      const existing = await queryOne("SELECT COUNT(*) as count FROM carnets WHERE user_id = $1", [u.id]);
      if (existing && parseInt(existing.count, 10) === 0) {
        console.log(`🌱 Creating fictitious carnet for ${u.email}...`);
        if (u.email === 'demo@patamatch.com') {
          const vacc = JSON.stringify([
            { name: 'Rabia 3 Años', last_dose: '10 May, 2023', next_dose: '10 May, 2026', status: 'updated' },
            { name: 'DHPP (Distémper)', last_dose: '12 Ene, 2024', next_dose: '12 Ene, 2025', status: 'updated' },
            { name: 'Parvovirus', last_dose: '15 Mar, 2024', next_dose: '15 Mar, 2025', status: 'updated' }
          ]);
          const hist = JSON.stringify([
            { date: '12 ENE, 2024', title: 'Consulta de Rutina', description: 'Excelente estado de salud general. Peso ideal de 28.5kg.' },
            { date: '20 NOV, 2023', title: 'Vacunación Anual', description: 'Aplicación de refuerzo óctuple sin reacciones adversas.' }
          ]);
          await runQuery('INSERT INTO carnets (pet_name,species,breed,gender,color_markings,microchip_id,image_url,qr_url,birth_date,vaccinations,medical_history,vet_name,vet_clinic,vet_phone,vet_image,owner_name,owner_city,user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',
            ['Bella', 'Canino (Perro)', 'Golden Retriever', 'Hembra', 'Dorado Brillante', '9851 9876 5432 109',
            'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=600',
            '', '2022-04-15', vacc, hist, 'Dr. Carlos Mendoza', 'Hospital Veterinario Pets Life', '(55) 5555-9876', '',
            u.name, 'CDMX', u.id]);
        } else if (u.email === 'david@patamatch.com') {
          const vacc = JSON.stringify([
            { name: 'Triple Felina', last_dose: '15 Feb, 2024', next_dose: '15 Feb, 2025', status: 'updated' },
            { name: 'Leucemia Felina', last_dose: '15 Feb, 2024', next_dose: '15 Feb, 2025', status: 'updated' }
          ]);
          const hist = JSON.stringify([
            { date: '15 FEB, 2024', title: 'Chequeo Preventivo', description: 'Revisión dental limpia, ojos brillantes y pelaje sedoso.' }
          ]);
          await runQuery('INSERT INTO carnets (pet_name,species,breed,gender,color_markings,microchip_id,image_url,qr_url,birth_date,vaccinations,medical_history,vet_name,vet_clinic,vet_phone,vet_image,owner_name,owner_city,user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',
            ['Max', 'Felino (Gato)', 'Siamés', 'Macho', 'Gris y Crema', '9851 1122 3344 556',
            'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=600',
            '', '2023-01-20', vacc, hist, 'Dra. Ana Gómez', 'Clínica Felina Santa Lucía', '(55) 4433-2211', '',
            u.name, 'Austin, TX', u.id]);
        }
      }
    }
  } catch (err) {
    console.error('Error ensuring demo user carnets:', err);
  }

  // Los carnets de las mascotas de demo se crean aparte del seed principal:
  // la base de producción ya estaba sembrada cuando se agregó esta función, y
  // así cada estado de salud queda representado para la defensa.
  try {
    const conCarnet = await queryOne('SELECT COUNT(*) AS count FROM pet_carnets');
    if (conCarnet && parseInt(conCarnet.count, 10) === 0) {
      console.log('🌱 Creating demo pet carnets...');
      await seedPetCarnets();
    }
  } catch (err) {
    console.error('Error seeding pet carnets:', err);
  }

  // Refugios de demo para el mapa de refugios: el seed original tiene uno solo
  // (Sarah), y un mapa con un pin no muestra nada. Cada uno queda con zona
  // fijada y un par de mascotas publicadas.
  try {
    const existe = await queryOne('SELECT id FROM users WHERE email = ?', ['huellitas@patamatch.com']);
    if (!existe) {
      console.log('🌱 Creating demo shelters...');
      await seedRefugiosDemo();
    }
  } catch (err) {
    console.error('Error seeding demo shelters:', err);
  }

  // Ensure initial comments exist
  try {
    const existingComments = await queryOne("SELECT COUNT(*) as count FROM post_comments");
    if (!existingComments || parseInt(existingComments.count, 10) === 0) {
      console.log('🌱 Seeding initial comments...');
      await runQuery("INSERT INTO post_comments (post_id, user_id, body) VALUES ($1, $2, $3)", [1, 2, '¡El parque de Lafayette Park es buenísimo! Tiene un área especial cerrada para razas pequeñas y el césped está siempre impecable.']);
      await runQuery("INSERT INTO post_comments (post_id, user_id, body) VALUES ($1, $2, $3)", [1, 3, '¡Confirmo! Yo llevo a mi chihuahua ahí y le encanta. Además la vista es hermosa.']);
      await runQuery("INSERT INTO post_comments (post_id, user_id, body) VALUES ($1, $2, $3)", [2, 1, 'A nosotros nos sirvió mucho dejarle una prenda de ropa usada con nuestro olor en su camita. ¡Se calma muchísimo!']);
      await runQuery("INSERT INTO post_comments (post_id, user_id, body) VALUES ($1, $2, $3)", [2, 3, 'Intenta también los juguetes tipo Kong rellenos de crema de cacahuate congelada. Los mantiene ocupados por horas y asocian quedarse solos con algo positivo.']);
    }
  } catch (err) {
    console.error('Error seeding comments:', err);
  }

  dbInitialized = true;
  return pool;
}

// Transform SQL from ? to $1, $2, etc.
function transformSql(sql) {
  let idx = 1;
  return sql.replace(/\?/g, () => `$${idx++}`);
}

async function queryAll(sql, params = []) {
  const transformedSql = transformSql(sql);
  const result = await pool.query(transformedSql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const transformedSql = transformSql(sql);
  const result = await pool.query(transformedSql, params);
  return result.rows[0] || null;
}

async function runQuery(sql, params = []) {
  let transformedSql = transformSql(sql);
  const isInsert = transformedSql.trim().toUpperCase().startsWith('INSERT');
  
  if (isInsert && !transformedSql.toUpperCase().includes('RETURNING ID')) {
    transformedSql += ' RETURNING id';
  }

  const result = await pool.query(transformedSql, params);
  return {
    lastInsertRowid: (isInsert && result.rows[0]) ? result.rows[0].id : 0,
    changes: result.rowCount || 0
  };
}

async function seedDatabase() {
  console.log('🌱 Seeding database...');

  const hash = bcrypt.hashSync('demo123', 10);

  // Users — lat/lng es "mi zona" (el punto que el usuario fija en su perfil).
  // Los vecinos de CDMX están a distancias conocidas del punto donde se pierde
  // Max (19.412, -99.172) para poder demostrar el radio de alertas (RF-09).
  // Los cuatro roles quedan representados para poder demostrarlos en la defensa.
  const users = [
    ['Sarah Miller', 'sarah@patamatch.com', 'San Francisco, CA', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&q=80&auto=format&fit=crop', 37.7749, -122.4194, 'refugio'],
    ['David Chen', 'david@patamatch.com', 'Austin, TX', 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=300&q=80&auto=format&fit=crop', 30.2672, -97.7431, 'usuario'],
    ['Demo User', 'demo@patamatch.com', 'CDMX', '', 19.4326, -99.1332, 'usuario'],
    ['Ana Torres', 'ana@patamatch.com', 'Condesa, CDMX', '', 19.4192, -99.172, 'voluntario'],   // ~0.8 km de Max
    ['Luis Ramos', 'luis@patamatch.com', 'Roma Norte, CDMX', '', 19.412, -99.1491, 'usuario'],  // ~2.4 km de Max
    ['Carla Díaz', 'carla@patamatch.com', 'Coyoacán, CDMX', '', 19.3312, -99.172, 'usuario'],   // ~9 km de Max (fuera del radio)
    ['Equipo PataMatch', 'admin@patamatch.com', 'Villa del Rosario, Córdoba', '', null, null, 'admin']
  ];
  for (const u of users) {
    await runQuery(
      'INSERT INTO users (name, email, password_hash, city, avatar_url, lat, lng, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [u[0], u[1], hash, u[2], u[3], u[4], u[5], u[6]]
    );
  }

  // Ana tiene rol 'voluntario', así que necesita su ficha de hogar de tránsito:
  // sin esto el rol quedaría sin respaldo y el panel no la mostraría.
  const ana = await queryOne('SELECT id FROM users WHERE email = $1', ['ana@patamatch.com']);
  await runQuery(
    `INSERT INTO volunteers (user_id, phone, capacity, accepts_species, accepts_sizes, has_yard, max_weeks, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [ana.id, '55-1234-5678', 2, 'ambos', JSON.stringify(['pequeno', 'mediano']), 1, 8, 'Departamento con patio, sin otras mascotas']
  );

  // Pets
  const pets = [
    ['Cooper', 'Perro', 'Beagle', '1.5 Años', 'Mediano', 'Portland, OR', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&q=80&auto=format&fit=crop', 'Urgente', 'primary', 'Beagle cariñoso, necesita hogar con jardín.', 0, ''],
    ['Luna', 'Gato', 'Siamés', '3 Años', 'Pequeño', 'Seattle, WA', 'https://images.unsplash.com/photo-1472491235688-bdc81a63246e?w=600&q=80&auto=format&fit=crop', null, null, 'Tranquila e independiente, perfecta para apartamentos.', 0, ''],
    ['Buddy', 'Perro', 'Golden Retriever', '4 Años', 'Grande', 'Austin, TX', 'https://images.unsplash.com/photo-1602241628512-459cdd3234fe?w=600&q=80&auto=format&fit=crop', null, null, 'Súper social, ama a los niños.', 0, ''],
    ['Milo', 'Perro', 'Corgi', '6 Meses', 'Pequeño', 'Denver, CO', 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=600&q=80&auto=format&fit=crop', 'Recién Llegado', 'secondary', 'Cachorro corgi lleno de energía.', 0, '']
  ];
  const adopted = [
    ['Roco', 'Perro', 'Mestizo', '3 Años', 'Mediano', 'CDMX', 'https://images.unsplash.com/photo-1596490634801-c536934af56e?w=600&q=80&auto=format&fit=crop', null, null, '', 1, '"Roco se convirtió en la alegría de nuestra casa..."'],
    ['Bruno', 'Perro', 'Golden Retriever', '5 Años', 'Grande', 'Monterrey', 'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=600&q=80&auto=format&fit=crop', null, null, '', 1, '"Bruno nos motiva a salir y disfrutar la naturaleza todos los días."']
  ];

  const allPets = [...pets, ...adopted];
  for (const p of allPets) {
    p.push(1);
    await runQuery('INSERT INTO pets (name,species,breed,age,size,location,image_url,badge,badge_color,description,is_adopted,adopted_quote,user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', p);
  }

  // Lost pets
  const lostPets = [
    ['Max', 'Caniche', 'Condesa, CDMX', 'Hace 3 horas', 'Caniche marrón con collar azul.', 'https://images.unsplash.com/photo-1765739001803-9bc520b5b7ba?w=600&q=80&auto=format&fit=crop', 'Urgente', '19.412', '-99.172', ''],
    ['Baily', 'Golden Retriever', 'Sunset District, SF', 'Hace 2 horas', 'Golden Retriever macho.', 'https://images.unsplash.com/photo-1693615774176-a5560f55ac49?w=600&q=80&auto=format&fit=crop', 'Urgente', '37.755', '-122.485', 'https://images.unsplash.com/photo-1693615774176-a5560f55ac49?w=100&q=80&auto=format&fit=crop']
  ];
  for (const lp of lostPets) {
    // marker_top/marker_left se mantienen sincronizadas con lat/lng por compatibilidad.
    await runQuery(
      'INSERT INTO lost_pets (name,breed,location,last_seen,description,image_url,badge,marker_top,marker_left,marker_image,lat,lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [...lp, Number(lp[7]), Number(lp[8])]
    );
  }

  // Posts
  await runQuery("INSERT INTO posts (title,body,category,tags,user_id) VALUES ($1,$2,$3,$4,$5)", ['¿Mejores parques en SF con áreas exclusivas para perros pequeños?', '¡Acabo de mudarme a Nob Hill con mi Yorkie de 2kg! Busco sugerencias de parques donde las secciones para perros pequeños estén bien cuidadas y sean seguras.', 'events', '["#SanFrancisco","#PerrosPequeños","#ParquesCaninos"]', 1]);
  await runQuery("INSERT INTO posts (title,body,category,tags,user_id) VALUES ($1,$2,$3,$4,$5)", ['Consejos para cachorros: Manejando la ansiedad por separación', 'Mi mezcla de Labrador de 10 semanas empieza a llorar en cuanto salgo de la habitación.', 'health', '["#EntrenamientoCachorros","#NuevoDueño"]', 2]);
  
  // Likes
  await runQuery('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [1, 2]);
  await runQuery('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [2, 1]);

  // Stories
  await runQuery("INSERT INTO stories (pet_name,author_name,title,body,image_url,badge,is_approved,user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", ['Luna', 'Familia Miller', 'El Nuevo Viaje de Luna', 'Después de 400 días en el refugio, Luna finalmente encontró a su familia ideal.', 'https://images.unsplash.com/photo-1472491235688-bdc81a63246e?w=800&q=80&auto=format&fit=crop', 'Final Feliz', 1, 1]);

  console.log('✅ Database seeded!');
}

// Carnet + estado de salud de las cuatro mascotas del catálogo de demo. Se
// buscan por nombre porque el id depende del orden del seed original.
async function seedPetCarnets() {
  const demo = {
    Cooper: {
      estado: ['disponible', ''],
      carnet: ['Macho', '2025-03-10', 'Tricolor, mancha blanca en el pecho', '9851 2030 1122 001', 11.2, 1,
        [
          { name: 'Séxtuple (DHPPiL)', last_dose: '10 Mar, 2026', next_dose: '10 Mar, 2027', status: 'updated' },
          { name: 'Antirrábica', last_dose: '15 Abr, 2026', next_dose: '15 Abr, 2027', status: 'updated' }
        ],
        [], '', 'Ninguna conocida',
        [{ date: '15 ABR, 2026', title: 'Control anual', description: 'Peso ideal, sin hallazgos. Se aplicó antirrábica.' }],
        'Dra. Paula Ferreyra', 'Veterinaria del Parque', '(351) 455-1020']
    },
    Luna: {
      estado: ['con_cuidado', 'Castrada el 15 de septiembre. Evitar saltos y mantener el collar isabelino hasta el control del 29/9.'],
      carnet: ['Hembra', '2023-06-02', 'Crema con puntas marrones (seal point)', '9851 2030 1122 002', 3.8, 1,
        [
          { name: 'Triple felina', last_dose: '20 Feb, 2026', next_dose: '20 Feb, 2027', status: 'updated' },
          { name: 'Leucemia felina', last_dose: '20 Feb, 2026', next_dose: '20 Feb, 2027', status: 'updated' },
          { name: 'Antirrábica', last_dose: '05 Sep, 2025', next_dose: '05 Sep, 2026', status: 'expiring' }
        ],
        [{ name: 'Gingivitis leve', status: 'en_tratamiento', notes: 'Limpieza dental cada 6 meses' }],
        'Antibiótico post-operatorio hasta el 25/9', 'Ninguna conocida',
        [
          { date: '15 SEP, 2026', title: 'Castración', description: 'Cirugía sin complicaciones. Reposo relativo 14 días.' },
          { date: '20 FEB, 2026', title: 'Vacunación anual', description: 'Refuerzo triple y leucemia sin reacciones.' }
        ],
        'Dr. Martín Sosa', 'Clínica Felina Norte', '(351) 422-8890']
    },
    Buddy: {
      estado: ['cirugia_programada', 'Limpieza dental con extracción programada para el 8 de octubre. Puede conocerse antes; se entrega después de la cirugía.'],
      carnet: ['Macho', '2022-08-18', 'Dorado', '9851 2030 1122 003', 31.5, 1,
        [
          { name: 'Séxtuple (DHPPiL)', last_dose: '18 Ago, 2026', next_dose: '18 Ago, 2027', status: 'updated' },
          { name: 'Antirrábica', last_dose: '18 Ago, 2026', next_dose: '18 Ago, 2027', status: 'updated' },
          { name: 'Tos de las perreras', last_dose: '10 Ene, 2026', next_dose: '10 Ene, 2027', status: 'updated' }
        ],
        [{ name: 'Enfermedad periodontal', status: 'en_tratamiento', notes: 'Requiere extracción de dos piezas' }],
        '', 'Pollo (dermatitis)',
        [
          { date: '18 AGO, 2026', title: 'Control anual', description: 'Se detecta sarro avanzado; se programa limpieza dental.' },
          { date: '10 ENE, 2026', title: 'Consulta por picazón', description: 'Dermatitis alérgica alimentaria. Dieta sin pollo.' }
        ],
        'Dra. Paula Ferreyra', 'Veterinaria del Parque', '(351) 455-1020']
    },
    Milo: {
      estado: ['en_reposo', 'Operado de una fractura en la pata delantera el 18 de septiembre. Reposo estricto 4 semanas; no se entrega hasta el alta.'],
      carnet: ['Macho', '2026-03-20', 'Rojizo y blanco', '9851 2030 1122 004', 6.1, 0,
        [
          { name: 'Séxtuple (DHPPiL) — 1ª dosis', last_dose: '05 May, 2026', next_dose: '05 Jun, 2026', status: 'updated' },
          { name: 'Séxtuple (DHPPiL) — 2ª dosis', last_dose: '05 Jun, 2026', next_dose: '05 Jul, 2026', status: 'updated' },
          { name: 'Antirrábica', last_dose: '', next_dose: 'Pendiente (al alta)', status: 'expired' }
        ],
        [], 'Analgésico cada 12 h hasta el 2/10', 'Ninguna conocida',
        [
          { date: '18 SEP, 2026', title: 'Cirugía de fractura', description: 'Osteosíntesis en radio derecho. Evolución favorable.' },
          { date: '05 JUN, 2026', title: 'Segunda dosis séxtuple', description: 'Desparasitación interna incluida.' }
        ],
        'Dr. Martín Sosa', 'Clínica Felina Norte', '(351) 422-8890']
    }
  };

  for (const [nombre, d] of Object.entries(demo)) {
    const pet = await queryOne('SELECT id FROM pets WHERE name = ? AND user_id = 1 ORDER BY id LIMIT 1', [nombre]);
    if (!pet) continue;
    await runQuery('UPDATE pets SET health_status = ?, health_note = ? WHERE id = ?', [d.estado[0], d.estado[1], pet.id]);
    const c = d.carnet;
    await runQuery(
      `INSERT INTO pet_carnets (pet_id, gender, birth_date, color_markings, microchip_id, weight_kg, spayed_neutered,
        vaccinations, diseases, treatments, allergies, medical_history, vet_name, vet_clinic, vet_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pet.id, c[0], c[1], c[2], c[3], c[4], c[5], JSON.stringify(c[6]), JSON.stringify(c[7]), c[8], c[9], JSON.stringify(c[10]), c[11], c[12], c[13]]
    );
  }
}

// Tres refugios verificados con zona fijada, cada uno con mascotas publicadas,
// para que el mapa de refugios y el panel tengan datos que mostrar.
async function seedRefugiosDemo() {
  const hash = bcrypt.hashSync('demo123', 10);
  const refugios = [
    {
      user: ['Huellitas CDMX', 'huellitas@patamatch.com', 'Roma Norte, CDMX', 19.4194, -99.1618],
      pets: [
        ['Canela', 'Perro', 'Mestizo', '2 Años', 'Mediano', 'Roma Norte, CDMX', 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=600&q=80&auto=format&fit=crop', 'Muy tranquila, ideal para departamento.', 'disponible', ''],
        ['Pelusa', 'Gato', 'Común europeo', '1 Año', 'Pequeño', 'Roma Norte, CDMX', 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&q=80&auto=format&fit=crop', 'Juguetona y muy cariñosa con otros gatos.', 'con_cuidado', 'Castrada el 18 de septiembre. Control el 2 de octubre.']
      ]
    },
    {
      user: ['Refugio Patitas Córdoba', 'patitas@patamatch.com', 'Córdoba, Argentina', -31.4135, -64.1811],
      pets: [
        ['Tango', 'Perro', 'Labrador', '5 Años', 'Grande', 'Córdoba, Argentina', 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=600&q=80&auto=format&fit=crop', 'Compañero fiel, le encanta el agua.', 'disponible', ''],
        ['Mora', 'Perro', 'Mestizo', '8 Meses', 'Pequeño', 'Córdoba, Argentina', 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&q=80&auto=format&fit=crop', 'Cachorra curiosa, aprende rápido.', 'cirugia_programada', 'Castración programada para el 10 de octubre.']
      ]
    },
    {
      user: ['Rescate Animal Austin', 'rescate@patamatch.com', 'Austin, TX', 30.2849, -97.7341],
      pets: [
        ['Simba', 'Gato', 'Naranja', '3 Años', 'Mediano', 'Austin, TX', 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600&q=80&auto=format&fit=crop', 'Dormilón y muy sociable.', 'disponible', '']
      ]
    }
  ];

  for (const r of refugios) {
    const [name, email, city, lat, lng] = r.user;
    const creado = await runQuery(
      'INSERT INTO users (name, email, password_hash, city, avatar_url, lat, lng, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hash, city, '', lat, lng, 'refugio']
    );
    for (const p of r.pets) {
      await runQuery(
        `INSERT INTO pets (name, species, breed, age, size, location, image_url, description, health_status, health_note, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...p, creado.lastInsertRowid]
      );
    }
  }
}

function saveDatabase() {
  // Not needed for Postgres
}

module.exports = { initDatabase, queryAll, queryOne, runQuery, saveDatabase };
