-- =============================================================
-- AccessMap — Seed data (Phase 2)
-- 12 sample places in Barangay San Isidro, Cainta, Rizal
-- + accessibility_features and one admin user.
-- Idempotent: explicit IDs + ON CONFLICT DO NOTHING.
-- Run via the SQL editor (service role) so RLS does not block writes.
-- =============================================================

-- -------------------------------------------------------------
-- Admin user (replace clerk_user_id with your real Clerk user id)
-- -------------------------------------------------------------
insert into public.users (id, clerk_user_id, role)
values (
  '00000000-0000-4000-8000-0000000000a1',
  'user_2xxxxxxxxxxxxxxx',
  'admin'
)
on conflict (clerk_user_id) do nothing;

-- -------------------------------------------------------------
-- Places
-- -------------------------------------------------------------

-- Hospitals / health-related (4)
insert into public.places (
  id, name, category, description, address, latitude, longitude,
  photo_url, operating_hours, created_by
) values
(
  '00000000-0000-4000-8000-000000000001',
  'Cainta Municipal Hospital',
  'hospital',
  'Level 1 general hospital run by the Cainta municipal government. Offers OPD consultations, obstetrics and gynecology, pediatrics, laboratory, ECG, x-ray, and 24-hour emergency service.',
  'Municipal Compound, A. Bonifacio Ave., Brgy. Sto. Domingo, Cainta, Rizal 1900',
  14.5772, 121.1138,
  NULL,
  'Open 24 hours daily; OPD Mon-Fri 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-000000000002',
  'Metro Rizal Doctors Hospital',
  'hospital',
  'Private secondary hospital serving eastern Metro Manila and Rizal. Emergency room, in-patient wards, operating room, and outpatient consultation services.',
  'Imelda Ave., Karangalan Village, Brgy. San Isidro, Cainta, Rizal 1900',
  14.6150, 121.0960,
  NULL,
  'Open 24 hours daily; ER 24/7, OPD Mon-Sat 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-000000000003',
  'San Isidro Multi-Specialty Clinic and Diagnostic Center',
  'health_center',
  'Private clinic and diagnostic facility offering general medicine, OB-gyne, pediatrics, and clinical laboratory services.',
  'Prisma Bldg., Imelda Ave., Karangalan Village, Brgy. San Isidro, Cainta, Rizal 1900',
  14.6158, 121.0972,
  NULL,
  'Mon-Fri 9:00 AM - 5:00 PM, Sat 9:00 AM - 12:00 NN, closed Sun',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-000000000004',
  'San Isidro Maternity Care Unit',
  'health_center',
  'Community-based maternity care unit providing prenatal check-ups, normal delivery assistance, and newborn screening for residents of Sitio Balanti.',
  'Isidro Ave., Sitio Balanti, Brgy. San Isidro, Cainta, Rizal 1900',
  14.6130, 121.1100,
  NULL,
  'Mon-Sat 8:00 AM - 5:00 PM, closed Sun and holidays',
  '00000000-0000-4000-8000-0000000000a1'
);

-- Barangay health centers (3)
insert into public.places (
  id, name, category, description, address, latitude, longitude,
  photo_url, operating_hours, created_by
) values
(
  '00000000-0000-4000-8000-000000000005',
  'Karangalan Health Center (RHU 4)',
  'health_center',
  'Rural Health Unit 4 of Cainta, the main public health station for San Isidro. Provides immunizations, maternal and child care, TB/DOTS, and medical consultations.',
  'Gate 2, Karangalan Dr., Karangalan Village, Brgy. San Isidro, Cainta, Rizal 1900',
  14.6160, 121.0990,
  NULL,
  'Mon-Fri 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-000000000006',
  'Balanti Health Center (BHS)',
  'health_center',
  'Barangay health station serving Sitio Balanti with free consultations, immunization, and family planning services.',
  '69 Aratelis St., Sitio Balanti, Brgy. San Isidro, Cainta, Rizal 1900',
  14.6138, 121.1092,
  NULL,
  'Mon-Fri 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-000000000007',
  'Brookside Health Center (BHS)',
  'health_center',
  'Barangay health station covering Brookside and nearby subdivisions, offering check-ups, immunizations, and minor first-aid.',
  'Area 8, Burmingham St., Brookside Subd., Brgy. San Isidro, Cainta, Rizal 1900',
  14.6185, 121.1055,
  NULL,
  'Mon-Fri 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
);

