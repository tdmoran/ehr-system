import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;

// Get connection string from environment or use default
const connectionString = process.env.DATABASE_URL || 'postgresql://ehr:ehr@localhost:5432/ehr';

const isCloudDB = connectionString.includes('supabase.co') ||
                  connectionString.includes('supabase.com') ||
                  connectionString.includes('neon.tech');

const pool = new Pool({
  connectionString,
  ssl: isCloudDB ? { rejectUnauthorized: false } : false,
});

// Demo patients data
const demoPatients = [
  { firstName: 'Maria', lastName: 'Garcia', dob: '1985-03-15', gender: 'Female', phone: '555-0101', reason: 'Annual checkup' },
  { firstName: 'James', lastName: 'Wilson', dob: '1972-08-22', gender: 'Male', phone: '555-0102', reason: 'Follow-up: Blood pressure' },
  { firstName: 'Sarah', lastName: 'Johnson', dob: '1990-11-30', gender: 'Female', phone: '555-0103', reason: 'Sore throat, cough' },
  { firstName: 'Robert', lastName: 'Brown', dob: '1965-05-10', gender: 'Male', phone: '555-0104', reason: 'Diabetes management' },
  { firstName: 'Emily', lastName: 'Davis', dob: '1998-02-14', gender: 'Female', phone: '555-0105', reason: 'Skin rash' },
  { firstName: 'Michael', lastName: 'Martinez', dob: '1980-07-08', gender: 'Male', phone: '555-0106', reason: 'Back pain' },
  { firstName: 'Jennifer', lastName: 'Anderson', dob: '1975-12-03', gender: 'Female', phone: '555-0107', reason: 'Headaches, fatigue' },
  { firstName: 'David', lastName: 'Taylor', dob: '1988-09-25', gender: 'Male', phone: '555-0108', reason: 'Physical exam - work' },
  { firstName: 'Lisa', lastName: 'Thomas', dob: '1995-04-18', gender: 'Female', phone: '555-0109', reason: 'Anxiety, trouble sleeping' },
  { firstName: 'William', lastName: 'Jackson', dob: '1958-01-07', gender: 'Male', phone: '555-0110', reason: 'Joint pain, arthritis' },
];

// Appointment times (starting at 9 AM, 30 min slots)
const appointmentTimes = [
  { start: '09:00:00', end: '09:30:00' },
  { start: '09:30:00', end: '10:00:00' },
  { start: '10:00:00', end: '10:30:00' },
  { start: '10:30:00', end: '11:00:00' },
  { start: '11:00:00', end: '11:30:00' },
  { start: '11:30:00', end: '12:00:00' },
  { start: '13:00:00', end: '13:30:00' }, // After lunch
  { start: '13:30:00', end: '14:00:00' },
  { start: '14:00:00', end: '14:30:00' },
  { start: '14:30:00', end: '15:00:00' },
];

const appointmentTypes = ['Follow-up', 'New Patient', 'Annual Exam', 'Urgent Visit', 'Consultation'];

async function seedDemoClinic() {
  console.log('🏥 Seeding demo clinic data...\n');

  try {
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    console.log(`📅 Scheduling appointments for: ${tomorrowStr}\n`);

    // Get a provider (doctor)
    const providerResult = await pool.query(
      "SELECT id, first_name, last_name FROM users WHERE role = 'provider' LIMIT 1"
    );

    if (providerResult.rows.length === 0) {
      console.error('❌ No provider found. Please create a provider user first.');
      return;
    }

    const provider = providerResult.rows[0];
    console.log(`👨‍⚕️ Using provider: Dr. ${provider.first_name} ${provider.last_name}\n`);

    // Get a secretary for created_by
    const secretaryResult = await pool.query(
      "SELECT id FROM users WHERE role = 'secretary' OR role = 'admin' LIMIT 1"
    );

    const createdBy = secretaryResult.rows.length > 0 ? secretaryResult.rows[0].id : provider.id;

    // Generate MRN base
    const mrnBase = Date.now().toString().slice(-6);

    console.log('👥 Creating patients and appointments:\n');

    for (let i = 0; i < demoPatients.length; i++) {
      const patient = demoPatients[i];
      const time = appointmentTimes[i];
      const mrn = `DEMO${mrnBase}${String(i + 1).padStart(2, '0')}`;
      const appointmentType = appointmentTypes[i % appointmentTypes.length];

      // Check if patient already exists (by name and DOB)
      const existingPatient = await pool.query(
        'SELECT id FROM patients WHERE first_name = $1 AND last_name = $2 AND date_of_birth = $3',
        [patient.firstName, patient.lastName, patient.dob]
      );

      let patientId: string;

      if (existingPatient.rows.length > 0) {
        patientId = existingPatient.rows[0].id;
        console.log(`  ✓ Found existing patient: ${patient.firstName} ${patient.lastName}`);
      } else {
        // Create patient
        const patientResult = await pool.query(
          `INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, phone, active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING id`,
          [mrn, patient.firstName, patient.lastName, patient.dob, patient.gender, patient.phone]
        );
        patientId = patientResult.rows[0].id;
        console.log(`  + Created patient: ${patient.firstName} ${patient.lastName} (MRN: ${mrn})`);
      }

      // Check if appointment already exists for this patient tomorrow
      const existingAppt = await pool.query(
        'SELECT id FROM appointments WHERE patient_id = $1 AND appointment_date = $2',
        [patientId, tomorrowStr]
      );

      if (existingAppt.rows.length > 0) {
        console.log(`    ⏭️  Appointment already exists for ${time.start}`);
      } else {
        // Create appointment
        await pool.query(
          `INSERT INTO appointments (patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)`,
          [patientId, provider.id, tomorrowStr, time.start, time.end, appointmentType, patient.reason, createdBy]
        );
        console.log(`    📋 Scheduled: ${time.start.substring(0, 5)} - ${appointmentType} - "${patient.reason}"`);
      }
    }

    console.log('\n✅ Demo clinic data seeded successfully!');
    console.log('\n📝 Tomorrow\'s Schedule Summary:');
    console.log('================================');
    console.log(`Date: ${tomorrowStr}`);
    console.log(`Provider: Dr. ${provider.first_name} ${provider.last_name}`);
    console.log(`Appointments: 10 patients`);
    console.log(`Morning: 9:00 AM - 12:00 PM (6 patients)`);
    console.log(`Afternoon: 1:00 PM - 3:00 PM (4 patients)`);
    console.log('\n🔑 Login as secretary to test the workflow!');

  } catch (error) {
    console.error('❌ Error seeding demo clinic:', error);
  } finally {
    await pool.end();
  }
}

seedDemoClinic();
