import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://ehr:ehr@localhost:5432/ehr';

const isCloudDB = connectionString.includes('supabase.co') ||
                  connectionString.includes('supabase.com') ||
                  connectionString.includes('neon.tech');

const pool = new Pool({
  connectionString,
  ssl: isCloudDB ? { rejectUnauthorized: false } : false,
});

// Sample ENT patients
const entPatients = [
  { firstName: 'Thomas', lastName: 'Murphy', dob: '1968-04-12', gender: 'Male', phone: '555-1001' },
  { firstName: 'Catherine', lastName: 'O\'Brien', dob: '1975-09-23', gender: 'Female', phone: '555-1002' },
  { firstName: 'Patrick', lastName: 'Walsh', dob: '1982-01-15', gender: 'Male', phone: '555-1003' },
  { firstName: 'Mary', lastName: 'Kelly', dob: '1959-11-08', gender: 'Female', phone: '555-1004' },
  { firstName: 'Sean', lastName: 'Ryan', dob: '1971-06-30', gender: 'Male', phone: '555-1005' },
  { firstName: 'Bridget', lastName: 'McCarthy', dob: '1988-03-17', gender: 'Female', phone: '555-1006' },
  { firstName: 'Michael', lastName: 'Byrne', dob: '1963-12-25', gender: 'Male', phone: '555-1007' },
  { firstName: 'Siobhan', lastName: 'Doyle', dob: '1995-07-04', gender: 'Female', phone: '555-1008' },
  { firstName: 'Declan', lastName: 'Fitzgerald', dob: '1978-02-28', gender: 'Male', phone: '555-1009' },
  { firstName: 'Aoife', lastName: 'Brennan', dob: '1990-10-11', gender: 'Female', phone: '555-1010' },
  { firstName: 'Liam', lastName: 'O\'Connor', dob: '1955-08-19', gender: 'Male', phone: '555-1011' },
  { firstName: 'Niamh', lastName: 'Sullivan', dob: '1983-05-22', gender: 'Female', phone: '555-1012' },
  { firstName: 'Conor', lastName: 'Gallagher', dob: '1969-09-14', gender: 'Male', phone: '555-1013' },
  { firstName: 'Sinead', lastName: 'Murray', dob: '1992-01-03', gender: 'Female', phone: '555-1014' },
  { firstName: 'Eoin', lastName: 'Kennedy', dob: '1976-04-27', gender: 'Male', phone: '555-1015' },
  { firstName: 'Orla', lastName: 'Quinn', dob: '1987-11-16', gender: 'Female', phone: '555-1016' },
  { firstName: 'Cillian', lastName: 'Burke', dob: '1961-07-09', gender: 'Male', phone: '555-1017' },
  { firstName: 'Roisin', lastName: 'Doherty', dob: '1998-12-01', gender: 'Female', phone: '555-1018' },
  { firstName: 'Padraig', lastName: 'Healy', dob: '1973-03-08', gender: 'Male', phone: '555-1019' },
  { firstName: 'Ciara', lastName: 'Nolan', dob: '1985-06-21', gender: 'Female', phone: '555-1020' },
  { firstName: 'Brendan', lastName: 'Duffy', dob: '1966-10-30', gender: 'Male', phone: '555-1021' },
  { firstName: 'Aisling', lastName: 'Power', dob: '1991-02-14', gender: 'Female', phone: '555-1022' },
  { firstName: 'Dermot', lastName: 'Lynch', dob: '1958-08-05', gender: 'Male', phone: '555-1023' },
  { firstName: 'Grainne', lastName: 'Casey', dob: '1980-04-18', gender: 'Female', phone: '555-1024' },
  { firstName: 'Fergus', lastName: 'Reilly', dob: '1972-09-27', gender: 'Male', phone: '555-1025' },
  { firstName: 'Deirdre', lastName: 'Flynn', dob: '1994-01-12', gender: 'Female', phone: '555-1026' },
  { firstName: 'Colm', lastName: 'Hayes', dob: '1964-05-31', gender: 'Male', phone: '555-1027' },
  { firstName: 'Fionnuala', lastName: 'Connolly', dob: '1989-11-23', gender: 'Female', phone: '555-1028' },
  { firstName: 'Ronan', lastName: 'Maguire', dob: '1977-07-16', gender: 'Male', phone: '555-1029' },
  { firstName: 'Maeve', lastName: 'Kearney', dob: '1996-03-04', gender: 'Female', phone: '555-1030' },
];