-- Government / civic offices (3)
insert into public.places (
  id, name, category, description, address, latitude, longitude,
  photo_url, operating_hours, created_by
) values
(
  '00000000-0000-4000-8000-000000000008',
  'Barangay San Isidro Hall',
  'government',
  'Main barangay hall of San Isidro. Handles barangay clearances, certificates of residence, and other community administrative transactions.',
  'Isidro Ave., Sitio Balanti, Brgy. San Isidro, Cainta, Rizal 1900',
  14.6125, 121.1095,
  NULL,
  'Mon-Fri 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-000000000009',
  'Karangalan Barangay Outpost',
  'government',
  'Satellite barangay office for Karangalan Village residents, accepting clearances and community documentation.',
  'Imelda Ave., Gate 2, Phase 1A, Karangalan Village, Brgy. San Isidro, Cainta, Rizal 1900',
  14.6156, 121.0980,
  NULL,
  'Mon-Fri 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-00000000000a',
  'Cainta Municipal Hall',
  'government',
  'Seat of the municipal government of Cainta. Houses the Mayor''s office, municipal departments, and the civil registry.',
  'A. Bonifacio Ave., Brgy. Sto. Domingo, Cainta, Rizal 1900',
  14.5765, 121.1125,
  NULL,
  'Mon-Fri 8:00 AM - 5:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
);

-- Secondary places (2): school + park
insert into public.places (
  id, name, category, description, address, latitude, longitude,
  photo_url, operating_hours, created_by
) values
(
  '00000000-0000-4000-8000-00000000000b',
  'San Isidro National High School',
  'school',
  'Public secondary school of Barangay San Isidro, with junior and senior high school programs.',
  'Greenpark Ave., Greenpark Subd., Brgy. San Isidro, Cainta, Rizal 1900',
  14.6192, 121.1068,
  NULL,
  'Mon-Fri 6:30 AM - 5:00 PM; Sat (special classes) 6:30 AM - 12:00 NN',
  '00000000-0000-4000-8000-0000000000a1'
),
(
  '00000000-0000-4000-8000-00000000000c',
  'Greenpark Community Park',
  'park',
  'Neighborhood park in Greenpark Subdivision with open lawns, paved walking paths, a covered court, and children''s play area.',
  'Yellow Bell St., Zone 3, Greenpark Subd., Brgy. San Isidro, Cainta, Rizal 1900',
  14.6188, 121.1060,
  NULL,
  'Open daily 5:00 AM - 9:00 PM',
  '00000000-0000-4000-8000-0000000000a1'
);

-- -------------------------------------------------------------
-- Accessibility features (3-5 per place, realistic status mix)
-- -------------------------------------------------------------
insert into public.accessibility_features (id, place_id, feature_type, status, notes) values
-- Cainta Municipal Hospital
('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-000000000001', 'ramp', 'available', 'Permanent ramp at the main entrance.'),
('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-000000000001', 'entrance', 'available', 'Wide automatic sliding doors at ER and OPD.'),
('00000000-0000-4000-8000-00000000f003', '00000000-0000-4000-8000-000000000001', 'restroom', 'available', 'Accessible restroom on the ground floor beside OPD.'),
('00000000-0000-4000-8000-00000000f004', '00000000-0000-4000-8000-000000000001', 'parking', 'available', 'Reserved accessible parking near the ER entrance.'),
('00000000-0000-4000-8000-00000000f005', '00000000-0000-4000-8000-000000000001', 'elevator', 'not_available', 'No elevator; upper floors reached by stairs.'),

