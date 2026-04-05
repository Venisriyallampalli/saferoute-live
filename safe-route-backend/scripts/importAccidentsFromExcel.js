require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const AccidentEvent = require('../src/models/AccidentEvent');
const { resolveEngineeredFields } = require('../src/utils/safetyScoring/accidentRiskService');

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function detectHeaderRow(rows2d) {
  for (let i = 0; i < rows2d.length; i += 1) {
    const row = Array.isArray(rows2d[i]) ? rows2d[i] : [];
    const normalized = row.map((cell) => normalizeHeader(cell));
    const hasLatitude = normalized.includes('latitude');
    const hasLongitude = normalized.includes('logitude') || normalized.includes('longitude');
    const hasSerial = normalized.includes('sl.no') || normalized.includes('sl no');

    if (hasLatitude && hasLongitude && hasSerial) {
      return i;
    }
  }

  return -1;
}

function mapRowsWithDetectedHeader(rows2d) {
  const headerRowIndex = detectHeaderRow(rows2d);
  if (headerRowIndex < 0) {
    return [];
  }

  const headerRow = rows2d[headerRowIndex] || [];
  const headers = headerRow.map((cell) => String(cell || '').trim());
  const records = [];

  for (let i = headerRowIndex + 1; i < rows2d.length; i += 1) {
    const row = Array.isArray(rows2d[i]) ? rows2d[i] : [];
    const empty = row.every((cell) => String(cell || '').trim() === '');
    if (empty) continue;

    const record = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = row[index] ?? '';
    });
    records.push(record);
  }

  return records;
}

function toNumber(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;

  const raw = String(value || '').trim();
  if (!raw) return null;

  // Recover values like "17..538742", "17. 383510", "78.368232`".
  const cleaned = raw.replace(/\s+/g, '').replace(/[^0-9+\-.]/g, '');
  if (!cleaned) return null;

  const sign = cleaned.startsWith('-') ? '-' : '';
  let body = cleaned.replace(/^[+-]/, '');
  const firstDot = body.indexOf('.');
  if (firstDot >= 0) {
    body = `${body.slice(0, firstDot + 1)}${body.slice(firstDot + 1).replace(/\./g, '')}`;
  }

  const recovered = Number(`${sign}${body}`);
  return Number.isFinite(recovered) ? recovered : null;
}

function toDateFromText(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const match = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapRow(row, index) {
  const latitude = toNumber(row.Latitude ?? row.latitude);
  const longitude = toNumber(row.Logitude ?? row.Longitude ?? row.longitude ?? row.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const accidentDateText = String(row['Road Accidents Data'] ?? row.accidentDateText ?? '').trim();
  const occurredAt = toDateFromText(accidentDateText);
  const severity = String(row['Accident Severity'] ?? row.severity ?? 'Minor Injury').trim();
  const vehicleType = String(row['Vehicle Type'] ?? row.vehicleType ?? '').trim() || null;
  const timeWindow = String(row['Time of Accident'] ?? row.timeWindow ?? '').trim() || null;
  const engineered = resolveEngineeredFields({
    occurredAt,
    timeWindow,
    severity,
    vehicleType,
  });

  return {
    sourceRecordId: String(row['Sl.No'] ?? row['S1.No'] ?? row.slno ?? index).trim(),
    year: Number(row.Year ?? row.year) || null,
    policeStation: String(row['Name of the PS'] ?? row.policeStation ?? '').trim() || null,
    accidentDateText: accidentDateText || null,
    occurredAt,
    place: String(row['Place of Accident'] ?? row.place ?? '').trim() || null,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    severity,
    roadType: String(row['Road Type'] ?? row.roadType ?? '').trim() || null,
    vehicleType,
    timeWindow,
    hourBin: engineered.hourBin,
    isNight: engineered.isNight,
    severityWeight: engineered.severityWeight,
    recencyWeight: engineered.recencyWeight,
    vulnerableVehicleWeight: engineered.vulnerableVehicleWeight,
    isActive: true,
    metadata: {
      importedVia: 'excel-script',
    },
  };
}

async function run() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error('Usage: node scripts/importAccidentsFromExcel.js <excel-file-path>');
  }

  const filePath = path.resolve(fileArg);
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const rows = mapRowsWithDetectedHeader(rows2d);

  if (!rows.length) {
    throw new Error('No usable rows found. Could not detect the expected header row.');
  }

  const operations = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const mapped = mapRow(row, index);
    if (!mapped) {
      skipped += 1;
      return;
    }

    operations.push({
      updateOne: {
        filter: { sourceRecordId: mapped.sourceRecordId },
        update: { $set: mapped },
        upsert: true,
      },
    });
  });

  if (!operations.length) {
    throw new Error('No valid records with lat/lng could be mapped');
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGO_URI or MONGODB_URI in environment');
  }

  await mongoose.connect(mongoUri);
  const result = await AccidentEvent.bulkWrite(operations, { ordered: false });

  console.log('Accident import complete');
  console.log(`Rows read: ${rows.length}`);
  console.log(`Processed: ${operations.length}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Inserted: ${result.upsertedCount || 0}`);
  console.log(`Modified: ${result.modifiedCount || 0}`);
  console.log(`Matched: ${result.matchedCount || 0}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Import failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // Ignore disconnect error when initial connect failed.
  }
  process.exitCode = 1;
});