// Clinic appointment reasons
const clinicReasons = [
  'Hoarseness - voice change',
  'Recurrent tonsillitis',
  'Hearing loss review',
  'Nasal obstruction',
  'Post-operative follow-up',
  'Neck lump assessment',
  'Vertigo and dizziness',
  'Chronic sinusitis',
  'Ear pain and discharge',
  'Swallowing difficulty',
  'Sleep apnoea review',
  'Thyroid nodule follow-up',
  'Salivary gland swelling',
  'Epistaxis (nosebleeds)',
  'Tinnitus assessment',
];

// ENT Head and Neck operations
const entOperations = [
  'Tonsillectomy',
  'Septoplasty',
  'FESS (Functional Endoscopic Sinus Surgery)',
  'Thyroidectomy',
  'Parotidectomy',
  'Neck dissection',
  'Microlaryngoscopy',
  'Mastoidectomy',
  'Tympanoplasty',
  'Cochlear implant',
  'Submandibular gland excision',
  'Laryngectomy',
  'Direct laryngoscopy and biopsy',
  'Uvulopalatopharyngoplasty (UPPP)',
  'Turbinate reduction',
];

// Morning clinic times (9:00 AM - 12:30 PM, 30 min slots)
const morningClinicTimes = [
  { start: '09:00:00', end: '09:30:00' },
  { start: '09:30:00', end: '10:00:00' },
  { start: '10:00:00', end: '10:30:00' },
  { start: '10:30:00', end: '11:00:00' },
  { start: '11:00:00', end: '11:30:00' },
  { start: '11:30:00', end: '12:00:00' },
  { start: '12:00:00', end: '12:30:00' },
];

// Afternoon clinic times (2:00 PM - 5:00 PM, 30 min slots)
const afternoonClinicTimes = [
  { start: '14:00:00', end: '14:30:00' },
  { start: '14:30:00', end: '15:00:00' },
  { start: '15:00:00', end: '15:30:00' },
  { start: '15:30:00', end: '16:00:00' },
  { start: '16:00:00', end: '16:30:00' },
  { start: '16:30:00', end: '17:00:00' },
];

// Morning operation times (8:00 AM - 12:30 PM, variable duration)
const morningOperationTimes = [
  { start: '08:00:00', end: '09:30:00' },
  { start: '09:30:00', end: '11:00:00' },
  { start: '11:00:00', end: '12:30:00' },
];

// Afternoon operation times (2:00 PM - 5:30 PM, variable duration)
const afternoonOperationTimes = [
  { start: '14:00:00', end: '15:30:00' },
  { start: '15:30:00', end: '17:00:00' },
  { start: '17:00:00', end: '18:30:00' },
];

// All day clinic times
const allDayClinicTimes = [...morningClinicTimes, ...afternoonClinicTimes];

function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getDayOfWeek(date: Date): number {
  return date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
}