-- Metro Rizal Doctors Hospital
('00000000-0000-4000-8000-00000000f006', '00000000-0000-4000-8000-000000000002', 'ramp', 'available', 'Ramp at the main lobby entrance.'),
('00000000-0000-4000-8000-00000000f007', '00000000-0000-4000-8000-000000000002', 'entrance', 'available', 'Automatic doors at the main lobby.'),
('00000000-0000-4000-8000-00000000f008', '00000000-0000-4000-8000-000000000002', 'restroom', 'available', 'Accessible restroom on every floor.'),
('00000000-0000-4000-8000-00000000f009', '00000000-0000-4000-8000-000000000002', 'parking', 'available', 'Basement parking with accessible slots.'),
('00000000-0000-4000-8000-00000000f00a', '00000000-0000-4000-8000-000000000002', 'elevator', 'available', 'Passenger elevators serve all floors.'),

-- San Isidro Multi-Specialty Clinic
('00000000-0000-4000-8000-00000000f00b', '00000000-0000-4000-8000-000000000003', 'ramp', 'available', 'Small ramp at the building lobby.'),
('00000000-0000-4000-8000-00000000f00c', '00000000-0000-4000-8000-000000000003', 'entrance', 'available', 'Revolving entrance with a side accessible door.'),
('00000000-0000-4000-8000-00000000f00d', '00000000-0000-4000-8000-000000000003', 'restroom', 'available', 'Accessible restroom on the clinic floor.'),
('00000000-0000-4000-8000-00000000f00e', '00000000-0000-4000-8000-000000000003', 'parking', 'not_available', 'No dedicated parking; restricted street parking only.'),
('00000000-0000-4000-8000-00000000f00f', '00000000-0000-4000-8000-000000000003', 'elevator', 'available', 'Elevator available to the clinic floor.'),

-- San Isidro Maternity Care Unit
('00000000-0000-4000-8000-00000000f010', '00000000-0000-4000-8000-000000000004', 'ramp', 'available', 'Ramp at the entrance.'),
('00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-000000000004', 'entrance', 'available', 'Single-door entrance, ground level.'),
('00000000-0000-4000-8000-00000000f012', '00000000-0000-4000-8000-000000000004', 'restroom', 'available', 'Accessible restroom available.'),
('00000000-0000-4000-8000-00000000f013', '00000000-0000-4000-8000-000000000004', 'parking', 'not_available', 'No dedicated parking lot.'),

-- Karangalan Health Center (RHU 4)
('00000000-0000-4000-8000-00000000f014', '00000000-0000-4000-8000-000000000005', 'ramp', 'not_available', 'Steps at the entrance; portable ramp not available.'),
('00000000-0000-4000-8000-00000000f015', '00000000-0000-4000-8000-000000000005', 'entrance', 'available', 'Single-step entrance with handrail.'),
('00000000-0000-4000-8000-00000000f016', '00000000-0000-4000-8000-000000000005', 'restroom', 'available', 'Restroom usable by wheelchair with assistance.'),
('00000000-0000-4000-8000-00000000f017', '00000000-0000-4000-8000-000000000005', 'parking', 'available', 'Open parking in front of the center.'),

-- Balanti Health Center (BHS)
('00000000-0000-4000-8000-00000000f018', '00000000-0000-4000-8000-000000000006', 'ramp', 'not_available', 'Steps at entrance only.'),
('00000000-0000-4000-8000-00000000f019', '00000000-0000-4000-8000-000000000006', 'entrance', 'available', 'Ground-level entry, single door.'),
('00000000-0000-4000-8000-00000000f01a', '00000000-0000-4000-8000-000000000006', 'restroom', 'not_available', 'Restroom not accessible to wheelchairs.'),
('00000000-0000-4000-8000-00000000f01b', '00000000-0000-4000-8000-000000000006', 'parking', 'not_available', 'Street parking only, on a narrow street.'),

-- Brookside Health Center (BHS)
('00000000-0000-4000-8000-00000000f01c', '00000000-0000-4000-8000-000000000007', 'ramp', 'available', 'Recently installed ramp at the entrance.'),
('00000000-0000-4000-8000-00000000f01d', '00000000-0000-4000-8000-000000000007', 'entrance', 'available', 'Ground-level entrance.'),
('00000000-0000-4000-8000-00000000f01e', '00000000-0000-4000-8000-000000000007', 'restroom', 'available', 'Accessible restroom available.'),
('00000000-0000-4000-8000-00000000f01f', '00000000-0000-4000-8000-000000000007', 'parking', 'available', 'Small parking area within the compound.'),