async function seedWeeklySchedule() {
  console.log('🏥 Seeding weekly ENT schedule from Feb 2 to end of March 2026...\n');

  try {
    // Get provider
    const providerResult = await pool.query(
      "SELECT id, first_name, last_name FROM users WHERE role = 'provider' LIMIT 1"
    );

    if (providerResult.rows.length === 0) {
      console.error('❌ No provider found. Please create a provider user first.');
      return;
    }

    const provider = providerResult.rows[0];
    console.log(`👨‍⚕️ Using provider: Dr. ${provider.first_name} ${provider.last_name}\n`);

    // Get secretary for created_by
    const secretaryResult = await pool.query(
      "SELECT id FROM users WHERE role = 'secretary' OR role = 'admin' LIMIT 1"
    );
    const createdBy = secretaryResult.rows.length > 0 ? secretaryResult.rows[0].id : provider.id;

    // Date range: Feb 2, 2026 to March 31, 2026
    const startDate = new Date('2026-02-02');
    const endDate = new Date('2026-03-31');
    const dates = getDatesBetween(startDate, endDate);

    // Create all patients first
    console.log('👥 Creating patients...\n');
    const patientIds: string[] = [];
    const mrnBase = Date.now().toString().slice(-6);

    for (let i = 0; i < entPatients.length; i++) {
      const patient = entPatients[i];
      const mrn = `ENT${mrnBase}${String(i + 1).padStart(2, '0')}`;

      // Check if patient exists
      const existing = await pool.query(
        'SELECT id FROM patients WHERE first_name = $1 AND last_name = $2 AND date_of_birth = $3',
        [patient.firstName, patient.lastName, patient.dob]
      );

      if (existing.rows.length > 0) {
        patientIds.push(existing.rows[0].id);
      } else {
        const result = await pool.query(
          `INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, phone, active)
           VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
          [mrn, patient.firstName, patient.lastName, patient.dob, patient.gender, patient.phone]
        );
        patientIds.push(result.rows[0].id);
        console.log(`  + Created: ${patient.firstName} ${patient.lastName}`);
      }
    }

    console.log(`\n✅ ${patientIds.length} patients ready\n`);

    // Track appointment counts
    let clinicCount = 0;
    let operationCount = 0;
    let patientIndex = 0;

    // Process each date
    for (const date of dates) {
      const dayOfWeek = getDayOfWeek(date);
      const dateStr = date.toISOString().split('T')[0];

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Tuesday (dayOfWeek === 2): Morning Clinic, Afternoon Operations
      if (dayOfWeek === 2) {
        console.log(`📅 ${dateStr} (Tuesday): Morning Clinic + Afternoon Operations`);

        // Morning clinic
        for (const time of morningClinicTimes) {
          const patientId = patientIds[patientIndex % patientIds.length];
          const reason = clinicReasons[patientIndex % clinicReasons.length];
          patientIndex++;

          await pool.query(
            `INSERT INTO appointments (patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Follow-up', $6, 'scheduled', $7)
             ON CONFLICT DO NOTHING`,
            [patientId, provider.id, dateStr, time.start, time.end, reason, createdBy]
          );
          clinicCount++;
        }

        // Afternoon operations
        for (const time of afternoonOperationTimes) {
          const patientId = patientIds[patientIndex % patientIds.length];
          const operation = entOperations[patientIndex % entOperations.length];
          patientIndex++;

          await pool.query(
            `INSERT INTO appointments (patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Procedure', $6, 'scheduled', $7)
             ON CONFLICT DO NOTHING`,
            [patientId, provider.id, dateStr, time.start, time.end, operation, createdBy]
          );
          operationCount++;
        }
      }

      // Wednesday (dayOfWeek === 3): Morning Operations, Afternoon Clinic
      if (dayOfWeek === 3) {
        console.log(`📅 ${dateStr} (Wednesday): Morning Operations + Afternoon Clinic`);

        // Morning operations
        for (const time of morningOperationTimes) {
          const patientId = patientIds[patientIndex % patientIds.length];
          const operation = entOperations[patientIndex % entOperations.length];
          patientIndex++;

          await pool.query(
            `INSERT INTO appointments (patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Procedure', $6, 'scheduled', $7)
             ON CONFLICT DO NOTHING`,
            [patientId, provider.id, dateStr, time.start, time.end, operation, createdBy]
          );
          operationCount++;
        }

        // Afternoon clinic
        for (const time of afternoonClinicTimes) {
          const patientId = patientIds[patientIndex % patientIds.length];
          const reason = clinicReasons[patientIndex % clinicReasons.length];
          patientIndex++;

          await pool.query(
            `INSERT INTO appointments (patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Follow-up', $6, 'scheduled', $7)
             ON CONFLICT DO NOTHING`,
            [patientId, provider.id, dateStr, time.start, time.end, reason, createdBy]
          );
          clinicCount++;
        }
      }

      // Friday (dayOfWeek === 5): All day Clinic
      if (dayOfWeek === 5) {
        console.log(`📅 ${dateStr} (Friday): All Day Clinic`);

        for (const time of allDayClinicTimes) {
          const patientId = patientIds[patientIndex % patientIds.length];
          const reason = clinicReasons[patientIndex % clinicReasons.length];
          patientIndex++;

          await pool.query(
            `INSERT INTO appointments (patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Follow-up', $6, 'scheduled', $7)
             ON CONFLICT DO NOTHING`,
            [patientId, provider.id, dateStr, time.start, time.end, reason, createdBy]
          );
          clinicCount++;
        }
      }
    }

    console.log('\n✅ Schedule seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('================================');
    console.log(`Period: Feb 2, 2026 - March 31, 2026`);
    console.log(`Provider: Dr. ${provider.first_name} ${provider.last_name}`);
    console.log(`Clinic appointments: ${clinicCount}`);
    console.log(`Operations scheduled: ${operationCount}`);
    console.log(`Total appointments: ${clinicCount + operationCount}`);
    console.log('\n📋 Weekly Schedule:');
    console.log('  Tuesday AM: Clinic | Tuesday PM: Operations');
    console.log('  Wednesday AM: Operations | Wednesday PM: Clinic');
    console.log('  Friday: All Day Clinic');

  } catch (error) {
    console.error('❌ Error seeding schedule:', error);
  } finally {
    await pool.end();
  }
}

seedWeeklySchedule();