-- Barangay San Isidro Hall
('00000000-0000-4000-8000-00000000f020', '00000000-0000-4000-8000-000000000008', 'ramp', 'available', 'Access ramp at the side entrance.'),
('00000000-0000-4000-8000-00000000f021', '00000000-0000-4000-8000-000000000008', 'entrance', 'available', 'Main entrance has a step; side entrance is ground level.'),
('00000000-0000-4000-8000-00000000f022', '00000000-0000-4000-8000-000000000008', 'restroom', 'available', 'Accessible restroom near the front desk.'),
('00000000-0000-4000-8000-00000000f023', '00000000-0000-4000-8000-000000000008', 'parking', 'not_available', 'No designated parking; roadside parking only.'),

-- Karangalan Barangay Outpost
('00000000-0000-4000-8000-00000000f024', '00000000-0000-4000-8000-000000000009', 'ramp', 'not_available', 'No ramp.'),
('00000000-0000-4000-8000-00000000f025', '00000000-0000-4000-8000-000000000009', 'entrance', 'available', 'Ground-level entrance with a step threshold.'),
('00000000-0000-4000-8000-00000000f026', '00000000-0000-4000-8000-000000000009', 'restroom', 'not_available', 'No accessible restroom.'),
('00000000-0000-4000-8000-00000000f027', '00000000-0000-4000-8000-000000000009', 'parking', 'available', 'Visitor parking inside the subdivision gate.'),

-- Cainta Municipal Hall
('00000000-0000-4000-8000-00000000f028', '00000000-0000-4000-8000-00000000000a', 'ramp', 'available', 'Ramp at the main building entrance.'),
('00000000-0000-4000-8000-00000000f029', '00000000-0000-4000-8000-00000000000a', 'entrance', 'available', 'Wide automatic doors at the main lobby.'),
('00000000-0000-4000-8000-00000000f02a', '00000000-0000-4000-8000-00000000000a', 'restroom', 'available', 'Accessible restroom on the ground floor.'),
('00000000-0000-4000-8000-00000000f02b', '00000000-0000-4000-8000-00000000000a', 'parking', 'available', 'Municipal compound parking with accessible slots.'),
('00000000-0000-4000-8000-00000000f02c', '00000000-0000-4000-8000-00000000000a', 'elevator', 'not_available', 'Upper offices accessible via stairs only.'),

-- San Isidro National High School
('00000000-0000-4000-8000-00000000f02d', '00000000-0000-4000-8000-00000000000b', 'ramp', 'available', 'Ramp at the main school gate building.'),
('00000000-0000-4000-8000-00000000f02e', '00000000-0000-4000-8000-00000000000b', 'entrance', 'available', 'Ground-level entrance with paved walkway.'),
('00000000-0000-4000-8000-00000000f02f', '00000000-0000-4000-8000-00000000000b', 'restroom', 'available', 'Accessible restroom near the principal''s office.'),
('00000000-0000-4000-8000-00000000f030', '00000000-0000-4000-8000-00000000000b', 'parking', 'available', 'School parking inside the campus.'),

-- Greenpark Community Park
('00000000-0000-4000-8000-00000000f031', '00000000-0000-4000-8000-00000000000c', 'ramp', 'available', 'Paved walking paths throughout the park.'),
('00000000-0000-4000-8000-00000000f032', '00000000-0000-4000-8000-00000000000c', 'entrance', 'available', 'Open, ground-level gate entrance.'),
('00000000-0000-4000-8000-00000000f033', '00000000-0000-4000-8000-00000000000c', 'restroom', 'not_available', 'Comfort room not accessible to wheelchairs.'),
('00000000-0000-4000-8000-00000000f034', '00000000-0000-4000-8000-00000000000c', 'parking', 'available', 'Street parking along Yellow Bell St.');

-- -------------------------------------------------------------
-- Row counts to confirm after running
-- -------------------------------------------------------------
select 'places' as table_name, count(*)::int as row_count from public.places
union all
select 'accessibility_features', count(*)::int from public.accessibility_features
union all
select 'users', count(*)::int from public.users;